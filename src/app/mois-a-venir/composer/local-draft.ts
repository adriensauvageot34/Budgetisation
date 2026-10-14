import { parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { editNightOut } from "@/domain/phase2/planner/night-out-edit";
import { editShortStay } from "@/domain/phase2/planner/short-stay-edit";
import { editFamilyVisit } from "@/domain/phase2/planner/family-visit-edit";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";

function patchLocalSocket(model: ComposerUiModel, state: PlanSemanticStateV1, contextId: string, slotKey: string,
  items: readonly ComponentSelectionV1[]): PlanSemanticStateV1 | null {
  const card = model.board.contexts.find(c => c.contextOccurrenceId === contextId);
  const context = state.contexts.find(c => c.contextOccurrenceId === contextId);
  const socket = card?.sockets.find(s => s.slotKey === slotKey);
  if (!context || !socket || !card?.capabilityRefs.includes("PATCH_CONTEXT") || card.readOnly
    || state.preferences.anchors.includes(contextId) || state.preferences.flexibility[contextId] === "PRESERVE"
    || socket.cardinality !== "REPEATING" && items.length > 1) return null;
  const prior = context.slotSelections[slotKey]?.items;
  const keep = new Set(items.flatMap(item => item.kind === "CHILD_CONTEXT" ? [item.childContextOccurrenceId] : []));
  const removed = new Set(Array.isArray(prior) ? prior.flatMap(item => item && typeof item === "object" && !Array.isArray(item)
    && item.kind === "CHILD_CONTEXT" && typeof item.childContextOccurrenceId === "string" && !keep.has(item.childContextOccurrenceId)
    ? [item.childContextOccurrenceId] : []) : []);
  for (let size = -1; size !== removed.size;) {
    size = removed.size;
    for (const child of state.contexts) if (child.parentContextOccurrenceId && removed.has(child.parentContextOccurrenceId)) removed.add(child.contextOccurrenceId);
  }
  if ([...removed].some(id => state.preferences.anchors.includes(id) || state.preferences.flexibility[id] === "PRESERVE")) return null;
  return parsePlanSemanticState({ ...state, contexts: state.contexts.filter(c => !removed.has(c.contextOccurrenceId)).map(c =>
    c.contextOccurrenceId === contextId ? { ...c, slotSelections: { ...c.slotSelections, [slotKey]: { items } } } : c) });
}

/** Draft decisions only. The Compiler/V2 server remains the sole financial authority. */
export function stageLocalDecision(model: ComposerUiModel, raw: PlanSemanticStateV1, operation: ComposerOperation): PlanSemanticStateV1 | null {
  const state = parsePlanSemanticState(raw);
  if (operation.kind === "DROP" && operation.target.kind === "BOARD_ZONE" && operation.assetKey.startsWith("template:")) {
    const capability = model.dropCapabilities.find(c => c.sourceAssetKey === operation.assetKey && c.target.kind === "BOARD_ZONE" && c.resolution !== "BLOCKED");
    const asset = model.library.searchableAssets.find(a => a.assetKey === operation.assetKey && a.kind === "CONTEXT_ASSET");
    if (!capability || !asset?.templateKey) return null;
    const allowed = new Set(model.editors.find(e => e.assetKey === asset.assetKey)?.fields.map(f => f.key) ?? []);
    if (Object.keys(operation.values).some(key => !allowed.has(key))) return null;
    const fields = { fieldSchemaVersion: asset.templateKey === "short-stay" ? "context-fields@v5"
      : asset.templateKey === "family-visit" ? "context-fields@v4" : "context-fields@v2",
      ...Object.fromEntries(Object.entries(operation.values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) };
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
  if (operation.kind === "EDIT_SHORT_STAY") {
    const card = model.board.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    if (context?.templateKey !== "short-stay" || (card ? !card.capabilityRefs.includes("PATCH_CONTEXT") || card.readOnly
      : !model.dropCapabilities.some(drop => drop.sourceAssetKey === "template:short-stay" && drop.target.kind === "BOARD_ZONE" && drop.resolution !== "BLOCKED"))) return null;
    return editShortStay(state, operation.edit);
  }
  if (operation.kind === "EDIT_FAMILY_VISIT") {
    const card = model.board.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    if (context?.templateKey !== "family-visit" || (card ? !card.capabilityRefs.includes("PATCH_CONTEXT") || card.readOnly
      : !model.dropCapabilities.some(drop => drop.sourceAssetKey === "template:family-visit" && drop.target.kind === "BOARD_ZONE" && drop.resolution !== "BLOCKED"))) return null;
    return editFamilyVisit(state, operation.edit);
  }
  if (operation.kind === "EDIT_NIGHT_OUT") {
    const card = model.board.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.edit.contextOccurrenceId);
    if (context?.templateKey !== "night-out" || (card ? !card.capabilityRefs.includes("PATCH_CONTEXT") || card.readOnly
      : !model.dropCapabilities.some(drop => drop.sourceAssetKey === "template:night-out" && drop.target.kind === "BOARD_ZONE" && drop.resolution !== "BLOCKED"))) return null;
    return editNightOut(state, operation.edit);
  }
  if (operation.kind === "MUTATE" && operation.mutation.kind === "PATCH_CONTEXT") {
    const mutation = operation.mutation;
    return patchLocalSocket(model, state, mutation.contextOccurrenceId, mutation.slotKey, mutation.items);
  }
  if (operation.kind === "CLEAR_SOCKET") {
    const context = state.contexts.find(c => c.contextOccurrenceId === operation.contextOccurrenceId);
    const items = context?.slotSelections[operation.slotKey]?.items;
    if (!Array.isArray(items)) return null;
    return patchLocalSocket(model, state, operation.contextOccurrenceId, operation.slotKey,
      (items as ComponentSelectionV1[]).filter(item => item.selectionId !== operation.selectionId));
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
  const digest = semanticStateDigest(draft);
  if (digest === model.board.draft.semanticStateDigest) return model;
  const known = new Set(model.board.contexts.map(c => c.contextOccurrenceId));
  const visible = new Set([...draft.contexts.map(c => c.contextOccurrenceId), ...model.board.contexts.filter(c => c.readOnly).map(c => c.contextOccurrenceId)]);
  const additions = draft.contexts.filter(c => !known.has(c.contextOccurrenceId));
  const previousContexts = new Map(model.semanticState.contexts.map(c => [c.contextOccurrenceId, c]));
  const contextCards = [...model.board.contexts.filter(c => visible.has(c.contextOccurrenceId)).map(c => {
    if (c.readOnly) return c;
    const latest = draft.contexts.find(item => item.contextOccurrenceId === c.contextOccurrenceId)!;
    // A validated, identical context needs no new card/socket representation.
    // String order differences merely miss this fast path; no financial values
    // are recomputed here and changed contexts keep the original projection path.
    if (JSON.stringify(latest) === JSON.stringify(previousContexts.get(c.contextOccurrenceId))) return c;
    const sockets = c.sockets.map(socket => {
      const items = latest.slotSelections[socket.slotKey]?.items;
      return Array.isArray(items) ? { ...socket, currentItems: items as ComponentSelectionV1[] } : socket;
    });
    return { ...c, fields: latest.fields, parentContextOccurrenceId: latest.parentContextOccurrenceId ?? null,
      childContextOccurrenceIds: sockets.flatMap(socket => socket.currentItems.flatMap(item => item.kind === "CHILD_CONTEXT" ? [item.childContextOccurrenceId] : [])),
      sockets, label: typeof latest.fields.label === "string" && latest.fields.label ? latest.fields.label : c.label };
  }), ...additions.map(c => ({ contextOccurrenceId: c.contextOccurrenceId, templateKey: c.templateKey,
    label: typeof c.fields.label === "string" && c.fields.label ? c.fields.label : model.library.searchableAssets.find(a => a.assetKey === `template:${c.templateKey}`)?.label ?? c.templateKey,
    parentContextOccurrenceId: c.parentContextOccurrenceId ?? null, childContextOccurrenceIds: [], externalIntentId: null,
    readOnly: false, fields: c.fields, components: [], knowledge: "UNKNOWN" as const, capabilityRefs: ["PATCH_CONTEXT", "REMOVE_CONTEXT"], sockets: [] }))];
  const values = new Map(draft.controls.map(c => [c.decisionSlotKey, c.value]));
  const patchControls = (cards: ComposerUiModel["board"]["baselineControls"]) => cards.map(c => values.has(c.targetRef) ? { ...c, value: { ...c.value, ...values.get(c.targetRef)! } } : c);
  const objects = { ...model.presentation.objects };
  const dragSources = { ...model.presentation.dragSources };
  const sockets = { ...model.presentation.sockets };
  const drops = model.dropCapabilities.filter(drop => !drop.target.contextOccurrenceId || visible.has(drop.target.contextOccurrenceId));
  for (const key of Object.keys(dragSources)) {
    const contextId = key.startsWith("context-occurrence:") ? key.slice("context-occurrence:".length) : key.startsWith("satellite:") ? key.split(":")[1] : null;
    if (contextId && !visible.has(contextId)) delete dragSources[key];
  }
  for (const key of Object.keys(sockets)) if (!visible.has(key.split(":")[0])) delete sockets[key];
  for (const card of contextCards) for (const socket of card.sockets) {
    const key = `${card.contextOccurrenceId}:${socket.slotKey}`;
    const priorSocket = model.board.contexts.find(c => c.contextOccurrenceId === card.contextOccurrenceId)?.sockets.find(s => s.slotKey === socket.slotKey);
    const priorPresentation = sockets[key];
    if (priorSocket?.currentItems === socket.currentItems) continue;
    if (!priorPresentation || plannerDigest(priorSocket?.currentItems ?? []) === plannerDigest(socket.currentItems)) continue;
    for (const sourceKey of Object.keys(dragSources)) if (sourceKey.startsWith(`satellite:${key}:`)) delete dragSources[sourceKey];
    sockets[key] = { ...priorPresentation, options: priorPresentation.options.map(option => {
      const asset = model.library.searchableAssets.find(a => a.assetKey === option.assetKey);
      const selected = socket.currentItems.find(item => item.kind === "CHILD_CONTEXT" ? item.optionKey === asset?.templateKey : item.optionKey === asset?.optionKey);
      return { ...option, state: selected ? selected.provenance === "PERSONAL_SUGGESTION" ? "SUGGESTED" as const : "EQUIPPED" as const
        : socket.currentItems.length && socket.cardinality !== "REPEATING" ? "ALTERNATIVE" as const : "AVAILABLE" as const };
    }), satellites: socket.currentItems.map(item => {
      const asset = model.library.searchableAssets.find(a => a.templateKey === card.templateKey && a.assetKey.startsWith(`option:${card.templateKey}:${socket.slotKey}:`) && a.optionKey === item.optionKey);
      const child = item.kind === "CHILD_CONTEXT" ? draft.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId) : null;
      const old = priorPresentation.satellites.find(s => s.selectionId === item.selectionId);
      const changed = plannerDigest(priorSocket?.currentItems.find(i => i.selectionId === item.selectionId) ?? null) !== plannerDigest(item);
      const satellite = { selectionId: item.selectionId,
        label: child ? typeof child.fields.label === "string" ? child.fields.label : model.library.searchableAssets.find(a => a.templateKey === child.templateKey)?.label ?? child.templateKey
          : item.kind === "COMPONENT" ? item.label : asset?.label ?? old?.label ?? "À préciser",
        iconKey: child ? model.presentation.objects[child.contextOccurrenceId]?.iconKey ?? "activity" : asset?.iconKey ?? old?.iconKey ?? "activity",
        state: item.provenance === "PERSONAL_SUGGESTION" ? "SUGGESTED" as const : changed ? "UNRESOLVED" as const : old?.state ?? "UNRESOLVED" as const,
        economicAmount: changed ? null : old?.economicAmount ?? null,
        costCaption: changed ? "Simulation en attente" : old?.costCaption ?? null,
        details: old?.details ?? [], editableAssetKey: item.kind !== "CHILD_CONTEXT" ? asset?.assetKey ?? null : null,
        canRemove: item.kind !== "CHILD_CONTEXT", canAccept: item.provenance === "PERSONAL_SUGGESTION",
        childContextOccurrenceId: child?.contextOccurrenceId ?? null };
      if (asset && item.kind !== "CHILD_CONTEXT" && item.kind !== "UNRESOLVED") {
        const sourceKey = `satellite:${key}:${item.selectionId}`;
        dragSources[sourceKey] = { sourceKey, assetKey: asset.assetKey, label: satellite.label, iconKey: satellite.iconKey,
          economicAmount: null, selection: item, protected: false,
          sourceSocket: { contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, selectionId: item.selectionId },
          removeOperation: { kind: "CLEAR_SOCKET", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey, selectionId: item.selectionId } };
      }
      return satellite;
    }) };
  }
  for (const c of additions) {
    const asset = model.library.searchableAssets.find(a => a.assetKey === `template:${c.templateKey}`);
    objects[c.contextOccurrenceId] = { iconKey: asset?.iconKey ?? "activity", variant: ["night-out", "short-stay"].includes(c.templateKey) ? "COMPOSITE" : "SIMPLE",
      baselineAmount: null, baselineCount: null, protectedSavings: false, reservationGauge: null, choiceGauge: null, occurrenceStack: null };
    const key = `context-occurrence:${c.contextOccurrenceId}`;
    dragSources[key] = { sourceKey: key, assetKey: key, label: asset?.label ?? c.templateKey, iconKey: asset?.iconKey ?? "activity", economicAmount: null,
      protected: false, removeOperation: { kind: "DROP", assetKey: key, target: { kind: "TRASH" }, values: {}, identity: c.contextOccurrenceId, selectionId: c.contextOccurrenceId } };
    drops.push({ sourceAssetKey: key, target: { kind: "TRASH" }, resolution: "ACCEPTED", semanticAction: "REMOVE_CONTEXT", previewSupported: true, constraint: null, choices: [] });
  }
  return { ...model, semanticState: draft, board: { ...model.board, contexts: contextCards,
    baselineControls: patchControls(model.board.baselineControls), discretionaryControls: patchControls(model.board.discretionaryControls), savings: patchControls(model.board.savings),
    draft: { ...model.board.draft, dirty: digest !== model.board.draft.semanticStateDigest || model.board.draft.dirty, semanticStateDigest: digest } },
    presentation: { ...model.presentation, objects, sockets, dragSources, elementCount: model.presentation.elementCount + additions.filter(c => !c.parentContextOccurrenceId).length
      - model.board.contexts.filter(c => !c.parentContextOccurrenceId && !visible.has(c.contextOccurrenceId)).length },
    dropCapabilities: drops };
}
