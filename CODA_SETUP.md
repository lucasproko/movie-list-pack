# Coda setup and current blocker

Private Pack: [Movie List Plus](https://coda.io/p/80128)

The Pack was created in the owner's personal workspace. All three supplied credentials were verified. Coda's upload API rejected the first version with:

> Specifying multiple network domains requires Superhuman Docs approval.

Request platform approval for Pack **80128** with:

- Network domains: `themoviedb.org`, `mdblist.com`.
- Authentication: Custom system authentication with `tmdbApiKey` and `mdblistApiKey`.
- Authenticated network domains: both above. Each request inserts only the credential for its own service.
- Purpose: private personal movie/TV list; TMDB supplies metadata and region-specific streaming availability, MDBList supplies ratings including Rotten Tomatoes audience and Letterboxd.

No API keys belong in the approval request. They are configured separately as system credentials after a successful upload.

After approval:

1. `npx coda upload pack.ts --notes 'TMDB metadata and MDBList ratings'`
2. Set the two system authentication parameters in Pack Studio → Settings.
3. Install the private Pack in a new test document. Test movies by IMDb ID, both Dune remakes, TV shows, scores, and streaming availability.
4. Validate the existing document's formulas and migrate a copy first. The user's original data and formulas have not been migrated.

## Verification completed

- Coda token: whoami succeeded for the owner.
- TMDB: live metadata, poster, videos, and regional availability returned.
- MDBList: live IMDb, Metacritic, RT critics/audience, Letterboxd ratings returned.
- Six deterministic regression tests passed.
- Five live Coda SDK executions passed: Inception; Dune (2021); Dune (1984); Breaking Bad; Tom Hanks.
- TypeScript and Coda local schema validation passed.
- Upload reached server validation, then failed on the multi-domain approval requirement. No version has been installed or proven in Coda's hosted runtime.

MDBList-only could supply basic metadata and ratings using a single domain, but region-specific streaming and full person/cast details are not an equivalent replacement. The implementation retains the full two-provider design.
