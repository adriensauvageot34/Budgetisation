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

const { buildGlobalPurchaseMerchant, decomposeGlobalMerchantFrequencyTicket } = require(path.resolve("src/analytics/global-v2/purchases.ts"));
const { parseMoney } = require(path.resolve("src/core/money/index.ts"));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const householdId = uuid(1), personId = uuid(2), merchantId = uuid(3), otherMerchantId = uuid(4);

const economic = (key, gross, refund = "0", options = {}) => ({
  fact: "fct_economic_component", householdId, householdTimeZone: "Europe/Paris", canonicalComponentKey: key,
  sourceOperation: { kind: "resolved", id: options.operationId ?? uuid(100) }, gross: parseMoney(gross), refundApplied: parseMoney(refund), net: parseMoney(String(Number(gross) - Number(refund))),
  bankDate: { kind: "known", date: options.bankDate ?? "2026-06-12" }, economicTiming: { kind: "known", segments: [{ segmentKey: `segment:${key}`, timingState: "known", periodStart: "2026-06-12", periodEnd: "2026-06-12", economicMonth: "2026-06", amount: parseMoney(String(Number(gross) - Number(refund))) }] },
  person: options.person ?? { kind: "resolved", id: personId, attribution: "explicit_beneficiary", evidenceRefs: [`beneficiary:${key}`], payerEvidenceRefs: options.payerEvidenceRefs ?? [] },
  category: { kind: "undetermined" }, subcategory: { kind: "unknown" }, activity: { kind: "unknown" }, merchant: options.merchant === null ? { kind: "unknown" } : { kind: "resolved", id: options.merchant ?? merchantId }, moment: { kind: "unknown" }, canonicalPlace: { kind: "unknown" }, necessity: { kind: "unknown" }, behavior: { kind: "unknown" }, lifeScope: { kind: "unknown" },
});
const source = (kind, id, key, membershipKind = "CONSUMPTION_COMPONENT") => ({ membershipKind, kind, sourceId: id, canonicalComponentKey: key, evidenceRefs: [`source:${kind}:${id}`], provenance: "STRUCTURED_CANONICAL_SOURCE" });
const event = (id, components, evidenceSources = []) => ({
  fact: "fct_purchase_event", householdId, householdTimeZone: "Europe/Paris", purchaseEventId: id,
  sources: [...components.map((key, index) => source(index === 1 ? "cash_use" : "operation", uuid(200 + index), key)), ...evidenceSources],
  economicAmount: parseMoney(components.reduce((total, key) => total + Number(economicsByKey.get(key).net), 0).toString()),
  timing: { status: "KNOWN", precision: "DAY", economicDate: "2026-07-01", economicMonth: "2026-07", authority: "EXPLICIT_CONSUMPTION_SOURCE", evidenceRefs: [`economic-date:${id}`] }, provenance: "STRUCTURED_CANONICAL_SOURCE",
});
const metadata = (id, extra = {}) => ({ purchaseEventId: id, identificationLevel: 2, purchaseAt: { date: "2026-06-12", precision: "EXACT", authority: "RECEIPT_OR_ORDER", evidenceRefs: [`purchase-at:${id}`] }, purchaseKind: "RETAIL_PURCHASE", interactionMode: "ACTIVE_PURCHASE", merchantId, beneficiaryPersonIds: [personId], dataNature: "OBSERVED", evidenceRefs: [`metadata:${id}`], ...extra });
const omit = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
let economicsByKey = new Map();
const digests = (facts, economics, authorities, adjustments, universe) => {
  const refs = [
    ...facts.flatMap((fact) => [`purchase-event:${fact.purchaseEventId}`, ...fact.sources.flatMap((entry) => entry.evidenceRefs)]),
    ...economics.map((fact) => `economic-component:${fact.canonicalComponentKey}`),
    ...authorities.flatMap((row) => [...row.evidenceRefs, ...(row.purchaseAt?.evidenceRefs ?? [])]),
    ...adjustments.flatMap((row) => row.evidenceRefs), ...universe.evidenceRefs,
    ...(universe.status === "KNOWN" ? universe.eligiblePurchaseRefs : []),
  ];
  return Object.fromEntries([...new Set(refs)].map((ref) => [ref, `digest:${ref}`]));
};
const build = ({ economics, events, authorities, adjustments = [], universe, months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"] }) => {
  economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
  const facts = typeof events === "function" ? events() : events;
  return buildGlobalPurchaseMerchant({ householdId, sourceRevision: "1", certifiedThroughMonth: "2026-06", facts, economicFacts: economics, metadataAuthorities: authorities, ...(adjustments.length ? { adjustments } : {}), eligibilityUniverse: universe, observableMonths: months, dependencyDigests: digests(facts, economics, authorities, adjustments, universe) });
};
const knownUniverse = (ids) => ({ status: "KNOWN", eligiblePurchaseRefs: ids.map((id) => `eligible:${id}`), evidenceRefs: ["eligibility:explicit"] });
let checks = 0; const check = (fn) => { fn(); checks += 1; };

// Three payments, including evidence-only funding lines, remain one human purchase.
let economics = [economic("component:laptop", "900")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
let result = build({ economics, events: () => [event("purchase:laptop", ["component:laptop"], [source("payment_component", uuid(301), "payment:1", "EVIDENCE_SOURCE"), source("payment_component", uuid(302), "payment:2", "EVIDENCE_SOURCE"), source("payment_component", uuid(303), "payment:3", "EVIDENCE_SOURCE")])], authorities: [metadata("purchase:laptop", { orderId: "order:laptop" })], universe: knownUniverse(["purchase:laptop"]) });
check(() => assert.equal(result.checkoutPurchaseCount, 1));
check(() => assert.equal(result.retainedPurchaseCount, 1));
check(() => assert.equal(result.events[0].paymentRefs.length, 3));
check(() => assert.equal(result.netRetainedValue, "900"));

// Bank + cash and many components retain identity and sum only consumption components.
economics = [economic("component:bank", "200"), economic("component:cash", "100", "0", { operationId: uuid(150) }), economic("component:item", "25")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:mixed-funding", ["component:bank", "component:cash", "component:item"])], authorities: [metadata("purchase:mixed-funding")], universe: knownUniverse(["purchase:mixed-funding"]) });
check(() => assert.equal(result.checkoutPurchaseCount, 1));
check(() => assert.equal(result.events[0].economicComponentRefs.length, 3));
check(() => assert.equal(result.events[0].grossPurchaseValue, "325"));
check(() => assert.equal(result.events[0].netRetainedValue, "325"));

// Refunds are adjustments of the original occurrence, not negative purchases.
economics = [economic("component:partial", "100", "25"), economic("component:full", "40", "40")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:partial", ["component:partial"]), event("purchase:full", ["component:full"])], authorities: [metadata("purchase:partial"), metadata("purchase:full")], universe: knownUniverse(["purchase:partial", "purchase:full"]) });
check(() => assert.equal(result.checkoutPurchaseCount, 2));
check(() => assert.equal(result.retainedPurchaseCount, 1));
check(() => assert.equal(result.events.find((row) => row.purchaseEventId === "purchase:partial").outcome, "PARTIALLY_RETURNED"));
check(() => assert.equal(result.events.find((row) => row.purchaseEventId === "purchase:full").outcome, "FULLY_RETURNED"));
check(() => assert.equal(result.events.find((row) => row.purchaseEventId === "purchase:partial").adjustments[0].adjustmentType, "PARTIAL_REFUND"));
check(() => assert.equal(result.events.find((row) => row.purchaseEventId === "purchase:full").adjustments[0].adjustmentType, "REFUND"));
check(() => assert.equal(result.refundAllocatedAmount, "65"));
check(() => assert.equal(result.netRetainedValue, "75"));

// Cancellation remains visible in checkout but absent from consumption habits.
economics = [economic("component:cancel", "50")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:cancel", ["component:cancel"])], authorities: [metadata("purchase:cancel")], adjustments: [{ adjustmentId: "adjustment:cancel", purchaseEventId: "purchase:cancel", adjustmentType: "CANCELLATION", amount: parseMoney("0"), evidenceRefs: ["cancellation:explicit"] }], universe: knownUniverse(["purchase:cancel"]) });
check(() => assert.equal(result.events[0].outcome, "CANCELLED"));
check(() => assert.equal(result.events[0].economicNetValue, "50"));
check(() => assert.equal(result.events[0].netRetainedValue, "0"));
check(() => assert.equal(result.checkoutPurchaseCount, 1));
check(() => assert.equal(result.retainedPurchaseCount, 0));

// Mixed operation uses only authoritative owned component and stays PARTIAL if the purchase part is unresolved.
economics = [economic("component:purchase-part", "80")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:mixed", ["component:purchase-part"])], authorities: [metadata("purchase:mixed", { mixedOperationKnown: true })], universe: knownUniverse(["purchase:mixed"]) });
check(() => assert.equal(result.events[0].netRetainedValue, "80"));
check(() => assert.equal(result.events[0].knowledgeState, "PARTIAL"));
check(() => assert.ok(result.events[0].partialReasons.includes("MISSING_LINKAGE")));

// An ATM withdrawal or absent data does not create a PurchaseEvent.
result = build({ economics: [], events: [], authorities: [], universe: { status: "UNKNOWN", reasonCode: "DATA_GATED", evidenceRefs: ["eligibility:missing"] } });
check(() => assert.equal(result.checkoutPurchaseCount, 0));
check(() => assert.equal(result.status, "UNKNOWN"));
check(() => assert.equal(result.capabilities.purchaseIdentity.state, "UNAVAILABLE"));
check(() => assert.equal(result.netRetainedValue, "0"));

economics = [economic("component:negative-refund", "-20")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
await assert.rejects(async () => build({ economics, events: () => [event("purchase:negative", ["component:negative-refund"])], authorities: [metadata("purchase:negative")], universe: knownUniverse(["purchase:negative"]) }), /NEGATIVE_COMPONENT_IS_ADJUSTMENT/); checks += 1;

const qualifiedEmpty = build({ economics: [], events: [], authorities: [], universe: knownUniverse([]) });
check(() => assert.equal(qualifiedEmpty.status, "KNOWN"));
check(() => assert.equal(qualifiedEmpty.coverage.purchaseCoverage.status, "NOT_APPLICABLE"));

// Processor, marketplace, merchant and establishment are distinct authorities.
economics = [economic("component:processor", "30")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:processor", ["component:processor"])], authorities: [metadata("purchase:processor", { paymentProcessorId: "processor:paypal", marketplaceId: "marketplace:amazon", merchantEstablishmentId: "establishment:store-1" })], universe: knownUniverse(["purchase:processor"]) });
check(() => assert.equal(result.events[0].merchant.id, merchantId));
check(() => assert.equal(result.events[0].paymentProcessor.id, "processor:paypal"));
check(() => assert.notEqual(result.events[0].paymentProcessor.id, result.events[0].merchant.id));
check(() => assert.equal(result.events[0].marketplace.id, "marketplace:amazon"));
check(() => assert.equal(result.events[0].merchantEstablishment.id, "establishment:store-1"));

// A single operation is an event only when the Canonical identity explicitly qualifies it.
economics = [economic("component:simple-operation", "15")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:explicit-simple-operation", ["component:simple-operation"])], authorities: [metadata("purchase:explicit-simple-operation", { identificationLevel: 4, purchaseKind: "CASH_PURCHASE", lineRefs: ["line:1", "line:2"] })], universe: knownUniverse(["purchase:explicit-simple-operation"]) });
check(() => assert.equal(result.events[0].identificationLevel, 4));
check(() => assert.equal(result.events[0].purchaseKind, "CASH_PURCHASE"));
check(() => assert.equal(result.events[0].lineRefs.length, 2));
check(() => assert.equal(result.checkoutPurchaseCount, 1));

// Active checkout and automatic renewal remain distinct interaction modes.
economics = [economic("component:active", "10"), economic("component:renewal", "20")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:active", ["component:active"]), event("purchase:renewal", ["component:renewal"])], authorities: [metadata("purchase:active"), metadata("purchase:renewal", { purchaseKind: "SUBSCRIPTION_RENEWAL", interactionMode: "AUTOMATIC_RENEWAL" })], universe: knownUniverse(["purchase:active", "purchase:renewal"]) });
check(() => assert.equal(result.merchants[0].activePurchaseCount, 1));
check(() => assert.equal(result.merchants[0].automaticRenewalCount, 1));

// Payer evidence cannot resolve a beneficiary.
economics = [economic("component:unknown-beneficiary", "20", "0", { person: { kind: "unknown", reasonCode: "NO_EXPLICIT_BENEFICIARY", payerEvidenceRefs: ["payer:card-holder"] } })]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:unknown-beneficiary", ["component:unknown-beneficiary"])], authorities: [omit(metadata("purchase:unknown-beneficiary"), "beneficiaryPersonIds")], universe: knownUniverse(["purchase:unknown-beneficiary"]) });
check(() => assert.equal(result.events[0].beneficiary.status, "UNKNOWN"));
check(() => assert.equal(result.coverage.beneficiaryCoverage.status, "PARTIAL"));

// Distinct events at the same merchant/time never merge; duplicate component ownership fails closed.
economics = [economic("component:a", "27"), economic("component:b", "12", "0", { merchant: merchantId })]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:a", ["component:a"]), event("purchase:b", ["component:b"])], authorities: [metadata("purchase:a"), metadata("purchase:b")], universe: knownUniverse(["purchase:a", "purchase:b"]) });
check(() => assert.equal(result.checkoutPurchaseCount, 2));
check(() => assert.equal(result.merchants[0].retainedPurchaseCount, 2));
check(() => assert.equal(result.merchants[0].meanRetainedTicket, "19.5"));
check(() => assert.equal(result.merchants[0].medianRetainedTicket, "19.5"));
check(() => assert.deepEqual(result.merchants[0].ticketDistribution, { count: 2, values: ["12", "27"], minimum: "12", maximum: "27" }));
check(() => assert.equal(result.events[0].sourceRevision, "1"));
check(() => assert.equal(result.merchants[0].evolution.lifecycle, "NEWLY_OBSERVED"));
await assert.rejects(async () => build({ economics, events: () => [event("purchase:a", ["component:a"]), event("purchase:b", ["component:a"])], authorities: [metadata("purchase:a"), metadata("purchase:b")], universe: knownUniverse(["purchase:a", "purchase:b"]) }), /MULTIPLE_PURCHASE_OWNERS/); checks += 1;

// Merchant conflicts are not collapsed and funding line count is semantically irrelevant.
economics = [economic("component:merchant-a", "10"), economic("component:merchant-b", "15", "0", { merchant: otherMerchantId })]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
result = build({ economics, events: () => [event("purchase:merchant-conflict", ["component:merchant-a", "component:merchant-b"])], authorities: [omit(metadata("purchase:merchant-conflict"), "merchantId")], universe: knownUniverse(["purchase:merchant-conflict"]) });
check(() => assert.equal(result.events[0].merchant.status, "CONFLICT"));
check(() => assert.equal(result.status, "CONFLICT"));

economics = [economic("component:stable", "60")]; economicsByKey = new Map(economics.map((row) => [row.canonicalComponentKey, row]));
const baseEvent = () => event("purchase:stable", ["component:stable"]);
const base = build({ economics, events: () => [baseEvent()], authorities: [metadata("purchase:stable")], universe: knownUniverse(["purchase:stable"]) });
const funded = build({ economics, events: () => [{ ...baseEvent(), sources: [...baseEvent().sources, source("payment_component", uuid(401), "funding:1", "EVIDENCE_SOURCE"), source("payment_component", uuid(402), "funding:2", "EVIDENCE_SOURCE")] }], authorities: [metadata("purchase:stable")], universe: knownUniverse(["purchase:stable"]) });
check(() => assert.equal(base.checkoutPurchaseCount, funded.checkoutPurchaseCount));
check(() => assert.equal(base.retainedPurchaseCount, funded.retainedPurchaseCount));
check(() => assert.equal(base.netRetainedValue, funded.netRetainedValue));

// Exact M2-compatible decomposition uses mean ticket and reconciles.
const decomposition = decomposeGlobalMerchantFrequencyTicket({ authorityAvailable: true, purchaseCoverage: 1, reference: [{ purchaseEventId: "r1", amount: parseMoney("20") }, { purchaseEventId: "r2", amount: parseMoney("30") }], current: [{ purchaseEventId: "c1", amount: parseMoney("30") }, { purchaseEventId: "c2", amount: parseMoney("40") }, { purchaseEventId: "c3", amount: parseMoney("50") }] });
check(() => assert.equal(decomposition.status, "KNOWN"));
check(() => assert.equal(decomposition.reconciles, true));
check(() => assert.equal(Number(decomposition.frequencyEffect) + Number(decomposition.ticketEffect), Number(decomposition.deltaSpend)));

// Closure/hash sensitivity and canonical ordering.
const permuted = build({ economics: [...economics].reverse(), events: () => [baseEvent()], authorities: [metadata("purchase:stable")], universe: knownUniverse(["purchase:stable"]), months: ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"] });
check(() => assert.equal(base.inputHash, permuted.inputHash));
check(() => assert.equal(base.outputHash, permuted.outputHash));
const changed = build({ economics: [economic("component:stable", "61")], events: () => [event("purchase:stable", ["component:stable"])], authorities: [metadata("purchase:stable")], universe: knownUniverse(["purchase:stable"]) });
check(() => assert.notEqual(base.inputHash, changed.inputHash));
check(() => assert.equal(base.contributions.direction, "M8_TO_M2_M5_ONLY"));
check(() => assert.equal(base.capabilities.products.reasonCode, "DEFERRED_P10"));
check(() => assert.equal(base.publicationEligible, false));

console.log(`P09 M8 Purchase/Merchant core: PASS ${checks}/${checks}.`);
