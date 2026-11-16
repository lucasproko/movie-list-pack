# Movie List Packs

A personal fork of [ontl/coda-pack-imdb](https://github.com/ontl/coda-pack-imdb), replacing its unavailable IMDb API dependency with TMDB metadata and MDBList ratings.

Three private Packs keep each provider on its own network domain with native API-key authentication:

| Pack | Entry point | Formulas | Provider |
| --- | --- | --- | --- |
| [Movie Details](https://coda.io/p/80128) | `pack.ts` | `Movie`, `Series`, `Person` | TMDB |
| [Movie Ratings](https://coda.io/p/80132) | `ratings/pack.ts` | `Ratings`, `RatingsMany`, `SavedRatings`, `SavedSeasonRatings` | MDBList; local IMDb snapshots |
| [Episode Ratings](https://coda.io/p/80264) | `seasons/pack.ts` | `SeasonRatings` | OMDb; personal IMDb snapshot fallback |

`Movie(titleOrImdbId, country?)`, `Series(titleOrImdbId, country?)`, and `Person(nameOrImdbId)` retain the original formula names. Use an IMDb ID or include a release year to distinguish remakes. Streaming defaults to US; UK is accepted as an alias for GB.

Pass the metadata result's `ImdbId` to `Ratings(imdbId, mediaType?)`. Use `"show"` for TV and `"movie"` (the default) for films. The ratings object includes `ImdbRating` (out of 10), `Metacritic`, `RottenTomatoesCritics`, `RottenTomatoesAudience` (each out of 100), `LetterboxdRating` (out of 5), source links, and `RatingsStatus`. `RottenTomatoes` is an alias for the critics score. Audience scores are reported as supplied by MDBList; they are not labeled as verified audience scores.

Metadata and streaming availability come from TMDB/JustWatch. Ratings come from MDBList, and may be missing or delayed. A ratings outage leaves the separate metadata object available and reports the failure in `RatingsStatus`. Formula results and HTTP responses use 24-hour caches. Cache expiration does not itself schedule a refresh; choose a refresh policy in Coda. Avoid hourly whole-table ratings refreshes on a limited MDBList plan. The original USA box-office breakdown, person height, and actor IMDb IDs are unavailable from these metadata responses and stay blank; actor TMDB links are supplied instead.

The same detail response also supplies trailers, languages, keywords, recommendations, cast, creators/directors, and content ratings. Movies include release date and collection; TV includes episode totals, season counts, show type/status, and last/next episode information. Ratings include vote/review counts, awards, provider update time, and digital release date. These fields add no extra requests per title: a title lookup uses two TMDB requests (resolve + details with appended resources), and one MDBList request returns all scores and rating metadata.

`RatingsMany(imdbIds, mediaType?, refreshKey?, savedSnapshots?, liveEnabled?)` deduplicates and sorts IMDb IDs, then requests batches of 50 from MDBList. Put it in a shared named canvas formula and look up each row's score by `ImdbId`. Do not call the whole-table batch separately in every row. Responses are matched by identity, including when the provider reorders or omits results. Up to 1,000 unique IDs are accepted. An optional refresh label allows recalculating the shared result after a Pack update while retaining the HTTP response cache. Batch Letterboxd values are normalized from the endpoint's 0–10 scale to the same 0–5 scale as single-title results. Batching reduces HTTP requests; verify how your plan meters titles and requests before estimating its daily allowance. A provider limit can invalidate an entire shared result.

Counts include `RottenTomatoesAudienceVotes` and `MetacriticReviews`. Rotten Tomatoes audience counts can be lower bounds (for example 250,000+ is returned as 250,000), so they are conservative confidence inputs rather than exact totals. Missing counts stay blank. TV `SeasonRatings` includes scored regular seasons whose first air date has passed, with `Label`, `Rating`, `SeasonNumber`, `EpisodeCount`, and `AirDate`. `LatestSeasonRating` and `LatestSeasonNumber` identify the latest of those seasons. Scores are TMDB user averages on a 0–10 scale, not Rotten Tomatoes season scores. The existing detail request supplies them; no per-season requests are made. Season vote counts are unavailable in that response.

## Development

### Personal IMDb season scores

The primary on-demand formula is `[Episode Ratings]::SeasonRatings(currentImdbId, seasonNumbers, savedSnapshot?)`. It makes one OMDb request per unique regular season, with 24-hour HTTP and formula caches. Put its object result in one hidden helper column, then display `.Seasons.Label` and `.LatestSeasonRating` in the visible columns. Pass `thisRow.Details.ImdbId`, `thisRow.Details.Seasons.SeasonNumber`, and `thisRow.[IMDb season data]`. Changes to those inputs cause Coda to recalculate; merely reopening the doc does not guarantee a refresh. Choose the Pack's manual refresh policy for on-demand operation. Coda can also recalculate for maintenance, so caches protect the API allowance.

OMDb episode ratings use equal weight per episode. Specials, duplicate episodes, future-dated episodes, and missing/invalid ratings are excluded. Live season results with fewer rated episodes than a matching imported snapshot retain the more complete imported score. API limits/outages also use that fallback, with source counts and any problem reported in the helper object's `Status`. Imported fallback data is only used for the same IMDb ID. OMDb season responses do not provide episode vote counts, so no extra per-episode requests are made to fetch them. This Pack uses its own OMDb key and never calls MDBList or depends on a Mac job.

The local importer below is optional preparation/recovery tooling; its daily Mac schedule was disabled in favor of on-demand Pack formulas.

`scripts/imdb_seasons.py` streams IMDb's official daily `title.episode` and `title.ratings` datasets, joins episodes to series by IMDb ID, and calculates the arithmetic mean of rated episodes in each regular season. Each episode has equal weight. Unrated episodes, season zero, and unnumbered episodes are excluded. The result retains rated/known episode counts and median/minimum episode vote counts; episode votes are not treated as unique season voters. A partially rated season is labeled with its coverage. These are calculated episode averages, not official IMDb season ratings.

`SavedSeasonRatings(snapshotJson, currentImdbId)` reads the imported JSON with no network calls. A blank snapshot or changed title returns no scores, preventing stale ratings from following an edited row. The existing TMDB `Details.SeasonRatings` remains available separately, but should not be used for the IMDb columns.

Keep an editable, hidden text column `IMDb season data` and a hidden formula column `IMDb season ID = thisRow.Details.ImdbId` in the TV table. The visible formulas are:

```coda
[Movie Ratings]::SavedSeasonRatings(thisRow.[IMDb season data], thisRow.Details.ImdbId).Seasons.Label
[Movie Ratings]::SavedSeasonRatings(thisRow.[IMDb season data], thisRow.Details.ImdbId).LatestSeasonRating
```

For a current-row export with `id`, `name`, and `imdbId`, prepare snapshots without writing:

```sh
python3 scripts/imdb_seasons.py --rows-file /private/path/rows.json --output /private/path/seasons.json
python3 -m unittest discover -s tests -p 'test_*.py'
```

For a manual bulk refresh, use `--sync --config /private/path/imdb-seasons.local.json --output /private/path/seasons.json`. The private config contains `docId`, `tableId`, `dataColumnId`, `idColumn` (the formula column name), and `tokenFile` (a private file containing a doc-scoped Coda API token). `dataColumnName` defaults to `IMDb season data`. The importer reads the current row identities, only updates that data column, rechecks identity before writing by row ID, and backs off on Coda rate limits. Unchanged scores retain their snapshots to avoid unnecessary recalculation. Its output/log reports zero MDBList requests. Dataset downloads are cached outside the repo and checked at most once per UTC day when the tool runs.

IMDb data and private watchlist exports must stay in personal storage, outside the public repo. Source: [IMDb non-commercial datasets](https://data.imdb.com/non-commercial-datasets/). Information courtesy of IMDb (https://www.imdb.com). Used with permission.

- `npm ci`
- `npm test` — deterministic regressions for matching, rating scales, missing values, and provider failures.
- `npm run validate` — validates all three Pack schemas.
- `npm run typecheck`
- `npm run test:live` — authenticated SDK checks against public sample titles. Requires local system credentials for both Packs.

The SDK dependency uses the Superhuman package through the compatible `@codahq/packs-sdk` import name. Configure each Pack's system API key separately. The local SDK credential format is `{ "credentials": { "paramValue": "YOUR_KEY" } }`: TMDB in `.coda-credentials.json`, MDBList in `ratings/.coda-credentials.json`. Coda account tokens, Pack IDs, and provider credentials are held in ignored local files, never in source. See [setup and verification](CODA_SETUP.md).

Install and test both private Packs in a separate document before migrating existing Pack column formats or formulas. A GitHub fork does not replace an installed Pack automatically.

Original Pack by Nick Haffie-Emslie. Metadata from TMDB; ratings via MDBList; streaming availability from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.

`SavedRatings(snapshotJson, imdbId)` reads a saved Ratings-schema object without network access. It checks title identity, preserves the original fetch timestamp, rejects invalid score ranges, and labels the result as saved data awaiting live refresh. A blank snapshot returns an explicit awaiting-ratings status. In the doc, hidden editable snapshot columns are passed into the two shared `RatingsMany` formulas. Set `liveEnabled` to false to return saved scores and explicit awaiting-ratings records without provider requests. A successful live result takes precedence over its saved counterpart; provider errors stop further HTTP batches and use saved results where available. Row formulas look up the shared result by IMDb identity, avoiding a separate Pack calculation per row. Refreshing live data does not automatically rewrite these snapshots.
