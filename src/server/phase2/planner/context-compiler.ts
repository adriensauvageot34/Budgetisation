import "server-only";
import { componentId, mobilityIntentId } from "@/domain/phase2/planner/identity";
import type { ComponentSelectionV1, CompiledComponentSlot, ComponentOptionDefinition } from "@/domain/phase2/planner/component-contract";
import type { ComponentRequest, CompiledContext, CompiledPlanSlot, PlanningWorldFacts, SlotBinding } from "@/domain/phase2/planner/compiler-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ConstraintResult } from "@/domain/phase2/planner/diagnostics";
import type { MobilityIntent } from "@/domain/phase2/planner/mobility-contract";
import { resolveContextTemplate, CONTEXT_REGISTRY_VERSION } from "./context-registry";
import { contextDate, validateContextGraph } from "./context-selections";
import { resolveComponentCost } from "./cost-resolver";

export const CONTEXT_COMPILER_VERSION = "planner-context-compiler@v2-mobility";
function resolveBinding(option: ComponentOptionDefinition, domain: string | null, item: Extract<ComponentSelectionV1, { kind: "COMPONENT" }>,
  request: ComponentRequest, slots: readonly CompiledPlanSlot[], world: PlanningWorldFacts): SlotBinding {
  const mode = item.binding?.mode ?? "AUTO";
  const none: SlotBinding = { slotIdentityKey: null, relation: "NO_RELATED_SLOT", displacement: "KNOWN", amount: null, count: null };
  if (mode === "NO_RELATED_SLOT") return none;
  if (!domain) {
    if (mode !== "AUTO") throw new TypeError("CONTEXT_BINDING_DOMAIN_REQUIRED");
    return none;
  }
  const candidates = slots.filter(s => s.role === "BEHAVIOR" && (s.baseline.simpleAuthority?.domain ?? s.baseline.semanticKey) === domain);
  const slot = candidates.length === 1 ? candidates[0] : null;
  const unresolved: SlotBinding = { slotIdentityKey: slot?.baseline.slotIdentityKey ?? null, relation: "UNRESOLVED", displacement: "UNKNOWN", amount: null, count: null };
  if (!slot) return unresolved;
  if (mode === "EXTRA_TO_SLOT") return { ...unresolved, relation: "EXTRA_TO_SLOT", displacement: "KNOWN" };
  if (option.bindingPolicy === "REQUIRES_CONFIRMATION" && mode !== "CONFIRMED_CONSUMPTION") return unresolved;
  const identified = slot.baseline.inclusion === "CENTRAL" || slot.baseline.simpleAuthority?.optionalBudget || slot.decisionId;
  const capacityKnown = slot.baseline.kind === "AMOUNT" ? slot.effectiveAmount !== null : slot.effectiveCount !== null && slot.effectiveUnitAmount !== null;
  if (!identified || !capacityKnown) return unresolved;
  const gross = resolveComponentCost(request, world).economicAmount;
  if (slot.baseline.kind === "AMOUNT" && gross === null) return unresolved;
  return { slotIdentityKey: slot.baseline.slotIdentityKey, relation: "CONSUMES_SLOT", displacement: "KNOWN",
    amount: slot.baseline.kind === "AMOUNT" ? gross : null, count: slot.baseline.kind === "AMOUNT" ? null : "1.00" };
}
export function expandComposableContexts(state: PlanSemanticStateV1, world: PlanningWorldFacts, planSlots: readonly CompiledPlanSlot[]) {
  const graph = validateContextGraph(state), requests: ComponentRequest[] = [], contexts: CompiledContext[] = [], mobilityIntents: MobilityIntent[] = [];
  const constraints: ConstraintResult[] = [];
  const add = (code: string, targetRef: string, severity: "WARN" | "INFO" = "WARN") => constraints.push({ code, targetRef, severity,
    scope: "CONTEXT", candidate: null, reference: null, evidenceRefs: [], confidence: "HIGH", remediation: null, policyVersion: CONTEXT_COMPILER_VERSION });
  const active = (id: string): boolean => {
    const link = graph.links.get(id);
    return !link || link.selection.provenance !== "PERSONAL_SUGGESTION" && active(link.parentId);
  };
  for (const context of state.contexts.filter(c => c.templateKey !== "kernel.generic")) {
    const template = resolveContextTemplate(context.templateKey), contributes = active(context.contextOccurrenceId);
    const plannedDate = contextDate(context.fields.plannedDate, state.targetMonth), compiledSlots: CompiledComponentSlot[] = [];
    for (const slot of template.componentSlots) {
      const items = graph.selections.get(context.contextOccurrenceId)!.get(slot.slotKey)!;
      const componentIds: string[] = [], childContextIds: string[] = [], mobilityIntentIds: string[] = [];
      const accepted = contributes ? items.filter(item => item.provenance !== "PERSONAL_SUGGESTION") : [];
      const unresolved = contributes && (slot.cardinality === "REQUIRED_ONE" && !accepted.length || accepted.some(item => item.kind === "UNRESOLVED"));
      if (unresolved) add("CONTEXT_COMPONENT_SLOT_UNRESOLVED", `${context.contextOccurrenceId}:${slot.slotKey}`);
      if (items.some(item => item.provenance === "PERSONAL_SUGGESTION")) add("CONTEXT_SUGGESTION_EXCLUDED", `${context.contextOccurrenceId}:${slot.slotKey}`, "INFO");
      for (const item of accepted) {
        if (item.kind === "UNRESOLVED") continue;
        if (item.kind === "CHILD_CONTEXT") { childContextIds.push(item.childContextOccurrenceId); continue; }
        const option = slot.options.find(o => o.optionKey === item.optionKey)!;
        if (item.kind === "MOBILITY_INTENT") {
          const id = mobilityIntentId(context.contextOccurrenceId, slot.slotKey); mobilityIntentIds.push(id);
          const date = slot.mobilityRole === "RETURN" ? contextDate(context.fields.endDate, state.targetMonth) ?? plannedDate : plannedDate;
          mobilityIntents.push({ mobilityIntentId: id, contextOccurrenceId: context.contextOccurrenceId, role: slot.mobilityRole!,
            origin: item.origin ?? null, destination: item.destination ?? null, returnRequired: item.returnRequired === true,
            slotKey: slot.slotKey, journey: item.journey, pricing: item.pricing,
            returnTiming: item.returnRequired ? date ? { kind: "DATED", date: contextDate(context.fields.endDate, state.targetMonth) ?? date, time: item.returnTime ?? null }
              : { kind: "MONTH_UNSCHEDULED", targetMonth: state.targetMonth } : null,
            mode: option.mobilityMode!, timing: date ? { kind: "DATED", date, time: item.plannedTime ?? null } : { kind: "MONTH_UNSCHEDULED", targetMonth: state.targetMonth },
            knowledge: option.mobilityMode === "FREE" ? "DECLARED" : option.mobilityMode === "UNKNOWN" ? "UNKNOWN" : "PARTIAL" });
          continue;
        }
        const id = componentId(context.contextOccurrenceId, slot.slotKey, item.selectionId); componentIds.push(id);
        const request: ComponentRequest = { componentId: id, ownerRef: context.contextOccurrenceId, contextOccurrenceId: context.contextOccurrenceId,
          externalEntryId: null, externalLineId: null, role: slot.role, label: item.label, quantity: item.quantity, cost: item.cost,
          binding: { slotIdentityKey: null, relation: "NO_RELATED_SLOT", displacement: "KNOWN", amount: null, count: null },
          fundingAllocations: item.fundingAllocations ?? [], plannedDate, selectionProvenance: item.provenance,
          bindingEvidenceRefs: [`capability:${CONTEXT_REGISTRY_VERSION}:${template.templateKey}:${slot.slotKey}:${item.optionKey}`,
            `decision:${context.contextOccurrenceId}:${slot.slotKey}:${item.selectionId}`] };
        const purchaseDomain = template.templateKey === "purchase" && slot.slotKey === "item" && context.fields.budgetDomain !== "other"
          ? context.fields.budgetDomain as string | undefined : undefined;
        const binding = resolveBinding(purchaseDomain ? { ...option, bindingPolicy: "CERTAIN_DOMAIN" } : option,
          option.baselineDomain ?? purchaseDomain ?? null, item, request, planSlots, world);
        if (binding.relation === "UNRESOLVED") add("CONTEXT_SLOT_BINDING_UNRESOLVED", id);
        requests.push({ ...request, binding });
      }
      compiledSlots.push({ contextOccurrenceId: context.contextOccurrenceId, slotKey: slot.slotKey, role: slot.role, cardinality: slot.cardinality,
        state: unresolved ? "UNRESOLVED" : accepted.some(item => item.kind !== "UNRESOLVED") ? "RESOLVED" : items.length ? "SUGGESTED" : "EMPTY",
        selections: items, componentIds, childContextIds, mobilityIntentIds, contributes });
    }
    const economicSelections = compiledSlots.flatMap(s => s.selections).filter(item => item.provenance !== "PERSONAL_SUGGESTION"
      && (item.kind === "COMPONENT" || item.kind === "CHILD_CONTEXT")).length;
    if (contributes && economicSelections < template.minimumEconomicSelections) add("CONTEXT_COMPONENT_SLOT_UNRESOLVED", context.contextOccurrenceId);
    contexts.push({ contextOccurrenceId: context.contextOccurrenceId, templateKey: context.templateKey, componentIds: compiledSlots.flatMap(s => s.componentIds),
      externalIntentId: null, parentContextOccurrenceId: context.parentContextOccurrenceId ?? null, childContextIds: compiledSlots.flatMap(s => s.childContextIds),
      status: contributes ? "ACTIVE" : "SUGGESTED", componentSlots: compiledSlots });
  }
  if (requests.length > 5000) throw new TypeError("CONTEXT_COMPONENT_LIMIT_EXCEEDED");
  return { contexts, requests, mobilityIntents, constraints };
}
