import "server-only";
import Big from "big.js";
import { canonicalPlannerJson, plannerDigest } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlanningWorldFacts, PlannerExpectedBase, PlanScenarioPreview, CompiledSemanticPlanV1 } from "@/domain/phase2/planner/compiler-contract";
import { compileSemanticPlan, jsonEnvelope, PLANNER_COMPILER_VERSION } from "./compiler";
import { deriveCompiledMonthScenario } from "./financial-adapter";
import { buildPlanProjection, PLAN_PROJECTION_MODEL } from "./projection";
import { mutatePlanSemanticState } from "./semantic-mutations";
import { materializePlanSlots } from "./plan-slot-resolver";
import { snapshotSync } from "./snapshot-observation";
import type { PlanRevision } from "@/domain/phase2/planner/plan-contract";
import { historicalControlAdmission, type HistoricalControlAdmission } from "./historical-control-admission";

/** The branches share all authorities/versions. In the audited v6 Compiler,
 * forcedOwnedSlotKeys only affects materialization. Compare both complete slot
 * results and the entire normalized state, including preferences. Structural
 * ownership can be repeated without changing slots; any difference fails closed.
 * A future Compiler must establish this equivalence again before reuse. */
function isSemanticallyNeutralPlanEvaluation(world: PlanningWorldFacts, state: PlanSemanticStateV1, reference: PlanSemanticStateV1,
  compiled: CompiledSemanticPlanV1, compilerVersion: string): boolean {
  const manifest = compiled.financialAdapterInput.adapterManifest;
  return compilerVersion === "planner-semantic-compiler@v6-headless"
    && canonicalPlannerJson(state) === canonicalPlannerJson(reference)
    && manifest.baselineConsumptions.length === 0
    && manifest.neutralizedLegacyAssumptions.length === 0
    && canonicalPlannerJson(jsonEnvelope({ slots: materializePlanSlots(world.baseline, state) }))
      === canonicalPlannerJson(jsonEnvelope({ slots: materializePlanSlots(world.baseline, reference, manifest.planOwnedDecisionSlots) }));
}

/** Same pure evaluation for preview, server apply, assistant and immediate reload. */
export function evaluatePlanScenario(world: PlanningWorldFacts, semanticState: PlanSemanticStateV1, base: PlannerExpectedBase): PlanScenarioPreview {
  return evaluate(world,semanticState,base,true);
}

/** Official immutable read only. The proof is tied to the persisted revision's
 * exact controls; it is never accepted by READ's raw Draft or by a new Apply. */
export function evaluateHistoricalPlanScenario(world: PlanningWorldFacts, revision: PlanRevision, base: PlannerExpectedBase,
  includeMarginals = true): PlanScenarioPreview {
  return evaluate(world, revision.semanticState, base, includeMarginals, historicalControlAdmission(revision));
}

/** Prospective mutation preflight only. Absolute scenario/constraints remain
 * identical; per-decision attribution is unnecessary. Never used for Apply
 * receipts or official evidence digests. */
export function evaluatePlanMutation(world:PlanningWorldFacts,semanticState:PlanSemanticStateV1,base:PlannerExpectedBase):PlanScenarioPreview {
  return evaluate(world,semanticState,base,false);
}
function evaluate(world:PlanningWorldFacts,semanticState:PlanSemanticStateV1,base:PlannerExpectedBase,includeMarginals:boolean,historical?:HistoricalControlAdmission):PlanScenarioPreview {
  return snapshotSync("Compiler_Finance_V2", () => {
  const state = parsePlanSemanticState(semanticState);
  const input = { baseline: world.baseline, semanticState: state, externalIntents: world.externalIntents, world,
    compilerVersion: PLANNER_COMPILER_VERSION, modelVersions: { ...world.modelVersions, projection: PLAN_PROJECTION_MODEL } };
  const compiled = compileSemanticPlan(input, historical);
  const referenceState = emptyPlanSemanticState(state.targetMonth);
  const baselineCompiled = isSemanticallyNeutralPlanEvaluation(world, state, referenceState, compiled, input.compilerVersion)
    ? compiled : compileSemanticPlan({ ...input, semanticState: referenceState,
    forcedOwnedSlotKeys: compiled.financialAdapterInput.adapterManifest.planOwnedDecisionSlots });
  const scenario = deriveCompiledMonthScenario(world, compiled), baselineScenario = baselineCompiled === compiled
    ? scenario : deriveCompiledMonthScenario(world, baselineCompiled);
  const initial = buildPlanProjection(world, state, compiled, scenario, baselineCompiled, baselineScenario);
  const marginal = (targetRef: string, makeState: () => PlanSemanticStateV1) => {
    try {
      const without = makeState(), alternative = compileSemanticPlan({ ...input, semanticState: without }, historical);
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
  const projection = includeMarginals ? { ...initial, impacts: [...compiled.contextualEffects.map(jsonEnvelope),
    ...state.controls.map(c => marginal(c.decisionId, () => parsePlanSemanticState({ ...state, controls: state.controls.filter(item => item.decisionId !== c.decisionId) }))),
    ...state.contexts.map(c => marginal(c.contextOccurrenceId, () => mutatePlanSemanticState(state, { kind: "REMOVE_CONTEXT", contextOccurrenceId: c.contextOccurrenceId })))] } : initial;
  const projectionDigest = plannerDigest(projection);
  const previewDigest = plannerDigest({ version: "planner-preview@v1", baselineDigest: world.baseline.digest,
    semanticStateDigest: compiled.semanticStateDigest, compiledManifestDigest: compiled.manifestDigest, projectionDigest,
    expectedActiveRevisionId: base.expectedActiveRevisionId, expectedActiveRevisionNumber: base.expectedActiveRevisionNumber });
  return { baseline: world.baseline, baselineDigest: world.baseline.digest, baseActiveRevisionId: base.expectedActiveRevisionId,
    baseRevisionNumber: base.expectedActiveRevisionNumber, semanticStateDigest: compiled.semanticStateDigest,
    compiledManifestDigest: compiled.manifestDigest, previewDigest, projectionDigest, projection, compiled, scenario };
  });
}
