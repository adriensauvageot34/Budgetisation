import { composerPreset, presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerRequest, ComposerTransport, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";

export const projectStarters = [
  { key: "cinema-dinner", label: "Cinéma et restaurant", parent: "composed-outing",
    children: [{ key: "cinema", slot: "children" }, { key: "restaurant-for-two", slot: "children" }] },
  { key: "weekend-culture", label: "Week-end et musée", parent: "weekend-gite",
    children: [{ key: "museum-exhibition", slot: "activities" }] },
  { key: "weekend-outdoors", label: "Week-end et randonnée", parent: "weekend-gite",
    children: [{ key: "hiking-nature", slot: "activities" }] },
  { key: "games-basket", label: "Achat de jeux et accessoires", parent: "video-game-purchase",
    children: [] },
  { key: "visit-and-activity", label: "Visite et activité", parent: "visit-friends",
    children: [{ key: "museum-exhibition", slot: "activities" }] },
  { key: "weekend-discovery", label: "Week-end culture et nature", parent: "weekend-gite",
    children: [{ key: "museum-exhibition", slot: "activities" }, { key: "hiking-nature", slot: "activities" }] },
  { key: "hotel-and-culture", label: "Hôtel et sortie culturelle", parent: "hotel-night",
    children: [{ key: "museum-exhibition", slot: "activities" }] },
  { key: "relatives-and-nature", label: "Séjour chez des proches et balade", parent: "stay-with-relatives",
    children: [{ key: "hiking-nature", slot: "activities" }] },
  { key: "bowling-and-dinner", label: "Bowling et restaurant", parent: "composed-outing",
    children: [{ key: "bowling", slot: "children" }, { key: "restaurant-for-two", slot: "children" }] },
  { key: "friends-and-escape", label: "Visite amicale et escape game", parent: "visit-friends",
    children: [{ key: "escape-game", slot: "activities" }] },
  { key: "hotel-and-dinner", label: "Hôtel, musée et restaurant", parent: "hotel-night",
    children: [{ key: "museum-exhibition", slot: "activities" }, { key: "restaurant-for-two", slot: "restaurants" }] },
  { key: "weekend-groceries-and-walk", label: "Week-end, courses et balade", parent: "weekend-gite",
    children: [{ key: "groceries-purchase", slot: "purchases" }, { key: "hiking-nature", slot: "activities" }] },
] as const satisfies readonly {
  key: string; label: string; parent: ComposerPresetKey; children: readonly { key: ComposerPresetKey; slot: string }[];
}[];
export type ProjectStarter = typeof projectStarters[number];
export type ProjectStarterChoices = { label: string; children: readonly ComposerPresetKey[]; plannedDate?: string };

export function projectStarterCategory(starter: ProjectStarter) {
  switch (composerPreset(starter.parent)?.templateKey) {
    case "short-stay": return "Séjours";
    case "friend-visit": return "Visites";
    case "purchase": return "Achats";
    default: return "Sorties";
  }
}
export function projectStarterContents(starter: ProjectStarter) {
  return [starter.parent, ...starter.children.map(child => child.key)].map(key => composerPreset(key)?.label).join(" · ");
}
export function projectStarterMatches(starter: ProjectStarter, query: string) {
  const text = normalizeLibrarySearch([starter.label, projectStarterCategory(starter), ...[starter.parent, ...starter.children.map(child => child.key)]
    .flatMap(key => { const preset = composerPreset(key); return preset ? [preset.label, ...preset.searchTerms] : []; })].join(" "));
  return normalizeLibrarySearch(query).split(" ").filter(Boolean).every(word => text.includes(word));
}

const boardDrop = { kind: "BOARD_ZONE" } as const;
export function projectPresetAvailable(model: ComposerUiModel, key: ComposerPresetKey) {
  return model.dropCapabilities.some(cap => cap.sourceAssetKey === `template:${composerPreset(key)?.templateKey}`
    && cap.target.kind === "BOARD_ZONE" && cap.resolution !== "BLOCKED" && cap.semanticAction === "ADD_CONTEXT");
}
export function availableProjectStarters(model: ComposerUiModel) {
  return projectStarters.filter(starter => projectPresetAvailable(model, starter.parent));
}

/** Run the existing Composer evaluator against a private draft. The caller installs
 * only the final admitted state, so an incomplete template cannot reach autosave. */
export async function evaluateProjectStarter(starter: ProjectStarter, model: ComposerUiModel, transport: ComposerTransport,
  nextId: () => string, nextSequence: () => number, choices?: ProjectStarterChoices) {
  const label = choices?.label.trim();
  const children: readonly ComposerPresetKey[] = choices?.children ?? starter.children.map(child => child.key);
  const date = choices?.plannedDate?.trim() ?? "";
  if (date) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date.slice(0, 7) !== model.semanticState.targetMonth
      || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      throw new Error("Choisissez une date valide dans le mois du projet, ou laissez-la à préciser.");
  }
  if ((choices && (!label || label.length > 120)) || new Set(children).size !== children.length
    || children.some(key => !starter.children.some(child => child.key === key) || !projectPresetAvailable(model, key))
    || !availableProjectStarters(model).includes(starter))
    throw new Error("Ce modèle ou ses intentions ne sont plus disponibles. Rouvrez son aperçu.");
  let evaluated = model;
  const parentId = nextId();
  const base = model.proof;
  const drop = async (key: ComposerPresetKey, target: Extract<ComposerRequest, { kind: "DROP" }>["target"], identity: string) => {
    const preset = composerPreset(key);
    if (!preset) throw new Error("Intention indisponible pour ce modèle.");
    const sequence = nextSequence();
    const selectionId = nextId();
    const response = await transport({ kind: "DROP", assetKey: `template:${preset.templateKey}`, presetKey: key, target, identity,
      selectionId, values: identity === parentId ? { ...(label ? { label } : {}), ...(date ? { plannedDate: date } : {}) } : {},
      sequence, targetMonth: model.semanticState.targetMonth, draft: evaluated.semanticState,
      ...(preset.templateKey === "purchase" ? { purchaseBasket: true } : {}) });
    if (!response.ok) throw new Error(response.message);
    const destination = target.contextOccurrenceId && response.model.board.contexts.find(card => card.contextOccurrenceId === target.contextOccurrenceId);
    const attached = target.kind === "BOARD_ZONE" || !!destination && destination.childContextOccurrenceIds.includes(identity)
      && destination.sockets.some(socket => socket.slotKey === target.slotKey && socket.currentItems.some(item =>
        item.kind === "CHILD_CONTEXT" && item.selectionId === selectionId && item.childContextOccurrenceId === identity));
    if (response.sequence !== sequence || response.applied || response.applyReceipt
      || !attached
      || response.model.semanticState.targetMonth !== model.semanticState.targetMonth
      || response.model.proof.expectedBaselineDigest !== base.expectedBaselineDigest
      || response.model.proof.expectedActiveRevisionId !== base.expectedActiveRevisionId
      || response.model.proof.expectedActiveRevisionNumber !== base.expectedActiveRevisionNumber
      || response.model.board.draft.semanticStateDigest !== semanticStateDigest(response.model.semanticState)
      || !response.model.semanticState.contexts.some(context => context.contextOccurrenceId === identity
        && (context.parentContextOccurrenceId ?? null) === (target.contextOccurrenceId ?? null)
        && presetForContext(context)?.presetKey === key))
      throw new Error("La réponse ou la référence du mois a changé. Actualisez les finances avant de réessayer.");
    evaluated = response.model;
  };
  await drop(starter.parent, boardDrop, parentId);
  for (const child of starter.children.filter(child => children.includes(child.key))) {
    await drop(child.key, { kind: "CONTEXT_SOCKET", contextOccurrenceId: parentId, slotKey: child.slot }, nextId());
  }
  return { model: evaluated, parentId };
}
