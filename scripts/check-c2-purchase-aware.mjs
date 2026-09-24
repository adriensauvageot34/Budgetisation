import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) {
  return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename },
).outputText, filename);

const {
  addEconomicAmounts, projectPurchaseAwareCanonical, purchaseGrossAmount,
  purchaseIdentityKeyOfEconomicFact, resolveEffectivePurchaseEconomicOwner,
} = require(path.resolve("src/analytics/facts/purchase-aware.ts"));
const { parseEconomicComponentFact } = require(path.resolve("src/analytics/facts/validation.ts"));
const { CanonicalRepository } = require(path.resolve("src/server/canonical/repository.ts"));
const { resolveGlobalM8PurchaseAuthority } = require(path.resolve("src/server/analytics/global-v2-purchase-authority.ts"));

let checks = 0;
const check = (fn) => { fn(); checks++; };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), operationId = uuid(2), nativeId = uuid(3);
const range = { start: "2026-09-01", endExclusive: "2026-10-01" };
const legacy = {
  fact: "fct_economic_component", householdId,
  canonicalComponentKey: `operation:${operationId}`,
  sourceOperation: { kind: "resolved", id: operationId },
  gross: "5.8", refundApplied: "0", net: "5.8",
};
const timingAssertions = [{
  authority: "TRUSTED_PURCHASE_SOURCE", precision: "DAY", economicDate: "2026-09-12",
  economicMonth: "2026-09-01", evidenceRefs: ["source:date"],
}];
const source = (kind, id, membershipKind = "CONSUMPTION_COMPONENT") => ({
  purchaseEventId: uuid(10), membershipKind, kind, sourceId: id,
  canonicalComponentKey: `${kind}:${id}`, evidenceRefs: ["source:owner"],
  provenance: "STRUCTURED_CANONICAL_SOURCE",
});
const nativeSource = source("purchase_component", nativeId);
const native = {
  purchaseComponentId: nativeId, canonicalComponentKey: nativeSource.canonicalComponentKey,
  purchaseEventId: uuid(10), categoryId: uuid(4), subcategoryId: uuid(5),
  needId: uuid(6), merchantId: uuid(7),
};
const purchase = (options = {}) => ({
  purchaseEventId: uuid(10), householdId, grossAmount: "25", grossAmountStatus: "KNOWN",
  sources: [nativeSource], timingAssertions, nativeComponent: native,
  classifications: [], ...options,
});
const project = (purchases, visibility = "PURCHASE_AWARE_PILOT", legacyFacts = []) =>
  projectPurchaseAwareCanonical({ visibility, householdId, range, legacyFacts, purchases });

// F1: Benefit-only has one native economic owner, no Operation and no bank amount.
let result = project([purchase()]);
check(() => assert.equal(result.facts.length, 1));
check(() => assert.equal(result.status, "PASS"));
check(() => assert.equal(result.facts[0].economicAmount.value, "25"));
check(() => assert.equal(result.facts[0].sourceOperation.kind, "not_applicable"));
check(() => assert.equal(result.facts[0].bankAmount.status, "NOT_APPLICABLE"));
check(() => assert.equal(result.facts[0].purchaseIdentityKey, `purchase:${uuid(10)}`));
check(() => assert.equal(purchaseIdentityKeyOfEconomicFact(result.facts[0]), `purchase:${uuid(10)}`));
check(() => assert.equal(result.facts[0].timing.authority, "TRUSTED_PURCHASE_SOURCE"));
check(() => assert.equal(result.facts[0].taxonomy.needId, uuid(6)));
check(() => assert.equal(project([purchase()], "DEFAULT").facts.length, 0));

