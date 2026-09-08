import "server-only";

import {
  buildGlobalCategoryNeeds,
  buildGlobalM2PurchaseEnrichment,
  createGlobalM2DependencyDeclaration,
  projectGlobalM2Month,
  resolveGlobalM2NeedDimension,
  type GlobalM2DimensionValue,
  type GlobalPurchaseMerchantResult,
} from "@/analytics/global-v2";
import { produceMetric } from "@/analytics/production";
import { parseCategoryId } from "@/core/identity";
import { parseMoney } from "@/core/money";
import { addMonths, parseLocalDate, parseYearMonth, type YearMonth } from "@/core/time";
import type {
  CanonicalMinimalPlanningBundle,
  CanonicalRepository,
} from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { FactSourceResolver } from "./fact-source-resolver";
import { resolveGlobalM1HouseholdAuthority } from "./global-v2-economic-authority";

function rowsByKey(rows: readonly CanonicalRecord[], kind: string, idColumn: string): ReadonlyMap<string, CanonicalRecord> {
  return new Map(rows.flatMap((row) => {
    const id = optionalCanonicalString(row, [idColumn]);
    return id === undefined ? [] : [[`${kind}:${id}`, row] as const];
  }));
}

/**
 * Resolves Need only from an explicit component row or an unambiguous
 * single-component operation fallback. Labels and transaction text are absent.
 */
export function resolveGlobalM2NeedAuthorities(
  bundle: CanonicalMinimalPlanningBundle,
): ReadonlyMap<string, GlobalM2DimensionValue> {
  const sourceRows = new Map<string, CanonicalRecord>([
    ...rowsByKey(bundle.allocations, "allocation", "allocation_id"),
    ...rowsByKey(bundle.items, "item", "item_id"),
    ...rowsByKey(bundle.paymentComponents, "payment_component", "payment_component_id"),
    ...rowsByKey(bundle.cashUses, "cash_use", "cash_use_id"),
    ...rowsByKey(bundle.operations, "operation", "operation_id"),
  ]);
  const operations = new Map(bundle.operations.flatMap((row) => {
    const id = optionalCanonicalString(row, ["operation_id"]);
    return id === undefined ? [] : [[id, row] as const];
  }));
  const knownNeedIds = new Set(bundle.needs.flatMap((row) => {
    const id = optionalCanonicalString(row, ["need_id"]);
    return id === undefined ? [] : [id];
  }));
  const componentCountByOperation = new Map<string, number>();
  for (const fact of bundle.economicFacts) {
    if (fact.sourceOperation.kind !== "resolved") continue;
    const id = String(fact.sourceOperation.id);
    componentCountByOperation.set(id, (componentCountByOperation.get(id) ?? 0) + 1);
  }
  const entries: Array<readonly [string, GlobalM2DimensionValue]> = bundle.economicFacts.map((fact) => {
    const key = String(fact.canonicalComponentKey);
    const sourceNeed = optionalCanonicalString(sourceRows.get(key) ?? {}, ["need_id"]);
    const operationId = fact.sourceOperation.kind === "resolved" ? String(fact.sourceOperation.id) : undefined;
    const operationNeed = operationId === undefined
      ? undefined
      : optionalCanonicalString(operations.get(operationId) ?? {}, ["need_id"]);
    const evidence = [
      ...(sourceNeed === undefined ? [] : [`${key}:need:${sourceNeed}`]),
      ...(operationNeed === undefined || operationId === undefined ? [] : [`operation:${operationId}:need:${operationNeed}`]),
    ].sort();
    return [key, resolveGlobalM2NeedDimension({
      ...(sourceNeed === undefined ? {} : { sourceNeedId: sourceNeed }),
      ...(operationNeed === undefined ? {} : { operationNeedId: operationNeed }),
      operationComponentCount: operationId === undefined ? 0 : componentCountByOperation.get(operationId) ?? 0,
      knownNeedIds,
      evidenceRefs: evidence,
    })] as const;
  });
  return new Map(entries);
}

