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
  { key: "weekend-discovery", label: "Week-end culture et nature", parent: "weekend-gite", slot: "activities",
    children: ["museum-exhibition", "hiking-nature"] },
] as const satisfies readonly { key: string; label: string; parent: ComposerPresetKey; slot: string | null; children: readonly ComposerPresetKey[] }[];
export type ProjectStarter = typeof projectStarters[number];
export type ProjectStarterChoices = { label: string; children: readonly ComposerPresetKey[] };

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
  const children = choices?.children ?? starter.children;
  if ((choices && (!label || label.length > 120)) || new Set(children).size !== children.length
    || children.some(key => !(starter.children as readonly ComposerPresetKey[]).includes(key) || !projectPresetAvailable(model, key))
    || !availableProjectStarters(model).includes(starter))
    throw new Error("Ce modèle ou ses intentions ne sont plus disponibles. Rouvrez son aperçu.");
  let evaluated = model;
  const parentId = nextId();
  const base = model.proof;
  const drop = async (key: ComposerPresetKey, target: Extract<ComposerRequest, { kind: "DROP" }>["target"], identity: string) => {
    const preset = composerPreset(key);
    if (!preset) throw new Error("Intention indisponible pour ce modèle.");
    const sequence = nextSequence();
    const response = await transport({ kind: "DROP", assetKey: `template:${preset.templateKey}`, presetKey: key, target, identity,
      selectionId: nextId(), values: identity === parentId && label ? { label } : {}, sequence, targetMonth: model.semanticState.targetMonth, draft: evaluated.semanticState,
      ...(preset.templateKey === "purchase" ? { purchaseBasket: true } : {}) });
    if (!response.ok) throw new Error(response.message);
    if (response.sequence !== sequence || response.applied || response.applyReceipt
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
  if (starter.slot) {
    for (const child of children) {
      await drop(child, { kind: "CONTEXT_SOCKET", contextOccurrenceId: parentId, slotKey: starter.slot }, nextId());
    }
  }
  return { model: evaluated, parentId };
}
