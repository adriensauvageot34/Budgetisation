"use client";

import { createContext, useContext } from "react";
import { composerPreset, presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { publishedDrop } from "./interactions";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useCommittedEvent } from "./use-committed-event";
import styles from "./composer.module.css";

type CompletionRule = Readonly<{ trigger: ComposerPresetKey; add: ComposerPresetKey; reason: string }>;
const outingRules: readonly CompletionRule[] = [
  { trigger: "cinema", add: "restaurant-for-two", reason: "Votre sortie contient un cinéma. Vous pouvez prévoir un repas dans le même projet." },
  { trigger: "restaurant-for-two", add: "cinema", reason: "Votre sortie contient un restaurant. Vous pouvez prévoir une séance dans le même projet." },
];

export function projectCompletionSuggestions(model: ComposerUiModel, parentId: string) {
  const parent = model.board.contexts.find(card => card.contextOccurrenceId === parentId);
  if (!parent || parent.readOnly || !parent.capabilityRefs.includes("PATCH_CONTEXT") || model.semanticState.preferences.anchors.includes(parentId)
    || model.semanticState.preferences.flexibility[parentId] === "PRESERVE") return [];
  const preset = presetForContext(parent)?.presetKey;
  const slotKey = preset === "composed-outing" ? "children" : preset === "weekend-gite" ? "activities" : null;
  if (!slotKey || !parent.sockets.some(socket => socket.slotKey === slotKey && socket.contextOccurrenceId === parentId
    && socket.capabilityRefs.includes(`${parent.templateKey}:${slotKey}:ATTACH_CHILD_CONTEXT`))) return [];
  const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: parentId, slotKey };
  const children = model.board.contexts.filter(card => card.parentContextOccurrenceId === parentId
    && parent.childContextOccurrenceIds.includes(card.contextOccurrenceId));
  const chosen = new Set(children.map(card => presetForContext(card)?.presetKey));
  const candidates = preset === "composed-outing"
    ? outingRules.filter(rule => chosen.has(rule.trigger) && !chosen.has(rule.add))
    : children.some(card => card.templateKey === "activity") ? [] : [{
      add: "museum-exhibition" as const, reason: "Vous préparez un week-end. Vous pouvez prévoir une visite parmi les activités du séjour.",
    }];
  return candidates.flatMap(candidate => {
    const child = composerPreset(candidate.add);
    const assetKey = `template:${child?.templateKey}`;
    if (!child || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return [];
    return [{ key: `${parentId}:${child.presetKey}`, preset: child, target, assetKey, reason: candidate.reason }];
  });
}

export const ProjectCompletionPreference = createContext<{
  enabled: boolean; toggle: () => void;
  dismissed: Readonly<Record<string, readonly string[]>>; dismiss: (id: string, key: string | null) => void;
}>({ enabled: true, toggle: () => {}, dismissed: {}, dismiss: () => {} });

export function ProjectCompletion({ model, parentId, busy, decide }: {
  model: ComposerUiModel; parentId: string; busy: boolean; decide: (operation: ComposerOperation) => boolean;
}) {
  const preference = useContext(ProjectCompletionPreference);
  const confirm = useWorkshopConfirmation(), edits = useInlineEditRegistry();
  const dismissed = preference.dismissed[parentId] ?? [];
  const candidates = projectCompletionSuggestions(model, parentId);
  const adopt = useCommittedEvent((key: string) => {
    const candidate = candidates.find(item => item.key === key);
    if (!candidate || busy || !preference.enabled || dismissed.includes(key)) return;
    decide({ kind: "DROP", assetKey: candidate.assetKey, presetKey: candidate.preset.presetKey, target: candidate.target,
      identity: crypto.randomUUID(), selectionId: crypto.randomUUID(), values: {} });
  });
  if (preference.enabled && !candidates.length && !dismissed.length) return null;
  const visible = candidates.filter(candidate => !dismissed.includes(candidate.key));
  return <details className={styles.suggestionControls} data-project-completion>
    <summary>Suggestions pour compléter le projet</summary>
    <button type="button" aria-pressed={preference.enabled} onClick={preference.toggle}>
      {preference.enabled ? "Désactiver pour cette session" : "Réactiver les suggestions de projet"}
    </button>
    {preference.enabled && visible.map(candidate => <div key={candidate.key}>
      <p>{candidate.reason}</p>
      <button type="button" disabled={busy} onClick={() => {
        const open = () => confirm({ message: `Ajouter « ${candidate.preset.label} » au projet ? Son prix restera à préciser.`,
          acceptLabel: "Ajouter cette intention", accept: () => adopt(candidate.key) });
        if (!edits || edits.guard(open)) open();
      }}>Préparer {candidate.preset.label}</button>
      <button type="button" disabled={busy} onClick={() => preference.dismiss(parentId, candidate.key)}>Masquer {candidate.preset.label}</button>
    </div>)}
    {preference.enabled && dismissed.length > 0 && <button type="button" onClick={() => preference.dismiss(parentId, null)}>Réafficher les suggestions masquées</button>}
  </details>;
}
