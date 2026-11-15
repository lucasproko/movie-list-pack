import * as coda from "@codahq/packs-sdk";

type Data = Record<string, any>;
type Media = "movie" | "tv";
const image = (path?: string) => path ? `https://image.tmdb.org/t/p/w780${path}` : undefined;
const year = (date?: string) => date?.slice(0, 4) || undefined;
const normalize = (text: string) => text.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function parseQuery(input: string) {
  const query = input.trim();
  if (!query) throw new coda.UserVisibleError("Enter a title or IMDb ID.");
  const id = query.match(/^(tt\d+)$|^https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)(?:[/?#].*)?$/i);
  if (id) return { imdbId: (id[1] || id[2]).toLowerCase() };
  const dated = query.match(/^(.*?)\s*(?:\((\d{4})\)|[, ]\s*(\d{4}))$/);
  return { title: dated ? dated[1].trim() : query, year: dated ? Number(dated[2] || dated[3]) : undefined };
}

async function tmdb(context: coda.ExecutionContext, path: string, params: Record<string, string | number> = {}) {
  try {
    const response = await context.fetcher.fetch({
      method: "GET",
      url: coda.withQueryParams(`https://api.themoviedb.org/3/${path}`, params),
      cacheTtlSecs: 86400,
    });
    return response.body as Data;
  } catch (error) {
    const status = (error as any)?.statusCode || (error as any)?.response?.statusCode;
    throw new coda.UserVisibleError(status === 401 ? "TMDB API key was rejected. Update the Pack credentials." : "Movie details are unavailable from TMDB. Try again later.");
  }
}

async function resolve(context: coda.ExecutionContext, input: string, type: Media) {
  const query = parseQuery(input);
  if (query.imdbId) {
    const found = await tmdb(context, `find/${query.imdbId}`, { external_source: "imdb_id" });
    const match = found[type === "movie" ? "movie_results" : "tv_results"]?.[0];
    if (!match) throw new coda.UserVisibleError(`No ${type === "movie" ? "movie" : "TV series"} found for that IMDb ID.`);
    return match.id as number;
  }
  const params: Record<string, string | number> = { query: query.title!, include_adult: "false" };
  if (query.year) params[type === "movie" ? "year" : "first_air_date_year"] = query.year;
  const found = await tmdb(context, `search/${type}`, params);
  const matches = (found.results || []).filter((item: Data) => !query.year || Number(year(item.release_date || item.first_air_date)) === query.year);
  const match = matches.find((item: Data) => [item.title, item.name, item.original_title, item.original_name].some(title => title && normalize(title) === normalize(query.title!))) || matches[0];
  if (!match) throw new coda.UserVisibleError("No matching title found. Try the exact title and year, or an IMDb ID.");
  return match.id as number;
}

function people(records: Data[] = []) {
  const seen = new Set<number>();
  return records.filter(p => !seen.has(p.id) && !!seen.add(p.id)).map(p => ({ Name: p.name, Photo: image(p.profile_path), TmdbId: p.id, TmdbLink: `https://www.themoviedb.org/person/${p.id}` }));
}

function providers(data: Data, country: string) {
  const local = data["watch/providers"]?.results?.[country];
  const records = (key: string) => (local?.[key] || []).map((p: Data) => ({ name: p.provider_name, country }));
  return { WatchLinks: local?.link, Stream: records("flatrate"), Buy: records("buy"), Rent: records("rent") };
}

function trailer(data: Data) {
  const videos = (data.videos?.results || []).filter((v: Data) => v.site === "YouTube" && v.type === "Trailer");
  const best = videos.find((v: Data) => v.official) || videos[0];
  return best?.key ? `https://www.youtube.com/watch?v=${encodeURIComponent(best.key)}` : undefined;
}

function certification(data: Data, country: string, type: Media) {
  for (const code of country === "US" ? [country] : [country, "US"]) {
    if (type === "tv") {
      const rating = data.content_ratings?.results?.find((r: Data) => r.iso_3166_1 === code)?.rating;
      if (rating) return rating;
    } else {
      const releases = data.release_dates?.results?.find((r: Data) => r.iso_3166_1 === code)?.release_dates || [];
      const rating = releases.find((r: Data) => r.type === 3 && r.certification)?.certification || releases.find((r: Data) => r.certification)?.certification;
      if (rating) return rating;
    }
  }
  return undefined;
}

async function getTitle(context: coda.ExecutionContext, query: string, country: string, type: Media) {
  country = country.trim().toUpperCase();
  if (country === "UK") country = "GB";
  if (!/^[A-Z]{2}$/.test(country)) throw new coda.UserVisibleError("Use a two-letter streaming country, such as US, CA, or GB.");
  const id = await resolve(context, query, type);
  const append = type === "movie" ? "credits,videos,release_dates,external_ids,watch/providers,keywords,recommendations" : "credits,videos,content_ratings,external_ids,watch/providers,keywords,recommendations";
  const data = await tmdb(context, `${type}/${id}`, { append_to_response: append });
  const imdbId = data.imdb_id || data.external_ids?.imdb_id || undefined;
  const common = {
    Title: data.title || data.name, TmdbId: id, TmdbLink: `https://www.themoviedb.org/${type}/${id}`,
    ImdbId: imdbId, ImdbLink: imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined,
    HorizontalPoster: image(data.backdrop_path), VerticalPoster: image(data.poster_path),
    Plot: data.overview || undefined, Description: data.overview || undefined,
    Starring: people((data.credits?.cast || []).slice(0, 10)), Genres: (data.genres || []).map((g: Data) => g.name),
    Countries: (data.production_countries || []).map((c: Data) => c.name), Companies: (data.production_companies || []).map((c: Data) => c.name),
    TrailerLink: trailer(data), ContentRating: certification(data, country, type), ...providers(data, country),
    Tagline: data.tagline || undefined,
    Languages: (data.spoken_languages || []).map((language: Data) => language.english_name || language.name).filter(Boolean),
    OriginalLanguage: data.original_language || undefined,
    Keywords: (data.keywords?.keywords || data.keywords?.results || []).map((keyword: Data) => keyword.name),
    MoreLikeThis: (data.recommendations?.results || []).slice(0, 5).map((title: Data) => {
      const released = year(title.release_date || title.first_air_date);
      return `${title.title || title.name}${released ? ` (${released})` : ""}`;
    }),
  };
  if (type === "movie") return {
    ...common, Year: data.release_date ? Number(year(data.release_date)) : undefined, Runtime: data.runtime ? `${data.runtime} minutes` : undefined,
    Director: people((data.credits?.crew || []).filter((p: Data) => p.job === "Director")),
    Writer: people((data.credits?.crew || []).filter((p: Data) => p.department === "Writing")),
    BoxOffice: { Budget: data.budget || undefined, GlobalGross: data.revenue || undefined },
    ReleaseDate: data.release_date || undefined, Collection: data.belongs_to_collection?.name || undefined,
  };
  const start = year(data.first_air_date);
  const end = data.in_production === false ? year(data.last_air_date) : undefined;
  const seasons = (data.seasons || []).map((s: Data) => ({SeasonName: s.name, SeasonNumber: s.season_number, EpisodeCount: s.episode_count, AirDate: s.air_date || undefined, Rating: typeof s.vote_average === "number" && s.vote_average > 0 && s.vote_average <= 10 ? s.vote_average : undefined}));
  const today = new Date().toISOString().slice(0, 10);
  const seasonRatings = seasons.filter((s: Data) => s.SeasonNumber > 0 && s.AirDate && s.AirDate <= today && s.Rating !== undefined).sort((a: Data, b: Data) => a.SeasonNumber - b.SeasonNumber).map((s: Data) => ({...s, Label: `S${s.SeasonNumber} · ${s.Rating.toFixed(1)}`}));
  const latest = seasonRatings[seasonRatings.length - 1];
  return {
    ...common, FullTitle: data.original_name || data.name,
    Years: { Years: start ? `${start}${end && end !== start ? `–${end}` : end ? "" : "–"}` : "", StartYear: start, EndYear: end },
    Creators: people(data.created_by || []), Networks: (data.networks || []).map((n: Data) => n.name),
    Seasons: seasons, SeasonRatings: seasonRatings,
    LatestSeasonRating: latest?.Rating, LatestSeasonNumber: latest?.SeasonNumber,
    NextEpisodeAirDate: data.next_episode_to_air?.air_date || undefined, Status: data.status,
    TotalEpisodes: data.number_of_episodes, SeasonCount: data.number_of_seasons,
    SeriesType: data.type || undefined, LastAirDate: data.last_air_date || undefined,
    NextEpisodeTitle: data.next_episode_to_air?.name || undefined,
    NextEpisodeNumber: data.next_episode_to_air ? `S${data.next_episode_to_air.season_number}E${data.next_episode_to_air.episode_number}` : undefined,
  };
}

export const getMovie = (context: coda.ExecutionContext, query: string, country = "US") => getTitle(context, query, country, "movie");
export const getSeries = (context: coda.ExecutionContext, query: string, country = "US") => getTitle(context, query, country, "tv");

export async function getPerson(context: coda.ExecutionContext, input: string) {
  const query = input.trim();
  if (!query) throw new coda.UserVisibleError("Enter a person's name or IMDb ID.");
  const byId = /^nm\d+$/.test(query);
  const found = await tmdb(context, byId ? `find/${query}` : "search/person", byId ? { external_source: "imdb_id" } : { query });
  const id = (byId ? found.person_results : found.results)?.[0]?.id;
  if (!id) throw new coda.UserVisibleError("No matching person found.");
  const data = await tmdb(context, `person/${id}`, { append_to_response: "external_ids,combined_credits" });
  const imdbId = data.imdb_id || data.external_ids?.imdb_id;
  let age: number | undefined;
  if (data.birthday) {
    const birth = new Date(data.birthday);
    const end = data.deathday ? new Date(data.deathday) : new Date();
    age = end.getUTCFullYear() - birth.getUTCFullYear();
    if (end.getUTCMonth() < birth.getUTCMonth() || (end.getUTCMonth() === birth.getUTCMonth() && end.getUTCDate() < birth.getUTCDate())) age--;
  }
  return {
    Name: data.name, Photo: image(data.profile_path), Bio: data.biography || undefined, Description: data.known_for_department,
    Roles: data.known_for_department ? [data.known_for_department] : [], BirthDate: data.birthday || undefined, DeathDate: data.deathday || undefined, Age: age,
    ImdbId: imdbId, ImdbLink: imdbId ? `https://www.imdb.com/name/${imdbId}/` : undefined,
    KnownFor: (data.combined_credits?.cast || []).sort((a: Data, b: Data) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 4).map((credit: Data) => ({
      Summary: `${credit.title || credit.name}${credit.character ? ` — ${credit.character}` : ""}`, Title: credit.title || credit.name,
      Role: credit.character || undefined, Year: year(credit.release_date || credit.first_air_date), Poster: image(credit.poster_path),
    })),
  };
}

export async function autocompleteCountryCode(context: coda.ExecutionContext, search: string) {
  const data = await tmdb(context, "watch/providers/regions");
  return coda.simpleAutocomplete(search, (data.results || []).map((r: Data) => ({ display: r.english_name, value: r.iso_3166_1 })));
}
