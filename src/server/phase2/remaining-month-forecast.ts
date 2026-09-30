import "server-only";
import Big from "big.js";
import { referenceQuantile, referenceWorkdays, referenceMobilityDays, RESTAURANT_SUBCATEGORIES,
  TOBACCO_SUBCATEGORIES, type EconomicReferenceEntry, type MonthReferenceEvidence, type MonthReferencePlan,
  type MobilityReferenceLeg } from "./month-reference";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { plannedLineGross } from "@/domain/phase2/planned-money";

export type CostRange = Readonly<{ low: string; central: string; high: string }>;
/** Request-local canonical evidence. Never stored in a prospective row or monthly snapshot. */
export type MonthPredictionEvidence = Readonly<{ history: MonthReferenceEvidence;
  currentEconomicEntries: readonly EconomicReferenceEntry[]; currentMobilityLegs: readonly MobilityReferenceLeg[];
  observedThrough: string | null; personNamesById: Readonly<Record<string, string>> }>;
export type RemainingCategory = Readonly<{ key: string; label: string; alreadyRealized: string;
  remaining: CostRange; projectedMonth: CostRange; baselineProvision: CostRange;
  habitualProjectGross: string; absorbedByHabit: CostRange;
  remainingOpportunities: number | null; probability: number | null;
  expectedOccurrences: Readonly<{ low: number; central: number; high: number }> | null;
  conditionalMedianAmount: string | null; plannedOccurrencesAbsorbingHabit: number; plannedOccurrencesExtra: number;
  confidence: "LOW" | "MEDIUM" | "HIGH"; observationCount: number; explanation: string }>;
export type RemainingMonthPrediction = Readonly<{ essential: readonly RemainingCategory[]; optional: readonly RemainingCategory[];
  essentialProvision: CostRange; optionalProvision: CostRange; projectImpact: CostRange; absorbedByHabit: CostRange;
  essentialRemaining: CostRange; optionalRemaining: CostRange; importedEssential: string; importedOptional: string;
  remainingDays: number; remainingWorkdays: number; observedThrough: string | null; currentImportsMissing: boolean }>;

const keys = ["low", "central", "high"] as const;
const zero = (): CostRange => ({ low: "0.00", central: "0.00", high: "0.00" });
const money = (n: Big | number) => new Big(n).round(2).toFixed(2);
const range = (fn: (key: typeof keys[number]) => Big | number): CostRange =>
  Object.fromEntries(keys.map(key => [key, money(fn(key))])) as CostRange;
