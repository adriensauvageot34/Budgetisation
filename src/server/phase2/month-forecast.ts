import "server-only";

import Big from "big.js";
import { expandGlobalBackgroundFoodReadModel, type GlobalBackgroundRhythmsReadModel, type GlobalExpandedReadModel } from "@/query-api/global-v2";
import { buildMonthReference, type MonthReferenceEvidence, type MonthReferencePlan } from "./month-reference";

export type ForecastKnowledge = "PROBABLE" | "UNKNOWN" | "CONDITIONAL_UNKNOWN";
export type ForecastRange = Readonly<{ low: string | null; central: string | null; high: string | null }>;
export type ForecastComponent = ForecastRange & Readonly<{
  key: string;
  label: string;
  nature: "CONTRACTUAL_EXPECTED" | "HABITUAL_RANGE" | "CONDITIONAL_UNKNOWN" | "EXPLANATORY";
  ownerAuthority: string;
  provenance: readonly string[];
  referenceMode: "CURRENT_VALUE" | "RECENT_6M" | "HYBRID" | "DISTRIBUTION" | "UNAVAILABLE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  knowledgeState: ForecastKnowledge;
  additiveGroup: string | null;
  parentEnvelope: string | null;
  replaces: readonly string[];
  fundingPlan: "BANK_OR_OTHER" | "BENEFIT_OR_BANK" | "UNKNOWN";
  freshnessDate: string | null;
  limitations: readonly string[];
}>;

export type MonthForecast = Readonly<{
  meta: { targetMonth: string; sourcePublicationId: string; sourceRevision: number; analyticsRevision: number; computedAt: string; certificationStatus: "PROVISIONAL" };
  components: readonly ForecastComponent[];
  income: ForecastRange & { knowledgeState: ForecastKnowledge; components: readonly ForecastComponent[] };
  obligations: ForecastRange;
  economicCost: ForecastRange & { coverage: "KNOWN_BASELINE_ONLY" };
  cash: { grossBeforeUnconfirmedFunding: ForecastRange; afterPotentialBenefit: ForecastRange; confirmedBenefit: null; knowledgeState: "CONDITIONAL_UNKNOWN" };
  funding: { benefitHistoricalRange: ForecastRange; currentBalance: null; knowledgeState: "UNKNOWN" };
  events: { planned: readonly []; eventDelta: null; knowledgeState: "UNKNOWN" };
  reserve: { amount: string; source: "POLICY" };
  freeToSpend: ForecastRange & { knowledgeState: "PROBABLE" | "UNKNOWN"; coverage: "KNOWN_BASELINE_ONLY" };
  availableNow: { status: "UNAVAILABLE"; value: null; missingInputs: readonly ["OPENING_BALANCE"] };
  limitations: readonly string[];
  referencePlan?: MonthReferencePlan;
}>;

export type ForecastRecurrence = Readonly<{
  recurrence_series_id: string; name: string; cadence_estimee: string | null;
  mode_prevision: string | null; actif_prevision: boolean | null;
}>;
export type ForecastOperation = Readonly<{
  operation_id: string; recurrence_series_id: string | null; date_bancaire: string;
  montant: string | number; flux: string | null; statut: string | null; marchand: string | null;
}>;
export type ForecastAuthorities = Readonly<{
  publication: { publication_id: string; source_revision: number; published_analytics_revision: number };
  background: GlobalBackgroundRhythmsReadModel;
  recurrenceDetails: readonly GlobalExpandedReadModel[];
  categoryNeedDetails: readonly GlobalExpandedReadModel[];
  routineDetails: readonly GlobalExpandedReadModel[];
  transformation: { visibility: string };
  recurrences: readonly ForecastRecurrence[];
  recurrenceOperations: readonly ForecastOperation[];
  incomeOperations: readonly ForecastOperation[];
  categories: readonly { category_id: string; nom_canonique: string }[];
  needs: readonly { need_id: string; name: string }[];
  referenceEvidence?: MonthReferenceEvidence;
}>;

