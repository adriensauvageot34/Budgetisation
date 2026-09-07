import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type {
  ComponentAxisClassification,
  EconomicComponentClassificationFact,
  EconomicComponentFact,
} from "../facts";
import { medianMoney } from "../references";
import {
  canonicalSerializeGlobal,
  parseGlobalCoverageSet,
  parseGlobalDependencyDeclaration,
  parseGlobalSupport,
  type GlobalCoverageDimension,
  type GlobalCoverageSet,
  type GlobalDependencyDeclaration,
  type GlobalMaterialityCandidate,
  type GlobalPersonScopePolicy,
  type GlobalSupport,
} from "../../core/global-v2";
import type { CategoryId, PersonId, SubcategoryId } from "../../core/identity";
import { addMoney, parseMoney, type Money } from "../../core/money";
import type { YearMonth } from "../../core/time";
import { parseMethodVersion, parsePolicyVersion } from "../../core/versions";

const ZERO = parseMoney("0");
export const GLOBAL_M2_METHOD_VERSION = parseMethodVersion("global_category_need@v1");

export const globalM2Policies = {
  reference: "global-category-need-reference@v1",
  coverage: "global-category-need-coverage@v1",
  support: "global-category-need-support@v1",
  purchaseEnrichment: "global-category-need-purchase-enrichment@v1",
  materiality: { id: "global-materiality-category-need", version: parsePolicyVersion("v1") },
} as const;

export type GlobalM2DimensionValue<Id extends string = string> =
  | { readonly status: "KNOWN"; readonly id: Id; readonly evidenceRefs: readonly string[] }
  | { readonly status: "UNDETERMINED"; readonly evidenceRefs: readonly string[] }
  | { readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT"; readonly evidenceRefs: readonly string[] };

export type GlobalM2MonthlyComponent = {
  readonly month: YearMonth;
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly category: GlobalM2DimensionValue<CategoryId>;
  readonly subcategory: GlobalM2DimensionValue<SubcategoryId>;
  readonly need: GlobalM2DimensionValue;
  readonly necessity: GlobalM2DimensionValue;
  readonly behavior: GlobalM2DimensionValue;
  readonly lifeScope: GlobalM2DimensionValue;
  readonly economicIdentityRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export function resolveGlobalM2NeedDimension(input: {
  readonly sourceNeedId?: string;
  readonly operationNeedId?: string;
  readonly operationComponentCount: number;
  readonly knownNeedIds: ReadonlySet<string>;
  readonly evidenceRefs: readonly string[];
}): GlobalM2DimensionValue {
  const evidenceRefs = canonicalRefs(input.evidenceRefs);
  if (
    input.sourceNeedId !== undefined &&
    input.operationNeedId !== undefined &&
    input.sourceNeedId !== input.operationNeedId
  ) return { status: "CONFLICT", evidenceRefs };
  const resolved = input.sourceNeedId ?? (
    input.operationComponentCount === 1 ? input.operationNeedId : undefined
  );
  if (resolved === undefined) return { status: "UNKNOWN", evidenceRefs };
  if (!input.knownNeedIds.has(resolved)) return { status: "CONFLICT", evidenceRefs };
  return { status: "KNOWN", id: resolved, evidenceRefs };
}

export type GlobalM2SeriesPoint = {
  readonly month: YearMonth;
  readonly amount: Money;
};

export type GlobalM2Contributor = {
  readonly key: string;
  readonly amount: Money;
};

export type GlobalM2Group = {
  readonly key: string;
  readonly dimension: GlobalM2DimensionValue;
  readonly monthlyAmount: Money;
  readonly typicalAmount: Money | null;
  readonly shareOfTypical: string | null;
  readonly deltaAmount: Money | null;
  readonly deltaRelative: string | null;
  readonly historicalSeries: readonly GlobalM2SeriesPoint[];
  readonly contributors: readonly GlobalM2Contributor[];
  readonly classificationBreakdown: {
    readonly necessity: readonly GlobalM2Contributor[];
    readonly behavior: readonly GlobalM2Contributor[];
    readonly lifeScope: readonly GlobalM2Contributor[];
  };
  readonly drillDownRef: { readonly kind: "CATEGORY" | "NEED"; readonly id: string };
  readonly evidenceRefs: readonly string[];
};

export type GlobalM2Axis = {
  readonly groups: readonly GlobalM2Group[];
  readonly coverage: GlobalCoverageSet;
  readonly support: GlobalSupport;
  readonly currentTotal: Money;
  readonly reconcilesToActual: boolean;
  readonly shareSumIsExhaustive: boolean;
};

export type GlobalCategoryNeedsResult = {
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
  readonly categories: GlobalM2Axis;
  readonly needs: GlobalM2Axis;
  readonly materialityCandidates: readonly GlobalMaterialityCandidate[];
  readonly purchaseFrequencyTicket: GlobalPurchaseFrequencyTicketResult;
  readonly inputHash: string;
};

export type GlobalPurchaseEventAmount = {
  readonly purchaseEventId: string;
  readonly amount: Money;
};

export type GlobalPurchaseFrequencyTicketResult =
  | {
      readonly status: "UNAVAILABLE";
      readonly reasonCode: "PURCHASE_EVENT_AUTHORITY_UNAVAILABLE" | "PURCHASE_EVENT_COVERAGE_INCOMPLETE" | "INCOMPATIBLE_ZERO_FREQUENCY";
    }
  | {
      readonly status: "KNOWN";
      readonly referenceFrequency: number;
      readonly currentFrequency: number;
      readonly referenceAverageTicket: Money;
      readonly currentAverageTicket: Money;
      readonly frequencyEffect: Money;
      readonly ticketEffect: Money;
      readonly deltaSpend: Money;
      readonly reconciles: true;
    };

type DimensionAxis = "CATEGORY" | "SUBCATEGORY" | "NEED";

function digest(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`global-m2-input@v1\n${canonicalSerializeGlobal(value)}`)));
}

