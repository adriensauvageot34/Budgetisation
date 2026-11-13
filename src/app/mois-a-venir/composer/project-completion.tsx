"use client";

import { createContext, useContext, useRef, useState } from "react";
import { composerPreset, presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { isPurchaseBasket } from "@/domain/phase2/planner/purchase-basket";
import { publishedDrop } from "./interactions";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useCommittedEvent } from "./use-committed-event";
import styles from "./composer.module.css";

type CompletionCandidate = Readonly<{ add: ComposerPresetKey; reason: string }>;
export type ProjectCompletionPriority = "BALANCED" | "ACTIVITIES" | "MEALS";

export function projectCompletionSuggestions(model: ComposerUiModel, parentId: string, priority: ProjectCompletionPriority = "BALANCED") {
  const parent = model.board.contexts.find(card => card.contextOccurrenceId === parentId);
  if (!parent || parent.readOnly || !parent.capabilityRefs.includes("PATCH_CONTEXT") || model.semanticState.preferences.anchors.includes(parentId)
    || model.semanticState.preferences.flexibility[parentId] === "PRESERVE") return [];
  const preset = presetForContext(parent)?.presetKey;
  const visit = parent.templateKey === "friend-visit" || parent.templateKey === "family-visit";
  const stay = parent.templateKey === "short-stay";
  const home = preset === "furnish-room";
  const slotKey = preset === "composed-outing" ? "children" : home ? "purchases" : preset && (stay || visit) ? "activities" : null;
  if (!slotKey) return [];
  const children = model.board.contexts.filter(card => card.parentContextOccurrenceId === parentId
    && parent.childContextOccurrenceIds.includes(card.contextOccurrenceId));
  const chosen = new Set(children.map(card => presetForContext(card)?.presetKey));
  const activity = children.find(card => card.templateKey === "activity");
  const activityChosen = !!activity;
  const mealChosen = children.some(card => ["restaurant", "fast-food", "delivery"].includes(card.templateKey))
    || stay && !!parent.sockets.find(socket => socket.slotKey === "restaurants")?.currentItems.some(item => item.kind === "COMPONENT");
  const stayLabel = preset === "weekend-gite" ? "week-end" : "séjour";
  const outingCandidates: CompletionCandidate[] = [];
  if (!activity && (mealChosen || !children.length)) outingCandidates.push({ add: "cinema", reason: mealChosen
    ? "Un repas est déjà lié à la sortie. Vous pouvez préparer une séance dans le même projet."
    : "Votre projet ne contient aucune intention. Vous pouvez commencer par une séance, puis compléter la sortie." });
  if (!mealChosen && (activity || !children.length)) outingCandidates.push({ add: "restaurant-for-two", reason: activity
    ? `« ${activity.label} » est déjà lié à la sortie. Vous pouvez préparer un repas dans le même projet.`
    : "Votre projet ne contient aucun repas. Vous pouvez préparer un restaurant si vous le souhaitez." });
  const candidates: readonly CompletionCandidate[] = preset === "composed-outing"
    ? outingCandidates
    : home ? children.some(card => card.templateKey === "purchase")
      || parent.sockets.find(socket => socket.slotKey === "items")?.currentItems.some(item => item.kind === "COMPONENT") ? [] : [
        { add: "home-equipment-basket", reason: "Aucun équipement ni achat n’est encore prévu pour cette pièce. Vous pouvez préparer un panier." },
      ]
    : visit ? activityChosen ? [] : [{ add: "museum-exhibition",
      reason: "Votre visite n’a pas encore d’activité liée. Vous pouvez préparer une sortie culturelle." }]
    : !activityChosen ? [
      { add: "museum-exhibition", reason: `Votre ${stayLabel} n’a pas encore d’activité liée. Vous pouvez préparer une visite culturelle.` },
      { add: "hiking-nature", reason: `Votre ${stayLabel} n’a pas encore d’activité liée. Vous pouvez préparer une sortie dans la nature.` },
    ] : chosen.has("museum-exhibition") && !chosen.has("hiking-nature") ? [{ add: "hiking-nature",
      reason: "Une visite culturelle est déjà liée au séjour. Une randonnée peut la compléter, si vous souhaitez une activité nature." }]
      : chosen.has("hiking-nature") && !chosen.has("museum-exhibition") ? [{ add: "museum-exhibition",
        reason: "Une randonnée est déjà liée au séjour. Vous pouvez examiner une visite culturelle en complément." }] : [];
  const stayMeal = stay && activityChosen && !mealChosen ? [{
    add: "restaurant-for-two" as const, reason: "Une activité est déjà liée au séjour. Vous pouvez prévoir un repas pendant le séjour.",
  }] : [];
  const stayGroceries = stay && parent.fields.lodgingKind === "RENTAL"
    && !children.some(card => isPurchaseBasket(card) && card.fields.budgetDomain === "groceries")
    && !parent.sockets.find(socket => socket.slotKey === "groceries")?.currentItems.some(item => item.kind === "COMPONENT")
    ? [{ add: "groceries-purchase" as const,
      reason: "Vous avez choisi une location. Vous pouvez préparer un panier pour les repas pris sur place." }] : [];
  return [...candidates, ...stayMeal, ...stayGroceries].flatMap(candidate => {
    const child = composerPreset(candidate.add);
    const assetKey = `template:${child?.templateKey}`;
    const destination = candidate.add === "groceries-purchase" ? "purchases" : stay && child?.templateKey === "restaurant" ? "restaurants" : slotKey;
    const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: parentId, slotKey: destination };
    if (!child || chosen.has(child.presetKey) || child.templateKey === "restaurant" && mealChosen
      || !parent.sockets.some(socket => socket.slotKey === destination && socket.contextOccurrenceId === parentId
        && socket.capabilityRefs.includes(`${parent.templateKey}:${destination}:ATTACH_CHILD_CONTEXT`))
      || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return [];
    return [{ key: `${parentId}:${child.presetKey}`, preset: child, target, assetKey, reason: candidate.reason,
      category: child.templateKey === "restaurant" || candidate.add === "groceries-purchase" ? "MEALS" as const
        : home ? "PURCHASES" as const : "ACTIVITIES" as const }];
  }).sort((left, right) => Number(right.category === priority) - Number(left.category === priority));
}

