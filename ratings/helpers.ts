import * as coda from "@codahq/packs-sdk";

type Data = Record<string, any>;

function value(ratings: Data[], sources: string[], maximum: number) {
  for (const source of sources) {
    const number = ratings.find(r => r.source === source)?.value;
    if (typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= maximum) return number;
  }
  return undefined;
}

function sourceUrl(ratings: Data[], sources: string[], host: string) {
  const path = sources.map(source => ratings.find(r => r.source === source)?.url).find(url => typeof url === "string" && url.length);
  if (!path) return undefined;
  if (path.startsWith("/") && !path.startsWith("//")) return `https://${host}${path}`;
  return path.startsWith(`https://${host}/`) ? path : undefined;
}

function votes(ratings: Data[], source: string) {
  const count = ratings.find(rating => rating.source === source)?.votes;
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

export function mapRatings(data: Data) {
  const ratings = Array.isArray(data.ratings) ? data.ratings : [];
  const critics = value(ratings, ["tomatoes"], 100);
  return {
    ImdbRating: value(ratings, ["imdb"], 10), Metacritic: value(ratings, ["metacritic"], 100),
    RottenTomatoes: critics, RottenTomatoesCritics: critics,
    RottenTomatoesAudience: value(ratings, ["popcorn", "tomatoesaudience", "audience"], 100),
    RottenTomatoesLink: sourceUrl(ratings, ["tomatoes", "popcorn", "tomatoesaudience", "audience"], "www.rottentomatoes.com"),
    LetterboxdRating: value(ratings, ["letterboxd"], 5),
    LetterboxdLink: sourceUrl(ratings, ["letterboxd"], "letterboxd.com"),
    ImdbVotes: votes(ratings, "imdb"), LetterboxdVotes: votes(ratings, "letterboxd"),
    RottenTomatoesCriticReviews: votes(ratings, "tomatoes"),
    Awards: typeof data.awards === "string" && data.awards.trim() ? data.awards : undefined,
    ProviderUpdatedAt: typeof data.updated === "string" && Number.isFinite(Date.parse(data.updated)) ? new Date(data.updated).toISOString() : undefined,
    DigitalReleaseDate: typeof data.released_digital === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.released_digital) ? data.released_digital : undefined,
    RatingsStatus: ratings.some(r => typeof r.value === "number") ? "Available via MDBList" : "No ratings available",
    RatingsFetchedAt: new Date().toISOString(),
  };
}

export async function getRatings(context: coda.ExecutionContext, input: string, mediaType = "movie") {
  const id = input.trim().match(/^(tt\d+)$|^https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)(?:[/?#].*)?$/i);
  if (!input.trim()) return { Title: "No IMDb ID", RatingsStatus: "No IMDb ID" };
  if (!id) throw new coda.UserVisibleError("Enter an IMDb title ID, such as tt1375666, or an IMDb title URL.");
  const imdbId = (id[1] || id[2]).toLowerCase();
  const type = mediaType.trim().toLowerCase() === "tv" ? "show" : mediaType.trim().toLowerCase();
  if (type !== "movie" && type !== "show") throw new coda.UserVisibleError('Use "movie" or "show" for the media type.');
  const fallback = { ImdbId: imdbId, Title: imdbId };
  try {
    const response = await context.fetcher.fetch({ method: "GET", url: `https://api.mdblist.com/imdb/${type}/${imdbId}`, cacheTtlSecs: 86400 });
    const data = response.body;
    if (data?.error) return { ...fallback, RatingsStatus: "MDBList could not retrieve ratings" };
    if (data?.ids?.imdb && data.ids.imdb !== imdbId) return { ...fallback, RatingsStatus: "MDBList returned a different title; ratings omitted" };
    return { ...fallback, Title: data?.title || imdbId, TmdbId: data?.ids?.tmdb || undefined, Year: data?.year || undefined, ...mapRatings(data || {}) };
  } catch (error) {
    const status = (error as any)?.statusCode || (error as any)?.response?.statusCode;
    return { ...fallback, RatingsStatus: status === 429 ? "MDBList rate limit reached; try later" : status === 401 || status === 403 ? "MDBList key rejected or access denied" : "MDBList unavailable; try again later" };
  }
}
