import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { require } from "./lib/phase2-ts-loader.mjs";
import { fixture, months, adrien, manon } from "./fixtures/planner-baseline.mjs";
const { buildPlanningBaseline, planningBaselineDigest } = require("@/server/phase2/planner/baseline.ts");
const { plannerDigest } = require("@/domain/phase2/planner/json.ts");
const { legacySeedDecisions, readPersonHabitAssertions, readPlanningBaseline, readPlanningBaselineSources } = require("@/server/phase2/planner/baseline-adapters.ts");
const passed = [], test = async (id, run) => { await run(); passed.push(id); };
const clone = value => structuredClone(value), slot = (b, key) => b.slots.find(s => s.semanticKey === key);

await test("BASE-BLD-001", () => {
  const source = fixture(), before = clone(source), baseline = buildPlanningBaseline(source);
  assert.deepEqual(source, before, "builder mutated an owner");
  assert.deepEqual(baseline, buildPlanningBaseline(clone(source)));
  const shuffled = clone(source);
  for (const key of ["periods", "plannedExpenses", "habitAssertions", "productObservations", "mobilityLegs", "mobilityContexts"]) shuffled[key].reverse();
  shuffled.food.months.reverse(); shuffled.evidence.history.economicEntries.reverse(); shuffled.forecast.components.reverse();
  for (const sourceMonths of Object.values(shuffled.evidence.completeMonthsBySource)) sourceMonths.reverse();
  assert.deepEqual(baseline, buildPlanningBaseline(shuffled));
  const { digest, knowledgeCutoff: _metadata, ...body } = baseline;
  assert.equal(digest, plannerDigest(body));
  assert.equal(digest, planningBaselineDigest(baseline));
  const later = clone(source); later.knowledgeCutoff = "2026-07-03T11:00:00Z";
  assert.equal(baseline.digest, buildPlanningBaseline(later).digest, "construction time alone is not a semantic change");
  const changed = clone(source); changed.food.months.at(-1)[1] = "900";
  assert.notEqual(baseline.digest, buildPlanningBaseline(changed).digest);
});
await test("BASE-BLD-002", () => {
  const source = fixture(), plain = buildPlanningBaseline(source);
  source.plan = { controls: [{ semanticKey: "groceries", amount: "1" }], contexts: [{ title: "PLAN_SENTINEL" }] };
  source.planDecisions = [{ amount: "123456.78" }]; source.forecast.freeToSpend = { central: "123456.78" };
  assert.deepEqual(plain, buildPlanningBaseline(source));
  assert(!JSON.stringify(plain).includes("PLAN_SENTINEL"));
});
await test("BASE-BLD-003", () => {
  const source = fixture(), plain = buildPlanningBaseline(source);
  source.monthInputs.decision = { assumptions: { restaurantFrequency: 999, onsiteDays: 0, hairdresserVisits: 1000 }, categoryTargets: { groceries: "1" } };
  source.monthInputs.excludedFixedObligations = ["obligation:rent"];
  source.monthInputs.declinedConditionalObligations = ["obligation:unknown"];
  assert.deepEqual(plain, buildPlanningBaseline(source));
  assert.equal(legacySeedDecisions(source.monthInputs).assumptions.restaurantFrequency, 999);
  assert.equal(slot(plain, "hairdresser").baselineValue.count, "2");
});
await test("BASE-BLD-004", () => {
  const source = fixture(), plain = buildPlanningBaseline(source);
  source.plannedExpenses.push(clone(source.plannedExpenses[0]));
  const b = buildPlanningBaseline(source);
  assert.deepEqual(b, plain); assert.equal(b.structuralFacts.externalKnownContexts.length, 1);
  source.plannedExpenses.forEach(p => p.costItems[0].unitAmount = "999.00");
  const repriced = buildPlanningBaseline(source);
  assert.deepEqual(repriced.slots, plain.slots); assert.deepEqual(repriced.structuralFacts.resources, plain.structuralFacts.resources);
  assert.deepEqual(repriced.unresolvedReserves, plain.unresolvedReserves);
  assert.equal(repriced.structuralFacts.externalKnownContexts[0].intent.costItems[0].unitAmount, "999.00");
  const conflict = fixture(); conflict.plannedExpenses.push({ ...clone(conflict.plannedExpenses[0]), title: "Conflicting intent" });
  assert.throws(() => buildPlanningBaseline(conflict), /IDENTITY_CONFLICT/);
});
await test("BASE-BLD-005", () => {
  const source = fixture(); source.evidence.completeMonthsBySource = {};
  let b = buildPlanningBaseline(source);
  assert.equal(slot(b, "groceries").knowledge, "UNKNOWN"); assert.equal(slot(b, "groceries").baselineValue.amount, null);
  assert.equal(b.structuralFacts.obligations.find(o => o.factKey === "obligation:unknown").value.central, null);
  assert.equal(slot(b, "need:synthetic-cosmetic-need"), undefined, "uncertified products cannot enter calibration");
  const partial = fixture(); partial.food.months.forEach(row => row[12][0] |= 1);
  b = buildPlanningBaseline(partial);
  assert.equal(slot(b, "groceries").baselineValue.amount, null);
  assert(b.unresolvedReserves.find(r => r.reserveKey === "unresolved:groceries").historicalReferences.samples.every(s => s.minimum !== null));
  const unknown = fixture(); unknown.purchaseFacts = months.map(month => ({ timing: { status: "KNOWN", economicMonth: month }, economicAmount: { status: "UNKNOWN" }, purchaseIdentityKey: `unknown:${month}` }));
  b = buildPlanningBaseline(unknown); assert.equal(slot(b, "adrien-work-meals").baselineValue.count, null);
  assert.equal(b.unresolvedReserves.find(r => r.reserveKey === "purchase:UNRESOLVED").value.central, null);
});
await test("BASE-BLD-006", () => {
  const b = buildPlanningBaseline(fixture()), reserve = b.unresolvedReserves.find(r => r.reserveKey === "economic:UNRESOLVED");
  assert.equal(reserve.value.central, "80.00"); assert.equal(reserve.historicalReferences.evidenceRefs.length, 6);
  assert(!reserve.historicalReferences.evidenceRefs.some(ref => ref.includes("rent")));
  const source = fixture(); source.evidence.history.economicEntries.find(row => row.operationId === "tech-2026-01").amountStatus = "PARTIAL";
  const r = buildPlanningBaseline(source).unresolvedReserves.find(r => r.reserveKey === "economic:UNRESOLVED");
  assert.equal(r.knowledge, "PARTIAL"); assert.equal(r.historicalReferences.samples[0].value, null); assert.equal(r.historicalReferences.samples[0].minimum, "80.00");
});
await test("BASE-BLD-007", () => {
  const source = fixture(), original = buildPlanningBaseline(source);
  source.evidence.history.economicEntries.push({ ...clone(source.evidence.history.economicEntries[0]), operationId: "future", purchaseEventId: "future", date: "2026-07-20", amount: "900000" });
  source.evidence.currentEconomicEntries = clone(source.evidence.history.economicEntries);
  source.evidence.limitationCodes.push("PURCHASE_AMOUNT_UNRESOLVED"); source.forecast.meta.computedAt = "2026-07-04T00:00:00Z";
  source.food.months.push(["2026-07", "999", "999", "999"]);
  source.periods.push({ ...clone(source.periods[0]), month: "2026-07-01", isClosed: false });
  source.habitAssertions.push({ ...clone(source.habitAssertions[0]), assertionId: "77777777-7777-4777-8777-777777777777", habitKey: "future", validatedAt: "2026-08-01T00:00:00Z" });
  assert.deepEqual(buildPlanningBaseline(source), original);
  source.periods.find(p => p.month === "2026-06-01").isClosed = false;
  assert(!slot(buildPlanningBaseline(source), "groceries").historicalReferences.comparableMonths.includes("2026-06"));
});
await test("BASE-BLD-008", () => {
  const b = buildPlanningBaseline(fixture()), goal = b.structuralFacts.savingsReservations.find(s => s.annualGoalRef === "synthetic-goal");
  assert.equal(goal.adjustability, "PROTECTED"); assert.equal(goal.amount, "100.00");
  assert(!b.slots.some(s => s.semanticKey === goal.reservationId));
  assert.equal(b.structuralFacts.savingsReservations.find(s => s.reservationId === "policy:safety-reserve").amount, "25.00");
});
await test("BASE-BLD-009", () => {
  const b = buildPlanningBaseline(fixture()), work = slot(b, "mobility:WORK"), family = slot(b, "mobility:FAMILY_VISIT");
  assert.equal(work.scope.personId, manon); assert.equal(work.controlKey, null);
  assert(work.capabilities.every(c => c.action === "REVIEW_REFERENCE"));
  assert.equal(work.baselineValue.amount, null); assert.equal(work.baselineValue.unitAmount, null);
  assert.equal(family.inclusion, "SUGGESTION_ONLY"); assert(!b.slots.some(s => /ALL_PERSONAL|mobility-usage/.test(s.semanticKey)));
  assert.equal(b.unresolvedReserves.find(r => r.reserveKey === "mobility:UNRESOLVED").value.central, "5.00");
});
await test("BASE-BLD-010", () => {
  const source = fixture(); source.evidence.completeMonthsBySource.EDENRED = months.slice(3);
  const b = buildPlanningBaseline(source), groceries = slot(b, "groceries").historicalReferences;
  assert.deepEqual(groceries.comparableMonths, months.slice(3));
  assert.deepEqual(b.unresolvedReserves.find(r => r.reserveKey === "economic:UNRESOLVED").historicalReferences.comparableMonths, months);
  assert.deepEqual(slot(b, "mobility:WORK").historicalReferences.comparableMonths, months);
  assert.equal(groceries.hardFloor, false); assert.deepEqual(groceries.requiredSources, ["BANK", "EDENRED", "SWILE"]);
  assert.equal(slot(b, "groceries").baselineValue.amount, "340.00", "gross FOOD owner must replace bank funding of 20");
  const reserve = b.unresolvedReserves.find(r => r.reserveKey === "unresolved:groceries");
  assert.equal(reserve.value.central, null);
  assert.deepEqual(reserve.historicalReferences.samples.map(s => s.month), months.slice(0, 3));
  assert.equal(reserve.historicalReferences.samples[0].minimum, "300.00");
});
await test("BASE-ADAPT-001", async () => {
  const seen = [], query = { select() { return this; }, eq(k, v) { seen.push([k, v]); return this; }, lte(k, v) { seen.push([k, v]); return this; }, order() { return this; },
    range() { return Promise.resolve({ data: [{ person_habit_assertion_id: fixture().habitAssertions[0].assertionId, person_id: adrien, habit_key: "hairdresser",
      monthly_visit_estimate: 2, typical_visit_price: 14, authority: "USER_VALIDATED", price_basis: "INDICATIVE_PRICE_NOT_PAYMENT", validated_at: "2026-01-01T00:00:00Z" }], error: null }); } };
  const client = { from(table) { assert.equal(table, "person_habit_assertions"); return query; } };
  const rows = await readPersonHabitAssertions(client, fixture().householdId, [adrien], fixture().knowledgeCutoff);
  assert.equal(rows.length, 1); assert(seen.some(([key]) => key === "household_id")); assert(seen.some(([key]) => key === "validated_at"));
  await assert.rejects(() => readPersonHabitAssertions(client, fixture().householdId, [manon], fixture().knowledgeCutoff), /PERSON_SCOPE/);
});
await test("BASE-ADAPT-002", async () => {
  const s = fixture(), restores = [], reads = []; let assembledReads = 0;
  const replace = (name, key, value) => {
    const module = require(name), previous = module[key]; module[key] = value; restores.push(() => module[key] = previous);
  };
  replace("@/server/phase2/live-month-forecast.ts", "loadMonthForecastAuthorities", async (_client, household) => {
    assert.equal(household, s.householdId); return { background: { food: s.food }, publication: {
      publication_id: s.forecast.meta.sourcePublicationId, source_revision: s.forecast.meta.sourceRevision, published_analytics_revision: s.forecast.meta.analyticsRevision } };
  });
  replace("@/server/phase2/month-forecast.ts", "assembleMonthForecast", (_authorities, month) => { assembledReads++; assert.equal(month, s.targetMonth); return s.forecast; });
  replace("@/server/phase2/month-inputs.ts", "readMonthInputs", async (_client, household, month) => {
    assert.equal(household, s.householdId); assert.equal(month, s.targetMonth); return { inputs: s.monthInputs };
  });
  replace("@/server/phase2/month-prediction-evidence.ts", "readMonthPredictionEvidence", async (_client, household, month, empty, options) => {
    assert.equal(household, s.householdId); assert.equal(month, s.targetMonth); assert.equal(empty, true);
    assert.deepEqual(options, { asOfDate: "2026-07-03", timezone: "Europe/Paris" }); return s.evidence;
  });
  replace("@/server/phase2/planned-expenses.ts", "readPlannedExpenses", async (_client, household, month) => {
    assert.equal(household, s.householdId); assert.equal(month, s.targetMonth); return s.plannedExpenses;
  });
  replace("@/server/analytics/global-v2-persona-signals.ts", "resolveGlobalPersonaProductObservations", async ({ certifiedThrough }) => {
    assert.equal(certifiedThrough, "2026-06-30"); return s.productObservations;
  });
  replace("@/server/analytics/global-v2-mobility-context-authority.ts", "resolveGlobalM7MobilityContextAuthority", async ({ certifiedThrough }) => {
    assert.equal(certifiedThrough, "2026-06-30"); return { contextLinks: s.mobilityContexts, presenceResolutions: [] };
  });
  replace("@/analytics/global-v2/personal-mobility.ts", "buildGlobalM7PersonalMobilityAuthority", ({ mobilityLegs, contextLinks }) => {
    assert.equal(mobilityLegs.length, s.mobilityLegs.length); assert.equal(contextLinks.length, s.mobilityContexts.length); return s.personalMobility;
  });
  const client = { from(table) {
    assert(["needs", "person_habit_assertions"].includes(table)); reads.push(table);
    const query = { select() { return this; }, eq(k, v) { assert.equal(k, "household_id"); assert.equal(v, s.householdId); return this; },
      lte() { return this; }, order() { return this; },
      in(key, values) { assert.equal(key, "need_key"); assert.deepEqual(values, ["synthetic-cosmetic-need"]); return this; },
      range() { const a = s.habitAssertions[0]; return Promise.resolve({ data: [{ person_habit_assertion_id: a.assertionId, person_id: a.personId, habit_key: a.habitKey,
        monthly_visit_estimate: a.monthlyVisitEstimate, typical_visit_price: a.typicalVisitPrice, price_basis: a.priceBasis, authority: a.authority, validated_at: a.validatedAt }], error: null }); },
      then(resolve) { return Promise.resolve({ data: [{ need_id: "synthetic-need", need_key: "synthetic-cosmetic-need", person_id: manon }], error: null }).then(resolve); },
    };
    for (const action of ["insert", "upsert", "update", "delete", "rpc"]) query[action] = () => assert.fail(`Unexpected ${action}`);
    return query;
  } };
  const repository = { client, context: { householdId: s.householdId, timezone: s.timezone, periods: s.periods, personIds: [adrien, manon] },
    async loadMobilityLegFacts(range) { assert.deepEqual(range, { start: "2026-01-01", endExclusive: "2026-07-01" }); return s.mobilityLegs; },
    async loadPurchaseAwareCanonical(range, visibility) { assert.equal(visibility, "PURCHASE_AWARE_PILOT"); assert.equal(range.endExclusive, "2026-07-01"); return { status: "PASS", facts: [] }; } };
  try {
    assert.deepEqual(await readPlanningBaseline(repository, s.targetMonth, s.knowledgeCutoff), buildPlanningBaseline(s));
    assert.deepEqual(reads.sort(), ["needs", "person_habit_assertions"]);
    const cached = { ...clone(s.forecast), reserve: { amount: "50.00", source: "POLICY" } };
    const admitted = await readPlanningBaselineSources(repository, s.targetMonth, s.knowledgeCutoff, { forecast: cached });
    assert.strictEqual(admitted.forecast, cached); assert.equal(assembledReads, 1, "published forecast must not be rebuilt under a newer reserve policy");
    await assert.rejects(() => readPlanningBaselineSources(repository, s.targetMonth, s.knowledgeCutoff,
      { forecast: { ...cached, meta: { ...cached.meta, sourceRevision: cached.meta.sourceRevision + 1 } } }), /PLANNER_WORLD_AUTHORITIES_CHANGED_DURING_READ/);
  }
  finally { restores.reverse().forEach(restore => restore()); }
});
await test("BASE-UNMAPPED-PRODUCT", () => {
  const s = fixture(); s.productObservations.push({ ...s.productObservations[0], observationId: "unmapped", needKey: "unmapped-product" });
  const baseline = buildPlanningBaseline(s);
  assert.ok(baseline.diagnostics.some(d => d.code === "BASELINE_NEED_MAPPING_UNAVAILABLE"));
  assert.ok(!baseline.slots.some(s => s.semanticKey === "need:unmapped-product"));
  assert.ok(baseline.sourceRefs.some(ref => ref.evidenceRefs.includes(s.productObservations[0].evidenceRefs[0])));
  const conflict = fixture(); conflict.needSubjects["synthetic-need"].personId = adrien;
  assert.throws(() => buildPlanningBaseline(conflict), /BASELINE_NEED_SUBJECT_CONFLICT/);
});
await test("BASE-BOUNDARY-001", () => {
  const folder = path.resolve("src/server/phase2/planner");
  for (const name of fs.readdirSync(folder).filter(n => n.startsWith("baseline") && n.endsWith(".ts"))) {
    const text = fs.readFileSync(path.join(folder, name), "utf8");
    assert(!/\.\s*(?:insert|upsert|update|delete|rpc)\s*\(/.test(text), name);
    assert(!/\b(?:deriveMonthScenario|phase2_month_plans|phase2_month_plan_revisions|estimatePlannedCar|resolvePlannedRoute)\b/.test(text), name);
  }
});
console.log(JSON.stringify({ result: "PASS", passed, C1_READY_FOR_C2: "YES", remoteWrites: 0, baselinePersistence: false }, null, 2));
