"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { composerPreset, presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { isPurchaseBasket } from "@/domain/phase2/planner/purchase-basket";
import { publishedDrop } from "./interactions";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useCommittedEvent } from "./use-committed-event";
import { conceptForPreset, presetPreferenceKey, rankCatalogRecommendations, workbookSource } from "./catalog-relevance";
import type { PersonalRecommendationScope } from "@/domain/phase2/composer-preferences";
import { PreferenceFeedback, usePersonalization } from "./personalization";
import { intentionNavigationEntries } from "./workshop-navigation";
import styles from "./composer.module.css";

type CompletionCandidate = Readonly<{ add: ComposerPresetKey; reason: string }>;
export type ProjectCompletionPriority = "BALANCED" | "ACTIVITIES" | "MEALS";

export function projectCompletionSuggestions(model: ComposerUiModel, parentId: string, priority: ProjectCompletionPriority = "BALANCED",personal?:PersonalRecommendationScope) {
  const parent = model.board.contexts.find(card => card.contextOccurrenceId === parentId);
  if (!parent || parent.readOnly || !parent.capabilityRefs.includes("PATCH_CONTEXT") || model.semanticState.preferences.anchors.includes(parentId)
    || model.semanticState.preferences.flexibility[parentId] === "PRESERVE") return [];
  const preset = presetForContext(parent)?.presetKey;
  const bare = parent.fields.composerPresentation === undefined;
  const visit = parent.templateKey === "friend-visit" || parent.templateKey === "family-visit";
  const stay = parent.templateKey === "short-stay";
  const home = preset === "furnish-room" || bare && parent.templateKey === "home-project";
  const slotKey = preset === "composed-outing" ? "children" : home ? "purchases" : (preset || bare) && (stay || visit) ? "activities" : null;
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
        { add: "home-equipment-basket", reason: preset === "furnish-room"
          ? "Aucun équipement ni achat n’est encore prévu pour cette pièce. Vous pouvez préparer un panier."
          : "Aucun équipement ni achat n’est encore prévu pour ce projet. Vous pouvez préparer un panier." },
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
  const stayMeal = stay && !mealChosen ? [{
    add: "restaurant-for-two" as const, reason: "Vous pouvez prévoir un repas pendant le séjour.",
  }] : [];
  const stayGroceries = stay && parent.fields.lodgingKind === "RENTAL"
    && !children.some(card => isPurchaseBasket(card) && card.fields.budgetDomain === "groceries")
    && !parent.sockets.find(socket => socket.slotKey === "groceries")?.currentItems.some(item => item.kind === "COMPONENT")
    ? [{ add: "groceries-purchase" as const,
      reason: "Vous avez choisi une location. Vous pouvez préparer un panier pour les repas pris sur place." }] : [];
  return rankCatalogRecommendations([...candidates, ...stayMeal, ...stayGroceries].flatMap(candidate => {
    const child = composerPreset(candidate.add);
    const assetKey = `template:${child?.templateKey}`;
    const destination = candidate.add === "groceries-purchase" ? "purchases" : stay && child?.templateKey === "restaurant" ? "restaurants" : slotKey;
    const target = { kind: "CONTEXT_SOCKET" as const, contextOccurrenceId: parentId, slotKey: destination };
    if (!child || chosen.has(child.presetKey) || child.templateKey === "restaurant" && mealChosen
      || !parent.sockets.some(socket => socket.slotKey === destination && socket.contextOccurrenceId === parentId
        && socket.capabilityRefs.includes(`${parent.templateKey}:${destination}:ATTACH_CHILD_CONTEXT`))
      || publishedDrop(model, assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return [];
    const category = child.templateKey === "restaurant" || candidate.add === "groceries-purchase" ? "MEALS" as const
      : home ? "PURCHASES" as const : "ACTIVITIES" as const;
    const concept = conceptForPreset(child.presetKey);
    const reusable = intentionNavigationEntries(model.board.contexts.filter(card => !card.parentContextOccurrenceId
      && card.contextOccurrenceId !== parentId && !card.readOnly && presetForContext(card)?.presetKey === child.presetKey
      && publishedDrop(model, `context-occurrence:${card.contextOccurrenceId}`, target)?.choices.includes("REPARENT_PRESERVE_ID")));
    return [{ key: `${parentId}:${child.presetKey}`, preset: child, target, assetKey, reason: candidate.reason,
      reusable, category, tiers: [Number(priority !== "BALANCED" && category !== priority), Number(category !== "ACTIVITIES")],
      preferenceKey:presetPreferenceKey(child.presetKey),source: concept ? workbookSource(concept) : undefined }];
  }),undefined,personal);
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
  const personal=usePersonalization();
  const confirm = useWorkshopConfirmation(), edits = useInlineEditRegistry();
  const summary = useRef<HTMLElement>(null);
  const [adoptionError, setAdoptionError] = useState("");
  const dismissed = preference.dismissed[parentId] ?? [];
  const candidates = useMemo(() => projectCompletionSuggestions(model, parentId, preference.priority,{rows:personal?.rows??[],contextId:parentId,today:personal?.today}), [model, parentId, preference.priority,personal?.rows,personal?.today]);
  const adopt = useCommittedEvent((key: string, expectedDigest: string, childId?: string) => {
    const candidate = candidates.find(item => item.key === key);
    if (!candidate || busy || !preference.enabled || dismissed.includes(key) || model.board.draft.semanticStateDigest !== expectedDigest
      || (childId ? !candidate.reusable.some(child => child.id === childId) : candidate.reusable.length > 0)) {
      setAdoptionError("Le projet a changé. Consultez les suggestions actuelles avant d’ajouter une intention.");
      return;
    }
    setAdoptionError("");
    const added = decide({ kind: "DROP", assetKey: childId ? `context-occurrence:${childId}` : candidate.assetKey, target: candidate.target,
      ...(!childId ? { presetKey: candidate.preset.presetKey,
        ...(candidate.preset.templateKey === "purchase" ? { purchaseBasket: true } : {}) } : {}),
      identity: childId ?? crypto.randomUUID(), selectionId: crypto.randomUUID(), values: {} });
    if (!added) setAdoptionError("Cette intention n’a pas été ajoutée. Consultez le message du brouillon, puis réessayez.");
  });
  const ask = useCommittedEvent((key: string, childId?: string) => {
    const candidate = candidates.find(item => item.key === key);
    if (!candidate || busy || !preference.enabled || dismissed.includes(key)) return;
    const expectedDigest = model.board.draft.semanticStateDigest;
    const child = candidate.reusable.find(item => item.id === childId);
    const open = () => {
      setAdoptionError("");
      confirm({ message: child ? `Rattacher « ${child.label} » au projet ? Son identité et ses postes seront conservés.`
        : `Ajouter « ${candidate.preset.label} » au projet ? Son prix restera à préciser.`,
        acceptLabel: child ? "Rattacher cette intention" : "Ajouter cette intention", accept: () => adopt(candidate.key, expectedDigest, childId) });
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
      <PreferenceFeedback subjectKey={candidate.preferenceKey} label={candidate.preset.label} contextId={parentId}
        contextLabel={model.board.contexts.find(c=>c.contextOccurrenceId===parentId)?.label}/>
      {candidate.reusable.length ? candidate.reusable.map(child => <button key={child.id} type="button" disabled={busy}
        onClick={() => ask(candidate.key, child.id)}>Rattacher {child.label}</button>)
        : <button type="button" disabled={busy} onClick={() => ask(candidate.key)}>Préparer {candidate.preset.label}</button>}
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
