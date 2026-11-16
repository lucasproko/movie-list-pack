# Coda setup

The combined Pack required approval for multiple network domains and Custom authentication. On November 14, 2026, we replaced that configuration with two single-domain Packs using native query-parameter API-key authentication. Both uploads were accepted without those approvals.

On November 15, a third single-domain Pack added on-demand IMDb episode averages through OMDb. The daily Mac import job is disabled.

| Pack | Version | Domain | System credential |
| --- | --- | --- | --- |
| [Movie Details, 80128](https://coda.io/p/80128) | 4 | `themoviedb.org` | TMDB API key, `api_key` |
| [Movie Ratings, 80132](https://coda.io/p/80132) | 9 | `mdblist.com` | MDBList API key, `apikey` |
| [Episode Ratings, 80264](https://coda.io/p/80264) | 1 | `omdbapi.com` | Activated OMDb API key, `apikey` |

All three Packs belong to the owner's personal workspace. Configure credentials in Pack Studio's system connection settings; no API keys belong in source or approval attachments.

## Uploading

1. Install dependencies with `npm ci`.
2. Authenticate the Coda CLI and associate `pack.ts` with Movie Details, `ratings/pack.ts` with Movie Ratings, and `seasons/pack.ts` with Episode Ratings. Account and Pack association files are ignored.
3. Run `npm test`, `npm run typecheck`, and `npm run validate`.
4. Upload each entry point: `npx coda upload pack.ts`, `npx coda upload ratings/pack.ts`, and `npx coda upload seasons/pack.ts`.
5. Configure the corresponding native system API key on each Pack, then install the Packs in a test doc. OMDb keys require email activation before use.

## Using the Packs together

In Coda's formula editor, type `Movie` and choose the **Movie Details** autocomplete suggestion. This inserts the correct Pack reference; typing an assumed Pack namespace can produce a Missing Pack error.

For a movie table:

1. Add a Details formula column using Movie Details' `Movie(thisRow.Title)` (or an IMDb ID column for precise matching).
2. Add a Ratings formula column using Movie Ratings' `Ratings(thisRow.Details.ImdbId)`.
3. Expose fields such as `thisRow.Ratings.RottenTomatoesAudience` and `thisRow.Ratings.LetterboxdRating` as display columns. RT values use 0–100, so append a percent sign or divide by 100 before applying Coda percentage formatting.

For TV use `Series(...)` in Details and `Ratings(thisRow.Details.ImdbId, "show")` in Ratings. Missing scores stay blank; check `RatingsStatus` for provider failures. The personal TV table omits Letterboxd columns. Use one Details helper and one Ratings helper per row, then project their fields into display columns.

For on-demand season scores, create one hidden `IMDb seasons` formula column:

```coda
[Episode Ratings]::SeasonRatings(thisRow.Details.ImdbId, thisRow.Details.Seasons.SeasonNumber, thisRow.[IMDb season data])
```

The multi-select `IMDb season scores` column reads `thisRow.[IMDb seasons].Seasons.Label`. The numeric `Latest IMDb season score` reads `thisRow.[IMDb seasons].LatestSeasonRating`, formatted to one decimal place. The helper's `Status`, `LiveSeasons`, `SavedSeasons`, and individual season `Source` distinguish API data from imported fallback. Keep the Pack's refresh policy set to Manually: Coda still recalculates when the formula inputs change, with 24-hour caches. No Mac process or daily schedule is needed.

The first integration check found live OMDb coverage for 184 of the 406 imported seasons; 222 retained more complete imported IMDb data. These fallback snapshots do not update themselves. A new title without a backup displays only rated episodes available from OMDb, marking partial coverage or leaving scores empty when none are available. Live tests included A Gentleman in Moscow (import retained because OMDb rated only 2/8 episodes), 3 Body Problem (8/8 live episodes), and The Queen's Gambit (7/7 live episodes with no backup).

Twenty-three deterministic tests, TypeScript, and all three Pack schemas pass. The original movie/TV aggregate formulas are independent of season scores.

## Verification on November 14, 2026

- Eleven deterministic regression tests cover matching, ratings, provider failure, and the single-domain/native-auth boundaries.
- TypeScript and both Coda schemas validate.
- Five live SDK checks cover Inception, Dune (2021), Dune (1984), Breaking Bad, and Tom Hanks.
- Both Pack versions uploaded successfully and both system connections use native API-key authentication.
- Both Packs were installed in the separate [Movie Pack Test document](https://docs.superhuman.com/d/Movie-Pack-Test_dMmi8Pa9iyS/Movie-Pack-Test_suQkM0iv).
- Saved hosted Coda formulas returned Inception from Movie Details and from Movie Ratings using the metadata object's IMDb ID. Displayed results: IMDb 8.8/10, RT critics 86/100, RT audience 91/100, Letterboxd 4.2/5.

The original TV & Movie List migration uses the existing movie and TV tables, preserving their row IDs and personal fields. A local pre-migration backup holds all row values and column definitions. The new optional IMDb ID input overrides name matching for ambiguous titles. The migrated tables name the ratings helper Scores; formulas reference thisRow.Scores. Helper columns are hidden in the main views. Existing aggregate score formulas are retained. Runtime population verification is recorded separately from Pack SDK checks. Eleven title overrides correct ambiguous matches or misspellings, including Suspiria (2018), Oldboy (2003), The Dropout (2022), and the Get Back miniseries. The previously prepared combined-source ZIP predates this split; use the repository source for the current architecture.


## Original-table migration verification

On November 14, 2026 (Pacific time), the original 269 movie rows and 151 TV rows were migrated in place. Native Coda aggregate queries and REST row readback confirmed successful ratings lookups and IMDb ratings for all 420 rows. Rotten Tomatoes audience coverage was 247 movies and 146 shows; all 269 movies had Letterboxd ratings. TV Letterboxd columns were removed from both the original/test setup. Provider-specific gaps stay blank.

A full row comparison found no changes to names, watch status, personal ratings, notes, shortlist flags, or reactions. Both original tables retain their row IDs, existing views, and custom aggregate formulas. The extra columns read shared Details and Scores objects instead of requesting each field separately. A local private backup and verification receipt are stored outside the repository.
