import * as coda from "@codahq/packs-sdk";
import * as helpers from "./helpers";
import * as schemas from "./schemas";

export const pack = coda.newPack();

/* -------------------------------------------------------------------------- */
/*                                     API                                    */
/* -------------------------------------------------------------------------- */

pack.addNetworkDomain("themoviedb.org");
pack.setSystemAuthentication({
  type: coda.AuthenticationType.QueryParamToken,
  paramName: "api_key",
});

/* -------------------------------------------------------------------------- */
/*                               Column Formats                               */
/* -------------------------------------------------------------------------- */

pack.addColumnFormat({
  name: "Movie",
  instructions:
    "Shows movie details from TMDB (put title, title and year, or IMDB ID in column)",
  formulaName: "Movie",
});

pack.addColumnFormat({
  name: "Series",
  instructions:
    "Shows TV series details from TMDB (put show name or IMDB ID in column)",
  formulaName: "Series",
});

pack.addColumnFormat({
  name: "Person",
  instructions:
    "Shows person details from TMDB (put name or IMDB ID in column)",
  formulaName: "Person",
});

/* -------------------------------------------------------------------------- */
/*                                  Formulas                                  */
/* -------------------------------------------------------------------------- */

pack.addFormula({
  name: "Movie",
  description: "Search for a movie title to retrieve all its details",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "title",
      description: "Search by title, title and year, or IMDb ID",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "streamingCountry",
      description:
        "2-letter code for your country, to show which of your streaming providers have this movie (e.g. 'US', 'CA', 'UK')",
      optional: true,
      autocomplete: async function (context, search) {
        return helpers.autocompleteCountryCode(context, search);
      },
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.MovieSchema,
  execute: async function ([title, country], context) {
    return helpers.getMovie(context, title, country);
  },
});

pack.addFormula({
  name: "Series",
  description: "Search for a TV series title to retrieve all its details",
  cacheTtlSecs: 86400,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "title",
      description: "Search by title, title and year, or IMDb ID",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "streamingCountry",
      description:
        "2-letter code for your country, to show which of your streaming providers have this series (e.g. 'US', 'CA', 'UK')",
      optional: true,
      autocomplete: async function (context, search) {
        return helpers.autocompleteCountryCode(context, search);
      },
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.SeriesSchema,
  execute: async function ([title, country], context) {
    return helpers.getSeries(context, title, country);
  },
});

pack.addFormula({
  name: "Person",
  description:
    "Search for a person (actor, producer, foley artist) to retrieve all their details.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "name",
      description:
        "Search by name or IMDb ID beginning with nm",
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: schemas.PersonSchema,
  execute: async function ([name], context) {
    return helpers.getPerson(context, name);
  },
});
