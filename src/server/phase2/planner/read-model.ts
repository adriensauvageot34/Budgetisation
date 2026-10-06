import "server-only";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { emptyPlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerAssetView, ComposerCardView, ComposerContextCardView, DropCapability, DropResolution, DropTarget, MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import type { PlannerDependencies } from "./apply";
import { readPlannerDraft } from "./draft-reader";
import { publishAdjustmentCapabilities } from "./balance-assistant";
import { publishContextRegistry, resolveContextTemplate } from "./context-registry";
import { jsonEnvelope } from "./compiler";
import { mutatePlanSemanticState } from "./semantic-mutations";
export const COMPOSER_READ_MODEL = "planner-composer@v1-headless";
const contextAssetKey = (key: string) => `template:${key}`;
const optionAssetKey = (template: string, slot: string, option: string) => `option:${template}:${slot}:${option}`;
const instanceAssetKey = (id: string) => `context-occurrence:${id}`;

/** All Board totals are the exact projection. Cards publish semantic controls and
 * evidence, never independently calculated money or client deltas. */
export async function readMonthComposer(deps: PlannerDependencies, householdId: string, targetMonth: string,
  draft?: PlanSemanticStateV1): Promise<MonthComposerReadModel> {
  const read = await readPlannerDraft(deps, householdId, targetMonth, draft);
  const { preview, state, prepared } = read;
  const capabilities = publishAdjustmentCapabilities(prepared, state, preview);
  const registry = publishContextRegistry();
  const assets: ComposerAssetView[] = registry.templates.flatMap(t => [
    { assetKey: contextAssetKey(t.templateKey), kind: "CONTEXT_ASSET" as const, label: t.label, iconKey: t.family.toLowerCase(),
      capabilityRef: `context:${t.templateKey}`, templateKey: t.templateKey, provenance: "EXPLICIT_USER_DECISION" as const },
    ...t.componentSlots.flatMap(s => s.options.map(o => ({ assetKey: optionAssetKey(t.templateKey, s.slotKey, o.optionKey),
      kind: "SLOT_OPTION_ASSET" as const, label: o.label, iconKey: o.kind.toLowerCase(), capabilityRef: `${t.templateKey}:${s.slotKey}`,
      templateKey: t.templateKey, optionKey: o.optionKey, optionKind: o.kind, provenance: "EXPLICIT_USER_DECISION" as const })))
  ]);
  const baselineControls: ComposerCardView[] = [], discretionaryControls: ComposerCardView[] = [], savings: ComposerCardView[] = [];
  for (const slot of preview.compiled.planSlots) {
    const capability = capabilities.find(c => c.targetRef === slot.baseline.slotIdentityKey) ?? null;
    const discretionary = !!slot.baseline.simpleAuthority && ["restaurants", "fast-food", "delivery", "clothing", "home-small", "games-digital"].includes(slot.baseline.simpleAuthority.domain);
    const kind = slot.role === "SAVINGS" ? "SAVINGS" as const : discretionary ? "DISCRETIONARY_CONTROL" as const : "BASELINE_CONTROL" as const;
    const card: ComposerCardView = { cardId: slot.baseline.planSlotId, targetRef: slot.baseline.slotIdentityKey,
      label: capability?.label ?? slot.baseline.semanticKey, kind, knowledge: slot.baseline.knowledge, capability,
      historicalReferences: slot.baseline.historicalReferences ? jsonEnvelope(slot.baseline.historicalReferences) : null,
      value: jsonEnvelope({ amount: slot.effectiveAmount, count: slot.effectiveCount, unitAmount: slot.effectiveUnitAmount,
        remainingAmount: slot.remainingAmount, remainingCount: slot.remainingCount, conditionalAccepted: slot.conditionalAccepted ?? null,
        owned: slot.owned, inclusion: slot.baseline.inclusion, dueState: slot.baseline.baselineValue.dueState,
        needOccurrence: preview.compiled.needs.find(n => n.needOccurrenceId === slot.baseline.renewalAuthority?.needOccurrenceId) ?? null,
        sourceRefs: slot.baseline.sourceRefs }) };
    (kind === "SAVINGS" ? savings : discretionary ? discretionaryControls : baselineControls).push(card);
    assets.push({ assetKey: `control:${card.targetRef}`, kind: kind === "SAVINGS" ? "RESERVATION_CONTROL" : "PLAN_CONTROL",
      label: card.label, iconKey: kind.toLowerCase(), capabilityRef: card.targetRef, provenance: slot.decisionId ? "EXPLICIT_USER_DECISION" : "STRUCTURAL_DEFAULT" });
  }
  const contexts: ComposerContextCardView[] = preview.compiled.contexts.map(compiled => {
    const raw = state.contexts.find(c => c.contextOccurrenceId === compiled.contextOccurrenceId);
    return { contextOccurrenceId: compiled.contextOccurrenceId, templateKey: compiled.templateKey,
      label: typeof raw?.fields.label === "string" ? raw.fields.label : compiled.templateKey,
      parentContextOccurrenceId: compiled.parentContextOccurrenceId ?? null, childContextOccurrenceIds: compiled.childContextIds ?? [],
      externalIntentId: compiled.externalIntentId, readOnly: compiled.externalIntentId !== null,
      fields: raw?.fields ?? {}, components: preview.compiled.components.filter(c => c.contextOccurrenceId === compiled.contextOccurrenceId).map(jsonEnvelope),
      knowledge: preview.compiled.components.some(c => c.contextOccurrenceId === compiled.contextOccurrenceId && c.evaluation.economicAmount === null)
        || compiled.componentSlots?.some(s => s.state === "UNRESOLVED" || s.cardinality === "REQUIRED_ONE" && s.state !== "RESOLVED") ? "UNKNOWN" : "KNOWN",
      capabilityRefs: capabilities.find(c => c.targetRef === compiled.contextOccurrenceId)?.actions ?? [],
      sockets: (compiled.componentSlots ?? []).map(s => ({ contextOccurrenceId: compiled.contextOccurrenceId, slotKey: s.slotKey, cardinality: s.cardinality,
        visualState: s.state === "SUGGESTED" ? "SUGGESTED" : s.state === "UNRESOLVED" || s.state === "EMPTY" ? "UNRESOLVED"
          : s.selections.every(i => i.provenance === "STRUCTURAL_DEFAULT") ? "HABITUAL" : "CHOSEN",
        currentItems: s.selections, capabilityRefs: resolveContextTemplate(compiled.templateKey).capabilities
          .filter(c => c.slotKey === s.slotKey).map(c => `${compiled.templateKey}:${c.slotKey}:${c.action}`) })) };
  });
  for (const external of prepared.baseline.structuralFacts.externalKnownContexts) {
    if (contexts.some(c => c.externalIntentId === external.externalContextId)) continue;
    const expense = prepared.externalIntents.find(e => e.id === external.externalContextId);
    contexts.push({ contextOccurrenceId: `external:${external.externalContextId}`, templateKey: "external-intent",
      label: expense?.title ?? external.externalContextId, parentContextOccurrenceId: null, childContextOccurrenceIds: [],
      externalIntentId: external.externalContextId, readOnly: true, fields: external.intent,
      components: expense?.costItems.map(jsonEnvelope) ?? [], knowledge: expense ? "KNOWN" : "PARTIAL", capabilityRefs: [], sockets: [] });
  }
  const drops: DropCapability[] = registry.templates.map(t => ({ sourceAssetKey: contextAssetKey(t.templateKey), target: { kind: "BOARD_ZONE" },
    resolution: "NEEDS_CHOICE", semanticAction: "ADD_CONTEXT", previewSupported: true, constraint: "EXPLICIT_CONTEXT_ID_AND_FIELDS_REQUIRED", choices: [t.templateKey] }));
  for (const card of contexts.filter(c => !c.readOnly)) {
    const locked = capabilities.find(c => c.targetRef === card.contextOccurrenceId)?.flexibility === "LOCKED";
    drops.push({ sourceAssetKey: instanceAssetKey(card.contextOccurrenceId), target: { kind: "TRASH" }, resolution: locked ? "BLOCKED" : "ACCEPTED",
      semanticAction: locked ? null : "REMOVE_CONTEXT", previewSupported: !locked, constraint: locked ? "ANCHOR_OR_PRESERVE" : null, choices: [] });
    for (const socket of card.sockets) {
      const slot = resolveContextTemplate(card.templateKey).componentSlots.find(s => s.slotKey === socket.slotKey)!;
      const target: DropTarget = { kind: "CONTEXT_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey };
      for (const asset of assets.filter(a => a.kind === "CONTEXT_ASSET" || a.kind === "SLOT_OPTION_ASSET")) {
        const allowed = asset.kind === "CONTEXT_ASSET" ? slot.allowedChildTemplates.includes(asset.templateKey!)
          : slot.options.some(o => o.optionKey === asset.optionKey && o.kind === asset.optionKind);
        drops.push({ sourceAssetKey: asset.assetKey, target, resolution: allowed && !locked ? "NEEDS_CHOICE" : "BLOCKED",
          semanticAction: allowed && !locked ? "PATCH_CONTEXT" : null, previewSupported: allowed && !locked,
          constraint: locked ? "ANCHOR_OR_PRESERVE" : !allowed ? "CONTEXT_SOCKET_INCOMPATIBLE" : "EXPLICIT_SELECTION_REQUIRED",
          choices: allowed ? slot.cardinality === "REPEATING" ? ["APPEND"] : ["REPLACE_ONE_OF"] : [] });
      }
      for (const child of contexts.filter(c => !c.readOnly && c.contextOccurrenceId !== card.contextOccurrenceId)) {
        const allowed = slot.allowedChildTemplates.includes(child.templateKey) && !locked
          && capabilities.find(c => c.targetRef === child.contextOccurrenceId)?.flexibility !== "LOCKED";
        drops.push({ sourceAssetKey: instanceAssetKey(child.contextOccurrenceId), target, resolution: allowed ? "NEEDS_CHOICE" : "BLOCKED",
          semanticAction: allowed ? "PATCH_CONTEXT" : null, previewSupported: allowed, constraint: allowed ? "EXPLICIT_REPARENT_REQUIRED" : "CONTEXT_SOCKET_INCOMPATIBLE",
          choices: allowed ? ["REPARENT_PRESERVE_ID"] : [] });
      }
    }
  }
  const original = read.active?.activeRevision?.semanticState ?? emptyPlanSemanticState(targetMonth);
  return { version: COMPOSER_READ_MODEL, semanticState: state,
    library: { sections: [{ sectionKey: "contexts", assetKeys: assets.filter(a => a.kind === "CONTEXT_ASSET").map(a => a.assetKey) },
      { sectionKey: "options", assetKeys: assets.filter(a => a.kind === "SLOT_OPTION_ASSET").map(a => a.assetKey) },
      { sectionKey: "controls", assetKeys: assets.filter(a => a.kind === "PLAN_CONTROL" || a.kind === "RESERVATION_CONTROL").map(a => a.assetKey) }],
      searchableAssets: assets },
    board: { targetMonth, baselineControls, discretionaryControls, contexts, savings, cockpit: preview.projection, diagnostics: preview.projection.diagnostics,
      draft: { dirty: semanticStateDigest(original) !== preview.semanticStateDigest, semanticStateDigest: preview.semanticStateDigest, undoCount: 0, redoCount: 0 } },
    dropCapabilities: drops, preview, activeRevisionId: read.base.expectedActiveRevisionId, activeRevisionNumber: read.base.expectedActiveRevisionNumber };
}
/** Resolves a declared gesture into a semantic mutation. The caller previews that
 * state using the existing API. No local financial delta or extra interaction API. */
export function resolveComposerDrop(model: MonthComposerReadModel, sourceAssetKey: string, target: DropTarget, proposal?: SemanticMutation): DropResolution {
  const capability = model.dropCapabilities.find(d => d.sourceAssetKey === sourceAssetKey && plannerDigest(d.target) === plannerDigest(target));
  if (!capability) return { capability: { sourceAssetKey, target, resolution: "BLOCKED", semanticAction: null,
    previewSupported: false, constraint: "DROP_CAPABILITY_MISSING", choices: [] }, semanticMutation: null };
  if (capability.resolution === "BLOCKED") return { capability, semanticMutation: null };
  const asset = model.library.searchableAssets.find(a => a.assetKey === sourceAssetKey);
  const instanceId = sourceAssetKey.startsWith("context-occurrence:") ? sourceAssetKey.slice("context-occurrence:".length) : null;
  const mutation = proposal ?? (target.kind === "TRASH" && instanceId ? { kind: "REMOVE_CONTEXT" as const, contextOccurrenceId: instanceId } : null);
  if (!mutation) return { capability, semanticMutation: null };
  const matches = target.kind === "TRASH" ? mutation.kind === "REMOVE_CONTEXT" && mutation.contextOccurrenceId === instanceId
    : target.kind === "BOARD_ZONE" ? mutation.kind === "ADD_CONTEXT" && mutation.context.templateKey === asset?.templateKey
    : mutation.kind === "PATCH_CONTEXT" ? mutation.contextOccurrenceId === target.contextOccurrenceId && mutation.slotKey === target.slotKey
      && asset?.kind === "SLOT_OPTION_ASSET" && mutation.items.some(i => i.optionKey === asset.optionKey && i.kind === asset.optionKind)
    : mutation.kind === "ATTACH_CONTEXT" ? mutation.parentContextOccurrenceId === target.contextOccurrenceId && mutation.slotKey === target.slotKey
      && mutation.context.templateKey === asset?.templateKey
    : mutation.kind === "REPARENT_CONTEXT" && mutation.contextOccurrenceId === instanceId
      && mutation.parentContextOccurrenceId === target.contextOccurrenceId && mutation.slotKey === target.slotKey;
  if (!matches) throw new TypeError("PLANNER_DROP_MUTATION_MISMATCH");
  mutatePlanSemanticState(model.semanticState, mutation); // complete graph/capability validation
  return { capability: { ...capability, resolution: "ACCEPTED", constraint: null }, semanticMutation: mutation };
}