function sum(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO);
}

function canonicalRefs(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function dimensionKey(value: GlobalM2DimensionValue): string {
  return value.status === "KNOWN" ? value.id : `__${value.status}__`;
}

function dimensionOf(component: GlobalM2MonthlyComponent, axis: DimensionAxis): GlobalM2DimensionValue {
  return axis === "CATEGORY" ? component.category : axis === "SUBCATEGORY" ? component.subcategory : component.need;
}

function support(referenceMonths: readonly YearMonth[]): GlobalSupport {
  const n = referenceMonths.length;
  return parseGlobalSupport({
    naturalGrain: "MONTH",
    eligibleUnits: n,
    observedUnits: n,
    includedUnits: n,
    excludedObservedUnits: 0,
    minimumRequired: 6,
    supportStatus: n < 6 ? "INSUFFICIENT" : n >= 12 ? "STRONG" : "SUFFICIENT",
    gapCount: 0,
    policyRef: globalM2Policies.support,
  });
}

function coverage(
  components: readonly GlobalM2MonthlyComponent[],
  axis: "CATEGORY" | "NEED",
): GlobalCoverageSet {
  const dimension: GlobalCoverageDimension = axis === "CATEGORY" ? "CLASSIFICATION" : "NEED";
  const resolved = components.filter((component) => dimensionOf(component, axis).status === "KNOWN").length;
  const denominator = components.length;
  const status = denominator === 0 ? "UNKNOWN" : resolved === denominator ? "KNOWN" : "PARTIAL";
  return parseGlobalCoverageSet({
    dimensions: [{
      dimension,
      status,
      ...(denominator === 0 ? {} : { numerator: resolved, denominator, ratio: resolved / denominator }),
      unit: "canonical_economic_component",
      basis: "authoritative-dimension-resolution",
      evidenceRefs: canonicalRefs(components.flatMap(({ evidenceRefs }) => evidenceRefs)),
      policyRef: globalM2Policies.coverage,
    }],
    requiredDimensions: [dimension],
    ...(denominator === 0 ? {} : { effective: resolved / denominator }),
    aggregation: "MIN_REQUIRED_DIMENSIONS",
  });
}

function groupMonthly(
  components: readonly GlobalM2MonthlyComponent[],
  axis: DimensionAxis,
): ReadonlyMap<YearMonth, ReadonlyMap<string, Money>> {
  const byMonth = new Map<YearMonth, Map<string, Money>>();
  for (const component of components) {
    const month = byMonth.get(component.month) ?? new Map<string, Money>();
    const key = dimensionKey(dimensionOf(component, axis));
    month.set(key, addMoney(month.get(key) ?? ZERO, component.amount));
    byMonth.set(component.month, month);
  }
  return byMonth;
}

function dimensionByKey(components: readonly GlobalM2MonthlyComponent[], axis: DimensionAxis): ReadonlyMap<string, GlobalM2DimensionValue> {
  const result = new Map<string, GlobalM2DimensionValue>();
  for (const component of components) {
    const value = dimensionOf(component, axis);
    const key = dimensionKey(value);
    const previous = result.get(key);
    if (previous !== undefined) {
      const previousIdentity = previous.status === "KNOWN" ? { status: previous.status, id: previous.id } : { status: previous.status };
      const valueIdentity = value.status === "KNOWN" ? { status: value.status, id: value.id } : { status: value.status };
      if (canonicalSerializeGlobal(previousIdentity) !== canonicalSerializeGlobal(valueIdentity)) {
        throw new TypeError(`Deux dimensions contradictoires partagent la clé ${key}.`);
      }
      result.set(key, { ...previous, evidenceRefs: canonicalRefs([...previous.evidenceRefs, ...value.evidenceRefs]) } as GlobalM2DimensionValue);
      continue;
    }
    result.set(key, value);
  }
  return result;
}

function ratio(numerator: Money, denominator: Money): string | null {
  return new Big(denominator).eq(0) ? null : new Big(numerator).div(denominator).toFixed();
}

function contributorsFor(
  components: readonly GlobalM2MonthlyComponent[],
  targetMonth: YearMonth,
  axis: "CATEGORY" | "NEED",
  parentKey: string,
): readonly GlobalM2Contributor[] {
  const childAxis: DimensionAxis = axis === "CATEGORY" ? "SUBCATEGORY" : "CATEGORY";
  const totals = new Map<string, Money>();
  for (const component of components) {
    if (component.month !== targetMonth || dimensionKey(dimensionOf(component, axis)) !== parentKey) continue;
    const key = dimensionKey(dimensionOf(component, childAxis));
    totals.set(key, addMoney(totals.get(key) ?? ZERO, component.amount));
  }
  return [...totals].map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => new Big(b.amount).abs().cmp(new Big(a.amount).abs()) || a.key.localeCompare(b.key));
}

