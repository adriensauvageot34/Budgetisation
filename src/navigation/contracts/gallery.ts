import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";

export type GalleryKind = "moments" | "places" | "merchants";

export type MomentsGalleryFilters = {
  readonly sort: "recent" | "cost" | "duration";
};

export type PlacesGalleryFilters = {
  readonly sort: "frequent" | "spend" | "new" | "recent";
};

export type MerchantsGalleryFilters = {
  readonly sort: "spend" | "frequent" | "ticket" | "recent";
  readonly channel?: "physical" | "online";
};

export type GalleryFiltersByKind = {
  readonly moments: MomentsGalleryFilters;
  readonly places: PlacesGalleryFilters;
  readonly merchants: MerchantsGalleryFilters;
};

export type GalleryFilters<Kind extends GalleryKind = GalleryKind> =
  GalleryFiltersByKind[Kind];

export type GalleryNavigationFilters =
  | {
      readonly gallery: "moments";
      readonly filters: MomentsGalleryFilters;
    }
  | {
      readonly gallery: "places";
      readonly filters: PlacesGalleryFilters;
    }
  | {
      readonly gallery: "merchants";
      readonly filters: MerchantsGalleryFilters;
    };

const galleryKinds = new Set<GalleryKind>([
  "moments",
  "places",
  "merchants",
]);
const momentSorts = new Set<MomentsGalleryFilters["sort"]>([
  "recent",
  "cost",
  "duration",
]);
const placeSorts = new Set<PlacesGalleryFilters["sort"]>([
  "frequent",
  "spend",
  "new",
  "recent",
]);
const merchantSorts = new Set<MerchantsGalleryFilters["sort"]>([
  "spend",
  "frequent",
  "ticket",
  "recent",
]);
const merchantChannels = new Set<
  NonNullable<MerchantsGalleryFilters["channel"]>
>(["physical", "online"]);

export function parseGalleryKind(value: unknown): GalleryKind {
  return parseStringLiteral<GalleryKind>(value, galleryKinds, "GalleryKind");
}

export function parseMomentsGalleryFilters(
  value: unknown,
): MomentsGalleryFilters {
  const record = parseStrictRecord(value, ["sort"], "MomentsGalleryFilters");
  return {
    sort: withValidationPath("sort", () =>
      parseStringLiteral<MomentsGalleryFilters["sort"]>(
        requireProperty(record, "sort", "MomentsGalleryFilters"),
        momentSorts,
        "MomentsGalleryFilters.sort",
      ),
    ),
  };
}

export function parsePlacesGalleryFilters(
  value: unknown,
): PlacesGalleryFilters {
  const record = parseStrictRecord(value, ["sort"], "PlacesGalleryFilters");
  return {
    sort: withValidationPath("sort", () =>
      parseStringLiteral<PlacesGalleryFilters["sort"]>(
        requireProperty(record, "sort", "PlacesGalleryFilters"),
        placeSorts,
        "PlacesGalleryFilters.sort",
      ),
    ),
  };
}

export function parseMerchantsGalleryFilters(
  value: unknown,
): MerchantsGalleryFilters {
  const record = parseStrictRecord(
    value,
    ["sort", "channel"],
    "MerchantsGalleryFilters",
  );
  const sort = withValidationPath("sort", () =>
    parseStringLiteral<MerchantsGalleryFilters["sort"]>(
      requireProperty(record, "sort", "MerchantsGalleryFilters"),
      merchantSorts,
      "MerchantsGalleryFilters.sort",
    ),
  );
  const channel = Object.prototype.hasOwnProperty.call(record, "channel")
    ? withValidationPath("channel", () =>
        parseStringLiteral<NonNullable<MerchantsGalleryFilters["channel"]>>(
          record.channel,
          merchantChannels,
          "MerchantsGalleryFilters.channel",
        ),
      )
    : undefined;
  return { sort, ...(channel === undefined ? {} : { channel }) };
}

export function parseGalleryNavigationFilters(
  value: unknown,
): GalleryNavigationFilters {
  const record = parseStrictRecord(
    value,
    ["gallery", "filters"],
    "GalleryNavigationFilters",
  );
  const gallery = withValidationPath("gallery", () =>
    parseGalleryKind(
      requireProperty(record, "gallery", "GalleryNavigationFilters"),
    ),
  );
  const filters = requireProperty(
    record,
    "filters",
    "GalleryNavigationFilters",
  );

  if (gallery === "moments") {
    return {
      gallery,
      filters: withValidationPath("filters", () =>
        parseMomentsGalleryFilters(filters),
      ),
    };
  }
  if (gallery === "places") {
    return {
      gallery,
      filters: withValidationPath("filters", () =>
        parsePlacesGalleryFilters(filters),
      ),
    };
  }
  return {
    gallery,
    filters: withValidationPath("filters", () =>
      parseMerchantsGalleryFilters(filters),
    ),
  };
}

export const galleryNavigationFiltersSchema = createRuntimeSchema(
  parseGalleryNavigationFilters,
);
export const momentsGalleryFiltersSchema = createRuntimeSchema(
  parseMomentsGalleryFilters,
);
export const placesGalleryFiltersSchema = createRuntimeSchema(
  parsePlacesGalleryFilters,
);
export const merchantsGalleryFiltersSchema = createRuntimeSchema(
  parseMerchantsGalleryFilters,
);
