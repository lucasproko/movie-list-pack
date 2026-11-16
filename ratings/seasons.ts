import * as coda from "@codahq/packs-sdk";

export function getSavedSeasons(snapshotJson: string, imdbId: string) {
  const empty = {ImdbId: imdbId, Seasons: [], Status: "Awaiting IMDb episode import"};
  if (!snapshotJson.trim() || !imdbId) return empty;
  let snapshot: any;
  try { snapshot = JSON.parse(snapshotJson); } catch { throw new coda.UserVisibleError("IMDb season data is not valid JSON."); }
  if (snapshot?.ImdbId !== imdbId || !/^tt\d+$/.test(imdbId)) return {...empty, Status: "Title changed; awaiting IMDb episode import"};
  if (!Array.isArray(snapshot.Seasons)) throw new coda.UserVisibleError("IMDb season data has no season list.");
  const seen = new Set<number>();
  const seasons = snapshot.Seasons.filter((s: any) => {
    const valid = Number.isSafeInteger(s?.SeasonNumber) && s.SeasonNumber > 0 && !seen.has(s.SeasonNumber)
      && typeof s.Rating === "number" && Number.isFinite(s.Rating) && s.Rating >= 1 && s.Rating <= 10
      && Number.isSafeInteger(s.RatedEpisodes) && s.RatedEpisodes > 0
      && Number.isSafeInteger(s.KnownEpisodes) && s.KnownEpisodes >= s.RatedEpisodes
      && typeof s.MedianEpisodeVotes === "number" && Number.isFinite(s.MedianEpisodeVotes) && s.MedianEpisodeVotes >= 1;
    if (valid) seen.add(s.SeasonNumber);
    return valid;
  }).sort((a: any, b: any) => a.SeasonNumber - b.SeasonNumber).map((s: any) => ({
    SeasonNumber: s.SeasonNumber, Rating: s.Rating, RatedEpisodes: s.RatedEpisodes,
    KnownEpisodes: s.KnownEpisodes, MedianEpisodeVotes: s.MedianEpisodeVotes,
    Label: `S${s.SeasonNumber} · ${s.Rating.toFixed(1)}${s.RatedEpisodes < s.KnownEpisodes ? ` (${s.RatedEpisodes}/${s.KnownEpisodes} rated)` : ""}`,
  }));
  const latest = seasons[seasons.length - 1];
  return {ImdbId: imdbId, Seasons: seasons, LatestSeasonRating: latest?.Rating,
    LatestSeasonNumber: latest?.SeasonNumber, UpdatedAt: snapshot.UpdatedAt,
    Status: seasons.length ? "IMDb episode averages" : "No rated IMDb episodes available"};
}
