import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import type { PlanningPlanSlot } from "@/domain/phase2/planner/baseline-contract";
import type { PlanningBaselineSources } from "./baseline-sources";
import { closedMonths, compare, diagnostic, emptyValue, makeSlot, money, sourceRef, unique } from "./baseline-evidence";

export const BASELINE_HABIT_MODEL = "planner-canonical-habit-assertions@v1";
export function buildHabitBaseline(s: PlanningBaselineSources) {
  const slots: PlanningPlanSlot[] = [], sourceRefs = [], diagnostics = [];
  const assertions = [...s.habitAssertions].filter(a => Temporal.Instant.compare(a.validatedAt, s.knowledgeCutoff) <= 0)
    .sort((a, b) => compare(a.assertionId, b.assertionId));
  const identities = new Set<string>();
  for (const a of assertions) {
    if (a.authority !== "USER_VALIDATED" || a.priceBasis !== "INDICATIVE_PRICE_NOT_PAYMENT") throw new TypeError("BASELINE_HABIT_AUTHORITY_INVALID");
    if (!(Number(a.monthlyVisitEstimate) > 0) || Number(a.typicalVisitPrice) < 0) throw new TypeError("BASELINE_HABIT_VALUE_INVALID");
    if (!Object.hasOwn(s.evidence.personNamesById, a.personId)) throw new TypeError("BASELINE_HABIT_PERSON_SCOPE_INVALID");
    const key = `habit:${a.personId}:${a.habitKey}`;
    if (identities.has(key)) throw new TypeError("BASELINE_HABIT_IDENTITY_CONFLICT");
    identities.add(key);
    sourceRefs.push(sourceRef(key, "person_habit_assertions", a, [`habit-assertion:${a.assertionId}`]));
    slots.push(makeSlot({ semanticKey: a.habitKey, controlKey: key, kind: "OCCURRENCE", scope: { kind: "PERSON", personId: a.personId },
      inclusion: "CENTRAL", baselineValue: { ...emptyValue(), count: String(Number(a.monthlyVisitEstimate)), unitAmount: money(a.typicalVisitPrice) },
      knowledge: "DECLARED", provenance: ["USER_VALIDATED_HABIT"], sourceRefs: [key],
      capabilities: [{ action: "SET_COUNT", availability: "AVAILABLE", reason: null }] }));
  }
  // Product history supplies evidence of acquisition, never a fabricated renewal due-window.
  // C4 owns episodes/profiles. These conditional unknown slots remain visible for C2.
  const months = closedMonths(s, ["BANK"]);
  const groups = new Map<string, typeof s.productObservations[number][]>();
  for (const o of s.productObservations.filter(o => months.includes(o.observedAt.slice(0, 7)))) {
    const person = o.subject.kind === "PERSON" ? o.subject.personId : null;
    if (person && !Object.hasOwn(s.evidence.personNamesById, person)) throw new TypeError("BASELINE_PRODUCT_PERSON_SCOPE_INVALID");
    if (o.subject.kind === "HOUSEHOLD" && o.subject.householdId !== s.householdId) throw new TypeError("BASELINE_PRODUCT_HOUSEHOLD_SCOPE_INVALID");
    const key = `${person ?? "household"}:${o.needKey}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  for (const [group, observations] of [...groups].sort(([a], [b]) => compare(a, b))) {
    const byId = new Map(observations.map(o => [o.observationId, o]));
    if (byId.size !== observations.length) throw new TypeError("BASELINE_PRODUCT_IDENTITY_CONFLICT");
    const rows = [...observations].sort((a, b) => compare(a.observationId, b.observationId)), first = rows[0]!;
    const subject = first.subject, key = `need-observations:${group}`;
    const subjects = Object.values(s.needSubjects).filter(n => n.needKey === first.needKey);
    const personId = subject.kind === "PERSON" ? String(subject.personId) : null;
    if (subjects.length !== 1 || subjects[0]!.personId !== personId) throw new TypeError("BASELINE_NEED_SUBJECT_CONFLICT");
    const evidence = unique(rows.flatMap(o => o.evidenceRefs));
    sourceRefs.push(sourceRef(key, "Needs+ProductObservations", { rows, comparableMonths: months }, evidence));
    slots.push(makeSlot({ semanticKey: `need:${first.needKey}`, controlKey: null, kind: "CONDITIONAL_OCCURRENCE",
      scope: personId ? { kind: "PERSON", personId } : { kind: "HOUSEHOLD" }, inclusion: "CONDITIONAL",
      baselineValue: { ...emptyValue(), dueState: "UNKNOWN" }, knowledge: "UNKNOWN", provenance: ["CANONICAL_HISTORY"],
      sourceRefs: [key], capabilities: [{ action: "REVIEW_REFERENCE", availability: "AVAILABLE", reason: "RENEWAL_PROFILE_NOT_BUILT" }] }));
    diagnostics.push(diagnostic("BASELINE_RENEWAL_DUE_STATE_UNKNOWN", key, evidence));
  }
  return { slots, sourceRefs, diagnostics };
}