// P2-13 policy for any target month. It is not an October observation.
export const DEFAULT_SAFETY_RESERVE = "200";

const amount = (value: string | number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError("FORECAST_NON_FINITE_AMOUNT");
  return parsed;
};
const euro = (value: number | Big): string => new Big(typeof value === "number" ? value.toFixed(8) : value).round(2).toFixed(2);
const rounded = (value: number, step = 5): string => euro(Math.round(value / step) * step);
const sorted = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const quantile = (values: readonly number[], q: number): number => {
  if (values.length === 0) throw new TypeError("FORECAST_REFERENCE_EMPTY");
  const ordered = sorted(values);
  const position = (ordered.length - 1) * q;
  const lower = Math.floor(position);
  return ordered[lower]! + (ordered[Math.ceil(position)]! - ordered[lower]!) * (position - lower);
};
const median = (values: readonly number[]): number => quantile(values, 0.5);
const sum = (values: readonly string[]): string => values.reduce((total, value) => total.plus(value), new Big(0)).toFixed(2);
const addRange = (parts: readonly ForecastRange[]): ForecastRange => {
  if (parts.length === 0 || parts.some((part) => part.low === null || part.central === null || part.high === null)) return { low: null, central: null, high: null };
  return { low: sum(parts.map((part) => part.low!)), central: sum(parts.map((part) => part.central!)), high: sum(parts.map((part) => part.high!)) };
};
export const sumAdditiveForecastComponents = (parts: readonly ForecastComponent[]): ForecastRange => {
  const additive = parts.filter((part) => part.additiveGroup !== null && part.parentEnvelope === null);
  const replaced = new Set(additive.flatMap((part) => part.replaces));
  return addRange(additive.filter((part) => !replaced.has(part.key)));
};
const subtract = (left: string | null, right: string | null): string | null => left === null || right === null ? null : new Big(left).minus(right).toFixed(2);
const normalize = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
const metric = (detail: GlobalExpandedReadModel, id: string) => detail.metrics.find((entry) => entry.metricId === id);
const metricMoney = (detail: GlobalExpandedReadModel, id: string): string | null => {
  const found = metric(detail, id);
  return found?.knowledgeState === "KNOWN" && found.typedMeasure?.kind === "MONEY" ? found.typedMeasure.value : null;
};
const detailRef = (detail: GlobalExpandedReadModel): string | null => detail.rows.find((row) => row.entityRef)?.entityRef ?? null;
const categoryRef = (detail: GlobalExpandedReadModel): string | null => {
  const match = detail.metrics[0]?.phenomenonRef?.match(/^(category|need):([^:]+):/u);
  return match ? `${match[1]}:${match[2]}` : null;
};
const seriesValues = (detail: GlobalExpandedReadModel): number[] => detail.series[0]?.points.flatMap((point) =>
  point.knowledgeState === "KNOWN" && point.typedMeasure?.kind === "MONEY" ? [amount(point.typedMeasure.value)] : []) ?? [];

function component(input: Omit<ForecastComponent, "parentEnvelope" | "replaces"> & Partial<Pick<ForecastComponent, "parentEnvelope" | "replaces">>): ForecastComponent {
  return { parentEnvelope: null, replaces: [], ...input };
}

