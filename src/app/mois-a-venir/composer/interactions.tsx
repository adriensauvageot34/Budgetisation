"use client";
import { createContext, useContext, type DragEvent } from "react";
import type { ComposerDragSource, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";

export const sameTarget = (a: DropTarget | null, b: DropTarget) => !!a && a.kind === b.kind && a.contextOccurrenceId === b.contextOccurrenceId && a.slotKey === b.slotKey;
export function leftSurface(event: DragEvent<HTMLElement>) {
  const next = event.relatedTarget instanceof Node ? event.relatedTarget : document.elementFromPoint(event.clientX, event.clientY);
  return !next || !event.currentTarget.contains(next);
}
/** Copies editor values; it neither computes prices nor chooses compatibility. */
export function selectionValues(selection?: ComponentSelectionV1): Record<string, string> {
  if (selection?.kind === "COMPONENT") return { label: selection.label, quantity: selection.quantity, amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "",
    funding: selection.fundingAllocations?.[0]?.source ?? "", fundingAmount: selection.fundingAllocations?.[0]?.amount ?? "", binding: selection.binding?.mode ?? "AUTO", needOccurrenceId: selection.needOccurrenceId ?? "" };
  if (selection?.kind === "MOBILITY_INTENT") return { origin: selection.origin?.kind === "TEXT" ? selection.origin.label : "", destination: selection.destination?.kind === "TEXT" ? selection.destination.label : "",
    amount: selection.pricing?.fare.kind === "MANUAL" ? selection.pricing.fare.unitAmount : "", funding: selection.pricing?.fundingAllocations[0]?.source ?? "", fundingAmount: selection.pricing?.fundingAllocations[0]?.amount ?? "",
    returnRequired: String(selection.returnRequired === true), targetIntentId: selection.journey?.targetIntentId ?? "", plannedTime: selection.plannedTime ?? "", returnTime: selection.returnTime ?? "",
    preference: selection.pricing?.preference ?? "FASTEST", parkingMode: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount === "0" || selection.pricing.parking.unitAmount === "0.00" ? "NO" : "YES" : "UNKNOWN", parkingAmount: selection.pricing?.parking.kind === "MANUAL" ? selection.pricing.parking.unitAmount : "" };
  return {};
}
export function preparedDrop(source: ComposerDragSource, target: DropTarget, identity: string, selectionId: string): ComposerOperation {
  return { kind: "DROP", assetKey: source.assetKey, target, values: selectionValues(source.selection), identity,
    selectionId: source.selection?.selectionId ?? selectionId, ...(source.sourceSocket ? { sourceSocket: source.sourceSocket } : {}) };
}
export function publishedDrop(model: ComposerUiModel, assetKey: string, target: DropTarget) {
  return model.dropCapabilities.find(d => d.sourceAssetKey === assetKey && sameTarget(d.target, target) && d.resolution !== "BLOCKED");
}
export type InteractionView = {
  grabbed: ComposerDragSource | null; overTarget: DropTarget | null; motion: "snap" | "undo" | "redo" | "recoil" | null;
  motionTarget: string | null; completenessFocus: boolean; unresolvedRefs: readonly string[];
  start: (key: string, event: DragEvent<HTMLElement>) => void; end: () => void;
  over: (target: DropTarget | null) => void; place: (target: DropTarget) => void;
  equip: (assetKey: string, target: DropTarget) => void;
  canTarget: (targetRef: string) => boolean; overAssistant: (targetRef: string | null) => void; placeAssistant: (targetRef: string) => void;
  reject: () => void;
};
export const ComposerInteractionContext = createContext<InteractionView | null>(null);
export const useComposerInteractions = () => useContext(ComposerInteractionContext);
export function useDragHandle(sourceKey?: string) {
  const interaction = useComposerInteractions();
  return { draggable: !!sourceKey && !!interaction, "data-drag-source": sourceKey,
    "data-grabbed": !!sourceKey && interaction?.grabbed?.sourceKey === sourceKey,
    onDragStart: (event: DragEvent<HTMLElement>) => { if (sourceKey) { event.stopPropagation(); interaction?.start(sourceKey, event); } },
    onDragEnd: () => interaction?.end() };
}
