import "server-only";
import Big from "big.js";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import type { MonthEconomicPlan } from "./month-scenario";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import { comparableForecastCheckpoints, explainForecastChange, type ForecastCheckpoint } from "./forecast-memory";

/** Reconcile display rounding against a rounded milestone, deterministically.
 * These presentation terms never feed back into the economic calculation. */
export function roundedParts(parts: readonly { key: string; label: string; amount: string }[], target: number) {
  const rounded = parts.map(p => ({ ...p, visible: Math.round(Number(p.amount)) }));
  let residual = target - rounded.reduce((sum, p) => sum + p.visible, 0);
  if (residual && !rounded.length) throw new TypeError("DISPLAY_ROUNDING_EMPTY");
  while (residual) {
    const direction = Math.sign(residual);
    const candidates = [...rounded].sort((a, b) => direction * ((Number(b.amount) - b.visible) - (Number(a.amount) - a.visible)) || a.key.localeCompare(b.key));
    candidates[0]!.visible += direction; residual -= direction;
  }
  return rounded;
}

export function projectMonthDecision(plan: MonthEconomicPlan, settings: MonthDecisionSettings, targetMonth: string,
  asOf: string, expenses: readonly PlannedExpenseScenarioEntry[], memory: readonly ForecastCheckpoint[] = []) {
  const prediction = plan.narrative.prediction;
  const mode = targetMonth > asOf.slice(0, 7) ? "FUTURE_MONTH" : targetMonth < asOf.slice(0, 7) ? "PAST_MONTH" : "CURRENT_MONTH";
  const afterCertain = Math.round(Number(plan.afterCertainOutflows)), afterProjects = Math.round(Number(plan.narrative.remainderAfterProjects));
  const afterEssential = Math.round(Number(plan.narrative.remainderAfterEssential.central)), final = Math.round(Number(plan.narrative.final.central));
  const essentialDelta = afterProjects - afterEssential, optionalDelta = afterEssential - final;
  const breakdown = (optional: boolean, total: number) => roundedParts((optional ? prediction?.optional : prediction?.essential)?.map(c => ({
    key: c.key, label: c.label, amount: c.remainingForecastEconomic.central,
  })) ?? [{ key: "reference", label: "Référence publiée", amount: String(total) }], total);
  const essentialParts = breakdown(false, essentialDelta), optionalParts = breakdown(true, optionalDelta);
  const categoryDisplay = Object.fromEntries([...(prediction?.essential ?? []), ...(prediction?.optional ?? [])].map(c => {
    const part = [...essentialParts, ...optionalParts].find(p => p.key === c.key)!;
    const projectedCentral = Math.round(Number(c.projectedMonth.central));
    const amounts = { observed: c.observedEconomic, declared: c.declaredRealizedEconomic,
      planned: c.plannedEconomic, pending: c.pendingExpectedEconomic.central, future: c.futureExpectedEconomic.central };
    const terms = roundedParts(Object.entries(amounts).filter(([, amount]) => new Big(amount).gt(0))
      .map(([key, amount]) => ({ key, label: key, amount })), projectedCentral);
    const term = (key: string) => terms.find(t => t.key === key)?.visible ?? 0;
    const central = part.visible;
    return [c.key, { remaining: { low: Math.min(Math.round(Number(c.remaining.low)), central), central,
      high: Math.max(Math.round(Number(c.remaining.high)), central) }, observed: term("observed"), declared: term("declared"),
      planned: term("planned"), pending: term("pending"), future: term("future"), counts: c.opportunityCounts, projectedCentral }];
  }));
  const change = explainForecastChange(plan, memory, targetMonth);
  const last = comparableForecastCheckpoints(memory, targetMonth).at(-1);
  const changeTarget = last ? final - Math.round(Number(last.payload.final.central)) : 0;
  const visibleChanges = roundedParts(change.changes.map(c => ({ key: c.key, label: c.label, amount: c.delta })), changeTarget);
  const attention: { key: string; message: string; href: string }[] = [];
  if (expenses.some(e => e.status === "PLANNED" && e.plannedDate != null && e.plannedDate < asOf)) attention.push({
    key: "past-plan", message: "Une dépense prévue à une date passée attend encore votre confirmation.", href: "#planned-expense-title" });
  for (const [label, pocket] of [["Swile", plan.plannedFunding.swile], ["Edenred", plan.plannedFunding.edenred]] as const) {
    const resource = new Big(pocket.resource), committed = new Big(pocket.reserved).plus(pocket.usedDeclared);
    if (new Big(pocket.shortfall).gt(0) || (resource.gt(0) && committed.gte(resource.times(.9)))) attention.push({
      key: label, message: `${label} : ${new Big(pocket.shortfall).gt(0) ? "affectation supérieure à la ressource déclarée" : "au moins 90 % de la ressource déjà affectée"}.`, href: "#meal-funding" });
  }
  for (const c of prediction?.essential ?? []) if (c.pace === "ABOVE") attention.push({ key: c.key,
    message: `${c.label} : les achats observés dépassent de plus de 30 % le rythme habituel à ce stade.`, href: "#necessary-title" });
  if (last && Math.abs(Number(change.delta)) > Math.max(50, Math.abs(Number(last.payload.final.central)) * .1)) attention.push({
    key: "revision", message: "La projection a changé sensiblement depuis la dernière estimation conservée.", href: "#forecast-history" });
  const exactGoal = settings.goal === null ? null : {
    goal: settings.goal,
    lowConsumption: new Big(plan.narrative.final.lowConsumption).minus(settings.goal).toFixed(2),
    central: new Big(plan.narrative.final.central).minus(settings.goal).toFixed(2),
    highConsumption: new Big(plan.narrative.final.highConsumption).minus(settings.goal).toFixed(2),
  };
  return { mode, asOf, showProjectMilestone: !new Big(plan.plannedExpenses.netImpact.central ?? 0).eq(0),
    visible: { afterCertain, afterProjects, afterEssential, final, projectDelta: afterCertain - afterProjects,
      essentialDelta, optionalDelta, essential: essentialParts, optional: optionalParts, categoryDisplay,
      essentialTotal: essentialDelta, optionalTotal: optionalDelta },
    change: { ...change, visibleDelta: changeTarget, visibleChanges }, attention, goal: exactGoal,
    mealFundingVisible: [plan.plannedFunding.swile, plan.plannedFunding.edenred].some(p => new Big(p.reserved).plus(p.usedDeclared).plus(p.shortfall).gt(0)),
    jointExplanation: prediction?.joint.method === "EMPIRICAL_MONTHS"
      ? `Combinaisons observées dans ${prediction.joint.comparableMonths} mois comparables, avec leurs dépenses simultanées. Les montants hauts des catégories ne sont pas additionnés.`
      : "Estimation économique restante, avec les attentes non observées. Les fourchettes restent exploratoires tant que les erreurs par horizon ne sont pas suffisamment calibrées.",
  };
}
export type MonthDecisionProjection = ReturnType<typeof projectMonthDecision>;