// F2: replace the Operation economic amount, retaining its original bank amount.
const mixed = purchase({
  grossAmount: "30.80", sources: [source("operation", operationId)], nativeComponent: undefined,
  bankAmount: "5.80", operationClassificationValues: { NECESSITY: "Contraint", BEHAVIOR: "Variable", LIFE_SCOPE: "Vie courante" },
});
result = project([mixed], "PURCHASE_AWARE_PILOT", [legacy]);
check(() => assert.equal(result.facts.length, 1));
check(() => assert.equal(result.facts[0].canonicalComponentKey, `operation:${operationId}`));
check(() => assert.equal(result.facts[0].economicAmount.value, "30.8"));
check(() => assert.equal(result.facts[0].bankAmount.value, "5.8"));
check(() => assert.equal(legacy.net, "5.8"));
check(() => assert.equal(result.facts[0].classification.necessity.value, "Contraint"));
check(() => assert.equal(project([{ ...mixed, operationOwnerSourceKind: "Operation_residual" }], "PURCHASE_AWARE_PILOT", [legacy]).facts[0].sourceKind, "Operation_residual"));
const splitLegacy = { ...legacy, canonicalComponentKey: `allocation:${uuid(8)}` };
check(() => assert.equal(project([mixed], "PURCHASE_AWARE_PILOT", [legacy, splitLegacy]).facts.length, 1));
check(() => assert.equal(project([mixed], "PURCHASE_AWARE_PILOT", [legacy]).facts[0].reconciliation, "PURCHASE_OWNER_RECONCILED"));
check(() => assert.equal(project([{ ...mixed, purchaseTaxonomy: {
  categoryId: uuid(40), subcategoryId: uuid(41), needId: uuid(42), merchantId: uuid(43),
}, semanticPurpose: "WORK_LUNCH" }], "PURCHASE_AWARE_PILOT", [legacy]).facts[0].taxonomy.subcategoryId, uuid(41)));
check(() => assert.equal(project([purchase({ ...mixed, operationCanonicalFactCount: 0 })], "PURCHASE_AWARE_PILOT", [legacy]).blocking[0].reason, "OPERATION_CANONICAL_OWNER_ABSENT"));

// F3: funding composition is explanatory; gross is read once from the event.
const benefitOther = purchase({ grossAmount: "24.46", funding: [{ kind: "BENEFIT_WALLET", amount: "4.46" }, { kind: "OTHER", amount: "20" }] });
check(() => assert.equal(project([benefitOther]).facts[0].economicAmount.value, "24.46"));

// F4: PARTIAL is an explicit lower bound, independently of exact day timing.
const lower = purchase({ grossAmount: "9.40", grossAmountStatus: "PARTIAL" });
result = project([lower]);
check(() => assert.deepEqual(result.facts[0].economicAmount, { status: "LOWER_BOUND", minimum: "9.4" }));
check(() => assert.equal(result.facts[0].timing.status, "KNOWN"));
check(() => assert.deepEqual(addEconomicAmounts(purchaseGrossAmount("KNOWN", "5"), purchaseGrossAmount("PARTIAL", "9.4")), { status: "LOWER_BOUND", minimum: "14.4" }));
check(() => assert.deepEqual(addEconomicAmounts(purchaseGrossAmount("PARTIAL", "9.4"), purchaseGrossAmount("PARTIAL", "1")), { status: "LOWER_BOUND", minimum: "10.4" }));
check(() => assert.deepEqual(addEconomicAmounts(purchaseGrossAmount("KNOWN", "5"), purchaseGrossAmount("KNOWN", "1")), { status: "KNOWN", value: "6" }));
check(() => assert.equal(addEconomicAmounts(purchaseGrossAmount("UNKNOWN", null), purchaseGrossAmount("KNOWN", "1")).status, "UNKNOWN"));
check(() => assert.equal(addEconomicAmounts(purchaseGrossAmount("CONFLICT", null), purchaseGrossAmount("KNOWN", "1")).status, "CONFLICT"));
check(() => assert.equal(project([purchase({ grossAmount: null, grossAmountStatus: "UNKNOWN" })]).facts[0].economicAmount.status, "UNKNOWN"));
check(() => assert.equal(project([purchase({ grossAmount: null, grossAmountStatus: "CONFLICT" })]).facts[0].reconciliation, "PURCHASE_OWNER_CONFLICT"));

