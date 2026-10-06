import "server-only";
import Big from "big.js";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { AdjustmentCapability, AdjustmentCandidate, AdjustmentPreset, PlanBalanceSuggestions, AcceptedAdjustment } from "@/domain/phase2/planner/adjustment-contract";
import type { PlanningWorldFacts, PlanScenarioPreview, PlannerExpectedBase } from "@/domain/phase2/planner/compiler-contract";
import type { PlannerDependencies } from "./apply";
import { publishSimpleCapabilities } from "./simple-capabilities";
import { publishContextRegistry } from "./context-registry";
import { mutatePlanSemanticState } from "./semantic-mutations";
import { evaluatePlanScenario } from "./preview";
import { readPlannerDraft } from "./draft-reader";
export const BALANCE_ASSISTANT_MODEL = "planner-balance-assistant@v1";
const protectedRef = (state: PlanSemanticStateV1, refs: readonly string[]) =>
  refs.some(r => state.preferences.anchors.includes(r) || state.preferences.flexibility[r] === "PRESERVE");
function contextProtected(state: PlanSemanticStateV1, id: string, preview: PlanScenarioPreview): boolean {
  const related = new Set([id]);
  // Removing an ancestor also removes an anchored descendant. An anchored ancestor
  // protects its composition; removing a child is therefore excluded too.
  for (let size = -1; size !== related.size;) {
    size = related.size;
    for (const c of state.contexts) {
      if (related.has(c.contextOccurrenceId) && c.parentContextOccurrenceId) related.add(c.parentContextOccurrenceId);
      if (c.parentContextOccurrenceId && related.has(c.parentContextOccurrenceId)) related.add(c.contextOccurrenceId);
    }
  }
  const componentRefs = preview.compiled.components.filter(c => c.contextOccurrenceId && related.has(c.contextOccurrenceId))
    .flatMap(c => [c.componentId, c.needOccurrenceId ?? "", c.physicalJourneyRequirementId ?? ""]);
  const intentRefs = preview.compiled.mobilityIntents.filter(i => related.has(i.contextOccurrenceId)).map(i => i.mobilityIntentId);
  return protectedRef(state, [...related, ...componentRefs, ...intentRefs]);
}
export function publishAdjustmentCapabilities(world: PlanningWorldFacts, state: PlanSemanticStateV1, preview: PlanScenarioPreview): readonly AdjustmentCapability[] {
  const result: AdjustmentCapability[] = publishSimpleCapabilities(world.baseline).map(simple => {
    const slot = preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === simple.slotIdentityKey)!;
    const refs = [simple.slotIdentityKey, slot.baseline.planSlotId, slot.baseline.controlKey ?? "", slot.baseline.semanticKey,
      slot.financeKey ?? "", slot.role === "SAVINGS" ? simple.slotIdentityKey.slice("savings:".length) : "", slot.decisionId ?? ""];
    const locked = simple.flexibility === "LOCKED" || protectedRef(state, refs);
    const current = slot.baseline.kind === "AMOUNT" ? slot.effectiveAmount : slot.effectiveCount;
    const floor = simple.hardConstraints.find(c => c.amount !== null)?.amount ?? null;
    const controlTarget = state.controls.find(c => refs.includes(c.decisionSlotKey))?.decisionSlotKey ?? simple.slotIdentityKey;
    const choices = [...simple.naturalPresets];
    if (current !== null && simple.domain === "savings" && !locked) {
      for (const fraction of ["0.75", "0.5", "0"]) choices.push({ label: `allocation × ${fraction}`, value: { amount: new Big(current).times(fraction).toFixed(2) } });
    } else if (current !== null && slot.baseline.kind !== "AMOUNT" && new Big(current).gte(1)) {
      choices.push({ label: "une occurrence de moins", value: { count: new Big(current).minus(1).toFixed(0) } });
    } else if (simple.flexibility === "FREE") choices.push({ label: "sans enveloppe", value: { amount: "0.00" } });
    const seen = new Set<string>();
    const presets: AdjustmentPreset[] = locked || current === null || simple.gate !== "AVAILABLE" ? [] : choices.flatMap(choice => {
      const n = choice.value.amount ?? choice.value.count;
      if (n === undefined || new Big(n).gte(current) || new Big(n).lt(0) || choice.value.amount !== undefined && floor !== null && new Big(n).lt(floor)) return [];
      const key = plannerDigest(choice.value); if (seen.has(key)) return []; seen.add(key);
      return [{ label: choice.label, semanticMutation: { kind: "SET_STATE" as const, targetRef: controlTarget, value: choice.value } }];
    });
    const minimum = presets.map(p => p.semanticMutation.kind === "SET_STATE" ? p.semanticMutation.value.amount ?? p.semanticMutation.value.count : null)
      .filter((v): v is string => typeof v === "string").sort((a, b) => new Big(a).cmp(b))[0];
    return { targetRef: simple.slotIdentityKey, label: simple.label, actions: locked ? [] : simple.actions,
      flexibility: locked ? "LOCKED" : simple.flexibility, knowledge: simple.knowledge,
      hardReducibleRoom: locked ? "0.00" : null,
      softReducibleRoom: locked ? "0.00" : current !== null && minimum !== undefined ? new Big(current).minus(minimum).toFixed(2) : null,
      naturalPresets: presets, rationaleCodes: locked ? ["PRESERVE_OR_STRUCTURAL_LOCK"] : simple.gate !== "AVAILABLE" ? ["NEEDS_NEW_INPUT"] : ["EXISTING_OWNER_CAPABILITY"] };
  });
  // Room is a quantity for occurrences, money for amounts.
  for (let i = 0; i < result.length; i++) {
    const cap = result[i], slot = preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === cap.targetRef)!;
    const current = slot.baseline.kind === "AMOUNT" ? slot.effectiveAmount : slot.effectiveCount;
    const simple = publishSimpleCapabilities(world.baseline).find(s => s.slotIdentityKey === cap.targetRef)!;
    const floor = simple.domain === "savings" ? "0" : simple.hardConstraints.find(c => c.amount !== null)?.amount;
    if (cap.flexibility !== "LOCKED" && current !== null && floor != null) {
      const room = new Big(current).minus(floor); result[i] = { ...cap, hardReducibleRoom: room.gt(0) ? room.toFixed(2) : "0.00" };
    }
  }
  for (const slot of preview.compiled.planSlots.filter(s => s.baseline.renewalAuthority)) {
    const locked = !slot.baseline.renewalAuthority!.conditional || protectedRef(state,
      [slot.baseline.slotIdentityKey, slot.baseline.planSlotId, slot.baseline.semanticKey,
        slot.baseline.renewalAuthority!.needOccurrenceId, slot.decisionId ?? ""]);
    result.push({ targetRef: slot.baseline.slotIdentityKey, label: slot.baseline.semanticKey,
      actions: locked ? [] : slot.baseline.capabilities.some(c => c.action === "SET_COUNT" && c.availability === "AVAILABLE") ? ["SET_SLOT_OCCURRENCES"] : [],
      flexibility: locked ? "LOCKED" : "STRETCH_FLEX", knowledge: slot.baseline.knowledge,
      hardReducibleRoom: locked ? "0.00" : null, softReducibleRoom: null, naturalPresets: [],
      rationaleCodes: locked ? ["STRUCTURAL_NEED_OR_PRESERVE"] : ["NEED_CONFIRMATION_REQUIRES_EXPLICIT_DECISION"] });
  }
  for (const context of state.contexts) {
    const locked = contextProtected(state, context.contextOccurrenceId, preview);
    const registry = publishContextRegistry().templates.find(t => t.templateKey === context.templateKey);
    if (!registry) continue;
    result.push({ targetRef: context.contextOccurrenceId, label: typeof context.fields.label === "string" ? context.fields.label : registry.label,
      actions: locked ? [] : ["REMOVE_CONTEXT", "PATCH_CONTEXT"], flexibility: locked ? "LOCKED" : "FREE", knowledge: "KNOWN",
      hardReducibleRoom: null, softReducibleRoom: null, naturalPresets: locked ? [] : [{ label: "retirer cette intention",
        semanticMutation: { kind: "REMOVE_CONTEXT", contextOccurrenceId: context.contextOccurrenceId } }],
      rationaleCodes: locked ? ["ANCHOR_OR_PRESERVE"] : ["EXPLICIT_CONTEXT_OPTIONAL"] });
  }
  return result;
}
async function simulateSuggestions(deps: PlannerDependencies, world: PlanningWorldFacts, state: PlanSemanticStateV1, base: PlannerExpectedBase,
  current: PlanScenarioPreview): Promise<PlanBalanceSuggestions> {
  const capabilities = publishAdjustmentCapabilities(world, state, current);
  const simulated: Omit<AdjustmentCandidate, "candidateId">[] = [];
  const resolutionSuggestions: { targetRef: string; rationaleCodes: string[] }[] = [];
  for (const cap of capabilities) {
    if (cap.knowledge === "UNKNOWN" || cap.rationaleCodes.includes("NEEDS_NEW_INPUT")) resolutionSuggestions.push({ targetRef: cap.targetRef, rationaleCodes: ["NEEDS_NEW_INPUT"] });
    for (const preset of cap.naturalPresets) {
      try {
        const next = mutatePlanSemanticState(state, preset.semanticMutation);
        const prepared = deps.prepareWorld ? await deps.prepareWorld(world, next) : world;
        const preview = evaluatePlanScenario(prepared, next, base);
        if (preview.projection.applyReadiness === "BLOCKED") { resolutionSuggestions.push({ targetRef: cap.targetRef, rationaleCodes: ["CANDIDATE_BLOCKED"] }); continue; }
        const after = preview.projection.plan.economicMonthEndRemainder, before = current.projection.plan.economicMonthEndRemainder;
        const impact = after === null || before === null ? null : new Big(after).minus(before).toFixed(2);
        if (impact !== null && new Big(impact).lte(0)) continue;
        simulated.push({ targetRef: cap.targetRef, label: `${cap.label} : ${preset.label}`, semanticMutation: preset.semanticMutation,
          projection: preview.projection, projectionDigest: preview.projectionDigest, compiledManifestDigest: preview.compiledManifestDigest,
          impactOnMonthEnd: impact, knowledge: impact === null ? "UNKNOWN" : "KNOWN",
          rationaleCodes: [...cap.rationaleCodes, impact === null ? "IMPACT_UNRESOLVED" : "REAL_COMPILER_RESIMULATION"] });
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        resolutionSuggestions.push({ targetRef: cap.targetRef, rationaleCodes: ["CANDIDATE_REQUIRES_RESOLUTION", error.message] });
      }
    }
  }
  const candidateSetDigest = plannerDigest({ model: BALANCE_ASSISTANT_MODEL, basePreviewDigest: current.previewDigest, capabilities, simulated, resolutionSuggestions });
  return { version: BALANCE_ASSISTANT_MODEL, semanticStateDigest: current.semanticStateDigest, basePreviewDigest: current.previewDigest,
    candidateSetDigest, capabilities, candidates: simulated.map(c => ({ ...c, candidateId: plannerDigest({ candidateSetDigest, mutation: c.semanticMutation }) })),
    resolutionSuggestions };
}
export async function readPlanBalanceSuggestions(deps: PlannerDependencies, householdId: string, targetMonth: string,
  draft?: PlanSemanticStateV1): Promise<PlanBalanceSuggestions> {
  const read = await readPlannerDraft(deps, householdId, targetMonth, draft);
  return simulateSuggestions(deps, read.world, read.state, read.base, read.preview);
}
/** Accept into a new in-memory draft, never apply implicitly. Re-read, reject stale
 * suggestion evidence, then regenerate every impact through the compiler. */
export async function acceptPlanBalanceSuggestion(deps: PlannerDependencies, householdId: string, targetMonth: string,
  draft: PlanSemanticStateV1, candidateSetDigest: string, candidateId: string): Promise<AcceptedAdjustment> {
  const read = await readPlannerDraft(deps, householdId, targetMonth, draft);
  const before = await simulateSuggestions(deps, read.world, read.state, read.base, read.preview);
  if (before.candidateSetDigest !== candidateSetDigest) throw new TypeError("PLANNER_CANDIDATES_STALE");
  const candidate = before.candidates.find(c => c.candidateId === candidateId);
  if (!candidate) throw new TypeError("PLANNER_CANDIDATE_UNKNOWN");
  const semanticState = mutatePlanSemanticState(read.state, candidate.semanticMutation);
  const world = deps.prepareWorld ? await deps.prepareWorld(read.world, semanticState) : read.world;
  const preview = evaluatePlanScenario(world, semanticState, read.base);
  const suggestions = await simulateSuggestions(deps, read.world, semanticState, read.base, preview);
  return { semanticState, projection: preview.projection, invalidatedCandidateSetDigest: candidateSetDigest, suggestions };
}
