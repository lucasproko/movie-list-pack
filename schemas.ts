import * as coda from "@codahq/packs-sdk";

/* -------------------------------------------------------------------------- */
/*                                Attributions                                */
/* -------------------------------------------------------------------------- */

const attributionImdb: coda.AttributionNode[] = [
  {
    type: coda.AttributionNodeType.Text,
    text: "Data from ",
  },
  {
    type: coda.AttributionNodeType.Link,
    anchorText: "TMDB",
    anchorUrl: "https://www.themoviedb.org/",
  },
];

const attributionGeneric: coda.AttributionNode[] = [
  {
    type: coda.AttributionNodeType.Text,
    text: "Metadata from TMDB. Streaming data from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
];

/* -------------------------------------------------------------------------- */
/*                           Smaller Object Schemas                           */
/* -------------------------------------------------------------------------- */

export const WatchProviderSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  properties: {
    name: {
      type: coda.ValueType.String,
    },
    country: {
      type: coda.ValueType.String,
    },
  },
  displayProperty: "name",
  identity: { name: "WatchProvider" },
  attribution: [
    {
      type: coda.AttributionNodeType.Text,
      text: "Data by ",
    },
    {
      type: coda.AttributionNodeType.Link,
      anchorText: "JustWatch",
      anchorUrl: "https://www.justwatch.com/",
    },
    {
      type: coda.AttributionNodeType.Image,
      imageUrl: "https://www.justwatch.com/appassets/favicon.ico",
      anchorUrl: "https://www.justwatch.com/",
    },
  ],
});

export const PersonSchemaMini = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  properties: {
    Name: {
      type: coda.ValueType.String,
    },
    Photo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    ImdbLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    ImdbId: {
      type: coda.ValueType.String,
    },
    TmdbId: { type: coda.ValueType.Number },
    TmdbLink: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "Name",
  attribution: attributionImdb,
  identity: { name: "Person" },
});

/* -------------------------------------------------------------------------- */
/*                           Formula Object Schemas                           */
/* -------------------------------------------------------------------------- */

const titleExtraProperties = {
  Tagline: {type: coda.ValueType.String},
  Languages: {type: coda.ValueType.Array, items: {type: coda.ValueType.String}},
  OriginalLanguage: {type: coda.ValueType.String},
  Keywords: {type: coda.ValueType.Array, items: {type: coda.ValueType.String}},
  MoreLikeThis: {type: coda.ValueType.Array, items: {type: coda.ValueType.String}},
} as const;

export const MovieSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  properties: {
    ...titleExtraProperties,
    ReleaseDate: {type: coda.ValueType.String, codaType: coda.ValueHintType.Date},
    Collection: {type: coda.ValueType.String},
    Title: { type: coda.ValueType.String },
    HorizontalPoster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    Year: { type: coda.ValueType.Number },
    Runtime: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Duration,
    },
    Director: {
      type: coda.ValueType.Array,
      items: PersonSchemaMini,
    },
    Writer: {
      type: coda.ValueType.Array,
      items: PersonSchemaMini,
    },
    Starring: {
      type: coda.ValueType.Array,
      items: PersonSchemaMini,
    },
    ImdbLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    WatchLinks: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    Stream: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    Buy: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    Rent: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    TrailerLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    TmdbId: { type: coda.ValueType.Number },
    TmdbLink: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    ContentRating: { type: coda.ValueType.String },
    VerticalPoster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    Plot: {
      type: coda.ValueType.String,
    },
    Genres: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Countries: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Companies: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    BoxOffice: {
      type: coda.ValueType.Object,
      properties: {
        Budget: {
          type: coda.ValueType.Number,
          codaType: coda.ValueHintType.Currency,
        },
        USAGross: {
          type: coda.ValueType.Number,
          codaType: coda.ValueHintType.Currency,
        },
        USAOpeningWeekend: {
          type: coda.ValueType.Number,
          codaType: coda.ValueHintType.Currency,
        },
        GlobalGross: {
          type: coda.ValueType.Number,
          codaType: coda.ValueHintType.Currency,
        },
      },
      displayProperty: "GlobalGross",
    },
    ImdbId: { type: coda.ValueType.String },
    Description: { type: coda.ValueType.String },
  },
  displayProperty: "Title",
  featuredProperties: ["Title", "Year", "HorizontalPoster"],
  idProperty: "ImdbId",
  identity: { name: "Movie" },
  attribution: attributionGeneric,
});

