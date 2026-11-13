"use client";

import { useState } from "react";
import { COMPOSER_LIBRARY_PRESETS, presetForContext } from "@/domain/phase2/planner/composer-presets";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { CatalogOpenButton } from "./catalog-discovery-provider";
import { catalogRefLocked } from "./catalog-discovery";
import { publishedDrop } from "./interactions";
import { intentionNavigationEntries } from "./workshop-navigation";
import { useCommittedEvent } from "./use-committed-event";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";

export function ProjectActivityCatalog({ model, parentId, busy, decide, open }: {
  model: ComposerUiModel; parentId: string; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; open?: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const confirm = useWorkshopConfirmation(), edits = useInlineEditRegistry();
  const parent = model.board.contexts.find(card => card.contextOccurrenceId === parentId);
  const slotKey = parent?.templateKey === "other-context" ? "children"
    : parent && ["short-stay", "friend-visit", "family-visit"].includes(parent.templateKey) ? "activities" : null;
  const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: parentId, slotKey: slotKey ?? undefined };
  const writable = parent && slotKey && !parent.readOnly && parent.capabilityRefs.includes("PATCH_CONTEXT")
    && !catalogRefLocked(model, parentId)
    && (parent.fields.composerPresentation === undefined || !!presetForContext(parent))
    && parent.sockets.some(socket => socket.contextOccurrenceId === parentId && socket.slotKey === slotKey
      && socket.capabilityRefs.includes(`${parent.templateKey}:${slotKey}:ATTACH_CHILD_CONTEXT`));
  const activityAllowed = writable && publishedDrop(model, "template:activity", target)?.semanticAction === "PATCH_CONTEXT";
  const linked = model.board.contexts.filter(child => child.parentContextOccurrenceId === parentId
    && parent?.childContextOccurrenceIds.includes(child.contextOccurrenceId));
  const roots = writable ? model.board.contexts.filter(card => card.contextOccurrenceId !== parentId && !card.parentContextOccurrenceId
    && !card.readOnly && !catalogRefLocked(model, card.contextOccurrenceId)
    && publishedDrop(model, `context-occurrence:${card.contextOccurrenceId}`, target)?.choices.includes("REPARENT_PRESERVE_ID")) : [];
  const existingPresets = new Set([...roots, ...linked].map(card => presetForContext(card)?.presetKey));
  const options = writable ? COMPOSER_LIBRARY_PRESETS.filter(preset => preset.templateKey === "activity"
    && (activityAllowed || existingPresets.has(preset.presetKey))) : [];
  const adopt = useCommittedEvent((key: string, digest: string, existingId?: string) => {
    const option = options.find(preset => preset.presetKey === key);
    const existing = roots.find(card => card.contextOccurrenceId === existingId && presetForContext(card)?.presetKey === key);
    if (busy || !option || !existingId && !activityAllowed || digest !== model.board.draft.semanticStateDigest
      || existingId && !existing || linked.some(child => presetForContext(child)?.presetKey === key)) {
      setError("Le projet ou ses droits ont changé. Rouvrez le catalogue avant d’ajouter cette activité.");
      return;
    }
    const added = decide({ kind: "DROP", assetKey: existing ? `context-occurrence:${existing.contextOccurrenceId}` : "template:activity",
      ...(!existing ? { presetKey: option.presetKey } : {}), target,
      identity: existing?.contextOccurrenceId ?? crypto.randomUUID(), selectionId: crypto.randomUUID(), values: {} });
    setError(added ? "" : "Cette activité n’a pas été ajoutée. Consultez le message du brouillon, puis réessayez.");
  });
  const ask = useCommittedEvent((key: string, existingId?: string) => {
    const option = options.find(preset => preset.presetKey === key);
    const existing = roots.find(card => card.contextOccurrenceId === existingId && presetForContext(card)?.presetKey === key);
    if (busy || !option || existingId && !existing || !existingId && !activityAllowed) return;
    const digest = model.board.draft.semanticStateDigest;
    const show = () => confirm({ message: existing
      ? `Rattacher « ${existing.label} » à ce projet ? Son identité et ses postes seront conservés.`
      : `Associer « ${option.label} » à ce projet ? Son prix restera à préciser.`,
      acceptLabel: "Associer cette activité", accept: () => adopt(key, digest, existingId) });
    if (!edits || edits.guard(show)) show();
  });
  const openLinked = useCommittedEvent((id: string) => {
    if (!busy && linked.some(child => child.contextOccurrenceId === id)) open?.(id);
  });
  return <>
    {options.length > 0 && <CatalogOpenButton target={{ contextId: parentId, scope: "activity", resolveCommands: entry => {
      const option = options.find(preset => entry.presetKey === preset.presetKey
        || "visualConceptId" in preset && preset.visualConceptId === entry.visualConceptId);
      if (!option) return [];
      const existing = intentionNavigationEntries(linked.filter(child => presetForContext(child)?.presetKey === option.presetKey));
      if (existing.length) return open ? existing.map(child => ({
        key: child.id, visualConceptId: entry.visualConceptId, editsExisting: true,
        label: `Ouvrir ${child.label}`, run: () => openLinked(child.id),
      })) : [];
      const reusable = intentionNavigationEntries(roots.filter(card => presetForContext(card)?.presetKey === option.presetKey));
      if (reusable.length) return reusable.map(card => ({
        key: card.id, visualConceptId: entry.visualConceptId,
        label: `Rattacher ${card.label}`, run: () => ask(option.presetKey, card.id),
      }));
      return [{ key: option.presetKey, visualConceptId: entry.visualConceptId,
        label: `Associer ${option.label} à ce projet`, run: () => ask(option.presetKey) }];
    } }}>Choisir une activité dans le catalogue</CatalogOpenButton>}
    {error && <p role="alert">{error}</p>}
  </>;
}
