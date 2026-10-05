import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { require } from "./lib/phase2-ts-loader.mjs";
import { forecast, inputs } from "./check-phase2-october-contract.mjs";
import { planningHarness, item } from "./lib/planned-actions-harness.mjs";

const { deriveMonthScenario: derive, monthInputsSchema: schema, defaultMonthInputs } = require("@/server/phase2/month-scenario.ts");
const { parseMonthDecisionSettings: settings, defaultMonthDecisionSettings } = require("@/domain/phase2/month-decision-contract.ts");
const { parseMonthChoice } = require("@/domain/phase2/month-choice-contract.ts");
const { simulateMonthChoice: simulate, proposeMonthChoices: propose } = require("@/server/phase2/month-choices.ts");
const { projectCategoryControls: controls, categoryDecisionFacts } = require("@/server/phase2/month-category-controls.ts");
const { projectMonthDecision } = require("@/server/phase2/month-decision-projection.ts");
const monthly = require("@/server/phase2/month-inputs.ts"), realRead = monthly.readMonthInputs, realSave = monthly.saveMonthInputs;
const configured = process.env.PHASE2_FORECAST_TEMPORAL_MODE;
delete process.env.PHASE2_FORECAST_TEMPORAL_MODE;
const results = [], writes = [], touched = [];
const test = async (id, fn, kind = "BEHAVIOR") => { await fn(); results.push({ id, kind, status: "PASS" }); console.log(`${id} PASS`); };
const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const entries = months.flatMap(month => [
  { date: `${month}-02`, subcategory: "Courses alimentaires", amount: "100.00" },
  { date: `${month}-25`, subcategory: "Courses alimentaires", amount: "200.00" },
  { date: `${month}-08`, subcategory: "Restaurant", amount: "28.00" },
  { date: `${month}-24`, subcategory: "Restaurant", amount: "28.00" },
  { date: `${month}-05`, subcategory: "Bureau de tabac / presse", amount: "100.00" },
  { date: `${month}-09`, subcategory: "Boulangerie", amount: "8.00", person: "Adrien", preciseType: "Repas du midi au travail" },
].map((row, index) => ({ operationId: `${month}:${index}`, person: null, preciseType: null, merchant: null, ...row })));
const evidence = { history: { startMonth: months[0], endMonth: months.at(-1), economicEntries: entries, mobilityLegs: [] },
  currentEconomicEntries: [], currentMobilityLegs: [], observedThrough: "2026-09-30", coverageThrough: "2026-09-30", completeMonths: months, personNamesById: {} };
const live = { ...forecast, meta: { ...forecast.meta, sourceRevision: 1 }, predictionEvidence: evidence, forecastMemory: [] };
const saving = { id: randomUUID(), label: "Noël", amount: "80.00", dueDate: null, kind: "SAVINGS", source: "MONTH_INPUT", annualGoalRef: null, adjustability: "ADJUSTABLE" };
const current = schema.parse({ ...inputs, decision: defaultMonthDecisionSettings(), declaredOutflows: [...inputs.declaredOutflows, saving] });
const context = (extra = {}) => ({ forecast: live, inputs: current, expenses: [], asOf: "2026-10-18", ...extra });
const run = ctx => derive(ctx.forecast, ctx.inputs, null, ctx.asOf, ctx.expenses).economicPlan;
const cat = (plan, key) => [...plan.narrative.prediction.essential, ...plan.narrative.prediction.optional].find(row => row.key === key);
const choice = (categoryKey = "groceries", strategy = "REDUCE_AMOUNT", value = "20.00") => ({ operations: [{ kind: "CATEGORY", categoryKey, strategy,
  ...(strategy === "REDUCE_AMOUNT" ? { amount: value } : strategy === "REDUCE_PERCENT" ? { percent: value } : {}) }] });
