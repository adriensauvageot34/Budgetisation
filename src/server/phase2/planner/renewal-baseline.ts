import "server-only";
import type { PlanningBaselineSources } from "./baseline-sources";
import type { PlanningPlanSlot } from "@/domain/phase2/planner/baseline-contract";
import { buildSimplePlanningBaseline } from "./simple-baseline";
import { planningBaselineDigest } from "./baseline";
import { buildRenewalReadModel, RENEWAL_MODEL_VERSION } from "./renewal-engine";
import { compare, emptyValue, makeSlot, sourceRef, unique } from "./baseline-evidence";

/** C6 enriches the admitted C1/C3 facts; semantic decisions are never inputs. */
export function buildRenewalPlanningBaseline(s: PlanningBaselineSources) {
  const base = buildSimplePlanningBaseline(s), renewals = buildRenewalReadModel(s);
  const slots: PlanningPlanSlot[] = base.slots.filter(slot => !slot.semanticKey.startsWith("need:")
    && !(slot.semanticKey === "hairdresser" && renewals.needOccurrences.some(n => n.needKey === "hairdresser" && n.personId === slot.scope.personId)));
  const refs = [...base.sourceRefs];
  for (const occurrence of renewals.needOccurrences) {
    const profile = renewals.replenishmentProfiles.find(p => p.needId === occurrence.needId)!;
    const personalHabit = profile.authority === "USER_VALIDATED";
    const assertion = personalHabit ? s.habitAssertions.find(a => profile.evidenceRefs.includes(`habit-assertion:${a.assertionId}`))! : null;
    const key = `renewal:${occurrence.needId}`;
    refs.push(sourceRef(key, RENEWAL_MODEL_VERSION, { profile, occurrence,
      episodes: renewals.acquisitionEpisodes.filter(e => e.needId === occurrence.needId) }, occurrence.evidenceRefs));
    slots.push(makeSlot({ semanticKey: personalHabit ? "hairdresser" : `need:${occurrence.needKey}`, controlKey: key,
      kind: personalHabit ? "OCCURRENCE" : "CONDITIONAL_OCCURRENCE",
      scope: occurrence.personId ? { kind: "PERSON", personId: occurrence.personId } : { kind: "HOUSEHOLD" },
      inclusion: personalHabit ? "CENTRAL" : occurrence.targetMonthRelation === "OUTSIDE" ? "SUGGESTION_ONLY" : "CONDITIONAL",
      baselineValue: { ...emptyValue(), count: assertion ? assertion.monthlyVisitEstimate : occurrence.autoEligible ? "1.00" : null,
        unitAmount: profile.referenceUnitAmount, dueState: occurrence.dueState },
      sourceRefs: [key], knowledge: occurrence.knowledge, provenance: [personalHabit ? "USER_VALIDATED_HABIT" : "CANONICAL_HISTORY"],
      capabilities: [{ action: "SET_COUNT", availability: "AVAILABLE", reason: occurrence.autoEligible ? null : "NEEDS_NEW_INPUT" }],
      renewalAuthority: { needId: occurrence.needId, needOccurrenceId: occurrence.needOccurrenceId,
        autoEligible: occurrence.autoEligible, conditional: !personalHabit, referenceKeys: [], priceBasis: profile.referencePriceBasis } }));
  }
  const result = { ...base, renewals, slots: slots.sort((a, b) => compare(a.slotIdentityKey, b.slotIdentityKey)),
    sourceRefs: refs.sort((a, b) => compare(a.sourceKey, b.sourceKey)),
    modelVersions: { ...base.modelVersions, renewals: RENEWAL_MODEL_VERSION },
    diagnostics: [...base.diagnostics.filter(d => d.code !== "BASELINE_RENEWAL_DUE_STATE_UNKNOWN"), ...renewals.diagnostics]
      .sort((a, b) => compare(`${a.code}:${a.targetRef}`, `${b.code}:${b.targetRef}`)) };
  if (unique(result.slots.map(s => s.slotIdentityKey)).length !== result.slots.length) throw new TypeError("RENEWAL_SLOT_IDENTITY_CONFLICT");
  return { ...structuredClone(result), digest: planningBaselineDigest(result) };
}
