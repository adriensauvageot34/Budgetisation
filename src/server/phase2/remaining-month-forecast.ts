import "server-only";
import Big from "big.js";
import { referenceQuantile, referenceMobilityDays, RESTAURANT_SUBCATEGORIES, TOBACCO_SUBCATEGORIES,
  type EconomicReferenceEntry, type MonthReferenceEvidence, type MonthReferencePlan, type MobilityReferenceLeg } from "./month-reference";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { FORECAST_POLICY, occurrenceDistribution, type OccurrenceDistribution } from "./forecast-statistics";
import { forecastTemporalPolicy, type ForecastTemporalMode } from "./forecast-temporal-policy";
import { makeAsOfContext, opportunityState, requiredForecastSources, safeToExpire, emptyCostRange, sumCostRanges,
  type AsOfContext, type EvidenceSource, type SourceCoverage, type ForecastOpportunity, type OpportunityState } from "./forecast-opportunities";
import { economicObservations, reconcilePlannedObservations, type BankObservation, type PlannedObservationMatch } from "./planned-observation-reconciliation";

export type CostRange = Readonly<{ low: string; central: string; high: string }>;
export type FundingRange = Readonly<{ low: string | null; central: string | null; high: string | null }>;
export type MonthPredictionEvidence = Readonly<{ history: MonthReferenceEvidence;
  currentEconomicEntries: readonly EconomicReferenceEntry[]; currentMobilityLegs: readonly MobilityReferenceLeg[];
  /** Compatibility alias: latest booking, never coverage. */ observedThrough: string | null;
  latestObservedBookingDate?: string | null; timezone?: string; asOfDate?: string;
  manualBankBalanceObservation?: Readonly<{ amount: string; asOfDate: string }> | null;
  personNamesById: Readonly<Record<string, string>>; bankObservations?: readonly BankObservation[];
  benefitWalletEvidence?: import("./benefit-wallet-funding").BenefitWalletEvidence;
  bankCoverageIntervals?: readonly import("./forecast-opportunities").CoverageInterval[];
  coverageBySource?: Readonly<Partial<Record<EvidenceSource, SourceCoverage>>>;
  completeMonthsBySource?: Readonly<Partial<Record<EvidenceSource, readonly string[]>>>;
  coverageThrough?: string | null; completeMonths?: readonly string[]; limitationCodes?: readonly string[];
  explicitWorkSchedule?: readonly { date: string; person: "Adrien" | "Manon"; onsite: boolean }[] }>;
export type OpportunityCounts = Readonly<Record<"future" | "planned" | "pending" | "observed" | "expired" | "cancelled" | "unresolved", number>>;
export type RemainingCategory = Readonly<{ key: string; label: string; alreadyRealized: string;
  decisionCapabilities?: import("@/domain/phase2/month-choice-contract").CategoryDecisionCapabilities;
  method: "CUMULATIVE_CURVE" | "CADENCE" | "WORKDAYS" | "CONDITIONAL_OCCURRENCES" | "PUBLISHED_FALLBACK";
  evidenceMonths: number; usualAtThisPoint: string | null; pace: "BELOW" | "USUAL" | "SLIGHTLY_ABOVE" | "ABOVE" | null;
  shift: "UP" | "DOWN" | null; occurrenceDistribution: OccurrenceDistribution | null; jointSamples: Readonly<Record<string, string>>;
  remaining: CostRange; projectedMonth: CostRange; baselineProvision: CostRange;
  habitualProjectGross: string; habitualPlannedGross: string; habitualDeclaredGross: string; absorbedByHabit: CostRange;
  remainingOpportunities: number | null; probability: number | null;
  expectedOccurrences: Readonly<{ low: number; central: number; high: number }> | null;
  conditionalMedianAmount: string | null; plannedOccurrencesAbsorbingHabit: number; plannedOccurrencesExtra: number;
  confidence: "LOW" | "MEDIUM" | "HIGH"; observationCount: number; explanation: string;
  observedEconomic: string; declaredRealizedEconomic: string; plannedEconomic: string;
  pendingExpectedEconomic: CostRange; futureExpectedEconomic: CostRange; remainingForecastEconomic: CostRange;
  expiredExpectedEconomic: string; cancelledEconomic: string; plannedBankCash: string;
  remainingForecastBankCash: FundingRange; expectedFunding: Readonly<Record<"BANK" | "SWILE" | "EDENRED", FundingRange>> & Readonly<{ UNKNOWN?: FundingRange }>;
  fundingToComplete?: FundingRange;
  opportunityCounts: OpportunityCounts | null; opportunities: readonly ForecastOpportunity[];
  coverage: Readonly<{ requiredSources: readonly EvidenceSource[]; sufficientForExpiration: boolean; limitationCodes: readonly string[] }>;
  limitationCodes: readonly string[]; cadences?: readonly { subcategory: string; medianGapDays: number | null; support: number; confidence: "LOW" | "MEDIUM" | "HIGH" }[] }>;
export type RemainingMonthPrediction = Readonly<{ essential: readonly RemainingCategory[]; optional: readonly RemainingCategory[];
  joint: { method: "EMPIRICAL_MONTHS" | "CATEGORY_FALLBACK"; comparableMonths: number;
    low: { essential: string; optional: string; impact: string }; high: { essential: string; optional: string; impact: string } };
  modelVersion: string; forecastTemporalMode: ForecastTemporalMode; temporalMode: AsOfContext["temporalMode"]; asOfContext: AsOfContext; reconciliation: readonly PlannedObservationMatch[];
  essentialProvision: CostRange; optionalProvision: CostRange; projectImpact: CostRange; absorbedByHabit: CostRange;
  essentialRemaining: CostRange; optionalRemaining: CostRange; importedEssential: string; importedOptional: string;
  remainingDays: number; remainingWorkdays: number; observedThrough: string | null; latestObservedBookingDate: string | null;
  currentImportsMissing: boolean; trainingMonths: readonly string[]; limitationCodes: readonly string[] }>;
