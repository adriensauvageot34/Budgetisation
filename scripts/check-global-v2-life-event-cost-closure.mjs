import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export default {};", shortCircuit: true };
    const target = specifier.startsWith("@/")
      ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href
      : specifier;
    try { return nextResolve(target, context); } catch (originalError) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw originalError;
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const costs = await import("../src/analytics/global-v2/timeline-event-cost.ts");
const facts = await import("../src/analytics/facts/index.ts");
const money = await import("../src/core/money/index.ts");
const repository = await import("../src/server/canonical/life-event-cost-assertions.ts");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260917134014_add_life_event_cost_assertions.sql"), "utf8");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = uuid(1);
const operationId = uuid(100);
const key = (kind, suffix) => `${kind}:${uuid(suffix)}`;

function occurrence(suffix = 10) {
  return {
    fact: "fct_activity_occurrence",
    householdId,
    householdTimeZone: "Europe/Paris",
    lifeEventId: uuid(suffix),
    activityId: `activity-${suffix}`,
    lifeEventSeriesId: null,
    parentLifeEventId: null,
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    validationStatus: "Confirmé",
    participantIds: [],
  };
}

function component(canonicalComponentKey, net, options = {}) {
  return {
    fact: "fct_economic_component",
    householdId,
    householdTimeZone: "Europe/Paris",
    canonicalComponentKey,
    sourceKind: options.sourceKind ?? (canonicalComponentKey.startsWith("operation:") ? "Operation_parent"
      : canonicalComponentKey.startsWith("allocation:") ? "Allocation"
        : canonicalComponentKey.startsWith("item:") ? "Item"
          : canonicalComponentKey.startsWith("payment_component:") ? "Payment_component" : "Cash_economic_use"),
    sourceOperation: { kind: "resolved", id: options.operationId ?? operationId },
    gross: money.parseMoney(options.gross ?? net),
    refundApplied: money.parseMoney(options.refundApplied ?? "0"),
    net: money.parseMoney(net),
  };
}

function link(lifeEventId, canonicalComponentKey, amount, suffix = 200) {
  return {
    financialLinkId: uuid(suffix),
    lifeEventId,
    canonicalComponentKey,
    relationType: "Paiement_activite",
    economicAmountLinked: amount === null ? null : money.parseMoney(amount),
  };
}

function assertion(event, expectedComponentKeys, closureStatus = "COMPLETE") {
  return {
    assertionId: uuid(300),
    householdId,
    lifeEventId: event.lifeEventId,
    closureStatus,
    expectedComponentKeys,
    methodVersion: costs.TIMELINE_EVENT_COST_METHOD_VERSION,
    authority: "DECLARED_BY_USER",
    evidenceRefs: [`life-event:${event.lifeEventId}`],
    provenance: "CONTROLLED_SOURCE_PACK",
    sourceRevision: 3,
    declaredAt: "2026-09-17T10:00:00.000Z",
    validatedAt: "2026-09-17T10:00:00.000Z",
  };
}

function resolve({ event = occurrence(), assertions = [], components = [], links = [], occurrences = undefined }) {
  return costs.resolveTimelineLifeEventCosts({
    occurrences: occurrences ?? [event],
    assertions,
    components,
    links,
  }).find(({ lifeEventId }) => lifeEventId === event.lifeEventId);
}

check(() => assert.equal(costs.TIMELINE_EVENT_COST_METHOD_VERSION, "timeline-event-cost@v1"));

const baseEvent = occurrence();
const operationKey = key("operation", 101);
const operationComponent = component(operationKey, "25");
const operationLink = link(baseEvent.lifeEventId, operationKey, "25");

check(() => assert.deepEqual(resolve({ event: baseEvent }), {
  lifeEventId: baseEvent.lifeEventId,
  methodVersion: "timeline-event-cost@v1",
  authority: "NONE",
  status: "UNKNOWN",
  value: null,
  reasonCode: "NO_ACTIVE_ASSERTION",
  componentKeys: [],
}));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [operationLink],
}).value, "25"));