export const ProjectCompletionPreference = createContext<{
  enabled: boolean; toggle: () => void;
  dismissed: Readonly<Record<string, readonly string[]>>; dismiss: (id: string, key: string | null) => void;
  priority?: ProjectCompletionPriority; prioritize?: (priority: ProjectCompletionPriority) => void;
}>({ enabled: true, toggle: () => {}, dismissed: {}, dismiss: () => {} });

export function ProjectCompletion({ model, parentId, busy, decide }: {
  model: ComposerUiModel; parentId: string; busy: boolean; decide: (operation: ComposerOperation) => boolean;
}) {
  const preference = useContext(ProjectCompletionPreference);
  const confirm = useWorkshopConfirmation(), edits = useInlineEditRegistry();
  const summary = useRef<HTMLElement>(null);
  const [adoptionError, setAdoptionError] = useState("");
  const dismissed = preference.dismissed[parentId] ?? [];
  const candidates = projectCompletionSuggestions(model, parentId, preference.priority);
  const adopt = useCommittedEvent((key: string, expectedDigest: string) => {
    const candidate = candidates.find(item => item.key === key);
    if (!candidate || busy || !preference.enabled || dismissed.includes(key) || model.board.draft.semanticStateDigest !== expectedDigest) {
      setAdoptionError("Le projet a changé. Consultez les suggestions actuelles avant d’ajouter une intention.");
      return;
    }
    setAdoptionError("");
    decide({ kind: "DROP", assetKey: candidate.assetKey, presetKey: candidate.preset.presetKey, target: candidate.target,
      ...(candidate.preset.templateKey === "purchase" ? { purchaseBasket: true } : {}),
      identity: crypto.randomUUID(), selectionId: crypto.randomUUID(), values: {} });
  });
  const ask = useCommittedEvent((key: string) => {
    const candidate = candidates.find(item => item.key === key);
    if (!candidate || busy || !preference.enabled || dismissed.includes(key)) return;
    const expectedDigest = model.board.draft.semanticStateDigest;
    const open = () => {
      setAdoptionError("");
      confirm({ message: `Ajouter « ${candidate.preset.label} » au projet ? Son prix restera à préciser.`,
        acceptLabel: "Ajouter cette intention", accept: () => adopt(candidate.key, expectedDigest) });
    };
    if (!edits || edits.guard(open)) open();
  });
  if (preference.enabled && !candidates.length && !dismissed.length && !adoptionError) return null;
  const visible = candidates.filter(candidate => !dismissed.includes(candidate.key)).slice(0, 4);
  return <details className={styles.suggestionControls} data-project-completion>
    <summary ref={summary}>Suggestions pour compléter le projet</summary>
    {adoptionError && <p role="alert">{adoptionError}</p>}
    <button type="button" aria-pressed={preference.enabled} onClick={preference.toggle}>
      {preference.enabled ? "Désactiver pour cette session" : "Réactiver les suggestions de projet"}
    </button>
    {preference.enabled && preference.prioritize && visible.some(candidate => candidate.category !== "PURCHASES") && <label>Priorité pour cette session<select value={preference.priority ?? "BALANCED"}
      onChange={event => { const next = event.target.value; if (next === "BALANCED" || next === "ACTIVITIES" || next === "MEALS") preference.prioritize?.(next); }}>
      <option value="BALANCED">Compléments directement liés</option><option value="ACTIVITIES">Activités d’abord</option><option value="MEALS">Repas d’abord</option>
    </select></label>}
    {preference.enabled && preference.priority && preference.priority !== "BALANCED" && visible.some(candidate => candidate.category !== "PURCHASES")
      && <p>Votre priorité de session change l’ordre des propositions admissibles. Elle est conservée pendant cette session Composer.</p>}
    {preference.enabled && visible.map(candidate => <div key={candidate.key}>
      <p>{candidate.reason}</p>
      <button type="button" disabled={busy} onClick={() => ask(candidate.key)}>Préparer {candidate.preset.label}</button>
      <button type="button" disabled={busy} onClick={() => {
        summary.current?.focus();
        preference.dismiss(parentId, candidate.key);
      }}>Masquer {candidate.preset.label}</button>
    </div>)}
    {preference.enabled && dismissed.length > 0 && <button type="button" onClick={() => {
      summary.current?.focus();
      preference.dismiss(parentId, null);
    }}>Réafficher les suggestions masquées</button>}
  </details>;
}
