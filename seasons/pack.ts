import * as coda from "@codahq/packs-sdk";
import {getSeasonRatings} from "./helpers";

export const pack = coda.newPack();
pack.addNetworkDomain("omdbapi.com");
pack.setSystemAuthentication({type: coda.AuthenticationType.QueryParamToken, paramName: "apikey"});

const SeasonSchema = coda.makeObjectSchema({
  properties: {
    SeasonNumber: {type: coda.ValueType.Number}, Rating: {type: coda.ValueType.Number},
    RatedEpisodes: {type: coda.ValueType.Number}, KnownEpisodes: {type: coda.ValueType.Number},
    Source: {type: coda.ValueType.String}, Label: {type: coda.ValueType.String},
  }, displayProperty: "Label", idProperty: "SeasonNumber",
});

pack.addFormula({
  name: "SeasonRatings",
  description: "Calculate mean IMDb episode ratings per season via OMDb. Keeps imported IMDb scores when the API is unavailable or has fewer rated episodes.",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({type: coda.ParameterType.String, name: "imdbId", description: "The show's current Details.ImdbId."}),
    coda.makeParameter({type: coda.ParameterType.NumberArray, name: "seasonNumbers", description: "Season numbers from Details.Seasons; zero (specials) is ignored."}),
    coda.makeParameter({type: coda.ParameterType.String, name: "savedSnapshot", description: "Optional personal IMDb dataset JSON to preserve more complete imported scores.", optional: true}),
  ],
  resultType: coda.ValueType.Object,
  schema: coda.makeObjectSchema({
    properties: {
      ImdbId: {type: coda.ValueType.String}, Seasons: {type: coda.ValueType.Array, items: SeasonSchema},
      LatestSeasonRating: {type: coda.ValueType.Number}, LatestSeasonNumber: {type: coda.ValueType.Number},
      LiveSeasons: {type: coda.ValueType.Number}, SavedSeasons: {type: coda.ValueType.Number},
      Status: {type: coda.ValueType.String}, UpdatedAt: {type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime},
    }, displayProperty: "Status", idProperty: "ImdbId",
    attribution: [
      {type: coda.AttributionNodeType.Text, text: "IMDb episode ratings via OMDb (CC BY-NC 4.0). Season scores are calculated episode averages."},
      {type: coda.AttributionNodeType.Text, text: "Imported fallback: Information courtesy of IMDb (https://www.imdb.com). Used with permission."},
    ],
  }),
  execute: async ([imdbId, numbers, snapshot], context) => getSeasonRatings(context, imdbId, numbers, snapshot),
});
