import "server-only";
import Big from "big.js";
import type { PlanProjectionV1 } from "@/domain/phase2/planner/projection-contract";
import type { PlanningWorldFacts, CompiledSemanticPlanV1 } from "@/domain/phase2/planner/compiler-contract";
import type { PlannerDiagnostic } from "@/domain/phase2/planner/diagnostics";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { MonthScenario } from "../month-scenario";
import { plannedLineGross, costItemCashTreatment } from "@/domain/phase2/planned-money";
import { jsonEnvelope } from "./compiler";
import { slotReferenceKeys } from "./plan-slot-resolver";

export const PLAN_PROJECTION_MODEL = "planner-projection@v2-headless";
const sum = (values: readonly (string | null)[]): string | null => values.some(v => v === null) ? null : values.reduce<Big>((n, v) => n.plus(v!), new Big(0)).toFixed(2);
const unknownCodes = new Set(["COMPONENT_COST_UNKNOWN", "OWNED_SLOT_COST_UNKNOWN", "OWNED_SLOT_FINANCIAL_REFERENCE_UNRESOLVED",
  "OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED", "OWNED_SLOT_CONDITION_UNRESOLVED", "OWNED_SLOT_FINANCIAL_MAPPING_AMBIGUOUS",
  "CONTEXT_COMPONENT_SLOT_UNRESOLVED", "CONTEXT_SLOT_BINDING_UNRESOLVED", "MOBILITY_PRICING_UNRESOLVED",
  "MOBILITY_RELATION_NEEDS_CHOICE", "MOBILITY_DIRECTION_UNRESOLVED"]);
const unknown = (plan: CompiledSemanticPlanV1) => plan.constraints.some(c => unknownCodes.has(c.code));
/** A projection of the financial owner's result and compiled evidence, never a sum
 * of Board cards. Gross Contexts are an explanatory lens, not an additive total. */
