import * as coda from "@codahq/packs-sdk";
import {getSavedSeasons} from "../ratings/seasons";

type Data = Record<string, any>;

export function mapSeason(data: Data, seasonNumber: number, now = Date.now()) {
  if (data?.Response !== "True" || Number(data.Season) !== seasonNumber || !Array.isArray(data.Episodes)) return undefined;
  const ids = new Set<string>();
  const numbers = new Set<number>();
  const episodes = data.Episodes.filter((episode: Data) => {
    const number = Number(episode.Episode);
    if (!/^tt\d+$/.test(episode.imdbID || "") || !Number.isSafeInteger(number) || number < 1
      || ids.has(episode.imdbID) || numbers.has(number)) return false;
    const release = Date.parse(episode.Released);
    if (Number.isFinite(release) && release > now) return false;
    ids.add(episode.imdbID); numbers.add(number);
    return true;
  });
  const rated = episodes.map((episode: Data) => Number(episode.imdbRating))
    .filter((rating: number) => Number.isFinite(rating) && rating >= 1 && rating <= 10);
  if (!rated.length) return undefined;
  return {SeasonNumber: seasonNumber, Rating: rated.reduce((sum: number, score: number) => sum + score, 0) / rated.length,
    RatedEpisodes: rated.length, KnownEpisodes: episodes.length, Source: "OMDb", Label: ""};
}

export async function getSeasonRatings(context: coda.ExecutionContext, input: string, seasonNumbers: number[], snapshotJson = "") {
  const imdbId = input.trim().toLowerCase();
  if (!imdbId) return {ImdbId: "", Seasons: [], Status: "Awaiting an IMDb show ID", LiveSeasons: 0, SavedSeasons: 0};
  if (!/^tt\d+$/.test(imdbId)) throw new coda.UserVisibleError("Use the show's IMDb title ID from Details.");
  if (seasonNumbers.some(n => !Number.isSafeInteger(n) || n < 0)) throw new coda.UserVisibleError("Season numbers must be nonnegative whole numbers.");
  const numbers = [...new Set(seasonNumbers.filter(n => n > 0))].sort((a, b) => a - b);
  if (numbers.length > 50) throw new coda.UserVisibleError("Request at most 50 regular seasons per show.");
  let saved: Data[] = [];
  try { saved = getSavedSeasons(snapshotJson, imdbId).Seasons; } catch { /* An invalid backup must not prevent a live lookup. */ }
  const imported = new Map<number, Data>(saved.map(s => [s.SeasonNumber, s]));
  const outcomes = new Map<number, Data>();
  let issue = "";
  let stop = false;
  for (let offset = 0; offset < numbers.length && !stop; offset += 4) {
    await Promise.all(numbers.slice(offset, offset + 4).map(async season => {
      try {
        const response = await context.fetcher.fetch({method: "GET",
          url: coda.withQueryParams("https://www.omdbapi.com/", {i: imdbId, Season: season, r: "json"}), cacheTtlSecs: 86400});
        const data = response.body as Data;
        if (/limit|api key|apikey|unauthorized/i.test(String(data?.Error || ""))) {
          issue = /limit/i.test(String(data.Error)) ? "OMDb request limit reached" : "OMDb key rejected";
          stop = true;
        }
        const mapped = mapSeason(data, season);
        if (mapped) outcomes.set(season, mapped);
      } catch (error) {
        const status = (error as any)?.statusCode || (error as any)?.response?.statusCode;
        issue = status === 429 ? "OMDb request limit reached" : status === 401 || status === 403 ? "OMDb key rejected" : "OMDb unavailable";
        stop = true;
      }
    }));
  }
  const seasons: Data[] = [];
  // The imported episode set may be more complete than OMDb's listing.
  for (const season of [...new Set([...numbers, ...imported.keys()])].sort((a, b) => a - b)) {
    const live = outcomes.get(season), backup = imported.get(season);
    const score: Data | undefined = live && (!backup || live.RatedEpisodes >= backup.RatedEpisodes)
      ? {...live, KnownEpisodes: Math.max(live.KnownEpisodes, backup?.KnownEpisodes || 0)}
      : backup ? {...backup, Source: "IMDb dataset"} : undefined;
    if (score) seasons.push({...score, Label: `S${season} · ${score.Rating.toFixed(1)}${score.RatedEpisodes < score.KnownEpisodes ? ` (${score.RatedEpisodes}/${score.KnownEpisodes} rated)` : ""}`});
  }
  const liveCount = seasons.filter(s => s.Source === "OMDb").length;
  const savedCount = seasons.length - liveCount;
  const latest = seasons[seasons.length - 1];
  return {ImdbId: imdbId, Seasons: seasons, LatestSeasonRating: latest?.Rating, LatestSeasonNumber: latest?.SeasonNumber,
    LiveSeasons: liveCount, SavedSeasons: savedCount, UpdatedAt: new Date().toISOString(),
    Status: `${issue ? `${issue}; ` : ""}OMDb: ${liveCount} seasons; saved IMDb: ${savedCount} seasons${!seasons.length ? "; no rated episodes available" : ""}`};
}
