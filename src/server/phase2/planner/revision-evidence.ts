import "server-only";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { PlanRevision } from "@/domain/phase2/planner/plan-contract";

/** Validate the coupled evidence, rather than accepting independent well-formed digests. */
export function assertRevisionEvidence(revision: PlanRevision): void {
  const evidence = revision.projectionEvidence, snapshot = revision.baselineSnapshot;
  const { digest: baselineDigest, knowledgeCutoff: _clock, ...baselineFacts } = snapshot;
  if (snapshot.version !== "planning-baseline@v1" || snapshot.householdId !== revision.householdId || snapshot.targetMonth !== revision.targetMonth
    || baselineDigest !== revision.baselineDigest || plannerDigest(baselineFacts) !== revision.baselineDigest
    || revision.compiledManifest.version !== "planner-manifest@v1" || revision.compiledManifest.baselineDigest !== revision.baselineDigest
    || revision.compiledManifest.semanticStateDigest !== revision.semanticStateDigest
    || revision.compiledManifest.compilerVersion !== revision.compilerVersion || plannerDigest(revision.compiledManifest) !== revision.compiledManifestDigest
    || evidence.version !== "planner-projection-evidence@v1" || evidence.compiledManifestDigest !== revision.compiledManifestDigest
    || evidence.projectionDigest !== plannerDigest(evidence.projection)) throw new TypeError("PLANNER_STORED_EVIDENCE_INVALID");
}
