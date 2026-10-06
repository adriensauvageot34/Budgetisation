import "server-only";
import { emptyPlanSemanticState, parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest, plannerDigestString, plannerInteger, plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import type { PlanningWorldFacts, PlannerApplyCommand, PlanScenarioPreview } from "@/domain/phase2/planner/compiler-contract";
import type { PlanRevision } from "@/domain/phase2/planner/plan-contract";
import type { PlanRepository } from "./repository";
import { jsonEnvelope, PLANNER_COMPILER_VERSION } from "./compiler";
import { evaluatePlanScenario } from "./preview";
import { assertRevisionEvidence } from "./revision-evidence";
import { revisionChangeSet } from "./change-set";

export type PlannerDependencies = Readonly<{ repository: PlanRepository;
  readWorld(householdId: string, targetMonth: string): Promise<PlanningWorldFacts>;
  prepareWorld?(world: PlanningWorldFacts, state: PlanSemanticStateV1): Promise<PlanningWorldFacts> }>;
export type AppliedPlanScenario = Readonly<{ revision: PlanRevision; projectionEvidence: PlanRevision["projectionEvidence"]; replayed: boolean }>;
function replayEvidence(previous: PlanRevision, state: PlanSemanticStateV1, baselineDigest: string, previewDigest: string,
  activeId: string | null, activeNumber: number): AppliedPlanScenario {
  assertRevisionEvidence(previous);
  if (previous.previewDigest !== previewDigest || previous.baselineDigest !== baselineDigest || previous.semanticStateDigest !== semanticStateDigest(state)
    || previous.parentRevisionId !== activeId || previous.revisionNumber !== activeNumber + 1) throw new TypeError("PLANNER_IDEMPOTENCY_CONFLICT");
  return { revision: previous, projectionEvidence: previous.projectionEvidence, replayed: true };
}
export async function previewPlanScenario(deps: PlannerDependencies, householdId: string, rawState: PlanSemanticStateV1): Promise<PlanScenarioPreview> {
  const household = plannerUuid(householdId), state = parsePlanSemanticState(rawState);
  const [world, active] = await Promise.all([deps.readWorld(household, state.targetMonth), deps.repository.readActivePlan(household, state.targetMonth)]);
  if (world.baseline.householdId !== household) throw new TypeError("PLANNER_WORLD_HOUSEHOLD_INVALID");
  const prepared = deps.prepareWorld ? await deps.prepareWorld(world, state) : world;
  return evaluatePlanScenario(prepared, state, { expectedActiveRevisionId: active?.plan.activeRevisionId ?? null,
    expectedActiveRevisionNumber: active?.plan.activeRevisionNumber ?? 0 });
}
export async function applyPlanScenario(deps: PlannerDependencies, householdId: string, rawState: PlanSemanticStateV1,
  command: PlannerApplyCommand): Promise<AppliedPlanScenario> {
  const household = plannerUuid(householdId), state = parsePlanSemanticState(rawState), month = plannerMonth(state.targetMonth);
  const requestId = plannerUuid(command.applyRequestId), baselineDigest = plannerDigestString(command.expectedBaselineDigest), previewDigest = plannerDigestString(command.expectedPreviewDigest);
  const activeId = command.expectedActiveRevisionId === null ? null : plannerUuid(command.expectedActiveRevisionId);
  const activeNumber = plannerInteger(command.expectedActiveRevisionNumber);
  if ((activeId === null) !== (activeNumber === 0)) throw new TypeError("PLANNER_EXPECTED_BASE_INVALID");
  // An idempotent retry returns immutable evidence, even if authorities or the active Plan have advanced.
  const previous = await deps.repository.readAppliedRequest(household, month, requestId);
  if (previous) return replayEvidence(previous, state, baselineDigest, previewDigest, activeId, activeNumber);
  const preview = await previewPlanScenario(deps, household, state);
  if (preview.baseActiveRevisionId !== activeId || preview.baseRevisionNumber !== activeNumber) throw new TypeError("PLANNER_ACTIVE_REVISION_STALE");
  if (preview.baselineDigest !== baselineDigest || preview.previewDigest !== previewDigest) throw new TypeError("PLANNER_PREVIEW_STALE");
  if (preview.projection.applyReadiness === "BLOCKED") throw new TypeError("PLANNER_APPLY_BLOCKED");
  const authorityDate = (preview.compiled.manifest.authorityEvidence as { asOfDate: string }).asOfDate;
  if (month < authorityDate.slice(0, 7)) throw new TypeError("PLANNER_PAST_MONTH_READ_ONLY");
  const parent = await deps.repository.readActivePlan(household, month);
  if ((parent?.plan.activeRevisionId ?? null) !== activeId || (parent?.plan.activeRevisionNumber ?? 0) !== activeNumber)
    throw new TypeError("PLANNER_ACTIVE_REVISION_STALE");
  const changeSet = revisionChangeSet(parent?.activeRevision?.semanticState ?? emptyPlanSemanticState(month), state);
  // Re-read/recompile above, then exactly one atomic C0 RPC. No MonthInputs or PlannedExpense writer.
  const worldBaseline = jsonEnvelope(preview.baseline);
  const evidence = jsonEnvelope({ version: "planner-projection-evidence@v1", projection: preview.projection,
    projectionDigest: preview.projectionDigest, compiledManifestDigest: preview.compiledManifestDigest });
  const payload = { householdId: household, targetMonth: month, expectedActiveRevisionId: activeId,
    expectedActiveRevisionNumber: activeNumber, applyRequestId: requestId, baselineDigest, baselineSnapshot: worldBaseline,
    semanticState: state, semanticStateDigest: preview.semanticStateDigest, changeSet, compiledManifest: preview.compiled.manifest,
    compiledManifestDigest: preview.compiledManifestDigest, projectionEvidence: evidence, previewDigest,
    compilerVersion: PLANNER_COMPILER_VERSION, modelVersions: preview.compiled.manifest.modelVersions as Record<string, string> };
  let result;
  try { result = await deps.repository.applyRevision(payload); }
  catch (error) {
    // Recover a committed response lost in transit or a concurrent identical request.
    // Different payloads stay conflicts; this path never retries a write.
    const committed = await deps.repository.readAppliedRequest(household, month, requestId);
    if (committed) return replayEvidence(committed, state, baselineDigest, previewDigest, activeId, activeNumber);
    throw error;
  }
  assertRevisionEvidence(result.revision);
  if (result.revision.previewDigest !== previewDigest || result.revision.compiledManifestDigest !== preview.compiledManifestDigest
    || plannerDigest(result.revision.projectionEvidence) !== plannerDigest(evidence)) throw new TypeError("PLANNER_RPC_EVIDENCE_DIVERGED");
  return { revision: result.revision, projectionEvidence: result.revision.projectionEvidence, replayed: result.replayed };
}
