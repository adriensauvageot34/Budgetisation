import "server-only";
import type { PlanRevision } from "@/domain/phase2/planner/plan-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { assertRevisionEvidence } from "./revision-evidence";

/** Request-local proof, never a JSON/client option. Only exact immutable controls
 * may retain their former numeric admission during an official read. New Drafts
 * and new Apply always use today's published limits. */
export type HistoricalControlAdmission = Readonly<{ householdId: string; targetMonth: string }>;
const controls = new WeakMap<HistoricalControlAdmission, ReadonlyMap<string, string>>();
export function historicalControlAdmission(revision: PlanRevision): HistoricalControlAdmission {
  assertRevisionEvidence(revision);
  if (semanticStateDigest(revision.semanticState) !== revision.semanticStateDigest
    || plannerDigest(revision.compiledManifest.semanticState!) !== plannerDigest(revision.semanticState))
    throw new TypeError("PLANNER_STORED_EVIDENCE_INVALID");
  const proof = Object.freeze({ householdId: revision.householdId, targetMonth: revision.targetMonth });
  controls.set(proof, new Map(revision.semanticState.controls.map(control => [control.decisionId, plannerDigest(control)])));
  return proof;
}
export function isHistoricalControl(proof: HistoricalControlAdmission | undefined, householdId: string, targetMonth: string,
  control: PlanSemanticStateV1["controls"][number]): boolean {
  return !!proof && proof.householdId === householdId && proof.targetMonth === targetMonth
    && controls.get(proof)?.get(control.decisionId) === plannerDigest(control);
}