function incomeComponents(input: ForecastAuthorities, latestMonth: string): ForecastComponent[] {
  const bySource = new Map<string, Map<string, ForecastOperation>>();
  for (const operation of input.incomeOperations) {
    if (operation.flux !== "Revenu" || operation.statut !== "Habituel" || !operation.marchand || amount(operation.montant) <= 0) continue;
    const source = operation.marchand;
    const month = operation.date_bancaire.slice(0, 7);
    if (month > latestMonth) continue;
    const monthly = bySource.get(source) ?? new Map<string, ForecastOperation>();
    const previous = monthly.get(month);
    if (!previous || amount(operation.montant) > amount(previous.montant)) monthly.set(month, operation);
    bySource.set(source, monthly);
  }
  return [...bySource].flatMap(([source, monthly]) => {
    const months = [...monthly.keys()].sort();
    const recent = months.slice(-6);
    if (recent.length < 4 || months.at(-1)! < latestMonth) return [];
    const values = recent.map((month) => amount(monthly.get(month)!.montant));
    return [component({
      key: `income:${source}`, label: source, nature: "HABITUAL_RANGE", ownerAuthority: "operations:regular-income",
      provenance: recent.map((month) => `operation:${monthly.get(month)!.operation_id}`), referenceMode: "RECENT_6M",
      low: euro(quantile(values, 0.25)), central: euro(median(values)), high: euro(quantile(values, 0.75)),
      confidence: recent.length === 6 ? "MEDIUM" : "LOW", knowledgeState: "PROBABLE", additiveGroup: "income",
      fundingPlan: "BANK_OR_OTHER", freshnessDate: `${months.at(-1)!}-01`,
      limitations: ["FUTURE_INCOME_OCCURRENCE_NOT_CERTIFIED", ...(recent.length < 6 ? ["LESS_THAN_SIX_REGULAR_MONTHS"] : [])],
    })];
  });
}

function obligations(input: ForecastAuthorities, latestMonth: string): ForecastComponent[] {
  const detailById = new Map(input.recurrenceDetails.flatMap((detail) => {
    const ref = detailRef(detail);
    return ref?.startsWith("recurrence:") ? [[ref.slice(11), detail] as const] : [];
  }));
  const operationById = new Map<string, ForecastOperation>();
  for (const operation of input.recurrenceOperations) {
    const id = operation.recurrence_series_id;
    if (!id || operation.flux !== "Dépense" || operation.date_bancaire.slice(0, 7) > latestMonth) continue;
    const previous = operationById.get(id);
    if (!previous || operation.date_bancaire > previous.date_bancaire) operationById.set(id, operation);
  }
  return input.recurrences.flatMap((series) => {
    if (!series.actif_prevision) return [];
    const detail = detailById.get(series.recurrence_series_id);
    if (!detail) return [];
    const latest = operationById.get(series.recurrence_series_id);
    const provenance = [`analysis_global_economic_recurrence_detail:${series.recurrence_series_id}`, `recurrence_series:${series.recurrence_series_id}`, ...(latest ? [`operation:${latest.operation_id}`] : [])];
    if (series.mode_prevision !== "Échéance fixe" || series.cadence_estimee !== "Mensuelle") return [component({
      key: `obligation:${series.recurrence_series_id}`, label: series.name, nature: "CONDITIONAL_UNKNOWN", ownerAuthority: "M1+recurrence_series",
      provenance, referenceMode: "UNAVAILABLE", low: null, central: null, high: null, confidence: "LOW",
      knowledgeState: "CONDITIONAL_UNKNOWN", additiveGroup: null, fundingPlan: "UNKNOWN", freshnessDate: latest?.date_bancaire ?? null,
      limitations: ["TARGET_MONTH_OCCURRENCE_NOT_PROVEN"],
    })];
    const expected = metricMoney(detail, "detail:expected-occurrence-amount");
    const fallback = latest ? euro(Math.abs(amount(latest.montant))) : metricMoney(detail, "detail:typical-occurrence-cost");
    const central = expected ?? fallback;
    return [component({
      key: `obligation:${series.recurrence_series_id}`, label: series.name, nature: "CONTRACTUAL_EXPECTED", ownerAuthority: "M1+recurrence_series",
      provenance, referenceMode: expected ? "CURRENT_VALUE" : latest ? "CURRENT_VALUE" : "DISTRIBUTION",
      low: central, central, high: central, confidence: expected ? "HIGH" : latest ? "MEDIUM" : "LOW",
      knowledgeState: central === null ? "UNKNOWN" : "PROBABLE", additiveGroup: "obligations", fundingPlan: "BANK_OR_OTHER",
      freshnessDate: latest?.date_bancaire ?? null,
      limitations: ["CONTRACT_CONTINUITY_UNCONFIRMED", ...(expected ? [] : ["M1_EXPECTED_AMOUNT_UNKNOWN"]), ...(latest ? [] : ["LATEST_OPERATION_UNAVAILABLE"])],
    })];
  });
}