function classificationContributorsFor(
  components: readonly GlobalM2MonthlyComponent[],
  targetMonth: YearMonth,
  axis: "CATEGORY" | "NEED",
  parentKey: string,
  classification: "necessity" | "behavior" | "lifeScope",
): readonly GlobalM2Contributor[] {
  const totals = new Map<string, Money>();
  for (const component of components) {
    if (component.month !== targetMonth || dimensionKey(dimensionOf(component, axis)) !== parentKey) continue;
    const key = dimensionKey(component[classification]);
    totals.set(key, addMoney(totals.get(key) ?? ZERO, component.amount));
  }
  return [...totals].map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => new Big(b.amount).abs().cmp(new Big(a.amount).abs()) || a.key.localeCompare(b.key));
}

function buildAxis(input: {
  readonly axis: "CATEGORY" | "NEED";
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
  readonly components: readonly GlobalM2MonthlyComponent[];
  readonly actual: Money;
  readonly officialTypicalTotal: Money;
  readonly officialCategoryCurrentAmounts: Readonly<Record<string, Money>>;
  readonly officialCategoryTypicalAmounts: Readonly<Record<string, Money>>;
}): GlobalM2Axis {
  const grouped = groupMonthly(input.components, input.axis);
  const dimensions = dimensionByKey(input.components, input.axis);
  const allKeys = [...new Set([...dimensions.keys(), ...input.referenceMonths.flatMap((month) => [...(grouped.get(month)?.keys() ?? [])])])].sort();
  const current = grouped.get(input.targetMonth) ?? new Map<string, Money>();
  const targetComponents = input.components.filter(({ month }) => month === input.targetMonth);
  const axisCoverage = coverage(targetComponents, input.axis);
  const axisSupport = support(input.referenceMonths);
  const groups = allKeys.map((key): GlobalM2Group => {
    const monthlyAmount = current.get(key) ?? ZERO;
    const dimension = dimensions.get(key) ?? (() => { throw new TypeError(`Dimension absente pour ${key}.`); })();
    let typicalAmount: Money | null = null;
    if (axisSupport.supportStatus !== "INSUFFICIENT") {
      if (input.axis === "CATEGORY" && dimension.status === "KNOWN") {
        const authority = input.officialCategoryTypicalAmounts[dimension.id];
        if (authority === undefined) throw new TypeError(`Typical officiel absent pour category:${dimension.id}.`);
        typicalAmount = parseMoney(authority);
      } else {
        typicalAmount = medianMoney(input.referenceMonths.map((month) => grouped.get(month)?.get(key) ?? ZERO));
      }
    }
    if (input.axis === "CATEGORY" && dimension.status === "KNOWN") {
      const authority = input.officialCategoryCurrentAmounts[dimension.id];
      if (authority === undefined || !new Big(authority).eq(monthlyAmount)) {
        throw new TypeError(`Le montant category_amount officiel ne réconcilie pas category:${dimension.id}.`);
      }
    }
    const deltaAmount = typicalAmount === null ? null : parseMoney(new Big(monthlyAmount).minus(typicalAmount).toFixed());
    return {
      key,
      dimension,
      monthlyAmount,
      typicalAmount,
      shareOfTypical: typicalAmount === null ? null : ratio(typicalAmount, input.officialTypicalTotal),
      deltaAmount,
      deltaRelative: deltaAmount === null || typicalAmount === null ? null : ratio(deltaAmount, typicalAmount),
      historicalSeries: [...input.referenceMonths, input.targetMonth].map((month) => ({ month, amount: grouped.get(month)?.get(key) ?? ZERO })),
      contributors: contributorsFor(input.components, input.targetMonth, input.axis, key),
      classificationBreakdown: {
        necessity: classificationContributorsFor(input.components, input.targetMonth, input.axis, key, "necessity"),
        behavior: classificationContributorsFor(input.components, input.targetMonth, input.axis, key, "behavior"),
        lifeScope: classificationContributorsFor(input.components, input.targetMonth, input.axis, key, "lifeScope"),
      },
      drillDownRef: { kind: input.axis, id: key },
      evidenceRefs: canonicalRefs(targetComponents.filter((component) => dimensionKey(dimensionOf(component, input.axis)) === key).flatMap(({ evidenceRefs }) => evidenceRefs)),
    };
  });
  const currentTotal = sum(groups.map(({ monthlyAmount }) => monthlyAmount));
  const reconcilesToActual = new Big(currentTotal).eq(input.actual);
  if (!reconcilesToActual) throw new TypeError(`${input.axis} ne se réconcilie pas avec Actual.`);
  const typicalSum = sum(groups.flatMap(({ typicalAmount }) => typicalAmount === null ? [] : [typicalAmount]));
  return {
    groups,
    coverage: axisCoverage,
    support: axisSupport,
    currentTotal,
    reconcilesToActual,
    shareSumIsExhaustive: axisCoverage.effective === 1 && new Big(typicalSum).eq(input.officialTypicalTotal),
  };
}

