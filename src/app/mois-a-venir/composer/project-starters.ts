import { composerPreset, presetForContext, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerRequest, ComposerTransport, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { semanticStateDigest } from "@/domain/phase2/planner/semantic-state";

export const projectStarters = [
  { key: "cinema-dinner", label: "Cinéma et restaurant", parent: "composed-outing", slot: "children",
    children: ["cinema", "restaurant-for-two"] },
  { key: "weekend-culture", label: "Week-end et musée", parent: "weekend-gite", slot: "activities",
    children: ["museum-exhibition"] },
  { key: "weekend-outdoors", label: "Week-end et randonnée", parent: "weekend-gite", slot: "activities",
    children: ["hiking-nature"] },
  { key: "games-basket", label: "Achat de jeux et accessoires", parent: "video-game-purchase", slot: null,
    children: [] },
  { key: "visit-and-activity", label: "Visite et activité", parent: "visit-friends", slot: "activities",
    children: ["museum-exhibition"] },
] as const satisfies readonly { key: string; label: string; parent: ComposerPresetKey; slot: string | null; children: readonly ComposerPresetKey[] }[];
export type ProjectStarter = typeof projectStarters[number];

const boardDrop = { kind: "BOARD_ZONE" } as const;
export function availableProjectStarters(model: ComposerUiModel) {
  return projectStarters.filter(starter => [starter.parent, ...starter.children].every(key =>
    model.dropCapabilities.some(cap => cap.sourceAssetKey === `template:${composerPreset(key)?.templateKey}`
      && cap.target.kind === "BOARD_ZONE" && cap.resolution !== "BLOCKED" && cap.semanticAction === "ADD_CONTEXT")));
}

/** Run the existing Composer evaluator against a private draft. The caller installs
 * only the final admitted state, so an incomplete template cannot reach autosave. */
export async function evaluateProjectStarter(starter: ProjectStarter, model: ComposerUiModel, transport: ComposerTransport,
  nextId: () => string, nextSequence: () => number) {
  let evaluated = model;
  const parentId = nextId();
  const drop = async (key: ComposerPresetKey, target: Extract<ComposerRequest, { kind: "DROP" }>["target"], identity: string) => {
    const preset = composerPreset(key);
    if (!preset) throw new Error("Intention indisponible pour ce modèle.");
    const sequence = nextSequence();
    const response = await transport({ kind: "DROP", assetKey: `template:${preset.templateKey}`, presetKey: key, target, identity,
      selectionId: nextId(), values: {}, sequence, targetMonth: model.semanticState.targetMonth, draft: evaluated.semanticState,
      ...(preset.templateKey === "purchase" ? { purchaseBasket: true } : {}) });
    if (!response.ok) throw new Error(response.message);
    if (response.sequence !== sequence || response.applied || response.applyReceipt
      || response.model.semanticState.targetMonth !== model.semanticState.targetMonth
      || response.model.board.draft.semanticStateDigest !== semanticStateDigest(response.model.semanticState)
      || !response.model.semanticState.contexts.some(context => context.contextOccurrenceId === identity
        && (context.parentContextOccurrenceId ?? null) === (target.contextOccurrenceId ?? null)
        && presetForContext(context)?.presetKey === key))
      throw new Error("La réponse ne correspond plus à ce projet.");
    evaluated = response.model;
  };
  await drop(starter.parent, boardDrop, parentId);
  if (starter.slot) {
    for (const child of starter.children) {
      await drop(child, { kind: "CONTEXT_SOCKET", contextOccurrenceId: parentId, slotKey: starter.slot }, nextId());
    }
  }
  return { model: evaluated, parentId };
}