// F5/F6: neither duplicate nor missing ownership can mint an economic owner.
check(() => assert.equal(resolveEffectivePurchaseEconomicOwner([nativeSource, source("operation", operationId)]).status, "CONFLICT"));
check(() => assert.equal(project([purchase({ sources: [nativeSource, source("operation", operationId)] })]).blocking[0].reason, "MULTIPLE_OWNERS"));
check(() => assert.equal(resolveEffectivePurchaseEconomicOwner([]).reason, "NO_OWNER"));
check(() => assert.equal(resolveEffectivePurchaseEconomicOwner([{ ...nativeSource, canonicalComponentKey: `operation:${operationId}` }]).reason, "OWNER_KEY_MISMATCH"));
check(() => assert.equal(project([purchase({ sources: [] })]).facts.length, 0));
check(() => assert.equal(project([purchase({ sources: [] })]).blocking[0].reason, "NO_OWNER"));
check(() => assert.equal(project([purchase({ sources: [] })]).status, "BLOCKED"));

// F7/F8/F9: DEFAULT retains the exact legacy object even with pilot rows staged.
result = project([mixed, purchase({ purchaseEventId: uuid(11) })], "DEFAULT", [legacy]);
check(() => assert.equal(result.facts[0], legacy));
check(() => assert.equal(purchaseIdentityKeyOfEconomicFact(result.facts[0]), `operation:${operationId}`));
check(() => assert.deepEqual(result.facts, [legacy]));
check(() => assert.equal(result.blocking.length, 0));
check(() => assert.equal(project([mixed], "PURCHASE_AWARE_PILOT", [legacy]).facts[0].economicAmount.value, "30.8"));

// F10/F11: duplicate funding and wallet credits cannot change the projection.
const withFunding = purchase({ funding: [{ kind: "BENEFIT_WALLET", amount: "25" }, { kind: "BENEFIT_WALLET", amount: "25" }], walletCredits: ["100"] });
check(() => assert.deepEqual(project([withFunding]).facts, project([purchase()]).facts));

// F12: no-bank owner works without any Operation resolution.
check(() => assert.equal(project([purchase()]).blocking.length, 0));
check(() => assert.equal(project([purchase()]).facts[0].sourceKind, "Purchase_component"));
const nativeKnownFact = {
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris",
  canonicalComponentKey: `purchase_component:${nativeId}`, sourceKind: "Purchase_component",
  sourceOperation: { kind: "not_applicable" }, gross: "25", refundApplied: "0", net: "25",
  bankDate: { kind: "unknown" }, economicTiming: { kind: "unknown" }, person: { kind: "unknown" },
  category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" },
  merchant: { kind: "unknown" }, moment: { kind: "unknown" }, canonicalPlace: { kind: "not_applicable" },
  necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
};
check(() => assert.equal(parseEconomicComponentFact(nativeKnownFact).sourceOperation.kind, "not_applicable"));
check(() => assert.throws(() => parseEconomicComponentFact({ ...nativeKnownFact, sourceOperation: { kind: "resolved", id: operationId } }), /ne possède pas/));
check(() => assert.equal(project([purchase({ timingAssertions: [] })]).blocking[0].reason, "TIMING_UNRESOLVED"));
check(() => assert.equal(project([purchase({ classifications: [{
  canonicalComponentKey: nativeSource.canonicalComponentKey, axis: "NECESSITY",
  resolution: { status: "KNOWN", value: "Contraint", authority: "EXPLICIT_COMPONENT_OVERRIDE", evidenceRefs: ["explicit:need"], provenance: "EXPLICIT_USER_ASSERTION" },
}] })]).facts[0].classification.necessity.value, "Contraint"));

