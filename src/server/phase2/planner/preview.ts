import "server-only";
import Big from "big.js";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { PlanningWorldFacts, PlannerExpectedBase, PlanScenarioPreview } from "@/domain/phase2/planner/compiler-contract";
import { compileSemanticPlan, jsonEnvelope, PLANNER_COMPILER_VERSION } from "./compiler";
import { deriveCompiledMonthScenario } from "./financial-adapter";

/** Pure evaluation shared by Preview, server Apply and active Plan reload. */
export function evaluatePlanScenario(world: PlanningWorldFacts, semanticState: PlanSemanticStateV1, base: PlannerExpectedBase): PlanScenarioPreview {
  const state = parsePlanSemanticState(semanticState);
  const input = { baseline: world.baseline, semanticState: state, externalIntents: world.externalIntents, world,
    compilerVersion: PLANNER_COMPILER_VERSION, modelVersions: world.modelVersions };
  const compiled = compileSemanticPlan(input);
  const baselineCompiled = compileSemanticPlan({ ...input, semanticState: emptyPlanSemanticState(state.targetMonth),
    forcedOwnedSlotKeys: compiled.financialAdapterInput.adapterManifest.planOwnedDecisionSlots });
  const scenario = deriveCompiledMonthScenario(world, compiled), baselineScenario = deriveCompiledMonthScenario(world, baselineCompiled);
  const plan = scenario.economicPlan, before = baselineScenario.economicPlan;
  const blocked = compiled.diagnostics.some(d => d.severity === "BLOCK") || plan === null;
  const hasUnknownFinancialBasis = (plan: typeof compiled) => plan.constraints.some(c => c.code === "COMPONENT_COST_UNKNOWN" || c.code === "OWNED_SLOT_COST_UNKNOWN"
    || c.code === "OWNED_SLOT_FINANCIAL_REFERENCE_UNRESOLVED" || c.code === "OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED"
    || c.code === "OWNED_SLOT_CONDITION_UNRESOLVED" || c.code === "OWNED_SLOT_FINANCIAL_MAPPING_AMBIGUOUS");
  const remainder = hasUnknownFinancialBasis(compiled) ? null : plan?.scenarios.central ?? null;
  const baselineRemainder = hasUnknownFinancialBasis(baselineCompiled) ? null : before?.scenarios.central ?? null;
  const diagnostics = [...compiled.diagnostics, ...(baselineRemainder === null ? [{ code: "BASELINE_FINANCIAL_COMPARISON_UNKNOWN", severity: "WARN" as const,
    targetRef: null, message: "BASELINE_FINANCIAL_COMPARISON_UNKNOWN", evidenceRefs: [] }] : []), ...(!plan ? [{ code: "FINANCIAL_SCENARIO_UNRESOLVED", severity: "BLOCK" as const,
    targetRef: null, message: "FINANCIAL_SCENARIO_UNRESOLVED", evidenceRefs: [] }] : [])];
  const projection: PlanProjectionV1 = { version: "plan-projection@v1", targetMonth: state.targetMonth,
    baseline: { digest: world.baseline.digest, economicMonthEndRemainder: baselineRemainder },
    plan: { economicMonthEndRemainder: remainder, impactOnMonthEnd: remainder !== null && baselineRemainder !== null
      ? new Big(remainder).minus(baselineRemainder).toFixed(2) : null },
    economic: { resources: plan?.economicResources ?? null, certainCommitments: plan?.certainOutflows.total ?? null,
      savingsReservations: plan?.savingsAllocations.total ?? null, needsAndHabits: null, discretionaryLife: null,
      explicitContexts: compiled.components.some(c => c.evaluation.economicAmount === null) ? null : compiled.components.filter(c => c.externalEntryId === null)
        .reduce((n, c) => n.plus(c.evaluation.economicAmount!), new Big(0)).toFixed(2),
      mobilityUsageEconomicCost: null, unresolvedEconomicAmount: null },
    funding: jsonEnvelope({ status: "PARTIAL", financialOwner: plan?.plannedFunding ?? null,
      knownSyntheticCostWithUnknownFunding: compiled.financialAdapterInput.plannedExpenseEntries
        .filter(e => e.id.startsWith("planner:")).flatMap(e => e.costItems).filter(c => c.fundingAllocations?.length === 0)
        .reduce((n, c) => n.plus(c.unitAmount), new Big(0)).toFixed(2),
      anonymousSlotFunding: "UNKNOWN", unresolvedReserves: world.baseline.unresolvedReserves }),
    cash: { knowledge: "UNKNOWN", openingBalance: world.monthInputs.openingBalance?.amount ?? null, lowPointAmount: null, lowPointDate: null },
    mobility: { usageEconomicCost: null, cashTransportCosts: null, journeyCount: 0, unresolvedJourneyCount: 0 },
    goal: { targetMonthEnd: world.monthInputs.decision?.goal ?? null,
      gapToGoal: remainder !== null && world.monthInputs.decision?.goal !== null && world.monthInputs.decision?.goal !== undefined
        ? new Big(world.monthInputs.decision.goal).minus(remainder).toFixed(2) : null },
    impacts: compiled.contextualEffects.map(jsonEnvelope), diagnostics,
    projectionCompleteness: remainder === null ? "UNKNOWN" : "PARTIAL", applyReadiness: blocked ? "BLOCKED" : "READY_WITH_WARNINGS" };
  const projectionDigest = plannerDigest(projection);
  const previewDigest = plannerDigest({ version: "planner-preview@v1", baselineDigest: world.baseline.digest,
    semanticStateDigest: compiled.semanticStateDigest, compiledManifestDigest: compiled.manifestDigest, projectionDigest,
    expectedActiveRevisionId: base.expectedActiveRevisionId, expectedActiveRevisionNumber: base.expectedActiveRevisionNumber });
  return { baseline: world.baseline, baselineDigest: world.baseline.digest, baseActiveRevisionId: base.expectedActiveRevisionId,
    baseRevisionNumber: base.expectedActiveRevisionNumber, semanticStateDigest: compiled.semanticStateDigest,
    compiledManifestDigest: compiled.manifestDigest, previewDigest, projectionDigest, projection, compiled, scenario };
}
