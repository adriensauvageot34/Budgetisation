import { require } from "../lib/phase2-ts-loader.mjs";
import { fixture as sourceFixture, months } from "./planner-baseline.mjs";
import { fixture as kernelFixture, uuid, householdId, control } from "./planner-kernel.mjs";
const { buildSimplePlanningBaseline } = require("@/server/phase2/planner/simple-baseline");
const { sumReferenceComponents } = require("@/server/phase2/month-reference");
const { emptyPlanSemanticState } = require("@/domain/phase2/planner/semantic-state");
export { uuid, householdId, control, months };
export const state = (controls = [], contexts = []) => ({ ...emptyPlanSemanticState("2026-11"), controls, contexts });
export function fixture() {
  const world = kernelFixture(), sources = sourceFixture();
  sources.targetMonth = "2026-11"; sources.knowledgeCutoff = "2026-10-05T10:00:00Z";
  sources.forecast.meta.targetMonth = "2026-11"; sources.monthInputs = world.monthInputs; sources.plannedExpenses = [];
  for (const source of ["BANK", "SWILE", "EDENRED", "MOBILITY"]) sources.evidence.completeMonthsBySource[source] = [...months];
  const rows = sources.evidence.history.economicEntries.filter(row => !row.operationId.endsWith("-2") || !row.subcategory.includes("Restaurant"));
  sources.evidence.history.economicEntries = rows;
  for (const month of months) {
    rows.push({ operationId: `fast-${month}`, date: `${month}-21`, amount: "10.00", subcategory: "Fast-food / snack", person: null, preciseType: null, merchant: "Synthetic fast food" });
    rows.push({ operationId: `delivery-${month}`, date: `${month}-22`, amount: "15.00", subcategory: "Livraison de repas", person: null, preciseType: null, merchant: "Synthetic delivery" });
    rows.push({ operationId: `tobacco-${month}`, date: `${month}-23`, amount: "60.00", subcategory: "Vape / cigarette électronique", person: null, preciseType: null, merchant: "Synthetic tobacco" });
  }
  const meals = rows.filter(row => ["Restaurant", "Fast-food / snack", "Livraison de repas"].includes(row.subcategory));
  sources.simpleOccurrences = { occurrences: meals.map((row, n) => ({ fact: "fct_activity_occurrence", householdId,
    householdTimeZone: "Europe/Paris", lifeEventId: `synthetic-dining-${n}`, activityId: "repas_restaurant", lifeEventSeriesId: null,
    parentLifeEventId: null, startDate: row.date, endDate: row.date, validationStatus: "Confirmé", participantIds: [] })),
    links: meals.map((row, n) => ({ financialLinkId: `synthetic-link-${n}`, lifeEventId: `synthetic-dining-${n}`,
      canonicalComponentKey: row.canonicalComponentKey ?? `operation:${row.operationId}`, relationType: "Paiement_activite", economicAmountLinked: row.amount })) };
  const part = (key, value) => ({ key, low: value, central: value, high: value, method: "synthetic-existing-reference@v1", observationCount: 6,
    provenance: [`synthetic:${key}`], note: null, decisionCapabilities: { label: key, role: "BEHAVIORAL", targetAllowed: true, adjustability: "ADJUSTABLE", strategies: ["TEST_AMOUNT"] } });
  world.forecast.referencePlan.necessary = [part("groceries", "325.00"), part("tobacco-vape", "60.00")];
  world.forecast.referencePlan.flexible = [part("household-restaurants", "65.00"), part("adrien-work-meals", "16.00"), part("manon-work-meals", "16.00"), part("adrien-work-coffee", "1.00")];
  world.forecast.referencePlan.necessaryTotal = sumReferenceComponents(world.forecast.referencePlan.necessary);
  world.forecast.referencePlan.flexibleTotal = sumReferenceComponents(world.forecast.referencePlan.flexible);
  world.forecast.economicCost = { low: "983.00", central: "983.00", high: "983.00" };
  world.forecast.freeToSpend = { low: "1017.00", central: "1017.00", high: "1017.00" };
  world.forecast.cash.grossBeforeUnconfirmedFunding = world.forecast.economicCost;
  // Baseline and financial scenario read the same structural publication.
  world.forecast.income.components = world.forecast.income.components.map(part => ({ ...part, low: part.central, high: part.central,
    knowledgeState: "PROBABLE", ownerAuthority: "synthetic-existing-owner@v1", nature: "CONTRACTUAL_EXPECTED", fundingPlan: "BANK_OR_OTHER", provenance: [`source:${part.key}`] }));
  world.forecast.components = world.forecast.components.map(part => ({ ...part, ownerAuthority: "synthetic-existing-owner@v1", fundingPlan: "BANK_OR_OTHER", provenance: [`source:${part.key}`] }));
  sources.forecast = structuredClone(world.forecast);
  return { ...world, baseline: buildSimplePlanningBaseline(sources), sources };
}
export const rebuild = world => { world.baseline = buildSimplePlanningBaseline(world.sources); return world; };
export const findSlot = (world, domain) => world.baseline.slots.find(s => s.simpleAuthority?.domain === domain);