function categoryComponent(input: ForecastAuthorities, name: string, key: string, resource: "category" | "need", latestMonth: string): ForecastComponent {
  const entity = resource === "category"
    ? input.categories.find((row) => normalize(row.nom_canonique) === normalize(name))
    : input.needs.find((row) => normalize(row.name) === normalize(name));
  const id = entity === undefined ? null : resource === "category" ? (entity as { category_id: string }).category_id : (entity as { need_id: string }).need_id;
  const ref = id ? `${resource}:${id}` : null;
  const detail = input.categoryNeedDetails.find((row) => categoryRef(row) === ref);
  const values = detail ? seriesValues(detail) : [];
  const typical = detail ? metricMoney(detail, "detail:typical-amount") : null;
  if (values.length < 4 || typical === null) return component({
    key, label: name, nature: "HABITUAL_RANGE", ownerAuthority: `M2:${resource}`, provenance: ref ? [ref] : [],
    referenceMode: "UNAVAILABLE", low: null, central: null, high: null, confidence: "LOW", knowledgeState: "UNKNOWN",
    additiveGroup: key, fundingPlan: "BANK_OR_OTHER", freshnessDate: null, limitations: ["M2_REFERENCE_INSUFFICIENT"],
  });
  const recent = values.slice(-6);
  const activeMonths = values.filter((value) => value > 0).length;
  const upperQuantile = activeMonths < values.length * 0.75 ? 0.9 : 0.75;
  const low = rounded(quantile(values, 0.25));
  const central = rounded((median(values) + median(recent)) / 2);
  const high = rounded(quantile(values, upperQuantile));
  return component({
    key, label: name, nature: "HABITUAL_RANGE", ownerAuthority: `M2:${resource}`,
    provenance: [ref!, `analysis_global_category_need_detail:${ref}`], referenceMode: "HYBRID",
    low, central, high, confidence: activeMonths >= 9 ? "MEDIUM" : "LOW", knowledgeState: "PROBABLE",
    additiveGroup: key, fundingPlan: "BANK_OR_OTHER", freshnessDate: `${latestMonth}-01`,
    limitations: ["FUTURE_USAGE_NOT_CERTIFIED", ...(resource === "need" ? ["NEED_SCOPE_NON_EXHAUSTIVE"] : [])],
  });
}

function foodComponent(input: ForecastAuthorities, targetMonth: string): ForecastComponent {
  if (input.background.food.methodVersion !== "global_food_rhythm@v2-purchase-aware") throw new TypeError("FORECAST_FOOD_PURCHASE_AWARE_REQUIRED");
  const expanded = expandGlobalBackgroundFoodReadModel(input.background);
  const known = expanded.months.filter((row) => row.money.total.quality === "KNOWN").map((row) => amount(row.money.total.amount));
  const all = expanded.months.map((row) => amount(row.money.total.amount));
  if (known.length < 4) throw new TypeError("FORECAST_FOOD_KNOWN_SUPPORT_INSUFFICIENT");
  const targetCalendarMonth = input.background.period.endMonth;
  const seasonal = expanded.months.filter((row) => row.month.endsWith(targetMonth.slice(4)) && row.money.total.quality === "KNOWN").at(-1);
  const center = seasonal ? (median(known) + amount(seasonal.money.total.amount)) / 2 : median(known);
  return component({
    key: "food", label: "Food", nature: "HABITUAL_RANGE", ownerAuthority: input.background.food.methodVersion,
    provenance: [`analysis_global_background_rhythms:${input.publication.publication_id}`], referenceMode: seasonal ? "HYBRID" : "DISTRIBUTION",
    low: rounded(quantile(known, 0.25), 10), central: rounded(center, 10), high: rounded(quantile(all, 0.75), 10),
    confidence: "MEDIUM", knowledgeState: "PROBABLE", additiveGroup: "food", fundingPlan: "BENEFIT_OR_BANK",
    freshnessDate: `${targetCalendarMonth}-01`, limitations: ["SIX_MONTHS_LOWER_BOUND", "RESTAURANT_OCCURRENCE_COST_GATED"],
  });
}