const savingsChoice = (row = saving, amount = "42.00") => ({ operations: [{ kind: "SAVINGS", savingsId: row.id, strategy: "ADJUST_SAVINGS", amount }] });
const withTarget = (amount, forecastAmount, realized = "0.00") => {
  const observed = Number(realized) ? [{ ...entries[0], operationId: "actual-groceries", date: "2026-10-02", amount: realized }] : [];
  return context({ inputs: schema.parse({ ...current, decision: { ...current.decision, categoryTargets: { groceries: amount },
    assumptions: { groceries: { mode: "CUSTOM", amount: (Number(forecastAmount) - Number(realized)).toFixed(2) } } } }),
    forecast: { ...live, predictionEvidence: { ...evidence, currentEconomicEntries: observed } } });
};
const h = planningHarness(), originalFrom = h.client.from.bind(h.client);
h.facts.inputs["2026-10"] = structuredClone(current);
h.client.from = table => {
  touched.push(table);
  assert(["phase2_month_inputs", "phase2_planned_expenses", "persons"].includes(table), `Historical authority reached: ${table}`);
  if (table !== "phase2_month_inputs") return originalFrom(table);
  const filters = {};
  return { select() { return this; }, eq(key, value) { filters[key] = value; return this; },
    async maybeSingle() { assert.equal(filters.household_id, h.householdId); const payload = h.facts.inputs[filters.target_month.slice(0, 7)];
      return { data: payload ? { payload: structuredClone(payload), updated_at: null, updated_by: h.userId } : null, error: null }; },
    async upsert(row, options) { assert.equal(row.household_id, h.householdId); assert.equal(row.updated_by, h.userId);
      assert.equal(options.onConflict, "household_id,target_month"); h.facts.inputs[row.target_month.slice(0, 7)] = structuredClone(row.payload);
      writes.push({ table, operation: "upsert" }); return { error: null }; } };
};
monthly.readMonthInputs = realRead; monthly.saveMonthInputs = realSave;
require("@/server/phase2/planning-date.ts").planningDate = () => "2026-10-18";
const snapshots = require("@/server/phase2/month-forecast-snapshot.ts");
snapshots.queryMonthForecast = snapshots.resolvePlanningMonthForecast = async () => live;
const actions = require("@/app/mois-a-venir/actions.ts");
const form = values => { const f = new FormData(); for (const [key, value] of Object.entries({ targetMonth: "2026-10", ...values })) f.set(key, value); return f; };

const { projectMonthControlCenter: model, projectMonthControlWorkbench: workbench } = require("@/server/phase2/month-control-center.ts");
const { monthControlUrl, monthControlSection, parseMonthControlPurpose, parseMonthControlDraft, replaceMonthControlOperation, monthChoiceTarget } = require("@/domain/phase2/month-control-contract.ts");
const source = path => fs.readFileSync(`src/${path}`, "utf8");
const ui = source("app/mois-a-venir/month-control-center.tsx") + source("app/mois-a-venir/month-control-choices.tsx") + source("app/mois-a-venir/month-control-simulator.tsx"), view = source("app/mois-a-venir/month-forecast-view.tsx"), story = source("app/mois-a-venir/month-story.tsx"),
  panels = source("app/mois-a-venir/month-control-panels.tsx"), nav = source("app/mois-a-venir/month-section-nav.tsx"), cards = source("app/mois-a-venir/month-narrative-cards.tsx");
