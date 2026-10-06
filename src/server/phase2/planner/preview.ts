import "server-only";
import Big from "big.js";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlanningWorldFacts, PlannerExpectedBase, PlanScenarioPreview } from "@/domain/phase2/planner/compiler-contract";
import { compileSemanticPlan, jsonEnvelope, PLANNER_COMPILER_VERSION } from "./compiler";
import { deriveCompiledMonthScenario } from "./financial-adapter";
import { buildPlanProjection, PLAN_PROJECTION_MODEL } from "./projection";
import { mutatePlanSemanticState } from "./semantic-mutations";

/** Same pure evaluation for preview, server apply, assistant and immediate reload. */
export function evaluatePlanScenario(world: PlanningWorldFacts, semanticState: PlanSemanticStateV1, base: PlannerExpectedBase): PlanScenarioPreview {
  const state = parsePlanSemanticState(semanticState);
  const input = { baseline: world.baseline, semanticState: state, externalIntents: world.externalIntents, world,
    compilerVersion: PLANNER_COMPILER_VERSION, modelVersions: { ...world.modelVersions, projection: PLAN_PROJECTION_MODEL } };
  const compiled = compileSemanticPlan(input);
  const baselineCompiled = compileSemanticPlan({ ...input, semanticState: emptyPlanSemanticState(state.targetMonth),
    forcedOwnedSlotKeys: compiled.financialAdapterInput.adapterManifest.planOwnedDecisionSlots });
  const scenario = deriveCompiledMonthScenario(world, compiled), baselineScenario = deriveCompiledMonthScenario(world, baselineCompiled);
  const initial = buildPlanProjection(world, state, compiled, scenario, baselineCompiled, baselineScenario);
  const marginal = (targetRef: string, makeState: () => PlanSemanticStateV1) => {
    try {
      const without = makeState(), alternative = compileSemanticPlan({ ...input, semanticState: without });
      const alternativeScenario = deriveCompiledMonthScenario(world, alternative);
      const after = buildPlanProjection(world, without, alternative, alternativeScenario, baselineCompiled, baselineScenario).plan.economicMonthEndRemainder;
      const current = initial.plan.economicMonthEndRemainder;
      return jsonEnvelope({ targetRef, marginalImpactOnMonthEnd: current !== null && after !== null ? new Big(current).minus(after).toFixed(2) : null,
        rationaleCode: current !== null && after !== null ? "REAL_COMPILER_MARGINAL" : "MARGINAL_UNRESOLVED",
        comparisonSemanticStateDigest: alternative.semanticStateDigest });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return jsonEnvelope({ targetRef, marginalImpactOnMonthEnd: null, rationaleCode: "MARGINAL_REQUIRES_RESOLUTION", resolution: error.message });
    }
  };
  const projection = { ...initial, impacts: [...compiled.contextualEffects.map(jsonEnvelope),
    ...state.controls.map(c => marginal(c.decisionId, () => parsePlanSemanticState({ ...state, controls: state.controls.filter(item => item.decisionId !== c.decisionId) }))),
    ...state.contexts.map(c => marginal(c.contextOccurrenceId, () => mutatePlanSemanticState(state, { kind: "REMOVE_CONTEXT", contextOccurrenceId: c.contextOccurrenceId })))] };
  const projectionDigest = plannerDigest(projection);
  const previewDigest = plannerDigest({ version: "planner-preview@v1", baselineDigest: world.baseline.digest,
    semanticStateDigest: compiled.semanticStateDigest, compiledManifestDigest: compiled.manifestDigest, projectionDigest,
    expectedActiveRevisionId: base.expectedActiveRevisionId, expectedActiveRevisionNumber: base.expectedActiveRevisionNumber });
  return { baseline: world.baseline, baselineDigest: world.baseline.digest, baseActiveRevisionId: base.expectedActiveRevisionId,
    baseRevisionNumber: base.expectedActiveRevisionNumber, semanticStateDigest: compiled.semanticStateDigest,
    compiledManifestDigest: compiled.manifestDigest, previewDigest, projectionDigest, projection, compiled, scenario };
}