function materialityCandidates(categories: GlobalM2Axis, needs: GlobalM2Axis): readonly GlobalMaterialityCandidate[] {
  return [
    ...categories.groups.map((group) => ({ axis: "category", group, envelope: categories })),
    ...needs.groups.map((group) => ({ axis: "need", group, envelope: needs })),
  ].flatMap(({ axis, group, envelope }): GlobalMaterialityCandidate[] => group.deltaAmount === null ? [] : [{
    candidateId: `global-m2:${axis}:${group.key}`,
    phenomenonId: `${axis}:${group.key}`,
    metricRef: `global-m2:${axis}:monthly-amount`,
    effect: {
      absolute: group.deltaAmount,
      ...(group.deltaRelative === null ? {} : { relative: group.deltaRelative }),
    },
    knowledgeState: envelope.coverage.effective === 1 ? "KNOWN" : "PARTIAL",
    support: envelope.support,
    coverage: envelope.coverage,
    evidenceRefs: group.evidenceRefs,
    entityRefs: group.dimension.status === "KNOWN" ? [`${axis}:${group.dimension.id}`] : [],
    methodVersion: GLOBAL_M2_METHOD_VERSION,
    materialityPolicy: globalM2Policies.materiality,
  }]).sort((a, b) => a.phenomenonId.localeCompare(b.phenomenonId));
}

