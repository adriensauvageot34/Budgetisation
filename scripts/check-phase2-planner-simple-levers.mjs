import assert from "node:assert/strict";
import fs from "node:fs";
import { require } from "./lib/phase2-ts-loader.mjs";
import { fixture, state, rebuild, findSlot, control, uuid, householdId } from "./fixtures/planner-simple-levers.mjs";
import { externalExpense, context } from "./fixtures/planner-kernel.mjs";
import { createKernelPostgres } from "./lib/planner-kernel-postgres.mjs";
const { evaluatePlanScenario } = require("@/server/phase2/planner/preview");
const { publishSimpleCapabilities } = require("@/server/phase2/planner/simple-capabilities");
const { homeAssetBoundary, externalDiningDomain } = require("@/server/phase2/planner/simple-mappings");
const { previewPlanScenario, applyPlanScenario } = require("@/server/phase2/planner/apply");
const { resolveEffectiveMonthScenario } = require("@/server/phase2/planner/effective-month-scenario");
const { createPlanApplyRepository } = require("@/server/phase2/planner/repository");
const { deriveMonthScenario } = require("@/server/phase2/month-scenario");
const { financialAdapterForecast } = require("@/server/phase2/planner/financial-adapter");
const base = { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 };
const evaluate = (world, semantic = state()) => evaluatePlanScenario(world, semantic, base);
const capability = (world, domain) => publishSimpleCapabilities(world.baseline).find(c => c.domain === domain);
const block = (p, code) => assert.ok(p.compiled.constraints.some(c => c.severity === "BLOCK" && c.code === code), code);
const passed = [], test = async (id, run) => { await run(); passed.push(id); console.log(`${id} PASS`); };
const pg = await createKernelPostgres(); let current = fixture(), request = 4000;
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => structuredClone(current),
  readDirectWorld: async () => ({ forecast: current.forecast, monthInputs: current.monthInputs, externalIntents: current.externalIntents, asOfDate: current.asOfDate }) };
const command = p => ({ expectedActiveRevisionId: p.baseActiveRevisionId, expectedActiveRevisionNumber: p.baseRevisionNumber,
  expectedBaselineDigest: p.baselineDigest, expectedPreviewDigest: p.previewDigest, applyRequestId: uuid(request++) });
