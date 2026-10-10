import { parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";

/** Draft decisions only. The Compiler/V2 server remains the sole financial authority. */
export function stageLocalDecision(model: ComposerUiModel, raw: PlanSemanticStateV1, operation: ComposerOperation): PlanSemanticStateV1 | null {
  const state = parsePlanSemanticState(raw);
  if (operation.kind === "DROP" && operation.target.kind === "BOARD_ZONE" && operation.assetKey.startsWith("template:")) {
    const capability = model.dropCapabilities.find(c => c.sourceAssetKey === operation.assetKey && c.target.kind === "BOARD_ZONE" && c.resolution !== "BLOCKED");
    const asset = model.library.searchableAssets.find(a => a.assetKey === operation.assetKey && a.kind === "CONTEXT_ASSET");
    if (!capability || !asset?.templateKey) return null;
    const allowed = new Set(model.editors.find(e => e.assetKey === asset.assetKey)?.fields.map(f => f.key) ?? []);
    if (Object.keys(operation.values).some(key => !allowed.has(key))) return null;
    const fields = { fieldSchemaVersion: "context-fields@v2", ...Object.fromEntries(Object.entries(operation.values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) };
    return parsePlanSemanticState({ ...state, contexts: [...state.contexts, { contextOccurrenceId: operation.identity, templateKey: asset.templateKey,
      status: "ACTIVE", parentContextOccurrenceId: null, fields, slotSelections: {}, provenance: "EXPLICIT_USER_DECISION" }] });
  }
  if (operation.kind === "EDIT_CONTEXT") {
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.contextOccurrenceId);
    if (!context) return null;
    const allowed = new Set(model.editors.find(e => e.assetKey === `template:${context.templateKey}`)?.fields.map(f => f.key) ?? []);
    if (Object.keys(operation.values).some(key => !allowed.has(key))) return null;
    return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => {
      if (c.contextOccurrenceId !== operation.contextOccurrenceId) return c;
      const fields = { ...c.fields };
      for (const [key, value] of Object.entries(operation.values)) {
        if (value === "") delete fields[key]; else fields[key] = value;
      }
      return { ...c, fields };
    }) });
  }
  if (operation.kind === "EDIT_GIFT") {
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.contextOccurrenceId);
    if (context?.templateKey !== "gift" || operation.item.kind !== "COMPONENT" || operation.item.optionKey !== "gift"
      || Object.keys(operation.values).some(key => !["label", "plannedDate", "recipientRef", "occasion", "objectLabel", "objectAssetRef"].includes(key))) return null;
    const prior = context.slotSelections.item?.items;
    if (Array.isArray(prior) && prior.some(item => item && typeof item === "object" && !Array.isArray(item)
      && item.kind === "COMPONENT" && item.selectionId !== operation.item.selectionId)) return null;
    const fields: Record<string, PlannerJson> = { ...context.fields };
    for (const [key, value] of Object.entries(operation.values)) {
      if (value === "") delete fields[key]; else fields[key] = value;
    }
    fields.fieldSchemaVersion = context.fields.fieldSchemaVersion === "context-fields@v3" || Object.hasOwn(fields, "objectAssetRef")
      ? "context-fields@v3" : "context-fields@v2";
    return parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c.contextOccurrenceId === context.contextOccurrenceId
      ? { ...c, fields, slotSelections: { ...c.slotSelections, item: { items: [operation.item] } } } : c) });
  }
  if (operation.kind === "MUTATE" && operation.mutation.kind === "SET_STATE") {
    const targetRef = operation.mutation.targetRef;
    const card = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(c => c.targetRef === targetRef);
    if (!card?.capability?.actions.length || card.capability.flexibility === "LOCKED") return null;
    const prior = state.controls.find(c => c.decisionSlotKey === targetRef);
    const hash = plannerDigest({ owner: "planner-headless-control", month: state.targetMonth, slot: targetRef });
    const decisionId = prior?.decisionId ?? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    return parsePlanSemanticState({ ...state, controls: [...state.controls.filter(c => c.decisionSlotKey !== targetRef),
      { decisionId, decisionSlotKey: targetRef, kind: "SET_STATE", value: operation.mutation.value, provenance: "EXPLICIT_USER_DECISION" }] });
  }
  if (operation.kind === "DROP" && operation.target.kind === "TRASH" && operation.assetKey.startsWith("context-occurrence:")) {
    const id = operation.assetKey.slice("context-occurrence:".length);
    if (!state.contexts.some(c => c.contextOccurrenceId === id)) return null;
    const removed = new Set([id]);
    for (let changed = true; changed;) {
      changed = false;
      for (const c of state.contexts) if (c.parentContextOccurrenceId && removed.has(c.parentContextOccurrenceId) && !removed.has(c.contextOccurrenceId)) { removed.add(c.contextOccurrenceId); changed = true; }
    }
    // Existing equipped contexts use the server mutation so graph links are removed authoritatively.
    if (state.contexts.some(c => removed.has(c.contextOccurrenceId) && Object.keys(c.slotSelections).length)) return null;
    return parsePlanSemanticState({ ...state, contexts: state.contexts.filter(c => !removed.has(c.contextOccurrenceId)),
      preferences: { ...state.preferences, anchors: state.preferences.anchors.filter(a => !removed.has(a)),
        flexibility: Object.fromEntries(Object.entries(state.preferences.flexibility).filter(([ref]) => !removed.has(ref))) } });
  }
  return null;
}