export function buildGlobalCategoryNeeds(input: {
  readonly targetMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
  readonly components: readonly GlobalM2MonthlyComponent[];
  readonly actual: Money;
  readonly officialTypicalTotal: Money;
  readonly officialCategoryCurrentAmounts: Readonly<Record<string, Money>>;
  readonly officialCategoryTypicalAmounts: Readonly<Record<string, Money>>;
  readonly purchaseFrequencyTicket?: GlobalPurchaseFrequencyTicketResult;
}): GlobalCategoryNeedsResult {
  const referenceMonths = [...new Set(input.referenceMonths)].sort();
  if (referenceMonths.includes(input.targetMonth) || referenceMonths.some((month) => month >= input.targetMonth)) {
    throw new TypeError("M2 exige des références strictement antérieures au mois cible.");
  }
  const componentIds = input.components.map(({ month, canonicalComponentKey }) => `${month}:${canonicalComponentKey}`);
  if (new Set(componentIds).size !== componentIds.length) throw new TypeError("M2 refuse une composante économique mensuelle dupliquée.");
  const components = [...input.components].map((component) => ({
    ...component,
    economicIdentityRefs: canonicalRefs(component.economicIdentityRefs),
    evidenceRefs: canonicalRefs(component.evidenceRefs),
  })).sort((a, b) => a.month.localeCompare(b.month) || a.canonicalComponentKey.localeCompare(b.canonicalComponentKey));
  const common = {
    targetMonth: input.targetMonth,
    referenceMonths,
    components,
    actual: parseMoney(input.actual),
    officialTypicalTotal: parseMoney(input.officialTypicalTotal),
    officialCategoryCurrentAmounts: input.officialCategoryCurrentAmounts,
    officialCategoryTypicalAmounts: input.officialCategoryTypicalAmounts,
  };
  const categories = buildAxis({ ...common, axis: "CATEGORY" });
  const needs = buildAxis({ ...common, axis: "NEED" });
  const purchaseFrequencyTicket = input.purchaseFrequencyTicket ?? {
    status: "UNAVAILABLE" as const,
    reasonCode: "PURCHASE_EVENT_AUTHORITY_UNAVAILABLE" as const,
  };
  return {
    targetMonth: input.targetMonth,
    referenceMonths,
    categories,
    needs,
    materialityCandidates: materialityCandidates(categories, needs),
    purchaseFrequencyTicket,
    inputHash: digest({ ...common, purchaseFrequencyTicket, policies: globalM2Policies, methodVersion: GLOBAL_M2_METHOD_VERSION }),
  };
}

function canonicalPurchaseEvents(values: readonly GlobalPurchaseEventAmount[]): readonly GlobalPurchaseEventAmount[] {
  const ids = values.map(({ purchaseEventId }) => purchaseEventId);
  if (new Set(ids).size !== ids.length) throw new TypeError("PurchaseEvent dupliqué dans une période M2.");
  return [...values].map((value) => ({ ...value, amount: parseMoney(value.amount) }))
    .sort((a, b) => a.purchaseEventId.localeCompare(b.purchaseEventId));
}