const extraKey = key("operation", 102);
check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent, component(extraKey, "5")],
  links: [operationLink, link(baseEvent.lifeEventId, extraKey, "5", 201)],
}).reasonCode, "EXPECTED_COMPONENT_SET_MISMATCH"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey, extraKey].sort())],
  components: [operationComponent],
  links: [operationLink],
}).reasonCode, "EXPECTED_COMPONENT_SET_MISMATCH"));

const cashKey = key("cash_use", 103);
const withdrawalKey = key("operation", 104);
check(() => assert.deepEqual(
  resolve({
    event: baseEvent,
    assertions: [assertion(baseEvent, [cashKey])],
    components: [component(cashKey, "20"), component(withdrawalKey, "100")],
    links: [link(baseEvent.lifeEventId, cashKey, "20")],
  }),
  {
    lifeEventId: baseEvent.lifeEventId,
    methodVersion: "timeline-event-cost@v1",
    authority: "CANONICAL_LINKED",
    status: "KNOWN",
    value: "20",
    reasonCode: null,
    componentKeys: [cashKey],
  },
));

const allocationKey = key("allocation", 105);
const itemKey = key("item", 106);
check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [allocationKey, itemKey].sort())],
  components: [
    component(operationKey, "100", { sourceKind: "Operation_parent" }),
    component(allocationKey, "12", { sourceKind: "Allocation" }),
    component(itemKey, "18", { sourceKind: "Item" }),
  ],
  links: [link(baseEvent.lifeEventId, allocationKey, "12"), link(baseEvent.lifeEventId, itemKey, "18", 202)],
}).value, "30"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [component(operationKey, "60", { gross: "100", refundApplied: "40" })],
  links: [link(baseEvent.lifeEventId, operationKey, "60")],
}).value, "60"));

check(() => assert.deepEqual(
  { status: resolve({ event: baseEvent, assertions: [assertion(baseEvent, [operationKey])], components: [component(operationKey, "0", { gross: "100", refundApplied: "100" })], links: [link(baseEvent.lifeEventId, operationKey, "0")] }).status,
    value: resolve({ event: baseEvent, assertions: [assertion(baseEvent, [operationKey])], components: [component(operationKey, "0", { gross: "100", refundApplied: "100" })], links: [link(baseEvent.lifeEventId, operationKey, "0")] }).value },
  { status: "KNOWN", value: "0" },
));

check(() => assert.deepEqual(
  { status: resolve({ event: baseEvent, assertions: [assertion(baseEvent, [], "EXPLICIT_EMPTY")] }).status,
    value: resolve({ event: baseEvent, assertions: [assertion(baseEvent, [], "EXPLICIT_EMPTY")] }).value },
  { status: "KNOWN", value: "0" },
));

check(() => assert.notEqual(resolve({ event: baseEvent }).value, "0"));

const paymentKey = key("payment_component", 107);
check(() => assert.deepEqual(facts.parseActivityCausalFinancialLinks([{
  financial_link_id: uuid(203), life_event_id: baseEvent.lifeEventId, source_kind: "Payment_component",
  operation_id: null, allocation_id: null, item_id: null, cash_use_id: null,
  relation_type: "Paiement_activite", economic_amount_linked: "10", validation_status: "Confirmé",
}]), []));
rejects(() => repository.parseLifeEventCostAssertionDraft({
  ...assertion(baseEvent, [paymentKey]),
}), /PAYMENT_COMPONENT_UNSUPPORTED/);
check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [paymentKey])],
  components: [component(paymentKey, "10")],
  links: [link(baseEvent.lifeEventId, paymentKey, "10")],
}).reasonCode, "UNSUPPORTED_COMPONENT_KIND"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [component(operationKey, "-5")],
  links: [link(baseEvent.lifeEventId, operationKey, "-5")],
}).reasonCode, "NEGATIVE_ECONOMIC_NET"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [link(baseEvent.lifeEventId, operationKey, null)],
}).reasonCode, "UNRESOLVED_COMPONENT_AMOUNT"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [link(baseEvent.lifeEventId, operationKey, "10"), link(baseEvent.lifeEventId, operationKey, "11", 204)],
}).reasonCode, "CONTRADICTORY_COMPONENT_AMOUNT"));

