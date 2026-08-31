import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const purchase = await import("../src/analytics/facts/purchase-event.ts");
const classification = await import("../src/analytics/facts/component-classification.ts");
const continuity = await import("../src/analytics/facts/continuity.ts");
const canonical = await import("../src/analytics/facts/canonical.ts");

const uuid = (suffix) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const household = {
  householdId: uuid("1"),
  householdTimeZone: "Europe/Paris",
};

const timing = purchase.resolvePurchaseEventTiming([
  { authority: "ECONOMIC_MONTH", precision: "MONTH", economicDate: null, economicMonth: "2026-05-01", evidenceRefs: ["month"] },
  { authority: "EXPLICIT_CONSUMPTION_SOURCE", precision: "DAY", economicDate: "2026-05-14", economicMonth: "2026-05-01", evidenceRefs: ["source"] },
  { authority: "EXPLICIT_EVENT", precision: "DAY", economicDate: "2026-05-12", economicMonth: "2026-05-01", evidenceRefs: ["event"] },
]);
assert.deepEqual(timing, {
  status: "KNOWN", precision: "DAY", economicDate: "2026-05-12", economicMonth: "2026-05",
  authority: "EXPLICIT_EVENT", evidenceRefs: ["event"],
});
assert.deepEqual(purchase.resolvePurchaseEventTiming([
  { authority: "ECONOMIC_MONTH", precision: "MONTH", economicDate: null, economicMonth: "2026-05-01", evidenceRefs: ["month"] },
]), {
  status: "PARTIAL", precision: "MONTH", economicDate: null, economicMonth: "2026-05",
  authority: "ECONOMIC_MONTH", evidenceRefs: ["month"],
});
assert.deepEqual(purchase.resolvePurchaseEventTiming([
  { authority: "EXPLICIT_CONSUMPTION_SOURCE", precision: "MONTH", economicDate: null, economicMonth: "2026-05-01", evidenceRefs: ["source-month"] },
  { authority: "TRUSTED_PURCHASE_SOURCE", precision: "DAY", economicDate: "2026-05-14", economicMonth: "2026-05-01", evidenceRefs: ["lower-day"] },
]), {
  status: "PARTIAL", precision: "MONTH", economicDate: null, economicMonth: "2026-05",
  authority: "EXPLICIT_CONSUMPTION_SOURCE", evidenceRefs: ["source-month"],
});
const dayConflict = purchase.resolvePurchaseEventTiming([
  { authority: "EXPLICIT_EVENT", precision: "DAY", economicDate: "2026-05-12", economicMonth: "2026-05-01", evidenceRefs: ["a"] },
  { authority: "EXPLICIT_EVENT", precision: "DAY", economicDate: "2026-05-13", economicMonth: "2026-05-01", evidenceRefs: ["b"] },
]);
assert.equal(dayConflict.status, "CONFLICT");
assert.equal(dayConflict.precision, "MONTH");
assert.equal(dayConflict.economicMonth, "2026-05");
assert.equal(purchase.resolvePurchaseEventTiming([]).status, "UNKNOWN");

const eventId = uuid("10");
const operationId = uuid("20");
const key = `operation:${operationId}`;
const eventFact = canonical.projectPurchaseEventFact({
  household,
  purchaseEvent: { purchase_event_id: eventId, household_id: household.householdId, provenance: "EXPLICIT_USER_ASSERTION" },
  sources: [{
    purchase_event_id: eventId, membership_kind: "CONSUMPTION_COMPONENT",
    operation_id: operationId, allocation_id: null, item_id: null, payment_component_id: null, cash_use_id: null,
    canonical_component_key: key, evidence_refs: ["receipt:1"], provenance: "EXPLICIT_USER_ASSERTION",
  }],
  timingAssertions: [{
    purchase_event_id: eventId, timing_authority: "EXPLICIT_EVENT", timing_precision: "DAY",
    economic_date: "2026-05-12", economic_month: "2026-05-01", evidence_refs: ["receipt:1"],
  }],
  economicComponents: [{ canonicalComponentKey: key, householdId: household.householdId, net: "12.34" }],
});
assert.equal(eventFact.economicAmount, "12.34");
assert.equal(eventFact.timing.economicDate, "2026-05-12");
assert.throws(() => canonical.projectPurchaseEventFact({
  household,
  purchaseEvent: { purchase_event_id: eventId, household_id: uuid("2"), provenance: "EXPLICIT_USER_ASSERTION" },
  sources: [], timingAssertions: [], economicComponents: [],
}), /Household canonique/);