/** Exact symmetric decomposition, available only on fully covered canonical PurchaseEvents. */
export function decomposeGlobalPurchaseFrequencyTicket(input: {
  readonly authorityAvailable: boolean;
  readonly purchaseCoverage: number;
  readonly reference: readonly GlobalPurchaseEventAmount[];
  readonly current: readonly GlobalPurchaseEventAmount[];
}): GlobalPurchaseFrequencyTicketResult {
  if (!input.authorityAvailable) return { status: "UNAVAILABLE", reasonCode: "PURCHASE_EVENT_AUTHORITY_UNAVAILABLE" };
  if (input.purchaseCoverage !== 1) return { status: "UNAVAILABLE", reasonCode: "PURCHASE_EVENT_COVERAGE_INCOMPLETE" };
  const reference = canonicalPurchaseEvents(input.reference);
  const current = canonicalPurchaseEvents(input.current);
  if (reference.length === 0 || current.length === 0) return { status: "UNAVAILABLE", reasonCode: "INCOMPATIBLE_ZERO_FREQUENCY" };
  const f1 = new Big(reference.length);
  const f2 = new Big(current.length);
  const s1 = new Big(sum(reference.map(({ amount }) => amount)));
  const s2 = new Big(sum(current.map(({ amount }) => amount)));
  const p1 = s1.div(f1);
  const p2 = s2.div(f2);
  const frequencyEffect = f2.minus(f1).times(p1.plus(p2)).div(2);
  const ticketEffect = p2.minus(p1).times(f1.plus(f2)).div(2);
  const deltaSpend = s2.minus(s1);
  if (!frequencyEffect.plus(ticketEffect).eq(deltaSpend)) throw new TypeError("La décomposition fréquence × ticket ne se réconcilie pas.");
  return {
    status: "KNOWN",
    referenceFrequency: reference.length,
    currentFrequency: current.length,
    referenceAverageTicket: parseMoney(p1.toFixed()),
    currentAverageTicket: parseMoney(p2.toFixed()),
    frequencyEffect: parseMoney(frequencyEffect.toFixed()),
    ticketEffect: parseMoney(ticketEffect.toFixed()),
    deltaSpend: parseMoney(deltaSpend.toFixed()),
    reconciles: true,
  };
}

export function projectGlobalM2Month(input: {
  readonly month: YearMonth;
  readonly facts: readonly EconomicComponentFact[];
  readonly needByComponentKey: ReadonlyMap<string, GlobalM2DimensionValue>;
  readonly classificationsByComponentKey: ReadonlyMap<string, EconomicComponentClassificationFact>;
}): readonly GlobalM2MonthlyComponent[] {
  return input.facts.flatMap((fact) => {
    if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") return [];
    const amount = sum(fact.economicTiming.segments.filter(({ economicMonth }) => economicMonth === input.month).map(({ amount: value }) => value));
    if (new Big(amount).eq(0)) return [];
    const mapDimension = <Id extends string>(value: { readonly kind: string; readonly id?: Id }, prefix: string): GlobalM2DimensionValue<Id> =>
      value.kind === "resolved" && value.id !== undefined
        ? { status: "KNOWN", id: value.id, evidenceRefs: [`${prefix}:${value.id}`] }
        : value.kind === "undetermined"
          ? { status: "UNDETERMINED", evidenceRefs: [`${prefix}:undetermined`] }
          : { status: value.kind === "not_applicable" ? "NOT_APPLICABLE" : value.kind === "conflict" ? "CONFLICT" : "UNKNOWN", evidenceRefs: [] };
    const key = String(fact.canonicalComponentKey);
    const classification = input.classificationsByComponentKey.get(key);
    const mapClassification = (value: ComponentAxisClassification | undefined): GlobalM2DimensionValue =>
      value?.status === "KNOWN" && value.value !== null
        ? { status: "KNOWN", id: value.value, evidenceRefs: canonicalRefs(value.evidenceRefs) }
        : value?.status === "CONFLICT"
          ? { status: "CONFLICT", evidenceRefs: canonicalRefs(value.evidenceRefs) }
          : { status: "UNKNOWN", evidenceRefs: value === undefined ? [] : canonicalRefs(value.evidenceRefs) };
    return [{
      month: input.month,
      canonicalComponentKey: key,
      amount,
      category: mapDimension(fact.category, "category"),
      subcategory: mapDimension(fact.subcategory, "subcategory"),
      need: input.needByComponentKey.get(key) ?? { status: "UNKNOWN", evidenceRefs: [] },
      necessity: mapClassification(classification?.necessity),
      behavior: mapClassification(classification?.behavior),
      lifeScope: mapClassification(classification?.lifeScope),
      economicIdentityRefs: [`economic-component:${key}`],
      evidenceRefs: [`economic-component:${key}`],
    }];
  });
}

