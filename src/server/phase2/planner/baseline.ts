import "server-only";
import Big from "big.js";
import { Temporal } from "@js-temporal/polyfill";
import type { PlanningBaselineV1, UnresolvedBehavioralReserve } from "@/domain/phase2/planner/baseline-contract";
import { parsePlannerJson, plannerDigest, plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import { matchesForecastCategory } from "../remaining-month-forecast";
import type { PlanningBaselineSources } from "./baseline-sources";
import { BASELINE_REFERENCE_POLICY, closedMonths, compare, diagnostic, money, references, sourceRef } from "./baseline-evidence";
import { BASELINE_FOOD_MODEL, buildFoodBaseline, FOOD_KEYS, foodIdentity, uniqueEconomicRows } from "./baseline-food";
import { BASELINE_HABIT_MODEL, buildHabitBaseline } from "./baseline-habits";
import { BASELINE_MOBILITY_MODEL, buildMobilityBaseline } from "./baseline-mobility";
import { buildStructuralBaseline } from "./baseline-structural";

export const PLANNING_BASELINE_MODEL = "planning-baseline-builder@v1";
/** Construction time is evidence metadata, not a semantic change. A fresh read with
 * the same admitted facts must not make every future Preview/Apply stale. */
export function planningBaselineDigest(baseline: Omit<PlanningBaselineV1, "digest"> & { digest?: string }): string {
  const { knowledgeCutoff: _constructionTime, digest: _previousDigest, ...facts } = baseline;
  return plannerDigest(facts);
}
/** Pure read-model. Cutoff and all authoritative inputs are explicit. No clock, I/O,
 * scenario evaluation, Plan lookup, semantic decision replay, or persistence. */
export function buildPlanningBaseline(s: PlanningBaselineSources): PlanningBaselineV1 {
  const householdId = plannerUuid(s.householdId), targetMonth = plannerMonth(s.targetMonth);
  if (householdId !== s.householdId || s.forecast.meta.targetMonth !== targetMonth) throw new TypeError("BASELINE_SOURCE_SCOPE_INVALID");
  const knowledgeCutoff = Temporal.Instant.from(s.knowledgeCutoff).toString();
  const structural = buildStructuralBaseline(s), food = buildFoodBaseline(s), habits = buildHabitBaseline(s), mobility = buildMobilityBaseline(s);
  // Closed economic history not owned by a modeled slot remains an explicit reserve.
  // Contractual charges are already structural; their canonical recurrence links identify them.
  const chargeKeys = new Set(structural.structuralFacts.obligations.map(o => o.factKey));
  const contractualOperations = new Set((s.evidence.bankObservations ?? []).filter(o => o.recurrenceSeriesId
    && chargeKeys.has(`obligation:${o.recurrenceSeriesId}`)).map(o => o.id));
  const months = closedMonths(s, ["BANK"]);
  const unexplained = uniqueEconomicRows(s.evidence.history.economicEntries.filter(row => months.includes(row.date.slice(0, 7))
    && !contractualOperations.has(row.operationId) && !FOOD_KEYS.some(key => matchesForecastCategory(key, row))));
  const additional: UnresolvedBehavioralReserve[] = [], extraRefs = [], extraDiagnostics = [];
  if (unexplained.length || !months.length) {
    const key = "economic:UNRESOLVED";
    const history = references("ECONOMIC_AMOUNT", ["BANK"], months.map(month => {
      const rows = unexplained.filter(row => row.date.startsWith(month));
      const minimum = money(rows.reduce((n, row) => n.plus(row.amount), new Big(0)).toString());
      return { month, value: rows.some(row => row.amountStatus === "PARTIAL") ? null : minimum,
        minimum, evidenceRefs: rows.map(foodIdentity) };
    }));
    extraRefs.push(sourceRef(key, "CanonicalEconomicHistory", history.samples, history.evidenceRefs));
    additional.push({ reserveKey: key, reason: "BEHAVIOR_NOT_YET_MODELED", value: history.range, historicalReferences: history,
      knowledge: unexplained.some(row => row.amountStatus === "PARTIAL") ? "PARTIAL" : history.range.central === null ? "UNKNOWN" : "ESTIMATED",
      sourceRefs: [key], replacesSlotKey: null });
    extraDiagnostics.push(diagnostic("BASELINE_UNEXPLAINED_ECONOMIC_HISTORY_PRESERVED", key, history.evidenceRefs));
  }
  const unresolvedPurchases = s.purchaseFacts.filter(f => f.timing.status === "KNOWN" && f.timing.economicMonth !== null
    && months.includes(f.timing.economicMonth) && f.economicAmount.status !== "KNOWN");
  if (unresolvedPurchases.length) {
    const key = "purchase:UNRESOLVED";
    const history = references("ECONOMIC_AMOUNT", ["BANK", "SWILE", "EDENRED"], months.filter(month => unresolvedPurchases.some(f => f.timing.economicMonth === month)).map(month => {
      const rows = unresolvedPurchases.filter(f => f.timing.economicMonth === month);
      const lowerBounds = rows.flatMap(f => f.economicAmount.status === "LOWER_BOUND" ? [f.economicAmount.minimum] : []);
      return { month, value: null, minimum: lowerBounds.length ? money(lowerBounds.reduce((n, amount) => n.plus(amount), new Big(0)).toString()) : null,
        evidenceRefs: rows.map(f => f.purchaseIdentityKey).sort(compare) };
    }));
    extraRefs.push(sourceRef(key, "PurchaseAwareCanonical", history.samples, history.evidenceRefs));
    additional.push({ reserveKey: key, reason: "PURCHASE_AMOUNT_UNRESOLVED", value: { low: null, central: null, high: null },
      historicalReferences: history, knowledge: "PARTIAL", sourceRefs: [key], replacesSlotKey: null });
    extraDiagnostics.push(diagnostic("BASELINE_UNKNOWN_PURCHASE_PRESERVED", key, history.evidenceRefs));
  }
  const slots = [...food.slots, ...habits.slots, ...mobility.slots].sort((a, b) => compare(a.slotIdentityKey, b.slotIdentityKey));
  if (new Set(slots.map(slot => slot.slotIdentityKey)).size !== slots.length) throw new TypeError("BASELINE_SLOT_IDENTITY_CONFLICT");
  const sourceRefs = [...structural.sourceRefs, ...food.sourceRefs, ...habits.sourceRefs, ...mobility.sourceRefs, ...extraRefs]
    .sort((a, b) => compare(a.sourceKey, b.sourceKey));
  if (new Set(sourceRefs.map(ref => ref.sourceKey)).size !== sourceRefs.length) throw new TypeError("BASELINE_SOURCE_IDENTITY_CONFLICT");
  const structuralFacts = { ...structural.structuralFacts,
    resources: [...structural.structuralFacts.resources].sort((a, b) => compare(a.factKey, b.factKey)),
    obligations: [...structural.structuralFacts.obligations].sort((a, b) => compare(a.factKey, b.factKey)),
    savingsReservations: [...structural.structuralFacts.savingsReservations].sort((a, b) => compare(a.reservationId, b.reservationId)),
    externalKnownContexts: [...structural.structuralFacts.externalKnownContexts].sort((a, b) => compare(a.externalContextId, b.externalContextId)) };
  const body = { version: "planning-baseline@v1" as const, householdId, targetMonth, knowledgeCutoff, structuralFacts, slots,
    unresolvedReserves: [...food.unresolvedReserves, ...mobility.unresolvedReserves, ...additional].sort((a, b) => compare(a.reserveKey, b.reserveKey)),
    sourceRefs, modelVersions: { builder: PLANNING_BASELINE_MODEL, reference: BASELINE_REFERENCE_POLICY,
      food: BASELINE_FOOD_MODEL, habits: BASELINE_HABIT_MODEL, mobility: BASELINE_MOBILITY_MODEL,
      foodOwner: s.food.methodVersion, mobilityOwner: s.personalMobility.methodVersion },
    diagnostics: [...structural.diagnostics, ...food.diagnostics, ...habits.diagnostics, ...mobility.diagnostics, ...extraDiagnostics]
      .sort((a, b) => compare(`${a.code}:${a.targetRef}`, `${b.code}:${b.targetRef}`)) };
  // Copy into lossless JSON: callers cannot mutate source objects through this result.
  return { ...parsePlannerJson(body) as typeof body, digest: planningBaselineDigest(body) };
}
