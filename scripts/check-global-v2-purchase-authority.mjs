import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) { return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain); };
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText, filename);

const { resolveGlobalM8PurchaseAuthority } = require(path.resolve("src/server/analytics/global-v2-purchase-authority.ts"));
const { parseMoney } = require(path.resolve("src/core/money/index.ts"));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2), merchantId = uuid(3), operationId = uuid(4);
const component = { fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: "component:1", sourceOperation: { kind: "resolved", id: operationId }, gross: parseMoney("42"), refundApplied: parseMoney("0"), net: parseMoney("42"), bankDate: { kind: "known", date: "2026-06-11" }, economicTiming: { kind: "known", segments: [{ segmentKey: "segment:1", timingState: "known", periodStart: "2026-07-01", periodEnd: "2026-07-01", economicMonth: "2026-07", amount: parseMoney("42") }] }, person: { kind: "resolved", id: personId, attribution: "explicit_beneficiary", evidenceRefs: ["beneficiary:1"], payerEvidenceRefs: [] }, category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: { kind: "resolved", id: merchantId }, moment: { kind: "unknown" }, canonicalPlace: { kind: "unknown" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" } };
const purchase = { fact: "fct_purchase_event", householdId, householdTimeZone: "Europe/Paris", purchaseEventId: "purchase:1", sources: [{ membershipKind: "CONSUMPTION_COMPONENT", kind: "operation", sourceId: operationId, canonicalComponentKey: "component:1", evidenceRefs: ["operation:1"], provenance: "STRUCTURED_CANONICAL_SOURCE" }], economicAmount: parseMoney("42"), timing: { status: "KNOWN", precision: "DAY", economicDate: "2026-07-01", economicMonth: "2026-07", authority: "EXPLICIT_CONSUMPTION_SOURCE", evidenceRefs: ["economic-date:1"] }, provenance: "STRUCTURED_CANONICAL_SOURCE" };
const metadata = { purchaseEventId: "purchase:1", identificationLevel: 2, purchaseAt: { date: "2026-06-11", precision: "EXACT", authority: "RECEIPT_OR_ORDER", evidenceRefs: ["purchase-at:1"] }, purchaseKind: "RETAIL_PURCHASE", interactionMode: "ACTIVE_PURCHASE", merchantId, beneficiaryPersonIds: [personId], evidenceRefs: ["metadata:1"], dataNature: "OBSERVED" };
const context = { householdId, personIds: [personId], persons: [], timezone: "Europe/Paris", dataRevision: "1", analyticsRevision: "79", contractVersion: "v2", asOf: "2026-07-02T00:00:00Z", periods: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((month, index) => ({ analysisPeriodId: `period:${index}`, householdId, month: `${month}-01`, financeStatus: "complete", lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete", isClosed: true, sourceRevision: "1" })) };
const calls = [];
const repository = {
  context,
  async purchaseEventSourceHealth() { calls.push("read:health"); return "AVAILABLE"; },
  async loadPurchaseEvents() { calls.push("read:purchases"); return [purchase]; },
  async loadEconomicFacts() { calls.push("read:economics"); return [component]; },
  async loadEntityRows(table) { calls.push(`read:${table}`); return [{ merchant_id: merchantId, nom_canonique: "Synthetic Merchant" }]; },
};
const scope = { subject: { kind: "household" }, time: { kind: "global_v2", asOf: context.asOf, certifiedThrough: "2026-06-30" } };
const result = await resolveGlobalM8PurchaseAuthority({ repository, scope, metadataAuthorities: [metadata] });
let checks = 0; const check = (fn) => { fn(); checks += 1; };
check(() => assert.equal(result.checkoutPurchaseCount, 1));
check(() => assert.equal(result.retainedPurchaseCount, 1));
check(() => assert.equal(result.events[0].purchaseAt.status, "KNOWN"));
check(() => assert.equal(result.events[0].purchaseAt.date, "2026-06-11"));
check(() => assert.equal(result.events[0].economicDate.date, "2026-07-01"));
check(() => assert.equal(result.events[0].sourceRevision, "1"));
check(() => assert.deepEqual(result.events[0].bankPostingDates, ["2026-06-11"]));
check(() => assert.equal(result.events[0].merchant.id, merchantId));
check(() => assert.equal(result.providerStatus.purchaseEventSchema, "CONNECTED"));
check(() => assert.equal(result.providerStatus.purchaseAt, "CONNECTED"));
check(() => assert.equal(result.providerStatus.eligiblePurchaseUniverse, "AUTHORITY_GATED"));
check(() => assert.equal(result.providerStatus.establishment, "AUTHORITY_GATED"));
check(() => assert.equal(result.providerStatus.product, "DEFERRED_P10"));
check(() => assert.equal(result.boundary.certifiedUnitIds[0], "purchase:1"));
check(() => assert.equal(result.boundary.window.naturalGrain, "PURCHASE_EVENT"));
check(() => assert.equal(result.dependencyDeclaration.naturalGrain, "PURCHASE_EVENT"));
check(() => assert.ok(result.dependencyClosure.some(({ ref }) => ref === "economic-component:component:1")));
check(() => assert.ok(result.sourceHash.length === 64 && result.executionHash.length === 64));
check(() => assert.equal(result.liveWrites, "NONE"));
check(() => assert.deepEqual(calls.sort(), ["read:economics", "read:health", "read:merchants", "read:purchases"]));
check(() => assert.equal(calls.some((entry) => /insert|update|delete|write/i.test(entry)), false));

const noMetadata = await resolveGlobalM8PurchaseAuthority({ repository, scope });
check(() => assert.equal(noMetadata.checkoutPurchaseCount, 0));
check(() => assert.equal(noMetadata.status, "UNKNOWN"));
check(() => assert.equal(noMetadata.providerStatus.purchaseEventData, "CONNECTED"));
check(() => assert.equal(noMetadata.providerStatus.purchaseAt, "AUTHORITY_GATED"));
check(() => assert.equal(noMetadata.boundary.certifiedUnitIds.length, 0));

await assert.rejects(() => resolveGlobalM8PurchaseAuthority({ repository, scope: { ...scope, subject: { kind: "person", personId } } }), /PERSON_SCOPE_REQUIRES/); checks += 1;
await assert.rejects(() => resolveGlobalM8PurchaseAuthority({ repository, scope: { ...scope, filters: { merchantIds: [merchantId] } } }), /FILTER_PROVIDER_NOT_RESOLVED/); checks += 1;
await assert.rejects(() => resolveGlobalM8PurchaseAuthority({ repository, scope: { ...scope, time: { ...scope.time, asOf: "2026-07-03T00:00:00Z" } } }), /ASOF_MISMATCH/); checks += 1;

console.log(`P09 Canonical → Facts → M8 authority: PASS ${checks}/${checks} (synthetic repository; no network/write method).`);
