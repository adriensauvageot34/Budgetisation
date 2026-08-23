import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";

export type GalleryKind = "moments" | "places" | "merchants";

export type MomentsGalleryFilters = {
  readonly sort: "recent";
};

export type PlacesGalleryFilters = {
  readonly sort: "frequent" | "spent" | "recent";
};

export type MerchantsGalleryFilters = {
  readonly sort: "spent" | "frequent" | "recent";
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
]);
const placeSorts = new Set<PlacesGalleryFilters["sort"]>([
  "frequent",
  "spent",
  "recent",
]);
const merchantSorts = new Set<MerchantsGalleryFilters["sort"]>([
  "spent",
  "frequent",
  "recent",
]);

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
    ["sort"],
    "MerchantsGalleryFilters",
  );
  const sort = withValidationPath("sort", () =>
    parseStringLiteral<MerchantsGalleryFilters["sort"]>(
      requireProperty(record, "sort", "MerchantsGalleryFilters"),
      merchantSorts,
      "MerchantsGalleryFilters.sort",
    ),
  );
  return { sort };
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
