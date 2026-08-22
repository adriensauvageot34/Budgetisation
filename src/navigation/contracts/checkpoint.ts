import {
  normalizeAnalysisScope,
  parseAnalysisFilters,
  parseAnalysisSubject,
  parseAnalysisTime,
  type NormalizedAnalysisFilters,
  type NormalizedAnalysisScope,
} from "../../core/scope";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import { semanticAnchorSchema, type SemanticAnchor } from "./anchors";
import {
  galleryNavigationFiltersSchema,
  type GalleryNavigationFilters,
} from "./gallery";
import {
  operationsNavigationFiltersSchema,
  type OperationsNavigationFilters,
} from "./operations";
import {
  rootNavigationContextSchema,
  type RootNavigationContext,
} from "./routes";
import {
  navigationSubviewRefSchema,
  type NavigationSubviewRef,
} from "./subviews";

export const navigationCheckpointVersion = "navigation-checkpoint:v1" as const;

export type NavigationFilterSnapshot =
  | {
      readonly kind: "analysis";
      readonly value: NormalizedAnalysisFilters;
    }
  | {
      readonly kind: "operations";
      readonly value: OperationsNavigationFilters;
    }
  | {
      readonly kind: "gallery";
      readonly value: GalleryNavigationFilters;
    };

export type NavigationCheckpoint = {
  readonly version: typeof navigationCheckpointVersion;
  readonly route: RootNavigationContext;
  readonly scope?: NormalizedAnalysisScope;
  readonly filters?: NavigationFilterSnapshot;
  readonly subview?: NavigationSubviewRef;
  readonly anchor?: SemanticAnchor;
  readonly anchorOffset?: number;
  readonly scrollFallbackY?: number;
};

const normalizedFilterKeys = [
  "categoryIds",
  "activityIds",
  "merchantIds",
  "placeIds",
  "lifeScopeContext",
  "dayContext",
] as const;

function assertStrictlySorted(values: readonly string[], fieldName: string): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) {
      validationFailure({
        path: [fieldName, index],
        code: "not_normalized",
        message: `${fieldName} doit être trié et dédupliqué.`,
      });
    }
  }
}

export function parseNormalizedAnalysisFilters(
  value: unknown,
): NormalizedAnalysisFilters {
  const record = parseStrictRecord(
    value,
    normalizedFilterKeys,
    "NormalizedAnalysisFilters",
  );
  for (const key of normalizedFilterKeys) {
    requireProperty(record, key, "NormalizedAnalysisFilters");
  }

  const parsed = parseAnalysisFilters(record);
  const {
    categoryIds,
    activityIds,
    merchantIds,
    placeIds,
    lifeScopeContext,
    dayContext,
  } = parsed;

  if (
    categoryIds === undefined ||
    activityIds === undefined ||
    merchantIds === undefined ||
    placeIds === undefined ||
    lifeScopeContext === undefined ||
    dayContext === undefined
  ) {
    validationFailure({
      path: [],
      code: "not_normalized",
      message: "NormalizedAnalysisFilters doit contenir toutes ses collections.",
    });
  }

  assertStrictlySorted(categoryIds, "categoryIds");
  assertStrictlySorted(activityIds, "activityIds");
  assertStrictlySorted(merchantIds, "merchantIds");
  assertStrictlySorted(placeIds, "placeIds");
  assertStrictlySorted(lifeScopeContext, "lifeScopeContext");
  assertStrictlySorted(dayContext, "dayContext");

  return {
    categoryIds,
    activityIds,
    merchantIds,
    placeIds,
    lifeScopeContext,
    dayContext,
  };
}

export function parseNormalizedAnalysisScope(
  value: unknown,
): NormalizedAnalysisScope {
  const record = parseStrictRecord(
    value,
    ["subject", "time", "filters"],
    "NormalizedAnalysisScope",
  );
  const parsed = {
    subject: withValidationPath("subject", () =>
      parseAnalysisSubject(
        requireProperty(record, "subject", "NormalizedAnalysisScope"),
      ),
    ),
    time: withValidationPath("time", () =>
      parseAnalysisTime(
        requireProperty(record, "time", "NormalizedAnalysisScope"),
      ),
    ),
    filters: withValidationPath("filters", () =>
      parseNormalizedAnalysisFilters(
        requireProperty(record, "filters", "NormalizedAnalysisScope"),
      ),
    ),
  };

  // Garde explicite contre toute divergence future de la normalisation Core.
  const normalized = normalizeAnalysisScope(parsed);
  if (
    normalizedFilterKeys.some((key) =>
      normalized.filters[key].some(
        (item, index) => item !== parsed.filters[key][index],
      ),
    )
  ) {
    validationFailure({
      path: ["filters"],
      code: "not_normalized",
      message: "NormalizedAnalysisScope doit déjà être normalisé.",
    });
  }

  return parsed;
}

function parseFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    validationFailure({
      path: [],
      code: "invalid_number",
      message: `${fieldName} doit être un nombre fini.`,
    });
  }
  return value;
}

const filterKinds = new Set(["analysis", "operations", "gallery"]);

export function parseNavigationCheckpoint(value: unknown): NavigationCheckpoint {
  const record = parseStrictRecord(
    value,
    [
      "version",
      "route",
      "scope",
      "filters",
      "subview",
      "anchor",
      "anchorOffset",
      "scrollFallbackY",
    ],
    "NavigationCheckpoint",
  );
  const version = withValidationPath("version", () =>
    parseStringLiteral<typeof navigationCheckpointVersion>(
      requireProperty(record, "version", "NavigationCheckpoint"),
      new Set([navigationCheckpointVersion]),
      "NavigationCheckpoint.version",
    ),
  );
  const route = withValidationPath("route", () =>
    rootNavigationContextSchema.parse(
      requireProperty(record, "route", "NavigationCheckpoint"),
    ),
  );
  const scope = hasOwn(record, "scope")
    ? withValidationPath("scope", () =>
        parseNormalizedAnalysisScope(record.scope),
      )
    : undefined;
  const filters = hasOwn(record, "filters")
    ? withValidationPath("filters", () => {
        const filterRecord = parseStrictRecord(
          record.filters,
          ["kind", "value"],
          "NavigationFilterSnapshot",
        );
        const kind = withValidationPath("kind", () =>
          parseStringLiteral<"analysis" | "operations" | "gallery">(
            requireProperty(
              filterRecord,
              "kind",
              "NavigationFilterSnapshot",
            ),
            filterKinds,
            "NavigationFilterSnapshot.kind",
          ),
        );
        const filterValue = requireProperty(
          filterRecord,
          "value",
          "NavigationFilterSnapshot",
        );

        if (kind === "analysis") {
          return {
            kind,
            value: withValidationPath("value", () =>
              parseNormalizedAnalysisFilters(filterValue),
            ),
          };
        }
        if (kind === "operations") {
          return {
            kind,
            value: withValidationPath("value", () =>
              operationsNavigationFiltersSchema.parse(filterValue),
            ),
          };
        }
        return {
          kind,
          value: withValidationPath("value", () =>
            galleryNavigationFiltersSchema.parse(filterValue),
          ),
        };
      })
    : undefined;
  const subview = hasOwn(record, "subview")
    ? withValidationPath("subview", () =>
        navigationSubviewRefSchema.parse(record.subview),
      )
    : undefined;
  const anchor = hasOwn(record, "anchor")
    ? withValidationPath("anchor", () =>
        semanticAnchorSchema.parse(record.anchor),
      )
    : undefined;

  if (hasOwn(record, "anchorOffset") && anchor === undefined) {
    validationFailure({
      path: ["anchorOffset"],
      code: "missing_anchor",
      message: "anchorOffset exige la présence de anchor.",
    });
  }

  const anchorOffset = hasOwn(record, "anchorOffset")
    ? withValidationPath("anchorOffset", () =>
        parseFiniteNumber(record.anchorOffset, "anchorOffset"),
      )
    : undefined;
  const scrollFallbackY = hasOwn(record, "scrollFallbackY")
    ? withValidationPath("scrollFallbackY", () => {
        const parsed = parseFiniteNumber(
          record.scrollFallbackY,
          "scrollFallbackY",
        );
        if (parsed < 0) {
          validationFailure({
            path: [],
            code: "out_of_range",
            message: "scrollFallbackY doit être supérieur ou égal à zéro.",
          });
        }
        return parsed;
      })
    : undefined;

  return {
    version,
    route,
    ...(scope === undefined ? {} : { scope }),
    ...(filters === undefined ? {} : { filters }),
    ...(subview === undefined ? {} : { subview }),
    ...(anchor === undefined ? {} : { anchor }),
    ...(anchorOffset === undefined ? {} : { anchorOffset }),
    ...(scrollFallbackY === undefined ? {} : { scrollFallbackY }),
  };
}

export const navigationCheckpointSchema = createRuntimeSchema(
  parseNavigationCheckpoint,
);