const offset = { kind: "CATEGORY_OVERAGE_OFFSET", categoryKey: "groceries" }, correction = { kind: "CATEGORY_CORRECTION", categoryKey: "groceries" };
const base = withTarget("300.00", "342.00"), restaurant = choice("household-restaurants", "REDUCE_ONE_OCCURRENCE").operations[0], groceries = choice("groceries", "REDUCE_AMOUNT", "14.00").operations[0];
const wb = (ops = [], purpose = offset, ctx = base) => workbench(ctx, purpose, ops);
const reset = (next = base.inputs) => { h.facts.inputs["2026-10"] = structuredClone(next); };
const noWrites = () => writes.length + h.client.writes.length;
await test("CC-001", () => { assert.equal(fs.existsSync("supabase/migrations/20261004_month_control_center.sql"), false); assert(!view.includes("choiceOffers")); }, "STATIC");
await test("CC-002", () => { const m = model(base), p = run(base); assert.deepEqual(m.projectionSummary.economic, p.narrative.final); assert.deepEqual(m.projectionSummary.bank, p.bankCash.endOfMonth); });
await test("CC-003", () => { const m = model(base); assert.equal(m.forecastNature, "FORECAST"); assert(m.observations.every(row => row.nature === "FACT")); assert(m.activeIntentions.every(row => row.nature === "INTENTION")); assert(m.activeDecisions.every(row => row.nature === "DECISION")); assert.equal(wb().consequenceNature, "CONSEQUENCE"); });
await test("CC-004", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, goal: "1.00" } }) }, m = model(ctx); assert.equal(m.categoryTensions[0].amount, "42.00"); assert.equal(m.globalTensions.length, 0); assert.equal(m.monthState, "CATEGORY_ATTENTION"); assert.equal(m.defaultPurpose.kind, "CATEGORY_CORRECTION"); });
await test("CC-005", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, goal: (Number(run(base).narrative.final.central) + 42).toFixed(2) } }) }; assert.equal(model(ctx).globalTensions[0].amount, "42.00"); assert.equal(model(ctx).defaultPurpose.kind, "GLOBAL_GOAL"); });
await test("CC-006", () => { const m = model(withTarget("300", "327", "315")); assert(m.categoryTensions[0].alreadyOver); const result = wb([choice("groceries", "REDUCE_AMOUNT", "50").operations[0]], correction, withTarget("300", "327", "315")); assert.equal(result.remainingNeed, "15.00"); assert.equal(result.scenario.categoryControls.find(c => c.key === "groceries").forecast, "315.00"); });
await test("CC-007", () => { const rows = model(base).rootCauses.filter(row => row.key === "wallet:SWILE"); assert.equal(rows.length, 1); assert(rows[0].symptoms.length > 0); assert(rows[0].scopes.includes("BENEFIT_FUNDING")); assert(!rows[0].scopes.includes("ECONOMIC_MONTH")); });
await test("CC-008", () => assert.equal(model(base).rootCauses.filter(row => row.key === "wallet:EDENRED").length, 1));
await test("CC-009", () => { const m = model(base); assert.equal(m.rootCauses.filter(row => row.key === "imports").length, 1); assert.equal(m.rootCauses.find(row => row.key === "imports").actionable, false); assert(Number(m.categoryControls.find(row => row.key === "groceries").forecast) > 0); assert.equal(m.actionableCount, m.update.groups.NEEDS_UPDATE.length); });
await test("CC-010", () => assert(model(base).activeDecisions.some(row => row.key === "assumption:groceries")));
await test("CC-011", () => assert(model(base).activeIntentions.some(row => row.key === "target:groceries")));
await test("CC-012", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, goal: "50.00" } }) }; assert(model(ctx).activeIntentions.some(row => row.key === "goal")); });
await test("CC-013", () => assert(model(base).reservations.some(row => row.value.includes("1 200") && row.nature === "RESERVATION")));
await test("CC-014", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, openingBalance: { amount: "500.00", asOfDate: base.asOf } }) }; assert.equal(model(ctx).observations[0].amount, "500.00"); assert(!model(ctx).activeDecisions.some(row => row.key === "bank")); });
await test("CC-015", () => assert(nav.indexOf("<MonthControlLink") < nav.indexOf("+ Ajouter une dépense")), "STATIC");
await test("CC-016", () => assert(!nav.includes('"Choix"') && !nav.includes("decision-tools")), "STATIC");
await test("CC-017", () => assert(!story.includes("MonthDecisionTools")), "STATIC");
await test("CC-018", () => assert(!view.includes("Améliorer la précision du mois") && !view.includes('id="complete-month"')), "STATIC");
await test("CC-019", () => assert(!cards.includes("CategoryTargetEditor") && cards.includes("MonthControlLink")), "STATIC");
await test("CC-020", () => assert(story.includes("controls={false}") && source("app/mois-a-venir/month-savings-section.tsx").includes("controls ? <details")), "STATIC");
await test("CC-021", () => assert(panels.includes("<MonthUpdateSpatial") && story.includes("controls={false}")), "STATIC");
await test("CC-022", () => assert(cards.includes('section="choices" focus={control.key}')), "STATIC");
await test("CC-023", () => { assert(source("server/phase2/month-update-presentation.ts").includes('for (const provider of ["SWILE", "EDENRED"]')); assert.equal(model(base).destinations.SWILE.focus, "SWILE"); }, "STATIC");
await test("CC-024", () => assert(model(base).reservations[0].destination.focus.startsWith("reserve-")));
await test("CC-025", () => { assert(ui.includes("<OverlayFrame")); assert(ui.includes("backgroundRootRef={background}")); const overlay = source("ui/overlays/overlay-frame.tsx"); for (const owner of ["activateOverlayFocusTrap", "acquireOverlayScrollLock", "scheduleOverlayFocusRestoration", 'role="dialog"', '"Escape"']) assert(overlay.includes(owner)); assert(!ui.includes("createPortal")); }, "STATIC");
await test("CC-026", () => { const url = monthControlUrl("http://localhost/mois-a-venir?month=2026-10", "choices", "groceries"); assert.equal(url, "/mois-a-venir?month=2026-10&control=center&focus=pilot%3Acategory%3Agroceries"); assert(!url.includes("operations")); assert.equal(monthControlSection("fake"), null); assert.throws(() => parseMonthControlPurpose({ kind: "FREE_EXPLORATION", extra: 1 })); });
await test("CC-027", () => { assert(view.includes("key={targetMonth}")); assert(ui.includes('searchParams.get("control")')); assert(ui.includes("initialFocus")); }, "STATIC");
await test("CC-028", async () => { const before = noWrites(), bad = await actions.updateMonthControlInputs(form({ intent: "save-category-target", categoryKey: "groceries", categoryTarget: "-2" })); assert.equal(bad.ok, false); assert.equal(noWrites(), before); assert(ui.includes("Votre saisie est conservée")); });
await test("CC-029", async () => { reset(); const before = noWrites(); const p = await actions.previewMonthControlCenter("2026-10", offset, []); assert.equal(p.preview, null); assert.equal(p.operations.length, 0); assert.equal(noWrites(), before); });
await test("CC-030", async () => { const before = noWrites(); const p = await actions.previewMonthControlCenter("2026-10", offset, [restaurant]); assert.equal(p.budgetMarginGain, "28.00"); assert.equal(noWrites(), before); });
await test("CC-031", async () => { const before = noWrites(); const p = await actions.previewMonthControlCenter("2026-10", offset, [restaurant, groceries]); assert.equal(p.budgetMarginGain, "42.00"); assert.equal(noWrites(), before); });
await test("CC-032", () => { const p = wb([restaurant, groceries]); assert.deepEqual(p.preview, simulate(base, { operations: [restaurant, groceries] }).view); assert.deepEqual(p.scenario.projectionSummary.economic, simulate(base, { operations: [restaurant, groceries] }).plan.narrative.final); });
await test("CC-033", () => { const before = wb(), after = wb([restaurant]); assert.equal(before.remainingNeed, "42.00"); assert.equal(after.remainingNeed, "14.00"); assert(after.offers.some(row => row.operation.amount === "14.00")); });
await test("CC-034", () => { const result = replaceMonthControlOperation([groceries], { ...groceries, amount: "22.00" }); assert.equal(result.length, 1); assert.equal(result[0].amount, "22.00"); });
await test("CC-035", () => { assert.throws(() => replaceMonthControlOperation([restaurant, groceries], savingsChoice().operations[0]), /MONTH_CONTROL_DRAFT_FULL/u); assert.throws(() => parseMonthControlDraft([restaurant, groceries, savingsChoice().operations[0]])); assert.throws(() => parseMonthControlDraft([groceries, groceries])); });
await test("CC-036", () => { const p = wb([restaurant]); assert(!p.offers.some(row => monthChoiceTarget(row.operation) === monthChoiceTarget(restaurant))); });
await test("CC-037", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, goal: (Number(run(base).narrative.final.central) + 28).toFixed(2) } }) }; const p = wb([restaurant], { kind: "GLOBAL_GOAL" }, ctx); assert.equal(p.remainingNeed, "0.00"); assert(p.resolved); assert.equal(p.offers.length, 0); });
await test("CC-038", () => { const p = wb([{ ...groceries, amount: "42.00" }], correction); assert(p.resolved); assert.equal(p.offers.length, 0); assert.equal(p.scenario.categoryTensions.length, 0); });
await test("CC-039", () => { const p = wb([restaurant], correction); assert.equal(p.remainingNeed, "42.00"); assert(!p.resolved); assert.equal(p.scenario.categoryTensions[0].amount, "42.00"); assert(p.offers.every(row => row.operation.categoryKey === "groceries")); });
await test("CC-040", () => { const p = wb([restaurant]); assert.equal(p.remainingNeed, "14.00"); assert.equal(p.scenario.categoryTensions[0].amount, "42.00"); const savingOffer = p.offers.find(row => row.operation.kind === "SAVINGS"); assert.equal(savingOffer.operation.amount, "14.00"); assert.equal(savingOffer.remainingNeedAfter, "0.00"); });
await test("CC-041", () => { const row = { ...saving, amount: "8.00" }, ctx = { ...base, inputs: schema.parse({ ...base.inputs, declaredOutflows: [base.inputs.declaredOutflows[0], row] }) }; const p = wb([restaurant, savingsChoice(row, "14.00").operations[0]], offset, ctx); assert.equal(p.reservationRelease, "8.00"); assert.equal(p.remainingNeed, "6.00"); });
await test("CC-042", () => { const p = wb(); assert(!p.offers.some(row => row.operation.savingsId === base.inputs.declaredOutflows[0].id)); assert.throws(() => wb([savingsChoice(base.inputs.declaredOutflows[0]).operations[0]]), /PROTECTED/u); });
await test("CC-043", () => { const p = wb([restaurant, groceries]); assert.equal(p.model.projectionSummary.protectedSavings, "1200.00"); assert.equal(p.scenario.projectionSummary.protectedSavings, "1200.00"); });
await test("CC-044", () => { const p = wb([restaurant]); assert.equal(p.spendingReduction, "28.00"); assert.equal(p.reservationRelease, "0.00"); });
await test("CC-045", () => { const p = wb([savingsChoice().operations[0]]); assert.equal(p.spendingReduction, "0.00"); assert.equal(p.reservationRelease, "42.00"); assert.equal(p.scenario.categoryTensions[0].amount, "42.00"); });
await test("CC-046", () => { const p = wb([restaurant, savingsChoice(saving, "14.00").operations[0]]); assert.equal(p.spendingReduction, "28.00"); assert.equal(p.reservationRelease, "14.00"); assert.equal(p.budgetMarginGain, "42.00"); });
await test("CC-047", () => { const first = simulate(base, { operations: [groceries] }); const p = wb([groceries], offset, { ...base, inputs: first.nextInputs }); assert.equal(p.selected.find(row => row.target === "category:groceries").before, "328.00"); assert.equal(p.selected[0].after, "314.00"); });
await test("CC-048", () => { const ctx = { ...base, inputs: schema.parse({ ...base.inputs, decision: { ...base.inputs.decision, goal: "1.00" } }) }; const p = wb([], { kind: "GLOBAL_GOAL" }, ctx); assert(p.resolved); assert.equal(p.offers.length, 0); });
await test("CC-049", () => { const ctx = context(), p = wb([], { kind: "NONE" }, ctx); assert.equal(p.offers.length, 0); assert.equal(model(ctx).monthState, "CALM"); assert(wb([], { kind: "FREE_EXPLORATION" }, ctx).offers.length > 0); });
await test("CC-050", async () => { reset(); const p = await actions.previewMonthControlCenter("2026-10", offset, [restaurant, groceries]); const before = noWrites(); h.facts.inputs["2026-10"].resourceOverrides = { "income:Promotrans": "1500.00" }; const result = await actions.applyMonthChoice("2026-10", { operations: [restaurant, groceries] }, p.baseDigest); assert.equal(result.ok, false); assert.equal(result.code, "STALE_PREVIEW"); assert.equal(noWrites(), before); reset(); });
await test("CC-051", async () => { const p = await actions.previewMonthControlCenter("2026-10", offset, [restaurant]); h.facts.inputs["2026-10"].openingBalance = { amount: "200", asOfDate: "2026-10-18" }; const fresh = await actions.previewMonthControlCenter("2026-10", offset, [restaurant]); assert.notEqual(p.baseDigest, fresh.baseDigest); assert(ui.includes("previousDigest.current = model.baseDigest")); assert(ui.includes("requested.current !== key")); reset(); });
await test("CC-052", async () => { const p = await actions.previewMonthControlCenter("2026-10", offset, [restaurant, groceries]), before = writes.length; const result = await actions.applyMonthChoice("2026-10", { operations: [restaurant, groceries] }, p.baseDigest); assert(result.ok); assert.equal(writes.length - before, 1); const reload = await realRead(h.client, h.householdId, "2026-10"); assert.deepEqual(run({ ...base, inputs: reload.inputs }).narrative.final, p.preview.after); });
await test("CC-053", () => assert(touched.every(table => !/operation|ledger/u.test(table))));
await test("CC-054", () => assert.equal(h.client.writes.length, 0));
await test("CC-055", () => assert(touched.every(table => !/purchase/u.test(table))));
await test("CC-056", () => { assert(ui.includes("setOperations([])")); assert(ui.includes("setTrial(null)")); assert(!ui.slice(ui.indexOf("const apply"), ui.indexOf("const sendForm")).includes("close()")); assert(ui.includes("router.refresh()")); }, "STATIC");
await test("CC-057", async () => { const result = await actions.updateMonthControlInputs(form({ intent: "clear-month-assumption", categoryKey: "groceries" })); assert(result.ok); assert(!h.facts.inputs["2026-10"].decision.assumptions.groceries); });
await test("CC-058", async () => { const result = await actions.updateMonthControlInputs(form({ intent: "clear-category-target", categoryKey: "groceries" })); assert(result.ok); assert(!model({ ...base, inputs: h.facts.inputs["2026-10"] }).categoryTensions.some(row => row.categoryKey === "groceries")); });
await test("CC-059", async () => { reset(); const key = live.components.find(row => row.nature === "CONTRACTUAL_EXPECTED" && row.additiveGroup === "obligations" && row.central !== null).key; assert((await actions.updateMonthControlInputs(form({ intent: "exclude-fixed", componentKey: key }))).ok); assert(h.facts.inputs["2026-10"].excludedFixedObligations.includes(key)); assert((await actions.updateMonthControlInputs(form({ intent: "restore-fixed", componentKey: key }))).ok); assert(!h.facts.inputs["2026-10"].excludedFixedObligations.includes(key)); });
await test("CC-060", async () => { const key = live.components.find(row => row.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/u.test(row.label)).key; assert((await actions.updateMonthControlInputs(form({ intent: "unknown-conditional", componentKey: key }))).ok); assert(model({ ...base, inputs: h.facts.inputs["2026-10"] }).rootCauses.some(row => row.key === `conditional:${key}`)); assert((await actions.updateMonthControlInputs(form({ intent: "decline-conditional", componentKey: key }))).ok); assert(!model({ ...base, inputs: h.facts.inputs["2026-10"] }).rootCauses.some(row => row.key === `conditional:${key}`)); });
await test("CC-061", async () => { reset(); const before = run({ ...base, inputs: h.facts.inputs["2026-10"] }).narrative.final; assert((await actions.updateMonthControlInputs(form({ intent: "add-wallet-balance-observation", provider: "SWILE", walletBalanceAmount: "80.00", walletBalanceDate: "2026-10-18" }))).ok); assert.deepEqual(run({ ...base, inputs: h.facts.inputs["2026-10"] }).narrative.final, before); });
await test("CC-062", () => { const m = model({ ...base, inputs: h.facts.inputs["2026-10"] }); assert.equal(m.resourceInputs.wallets.SWILE.balanceObservations.at(-1).amount, "80.00"); assert.equal(m.resourceInputs.projections.SWILE.expectedLoading.amount, "190.00"); });
await test("CC-063", () => { const p = run({ ...base, inputs: h.facts.inputs["2026-10"] }); assert.notEqual(p.benefitWallets.SWILE.currentBalanceKnowledge.amount, p.bankCash.currentRealBankBalance.amount); assert(source("app/mois-a-venir/month-control-update.tsx").includes("n’est jamais confondu avec le solde actuel")); });
await test("CC-064", () => { const p = wb([savingsChoice().operations[0]]); assert.equal(p.scenario.projectionSummary.categoryGap, p.model.projectionSummary.categoryGap); });
await test("CC-065", () => { const p = wb([groceries]); assert.equal(p.scenario.projectionSummary.protectedSavings, p.model.projectionSummary.protectedSavings); });
await test("CC-066", () => { const early = wb([groceries], correction, { ...base, asOf: "2026-10-01" }), late = wb([groceries], correction, { ...base, asOf: "2026-10-28" }); assert.deepEqual(early.preview.after, late.preview.after); assert.equal(early.model.reliability.mode, "FULL_MONTH_SAFE"); });
await test("CC-067", () => { process.env.PHASE2_FORECAST_TEMPORAL_MODE = "AS_OF_TEMPORAL"; try { const p = wb([restaurant]); assert.deepEqual(p.preview, simulate(base, { operations: [restaurant] }).view); assert.equal(p.model.reliability.mode, "AS_OF_TEMPORAL"); } finally { delete process.env.PHASE2_FORECAST_TEMPORAL_MODE; } });
await test("CC-068", () => { assert(model(base).reliability.modeLabel.includes("prudent")); assert(source("components/layout/app-shell.tsx").includes('href="/diagnostic"')); assert(!panels.includes("reliability.publicationId")); }, "STATIC");
await test("CC-069", () => assert(!panels.includes("<PreserveForecastButton")), "STATIC");
await test("CC-070", async () => { const before = noWrites(); await actions.previewMonthControlCenter("2026-10", offset, []); model(base); assert.equal(noWrites(), before); assert(!view.includes("preserveMonthForecast(")); });
await test("CC-071", () => { const ctx = { ...base, inputs: defaultMonthInputs() }, m = model(ctx); assert.equal(m.monthState, "INCOMPLETE"); assert.equal(m.projectionSummary.economic, null); assert(view.includes("<MonthSectionNav")); assert(source("server/phase2/month-update-presentation.ts").includes("bank: plan?.bankCash ?? null")); });
await test("CC-072", async () => { const before = noWrites(); assert.equal((await actions.updateMonthControlInputs(form({ targetMonth: "2026-09", intent: "save-category-target", categoryKey: "groceries", categoryTarget: "300" }))).ok, false); assert.equal(noWrites(), before); assert(source("app/mois-a-venir/page.tsx").includes("return <PastMonthView")); });
await test("CC-073", () => assert(story.includes("<PlannedExpensesControl") && view.includes("<PlannedExpenseInteractions>")), "STATIC");
await test("CC-074", () => { const ctx = { ...base, expenses: [{ id: randomUUID(), targetMonth: "2026-10", status: "PLANNED", title: "Projet synthétique", plannedDate: "2026-10-02", context: {}, costItems: [item()] }] }; const m = model(ctx); assert(m.rootCauses.some(row => row.projectId === ctx.expenses[0].id)); assert(!ui.includes("showProject")); assert(!ui.includes("PlannedExpenseBuilder")); });
await test("CC-075", () => { const order = ["resources-title", "outflows-title", "after-title", "<MonthSavingsSection", "after-savings-title", "<PlannedExpensesControl", "<MonthCalendar", "necessary-title", "Après l’essentiel du mois", "flexible-title", "Projection de fin de mois"].map(key => story.indexOf(key)); assert(order.every((value, i) => value > -1 && (!i || value > order[i - 1]))); }, "STATIC");
await test("CC-076", () => assert(!ui.includes("Probable ce mois") && !panels.includes("Probable ce mois")), "STATIC");
await test("CC-077", () => assert(!ui.includes("contextualEffect") && !source("server/phase2/month-control-center.ts").includes("contextualEffect")), "STATIC");
await test("CC-078", () => { const p = wb([restaurant]); assert.deepEqual(p.preview.after, simulate(base, { operations: [restaurant] }).view.after); assert(!source("server/phase2/month-control-center.ts").includes("referenceQuantile(")); assert.equal(typeof p.model.reliability.calibrationAvailable, "boolean"); });
await test("CC-079", () => assert(!source("server/phase2/month-control-center.ts").includes("deriveMobility") && !ui.includes("routeSegments")), "STATIC");
await test("CC-080", () => { assert(touched.every(table => ["phase2_month_inputs", "phase2_planned_expenses", "persons"].includes(table))); assert.equal(h.client.writes.length, 0); assert(!writes.some(row => row.table !== "phase2_month_inputs")); });
await test("CC-081", () => { const { monthChoiceDigest } = require("@/server/phase2/month-choices.ts"); const timestampOnly = { ...base, forecast: { ...base.forecast, meta: { ...base.forecast.meta, computedAt: "2026-10-18T23:59:59Z" } } }; assert.equal(monthChoiceDigest(base), monthChoiceDigest(timestampOnly)); assert.notEqual(monthChoiceDigest(base), monthChoiceDigest({ ...base, forecast: { ...base.forecast, meta: { ...base.forecast.meta, sourceRevision: 2 } } })); });
await test("CC-082", () => { const helper = source("server/phase2/month-planning-read.ts"); assert(helper.includes("export async function readPlanningMonthForecast")); assert(source("app/mois-a-venir/page.tsx").includes("await readPlanningMonthForecast")); assert(source("app/mois-a-venir/actions.ts").includes("await readPlanningMonthForecast")); assert(helper.includes('error.message !== "FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING"')); }, "STATIC");
await test("CC-083", async () => {
  const { readPlanningMonthForecast } = require("@/server/phase2/month-planning-read.ts"); const originalQuery = snapshots.queryMonthForecast, originalResolve = snapshots.resolvePlanningMonthForecast;
  let rebuilt = 0; snapshots.resolvePlanningMonthForecast = async () => { rebuilt++; return live; };
  try {
    snapshots.queryMonthForecast = async () => live; assert.equal(await readPlanningMonthForecast({}, h.householdId, "2026-10"), live); assert.equal(rebuilt, 0);
    snapshots.queryMonthForecast = async () => { throw new TypeError("FORECAST_ACTIVE_MONTH_SNAPSHOT_MISSING"); }; assert.equal(await readPlanningMonthForecast({}, h.householdId, "2026-11"), live); assert.equal(rebuilt, 1);
    snapshots.queryMonthForecast = async () => { throw new TypeError("FORECAST_SNAPSHOT_IDENTITY_MISMATCH"); }; await assert.rejects(readPlanningMonthForecast({}, h.householdId, "2026-10"), /IDENTITY_MISMATCH/u); assert.equal(rebuilt, 1);
  } finally { snapshots.queryMonthForecast = originalQuery; snapshots.resolvePlanningMonthForecast = originalResolve; }
});
await test("CC-084", () => { assert(ui.includes("window.history.replaceState(null,")); assert(ui.includes("restoreFocusRef={invoker}")); assert(source("app/mois-a-venir/resource-editor.tsx").includes('`loading-${controlFocus}`')); }, "STATIC");
await test("CC-085", async () => { reset(); const before = run({ ...base, inputs: h.facts.inputs["2026-10"] });
  assert((await actions.updateMonthControlInputs(form({ intent: "save-wallet-expected-loading", provider: "SWILE", walletLoadingAmount: "200.00", walletLoadingDate: "2026-10-20" }))).ok);
  const after = run({ ...base, inputs: h.facts.inputs["2026-10"] });
  for (const key of ["adrien-work-meals", "manon-work-meals"]) assert.deepEqual(cat(before, key).projectedMonth, cat(after, key).projectedMonth);
  assert.equal(after.benefitWallets.SWILE.expectedLoading.amount, "200.00"); reset();
});
if (configured !== undefined) process.env.PHASE2_FORECAST_TEMPORAL_MODE = configured;
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/phase2-month-control-center-tests.json", JSON.stringify({ status: "PASS", scope: "Offline fixtures; real owners/actions, mocked authenticated transport only. STATIC tests are source boundary checks, not browser evidence.", historicalWrites: 0, plannedExpenseWrites: 0, monthlyFixtureWrites: writes.length, results }, null, 2));
console.log(`PASS ${results.length}/85 month control center checks`);
