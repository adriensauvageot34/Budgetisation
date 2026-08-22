import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
} from "../../core/validation";
import {
  defineCollectionPolicy,
  parseCollectionRequestParams,
  type CollectionRequestParams,
  type CursorToken,
  type SortDirection,
  type SortSpec,
} from "../collections";
import { parseEmptyQueryParams, type EmptyQueryParams } from "./read-model-params";
import { parseQueryResourceKeySyntax } from "./resource-key";

export type MetricCatalogPreviewParams = EmptyQueryParams;
export type NormalizedMetricCatalogPreviewParams = EmptyQueryParams;
export type MetricCatalogSortKey = "semantic_name" | "metric_id";
export type MetricCatalogSearchField = "semantic_name";
export type MetricCatalogOutputKind = "count" | "money";
export type MetricCatalogLocalFiltersInput = {
  readonly outputKinds?: readonly MetricCatalogOutputKind[];
};
export type MetricCatalogLocalFilters = {
  readonly outputKinds: readonly MetricCatalogOutputKind[];
};
export type MetricCatalogCollectionParams = {
  readonly search?: string | null;
  readonly sort?: {
    readonly key: MetricCatalogSortKey;
    readonly direction?: SortDirection;
  };
  readonly filters?: MetricCatalogLocalFiltersInput;
  readonly cursor?: CursorToken | null;
  readonly limit?: number;
};
export type NormalizedMetricCatalogCollectionParams = CollectionRequestParams<
  SortSpec<MetricCatalogSortKey>,
  MetricCatalogLocalFilters
>;

export function parseMetricCatalogPreviewParams(
  value: unknown,
): NormalizedMetricCatalogPreviewParams {
  return parseEmptyQueryParams(value, "MetricCatalogPreviewParams");
}

const outputKinds: ReadonlySet<string> = new Set<MetricCatalogOutputKind>([
  "count",
  "money",
]);

function parseMetricCatalogLocalFilters(
  value: unknown,
): MetricCatalogLocalFilters {
  const record = parseStrictRecord(value, ["outputKinds"], "MetricCatalogLocalFilters");
  const candidate = hasOwn(record, "outputKinds") ? record.outputKinds : [];
  if (!Array.isArray(candidate)) {
    throw new TypeError("MetricCatalogLocalFilters.outputKinds doit être un tableau.");
  }
  const parsed = candidate.map((item) => {
    if (typeof item !== "string" || !outputKinds.has(item)) {
      throw new TypeError("MetricCatalogLocalFilters.outputKinds contient une valeur invalide.");
    }
    return item as MetricCatalogOutputKind;
  });
  return { outputKinds: [...new Set(parsed)].sort() };
}

export const metricCatalogCollectionPolicy = defineCollectionPolicy({
  resource: parseQueryResourceKeySyntax<"metric_catalog_collection">(
    "metric_catalog_collection",
  ),
  cursorPolicyVersion: "metric_catalog_v1",
  defaultLimit: 25,
  maxLimit: 100,
  defaultSort: { key: "semantic_name", direction: "asc" },
  allowedSorts: [
    {
      key: "semantic_name",
      defaultDirection: "asc",
      nulls: "last",
      stableIdKind: "string",
    },
    {
      key: "metric_id",
      defaultDirection: "asc",
      nulls: "last",
      stableIdKind: "string",
    },
  ],
  search: {
    kind: "enabled",
    searchableFields: ["semantic_name"],
    maxLength: 100,
  },
  localFiltersSchema: createRuntimeSchema(parseMetricCatalogLocalFilters),
  normalizeLocalFilters: (filters: MetricCatalogLocalFilters) => ({
    outputKinds: [...new Set(filters.outputKinds)].sort(),
  }),
});

export function parseMetricCatalogCollectionParams(
  value: unknown,
): NormalizedMetricCatalogCollectionParams {
  return parseCollectionRequestParams(value, metricCatalogCollectionPolicy);
}
