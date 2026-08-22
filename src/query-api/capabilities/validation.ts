import {
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../analytics/production";
import type { MetricId } from "../../core/identity";
import {
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import {
  parseQueryResourceKey,
  type QueryResourceKey,
} from "../request";
import { getQueryCapabilityMaximum, parseQuerySectionKey } from "./registry";
import {
  queryFilterKeys,
  type QueryCapabilities,
  type QueryFilterKey,
  type QueryUnavailableCapability,
  type UnavailableReason,
} from "./types";

const unavailableReasons: ReadonlySet<string> = new Set<UnavailableReason>([
  "not_applicable",
  "scope_incompatible",
  "filter_incompatible",
  "measure_incompatible",
  "section_incompatible",
  "permission_limited",
  "contract_not_supported",
]);
const filters: ReadonlySet<string> = new Set<QueryFilterKey>(queryFilterKeys);

export function parseUnavailableReason(value: unknown): UnavailableReason {
  return parseStringLiteral<UnavailableReason>(
    value,
    unavailableReasons,
    "UnavailableReason",
  );
}

export function parseQueryFilterKey(value: unknown): QueryFilterKey {
  return parseStringLiteral<QueryFilterKey>(value, filters, "QueryFilterKey");
}

export function intersectActiveMetricIds(
  candidates: readonly MetricId[],
): readonly ActiveMetricId[] {
  return candidates.flatMap((candidate) =>
    isActiveMetricId(candidate) ? [candidate] : [],
  );
}

function parseUniqueArray<T extends string>(
  value: unknown,
  parseItem: (item: unknown) => T,
  name: string,
): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const parsed = value.map(parseItem);
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError(`${name} contient des doublons.`);
  }
  return parsed;
}

function assertRegistryOrder(
  values: readonly string[],
  maximum: readonly string[],
  name: string,
): void {
  let lastIndex = -1;
  for (const value of values) {
    const index = maximum.indexOf(value);
    if (index < 0 || index <= lastIndex) {
      throw new TypeError(`${name} ne respecte pas le maximum ordonné.`);
    }
    lastIndex = index;
  }
}

function parseUnavailableCapability(
  value: unknown,
): QueryUnavailableCapability {
  const candidate = parseStrictRecord(
    value,
    ["kind", "section", "metricId", "filter", "reason"],
    "QueryUnavailableCapability",
  );
  const kind = requireProperty(candidate, "kind", "QueryUnavailableCapability");
  const reason = parseUnavailableReason(
    requireProperty(candidate, "reason", "QueryUnavailableCapability"),
  );
  if (kind === "section") {
    const record = parseStrictRecord(
      value,
      ["kind", "section", "reason"],
      "QueryUnavailableCapability.section",
    );
    return {
      kind,
      section: parseQuerySectionKey(
        requireProperty(record, "section", "QueryUnavailableCapability"),
      ),
      reason,
    };
  }
  if (kind === "measure") {
    const record = parseStrictRecord(
      value,
      ["kind", "metricId", "reason"],
      "QueryUnavailableCapability.measure",
    );
    const metricId = requireProperty(
      record,
      "metricId",
      "QueryUnavailableCapability",
    );
    if (!isActiveMetricId(metricId)) {
      throw new TypeError("Une capability measure doit référencer Analytics.");
    }
    return { kind, metricId: getMetricRegistryEntry(metricId).metricId, reason };
  }
  if (kind === "filter") {
    const record = parseStrictRecord(
      value,
      ["kind", "filter", "reason"],
      "QueryUnavailableCapability.filter",
    );
    return {
      kind,
      filter: parseQueryFilterKey(
        requireProperty(record, "filter", "QueryUnavailableCapability"),
      ),
      reason,
    };
  }
  throw new TypeError("QueryUnavailableCapability.kind est invalide.");
}

function capabilityTag(capability: QueryUnavailableCapability): string {
  switch (capability.kind) {
    case "section":
      return `section:${capability.section}`;
    case "measure":
      return `measure:${capability.metricId}`;
    case "filter":
      return `filter:${capability.filter}`;
  }
}

export function parseQueryCapabilities(
  value: unknown,
  expectedResource?: QueryResourceKey,
): QueryCapabilities {
  const record = parseStrictRecord(
    value,
    [
      "resource",
      "availableSections",
      "availableMeasures",
      "compatibleFilters",
      "unavailable",
    ],
    "QueryCapabilities",
  );
  const resource = parseQueryResourceKey(
    requireProperty(record, "resource", "QueryCapabilities"),
  );
  if (expectedResource !== undefined && resource !== expectedResource) {
    throw new TypeError("QueryCapabilities.resource est incohérente.");
  }
  const maximum = getQueryCapabilityMaximum(resource);
  const availableSections = parseUniqueArray(
    requireProperty(record, "availableSections", "QueryCapabilities"),
    parseQuerySectionKey,
    "QueryCapabilities.availableSections",
  );
  const availableMeasures = parseUniqueArray(
    requireProperty(record, "availableMeasures", "QueryCapabilities"),
    (metricId) => {
      if (!isActiveMetricId(metricId)) {
        throw new TypeError("MetricId inactive dans QueryCapabilities.");
      }
      return metricId;
    },
    "QueryCapabilities.availableMeasures",
  );
  const compatibleFilters = parseUniqueArray(
    requireProperty(record, "compatibleFilters", "QueryCapabilities"),
    parseQueryFilterKey,
    "QueryCapabilities.compatibleFilters",
  );
  const rawUnavailable = requireProperty(
    record,
    "unavailable",
    "QueryCapabilities",
  );
  if (!Array.isArray(rawUnavailable)) {
    throw new TypeError("QueryCapabilities.unavailable doit être un tableau.");
  }
  const unavailable = rawUnavailable.map(parseUnavailableCapability);
  const unavailableTags = unavailable.map(capabilityTag);
  if (new Set(unavailableTags).size !== unavailableTags.length) {
    throw new TypeError("QueryCapabilities.unavailable contient des doublons.");
  }

  assertRegistryOrder(availableSections, maximum.sections, "availableSections");
  assertRegistryOrder(availableMeasures, maximum.measures, "availableMeasures");
  assertRegistryOrder(compatibleFilters, maximum.filters, "compatibleFilters");

  const availableSectionSet: ReadonlySet<string> = new Set(availableSections);
  const availableMeasureSet: ReadonlySet<string> = new Set(availableMeasures);
  const compatibleFilterSet: ReadonlySet<string> = new Set(compatibleFilters);
  const expectedUnavailableTags = [
    ...maximum.sections
      .filter((item) => !availableSectionSet.has(item))
      .map((item) => `section:${item}`),
    ...maximum.measures
      .filter((item) => !availableMeasureSet.has(item))
      .map((item) => `measure:${item}`),
    ...maximum.filters
      .filter((item) => !compatibleFilterSet.has(item))
      .map((item) => `filter:${item}`),
  ];
  if (
    unavailableTags.length !== expectedUnavailableTags.length ||
    unavailableTags.some((tag, index) => tag !== expectedUnavailableTags[index])
  ) {
    throw new TypeError("QueryCapabilities ne partitionne pas son maximum.");
  }

  return {
    resource,
    availableSections,
    availableMeasures,
    compatibleFilters,
    unavailable,
  };
}
