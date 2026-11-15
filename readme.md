# Movie List Pack

A personal fork of [ontl/coda-pack-imdb](https://github.com/ontl/coda-pack-imdb), replacing its unavailable IMDb API dependency with TMDB metadata and MDBList ratings.

`Movie(titleOrImdbId, country?)`, `Series(titleOrImdbId, country?)`, and `Person(nameOrImdbId)` retain the original formula names. Use an IMDb ID or include a release year to distinguish remakes. Streaming defaults to US; UK is accepted as an alias for GB.

New fields include `RottenTomatoesAudience` (percent), `RottenTomatoesCritics` (percent), `LetterboxdRating` (out of 5), source links, and ratings status. `RottenTomatoes` remains an alias for the critics score. Audience scores are reported as supplied by MDBList; the Pack does not label them verified audience scores.

Metadata and streaming availability come from TMDB/JustWatch. Ratings come from MDBList, and may be missing or delayed. A ratings outage leaves metadata available and reports the failure in `RatingsStatus`. Requests are cached for 24 hours. The original USA box-office breakdown, person height, and actor IMDb IDs are unavailable from these metadata responses and stay blank; actor TMDB links are supplied instead.

## Development

- `npm ci`
- `npm test` — deterministic regressions for matching, rating scales, missing values, and provider failures.
- `npm run validate` — Coda schema validation.
- `npx tsc --noEmit`
- `node -r ts-node/register/transpile-only tests/live-check.cjs` — authenticated SDK checks against public sample titles. Requires local credentials.

Use Coda's CLI to configure system credentials named `tmdbApiKey` and `mdblistApiKey`. Tokens are held in ignored, local `.coda.json` / `.coda-credentials.json` files, never in source. Multi-domain and Custom authentication may require platform approval before upload.

Install and test a new private Pack on a separate test doc before migrating existing Pack column formats or formulas. A GitHub fork does not replace an installed Pack automatically.

Original Pack by Nick Haffie-Emslie. Metadata from TMDB; ratings via MDBList; streaming availability from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.
