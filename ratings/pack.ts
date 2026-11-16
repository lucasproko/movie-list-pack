import * as coda from "@codahq/packs-sdk";
import {getRatings, getRatingsWithFallback, getSavedRatings} from "./helpers";
import {getSavedSeasons} from "./seasons";

export const pack = coda.newPack();
pack.addNetworkDomain("mdblist.com");
pack.setSystemAuthentication({ type: coda.AuthenticationType.QueryParamToken, paramName: "apikey" });

pack.addFormula({
  name: "SavedSeasonRatings",
  description: "Read personal IMDb season averages imported from IMDb's daily datasets, without API calls.",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({type: coda.ParameterType.String, name: "snapshotJson", description: "Imported IMDb season JSON from this row."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "imdbId", description: "The current Details IMDb ID, to prevent scores surviving a title change."}),
  ],
  resultType: coda.ValueType.Object,
  schema: coda.makeObjectSchema({
    properties: {
      ImdbId: {type: coda.ValueType.String}, Status: {type: coda.ValueType.String},
      UpdatedAt: {type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime},
      LatestSeasonRating: {type: coda.ValueType.Number}, LatestSeasonNumber: {type: coda.ValueType.Number},
      Seasons: {type: coda.ValueType.Array, items: coda.makeObjectSchema({
        properties: {
          SeasonNumber: {type: coda.ValueType.Number}, Rating: {type: coda.ValueType.Number},
          RatedEpisodes: {type: coda.ValueType.Number}, KnownEpisodes: {type: coda.ValueType.Number},
          MedianEpisodeVotes: {type: coda.ValueType.Number}, Label: {type: coda.ValueType.String},
        }, displayProperty: "Label", idProperty: "SeasonNumber",
      })},
    }, displayProperty: "Status", idProperty: "ImdbId",
    attribution: [{type: coda.AttributionNodeType.Text, text: "Information courtesy of IMDb (https://www.imdb.com). Used with permission. Season scores are calculated means of IMDb episode ratings."}],
  }),
  execute: async ([snapshot, imdbId]) => getSavedSeasons(snapshot, imdbId),
});

export const RatingsSchema = coda.makeObjectSchema({
  properties: {
    Title: {type: coda.ValueType.String},
    ImdbId: {type: coda.ValueType.String},
    TmdbId: {type: coda.ValueType.Number},
    Year: {type: coda.ValueType.Number},
    ImdbRating: {type: coda.ValueType.Number},
    Metacritic: {type: coda.ValueType.Number},
    RottenTomatoes: {type: coda.ValueType.Number},
    RottenTomatoesCritics: {type: coda.ValueType.Number},
    RottenTomatoesAudience: {type: coda.ValueType.Number},
    RottenTomatoesLink: {type: coda.ValueType.String, codaType: coda.ValueHintType.Url},
    LetterboxdRating: {type: coda.ValueType.Number},
    LetterboxdLink: {type: coda.ValueType.String, codaType: coda.ValueHintType.Url},
    ImdbVotes: {type: coda.ValueType.Number},
    LetterboxdVotes: {type: coda.ValueType.Number},
    RottenTomatoesCriticReviews: {type: coda.ValueType.Number},
    RottenTomatoesAudienceVotes: {type: coda.ValueType.Number},
    MetacriticReviews: {type: coda.ValueType.Number},
    Awards: {type: coda.ValueType.String},
    ProviderUpdatedAt: {type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime},
    DigitalReleaseDate: {type: coda.ValueType.String, codaType: coda.ValueHintType.Date},
    RatingsStatus: {type: coda.ValueType.String},
    RatingsFetchedAt: {type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime},
  },
  displayProperty: "Title",
  idProperty: "ImdbId",
  featuredProperties: ["ImdbRating", "RottenTomatoesAudience", "LetterboxdRating"],
  identity: {name: "Ratings"},
  attribution: [{type: coda.AttributionNodeType.Text, text: "Ratings via MDBList. Audience scores are reported as provided; not labeled as verified audience scores."}],
});

pack.addFormula({
  name: "SavedRatings",
  description: "Read a saved ratings snapshot without network requests while the live provider is unavailable.",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({type: coda.ParameterType.String, name: "snapshotJson", description: "Saved ratings JSON from this row."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "imdbId", description: "The row's IMDb ID, used to verify the saved title."}),
  ],
  resultType: coda.ValueType.Object,
  schema: RatingsSchema,
  execute: async ([snapshot, imdbId]) => getSavedRatings(snapshot, imdbId),
});

pack.addFormula({
  name: "RatingsMany",
  description: "Get ratings and review counts for a shared list of IMDb IDs using efficient batches.",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({type: coda.ParameterType.StringArray, name: "imdbIds", description: "IMDb title IDs from the Details columns."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "mediaType", description: '"movie" (default) or "show".', optional: true}),
    coda.makeParameter({type: coda.ParameterType.String, name: "refreshKey", description: "Optional version label to recalculate the shared result after a Pack update. HTTP responses still use their cache.", optional: true}),
    coda.makeParameter({type: coda.ParameterType.StringArray, name: "savedSnapshots", description: "Optional saved Ratings-schema JSON objects to use when live ratings are unavailable.", optional: true}),
    coda.makeParameter({type: coda.ParameterType.Boolean, name: "liveEnabled", description: "Set false to read saved ratings without making provider requests, for example until a daily quota resets.", optional: true}),
  ],
  resultType: coda.ValueType.Array,
  items: RatingsSchema,
  execute: async ([ids, mediaType, _refreshKey, snapshots, liveEnabled], context) => getRatingsWithFallback(context, ids, mediaType, snapshots, liveEnabled),
});

pack.addFormula({
  name: "Ratings",
  cacheTtlSecs: 86400,
  description: "Get IMDb, Metacritic, Rotten Tomatoes critics and audience, and Letterboxd ratings by IMDb ID.",
  parameters: [
    coda.makeParameter({type: coda.ParameterType.String, name: "imdbId", description: "IMDb ID or URL. Use the ImdbId from Movie Details."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "mediaType", description: '"movie" (default) or "show" for TV.', optional: true, autocomplete: async (_context, search) => coda.simpleAutocomplete(search, ["movie", "show"])}),
  ],
  resultType: coda.ValueType.Object,
  schema: RatingsSchema,
  execute: async ([imdbId, mediaType], context) => getRatings(context, imdbId, mediaType),
});
