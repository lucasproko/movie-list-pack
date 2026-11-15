# Movie List Packs

A personal fork of [ontl/coda-pack-imdb](https://github.com/ontl/coda-pack-imdb), replacing its unavailable IMDb API dependency with TMDB metadata and MDBList ratings.

Two private Packs keep each provider on its own network domain with native API-key authentication:

| Pack | Entry point | Formulas | Provider |
| --- | --- | --- | --- |
| [Movie Details](https://coda.io/p/80128) | `pack.ts` | `Movie`, `Series`, `Person` | TMDB |
| [Movie Ratings](https://coda.io/p/80132) | `ratings/pack.ts` | `Ratings`, `RatingsMany` | MDBList |

`Movie(titleOrImdbId, country?)`, `Series(titleOrImdbId, country?)`, and `Person(nameOrImdbId)` retain the original formula names. Use an IMDb ID or include a release year to distinguish remakes. Streaming defaults to US; UK is accepted as an alias for GB.

Pass the metadata result's `ImdbId` to `Ratings(imdbId, mediaType?)`. Use `"show"` for TV and `"movie"` (the default) for films. The ratings object includes `ImdbRating` (out of 10), `Metacritic`, `RottenTomatoesCritics`, `RottenTomatoesAudience` (each out of 100), `LetterboxdRating` (out of 5), source links, and `RatingsStatus`. `RottenTomatoes` is an alias for the critics score. Audience scores are reported as supplied by MDBList; they are not labeled as verified audience scores.

Metadata and streaming availability come from TMDB/JustWatch. Ratings come from MDBList, and may be missing or delayed. A ratings outage leaves the separate metadata object available and reports the failure in `RatingsStatus`. Formula results and HTTP responses use 24-hour caches. Cache expiration does not itself schedule a refresh; choose a refresh policy in Coda. Avoid hourly whole-table ratings refreshes on a limited MDBList plan. The original USA box-office breakdown, person height, and actor IMDb IDs are unavailable from these metadata responses and stay blank; actor TMDB links are supplied instead.

The same detail response also supplies trailers, languages, keywords, recommendations, cast, creators/directors, and content ratings. Movies include release date and collection; TV includes episode totals, season counts, show type/status, and last/next episode information. Ratings include vote/review counts, awards, provider update time, and digital release date. These fields add no extra requests per title: a title lookup uses two TMDB requests (resolve + details with appended resources), and one MDBList request returns all scores and rating metadata.

`RatingsMany(imdbIds, mediaType?)` deduplicates and sorts IMDb IDs, then requests batches of 50 from MDBList. Put it in a shared named canvas formula and look up each row's score by `ImdbId`. Do not call the whole-table batch separately in every row. Responses are matched by identity, including when the provider reorders or omits results. Up to 1,000 unique IDs are accepted. MDBList currently meters one request per batch; verify the allowance for your plan.

Counts include `RottenTomatoesAudienceVotes` and `MetacriticReviews`. Rotten Tomatoes audience counts can be lower bounds (for example 250,000+ is returned as 250,000), so they are conservative confidence inputs rather than exact totals. Missing counts stay blank. TV `SeasonRatings` includes scored regular seasons whose first air date has passed, with `Label`, `Rating`, `SeasonNumber`, `EpisodeCount`, and `AirDate`. `LatestSeasonRating` and `LatestSeasonNumber` identify the latest of those seasons. Scores are TMDB user averages on a 0–10 scale, not Rotten Tomatoes season scores. The existing detail request supplies them; no per-season requests are made. Season vote counts are unavailable in that response.

## Development

- `npm ci`
- `npm test` — deterministic regressions for matching, rating scales, missing values, and provider failures.
- `npm run validate` — validates both Pack schemas.
- `npm run typecheck`
- `npm run test:live` — authenticated SDK checks against public sample titles. Requires local system credentials for both Packs.

The SDK dependency uses the Superhuman package through the compatible `@codahq/packs-sdk` import name. Configure each Pack's system API key separately. The local SDK credential format is `{ "credentials": { "paramValue": "YOUR_KEY" } }`: TMDB in `.coda-credentials.json`, MDBList in `ratings/.coda-credentials.json`. Coda account tokens, Pack IDs, and provider credentials are held in ignored local files, never in source. See [setup and verification](CODA_SETUP.md).

Install and test both private Packs in a separate document before migrating existing Pack column formats or formulas. A GitHub fork does not replace an installed Pack automatically.

Original Pack by Nick Haffie-Emslie. Metadata from TMDB; ratings via MDBList; streaming availability from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.
