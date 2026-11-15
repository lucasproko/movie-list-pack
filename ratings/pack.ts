import * as coda from "@codahq/packs-sdk";
import {getRatings, getRatingsMany} from "./helpers";

export const pack = coda.newPack();
pack.addNetworkDomain("mdblist.com");
pack.setSystemAuthentication({ type: coda.AuthenticationType.QueryParamToken, paramName: "apikey" });

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
  name: "RatingsMany",
  description: "Get ratings and review counts for a shared list of IMDb IDs using efficient batches.",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({type: coda.ParameterType.StringArray, name: "imdbIds", description: "IMDb title IDs from the Details columns."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "mediaType", description: '"movie" (default) or "show".', optional: true}),
    coda.makeParameter({type: coda.ParameterType.String, name: "refreshKey", description: "Optional version label to recalculate the shared result after a Pack update. HTTP responses still use their cache.", optional: true}),
  ],
  resultType: coda.ValueType.Array,
  items: RatingsSchema,
  execute: async ([ids, mediaType], context) => getRatingsMany(context, ids, mediaType),
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