function mobility(input: ForecastAuthorities): { usage: ForecastComponent; cashReserve: ForecastRange } {
  const months = input.background.carMobility.months;
  const usage = months.map((row) => amount(row.modeledUsage.estimatedFuelCost));
  const paid = months.map((row) => amount(row.observedFuelPaid.amount));
  if (usage.length < 6 || paid.length < 6) throw new TypeError("FORECAST_MOBILITY_SUPPORT_INSUFFICIENT");
  return {
    usage: component({
      key: "mobility-usage", label: "Fuel usage", nature: "HABITUAL_RANGE", ownerAuthority: input.background.carMobility.methodVersion,
      provenance: [`analysis_global_background_rhythms:carMobility:${input.publication.publication_id}`], referenceMode: "HYBRID",
      low: rounded(quantile(usage, 0.33)), central: rounded((median(usage) + median(usage.slice(-6))) / 2),
      high: rounded(quantile(usage, 0.75)), confidence: "MEDIUM", knowledgeState: "PROBABLE",
      additiveGroup: "mobility", fundingPlan: "BANK_OR_OTHER", freshnessDate: `${input.background.period.endMonth}-01`,
      limitations: ["PHYSICAL_USAGE_ESTIMATE", "MOBILITY_CORPUS_COMPLETENESS_UNKNOWN"],
    }),
    cashReserve: { low: rounded(median(paid)), central: rounded(median(paid.slice(-6))), high: rounded(quantile(paid, 0.75)) },
  };
}

