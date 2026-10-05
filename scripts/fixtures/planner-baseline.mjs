import { require } from "../lib/phase2-ts-loader.mjs";
const { defaultMonthInputs } = require("../../src/server/phase2/month-scenario.ts");
export const householdId = "11111111-1111-4111-8111-111111111111";
export const adrien = "22222222-2222-4222-8222-222222222222", manon = "33333333-3333-4333-8333-333333333333";
export const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const component = (key, central, nature = "CONTRACTUAL_EXPECTED") => ({ key, label: key, nature, ownerAuthority: "synthetic-existing-owner@v1",
  provenance: [`source:${key}`], referenceMode: "CURRENT_VALUE", confidence: "HIGH", knowledgeState: central === null ? "UNKNOWN" : "PROBABLE",
  additiveGroup: key.startsWith("income:") ? "income" : "obligations", parentEnvelope: null, replaces: [], fundingPlan: "BANK_OR_OTHER",
  freshnessDate: "2026-06-30", limitations: [], low: central, central, high: central });
export function fixture() {
  const monthInputs = { ...defaultMonthInputs(), safetyReserve: "25.00", declaredOutflows: [{ id: "44444444-4444-4444-8444-444444444444",
    label: "Synthetic protected goal", kind: "SAVINGS", amount: "100.00", dueDate: "2026-07-15", adjustability: "PROTECTED", source: "ANNUAL_PLAN", annualGoalRef: "synthetic-goal" }] };
  const entries = months.flatMap((month, index) => [
    { operationId: `bank-grocery-${month}`, canonicalComponentKey: `operation:bank-grocery-${month}`, purchaseEventId: `grocery-${month}`,
      date: `${month}-05`, amount: String(300 + index * 10), amountStatus: "KNOWN", subcategory: "Courses alimentaires", person: null, preciseType: null, merchant: "Synthetic shop", funding: { BANK: "20", SWILE: "80", EDENRED: "200" } },
    ...Array.from({ length: 3 }, (_, n) => ({ operationId: `restaurant-${month}-${n}`, purchaseEventId: `restaurant-${month}-${n}`, date: `${month}-${10 + n}`,
      amount: "20.00", subcategory: "Restaurant", person: null, preciseType: null, merchant: "Synthetic restaurant" })),
    ...["Adrien", "Manon"].flatMap(person => Array.from({ length: 2 }, (_, n) => ({ operationId: `meal-${person}-${month}-${n}`, purchaseEventId: `meal-${person}-${month}-${n}`,
      date: `${month}-${15 + n}`, amount: "8.00", subcategory: "Boulangerie", person, preciseType: "Repas du midi au travail", merchant: "Synthetic lunch" }))),
    { operationId: `coffee-${month}`, date: `${month}-18`, amount: "1.00", subcategory: "Café au travail", person: "Adrien", preciseType: null, merchant: "Synthetic coffee" },
    { operationId: `tech-${month}`, date: `${month}-20`, amount: "80.00", subcategory: "Unknown semantic behavior", person: null, preciseType: null, merchant: "Synthetic unknown" },
    { operationId: `rent-${month}`, date: `${month}-01`, amount: "600.00", subcategory: "Housing", person: null, preciseType: null, merchant: "Synthetic rent" },
  ]);
  const mobilityLegs = months.flatMap(month => ["work-out", "work-in", "family-out", "family-in", "unresolved"].map((kind, n) => ({
    fact: "fct_mobility_leg", householdId, legId: `leg-${month}-${kind}`, date: `${month}-${n < 2 ? "07" : n < 4 ? "08" : "09"}`,
    estimatedFuelCost: n < 2 ? "2.00" : "5.00", source: { status: "CERTIFIED_SOURCE" }, evidenceRefs: [`source-leg:${month}:${kind}`] })));
  const mobilityContexts = mobilityLegs.filter(l => !l.legId.endsWith("unresolved")).map(l => ({ contextResolutionId: `context:${l.legId}`,
    mobilityLegId: l.legId, subjectPersonId: manon, purpose: l.legId.includes("work-") ? "WORK_COMMUTE" : "FAMILY_VISIT", contextKind: "LIFE_EVENT",
    contextRef: l.legId.includes("work-") ? null : `visit:${l.date}`, scope: "PERSONAL", linkState: "LINKED", knowledgeState: "CONFIRMED",
    temporalRelation: "ARRIVAL_TO_CONTEXT", temporalQuality: "EXACT", evidenceRefs: [l.legId] }));
  return { householdId, targetMonth: "2026-07", knowledgeCutoff: "2026-07-03T10:00:00Z", timezone: "Europe/Paris",
    forecast: { meta: { targetMonth: "2026-07", sourcePublicationId: "synthetic-publication", sourceRevision: 1, analyticsRevision: 1,
      computedAt: "2026-07-03T10:00:00Z", certificationStatus: "PROVISIONAL" },
      income: { components: [component("income:salary", "2000.00", "HABITUAL_RANGE")] },
      components: [component("obligation:rent", "600.00"), component("obligation:unknown", null)] }, monthInputs,
    periods: months.map(month => ({ analysisPeriodId: `period:${month}`, householdId, month: `${month}-01`, financeStatus: "complete",
      lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete", isClosed: true, sourceRevision: 1 })),
    evidence: { history: { startMonth: months[0], endMonth: months.at(-1), economicEntries: entries, mobilityLegs: [] },
      personNamesById: { [adrien]: "Adrien", [manon]: "Manon" }, currentEconomicEntries: [], currentMobilityLegs: [], observedThrough: null,
      bankObservations: months.map(month => ({ id: `rent-${month}`, recurrenceSeriesId: "rent" })),
      completeMonthsBySource: { BANK: months, SWILE: months.slice(2), EDENRED: months.slice(1), MOBILITY: months }, limitationCodes: [] },
    food: { methodVersion: "global_food_rhythm@v2-purchase-aware", months: months.map((month, n) => [month, String(300 + n * 10), "92.00", "0", "392.00", "92.00", null,
      [1, 1, "1", []], [3, 3, 3, "1", "1", { status: "KNOWN", value: "20.00" }], 0, [[], [], []], ["KNOWN", "KNOWN", []], [0, "392", "392"]]) },
    purchaseFacts: [], habitAssertions: [{ assertionId: "55555555-5555-4555-8555-555555555555", personId: adrien, habitKey: "hairdresser", monthlyVisitEstimate: "2.00",
      typicalVisitPrice: "14.00", priceBasis: "INDICATIVE_PRICE_NOT_PAYMENT", authority: "USER_VALIDATED", validatedAt: "2026-01-01T00:00:00Z" }],
    productObservations: ["2026-01-10", "2026-04-10"].map((date, n) => ({ observationId: `synthetic-product-${n}`, subject: { kind: "PERSON", personId: manon },
      needKey: "synthetic-cosmetic-need", productKey: "synthetic-product", observedAt: date, price: "12.00", evidenceRefs: [`product:${n}`] })),
    needSubjects: { "synthetic-need": { needKey: "synthetic-cosmetic-need", personId: manon } },
    mobilityLegs, mobilityContexts,
    personalMobility: { methodVersion: "global_m7_personal_mobility@v1", costMetricId: "mobility_usage_estimated_fuel_cost", summaries: [], liveWrites: "NONE" },
    plannedExpenses: [{ id: "66666666-6666-4666-8666-666666666666", householdId, targetMonth: "2026-07", status: "PLANNED", familyKey: "FOOD", subtypeKey: "restaurant",
      title: "Synthetic external restaurant", plannedDate: "2026-07-10", costItems: [{ id: "line-1", label: "Synthetic meal", assetKey: null, quantity: "1", unitAmount: "99.00", baselineKey: "household-restaurants" }],
      context: {}, createdBy: "synthetic", updatedBy: "synthetic", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" }] };
}