export const SeriesSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  properties: {
    ...titleExtraProperties,
    TotalEpisodes: {type: coda.ValueType.Number},
    SeasonCount: {type: coda.ValueType.Number},
    SeriesType: {type: coda.ValueType.String},
    LastAirDate: {type: coda.ValueType.String, codaType: coda.ValueHintType.Date},
    NextEpisodeTitle: {type: coda.ValueType.String},
    NextEpisodeNumber: {type: coda.ValueType.String},
    LatestSeasonRating: {type: coda.ValueType.Number},
    LatestSeasonNumber: {type: coda.ValueType.Number},
    SeasonRatings: {type: coda.ValueType.Array, items: {
      type: coda.ValueType.Object, properties: {
        Label: {type: coda.ValueType.String}, SeasonNumber: {type: coda.ValueType.Number},
        Rating: {type: coda.ValueType.Number}, EpisodeCount: {type: coda.ValueType.Number},
        AirDate: {type: coda.ValueType.String, codaType: coda.ValueHintType.Date},
      }, displayProperty: "Label", idProperty: "SeasonNumber",
    }},
    Title: { type: coda.ValueType.String },
    FullTitle: { type: coda.ValueType.String },
    HorizontalPoster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    Years: {
      type: coda.ValueType.Object,
      properties: {
        Years: { type: coda.ValueType.String },
        StartYear: { type: coda.ValueType.String },
        EndYear: { type: coda.ValueType.String },
      },
      displayProperty: "Years",
    },
    Creators: {
      type: coda.ValueType.Array,
      items: PersonSchemaMini,
    },
    Starring: {
      type: coda.ValueType.Array,
      items: PersonSchemaMini,
    },
    ImdbLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    WatchLinks: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    Stream: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    Buy: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    Rent: {
      type: coda.ValueType.Array,
      items: WatchProviderSchema,
    },
    TrailerLink: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    ContentRating: { type: coda.ValueType.String },
    TmdbId: { type: coda.ValueType.Number },
    TmdbLink: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    VerticalPoster: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    Plot: { type: coda.ValueType.String },
    Genres: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Companies: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Networks: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Countries: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    Seasons: {
      type: coda.ValueType.Array,
      items: {
        type: coda.ValueType.Object,
        properties: {
          SeasonName: { type: coda.ValueType.String },
          SeasonNumber: { type: coda.ValueType.Number },
          EpisodeCount: { type: coda.ValueType.Number },
          Rating: { type: coda.ValueType.Number },
          AirDate: {
            type: coda.ValueType.String,
            codaType: coda.ValueHintType.Date,
          },
        },
        displayProperty: "SeasonName",
        idProperty: "SeasonNumber",
      },
    },
    NextEpisodeAirDate: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    Status: { type: coda.ValueType.String },
    ImdbId: { type: coda.ValueType.String },
    Description: { type: coda.ValueType.String },
  },
  displayProperty: "Title",
  featuredProperties: ["Title", "Years", "HorizontalPoster"],
  idProperty: "ImdbId",
  identity: { name: "Movie" },
  attribution: attributionGeneric,
});

export const PersonSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  properties: {
    Name: { type: coda.ValueType.String },
    Description: { type: coda.ValueType.String },
    Photo: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.ImageReference,
    },
    Roles: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    KnownFor: {
      type: coda.ValueType.Array,
      items: {
        type: coda.ValueType.Object,
        properties: {
          Summary: { type: coda.ValueType.String },
          Title: { type: coda.ValueType.String },
          Role: { type: coda.ValueType.String },
          Year: { type: coda.ValueType.String },
          ImdbId: { type: coda.ValueType.String },
          ImdbLink: {
            type: coda.ValueType.String,
            codaType: coda.ValueHintType.Url,
          },
          Poster: {
            type: coda.ValueType.String,
            codaType: coda.ValueHintType.ImageReference,
          },
        },
      },
    },
    Bio: { type: coda.ValueType.String },
    BirthDate: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    DeathDate: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Date,
    },
    Age: { type: coda.ValueType.Number },
    Height: { type: coda.ValueType.String },
    ImdbLink: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    ImdbId: { type: coda.ValueType.String },
  },
  displayProperty: "Name",
  featuredProperties: ["Description", "Photo"],
  idProperty: "ImdbId",
  identity: { name: "Person" },
  attribution: attributionImdb,
});