const roundTrip = async (world, semantic) => {
  current = world;
  const p = await previewPlanScenario(deps, householdId, semantic);
  assert.notEqual(p.projection.applyReadiness, "BLOCKED");
  const applied = await applyPlanScenario(deps, householdId, semantic, command(p));
  assert.deepEqual(applied.projectionEvidence.projection, p.projection);
  const reload = await resolveEffectiveMonthScenario(deps, householdId, "2026-11");
  assert.equal(reload.evidenceStatus, "EXACT"); assert.deepEqual(reload.scenario, p.scenario);
  assert.deepEqual(reload.preview.projection, p.projection); assert.equal(reload.preview.compiledManifestDigest, p.compiledManifestDigest);
  return p;
};
try {
  await test("C3-001", async () => {
    const world = fixture(), semantic = state([control("groceries", { amount: "250.00" })]), before = structuredClone(world);
    const p = evaluate(world, semantic); assert.equal(p.projection.plan.impactOnMonthEnd, "75.00"); assert.deepEqual(world, before);
    assert.deepEqual(p.scenario, deriveMonthScenario(financialAdapterForecast(world, p.compiled.planSlots), p.compiled.financialAdapterInput.effectiveMonthInputs, null, world.asOfDate, p.compiled.financialAdapterInput.plannedExpenseEntries));
    await roundTrip(world, semantic);
  });
  await test("C3-002", () => {
    const world = fixture(); world.sources.evidence.currentEconomicEntries = [{ operationId: "synthetic-observed-groceries", date: "2026-11-01", amount: "60.00", subcategory: "Courses alimentaires", person: null, preciseType: null, merchant: null }];
    world.sources.knowledgeCutoff = "2026-11-02T10:00:00Z"; world.asOfDate = "2026-11-02"; rebuild(world);
    assert.equal(capability(world, "groceries").hardConstraints[0].amount, "60.00");
    const p = evaluate(world, state([control("groceries", { amount: "59.00" })])); block(p, "SIMPLE_REAL_HARD_FLOOR_VIOLATED"); assert.equal(p.projection.applyReadiness, "BLOCKED");
    assert.deepEqual(capability(fixture(), "groceries").hardConstraints, []);
  });
  await test("C3-003", () => {
    const world = fixture(); world.sources.evidence.currentEconomicEntries = [{ operationId: "synthetic-observed-tobacco", date: "2026-11-01", amount: "25.00", subcategory: "Vape / cigarette électronique", person: null, preciseType: null, merchant: null }];
    world.sources.knowledgeCutoff = "2026-11-02T10:00:00Z"; world.asOfDate = "2026-11-02"; rebuild(world);
    block(evaluate(world, state([control("tobacco-vape", { amount: "24.00" })])), "SIMPLE_REAL_HARD_FLOOR_VIOLATED");
    const free = evaluate(fixture(), state([control("tobacco-vape", { amount: "0.00" })])); assert.notEqual(free.projection.applyReadiness, "BLOCKED"); assert.equal(free.projection.plan.impactOnMonthEnd, "60.00");
  });
  await test("C3-004", async () => {
    const world = fixture(), semantic = state([control("restaurants", { count: "1" })]);
    assert.equal(findSlot(world, "restaurants").baselineValue.count, "2.00");
    const p = evaluate(world, semantic); assert.equal(p.projection.plan.impactOnMonthEnd, "20.00");
    assert.equal(p.compiled.planSlots.filter(s => s.owned).length, 3);
    assert.ok(!p.compiled.manifest.effectiveForecast.referencePlan.flexible.some(r => r.key === "household-restaurants"));
    await roundTrip(world, semantic);
  });
  await test("C3-005", () => {
    const world = fixture(), slots = ["restaurants", "fast-food", "delivery"].map(k => findSlot(world, k));
    assert.equal(new Set(slots.map(s => s.planSlotId)).size, 3); assert.deepEqual(slots.map(s => s.baselineValue.unitAmount), ["20.00", "10.00", "15.00"]);
    const p = evaluate(world, state([control("fast-food", { count: "0" })])); assert.equal(p.projection.plan.impactOnMonthEnd, "10.00");
    assert.equal(p.compiled.planSlots.find(s => s.baseline.semanticKey === "restaurants").effectiveCount, "2.00");
  });
  await test("C3-006", async () => {
    const world = fixture(), meal = findSlot(world, "manon-work-meals");
    assert.equal(meal.baselineValue.count, null); assert.equal(meal.knowledge, "UNKNOWN"); assert.equal(capability(world, "manon-work-meals").gate, "NEEDS_NEW_INPUT");
    assert.ok(world.baseline.unresolvedReserves.some(r => r.replacesSlotKey === meal.slotIdentityKey));
    const semantic = state([control("manon-work-meals", { count: "4" })]), p = evaluate(world, semantic);
    assert.equal(p.compiled.planSlots.find(s => s.baseline.semanticKey === "manon-work-meals").remainingEconomicAmount, "32.00");
    assert.equal(p.projection.baseline.economicMonthEndRemainder, null); assert.equal(p.projection.plan.impactOnMonthEnd, null);
    assert.equal(meal.baselineValue.count, null); await roundTrip(world, semantic);
  });
  await test("C3-007", async () => {
    const world = fixture(), semantic = state([control(`savings:${uuid(700)}`, { amount: "40.00" })]), p = evaluate(world, semantic);
    assert.equal(p.projection.plan.impactOnMonthEnd, "60.00"); assert.equal(p.scenario.economicCost.central, "983.00");
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.length, 0); await roundTrip(world, semantic);
  });
  await test("C3-008", () => {
    const world = fixture(); world.sources.monthInputs.declaredOutflows[0].adjustability = "PROTECTED"; world.monthInputs.declaredOutflows[0].adjustability = "PROTECTED"; rebuild(world);
    const c = capability(world, "savings"); assert.deepEqual(c.actions, []); assert.equal(c.flexibility, "LOCKED"); assert.deepEqual(c.naturalPresets, []);
    const p = evaluate(world, state([control(c.slotIdentityKey, { amount: "50.00" })])); block(p, "PROTECTED_SAVINGS_RELEASE_FORBIDDEN");
    assert.deepEqual(p.compiled.planSlots.find(s => s.role === "SAVINGS").baseline.capabilities, []);
  });
  await test("C3-009", async () => {
    const world = fixture(), semantic = state([control("clothing", { amount: "75.00" })]);
    assert.equal(findSlot(world, "clothing").inclusion, "SUGGESTION_ONLY"); assert.equal(findSlot(world, "clothing").baselineValue.amount, "0.00");
    const p = evaluate(world, semantic); assert.equal(p.compiled.components.length, 0); assert.equal(p.compiled.contexts.length, 0);
    assert.equal(p.projection.plan.impactOnMonthEnd, "-75.00"); assert.equal(world.externalIntents.length, 0); await roundTrip(world, semantic);
  });
  await test("C3-010", async () => {
    const world = fixture(); world.monthInputs.decision.assumptions = { "household-restaurants": { mode: "CUSTOM", amount: "999.00" }, groceries: { mode: "CUSTOM", amount: "900.00" } };
    world.monthInputs.decision.categoryTargets = { "household-restaurants": "1.00", groceries: "2.00" };
    const external = externalExpense(); external.costItems = [
      { ...external.costItems[0], unitAmount: "5.00", assetKey: "restaurant:starter" },
      { ...external.costItems[0], id: uuid(802), unitAmount: "15.00", assetKey: "restaurant:main" }];
    world.externalIntents = [external]; world.sources.plannedExpenses = [external]; rebuild(world);
    const semantic = state([control("restaurants", { count: "2" }), control("groceries", { amount: "250.00" }, 2)]), p = evaluate(world, semantic);
    assert.deepEqual(p.compiled.financialAdapterInput.adapterManifest.neutralizedLegacyAssumptions, ["groceries", "household-restaurants"]);
    assert.deepEqual(p.compiled.financialAdapterInput.effectiveMonthInputs.decision.assumptions, {}); assert.deepEqual(p.compiled.financialAdapterInput.effectiveMonthInputs.decision.categoryTargets, {});
    assert.equal(p.compiled.planSlots.find(s => s.baseline.semanticKey === "restaurants").remainingCount, "1.00");
    assert.equal(p.compiled.financialAdapterInput.plannedExpenseEntries.filter(e => e.id === external.id).length, 1);
    assert.equal(p.projection.plan.impactOnMonthEnd, "75.00"); await roundTrip(world, semantic);
  });
  await test("C3-011", () => {
    const world = fixture(), histories = world.baseline.slots.map(s => s.historicalReferences), refs = structuredClone(histories);
    const a = evaluate(world, state([control("groceries", { amount: "10.00" })])), b = evaluate(world, state([control("groceries", { amount: "500.00" })]));
    assert.notEqual(a.projection.plan.economicMonthEndRemainder, b.projection.plan.economicMonthEndRemainder);
    assert.deepEqual(world.baseline.slots.map(s => s.historicalReferences), refs); assert.equal(a.baselineDigest, b.baselineDigest);
    assert.ok(histories.filter(Boolean).every(h => h.hardFloor === false));
  });
  await test("C3-EXTRA-HOME-BOUNDARY", async () => {
    assert.equal(homeAssetBoundary("home:decor"), "HOME_SMALL"); assert.equal(homeAssetBoundary("home:furniture"), "HOME_PROJECT"); assert.equal(homeAssetBoundary("home:kitchen"), "NEEDS_MAPPING");
    const world = fixture(), p = await roundTrip(world, state([control("home-small", { amount: "30.00" })]));
    assert.equal(p.projection.plan.impactOnMonthEnd, "-30.00"); assert.ok(!world.baseline.slots.some(s => s.semanticKey === "home-project"));
  });
  await test("C3-EXTRA-GAMES-OPTIONAL", async () => { const p = await roundTrip(fixture(), state([control("games-digital", { amount: "20.00" })])); assert.equal(p.projection.plan.impactOnMonthEnd, "-20.00"); });
  await test("C3-EXTRA-ADRIEN-MEAL", async () => { const p = await roundTrip(fixture(), state([control("adrien-work-meals", { count: "1" })])); assert.equal(p.projection.plan.impactOnMonthEnd, "8.00"); });
  await test("C3-EXTRA-NO-PAYMENT-OCCURRENCE", () => { const world = fixture(); delete world.sources.simpleOccurrences; rebuild(world); for (const domain of ["restaurants", "fast-food", "delivery"]) {
    assert.equal(findSlot(world, domain).baselineValue.count, null); assert.equal(capability(world, domain).gate, "NEEDS_NEW_INPUT"); }
    assert.equal(evaluate(world, state([control("restaurants", { count: "1" })])).projection.applyReadiness, "BLOCKED"); });
  await test("C3-EXTRA-EXPLICIT-MISSING-PRICE", async () => {
    const world = fixture(); delete world.sources.simpleOccurrences; rebuild(world);
    const semantic = state([control("restaurants", { count: "1", unitAmount: "20.00" }), control("fast-food", { count: "0" }, 2), control("delivery", { count: "0" }, 3)]);
    const p = await roundTrip(world, semantic); assert.equal(p.projection.baseline.economicMonthEndRemainder, null); assert.equal(p.projection.plan.impactOnMonthEnd, null);
  });
  await test("C3-EXTRA-FRACTIONAL-COUNT", () => assert.throws(() => evaluate(fixture(), state([control("restaurants", { count: "1.5" })])), /SIMPLE_OCCURRENCE_COUNT_MUST_BE_INTEGER/u));
  await test("C3-EXTRA-EXTERNAL-CHANNELS", () => { const expense = externalExpense(); expense.subtypeKey = "fast_food";
    assert.equal(externalDiningDomain(expense, expense.costItems[0]), "fast-food"); expense.context.purchaseMode = "DELIVERY"; assert.equal(externalDiningDomain(expense, expense.costItems[0]), "delivery"); });
  await test("C3-EXTRA-DETERMINISM", () => { const world = fixture(), digest = world.baseline.digest;
    world.sources.evidence.history.economicEntries.reverse(); world.sources.simpleOccurrences.occurrences.reverse(); world.sources.simpleOccurrences.links.reverse(); rebuild(world);
    assert.equal(world.baseline.digest, digest); const semantic = state([control("restaurants", { count: "1" })]); assert.equal(evaluate(world, semantic).compiledManifestDigest, evaluate(world, semantic).compiledManifestDigest); });
  await test("C3-EXTRA-NO-LEGACY-HABIT", () => { const world = fixture(), before = world.baseline.digest;
    world.sources.monthInputs.decision.assumptions["manon-work-meals"] = { mode: "CUSTOM", amount: "999.00" }; rebuild(world); assert.equal(world.baseline.digest, before); assert.equal(findSlot(world, "manon-work-meals").baselineValue.count, null); });
  await test("C3-EXTRA-VALIDATED-MANON-FREQUENCY", () => { const world = fixture(), personId = findSlot(world, "manon-work-meals").scope.personId;
    world.sources.habitAssertions.push({ assertionId: uuid(3000), personId, habitKey: "manon-work-meals", monthlyVisitEstimate: "4", typicalVisitPrice: "8.00",
      priceBasis: "INDICATIVE_PRICE_NOT_PAYMENT", authority: "USER_VALIDATED", validatedAt: "2026-09-01T00:00:00Z" }); rebuild(world);
    assert.equal(findSlot(world, "manon-work-meals").baselineValue.count, "4.00"); assert.equal(capability(world, "manon-work-meals").gate, "AVAILABLE");
    assert.equal(world.baseline.slots.filter(s => s.semanticKey === "manon-work-meals").length, 1);
    assert.equal(evaluate(world, state([control("manon-work-meals", { count: "3" })])).projection.plan.impactOnMonthEnd, "8.00"); });
  await test("C3-EXTRA-PURCHASE-OWNER-IDENTITY", () => { const world = fixture(), row = world.sources.evidence.history.economicEntries.find(r => r.subcategory === "Restaurant");
    const oldKey = `operation:${row.operationId}`; row.canonicalComponentKey = `purchase_event:${row.purchaseEventId}`;
    world.sources.purchaseFacts.push({ fact: "fct_purchase_aware_economic_component", purchaseEventId: row.purchaseEventId, purchaseIdentityKey: `purchase:${row.purchaseEventId}`,
      timing: { status: "KNOWN", economicMonth: row.date.slice(0,7) }, economicAmount: { status: "KNOWN", value: "20.00" }, sourceOperation: { kind: "resolved", id: row.operationId } });
    assert.ok(world.sources.simpleOccurrences.links.some(l => l.canonicalComponentKey === oldKey)); rebuild(world);
    assert.equal(findSlot(world, "restaurants").baselineValue.count, "2.00"); assert.equal(findSlot(world, "restaurants").baselineValue.unitAmount, "20.00"); });
  await test("C3-EXTRA-AMBIGUOUS-CHANNEL-GATED", () => { const world = fixture(), event = world.sources.simpleOccurrences.occurrences[0];
    const fast = world.sources.evidence.history.economicEntries.find(r => r.subcategory === "Fast-food / snack" && r.date.startsWith(event.startDate.slice(0,7)));
    world.sources.simpleOccurrences.links.push({ financialLinkId: "synthetic-conflicting-channel", lifeEventId: event.lifeEventId, canonicalComponentKey: `operation:${fast.operationId}`, relationType: "Paiement_activite", economicAmountLinked: fast.amount });
    rebuild(world); assert.equal(findSlot(world, "restaurants").historicalReferences.samples[0].value, null); });
  await test("C3-EXTRA-CURRENT-OBSERVATIONS-GATED", () => { const world = fixture(); world.forecast.predictionEvidence = { ...world.sources.evidence, bankObservations: [],
    currentEconomicEntries: [{ operationId: "synthetic-current", date: "2026-11-01", amount: "20.00", subcategory: "Restaurant", person: null, preciseType: null, merchant: null }] };
    world.asOfDate = "2026-11-02"; const p = evaluate(world, state([control("restaurants", { count: "1" })])); block(p, "OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED"); assert.equal(p.projection.plan.economicMonthEndRemainder, null); });
  await test("C3-EXTRA-WRITE-BOUNDARY", () => { for (const name of ["simple-baseline", "simple-capabilities", "simple-mappings"]) {
    const source = fs.readFileSync(`src/server/phase2/planner/${name}.ts`, "utf8"); assert.ok(!/\bderiveMonthScenario\b|\.\s*(?:insert|upsert|update|delete|rpc)\s*\(/u.test(source), name); }
    assert.equal(require("@/server/phase2/planner/repository").createPlanRepository(pg.client).applyRevision, undefined); });
  await test("C3-EXTRA-PROTECTED-ZERO-WRITES", async () => { current = fixture(); current.sources.monthInputs.declaredOutflows[0].adjustability = "PROTECTED"; rebuild(current);
    const semantic = state([control(`savings:${uuid(700)}`, { amount: "50.00" })]), p = await previewPlanScenario(deps, householdId, semantic), calls = pg.rpcCalls;
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PLANNER_APPLY_BLOCKED/u); assert.equal(pg.rpcCalls, calls); });
  await test("C3-EXTRA-CONTEXT-NOT-MEAL-OCCURRENCE", () => { const world = fixture(); world.sources.simpleOccurrences.occurrences[0].activityId = "visite_ami"; rebuild(world);
    assert.equal(findSlot(world, "restaurants").historicalReferences.samples[0].value, null, "a parent visit payment is not a meal occurrence"); });
  await test("C3-EXTRA-TEMPORAL-AUTHORITY-DIGEST", async () => { const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
    try { process.env.PHASE2_FORECAST_TEMPORAL_MODE = "FULL_MONTH_SAFE";
      const world = fixture(), semantic = state([control("groceries", { amount: "250.00" })]), p = await roundTrip(world, semantic);
      process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL";
      const next = evaluate(world, semantic); assert.notEqual(next.compiledManifestDigest, p.compiledManifestDigest);
      assert.equal(next.compiled.manifest.authorityEvidence.financialTemporalPolicy.mode, "AS_OF_TEMPORAL");
      assert.equal((await resolveEffectiveMonthScenario(deps, householdId, "2026-11")).evidenceStatus, "CHANGED_AUTHORITIES");
    } finally { if (configured === undefined) delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; else process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured; } });
  await test("C3-EXTRA-DISCRETE-PRESETS", () => { const world = fixture(), restaurant = findSlot(world, "restaurants");
    restaurant.historicalReferences.range = { low: "1.25", central: "2.50", high: "3.75" };
    const before = structuredClone(restaurant.historicalReferences), presets = capability(world, "restaurants").naturalPresets;
    assert.deepEqual(presets.map(p => p.value.count), ["1", "3", "4"]); assert.deepEqual(restaurant.historicalReferences, before);
    const grocery = findSlot(world, "groceries"); grocery.simpleAuthority.hardFloor = { amount: "1000.00", authority: "CANONICAL_OBSERVED_CONSUMPTION", evidenceRefs: ["synthetic:floor"] };
    assert.deepEqual(capability(world, "groceries").naturalPresets, []); });
  await test("C3-EXTRA-STALE-ZERO-WRITES", async () => { current = fixture(); const semantic = state([control("groceries", { amount: "250.00" })]), p = await previewPlanScenario(deps, householdId, semantic), writes = pg.rpcCalls;
    current.sources.evidence.history.economicEntries.find(r => r.subcategory.includes("Vape")).amount = "80.00"; rebuild(current);
    await assert.rejects(() => applyPlanScenario(deps, householdId, semantic, command(p)), /PLANNER_PREVIEW_STALE/u); assert.equal(pg.rpcCalls, writes); });
  await pg.verifyCanaries(); console.log(`C3_SIMPLE_CAPABILITIES_READY = YES (${passed.length} oracle groups)`);
  if (process.env.PLANNER_C3_REPORT_PATH) fs.writeFileSync(process.env.PLANNER_C3_REPORT_PATH, JSON.stringify({ gate: "C3_SIMPLE_CAPABILITIES_READY", status: "YES", passed,
    rpcEnvironment: "PGLITE_SYNTHETIC_ONLY", remoteWrites: 0, historicalCanaryWrites: 0 }, null, 2));
} finally { await pg.close(); }