export type ForecastCalibration = Readonly<Partial<Record<string, { bias: string; absoluteError: string; count: number; horizon: string }>>>;
const keys = ["low", "central", "high"] as const;
const money = (n: Big | number | string) => new Big(n).round(2).toFixed(2);
const positive = (n: Big) => n.gt(0) ? n : new Big(0);
const range = (fn: (key: typeof keys[number]) => Big | number | string): CostRange => Object.fromEntries(keys.map(key => [key, money(fn(key))])) as CostRange;
const quantiles = (values: readonly number[]): CostRange => range(key => values.length ? referenceQuantile(values, { low: .25, central: .5, high: .75 }[key]) : 0);
const monthAt = (month: string, delta: number) => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7); };
export function remainingMonthDays(month: string, asOf: string) {
  const [year, m] = month.split("-").map(Number), count = new Date(Date.UTC(year!, m!, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(date => date >= asOf);
}
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const workday = (date: string) => ![0, 6].includes(weekday(date));
export const matchesForecastCategory = (key: string, row: EconomicReferenceEntry): boolean => {
  const workMeal = row.need === "Repas du midi au travail" || row.preciseType === "Repas du midi au travail";
  if (key === "adrien-work-meals" || key === "manon-work-meals") return workMeal && row.person === (key === "adrien-work-meals" ? "Adrien" : "Manon");
  if (key === "adrien-work-coffee") return row.subcategory === "Café au travail" && (row.person === "Adrien" || row.person === null);
  if (key === "household-restaurants") return !workMeal && RESTAURANT_SUBCATEGORIES.some(s => s === row.subcategory);
  if (key === "groceries") return row.need === "Courses alimentaires du foyer" || row.subcategory === "Courses alimentaires";
  if (key === "tobacco-vape") return TOBACCO_SUBCATEGORIES.some(s => s === row.subcategory);
  return false;
};
const labels: Record<string, string> = { groceries: "Courses", "tobacco-vape": "Tabac & vape", "manon-work-mobility": "Trajets travail · Manon",
  "adrien-work-meals": "Repas travail · Adrien", "manon-work-meals": "Repas travail · Manon", "adrien-work-coffee": "Café travail · Adrien", "household-restaurants": "Restaurants du foyer" };
const byDay = (rows: readonly EconomicReferenceEntry[]) => {
  const map = new Map<string, number>(); for (const row of rows) map.set(row.date, (map.get(row.date) ?? 0) + Number(row.amount)); return map;
};
const fundingZero = (): FundingRange => emptyCostRange();
/** Source-complete history can estimate funding. Missing eligible wallet history leaves Bank unknown. */
function expectedFunding(key: string, remaining: CostRange, rows: readonly EconomicReferenceEntry[], months: readonly string[], evidence: MonthPredictionEvidence) {
  if (key === "manon-work-mobility") return { BANK: fundingZero(), SWILE: fundingZero(), EDENRED: fundingZero() };
  if (key === "tobacco-vape") return { BANK: remaining, SWILE: fundingZero(), EDENRED: fundingZero() };
  if (new Big(remaining.high).eq(0)) return { BANK: fundingZero(), SWILE: fundingZero(), EDENRED: fundingZero() };
  // Dated personal meal funding is resolved once in benefit-wallet-funding.ts.
  if (key === "adrien-work-meals" || key === "manon-work-meals") return {
    BANK: { low: "0.00", central: null, high: remaining.high },
    SWILE: { low: "0.00", central: null, high: remaining.high },
    EDENRED: { low: "0.00", central: null, high: remaining.high },
  };
  const sources = requiredForecastSources(key);
  const complete = months.filter(month => sources.every(source => evidence.completeMonthsBySource?.[source]?.includes(month)));
  const eligible = rows.filter(row => complete.includes(row.date.slice(0, 7)) && row.fundingComplete && row.amountStatus !== "PARTIAL");
  const total = eligible.reduce((n, row) => n + Number(row.amount), 0);
  return Object.fromEntries((["BANK", "SWILE", "EDENRED"] as const).map(source => {
    if (complete.length < FORECAST_POLICY.minimumMonths || total <= 0) return [source, { low: "0.00", central: null, high: remaining.high }];
    const ratio = Math.min(1, eligible.reduce((n, row) => n + Number(row.funding?.[source] ?? 0), 0) / total);
    return [source, range(k => new Big(remaining[k]).times(ratio))];
  })) as Record<"BANK" | "SWILE" | "EDENRED", FundingRange>;
}

/** Sole remaining-forecast owner. Models are conditioned on a civil as-of day, source proof,
 * real observations and explicit unobserved slots. Five prior calendar months train each run. */
export function forecastRemainingMonth(reference: MonthReferencePlan, evidence: MonthPredictionEvidence, asOf: string,
  expenses: readonly PlannedExpenseScenarioEntry[], assumptions: MonthDecisionSettings["assumptions"] = {}, calibration: ForecastCalibration = {},
  mode?: ForecastTemporalMode): RemainingMonthPrediction {
  const policy = forecastTemporalPolicy(mode);
  const month = reference.targetMonth, context = makeAsOfContext(month, asOf, evidence.timezone, evidence.coverageBySource);
  // Same owner and same historical models: evaluate an unconsumed full-month prior.
  // Only explicit facts consume this envelope in SAFE mode, never calendar silence.
  const monthlyPrior = policy.preserveMonthlyHabit ? forecastRemainingMonth(reference,
    { ...evidence, currentEconomicEntries: [], currentMobilityLegs: [], coverageBySource: {} },
    context.monthStart, [], {}, {}, "AS_OF_TEMPORAL") : null;
  const allDays = remainingMonthDays(month, `${month}-01`), days = allDays.filter(d => d >= asOf), working = days.filter(workday);
  // Even on the last day, the current month is not a closed training month.
  const boundary = month < asOf.slice(0, 7) ? month : asOf.slice(0, 7);
  const end = evidence.history.endMonth < monthAt(boundary, -1) ? evidence.history.endMonth : monthAt(boundary, -1);
  const start = monthAt(end, -4) < evidence.history.startMonth ? evidence.history.startMonth : monthAt(end, -4);
  const months: string[] = []; for (let cursor = start; cursor <= end; cursor = monthAt(cursor, 1)) months.push(cursor);
  const historical = evidence.history.economicEntries.filter(r => r.date.slice(0, 7) >= start && r.date.slice(0, 7) <= end && r.date < `${boundary}-01`);
  const current = evidence.currentEconomicEntries.filter(r => r.date.startsWith(month) && r.date <= asOf);
  const reconciliation = reconcilePlannedObservations(expenses, current, matchesForecastCategory, evidence.personNamesById);
  const activeExpenses = reconciliation.unmatchedExpenses;
  const historicalMobility = referenceMobilityDays(evidence.history.mobilityLegs.filter(l => l.date.slice(0, 7) >= start && l.date.slice(0, 7) <= end));
  const actualMobility = referenceMobilityDays(evidence.currentMobilityLegs.filter(l => l.date.startsWith(month) && l.date <= asOf));
  const onsite = {
    Adrien: new Set(historical.filter(r => matchesForecastCategory("adrien-work-meals", r) || matchesForecastCategory("adrien-work-coffee", r)).map(r => r.date)),
    Manon: new Set(historicalMobility.map(r => r.date)),
  };
  const slots = (key: string) => {
    const habitual = new Map<string, { id: string; date: string | null; amount: Big; status: string; bank: Big }>();
    const extra = new Set<string>(), occupied = new Set<string>();
    for (const expense of activeExpenses) for (const item of expense.costItems) {
      const module = item.modulePath?.at(-1), identity = `${expense.id}:${item.modulePath?.join("/") ?? "root"}`;
      const person = key === "adrien-work-meals" ? "Adrien" : key === "manon-work-meals" ? "Manon" : null;
      const refs = [...(expense.context?.participantPersonIds ?? []), ...(expense.context?.participantRefs ?? []).flatMap(r => r.kind === "HOUSEHOLD_PERSON" ? [r.personId] : [])];
      const samePersonMeal = module === "work_meal" && person !== null && refs.some(id => evidence.personNamesById[id] === person);
      if (item.baselineKey === key) {
        const previous = habitual.get(identity);
        habitual.set(identity, { id: expense.id, date: expense.plannedDate ?? null, status: expense.status,
          amount: (previous?.amount ?? new Big(0)).plus(plannedLineGross(item)), bank: (previous?.bank ?? new Big(0))
            .plus((item.fundingAllocations ?? [{ source: "BANK", amount: plannedLineGross(item) }]).filter(a => a.source === "BANK").reduce((n, a) => n.plus(a.amount), new Big(0))) });
      } else if ((key === "household-restaurants" && ["restaurant", "fast_food"].includes(module ?? "")) || samePersonMeal) extra.add(identity);
      if (item.baselineKey === key && person && expense.plannedDate) occupied.add(expense.plannedDate);
    }
    return { habitual: [...habitual.values()], extra: extra.size, occupied };
  };
  const categories = [...reference.necessary, ...reference.flexible].map(part => {
    const key = part.key, optional = reference.flexible.some(p => p.key === key), requiredSources = requiredForecastSources(key);
    const rows = historical.filter(r => matchesForecastCategory(key, r)), actualRows = current.filter(r => matchesForecastCategory(key, r));
    const slot = slots(key), habitGross = slot.habitual.reduce((n, s) => n.plus(s.amount), new Big(0));
    let observed = actualRows.reduce((n, r) => n.plus(r.amount), new Big(0));
    let method: RemainingCategory["method"] = "CONDITIONAL_OCCURRENCES", confidence: RemainingCategory["confidence"] = rows.length >= 30 && months.length >= 5 ? "HIGH" : rows.length >= 5 ? "MEDIUM" : "LOW";
    let unit: string | null = null, probability: number | null = null, opportunities: number | null = null, expectedOccurrences: RemainingCategory["expectedOccurrences"] = null;
    const limitations = new Set(requiredSources.flatMap(source => context.coverageBySource[source].limitationCodes));
    if (months.filter(m => requiredSources.every(source => evidence.completeMonthsBySource?.[source]?.includes(m))).length < FORECAST_POLICY.minimumMonths) {
      confidence = "LOW"; limitations.add("TRAINING_SOURCE_COVERAGE_UNCERTIFIED");
    }
    const draftOpportunities: ForecastOpportunity[] = [];
    const cadences: NonNullable<RemainingCategory["cadences"]>[number][] = [];
    const add = (date: string | null, probabilityValue: number, expected: CostRange, observedAmount = "0.00", observedRef?: ForecastOpportunity["observedRef"], idSuffix = "", cancelled = false) => {
      const state = opportunityState({ date, observed: observedRef !== undefined, planned: date !== null && slot.occupied.has(date), cancelled }, context, requiredSources, policy.behavioralExpiration);
      draftOpportunities.push({ id: `${month}:${key}:${date ?? "undated"}:${idSuffix}`, categoryKey: key, date, state,
        probability: Math.max(0, Math.min(1, probabilityValue)), expectedEconomic: expected,
        expectedFunding: expectedFunding(key, expected, rows, months, evidence), requiredSources,
        observedEconomic: observedAmount, plannedEconomic: state === "PLANNED" ? money(slot.habitual.filter(s => s.date === date).reduce((n, s) => n.plus(s.amount), new Big(0))) : "0.00",
        ...(state === "PLANNED" && slot.habitual.find(s => s.date === date) ? { plannedExpenseId: slot.habitual.find(s => s.date === date)!.id } : {}),
        pendingExpectedEconomic: ["PENDING_OBSERVATION", "UNRESOLVED"].includes(state) ? expected.central : "0.00",
        futureExpectedEconomic: state === "FUTURE" ? expected.central : "0.00", ...(observedRef ? { observedRef } : {}), confidence, limitationCodes: [...limitations] });
    };
    let basePending = emptyCostRange(), baseFuture = emptyCostRange(), baseline = emptyCostRange();
    const prior = monthlyPrior && [...monthlyPrior.essential, ...monthlyPrior.optional].find(c => c.key === key);
    if (prior) {
      method = prior.method; unit = prior.conditionalMedianAmount; probability = prior.probability;
      confidence = prior.confidence; cadences.push(...(prior.cadences ?? []));
      prior.limitationCodes.filter(code => code.includes("RARE_CADENCE") || code.includes("SPARSE") || code.includes("UNIDENTIFIED"))
        .forEach(code => limitations.add(code));
      limitations.add("FULL_MONTH_SAFE_NO_TIME_DECAY");
      const mobility = key === "manon-work-mobility";
      if (mobility) observed = actualMobility.reduce((n, r) => n.plus(r.commute).plus(r.detour ?? 0), new Big(0));
      for (const opportunity of prior.opportunities) {
        const suffix = opportunity.id.split(":").at(-1)!;
        const actual = actualRows.filter(r => r.date === opportunity.date && (key !== "tobacco-vape" || r.subcategory === suffix));
        const trip = mobility ? actualMobility.find(r => r.date === opportunity.date) : undefined;
        const fact = actual[0];
        const ref = trip ? { kind: "MOBILITY" as const, id: `commute:${trip.date}` }
          : fact ? { kind: fact.purchaseEventId ? "PURCHASE_EVENT" as const : "OPERATION" as const, id: fact.purchaseEventId ?? fact.operationId } : undefined;
        const amount = trip ? money(new Big(trip.commute).plus(trip.detour ?? 0)) : money(actual.reduce((n, r) => n.plus(r.amount), new Big(0)));
        add(opportunity.date, opportunity.probability, opportunity.expectedEconomic, amount, ref, suffix, opportunity.state === "CANCELLED");
      }
      const publishedFallback = new Big(prior.remaining.high).eq(0) && new Big(part.high ?? 0).gt(0) && prior.observationCount < 3;
      if (publishedFallback) { limitations.add("SAFE_PUBLISHED_MONTHLY_PRIOR"); confidence = "LOW"; }
      const envelope = publishedFallback ? range(k => part[k] ?? 0) : prior.remaining;
      const unconsumed = range(k => positive(new Big(envelope[k]).minus(observed)));
      // Bucket placement can move with the civil date; their sum cannot decay.
      const pendingWeight = draftOpportunities.filter(o => ["PENDING_OBSERVATION", "UNRESOLVED"].includes(o.state))
        .reduce((n, o) => n + Number(o.expectedEconomic.central), 0);
      const futureWeight = draftOpportunities.filter(o => o.state === "FUTURE").reduce((n, o) => n + Number(o.expectedEconomic.central), 0);
      const pendingShare = pendingWeight + futureWeight > 0 ? pendingWeight / (pendingWeight + futureWeight)
        : context.daysElapsed > 0 ? 1 : 0;
      basePending = range(k => new Big(unconsumed[k]).times(pendingShare));
      baseFuture = range(k => new Big(unconsumed[k]).minus(basePending[k]));
      const observedCount = mobility ? actualMobility.length : economicObservations(actualRows).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0);
      expectedOccurrences = prior.expectedOccurrences ? Object.fromEntries(keys.map(k => [k,
        Math.max(0, prior.expectedOccurrences![k] - observedCount - slot.habitual.length)])) as NonNullable<RemainingCategory["expectedOccurrences"]> : null;
      opportunities = prior.remainingOpportunities === null ? null : Math.max(0, prior.remainingOpportunities - observedCount - slot.habitual.length);
    } else if (key === "groceries") {
      method = "CUMULATIVE_CURVE";
      // Historical tails are the curve. No daily pro-rata and no arbitrary early nowcast.
      const futureTails = months.map(m => rows.filter(r => r.date.startsWith(m) && Number(r.date.slice(8)) >= (context.temporalMode === "FUTURE_MONTH" ? 1 : context.temporalMode === "PAST_MONTH" ? 32 : Number(asOf.slice(8))))
        .reduce((n, r) => n + Number(r.amount), 0));
      const missingPast = allDays.filter(d => d < asOf && !safeToExpire(d, context, requiredSources));
      const pendingTails = months.map(m => rows.filter(r => r.date.startsWith(m) && missingPast.some(d => d.slice(8) === r.date.slice(8))).reduce((n, r) => n + Number(r.amount), 0));
      const actualPast = actualRows.filter(r => r.date < asOf && missingPast.includes(r.date)).reduce((n, r) => n.plus(r.amount), new Big(0));
      basePending = range(k => positive(new Big(quantiles(pendingTails)[k]).minus(actualPast)));
      let scale = 1, weight = 0;
      const safeDay = context.coverageBySource.BANK.safeThrough;
      if (context.temporalMode === "CURRENT_MONTH" && context.daysElapsed >= 14 && safeDay !== null && safeDay >= context.monthStart) {
        const cutoff = Number(safeDay.slice(8)), day = Number(asOf.slice(8));
        const totalFor = (m: string, predicate: (d: number) => boolean) => rows.filter(r => r.date.startsWith(m) && predicate(Number(r.date.slice(8)))).reduce((n, r) => n + Number(r.amount), 0);
        const prefix = months.map(m => totalFor(m, d => d <= cutoff)), anchor = prefix.length ? referenceQuantile(prefix, .5) : 0;
        const actualPrefix = actualRows.filter(r => r.date <= safeDay).reduce((n, r) => n + Number(r.amount), 0);
        const slope = (sampleMonths: readonly string[]) => {
          const xs = sampleMonths.map(m => totalFor(m, d => d <= cutoff)), ys = sampleMonths.map(m => totalFor(m, d => d >= day));
          const xMean = xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length), yMean = ys.reduce((n, y) => n + y, 0) / Math.max(1, ys.length);
          const variance = xs.reduce((n, x) => n + (x - xMean) ** 2, 0);
          return variance > 0 ? Math.max(-1, Math.min(1, xs.reduce((n, x, i) => n + (x - xMean) * (ys[i]! - yMean), 0) / variance)) : 0;
        };
        const centralTail = Number(quantiles(futureTails).central);
        if (anchor > 0 && centralTail > 0) scale = Math.max(.5, Math.min(1.5, 1 + slope(months) * (actualPrefix - anchor) / centralTail));
        // Inner chronological backtests use only closed months, with at least two
        // older folds. This chooses a bounded weight; the UI never supplies it.
        const candidates = [0, .25, .5].map(w => {
          const errors = months.slice(2).map((m, i) => {
            const prior = months.slice(0, i + 2), priorPrefix = referenceQuantile(prior.map(p => totalFor(p, d => d <= cutoff)), .5);
            const priorTail = referenceQuantile(prior.map(p => totalFor(p, d => d >= day)), .5);
            const foldScale = priorPrefix > 0 && priorTail > 0 ? Math.max(.5, Math.min(1.5, 1 + slope(prior) * (totalFor(m, d => d <= cutoff) - priorPrefix) / priorTail)) : 1;
            return Math.abs(priorTail * (1 + w * (foldScale - 1)) - totalFor(m, d => d >= day));
          });
          return { w, error: errors.length >= 2 ? errors.reduce((n, e) => n + e, 0) / errors.length : Infinity };
        }).sort((a, b) => a.error - b.error || a.w - b.w);
        weight = candidates[0]?.error !== Infinity ? candidates[0]!.w : 0;
        if (weight > 0) limitations.add(`BOUNDED_NOWCAST_WEIGHT_${weight}`);
      }
      baseFuture = range(k => positive(new Big(quantiles(futureTails)[k]).times(1 + weight * (scale - 1))
        .minus(actualRows.filter(r => r.date === asOf).reduce((n, r) => n.plus(r.amount), new Big(0)))));
    } else if (key === "tobacco-vape") {
      method = "CADENCE";
      for (const subcategory of TOBACCO_SUBCATEGORIES) {
        // Rare sub-series may use older closed history, with an explicit LOW confidence.
        let purchases = economicObservations(rows.filter(r => r.subcategory === subcategory)).sort((a, b) => a.date.localeCompare(b.date));
        if (purchases.length < 5) purchases = economicObservations(evidence.history.economicEntries.filter(r => r.subcategory === subcategory && r.date.slice(0, 7) <= end)).sort((a, b) => a.date.localeCompare(b.date));
        const gaps = purchases.slice(1).map((r, i) => Math.max(1, Math.round((Date.parse(r.date) - Date.parse(purchases[i]!.date)) / 86400000)));
        const ticket = quantiles(purchases.map(r => Number(r.amount))), medianGap = gaps.length ? referenceQuantile(gaps, .5) : null;
        cadences.push({ subcategory, medianGapDays: medianGap, support: purchases.length, confidence: purchases.length < 8 ? "LOW" : "MEDIUM" });
        if (purchases.length < 8) { confidence = "LOW"; limitations.add(`${subcategory}_RARE_CADENCE`); }
        if (!gaps.length) continue;
        const last = purchases.at(-1)!.date;
        const rare = purchases.length < 5;
        const exposureDays = Math.max(1, rare
          ? Math.round((Date.parse(`${monthAt(end, 1)}-01`) - Date.parse(`${evidence.history.startMonth}-01`)) / 86400000)
          : months.flatMap(m => remainingMonthDays(m, `${m}-01`)).length);
        const rareRate = Math.min(1, purchases.length / exposureDays);
        let rareSurvival = 1;
        let ages = new Map<number, number>([[Math.max(0, Math.round((Date.parse(`${month}-01`) - Date.parse(last)) / 86400000)) - 1, 1]]);
        for (const date of allDays) {
          const actual = actualRows.filter(r => r.subcategory === subcategory && r.date === date);
          if (actual.length) { ages = new Map([[0, 1]]); rareSurvival = 1; add(date, 1, emptyCostRange(), money(actual.reduce((n, r) => n + Number(r.amount), 0)),
            { kind: actual[0]!.purchaseEventId ? "PURCHASE_EVENT" : "OPERATION", id: actual[0]!.purchaseEventId ?? actual[0]!.operationId }, subcategory); continue; }
          const next = new Map<number, number>(); let p = 0;
          for (const [age, mass] of ages) {
            const eligibleGaps = gaps.filter(g => g > age), hazard = eligibleGaps.length ? eligibleGaps.filter(g => g <= age + 1).length / eligibleGaps.length : 1;
            p += mass * hazard; next.set(0, (next.get(0) ?? 0) + mass * hazard);
            next.set(age + 1, (next.get(age + 1) ?? 0) + mass * (1 - hazard));
          }
          // A pair of purchases two days apart does not establish a permanent two-day
          // cadence. Sparse series forecast one conditional next purchase, bounded by
          // observed exposure. They remain LOW, with no deterministic overdue purchase.
          if (rare) {
            const conditionalAge = [...ages].reduce((n, [age, mass]) => n + (age + 1) * mass, 0);
            const replenishmentGap = Math.max(medianGap ?? 1, exposureDays / purchases.length);
            p = rareSurvival * rareRate * Math.min(1, conditionalAge / replenishmentGap);
            if (!safeToExpire(date, context, requiredSources)) rareSurvival *= 1 - Math.min(1, p / Math.max(rareSurvival, .0001));
          }
          // A proven absence advances age without resetting an imaginary purchase.
          // Uncovered past remains a probabilistic latent renewal, with its cost pending.
          ages = safeToExpire(date, context, requiredSources) || rare
            ? new Map([...ages].map(([age, mass]) => [age + 1, mass])) : next;
          add(date, p, range(k => new Big(ticket[k]).times(p)), "0.00", undefined, subcategory);
        }
      }
    } else if (key === "household-restaurants") {
      const purchases = economicObservations(rows), actualPurchases = economicObservations(actualRows);
      const counts = months.map(m => purchases.filter(r => r.date.startsWith(m)).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0));
      const prices = purchases.filter(r => r.amountStatus !== "PARTIAL").map(r => Number(r.amount) / (r.occurrenceCount ?? 1)), price = quantiles(prices);
      unit = prices.length ? price.central : null;
      const tail = (past: boolean) => months.map(m => purchases.filter(r => r.date.startsWith(m) && allDays.some(d => Number(d.slice(8)) === Number(r.date.slice(8))
        && (past ? d < asOf && !safeToExpire(d, context, requiredSources) : d >= asOf)))
        .reduce((n, r) => n + (r.occurrenceCount ?? 1), 0));
      const actualCount = actualPurchases.reduce((n, r) => n + (r.occurrenceCount ?? 1), 0), monthlyCounts = quantiles(counts);
      const pendingCounts = range(k => positive(new Big(quantiles(tail(true))[k]).minus(actualPurchases.filter(r => r.date < asOf).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0))));
      const weekdayRate = Array.from({ length: 7 }, (_, w) => purchases.filter(r => weekday(r.date) === w).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0)
        / Math.max(1, months.flatMap(m => remainingMonthDays(m, `${m}-01`)).filter(d => weekday(d) === w).length));
      const targetExposure = days.reduce((n, d) => n + weekdayRate[weekday(d)]!, 0);
      const pastExposure = months.length ? months.reduce((n, m) => n + remainingMonthDays(m, `${m}-01`).filter(d => Number(d.slice(8)) >= (context.temporalMode === "FUTURE_MONTH" ? 1 : context.temporalMode === "PAST_MONTH" ? 32 : Number(asOf.slice(8))))
        .reduce((s, d) => s + weekdayRate[weekday(d)]!, 0), 0) / months.length : 0;
      const weekdayAdjustment = pastExposure > 0 ? targetExposure / pastExposure : 1;
      const futureCounts = range(k => positive(new Big(quantiles(tail(false))[k]).times(weekdayAdjustment).minus(actualPurchases.filter(r => r.date === asOf).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0))));
      const remainingCounts = range(k => Math.min(Math.max(0, Number(monthlyCounts[k]) - actualCount), Number(pendingCounts[k]) + Number(futureCounts[k])));
      const pendingShare = Number(pendingCounts.central) / Math.max(.0001, Number(pendingCounts.central) + Number(futureCounts.central));
      basePending = range(k => new Big(remainingCounts[k]).times(pendingShare).times(price[k]));
      baseFuture = range(k => new Big(remainingCounts[k]).times(1 - pendingShare).times(price[k]));
      expectedOccurrences = Object.fromEntries(keys.map(k => [k, Math.max(0, Number(remainingCounts[k]) - slot.habitual.length)])) as NonNullable<RemainingCategory["expectedOccurrences"]>;
      opportunities = Number(remainingCounts.central); probability = counts.length ? counts.filter(n => n > 0).length / counts.length : null;
    } else {
      method = "WORKDAYS";
      const mobility = key === "manon-work-mobility", person = key.startsWith("manon-") ? "Manon" : "Adrien";
      const samples = mobility ? historicalMobility.map(r => Number(r.commute) + Number(r.detour)) : [...byDay(rows).values()];
      const price = quantiles(samples); unit = samples.length ? price.central : null;
      const activeDates = new Set(rows.map(r => r.date));
      const attendance = onsite[person];
      const conditional = mobility ? 1 : key === "manon-work-meals" ? .5 : attendance.size ? [...activeDates].filter(d => attendance.has(d)).length / attendance.size : 0;
      if (key === "manon-work-meals") { confidence = "LOW"; limitations.add("EDENRED_LOW_COVERAGE"); limitations.add("MANON_MEAL_FREQUENCY_UNIDENTIFIED"); }
      probability = Math.min(1, conditional); opportunities = 0;
      for (const date of allDays.filter(d => workday(d) || [...attendance].some(a => weekday(a) === weekday(d))
        || actualRows.some(r => r.date === d) || (mobility && actualMobility.some(r => r.date === d))
        || evidence.explicitWorkSchedule?.some(s => s.date === d && s.person === person))) {
        const historicalWeekdays = months.flatMap(m => remainingMonthDays(m, `${m}-01`)).filter(d => weekday(d) === weekday(date)).length;
        const prior = attendance.size && historicalWeekdays ? [...attendance].filter(d => weekday(d) === weekday(date)).length / historicalWeekdays : person === "Manon" ? 1 : .5;
        const explicit = evidence.explicitWorkSchedule?.find(s => s.date === date && s.person === person);
        const p = (explicit ? explicit.onsite ? 1 : 0 : Math.min(1, prior)) * conditional;
        const actual = mobility ? actualMobility.find(r => r.date === date) : null;
        const actualDay = actualRows.filter(r => r.date === date), fact = actualDay[0];
        const amount = actual ? money(new Big(actual.commute).plus(actual.detour ?? 0)) : money(actualDay.reduce((n, r) => n + Number(r.amount), 0));
        const ref = actual ? { kind: "MOBILITY" as const, id: `commute:${date}` } : fact ? { kind: fact.purchaseEventId ? "PURCHASE_EVENT" as const : "OPERATION" as const, id: fact.purchaseEventId ?? fact.operationId } : undefined;
        const fallbackUnit = unit === null ? Math.max(0, Number(part.central ?? 0) / Math.max(1, allDays.filter(workday).length)) : Number(price.central);
        add(date, p, range(k => (unit === null ? fallbackUnit : Number(price[k])) * p), amount, ref, "", explicit?.onsite === false);
        if (!ref && date >= asOf && !slot.occupied.has(date)) opportunities += p;
      }
      if (mobility) observed = actualMobility.reduce((n, r) => n.plus(r.commute).plus(r.detour ?? 0), new Big(0));
    }
    if (!prior && draftOpportunities.length) {
      basePending = sumCostRanges(draftOpportunities.filter(o => ["PENDING_OBSERVATION", "UNRESOLVED"].includes(o.state)).map(o => o.expectedEconomic));
      baseFuture = sumCostRanges(draftOpportunities.filter(o => o.state === "FUTURE").map(o => o.expectedEconomic));
    }
    if (!prior && key === "household-restaurants" && rows.length < 3) {
      // An older published economic prior is a documented sparse-history fallback,
      // never a learned occurrence count or a fabricated zero-probability estimate.
      method = "PUBLISHED_FALLBACK"; confidence = "LOW"; unit = null;
      expectedOccurrences = null; opportunities = null; probability = null;
      limitations.add("PUBLISHED_SPARSE_HISTORY_PRIOR");
      const unresolved = allDays.some(d => d < asOf && !safeToExpire(d, context, requiredSources));
      const prior = range(k => positive(new Big(part[k] ?? 0).minus(observed)));
      basePending = unresolved ? prior : emptyCostRange();
      baseFuture = unresolved || context.temporalMode === "PAST_MONTH" ? emptyCostRange() : prior;
    }
    baseline = sumCostRanges([basePending, baseFuture]);
    if (rows.length < 3 && key !== "manon-work-mobility") { confidence = "LOW"; limitations.add("HISTORY_SPARSE"); }
    if (rows.some(r => r.amountStatus === "PARTIAL")) { confidence = "LOW"; limitations.add("PURCHASE_AMOUNT_LOWER_BOUND"); }
    // A dated work slot already displaced its exact opportunity. Other slots absorb only remaining compatible capacity.
    const datedCapacity = sumCostRanges(draftOpportunities.filter(o => o.state === "PLANNED").map(o => o.expectedEconomic));
    const datedWorkAbsorption = prior ? range(k => Math.min(Number(baseline[k]), Number(datedCapacity[k]))) : datedCapacity;
    const freeBaseline = prior ? range(k => positive(new Big(baseline[k]).minus(datedWorkAbsorption[k]))) : baseline;
    const baseBeforeSlots = sumCostRanges([freeBaseline, datedWorkAbsorption]);
    const capacity = key === "household-restaurants" && unit !== null ? range(k => new Big(unit!).times(slot.habitual.length)) : habitGross.toFixed(2);
    const undatedHabit = slot.habitual.filter(s => !draftOpportunities.some(o => o.state === "PLANNED" && o.date === s.date));
    const availableAbsorption = typeof capacity === "string" ? undatedHabit.reduce((n, s) => n.plus(s.amount), new Big(0)).toFixed(2) : capacity;
    // big.js has no static min; keep the bound explicit and auditable.
    const absorption = range(k => new Big(datedWorkAbsorption[k]).plus(new Big(freeBaseline[k]).lt(typeof availableAbsorption === "string" ? availableAbsorption : availableAbsorption[k])
      ? freeBaseline[k] : typeof availableAbsorption === "string" ? availableAbsorption : availableAbsorption[k]));
    let remaining = range(k => positive(new Big(baseBeforeSlots[k]).minus(absorption[k])));
    const assumption = assumptions[key];
    if (assumption) remaining = range(k => assumption.mode === "CUSTOM" ? assumption.amount! : new Big(remaining[k]).times(assumption.mode === "LOWER" ? FORECAST_POLICY.lowerFactor : FORECAST_POLICY.higherFactor));
    const horizon = policy.calibrationHorizon(asOf, month);
    const correction = calibration[`${key}:${horizon}`] ?? calibration[key];
    if (!assumption && correction && correction.count >= FORECAST_POLICY.calibrationMonths && correction.horizon === horizon) {
      const central = positive(new Big(remaining.central).plus(correction.bias));
      remaining = { low: money(positive(central.minus(correction.absoluteError))), central: money(central), high: money(central.plus(correction.absoluteError)) };
    }
    if (optional && !correction) remaining = { ...remaining, low: "0.00" };
    const pendingShare = new Big(baseline.central).gt(0) ? Number(basePending.central) / Number(baseline.central) : 0;
    const pending = range(k => new Big(remaining[k]).times(pendingShare));
    const future = range(k => new Big(remaining[k]).minus(pending[k]));
    const declared = slot.habitual.filter(s => s.status === "DECLARED_REALIZED").reduce((n, s) => n.plus(s.amount), new Big(0));
    const planned = habitGross.minus(declared), funding = expectedFunding(key, remaining, rows, months, evidence);
    if (funding.BANK.central === null) limitations.add("EXPECTED_FUNDING_UNKNOWN");
    const counts: Record<keyof OpportunityCounts, number> = { future: 0, planned: 0, pending: 0, observed: 0, expired: 0, cancelled: 0, unresolved: 0 };
    const countKey: Record<OpportunityState, keyof OpportunityCounts> = { FUTURE: "future", PLANNED: "planned", PENDING_OBSERVATION: "pending", OBSERVED: "observed", EXPIRED: "expired", CANCELLED: "cancelled", UNRESOLVED: "unresolved" };
    const resolvedOpportunities = draftOpportunities.map(o => ({ ...o, expectedFunding: key === "manon-work-mobility" ? { BANK: emptyCostRange() } : o.expectedFunding }));
    resolvedOpportunities.forEach(o => counts[countKey[o.state]]++);
    const usual = months.length ? referenceQuantile(months.map(m => rows.filter(r => r.date.startsWith(m) && Number(r.date.slice(8)) < (context.daysElapsed + 1)).reduce((n, r) => n + Number(r.amount), 0)), .5) : null;
    const safe = context.daysElapsed > 0 && requiredSources.every(s => context.coverageBySource[s].safeThrough !== null && context.coverageBySource[s].safeThrough! >= allDays[Math.max(0, context.daysElapsed - 1)]!);
    const ratio = usual && safe ? observed.toNumber() / usual : null;
    return { key, label: part.decisionCapabilities?.label ?? labels[key] ?? key, ...(part.decisionCapabilities ? { decisionCapabilities: part.decisionCapabilities } : {}), method, alreadyRealized: money(observed), observedEconomic: money(observed),
      declaredRealizedEconomic: money(declared), plannedEconomic: money(planned), pendingExpectedEconomic: pending,
      futureExpectedEconomic: future, remainingForecastEconomic: remaining, remaining,
      expiredExpectedEconomic: money(resolvedOpportunities.filter(o => o.state === "EXPIRED").reduce((n, o) => n.plus(o.expectedEconomic.central), new Big(0))), cancelledEconomic: "0.00",
      plannedBankCash: money(slot.habitual.reduce((n, s) => n.plus(s.bank), new Big(0))), remainingForecastBankCash: funding.BANK, expectedFunding: funding,
      projectedMonth: range(k => observed.plus(habitGross).plus(remaining[k])), baselineProvision: range(k => observed.plus(remaining[k]).plus(absorption[k])),
      habitualProjectGross: money(habitGross), habitualPlannedGross: money(planned), habitualDeclaredGross: money(declared), absorbedByHabit: absorption,
      evidenceMonths: months.length, observationCount: key === "manon-work-mobility" ? historicalMobility.length : rows.length,
      usualAtThisPoint: usual === null ? null : money(usual), pace: ratio === null ? null : ratio < .85 ? "BELOW" : ratio <= 1.1 ? "USUAL" : ratio <= 1.3 ? "SLIGHTLY_ABOVE" : "ABOVE",
      shift: null, jointSamples: {}, occurrenceDistribution: key === "household-restaurants" ? occurrenceDistribution(months.map(m => economicObservations(rows.filter(r => r.date.startsWith(m))).length), months.map(() => 1), prior ? 1 : allDays.length ? days.length / allDays.length : 0,
        slot.habitual.length + (prior ? economicObservations(actualRows).reduce((n, r) => n + (r.occurrenceCount ?? 1), 0) : 0)) : null,
      remainingOpportunities: opportunities, probability, expectedOccurrences, conditionalMedianAmount: unit,
      plannedOccurrencesAbsorbingHabit: slot.habitual.length, plannedOccurrencesExtra: slot.extra, confidence,
      opportunityCounts: draftOpportunities.length ? counts : null, opportunities: resolvedOpportunities,
      coverage: { requiredSources, sufficientForExpiration: safe, limitationCodes: [...limitations].sort() }, limitationCodes: [...limitations].sort(),
      ...(cadences.length ? { cadences } : {}),
      explanation: prior ? "L’estimation conserve le budget habituel du mois entier. Seuls les achats observés et les projets explicites remplacent la partie correspondante ; le passage des jours ne crée aucune économie."
        : method === "CUMULATIVE_CURVE" ? "Le reste suit les achats historiques situés après cette date, avec les attentes non observées conservées selon la couverture."
        : method === "CADENCE" ? "Tabac, cannabis et vape suivent chacun leurs délais entre achats ; un achat observé relance sa cadence."
          : method === "WORKDAYS" ? "Chaque journée distingue observation, projet, attente et possibilité future. La présence dépend du jour de semaine observé."
            : "Les sorties restantes dépendent du nombre de sessions, de leur position dans le mois et des projets déjà prévus." } satisfies RemainingCategory;
  });
  const essential = categories.filter(c => reference.necessary.some(p => p.key === c.key)), optional = categories.filter(c => reference.flexible.some(p => p.key === c.key));
  const absorbedByHabit = sumCostRanges(categories.map(c => c.absorbedByHabit));
  const gross = activeExpenses.reduce((n, e) => e.costItems.reduce((s, i) => s.plus(plannedLineGross(i)), n), new Big(0));
  const projectImpact = range(k => gross.minus(absorbedByHabit[k]));
  const essentialProvision = sumCostRanges(essential.map(c => c.baselineProvision)), optionalProvision = sumCostRanges(optional.map(c => c.baselineProvision));
  return { essential, optional, modelVersion: policy.modelVersion, forecastTemporalMode: policy.mode, temporalMode: context.temporalMode, asOfContext: context,
    reconciliation: reconciliation.matches, trainingMonths: months, joint: { method: "CATEGORY_FALLBACK", comparableMonths: months.length,
      low: { essential: essentialProvision.low, optional: optionalProvision.low, impact: projectImpact.low },
      high: { essential: essentialProvision.high, optional: optionalProvision.high, impact: projectImpact.high } },
    essentialProvision, optionalProvision, projectImpact, absorbedByHabit, essentialRemaining: sumCostRanges(essential.map(c => c.remaining)), optionalRemaining: sumCostRanges(optional.map(c => c.remaining)),
    importedEssential: money(essential.reduce((n, c) => n.plus(c.observedEconomic), new Big(0))), importedOptional: money(optional.reduce((n, c) => n.plus(c.observedEconomic), new Big(0))),
    remainingDays: days.length, remainingWorkdays: working.length, observedThrough: evidence.latestObservedBookingDate ?? evidence.observedThrough,
    latestObservedBookingDate: evidence.latestObservedBookingDate ?? evidence.observedThrough,
    currentImportsMissing: context.temporalMode !== "FUTURE_MONTH" && categories.some(c => !c.coverage.sufficientForExpiration),
    limitationCodes: [...new Set([...(evidence.limitationCodes ?? []), ...categories.flatMap(c => c.limitationCodes)])].sort() };
}