// Repository boundary: a staged pilot event is invisible to the historic M8 reader.
const staged = [{ purchase_event_id: uuid(10), household_id: householdId, provenance: "STRUCTURED_CANONICAL_SOURCE" }];
const queried = [];
const client = { from(table) {
  const query = { table, selection: "", select(value) { this.selection = value; return this; },
    eq() { return this; }, in() { return this; }, order() { return this; },
    then(resolve) {
      queried.push(`${this.table}:${this.selection}`);
      const data = this.selection === "purchase_event_id,household_id,provenance" ? staged
        : this.selection === "purchase_event_id,purchase_visibility"
          ? [{ purchase_event_id: uuid(10), purchase_visibility: "PURCHASE_AWARE_PILOT" }] : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  }; return query;
} };
const context = {
  householdId, personIds: [], persons: [], timezone: "Europe/Paris", dataRevision: "8",
  analyticsRevision: "109", contractVersion: "v2", asOf: "2026-09-25T00:00:00Z", periods: [],
};
const canonical = new CanonicalRepository(client, context);
await checkAsync(async () => assert.deepEqual(await canonical.loadPurchaseEvents(), []));
check(() => assert.equal(queried.some((entry) => entry.startsWith("purchase_event_memberships")), false));

async function checkAsync(fn) { await fn(); checks++; }

const m8Repository = {
  context,
  async purchaseEventSourceHealth() { return "AVAILABLE"; },
  async loadPurchaseEvents() { return canonical.loadPurchaseEvents(); },
  async loadEconomicFacts() { return [legacy]; },
  async loadEntityRows() { return []; },
};
const baselineRepository = { ...m8Repository, async loadPurchaseEvents() { return []; } };
const scope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: "2026-09-24" } };
const baselineM8 = await resolveGlobalM8PurchaseAuthority({ repository: baselineRepository, scope });
const stagedM8 = await resolveGlobalM8PurchaseAuthority({ repository: m8Repository, scope });
check(() => assert.deepEqual(stagedM8, baselineM8));

const pilotRepository = new CanonicalRepository(client, context);
const pilotReads = [];
pilotRepository.loadEconomicFacts = async () => [];
pilotRepository.readRowsPaginated = async () => [{
  purchase_event_id: uuid(10), household_id: householdId,
  gross_amount: "25", gross_amount_status: "KNOWN",
}];
pilotRepository.readRowsByInBatches = async (key, _source, ids) => {
  pilotReads.push([key, [...ids]]);
  if (key.startsWith("purchase-aware-memberships:")) return [{
    purchase_event_id: uuid(10), membership_kind: "CONSUMPTION_COMPONENT",
    operation_id: null, allocation_id: null, item_id: null, payment_component_id: null,
    cash_use_id: null, purchase_economic_component_id: nativeId,
    canonical_component_key: `purchase_component:${nativeId}`,
    evidence_refs: ["source:owner"], provenance: "STRUCTURED_CANONICAL_SOURCE",
  }];
  if (key.startsWith("purchase-aware-timing:")) return [{
    purchase_event_id: uuid(10), purchase_event_timing_assertion_id: uuid(20),
    timing_authority: "TRUSTED_PURCHASE_SOURCE", timing_precision: "DAY",
    economic_date: "2026-09-12", economic_month: "2026-09-01", evidence_refs: ["source:date"],
  }];
  if (key.startsWith("purchase-aware-native:")) return [{
    purchase_economic_component_id: nativeId, purchase_event_id: uuid(10),
    household_id: householdId, canonical_component_key: `purchase_component:${nativeId}`,
    category_id: uuid(4), subcategory_id: uuid(5), need_id: uuid(6), merchant_id: uuid(7),
  }];
  return [];
};
const pilotResult = await pilotRepository.loadPurchaseAwareCanonical(range, "PURCHASE_AWARE_PILOT");
check(() => assert.equal(pilotResult.facts[0].economicAmount.value, "25"));
check(() => assert.equal(pilotResult.facts[0].sourceOperation.kind, "not_applicable"));
check(() => assert.equal(pilotReads.find(([key]) => key.startsWith("purchase-aware-operations:"))[1].length, 0));

const defaultRepository = new CanonicalRepository(client, context);
defaultRepository.loadEconomicFacts = async () => [legacy];
defaultRepository.readRowsPaginated = async () => { throw new Error("DEFAULT must not query pilot purchases"); };
const defaultResult = await defaultRepository.loadPurchaseAwareCanonical(range);
check(() => assert.equal(defaultResult.facts[0], legacy));
check(() => assert.equal(defaultResult.blocking.length, 0));

console.log(`C2 purchase-aware canonical: PASS ${checks}/${checks}`);