const sum = (rows: readonly CostRange[]) => range(key => rows.reduce((n, row) => n.plus(row[key]), new Big(0)));
const positive = (n: Big) => n.gt(0) ? n : new Big(0);
const monthAt = (month: string, delta: number) => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7); };
export function remainingMonthDays(month: string, asOf: string) {
  const [year, m] = month.split("-").map(Number), count = new Date(Date.UTC(year!, m!, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(date => date >= asOf);
}
const weekday = (date: string) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
const matches = (key: string, row: EconomicReferenceEntry): boolean => key === "groceries" ? row.subcategory === "Courses alimentaires"
  : key === "tobacco-vape" ? TOBACCO_SUBCATEGORIES.some(s => s === row.subcategory)
    : key === "household-restaurants" ? RESTAURANT_SUBCATEGORIES.some(s => s === row.subcategory)
      : key === "adrien-work-coffee" ? row.subcategory === "Café au travail"
        : row.subcategory === "Boulangerie" && row.preciseType === "Repas du midi au travail"
          && row.person === (key === "manon-work-meals" ? "Manon" : "Adrien");
const labels: Record<string, string> = { groceries: "Courses", "tobacco-vape": "Tabac & vape",
  "manon-work-mobility": "Trajets travail · Manon", "adrien-work-meals": "Repas travail · Adrien",
  "manon-work-meals": "Repas travail · Manon", "adrien-work-coffee": "Café travail · Adrien",
  "household-restaurants": "Restaurants du foyer" };
const monthlyValues = (months: readonly string[], rows: readonly EconomicReferenceEntry[]) => months.map(month =>
  rows.filter(r => r.date.startsWith(month)).reduce((n, r) => n.plus(r.amount), new Big(0)).toNumber());
const byDay = (rows: readonly EconomicReferenceEntry[]) => {
  const days = new Map<string, Big>();
  for (const row of rows) days.set(row.date, (days.get(row.date) ?? new Big(0)).plus(row.amount));
  return days;
};

/** V4 remaining forecast. Quantiles use the last six covered months; conditional
 * purchases use active days, including zero-occurrence months in their denominator.
 * A root/module is one habitual occurrence, regardless of how many CostItems it has. */
export function forecastRemainingMonth(reference: MonthReferencePlan, evidence: MonthPredictionEvidence,
  asOf: string, expenses: readonly PlannedExpenseScenarioEntry[]): RemainingMonthPrediction {
  const month = reference.targetMonth, days = remainingMonthDays(month, asOf), working = days.filter(weekday);
  const monthDays = remainingMonthDays(month, `${month}-01`).length;
  const recentStart = monthAt(evidence.history.endMonth, -5);
  const start = recentStart < evidence.history.startMonth ? evidence.history.startMonth : recentStart;
  const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}-01T12:00:00Z`));
  const months: string[] = [];
  for (let cursor = start; cursor <= evidence.history.endMonth; cursor = monthAt(cursor, 1)) months.push(cursor);
  const historical = evidence.history.economicEntries.filter(r => r.date.slice(0, 7) >= start && r.date.slice(0, 7) <= evidence.history.endMonth);
  const current = evidence.currentEconomicEntries.filter(r => r.date.startsWith(month) && r.date <= asOf);
  const slots = (key: string) => {
    const habitual = new Map<string, { date: string | null; amount: Big }>(), extra = new Set<string>(), occupied = new Set<string>();
    for (const expense of expenses) for (const item of expense.costItems) {
      const module = item.modulePath?.at(-1), path = item.modulePath?.join("/") ?? "root";
      const identity = `${expense.id}:${path}`;
      const baseline = item.baselineKey === key;
      const mealPerson = key === "manon-work-meals" ? "Manon" : key === "adrien-work-meals" ? "Adrien" : null;
      const refs = [...(expense.context?.participantPersonIds ?? []), ...(expense.context?.participantRefs ?? [])
        .flatMap(ref => ref.kind === "HOUSEHOLD_PERSON" ? [ref.personId] : [])];
      const samePersonMeal = module === "work_meal" && mealPerson !== null
        && refs.some(id => evidence.personNamesById[id] === mealPerson);
      if (baseline) {
        const previous = habitual.get(identity);
        habitual.set(identity, { date: expense.plannedDate ?? null,
          amount: (previous?.amount ?? new Big(0)).plus(plannedLineGross(item)) });
      } else if ((key === "household-restaurants" && ["restaurant", "fast_food"].includes(module ?? "")) || samePersonMeal) extra.add(identity);
      // A specifically dated work meal occupies that person's slot even if it is an extra.
      if ((baseline || samePersonMeal) && mealPerson && expense.plannedDate && working.includes(expense.plannedDate)) occupied.add(expense.plannedDate);
    }
    return { habitual: [...habitual.values()], extra: extra.size, occupied };
  };
  const categories = [...reference.necessary, ...reference.flexible].map(part => {
    const optional = reference.flexible.some(p => p.key === part.key), key = part.key;
    const rows = historical.filter(r => matches(key, r));
    const actualRows = current.filter(r => matches(key, r));
    const slot = slots(key), habitGross = slot.habitual.reduce((n, s) => n.plus(s.amount), new Big(0));
    const habitualCount = slot.habitual.length;
    let observed = actualRows.reduce((n, r) => n.plus(r.amount), new Big(0));
    let base = zero(), remaining = zero(), opportunities: number | null = null, probability: number | null = null;
    let occurrences: RemainingCategory["expectedOccurrences"] = null, unit: string | null = null;
    let support = rows.length, explanation = "", fallback = false;
    if (key === "manon-work-mobility") {
      const recentLegs = evidence.history.mobilityLegs.filter(l => l.date.slice(0, 7) >= start && l.date.slice(0, 7) <= evidence.history.endMonth);
      let samples = referenceMobilityDays(recentLegs);
      if (samples.length < 5) { samples = referenceMobilityDays(evidence.history.mobilityLegs); fallback = true; }
      support = samples.length;
      const actual = referenceMobilityDays(evidence.currentMobilityLegs.filter(l => l.date.startsWith(month) && l.date <= asOf));
      observed = actual.reduce((n, d) => n.plus(d.commute).plus(d.detour ?? 0), new Big(0));
      const pending = working.filter(d => !actual.some(a => a.date === d));
      opportunities = pending.length;
      if (samples.length) base = range(s => referenceQuantile(samples.map(d => d.commute + (d.detour ?? 0)), s === "low" ? .25 : s === "central" ? .5 : .75) * pending.length);
      else { base = range(s => new Big(part[s] ?? 0).times(pending.length).div(referenceWorkdays(month) || 1)); fallback = true; }
      remaining = base;
      explanation = `${pending.length} jours ouvrés restants, avec cinq jours sur site par semaine déclarés. Coût médian des trajets canoniques ; usage d’essence, pas un plein payé.${fallback ? " Référence plus ancienne faute de trajets récents suffisants." : ""}`;
    } else if (!optional) {
      const daily = monthlyValues(months, rows).map((value, i) => value / remainingMonthDays(months[i]!, `${months[i]}-01`).length);
      // Today's imported purchase resolves today's exposure; never adds another whole day on top.
      const pending = days.filter(d => !actualRows.some(r => r.date === d));
      if (rows.length >= 3 && months.length >= 3) base = range(s => referenceQuantile(daily, s === "low" ? .25 : s === "central" ? .5 : .75) * pending.length);
      else { base = range(s => new Big(part[s] ?? 0).times(pending.length).div(monthDays)); fallback = true; }
      remaining = range(s => positive(new Big(base[s]).minus(habitGross)));
      explanation = `${pending.length} jours encore à couvrir. Rythme des ${months.length} mois récents disponibles, médiane et bornes plausibles ; les courses habituelles déjà prévues couvrent d’abord cette estimation.${fallback ? " Peu de recul : référence publiée proratisée, précision réduite." : ""}`;
    } else {
      const purchases = byDay(rows), amounts = [...purchases.values()].map(n => n.toNumber());
      support = purchases.size;
      const work = key !== "household-restaurants";
      const presence = key.startsWith("adrien-") ? .5 : 1;
      opportunities = work ? working.length * presence : days.length / monthDays;
      const exposure = work ? months.reduce((n, m) => n + referenceWorkdays(m) * presence, 0) : months.length;
      const rates = months.map(m => {
        const active = [...purchases.keys()].filter(d => d.startsWith(m)).length;
        return work ? Math.min(1, active / (referenceWorkdays(m) * presence || 1)) : active;
      });
      probability = work && exposure > 0 ? Math.min(1, purchases.size / exposure) : null;
      const olderAmounts = [...byDay(evidence.history.economicEntries.filter(r => matches(key, r))).values()].map(n => n.toNumber());
      const conditional = amounts.length >= 3 ? amounts : olderAmounts;
      if (amounts.length < 3) fallback = true;
      unit = conditional.length ? money(referenceQuantile(conditional, .5)) : null;
      const unresolvedWorkdays = working.filter(d => !slot.occupied.has(d) && !actualRows.some(r => r.date === d)).length;
      const pendingHabitCount = slot.habitual.filter(s => s.date === null || days.includes(s.date)).length;
      // Occurrence probability is a frequency, not a monthly spending mean.
      // Recent months receive linearly increasing weights; conditional price is median.
      const weight = rates.reduce((n, _, i) => n + i + 1, 0);
      const centralRate = weight ? rates.reduce((n, value, i) => n + value * (i + 1), 0) / weight : 0;
      const activeRate = rates.length ? referenceQuantile(rates, .75) : 0;
      const plausibleActiveRate = Math.max(centralRate, activeRate);
      probability = work && !fallback ? centralRate : null;
      const baseOpportunities = work ? working.filter(d => !actualRows.some(r => r.date === d)).length * presence : opportunities;
      const openOpportunities = work ? unresolvedWorkdays * presence : opportunities;
      const counts = { low: 0, central: Math.max(0, openOpportunities * centralRate - (work ? slot.habitual.filter(s => s.date === null).length : pendingHabitCount)),
        high: Math.max(0, openOpportunities * plausibleActiveRate - (work ? slot.habitual.filter(s => s.date === null).length : pendingHabitCount)) };
      occurrences = counts;
      opportunities = openOpportunities;
      if (conditional.length >= 3 && months.length >= 3) {
        base = { low: "0.00", central: money(baseOpportunities * centralRate * referenceQuantile(conditional, .5)),
          high: money(baseOpportunities * plausibleActiveRate * referenceQuantile(conditional, .75)) };
        remaining = { low: "0.00", central: money(counts.central * referenceQuantile(conditional, .5)), high: money(counts.high * referenceQuantile(conditional, .75)) };
        if (fallback) occurrences = null;
      } else {
        // No fabricated probability or frequency for sparse evidence. Published robust
        // ranges remain the cautious fallback, reduced by habitual monetary coverage.
        fallback = true; probability = null; occurrences = null;
        // For an extremely small conditional sample, keep published central as a
        // conservative anchor and use a robust conditional quartile when available.
        // Never replay the legacy coffee maximum as an active scenario bound.
        const safeHigh = key === "adrien-work-coffee" ? part.central ?? "0" : part.high ?? "0";
        base = { low: "0.00", central: money(new Big(part.central ?? 0).times(days.length).div(monthDays)),
          high: money(new Big(safeHigh).times(days.length).div(monthDays)) };
        remaining = range(s => positive(new Big(base[s]).minus(habitGross)));
      }
      explanation = work
        ? `${working.length} jours ouvrés restants ; présence déclarée ${key.startsWith("adrien-") ? "de deux à trois jours" : "de cinq jours"} par semaine. Fréquence des achats sur des jours comparables et coût médian lorsqu’ils ont lieu. ${slot.occupied.size} jour(s) déjà occupé(s) par un repas prévu.`
        : `Fréquence des sorties sur les ${months.length} mois récents disponibles × part du mois restante × coût médian d’une sortie. ${habitualCount} projet(s) habituel(s) ; ${slot.extra} projet(s) en plus, qui ne réduisent pas cette fréquence.`;
      if (key === "adrien-work-coffee") explanation += " L’attribution des cafés à Adrien est déclarée, pas portée par les opérations.";
      if (fallback) explanation += " Peu d’observations récentes : coût conditionnel issu d’une référence plus ancienne ou estimation prudente. Aucune probabilité ni fréquence précise n’est affichée.";
    }
    const absorbed = range(s => new Big(base[s]).minus(remaining[s]));
    // The provision retains the covered portion of the habitual estimate. This is
    // essential when displaying a marginal project impact rather than its gross.
    const provision = range(s => observed.plus(base[s]));
    return { key, label: labels[key] ?? key, alreadyRealized: money(observed), remaining,
      projectedMonth: range(s => observed.plus(habitGross).plus(remaining[s])), baselineProvision: provision,
      habitualProjectGross: money(habitGross), absorbedByHabit: absorbed, remainingOpportunities: opportunities, probability,
      expectedOccurrences: occurrences, conditionalMedianAmount: unit, plannedOccurrencesAbsorbingHabit: habitualCount,
      plannedOccurrencesExtra: slot.extra, confidence: fallback || support < 5 ? "LOW" as const : support < 20 ? "MEDIUM" as const : "HIGH" as const,
      observationCount: support, explanation: `${explanation} Observations disponibles de ${monthLabel(start)} à ${monthLabel(evidence.history.endMonth)}.` };
  });
  const essential = categories.filter(c => reference.necessary.some(p => p.key === c.key));
  const optional = categories.filter(c => reference.flexible.some(p => p.key === c.key));
  const extra = expenses.flatMap(e => e.costItems).filter(i => i.baselineKey === null).reduce((n, i) => n.plus(plannedLineGross(i)), new Big(0));
  const absorbed = sum(categories.map(c => c.absorbedByHabit));
  const grossHabit = categories.reduce((n, c) => n.plus(c.habitualProjectGross), new Big(0));
  return { essential, optional, essentialProvision: sum(essential.map(c => c.baselineProvision)), optionalProvision: sum(optional.map(c => c.baselineProvision)),
    essentialRemaining: sum(essential.map(c => c.remaining)), optionalRemaining: sum(optional.map(c => c.remaining)),
    importedEssential: money(essential.reduce((n, c) => n.plus(c.alreadyRealized), new Big(0))),
    importedOptional: money(optional.reduce((n, c) => n.plus(c.alreadyRealized), new Big(0))),
    projectImpact: range(s => extra.plus(grossHabit).minus(absorbed[s])), absorbedByHabit: absorbed,
    remainingDays: days.length, remainingWorkdays: working.length, observedThrough: evidence.observedThrough,
    currentImportsMissing: asOf.slice(0, 7) >= month && (evidence.observedThrough === null || evidence.observedThrough.slice(0, 7) < month) };
}
