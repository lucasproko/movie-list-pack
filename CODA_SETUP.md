# Coda setup

The combined Pack required approval for multiple network domains and Custom authentication. On November 14, 2026, we replaced that configuration with two single-domain Packs using native query-parameter API-key authentication. Both uploads were accepted without those approvals.

| Pack | Version | Domain | System credential |
| --- | --- | --- | --- |
| [Movie Details, 80128](https://coda.io/p/80128) | 3 | `themoviedb.org` | TMDB API key, `api_key` |
| [Movie Ratings, 80132](https://coda.io/p/80132) | 2 | `mdblist.com` | MDBList API key, `apikey` |

Both Packs belong to the owner's personal workspace. Configure credentials in Pack Studio's system connection settings; no API keys belong in source or approval attachments.

## Uploading

1. Install dependencies with `npm ci`.
2. Authenticate the Coda CLI and associate `pack.ts` with Movie Details and `ratings/pack.ts` with Movie Ratings. Account and Pack association files are ignored.
3. Run `npm test`, `npm run typecheck`, and `npm run validate`.
4. Upload each entry point: `npx coda upload pack.ts` and `npx coda upload ratings/pack.ts`.
5. Configure the corresponding native system API key on each Pack, then install both Packs in a test doc.

## Using the Packs together

In Coda's formula editor, type `Movie` and choose the **Movie Details** autocomplete suggestion. This inserts the correct Pack reference; typing an assumed Pack namespace can produce a Missing Pack error.

For a movie table:

1. Add a Details formula column using Movie Details' `Movie(thisRow.Title)` (or an IMDb ID column for precise matching).
2. Add a Ratings formula column using Movie Ratings' `Ratings(thisRow.Details.ImdbId)`.
3. Expose fields such as `thisRow.Ratings.RottenTomatoesAudience` and `thisRow.Ratings.LetterboxdRating` as display columns. RT values use 0–100, so append a percent sign or divide by 100 before applying Coda percentage formatting.

For TV use `Series(...)` in Details and `Ratings(thisRow.Details.ImdbId, "show")` in Ratings. Missing scores stay blank; check `RatingsStatus` for provider failures. The personal TV table omits Letterboxd columns. Use one Details helper and one Ratings helper per row, then project their fields into display columns.

## Verification on November 14, 2026

- Eleven deterministic regression tests cover matching, ratings, provider failure, and the single-domain/native-auth boundaries.
- TypeScript and both Coda schemas validate.
- Five live SDK checks cover Inception, Dune (2021), Dune (1984), Breaking Bad, and Tom Hanks.
- Both Pack versions uploaded successfully and both system connections use native API-key authentication.
- Both Packs were installed in the separate [Movie Pack Test document](https://docs.superhuman.com/d/Movie-Pack-Test_dMmi8Pa9iyS/Movie-Pack-Test_suQkM0iv).
- Saved hosted Coda formulas returned Inception from Movie Details and from Movie Ratings using the metadata object's IMDb ID. Displayed results: IMDb 8.8/10, RT critics 86/100, RT audience 91/100, Letterboxd 4.2/5.

The original TV & Movie List migration uses the existing movie and TV tables, preserving their row IDs and personal fields. A local pre-migration backup holds all row values and column definitions. The new optional IMDb ID input overrides name matching for ambiguous titles. The migrated tables name the ratings helper Scores; formulas reference thisRow.Scores. Helper columns are hidden in the main views. Existing aggregate score formulas are retained. Runtime population verification is recorded separately from Pack SDK checks. Eleven title overrides correct ambiguous matches or misspellings, including Suspiria (2018), Oldboy (2003), The Dropout (2022), and the Get Back miniseries. The previously prepared combined-source ZIP predates this split; use the repository source for the current architecture.