const mixedCandidates = [
  {
    householdId: household.householdId, canonicalComponentKey: `allocation:${uuid("31")}`,
    sourceOperationId: operationId, operationMixed: true,
    sourceValues: { NECESSITY: "Contrainte", BEHAVIOR: "Fixe", LIFE_SCOPE: "Vie courante" },
    operationValues: { NECESSITY: "Optionnelle", BEHAVIOR: "Fixe", LIFE_SCOPE: "Vie courante" },
  },
  {
    householdId: household.householdId, canonicalComponentKey: `item:${uuid("32")}`,
    sourceOperationId: operationId, operationMixed: true,
    sourceValues: { NECESSITY: undefined, BEHAVIOR: undefined, LIFE_SCOPE: "Hors quotidien" },
    operationValues: { NECESSITY: "Optionnelle", BEHAVIOR: "Fixe", LIFE_SCOPE: "Vie courante" },
  },
];
const mixed = classification.resolveEconomicComponentClassifications({ candidates: mixedCandidates, assertions: [] });
assert.equal(mixed[0].necessity.value, "Contraint");
assert.equal(mixed[1].necessity.status, "UNKNOWN");
assert.equal(mixed[1].behavior.status, "UNKNOWN");
assert.equal(mixed[1].lifeScope.value, "Hors quotidien");

const override = classification.resolveEconomicComponentClassifications({
  candidates: mixedCandidates,
  assertions: [{
    canonicalComponentKey: mixedCandidates[1].canonicalComponentKey,
    axis: "NECESSITY",
    resolution: { status: "KNOWN", value: "Indispensable", authority: "EXPLICIT_COMPONENT_OVERRIDE", evidenceRefs: ["review:1"], provenance: "EXPLICIT_USER_ASSERTION" },
  }],
});
assert.equal(override[1].necessity.value, "Indispensable");
assert.equal(override[1].behavior.status, "UNKNOWN");
const homogeneous = classification.resolveEconomicComponentClassifications({
  candidates: [{ ...mixedCandidates[1], operationMixed: false }],
  assertions: [],
});
assert.equal(homogeneous[0].necessity.value, "Optionnel");
assert.equal(homogeneous[0].necessity.authority, "OPERATION_FALLBACK");
const explicitConflict = classification.resolveEconomicComponentClassifications({
  candidates: [mixedCandidates[0]],
  assertions: [{
    canonicalComponentKey: mixedCandidates[0].canonicalComponentKey,
    axis: "BEHAVIOR",
    resolution: { status: "CONFLICT", value: null, authority: "EXPLICIT_COMPONENT_OVERRIDE", evidenceRefs: ["a", "b"], provenance: "EXPLICIT_USER_ASSERTION" },
  }],
});
assert.equal(explicitConflict[0].behavior.status, "CONFLICT");
assert.equal(classification.normalizeComponentClassificationValue("NECESSITY", "Ajustable"), null);
assert.equal(classification.normalizeComponentClassificationValue("NECESSITY", "Optionnelle"), "Optionnel");

const continuityFact = {
  fact: "fct_life_event_continuity", householdId: household.householdId, lifeEventId: uuid("40"),
  status: "KNOWN", continuityQualifier: "CONTINUOUS", authority: "USER", evidenceRefs: ["event:40"], provenance: "EXPLICIT_USER_ASSERTION",
};
assert.equal(continuity.continuityForSpanBehavior("EXPLICIT_CONTINUITY", continuityFact), "CONTINUOUS");
assert.equal(continuity.continuityForSpanBehavior("EXPLICIT_CONTINUITY", { ...continuityFact, continuityQualifier: "NOT_CONTINUOUS" }), "NOT_CONTINUOUS");
assert.equal(continuity.continuityForSpanBehavior("AUTO_CONTINUOUS", continuityFact), null);
assert.equal(continuity.continuityForSpanBehavior("POINT", continuityFact), null);
assert.equal(continuity.continuityForSpanBehavior("EXPLICIT_CONTINUITY", { ...continuityFact, status: "UNKNOWN", continuityQualifier: null }), "UNKNOWN");
assert.equal(continuity.continuityForSpanBehavior("EXPLICIT_CONTINUITY", { ...continuityFact, status: "CONFLICT", continuityQualifier: null }), "CONFLICT");

const purchaseSql = fs.readFileSync("supabase/migrations/20260822000000_purchase_event_identity.sql", "utf8");
const classificationSql = fs.readFileSync("supabase/migrations/20260830090000_economic_component_classifications.sql", "utf8");
const continuitySql = fs.readFileSync("supabase/migrations/20260830091000_life_event_continuity_assertions.sql", "utf8");
assert.match(purchaseSql, /purchase_event_consumption_owner_unique/);
assert.match(purchaseSql, /where membership_kind = 'CONSUMPTION_COMPONENT'/);
assert.doesNotMatch(purchaseSql, /BANK_DATE_FALLBACK/i);
assert.doesNotMatch(`${classificationSql}\n${continuitySql}`, /alter table public\.life_event_types/i);
for (const [sql, table] of [
  [purchaseSql, "purchase_events"],
  [classificationSql, "economic_component_classifications"],
  [continuitySql, "life_event_continuity_assertions"],
]) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, new RegExp(`grant all on table public\\.${table} to service_role`, "i"));
}

console.log("History V2 canonical contracts: PASS");