/** Canonical → Facts → official Analytics → M2. No History ReadModel is read. */
export async function resolveGlobalM2HouseholdAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly resolver?: FactSourceResolver;
  readonly targetMonth: YearMonth;
  readonly purchaseAuthority?: GlobalPurchaseMerchantResult;
}) {
  const targetMonth = parseYearMonth(input.targetMonth);
  const resolver = input.resolver ?? new FactSourceResolver(input.repository);
  const m1 = await resolveGlobalM1HouseholdAuthority({ repository: input.repository, resolver, targetMonth });
  if (m1.state.actual.status !== "KNOWN" || m1.state.typicalReference.status !== "KNOWN") {
    throw new TypeError("M2 exige Actual et TypicalReference officiels connaissables.");
  }
  const firstMonth = m1.state.typicalReferenceMonths[0];
  if (firstMonth === undefined) throw new TypeError("M2 exige une fenêtre TypicalReference non vide.");
  const range = {
    start: parseLocalDate(`${firstMonth}-01`),
    endExclusive: parseLocalDate(`${addMonths(targetMonth, 1)}-01`),
  };
  const [bundle, classifications] = await Promise.all([
    input.repository.loadMinimalPlanningBundle(range),
    input.repository.loadEconomicComponentClassifications(range),
  ]);
  const needByComponentKey = resolveGlobalM2NeedAuthorities(bundle);
  const classificationsByComponentKey = new Map(classifications.map((classification) => [
    String(classification.canonicalComponentKey),
    classification,
  ]));
  const months = [...m1.state.typicalReferenceMonths, targetMonth];
  const components = months.flatMap((month) => projectGlobalM2Month({
    month,
    facts: bundle.economicFacts,
    needByComponentKey,
    classificationsByComponentKey,
  }));
  const categoryIds = [...new Set(components.flatMap(({ category }) =>
    category.status === "KNOWN" ? [category.id] : []))].sort();
  const categoryAuthorities = await Promise.all(categoryIds.map(async (categoryId) => {
    const scope = {
      subject: { kind: "household" as const },
      time: { kind: "month" as const, month: targetMonth },
      filters: { categoryIds: [parseCategoryId(categoryId)] },
    };
    const [currentSource, typicalSource] = await Promise.all([
      resolver.resolveCanonical("category_amount", scope),
      resolver.resolveCanonical("typical_month_cost", scope),
    ]);
    const current = produceMetric({ metricId: "category_amount", scope, source: currentSource });
    const typical = produceMetric({ metricId: "typical_month_cost", scope, source: typicalSource });
    if (current.unit !== "EUR" || typical.unit !== "EUR/month" || current.availability !== "known" || typical.availability !== "known") {
      throw new TypeError(`Les autorités category_amount/Typical sont indisponibles pour ${categoryId}.`);
    }
    return { categoryId, current: parseMoney(current.value), typical: parseMoney(typical.value) };
  }));
  const purchaseEnrichment = input.purchaseAuthority === undefined
    ? undefined
    : buildGlobalM2PurchaseEnrichment({
        purchase: input.purchaseAuthority,
        targetMonth,
        referenceMonths: m1.state.typicalReferenceMonths,
      });
  if (purchaseEnrichment !== undefined && purchaseEnrichment.sourceRevision !== input.repository.context.dataRevision) {
    throw new TypeError("P10_M2_PURCHASE_SOURCE_REVISION_MISMATCH");
  }
  const result = buildGlobalCategoryNeeds({
    targetMonth,
    referenceMonths: m1.state.typicalReferenceMonths,
    components,
    actual: m1.state.actual.value!,
    officialTypicalTotal: m1.state.typicalReference.value!,
    officialCategoryCurrentAmounts: Object.fromEntries(categoryAuthorities.map(({ categoryId, current }) => [categoryId, current])),
    officialCategoryTypicalAmounts: Object.fromEntries(categoryAuthorities.map(({ categoryId, typical }) => [categoryId, typical])),
    ...(purchaseEnrichment === undefined ? {} : { purchaseFrequencyTicket: purchaseEnrichment.frequencyTicket }),
  });
  return {
    result,
    dependencyDeclaration: createGlobalM2DependencyDeclaration({
      personScope: { kind: "HOUSEHOLD" },
      authorizedPersonIds: input.repository.context.personIds,
    }),
    m1,
    ...(purchaseEnrichment === undefined ? {} : { purchaseEnrichment }),
  };
}