export function assembleMonthForecast(input: ForecastAuthorities, targetMonth: string): MonthForecast {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth) || targetMonth <= input.background.period.endMonth) throw new TypeError("FORECAST_TARGET_MONTH_NOT_FUTURE");
  if (input.background.publicationMeta.publicationId !== input.publication.publication_id) throw new TypeError("FORECAST_PUBLICATION_MISMATCH");
  const latestMonth = input.background.period.endMonth;
  const income = incomeComponents(input, latestMonth);
  const charges = obligations(input, latestMonth);
  const food = foodComponent(input, targetMonth);
  const categories = [
    categoryComponent(input, "Santé", "health", "category", latestMonth),
    categoryComponent(input, "Soins personnels", "personal-care", "category", latestMonth),
    categoryComponent(input, "Tabac & vape", "tobacco-vape", "category", latestMonth),
    categoryComponent(input, "Cafés au travail", "work-coffee", "need", latestMonth),
    categoryComponent(input, "Animaux", "animal-care", "category", latestMonth),
  ];
  const car = mobility(input);
  // C7 human decision: reuse the declared work patterns as explicit estimates.
  // Recompute workdays for the target month; monthly resources/exceptions stay month-local.
  const referencePlan = input.referenceEvidence ? buildMonthReference(input.referenceEvidence, targetMonth,
    input.recurrenceOperations.filter((operation) => operation.recurrence_series_id !== null).map((operation) => ({
      componentKey: `obligation:${operation.recurrence_series_id}`, date: operation.date_bancaire,
    }))) : undefined;
  const components = [...charges, food, ...categories, car.usage];
  const summedObligations = sumAdditiveForecastComponents(charges.filter((part) => part.additiveGroup === "obligations"));
  const obligationRange = summedObligations.central === null ? summedObligations : {
    low: euro(Math.floor(amount(summedObligations.central) / 5) * 5), central: summedObligations.central,
    high: euro(Math.ceil(amount(summedObligations.central) / 5) * 5),
  };
  const otherCosts = sumAdditiveForecastComponents(components.filter((part) => part.additiveGroup !== "obligations"));
  const economicCost = addRange([obligationRange, otherCosts]);
  const grossCash: ForecastRange = {
    low: economicCost.low === null ? null : new Big(economicCost.low).minus(car.usage.low!).plus(car.cashReserve.low!).toFixed(2),
    central: economicCost.central === null ? null : new Big(economicCost.central).minus(car.usage.central!).plus(car.cashReserve.central!).toFixed(2),
    high: economicCost.high === null ? null : new Big(economicCost.high).minus(car.usage.high!).plus(car.cashReserve.high!).toFixed(2),
  };
  const benefitValues = input.background.food.monthlyBenefitFunding.map(([, value]) => amount(value));
  const benefit: ForecastRange = benefitValues.length < 3 ? { low: null, central: null, high: null } : {
    low: rounded(quantile(benefitValues, 0.25)), central: rounded(median(benefitValues)), high: rounded(quantile(benefitValues, 0.75)),
  };
  const incomeRange = addRange(income);
  const reserve = DEFAULT_SAFETY_RESERVE;
  const freeToSpend: ForecastRange = {
    low: incomeRange.low === null || economicCost.high === null ? null : new Big(incomeRange.low).minus(economicCost.high).minus(reserve).toFixed(2),
    central: incomeRange.central === null || economicCost.central === null ? null : new Big(incomeRange.central).minus(economicCost.central).minus(reserve).toFixed(2),
    high: incomeRange.high === null || economicCost.low === null ? null : new Big(incomeRange.high).minus(economicCost.low).minus(reserve).toFixed(2),
  };
  return {
    meta: { targetMonth, sourcePublicationId: input.publication.publication_id, sourceRevision: input.publication.source_revision,
      analyticsRevision: input.publication.published_analytics_revision, computedAt: new Date().toISOString(), certificationStatus: "PROVISIONAL" },
    components, income: { ...incomeRange, knowledgeState: income.length ? "PROBABLE" : "UNKNOWN", components: income },
    obligations: obligationRange, economicCost: { ...economicCost, coverage: "KNOWN_BASELINE_ONLY" },
    cash: { grossBeforeUnconfirmedFunding: grossCash, afterPotentialBenefit: {
      low: subtract(grossCash.low, benefit.high), central: subtract(grossCash.central, benefit.central), high: subtract(grossCash.high, benefit.low),
    }, confirmedBenefit: null, knowledgeState: "CONDITIONAL_UNKNOWN" },
    funding: { benefitHistoricalRange: benefit, currentBalance: null, knowledgeState: "UNKNOWN" },
    events: { planned: [], eventDelta: null, knowledgeState: "UNKNOWN" }, reserve: { amount: reserve, source: "POLICY" },
    freeToSpend: { ...freeToSpend, knowledgeState: freeToSpend.central === null ? "UNKNOWN" : "PROBABLE", coverage: "KNOWN_BASELINE_ONLY" },
    availableNow: { status: "UNAVAILABLE", value: null, missingInputs: ["OPENING_BALANCE"] },
    limitations: ["FUTURE_EVENTS_UNDECLARED", "ORNIKAR_ALMA_TARGET_OCCURRENCE_UNPROVEN", "BENEFIT_BALANCE_UNKNOWN", "OPENING_BALANCE_UNKNOWN",
      ...(input.transformation.visibility !== "VISIBLE" ? ["M3_REGIME_NOT_PUBLISHED"] : []),
      ...(input.routineDetails.length === 0 ? ["ROUTINE_DETAIL_UNAVAILABLE"] : []),
      "ECONOMIC_BASE_EXCLUDES_UNKNOWN_EVENTS_AND_CONDITIONAL_OBLIGATIONS"],
    ...(referencePlan ? { referencePlan } : {}),
  };
}