/** Geometry and labels only; no calculated amount, capability, or financial projection is created. */
export function visualDraftModel(model: ComposerUiModel, draft: PlanSemanticStateV1): ComposerUiModel {
  if (semanticStateDigest(draft) === model.board.draft.semanticStateDigest) return model;
  const known = new Set(model.board.contexts.map(c => c.contextOccurrenceId));
  const visible = new Set(draft.contexts.map(c => c.contextOccurrenceId));
  const additions = draft.contexts.filter(c => !known.has(c.contextOccurrenceId));
  const contextCards = [...model.board.contexts.filter(c => visible.has(c.contextOccurrenceId)).map(c => {
    const latest = draft.contexts.find(item => item.contextOccurrenceId === c.contextOccurrenceId)!;
    return { ...c, fields: latest.fields, label: typeof latest.fields.label === "string" && latest.fields.label ? latest.fields.label : c.label };
  }), ...additions.map(c => ({ contextOccurrenceId: c.contextOccurrenceId, templateKey: c.templateKey,
    label: typeof c.fields.label === "string" && c.fields.label ? c.fields.label : model.library.searchableAssets.find(a => a.assetKey === `template:${c.templateKey}`)?.label ?? c.templateKey,
    parentContextOccurrenceId: c.parentContextOccurrenceId ?? null, childContextOccurrenceIds: [], externalIntentId: null,
    readOnly: false, fields: c.fields, components: [], knowledge: "UNKNOWN" as const, capabilityRefs: ["PATCH_CONTEXT", "REMOVE_CONTEXT"], sockets: [] }))];
  const values = new Map(draft.controls.map(c => [c.decisionSlotKey, c.value]));
  const patchControls = (cards: ComposerUiModel["board"]["baselineControls"]) => cards.map(c => values.has(c.targetRef) ? { ...c, value: { ...c.value, ...values.get(c.targetRef)! } } : c);
  const objects = { ...model.presentation.objects };
  const dragSources = { ...model.presentation.dragSources };
  const drops = [...model.dropCapabilities];
  for (const c of additions) {
    const asset = model.library.searchableAssets.find(a => a.assetKey === `template:${c.templateKey}`);
    objects[c.contextOccurrenceId] = { iconKey: asset?.iconKey ?? "activity", variant: ["night-out", "short-stay"].includes(c.templateKey) ? "COMPOSITE" : "SIMPLE",
      baselineAmount: null, baselineCount: null, protectedSavings: false, reservationGauge: null, choiceGauge: null, occurrenceStack: null };
    const key = `context-occurrence:${c.contextOccurrenceId}`;
    dragSources[key] = { sourceKey: key, assetKey: key, label: asset?.label ?? c.templateKey, iconKey: asset?.iconKey ?? "activity", economicAmount: null,
      protected: false, removeOperation: { kind: "DROP", assetKey: key, target: { kind: "TRASH" }, values: {}, identity: c.contextOccurrenceId, selectionId: c.contextOccurrenceId } };
    drops.push({ sourceAssetKey: key, target: { kind: "TRASH" }, resolution: "ACCEPTED", semanticAction: "REMOVE_CONTEXT", previewSupported: true, constraint: null, choices: [] });
  }
  const digest = semanticStateDigest(draft);
  return { ...model, semanticState: draft, board: { ...model.board, contexts: contextCards,
    baselineControls: patchControls(model.board.baselineControls), discretionaryControls: patchControls(model.board.discretionaryControls), savings: patchControls(model.board.savings),
    draft: { ...model.board.draft, dirty: digest !== model.board.draft.semanticStateDigest || model.board.draft.dirty, semanticStateDigest: digest } },
    presentation: { ...model.presentation, objects, dragSources, elementCount: model.presentation.elementCount + additions.length - model.board.contexts.filter(c => !visible.has(c.contextOccurrenceId)).length },
    dropCapabilities: drops };
}