const secondEvent = occurrence(11);
check(() => assert.equal(resolve({
  event: baseEvent,
  occurrences: [baseEvent, secondEvent],
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [link(baseEvent.lifeEventId, operationKey, "20"), link(secondEvent.lifeEventId, operationKey, "20", 205)],
}).reasonCode, "OVERALLOCATED_COMPONENT"));

check(() => assert.equal(resolve({
  event: baseEvent,
  occurrences: [baseEvent, secondEvent],
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [link(baseEvent.lifeEventId, operationKey, "20"), link(secondEvent.lifeEventId, operationKey, "5", 208)],
}).value, "20"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey])],
  components: [operationComponent],
  links: [operationLink, { ...operationLink, financialLinkId: uuid(209) }],
}).value, "25"));

check(() => assert.equal(resolve({
  event: baseEvent,
  assertions: [assertion(baseEvent, [operationKey, allocationKey].sort())],
  components: [component(operationKey, "25", { sourceKind: "Operation_parent" }), component(allocationKey, "10", { sourceKind: "Allocation" })],
  links: [operationLink, link(baseEvent.lifeEventId, allocationKey, "10", 206)],
}).reasonCode, "PARENT_CHILD_DOUBLE_COUNT"));

check(() => assert.deepEqual(facts.parseActivityCausalFinancialLinks([{
  financial_link_id: uuid(207), life_event_id: baseEvent.lifeEventId, source_kind: "Operation",
  operation_id: uuid(108), allocation_id: null, item_id: null, cash_use_id: null,
  relation_type: "Contexte", economic_amount_linked: "99", validation_status: "Confirmé",
}]), []));

const validDraft = {
  assertionId: uuid(300), lifeEventId: baseEvent.lifeEventId, closureStatus: "COMPLETE",
  expectedComponentKeys: [operationKey], methodVersion: "timeline-event-cost@v1",
  authority: "DECLARED_BY_USER", evidenceRefs: [`life-event:${baseEvent.lifeEventId}`], provenance: "CONTROLLED_SOURCE_PACK",
  sourceRevision: 3, declaredAt: "2026-09-17T10:00:00.000Z", validatedAt: "2026-09-17T10:00:00.000Z",
};
check(() => assert.deepEqual(repository.parseLifeEventCostAssertionDraft(validDraft), validDraft));
rejects(() => repository.parseLifeEventCostAssertionDraft({ ...validDraft, expectedComponentKeys: [] }), /CLOSURE_SHAPE_INVALID/);
rejects(() => repository.parseLifeEventCostAssertionDraft({ ...validDraft, expectedComponentKeys: [operationKey, operationKey] }), /NOT_CANONICAL/);
rejects(() => repository.parseLifeEventCostAssertionDraft({ ...validDraft, methodVersion: "timeline-event-cost@v2" }), /METHOD_VERSION_INVALID/);

const tableSql = migration.match(/create table public\.life_event_cost_assertions[\s\S]*?\n\);/iu)?.[0] ?? "";
check(() => assert.match(tableSql, /closure_status in \('COMPLETE', 'EXPLICIT_EMPTY'\)/u));
check(() => assert.match(tableSql, /private\.is_timeline_cost_component_key_list\(expected_component_keys\)/u));
check(() => assert.doesNotMatch(tableSql, /\b(amount|value|cost_amount)\b/iu));
check(() => assert.match(migration, /create unique index life_event_cost_one_active_assertion[\s\S]*where is_active/iu));
check(() => assert.match(migration, /enable row level security/iu));
check(() => assert.match(migration, /assert_life_event_cost_household_scope/iu));
check(() => assert.match(migration, /revoke all on table public\.life_event_cost_assertions from public, anon, authenticated/iu));
check(() => assert.doesNotMatch(migration, /update\s+public\.household_revisions|insert\s+into\s+public\.household_revisions/iu));

const m6Source = fs.readFileSync(path.join(root, "src", "analytics", "global-v2", "moments.ts"));
check(() => assert.equal(createHash("sha256").update(m6Source).digest("hex"), "df88e7e37f0e3eb486553eb4e027d09b2b83f789499bf1cb7adc7191eabb8e61"));

console.log(`Global V2 LifeEvent cost closure checks: ${checks} passed.`);
