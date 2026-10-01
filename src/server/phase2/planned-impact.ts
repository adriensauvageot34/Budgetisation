import "server-only";
import Big from "big.js";
import type { MonthEconomicPlan } from "./month-scenario";
import type { PlannedExpenseDraft } from "@/domain/phase2/planned-contract";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";

/** Display projection only. The scenario delta, rather than a separate cost-minus-baseline engine,
 * is the authority for the additional impact. Caller supplies a before-plan excluding the edited ID. */
export function projectPlannedExpenseImpact(before: MonthEconomicPlan, after: MonthEconomicPlan, draft: PlannedExpenseDraft) {
  const scenarios = ["low", "central", "high"] as const;
  const scenarioKey = { low: "lowConsumption", central: "central", high: "highConsumption" } as const;
  const gross = draft.costItems.reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0));
  const fuel = draft.costItems.filter((item) => costItemCashTreatment(item) === "ECONOMIC_ONLY")
    .reduce((sum, item) => sum.plus(plannedLineGross(item)), new Big(0));
  const netAdditionalImpact = Object.fromEntries(scenarios.map((key) => [key,
    new Big(before.scenarios[scenarioKey[key]]).minus(after.scenarios[scenarioKey[key]]).toFixed(2)])) as Record<typeof scenarios[number], string>;
  // A cheaper habitual project can reduce the prediction. Coverage displayed as
  // part of the project's cost never exceeds that cost; the signed delta remains
  // the scenario authority and preserves the savings separately.
  const absorbedByBaseline = Object.fromEntries(scenarios.map((key) =>
    [key, gross.minus(netAdditionalImpact[key]).gt(gross) ? gross.toFixed(2)
      : gross.minus(netAdditionalImpact[key]).lt(0) ? "0.00" : gross.minus(netAdditionalImpact[key]).toFixed(2)])) as Record<typeof scenarios[number], string>;
  const projectPayment = {
    bank: new Big(after.plannedFunding.bankAllocated).minus(before.plannedFunding.bankAllocated).toFixed(2),
    swile: new Big(after.plannedFunding.swile.reserved).plus(after.plannedFunding.swile.usedDeclared)
      .minus(before.plannedFunding.swile.reserved).minus(before.plannedFunding.swile.usedDeclared).toFixed(2),
    edenred: new Big(after.plannedFunding.edenred.reserved).plus(after.plannedFunding.edenred.usedDeclared)
      .minus(before.plannedFunding.edenred.reserved).minus(before.plannedFunding.edenred.usedDeclared).toFixed(2),
  };
  const centralImpact = new Big(netAdditionalImpact.central), anticipated = gross.minus(centralImpact);
  const euro = (value: Big) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value.toFixed(2)));
  const effectNarrative = gross.eq(0) ? "Ce projet n’ajoute aucune dépense pour le moment." : centralImpact.lt(0)
    ? `Une dépense similaire était déjà estimée à environ ${euro(anticipated)}. Votre projet devrait coûter ${euro(gross)} : environ ${euro(centralImpact.abs())} de moins que l’estimation habituelle.`
    : anticipated.gt(0) ? `Environ ${euro(anticipated)} étaient déjà anticipés dans le mois. Votre projet coûte ${euro(gross)} ; ${euro(centralImpact)} s’ajoutent réellement à la projection.`
      : `Ce projet s’ajoute aux dépenses prévues : ${euro(centralImpact)} supplémentaires dans la projection du mois.`;
  return { grossCost: gross.toFixed(2), fuelUsage: fuel.toFixed(2), payableGross: gross.minus(fuel).toFixed(2), effectNarrative,
    projectionIncomplete: before.narrative.prediction?.currentImportsMissing === true || after.narrative.prediction?.currentImportsMissing === true,
    remainingDifference: centralImpact.times(-1).toFixed(2),
    economicLines: draft.costItems.map((item) => ({ id: item.id, label: item.variantLabel || item.label, amount: plannedLineGross(item), economicOnly: costItemCashTreatment(item) === "ECONOMIC_ONLY" })),
    netAdditionalImpact, absorbedByBaseline, projectPayment, before: before.scenarios, after: after.scenarios, funding: after.plannedFunding };
}