export function createGlobalM2DependencyDeclaration(input: {
  readonly personScope: GlobalPersonScopePolicy;
  readonly authorizedPersonIds: readonly PersonId[];
}): GlobalDependencyDeclaration {
  return parseGlobalDependencyDeclaration({
    declarationVersion: "global-dependency-declaration@v1",
    resourceId: "global-v2:m2-category-needs",
    factDependencies: [
      { kind: "FACT", id: "fct_economic_component", requirement: "REQUIRED", scopeRelation: "same-household-and-natural-month", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_economic_component_classification", requirement: "REQUIRED", scopeRelation: "same-canonical-component", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "FACT", id: "fct_purchase_event", requirement: "OPTIONAL", scopeRelation: "exact-economic-component-membership", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    entityDependencies: [
      { kind: "ENTITY", id: "categories", requirement: "REQUIRED", scopeRelation: "referenced-category-ids" },
      { kind: "ENTITY", id: "subcategories", requirement: "REQUIRED", scopeRelation: "referenced-subcategory-ids" },
      { kind: "ENTITY", id: "needs", requirement: "REQUIRED", scopeRelation: "explicit-source-or-operation-need-id" },
    ],
    upstreamAnalytics: [
      { kind: "ANALYTICS", id: "economic_consumption_net_attributable", requirement: "REQUIRED", scopeRelation: "same-scope-and-month", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "category_amount", requirement: "REQUIRED", scopeRelation: "same-category-and-month", corpusAuthority: "CERTIFIED_HISTORY" },
      { kind: "ANALYTICS", id: "typical_month_cost", requirement: "REQUIRED", scopeRelation: "household-and-category-strictly-prior-window", corpusAuthority: "CERTIFIED_HISTORY" },
    ],
    otherModuleDependencies: [
      { kind: "MODULE", id: "global-v2:m1-economic-function", requirement: "REQUIRED", scopeRelation: "same-target-and-reference-window" },
      { kind: "MODULE", id: "GlobalMaterialityEngine", requirement: "REQUIRED", scopeRelation: "candidate-evaluation-only" },
      { kind: "MODULE", id: "global-v2:m8-purchase-enrichment:P10", requirement: "OPTIONAL", scopeRelation: "one-way-enrichment-after-authority" },
    ],
    naturalGrain: "MONTH",
    timeWindowPolicy: { id: "global-category-need-reference", version: "v1" },
    historicalLookback: { kind: "LAST_ELIGIBLE_UNITS", count: 12 },
    personScope: input.personScope,
    entityScope: { kind: "NONE" },
    supportPolicy: { id: "global-category-need-support", version: "v1" },
    coveragePolicy: { id: "global-category-need-coverage", version: "v1" },
    materialityPolicy: globalM2Policies.materiality,
    methodVersion: GLOBAL_M2_METHOD_VERSION,
    policyVersions: { reference: "v1", support: "v1", coverage: "v1", materiality: "v1", purchaseEnrichment: "v1" },
    publicationOutputs: [],
    invalidationScope: { kind: "MODULE", moduleId: "global-v2:m2-category-needs" },
    capabilityRequirements: [
      { capabilityId: "global-v2:certified-economic-history", requirement: "REQUIRED" },
      { capabilityId: "global-v2:purchase-event-enrichment", requirement: "OPTIONAL" },
    ],
  }, { authorizedPersonIds: input.authorizedPersonIds });
}