export function buildPlanProjection(world: PlanningWorldFacts, state: PlanSemanticStateV1, compiled: CompiledSemanticPlanV1,
  scenario: MonthScenario, baselineCompiled: CompiledSemanticPlanV1, baselineScenario: MonthScenario): PlanProjectionV1 {
  const plan = scenario.economicPlan, remainder = unknown(compiled) ? null : plan?.scenarios.central ?? null;
  const before = unknown(baselineCompiled) ? null : baselineScenario.economicPlan?.scenarios.central ?? null;
  const mobilityTotal = (key: "economicFuel" | "cashTransport") => compiled.journeyPrices.length !== compiled.journeys.length
    || compiled.journeyPrices.some(p => p[key] === null) ? null : key === "economicFuel"
      ? sum([structuralMobility, ...items.filter(({ line }) => line.assetKey === "transport:fuel_usage").map(({ line }) => plannedLineGross(line))])
      : sum(compiled.journeyPrices.map(p => p[key]));
  const needSlot = (s: typeof compiled.planSlots[number]) => !!s.baseline.renewalAuthority || !!s.baseline.simpleAuthority
    && ["groceries", "tobacco-vape", "adrien-work-meals", "manon-work-meals"].includes(s.baseline.simpleAuthority.domain);
  const owned = compiled.planSlots.filter(s => s.owned && s.role === "BEHAVIOR");
  const components = compiled.components.filter(c => c.externalEntryId === null && !c.physicalJourneyRequirementId);
  const economicComponents = compiled.components.filter(c => c.assetKey !== "transport:fuel_usage");
  const items = compiled.financialAdapterInput.plannedExpenseEntries.flatMap(e => e.costItems.map(line => ({ entry: e, line })));
  const unfunded = items.filter(({ line }) => costItemCashTreatment(line) !== "ECONOMIC_ONLY" && (!line.fundingAllocations?.length
    || !line.fundingAllocations.reduce((n, a) => n.plus(a.amount), new Big(0)).eq(plannedLineGross(line))));
  const undated = items.filter(({ entry, line }) => !entry.plannedDate && costItemCashTreatment(line) !== "ECONOMIC_ONLY");
  const diagnostics: PlannerDiagnostic[] = [...compiled.diagnostics];
  const warn = (code: string, evidenceRefs: readonly string[] = []) => diagnostics.push({ code, severity: "WARN", targetRef: null, message: code, evidenceRefs });
  if (before === null) warn("BASELINE_FINANCIAL_COMPARISON_UNKNOWN");
  if (!plan) diagnostics.push({ code: "FINANCIAL_SCENARIO_UNRESOLVED", severity: "BLOCK", targetRef: null, message: "FINANCIAL_SCENARIO_UNRESOLVED", evidenceRefs: [] });
  if (unfunded.length) warn("PLAN_FUNDING_UNRESOLVED", unfunded.map(({ entry, line }) => `${entry.id}:${line.id}`));
  if (undated.length) warn("PLAN_TIMING_UNRESOLVED", undated.map(({ entry, line }) => `${entry.id}:${line.id}`));
  const unresolved = compiled.components.some(c => c.evaluation.economicAmount === null) || unknown(compiled)
    || world.baseline.unresolvedReserves.some(r => r.value.central === null);
  const needKeys = new Set(compiled.planSlots.filter(needSlot).flatMap(slotReferenceKeys));
  const componentIsNeed = (c: typeof economicComponents[number]) => !!c.needOccurrenceId || !!c.binding.slotIdentityKey
    && compiled.planSlots.some(s => s.baseline.slotIdentityKey === c.binding.slotIdentityKey && needSlot(s));
  const prediction = plan?.narrative.prediction;
  const referenceCategories = prediction ? [...prediction.essential, ...prediction.optional] : [];
  const structuralMobility = plan ? prediction
    ? sum(referenceCategories.filter(c => c.key === "manon-work-mobility").map(c => c.baselineProvision.central))
    : sum([...plan.necessaryVariables.items, ...plan.flexibleVariables.items].filter(c => c.key === "manon-work-mobility").map(c => c.central)) : null;
  const optionalNeedProvision = plan ? prediction
    ? sum(prediction.optional.filter(c => needKeys.has(c.key)).map(c => c.baselineProvision.central))
    : sum(plan.flexibleVariables.items.filter(c => needKeys.has(c.key)).map(c => c.central)) : null;
  const essentialMobility = plan ? prediction
    ? sum(prediction.essential.filter(c => c.key === "manon-work-mobility").map(c => c.baselineProvision.central))
    : sum(plan.necessaryVariables.items.filter(c => c.key === "manon-work-mobility").map(c => c.central)) : null;
  const referenceNeeds = plan?.necessaryVariables.total.central != null && optionalNeedProvision !== null && essentialMobility !== null
    ? new Big(plan.necessaryVariables.total.central).plus(optionalNeedProvision).minus(essentialMobility).toFixed(2) : null;
  const referenceDiscretionary = plan?.flexibleVariables.total.central != null && optionalNeedProvision !== null && structuralMobility !== null && essentialMobility !== null
    ? new Big(plan.flexibleVariables.total.central).minus(optionalNeedProvision).minus(new Big(structuralMobility).minus(essentialMobility)).toFixed(2) : null;
  // The owner alone decides absorption for external lines outside Plan-owned slots.
  // Their remaining extra intent is shown in discretionary life; never add their gross twice.
  const syntheticGross = sum(items.filter(({ entry }) => entry.id.startsWith("planner:")).map(({ line }) => plannedLineGross(line)))!;
  const mappedExternalGross = sum(compiled.components.filter(c => c.externalEntryId !== null).map(c => c.evaluation.economicAmount));
  const externalFuel = sum(items.filter(({ entry, line }) => !entry.id.startsWith("planner:") && line.assetKey === "transport:fuel_usage").map(({ line }) => plannedLineGross(line)))!;
  const otherExternalImpact = plan?.plannedExpenses.netImpact.central != null && mappedExternalGross !== null
    ? new Big(plan.plannedExpenses.netImpact.central).minus(syntheticGross).minus(mappedExternalGross).minus(externalFuel).toFixed(2) : null;
  const needs = plan ? sum([referenceNeeds, ...owned.filter(needSlot).map(s => s.remainingEconomicAmount),
    ...economicComponents.filter(componentIsNeed).map(c => c.evaluation.economicAmount)]) : null;
  const discretionary = plan ? sum([referenceDiscretionary, ...owned.filter(s => !needSlot(s)).map(s => s.remainingEconomicAmount),
    ...economicComponents.filter(c => !componentIsNeed(c)).map(c => c.evaluation.economicAmount), otherExternalImpact]) : null;
  const blocked = diagnostics.some(d => d.severity === "BLOCK");
  const cashOwner = plan?.bankCash, balance = cashOwner?.currentRealBankBalance;
  const cashKnowledge = unresolved || unfunded.length || undated.length || !cashOwner || cashOwner.endOfMonth.central === null ? "UNKNOWN" as const : "PARTIAL" as const;
  if (cashKnowledge === "UNKNOWN") warn("PLAN_CASH_PROJECTION_UNCERTIFIED", cashOwner?.limitations ?? []);
  const fundingToComplete = plan?.plannedFunding.fundingToComplete ?? null;
  const fundingComplete = !unresolved && unfunded.length === 0 && fundingToComplete !== null && new Big(fundingToComplete).eq(0);
  // No existing provider certifies a dated cash low point. A known economic
  // result can therefore be partial overall, but never falsely fully certified.
  const completeness = remainder === null ? "UNKNOWN" as const : "PARTIAL" as const;
  return { version: "plan-projection@v1", targetMonth: state.targetMonth,
    baseline: { digest: world.baseline.digest, economicMonthEndRemainder: before },
    plan: { economicMonthEndRemainder: remainder, impactOnMonthEnd: before !== null && remainder !== null ? new Big(remainder).minus(before).toFixed(2) : null },
    economic: { resources: plan?.economicResources ?? null, certainCommitments: plan?.certainOutflows.total ?? null,
      savingsReservations: plan?.savingsAllocations.total ?? null, needsAndHabits: needs, discretionaryLife: discretionary,
      explicitContexts: compiled.constraints.some(c => c.code === "CONTEXT_COMPONENT_SLOT_UNRESOLVED") ? null : sum(components.map(c => c.evaluation.economicAmount)),
      mobilityUsageEconomicCost: mobilityTotal("economicFuel"), unresolvedEconomicAmount: unresolved ? null : sum(world.baseline.unresolvedReserves.map(r => r.value.central)) },
    funding: jsonEnvelope({ status: fundingComplete ? "COMPLETE" : "PARTIAL", financialOwner: plan?.plannedFunding ?? null,
      benefitWallets: plan?.benefitWallets ?? null, bankCash: cashOwner ?? null,
      knownSyntheticCostWithUnknownFunding: sum(unfunded.filter(({ entry }) => entry.id.startsWith("planner:")).map(({ line }) => plannedLineGross(line))),
      unallocatedEconomicAmount: sum(unfunded.map(({ line }) => {
        const allocated = line.fundingAllocations?.reduce((n, a) => n.plus(a.amount), new Big(0)) ?? new Big(0);
        return new Big(plannedLineGross(line)).minus(allocated).toFixed(2);
      })), fundingToComplete,
      anonymousSlotFunding: "UNKNOWN", unresolvedReserves: world.baseline.unresolvedReserves,
      timing: items.map(({ entry, line }) => ({ ownerRef: entry.id, lineId: line.id, plannedDate: entry.plannedDate,
        certainty: entry.plannedDate ? "DECLARED" : "UNKNOWN", cashTreatment: costItemCashTreatment(line) })),
      conditionalNeeds: compiled.needs.filter(n => n.targetMonthRelation !== "CENTRAL"), structuralMobility,
      economicLenses: { explicitContexts: "GROSS_CONTEXTS_ALREADY_INCLUDED_IN_NEEDS_OR_DISCRETIONARY",
        otherExternalImpact, otherExternalClassification: "EXPLICIT_INTENT_INCREMENT", modelVersion: PLAN_PROJECTION_MODEL } }),
    cash: { knowledge: cashKnowledge, openingBalance: balance?.status === "KNOWN" ? balance.amount : null, lowPointAmount: null, lowPointDate: null },
    mobility: { usageEconomicCost: mobilityTotal("economicFuel"), cashTransportCosts: mobilityTotal("cashTransport"),
      journeyCount: compiled.journeys.length, unresolvedJourneyCount: compiled.journeys.filter(j => j.pricingState !== "RESOLVED").length },
    goal: { targetMonthEnd: world.monthInputs.decision?.goal ?? null, gapToGoal: remainder !== null && world.monthInputs.decision?.goal != null
      ? new Big(world.monthInputs.decision.goal).minus(remainder).toFixed(2) : null },
    impacts: [...compiled.contextualEffects.map(jsonEnvelope), ...state.controls.map(c => jsonEnvelope({ decisionId: c.decisionId,
      targetRef: c.decisionSlotKey, value: c.value, marginalImpactOnMonthEnd: null, rationaleCode: "MARGINAL_RECOMPILE_REQUIRED" }))],
    diagnostics, projectionCompleteness: completeness, applyReadiness: blocked ? "BLOCKED" : diagnostics.some(d => d.severity === "WARN") ? "READY_WITH_WARNINGS" : "READY" };
}
