import "server-only";
import Big from "big.js";
import { isAssumedOnsiteWorkday } from "@/domain/phase2/workday-assumption";
import { referenceQuantile, referenceWorkdays, referenceMobilityDays, RESTAURANT_SUBCATEGORIES,
  TOBACCO_SUBCATEGORIES, type EconomicReferenceEntry, type MonthReferenceEvidence, type MonthReferencePlan,
  type MobilityReferenceLeg } from "./month-reference";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import type { MonthDecisionSettings, ForecastCategoryKey } from "@/domain/phase2/month-decision-contract";
import { FORECAST_MODEL_VERSION, FORECAST_POLICY, recentSeries, weightedQuantile, occurrenceDistribution,
  type OccurrenceDistribution, forecastHorizon } from "./forecast-statistics";

export type CostRange = Readonly<{ low: string; central: string; high: string }>;
/** Request-local canonical evidence. Never stored in a prospective row or monthly snapshot. */
export type MonthPredictionEvidence = Readonly<{ history: MonthReferenceEvidence;
  currentEconomicEntries: readonly EconomicReferenceEntry[]; currentMobilityLegs: readonly MobilityReferenceLeg[];
  observedThrough: string | null; personNamesById: Readonly<Record<string, string>>;
  coverageThrough?: string | null; completeMonths?: readonly string[] }>;
export type RemainingCategory = Readonly<{ key: string; label: string; alreadyRealized: string;
  method: "CUMULATIVE_CURVE" | "CADENCE" | "WORKDAYS" | "CONDITIONAL_OCCURRENCES" | "PUBLISHED_FALLBACK";
  evidenceMonths: number; usualAtThisPoint: string | null; pace: "BELOW" | "USUAL" | "SLIGHTLY_ABOVE" | "ABOVE" | null;
  shift: "UP" | "DOWN" | null; occurrenceDistribution: OccurrenceDistribution | null;
  jointSamples: Readonly<Record<string,string>>;
  remaining: CostRange; projectedMonth: CostRange; baselineProvision: CostRange;
  habitualProjectGross: string; absorbedByHabit: CostRange;
  remainingOpportunities: number | null; probability: number | null;
  expectedOccurrences: Readonly<{ low: number; central: number; high: number }> | null;
  conditionalMedianAmount: string | null; plannedOccurrencesAbsorbingHabit: number; plannedOccurrencesExtra: number;
  confidence: "LOW" | "MEDIUM" | "HIGH"; observationCount: number; explanation: string }>;
