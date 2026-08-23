import "server-only";

import type { EconomicComponentFact, EconomicTiming } from "@/analytics/facts";
import { MetricProductionContractError } from "@/analytics/production";
import type {
  CategoryId,
  MerchantId,
  PlaceId,
  SubcategoryId,
} from "@/core/identity";
import {
  addMoney,
  compareMoney,
  parseMoney,
  type Money,
} from "@/core/money";
import { addMonths, parseLocalDate, resolveGlobalWindowMonths } from "@/core/time";
import {
  createCursorPage,
  decodeCursor,
  encodeCursor,
  getSortDefinition,
  queryResourceKeys,
  type CursorQueryBinding,
  type KeysetAnchor,
  type NormalizedOperationsBrowseParams,
  type OperationRowReadModel,
  type OperationsBrowseSortKey,
  type SortDefinition,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import type {
  CanonicalDateRange,
  CanonicalRepository,
} from "@/server/canonical/repository";
import {
  moneyEnvelope,
  operationFromCanonicalRow,
  type CanonicalOperation,
} from "./shared";

type OperationsDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly repository: CanonicalRepository;
};

const operationsSortDefinitions = [
  { key: "bank_date", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  { key: "economic_timing", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  { key: "bank_amount", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
  { key: "economic_net", defaultDirection: "desc", nulls: "last", stableIdKind: "string" },
] as const satisfies readonly SortDefinition<OperationsBrowseSortKey>[];

const operationsCursorPolicyVersion = "operations_browse_v1";

function rangeForParams(
  params: NormalizedOperationsBrowseParams,
): CanonicalDateRange {
  switch (params.time.kind) {
    case "bank_month":
    case "economic_month":
      return {
        start: parseLocalDate(`${params.time.month}-01`),
        endExclusive: parseLocalDate(`${addMonths(params.time.month, 1)}-01`),
      };
    case "bank_range":
    case "economic_range":
      return { start: params.time.start, endExclusive: params.time.endExclusive };
    case "global_window": {
      const months = resolveGlobalWindowMonths(params.time.window, params.time.asOf);
      return {
        start: parseLocalDate(`${months[0]}-01`),
        endExclusive: parseLocalDate(`${addMonths(months[months.length - 1], 1)}-01`),
      };
    }
  }
}

function groupFactsByOperation(
  facts: readonly EconomicComponentFact[],
): ReadonlyMap<string, readonly EconomicComponentFact[]> {
  const groups = new Map<string, EconomicComponentFact[]>();
  for (const fact of facts) {
    if (fact.sourceOperation.kind !== "resolved") continue;
    const group = groups.get(fact.sourceOperation.id) ?? [];
    group.push(fact);
    groups.set(fact.sourceOperation.id, group);
  }
  return groups;
}

function fallsInEconomicRange(
  fact: EconomicComponentFact,
  range: CanonicalDateRange,
): boolean {
  if (
    fact.economicTiming.kind !== "known" &&
    fact.economicTiming.kind !== "partial"
  ) return false;
  return fact.economicTiming.segments.some(
    (segment) =>
      segment.periodStart !== null &&
      segment.periodEnd !== null &&
      segment.periodStart < range.endExclusive &&
      segment.periodEnd >= range.start,
  );
}

function sumFactMoney(
  facts: readonly EconomicComponentFact[],
  field: "gross" | "refundApplied" | "net",
): Money {
  return facts.reduce(
    (total, fact) => addMoney(total, fact[field]),
    parseMoney("0"),
  );
}

function uniqueResolved<Id extends string>(
  values: readonly ({ readonly kind: string } & Record<string, unknown>)[],
  idKey: string,
): Id | undefined {
  const ids = values.flatMap((value) =>
    value.kind === "resolved" && typeof value[idKey] === "string"
      ? [value[idKey] as Id]
      : [],
  );
  return new Set(ids).size === 1 ? ids[0] : undefined;
}

function operationTiming(
  facts: readonly EconomicComponentFact[],
): OperationRowReadModel["economicTiming"] {
  const dates = facts.flatMap((fact) => {
    if (fact.economicTiming.kind !== "known") return [];
    return fact.economicTiming.segments.flatMap((segment) =>
      segment.timingState === "known" &&
      segment.periodStart !== null &&
      segment.periodStart === segment.periodEnd
        ? [segment.periodStart]
        : [],
    );
  });
  return dates.length > 0 && new Set(dates).size === 1
    ? { availability: "known", date: dates[0] }
    : { availability: "unknown" };
}

function economicTimingState(
  facts: readonly EconomicComponentFact[],
): "known" | "partial" | "unknown" | "conflict" {
  if (facts.some(({ economicTiming }) => economicTiming.kind === "conflict")) {
    return "conflict";
  }
  if (facts.length === 0 || facts.every(({ economicTiming }) => economicTiming.kind === "unknown")) {
    return "unknown";
  }
  if (facts.some(({ economicTiming }) => economicTiming.kind !== "known")) {
    return "partial";
  }
  return "known";
}

function normalizeNecessity(value: string | undefined) {
  if (value === undefined) return undefined;
  if (["Indispensable", "necessary"].includes(value)) return "Indispensable" as const;
  if (["Contraint", "Contrainte"].includes(value)) return "Contraint" as const;
  if (["Optionnel", "Optionnelle", "discretionary"].includes(value)) return "Optionnel" as const;
  return undefined;
}

function normalizeFixedVariable(value: string | undefined) {
  if (value === undefined) return undefined;
  if (["Fixe", "fixed"].includes(value)) return "fixed" as const;
  if (["Variable", "variable"].includes(value)) return "variable" as const;
  return "unknown" as const;
}

function normalizeLifeScope(value: string | undefined) {
  return value === "Vie courante" || value === "Hors quotidien"
    ? value
    : undefined;
}

export function buildOperationRow(
  operation: CanonicalOperation,
  facts: readonly EconomicComponentFact[],
): OperationRowReadModel {
  const state = economicTimingState(facts);
  const categoryId = uniqueResolved<CategoryId>(
    facts.map(({ category }) => category),
    "id",
  ) ?? operation.categoryId;
  const subcategoryId = uniqueResolved<SubcategoryId>(
    facts.map(({ subcategory }) => subcategory),
    "id",
  ) ?? operation.subcategoryId;
  const merchantId = uniqueResolved<MerchantId>(
    facts.map(({ merchant }) => merchant),
    "id",
  ) ?? operation.merchantId;
  const placeId = uniqueResolved<PlaceId>(
    facts.map(({ canonicalPlace }) =>
      canonicalPlace.kind === "resolved"
        ? { kind: "resolved", id: canonicalPlace.placeId }
        : canonicalPlace,
    ),
    "id",
  );
  const economicNet = sumFactMoney(facts, "net");
  return {
    operationId: operation.operationId,
    bankDate: operation.bankDate,
    bankLabel: operation.label,
    ...(merchantId === undefined
      ? {}
      : { merchant: { id: merchantId, label: merchantId } }),
    bankAmount: moneyEnvelope(operation.bankAmount),
    economicNet:
      facts.length === 0
        ? {
            availability: "unknown" as const,
            value: null,
            unit: "EUR" as const,
            provenance: "observed" as const,
          }
        : moneyEnvelope(
            economicNet,
            state === "known" ? { level: "complete" } : { level: "partial" },
          ),
    economicTiming: operationTiming(facts),
    ...(categoryId === undefined
      ? {}
      : { category: { id: categoryId, label: categoryId } }),
    ...(subcategoryId === undefined
      ? {}
      : { subcategory: { id: subcategoryId, label: subcategoryId } }),
    ...(operation.preciseType === undefined ? {} : { preciseType: operation.preciseType }),
    ...(normalizeNecessity(operation.necessity) === undefined
      ? {}
      : { necessity: normalizeNecessity(operation.necessity) }),
    ...(normalizeFixedVariable(operation.fixedVariable) === undefined
      ? {}
      : { fixedVariable: normalizeFixedVariable(operation.fixedVariable) }),
    ...(normalizeLifeScope(operation.lifeScope) === undefined
      ? {}
      : { lifeScope: normalizeLifeScope(operation.lifeScope) }),
    ...(placeId === undefined
      ? {}
      : { canonicalPlace: { id: placeId, label: placeId } }),
    quality:
      state === "conflict"
        ? "conflict"
        : state === "known" && categoryId !== undefined
          ? "complete"
          : state === "unknown" && facts.length === 0
            ? "unknown"
            : "partial",
  };
}

function matchesList<Value>(
  selected: readonly Value[],
  value: Value | undefined,
): boolean {
  return selected.length === 0 || (value !== undefined && selected.includes(value));
}

function assertRepresentableFilters(params: NormalizedOperationsBrowseParams): void {
  if (
    params.filters.activityIds.length > 0 ||
    params.filters.momentIds.length > 0 ||
    params.filters.lifeEventIds.length > 0 ||
    params.filters.dayContext.length > 0 ||
    params.filters.accountIds.length > 0 ||
    params.filters.necessity.length > 0
  ) {
    throw new MetricProductionContractError(
      "Un filtre demandé n'est pas projeté par le canonique Operations actuel.",
    );
  }
}

function filterRows(
  rows: readonly OperationRowReadModel[],
  params: NormalizedOperationsBrowseParams,
): readonly OperationRowReadModel[] {
  assertRepresentableFilters(params);
  const search = params.search?.toLocaleLowerCase("fr") ?? null;
  return rows.filter((row) => {
    if (
      search !== null &&
      ![
        row.bankLabel,
        row.operationId,
        row.merchant?.label,
        row.category?.label,
        row.subcategory?.label,
        row.preciseType,
        row.canonicalPlace?.label,
      ].some((value) => value?.toLocaleLowerCase("fr").includes(search) === true)
    ) return false;
    const filters = params.filters;
    if (!matchesList(filters.categoryIds, row.category?.id)) return false;
    if (!matchesList(filters.subcategoryIds, row.subcategory?.id)) return false;
    if (!matchesList(filters.merchantIds, row.merchant?.id)) return false;
    if (!matchesList(filters.placeIds, row.canonicalPlace?.id)) return false;
    if (!matchesList(filters.accountIds, row.account?.id)) return false;
    if (!matchesList(filters.preciseTypes, row.preciseType)) return false;
    if (!matchesList(filters.necessity, row.necessity)) return false;
    if (!matchesList(filters.fixedVariable, row.fixedVariable)) return false;
    if (!matchesList(filters.lifeScope, row.lifeScope)) return false;
    if (!matchesList(filters.quality, row.quality)) return false;
    if (
      filters.amountMin !== null &&
      row.economicNet.availability === "known" &&
      compareMoney(row.economicNet.value, filters.amountMin) < 0
    ) return false;
    if (
      filters.amountMax !== null &&
      row.economicNet.availability === "known" &&
      compareMoney(row.economicNet.value, filters.amountMax) > 0
    ) return false;
    if (
      (filters.amountMin !== null || filters.amountMax !== null) &&
      row.economicNet.availability !== "known"
    ) return false;
    return true;
  });
}

function sortValue(
  row: OperationRowReadModel,
  key: OperationsBrowseSortKey,
): string | null {
  switch (key) {
    case "bank_date": return row.bankDate;
    case "economic_timing":
      return row.economicTiming.availability === "known"
        ? row.economicTiming.date
        : null;
    case "bank_amount":
      return row.bankAmount.availability === "known" ? row.bankAmount.value : null;
    case "economic_net":
      return row.economicNet.availability === "known" ? row.economicNet.value : null;
  }
}

function compareSortValues(
  left: string | null,
  right: string | null,
  key: OperationsBrowseSortKey,
  direction: "asc" | "desc",
): number {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  const comparison = key === "bank_amount" || key === "economic_net"
    ? compareMoney(left as Money, right as Money)
    : left === right
      ? 0
      : left < right
        ? -1
        : 1;
  return direction === "asc" ? comparison : -comparison;
}

function compareRows(
  left: OperationRowReadModel,
  right: OperationRowReadModel,
  params: NormalizedOperationsBrowseParams,
): number {
  const primary = compareSortValues(
    sortValue(left, params.sort.key),
    sortValue(right, params.sort.key),
    params.sort.key,
    params.sort.direction,
  );
  if (primary !== 0) return primary;
  const stable = left.operationId.localeCompare(right.operationId);
  return params.sort.direction === "asc" ? stable : -stable;
}

function afterAnchor(
  row: OperationRowReadModel,
  anchor: KeysetAnchor,
  params: NormalizedOperationsBrowseParams,
): boolean {
  const primary = compareSortValues(
    sortValue(row, params.sort.key),
    anchor.sortValue as string | null,
    params.sort.key,
    params.sort.direction,
  );
  if (primary !== 0) return primary > 0;
  if (typeof anchor.stableId !== "string") return false;
  const stable = row.operationId.localeCompare(anchor.stableId);
  return params.sort.direction === "asc" ? stable > 0 : stable < 0;
}

function cursorBinding(
  params: NormalizedOperationsBrowseParams,
  scopeHash: import("@/core/scope").ScopeHash,
): CursorQueryBinding<OperationsBrowseSortKey, NormalizedOperationsBrowseParams["filters"]> {
  return {
    resource: queryResourceKeys.operationsBrowse,
    scopeHash,
    search: params.search,
    sort: params.sort,
    sortDefinition: getSortDefinition(operationsSortDefinitions, params.sort.key),
    filters: params.filters,
    limit: params.limit,
    policyVersion: operationsCursorPolicyVersion,
  };
}

export function createOperationsQuerySource(
  dependencies: OperationsDependencies,
): Pick<QueryReadModelSources, "readOperationsBrowse"> {
  return {
    async readOperationsBrowse({ request, context }) {
      if (request.scope.subject.kind === "person") {
        throw new MetricProductionContractError(
          "L'attribution Person des opérations n'est pas projetée par le canonique actuel.",
        );
      }
      const range = rangeForParams(request.params);
      const economicFacts = await dependencies.repository.loadEconomicFacts(range);
      const economicOperationIds = [
        ...new Set(
          economicFacts.flatMap((fact) =>
            fact.sourceOperation.kind === "resolved" &&
            fallsInEconomicRange(fact, range)
              ? [fact.sourceOperation.id]
              : [],
          ),
        ),
      ];
      const isEconomicTime =
        request.params.time.kind === "economic_month" ||
        request.params.time.kind === "economic_range";
      const operationRows = isEconomicTime
        ? await dependencies.repository.loadOperationsByIds(economicOperationIds)
        : await dependencies.repository.loadOperationsByBankRange(range);
      const operations = operationRows.map(operationFromCanonicalRow);
      const factsByOperation = groupFactsByOperation(economicFacts);
      const candidates = operations.map((operation) =>
        buildOperationRow(
          operation,
          factsByOperation.get(operation.operationId) ?? [],
        ),
      );
      const filtered = [...filterRows(candidates, request.params)].sort((left, right) =>
        compareRows(left, right, request.params),
      );
      const binding = cursorBinding(request.params, request.scopeHash);
      const afterCursor = request.params.cursor === null
        ? filtered
        : (() => {
            const anchor = decodeCursor(request.params.cursor, binding);
            return filtered.filter((row) => afterAnchor(row, anchor, request.params));
          })();
      const pageItems = afterCursor.slice(0, request.params.limit);
      const hasMore = afterCursor.length > request.params.limit;
      const last = pageItems.at(-1);
      const nextCursor = hasMore && last !== undefined
        ? encodeCursor(binding, {
            sortValue: sortValue(last, request.params.sort.key),
            stableId: last.operationId,
          })
        : null;
      const localFiltersActive = Object.values(request.params.filters).some((value) =>
        Array.isArray(value) ? value.length > 0 : value !== null,
      );
      return {
        subject: request.scope.subject,
        page: createCursorPage({
          items: pageItems,
          nextCursor,
          isFirstPage: request.params.cursor === null,
          restrictions: {
            searchActive: request.params.search !== null,
            localFiltersActive,
            restrictiveScopeFilters: [],
          },
          totalCount: filtered.length,
          candidateCountBeforeFilters: candidates.length,
        }),
        appliedQuery: request.params,
        capabilities: context.capabilities,
        filterCapabilities: [
          "category",
          "economic_amount",
          "fixed_variable",
          "life_scope",
          "merchant",
          "place",
          "precise_type",
          "quality",
          "subcategory",
        ],
      };
    },
  };
}

export function operationEconomicTruth(
  facts: readonly EconomicComponentFact[],
): {
  readonly state: "known" | "partial" | "unknown" | "conflict";
  readonly gross?: Money;
  readonly refundApplied?: Money;
  readonly net?: Money;
  readonly economicTiming?: EconomicTiming;
} {
  const state = economicTimingState(facts);
  if (facts.length === 0 || state === "unknown") return { state: "unknown" };
  const segments = facts.flatMap((fact) =>
    fact.economicTiming.kind === "known" || fact.economicTiming.kind === "partial"
      ? fact.economicTiming.segments
      : [],
  );
  return {
    state,
    gross: sumFactMoney(facts, "gross"),
    refundApplied: sumFactMoney(facts, "refundApplied"),
    net: sumFactMoney(facts, "net"),
    economicTiming:
      state === "conflict"
        ? { kind: "conflict" }
        : state === "partial"
          ? { kind: "partial", segments }
          : { kind: "known", segments },
  };
}