export type RemainingMonthPrediction = Readonly<{ essential: readonly RemainingCategory[]; optional: readonly RemainingCategory[];
  joint: {method:"EMPIRICAL_MONTHS"|"CATEGORY_FALLBACK"; comparableMonths:number;
    low:{essential:string;optional:string;impact:string};high:{essential:string;optional:string;impact:string}};
  modelVersion: string; temporalMode: "FUTURE_MONTH" | "CURRENT_MONTH" | "PAST_MONTH";
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
const weekday = isAssumedOnsiteWorkday;
export const matchesForecastCategory = (key: string, row: EconomicReferenceEntry): boolean => key === "groceries" ? row.subcategory === "Courses alimentaires"
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
const matches = matchesForecastCategory;
export type ForecastCalibration = Readonly<Partial<Record<string,{bias:string;absoluteError:string;count:number;horizon:string}>>>;

/** V5 remaining forecast. Quantiles use the last six available calendar months; conditional
 * purchases use active days, including zero-occurrence months in their denominator.
 * A root/module is one habitual occurrence, regardless of how many CostItems it has. */
export function forecastRemainingMonth(reference: MonthReferencePlan, evidence: MonthPredictionEvidence,
  asOf: string, expenses: readonly PlannedExpenseScenarioEntry[], assumptions: MonthDecisionSettings["assumptions"] = {},
  calibration: ForecastCalibration = {}): RemainingMonthPrediction {
  const month = reference.targetMonth, days = remainingMonthDays(month, asOf), working = days.filter(weekday);
  const monthDays = remainingMonthDays(month, `${month}-01`).length;
  const temporalMode = asOf.slice(0,7)<month ? "FUTURE_MONTH" as const : asOf.slice(0,7)===month ? "CURRENT_MONTH" as const : "PAST_MONTH" as const;
  const elapsed = temporalMode === "FUTURE_MONTH" ? 0 : temporalMode === "PAST_MONTH" ? monthDays : Number(asOf.slice(8));
  const asOfMonth=asOf.slice(0,7);
  const asOfLastDay=new Date(Date.UTC(Number(asOf.slice(0,4)),Number(asOf.slice(5,7)),0)).getUTCDate();
  const lastCalendarMonth=Number(asOf.slice(8))===asOfLastDay?asOfMonth:monthAt(asOfMonth,-1);
  const historyEnd=evidence.history.endMonth<lastCalendarMonth?evidence.history.endMonth:lastCalendarMonth;
  if(historyEnd<evidence.history.startMonth)throw new TypeError("FORECAST_AS_OF_HISTORY_UNAVAILABLE");
  const recentStart = monthAt(historyEnd, -5);
  const start = recentStart < evidence.history.startMonth ? evidence.history.startMonth : recentStart;
  const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}-01T12:00:00Z`));
  const months: string[] = [];
  for (let cursor = start; cursor <= historyEnd; cursor = monthAt(cursor, 1)) months.push(cursor);
  const historical = evidence.history.economicEntries.filter(r => r.date.slice(0, 7) >= start && r.date.slice(0, 7) <= historyEnd && r.date<=asOf);
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
    const totals=monthlyValues(months,rows), series=recentSeries(totals);
    const usualAtPoint=months.map(m=>rows.filter(r=>r.date.startsWith(m)&&Number(r.date.slice(8))<=elapsed).reduce((n,r)=>n+Number(r.amount),0));
    const expected=weightedQuantile(usualAtPoint,series.weights,.5);
    const jointSamples: Record<string,string>={};
    const actualRows = current.filter(r => matches(key, r));
    const slot = slots(key), habitGross = slot.habitual.reduce((n, s) => n.plus(s.amount), new Big(0));
    const habitualCount = slot.habitual.length;
    let observed = actualRows.reduce((n, r) => n.plus(r.amount), new Big(0));
    let base = zero(), remaining = zero(), opportunities: number | null = null, probability: number | null = null;
    let occurrences: RemainingCategory["expectedOccurrences"] = null, unit: string | null = null;
    let support = rows.length, explanation = "", fallback = false;
    let method: RemainingCategory["method"]="CONDITIONAL_OCCURRENCES", distribution:OccurrenceDistribution|null=null;
    if (key === "manon-work-mobility") {
      method="WORKDAYS";
      const recentLegs = evidence.history.mobilityLegs.filter(l => l.date.slice(0, 7) >= start && l.date.slice(0, 7) <= historyEnd && l.date<=asOf);
      let samples = referenceMobilityDays(recentLegs);
      if (samples.length < 5) { samples = referenceMobilityDays(evidence.history.mobilityLegs.filter(l=>l.date.slice(0,7)<=historyEnd&&l.date<=asOf)); fallback = true; }
      support = samples.length;
      const actual = referenceMobilityDays(evidence.currentMobilityLegs.filter(l => l.date.startsWith(month) && l.date <= asOf));
      observed = actual.reduce((n, d) => n.plus(d.commute).plus(d.detour ?? 0), new Big(0));
      const pending = working.filter(d => !actual.some(a => a.date === d));
      opportunities = pending.length;
      if (samples.length) base = range(s => referenceQuantile(samples.map(d => d.commute + (d.detour ?? 0)), s === "low" ? .25 : s === "central" ? .5 : .75) * pending.length);
      else { base = range(s => new Big(part[s] ?? 0).times(pending.length).div(referenceWorkdays(month) || 1)); fallback = true; }
      remaining = base;
      for(const m of months){const sample=samples.filter(d=>d.date.startsWith(m));jointSamples[m]=money((sample.length?referenceQuantile(sample.map(d=>d.commute+(d.detour??0)),.5):Number(part.central??0)/(referenceWorkdays(month)||1))*pending.length);}
      explanation = `${pending.length} jours ouvrés restants, avec cinq jours sur site par semaine déclarés. Coût médian des trajets canoniques ; usage d’essence, pas un plein payé.${fallback ? " Référence plus ancienne faute de trajets récents suffisants." : ""}`;
    } else if (!optional) {
      // Today's imported purchase resolves today's exposure; never adds another whole day on top.
      const pending = days.filter(d => !actualRows.some(r => r.date === d));
      if (rows.length >= 3 && months.length >= 3) {
        if(key === "groceries") {
          method="CUMULATIVE_CURVE";
          // Retain the empirical shape of each month. Day 15 does not imply 50%.
          const tails=months.map(m=>rows.filter(r=>r.date.startsWith(m)&&Number(r.date.slice(8))>elapsed).reduce((n,r)=>n+Number(r.amount),0));
          const shares=totals.map((total,i)=>total>0?usualAtPoint[i]!/total:0);
          const share=weightedQuantile(shares,series.weights,.5), usual=weightedQuantile(totals,series.weights,.5);
          // A nowcast adjusts only when imports cover the elapsed period.
          const covered=temporalMode==="CURRENT_MONTH" && evidence.coverageThrough != null
            && evidence.coverageThrough>=`${month}-${String(Math.max(1,elapsed)).padStart(2,"0")}`;
          const scale=covered&&share>=.2&&usual>0 ? Math.max(0,(usual+observed.toNumber()/share)/2-observed.toNumber())/(weightedQuantile(tails,series.weights,.5)||1) : 1;
          base=range(s=>weightedQuantile(tails,series.weights,s==="low"?.25:s==="central"?.5:.75)*scale);
          months.forEach((m,i)=>jointSamples[m]=money(tails[i]!*scale));
          explanation="Courbe cumulative des achats comparables : la dépense habituelle à ce stade et le reste observé dans chaque mois sont séparés. Aucun prorata uniforme du calendrier.";
        } else {
          method="CADENCE";
          const purchases=byDay(rows), rates=months.map(m=>[...purchases.keys()].filter(d=>d.startsWith(m)).length/remainingMonthDays(m,`${m}-01`).length);
          const dailyAmounts=[...purchases.values()].map(n=>n.toNumber());
          const priceWeights=[...purchases.keys()].map(date=>series.weights[months.indexOf(date.slice(0,7))]??1);
          const unit=weightedQuantile(dailyAmounts,priceWeights,.5);
          base=range(s=>weightedQuantile(rates,series.weights,s==="low"?.25:s==="central"?.5:.75)*pending.length*weightedQuantile(dailyAmounts,priceWeights,s==="high"?.75:.5));
          months.forEach((m,i)=>jointSamples[m]=money(rates[i]!*pending.length*unit));
          explanation=`Cadence récente d’achat × ${pending.length} jours restants × coût conditionnel médian, avec davantage de poids aux trois derniers mois disponibles.`;
        }
      }
      else { base = range(s => new Big(part[s] ?? 0).times(pending.length).div(monthDays)); fallback = true; }
      remaining = range(s => positive(new Big(base[s]).minus(habitGross)));
      if(fallback) {method="PUBLISHED_FALLBACK";explanation="Peu de recul : référence publiée proratisée, précision réduite. La courbe ou cadence n’est pas identifiable.";}
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
      const olderAmounts = [...byDay(evidence.history.economicEntries.filter(r => r.date.slice(0,7)<=historyEnd&&r.date<=asOf&&matches(key, r))).values()].map(n => n.toNumber());
      const conditional = amounts.length >= 3 ? amounts : olderAmounts;
      const priceWeights=amounts.length>=3?[...purchases.keys()].map(date=>series.weights[months.indexOf(date.slice(0,7))]??1):conditional.map(()=>1);
      const conditionalPrice=(q:number)=>weightedQuantile(conditional,priceWeights,q);
      if (amounts.length < 3) fallback = true;
      unit = conditional.length ? money(conditionalPrice(.5)) : null;
      const unresolvedWorkdays = working.filter(d => !slot.occupied.has(d) && !actualRows.some(r => r.date === d)).length;
      const pendingHabitCount = slot.habitual.filter(s => s.date === null || days.includes(s.date)).length;
      // Occurrence probability is a frequency, not a monthly spending mean.
      // Recent months receive linearly increasing weights; conditional price is median.
      const frequencySeries=recentSeries(rates), weight=frequencySeries.weights.reduce((n,w)=>n+w,0);
      const centralRate = weight ? rates.reduce((n,value,i)=>n+value*frequencySeries.weights[i]!,0)/weight : 0;
      const activeRate = rates.length ? weightedQuantile(rates,frequencySeries.weights,.75) : 0;
      const plausibleActiveRate = Math.max(centralRate, activeRate);
      probability = work && !fallback ? centralRate : null;
      const baseOpportunities = work ? working.filter(d => !actualRows.some(r => r.date === d)).length * presence : opportunities;
      const openOpportunities = work ? unresolvedWorkdays * presence : opportunities;
      const counts = { low: 0, central: Math.max(0, openOpportunities * centralRate - (work ? slot.habitual.filter(s => s.date === null).length : pendingHabitCount)),
        high: Math.max(0, openOpportunities * plausibleActiveRate - (work ? slot.habitual.filter(s => s.date === null).length : pendingHabitCount)) };
      occurrences = counts;
      opportunities = openOpportunities;
      if (conditional.length >= 3 && months.length >= 3) {
        const purchaseCounts=months.map(m=>[...purchases.keys()].filter(d=>d.startsWith(m)).length);
        const fullOpportunities=work?months.reduce((n,m)=>n+referenceWorkdays(m)*presence,0)/months.length:1;
        distribution=occurrenceDistribution(purchaseCounts,frequencySeries.weights,openOpportunities/(fullOpportunities||1),work?slot.habitual.filter(s=>s.date===null).length:pendingHabitCount);
        months.forEach((m,i)=>jointSamples[m]=money(rates[i]!*baseOpportunities*conditionalPrice(.5)));
        base = { low: "0.00", central: money(baseOpportunities * centralRate * conditionalPrice(.5)),
          high: money(baseOpportunities * plausibleActiveRate * conditionalPrice(.75)) };
        remaining = { low: "0.00", central: money(counts.central * conditionalPrice(.5)), high: money(counts.high * conditionalPrice(.75)) };
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
    const assumption=assumptions[key as ForecastCategoryKey];
    if(assumption){
      const original=new Big(base.central), custom=assumption.mode==="CUSTOM";
      const target=custom?positive(new Big(assumption.amount!).minus(observed)):original.times(assumption.mode==="LOWER"?FORECAST_POLICY.lowerFactor:FORECAST_POLICY.higherFactor);
      const factor=original.gt(0)?target.div(original):new Big(0);
      base=custom?range(()=>target):range(s=>new Big(base[s]).times(factor));
      remaining=custom?range(()=>positive(target.minus(habitGross))):range(s=>new Big(remaining[s]).times(factor));
      for(const m of months)jointSamples[m]=custom?money(target):money(new Big(jointSamples[m]??base.central).times(factor));
      if(optional){
        if(custom){occurrences=null;probability=null;distribution=null;}
        else if(occurrences){
          const cap=key==="household-restaurants"?Infinity:opportunities??0;
          occurrences={low:0,central:Math.min(cap,occurrences.central*factor.toNumber()),high:Math.min(cap,occurrences.high*factor.toNumber())};
          // A stronger month assumption cannot invent more workday opportunities.
          remaining={low:"0.00",central:money(occurrences.central*Number(unit??0)),high:money(occurrences.high*Number(unit??0))};
          distribution=null; // The empirical mixture describes history, not this changed intention.
        }
      }
      explanation+=" Hypothèse explicite de ce mois uniquement ; les observations et les habitudes des mois suivants restent inchangées.";
    }
    const calibrated=calibration[`${key}:${forecastHorizon(asOf,month)}`];
    if(!assumption && calibrated && calibrated.count>=FORECAST_POLICY.calibrationMonths && days.length){
      const bias=new Big(calibrated.bias), error=new Big(calibrated.absoluteError);
      const centralBase=positive(new Big(base.central).plus(bias));
      const centralRemaining=positive(new Big(remaining.central).plus(bias));
      base=range(s=>positive(centralBase.plus(s==="low"?error.neg():s==="high"?error:0)));
      remaining=range(s=>positive(centralRemaining.plus(s==="low"?error.neg():s==="high"?error:0)));
      for(const m of months)jointSamples[m]=money(positive(new Big(jointSamples[m]??base.central).plus(bias)));
      if(optional){base={...base,low:"0.00"};remaining={...remaining,low:"0.00"};}
      explanation+=` Intervalle recalibré sur ${calibrated.count} erreurs de mois terminés au même horizon.`;
    }
    if(!days.length){base=zero();remaining=zero();occurrences=optional?{low:0,central:0,high:0}:null;for(const m of months)jointSamples[m]="0.00";}
    const pace=temporalMode==="CURRENT_MONTH"&&elapsed>0&&expected>0&&!optional&&key!=="manon-work-mobility"
      && (evidence.coverageThrough??"")>=`${month}-${String(elapsed).padStart(2,"0")}`
      ? observed.toNumber()<expected*.8?"BELOW" as const:observed.toNumber()<=expected*1.1?"USUAL" as const:observed.toNumber()<=expected*1.3?"SLIGHTLY_ABOVE" as const:"ABOVE" as const:null;
    if(series.shift)explanation+=" Les trois derniers mois disponibles diffèrent durablement de l’historique précédent ; leur poids est renforcé.";
    const absorbed = range(s => new Big(base[s]).minus(remaining[s]));
    // The provision retains the covered portion of the habitual estimate. This is
    // essential when displaying a marginal project impact rather than its gross.
    const provision = range(s => observed.plus(base[s]));
    return { key, label: labels[key] ?? key, alreadyRealized: money(observed), remaining,
      method,evidenceMonths:months.length,usualAtThisPoint:optional||key==="manon-work-mobility"?null:money(expected),pace,shift:series.shift,occurrenceDistribution:distribution,jointSamples,
      projectedMonth: range(s => observed.plus(habitGross).plus(remaining[s])), baselineProvision: provision,
      habitualProjectGross: money(habitGross), absorbedByHabit: absorbed, remainingOpportunities: opportunities, probability,
      expectedOccurrences: occurrences, conditionalMedianAmount: unit, plannedOccurrencesAbsorbingHabit: habitualCount,
      plannedOccurrencesExtra: slot.extra, confidence: fallback || support < 5 ? "LOW" as const : support < 20 ? "MEDIUM" as const : "HIGH" as const,
      observationCount: support, explanation: `${explanation} Observations disponibles de ${monthLabel(start)} à ${monthLabel(historyEnd)}.` };
  });
  const essential = categories.filter(c => reference.necessary.some(p => p.key === c.key));
  const optional = categories.filter(c => reference.flexible.some(p => p.key === c.key));
  const extra = expenses.flatMap(e => e.costItems).filter(i => i.baselineKey === null).reduce((n, i) => n.plus(plannedLineGross(i)), new Big(0));
  const absorbed = sum(categories.map(c => c.absorbedByHabit));
  const grossHabit = categories.reduce((n, c) => n.plus(c.habitualProjectGross), new Big(0));
  const essentialProvision=sum(essential.map(c=>c.baselineProvision)),optionalProvision=sum(optional.map(c=>c.baselineProvision));
  const projectImpact=range(s=>extra.plus(grossHabit).minus(absorbed[s]));
  const fallback=(s:"low"|"high")=>({essential:essentialProvision[s],optional:optionalProvision[s],impact:projectImpact[s]});
  let joint:RemainingMonthPrediction["joint"]={method:"CATEGORY_FALLBACK",comparableMonths:0,low:fallback("low"),high:fallback("high")};
  const comparable=months.filter(m=>categories.every(c=>c.jointSamples[m]!==undefined));
  if(comparable.length>=FORECAST_POLICY.minimumMonths){
    const samples=comparable.map(m=>{
      let necessary=new Big(0),flexible=new Big(0),displaced=new Big(0);
      for(const c of categories){
        const base=new Big(c.jointSamples[m]!), reference=new Big(c.baselineProvision.central).minus(c.alreadyRealized);
        const pending=optional.includes(c)?reference.gt(0)?base.times(new Big(c.remaining.central).div(reference)):new Big(0)
          :positive(base.minus(c.habitualProjectGross));
        displaced=displaced.plus(base.minus(pending));
        if(essential.includes(c))necessary=necessary.plus(c.alreadyRealized).plus(base);else flexible=flexible.plus(c.alreadyRealized).plus(base);
      }
      const impact=extra.plus(grossHabit).minus(displaced);
      return {month:m,essential:money(necessary),optional:money(flexible),impact:money(impact),total:necessary.plus(flexible).plus(impact).toNumber()};
    }).sort((a,b)=>a.total-b.total||a.month.localeCompare(b.month));
    const centralTotal=Number(essentialProvision.central)+Number(optionalProvision.central)+Number(projectImpact.central);
    const centralSample={essential:essentialProvision.central,optional:optionalProvision.central,impact:projectImpact.central};
    // Select whole observed combinations, retaining co-occurrence. Only bracket
    // the robust central; category maxima are never stacked into a worst case.
    const low=samples[Math.floor((samples.length-1)*.25)]!, high=samples[Math.ceil((samples.length-1)*.75)]!;
    joint={method:"EMPIRICAL_MONTHS",comparableMonths:comparable.length,
      low:low.total<=centralTotal?low:centralSample,high:high.total>=centralTotal?high:centralSample};
  }
  return { essential, optional,joint,modelVersion:FORECAST_MODEL_VERSION,temporalMode,essentialProvision,optionalProvision,
    essentialRemaining: sum(essential.map(c => c.remaining)), optionalRemaining: sum(optional.map(c => c.remaining)),
    importedEssential: money(essential.reduce((n, c) => n.plus(c.alreadyRealized), new Big(0))),
    importedOptional: money(optional.reduce((n, c) => n.plus(c.alreadyRealized), new Big(0))),
    projectImpact, absorbedByHabit: absorbed,
    remainingDays: days.length, remainingWorkdays: working.length, observedThrough: evidence.observedThrough,
    currentImportsMissing: temporalMode!=="FUTURE_MONTH" && (evidence.coverageThrough??"") < (temporalMode==="PAST_MONTH"?`${month}-${String(monthDays).padStart(2,"0")}`:asOf) };
}
