import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";

export function editorOccurrenceId(editor: {
  restaurantContextId?: string; stayContextId?: string; familyContextId?: string;
  nightContextId?: string; giftContextId?: string; catalogContextId?: string;
  equipment?: { target: { contextOccurrenceId?: string } };
} | null) {
  return editor?.restaurantContextId ?? editor?.stayContextId ?? editor?.familyContextId
    ?? editor?.nightContextId ?? editor?.giftContextId ?? editor?.catalogContextId ?? editor?.equipment?.target.contextOccurrenceId ?? null;
}

/** Shared by creation, reopening and preloading. Specializations use preset identity, not display names. */
export function assetEditorKind(templateKey: string | undefined, presetKey?: ComposerPresetKey) {
  switch (templateKey) {
    case "night-out": return presetKey === "bar-apero" ? "bar" : "night";
    case "family-visit": return "family";
    case "short-stay": return "stay";
    case "gift": return "gift";
    case "purchase":
    case "restaurant": return "restaurant";
    case "fast-food":
    case "delivery":
    case "activity":
      return presetKey ? "restaurant" : "catalog";
    default: return "catalog";
  }
}

export function assetEditorTarget(templateKey: string | undefined, id: string, presetKey?: ComposerPresetKey, creating = false) {
  switch (assetEditorKind(templateKey, presetKey)) {
    case "bar":
    case "night": return { nightContextId: id, nightCreating: creating };
    case "family": return { familyContextId: id };
    case "stay": return { stayContextId: id };
    case "gift": return { giftContextId: id };
    case "restaurant": return { restaurantContextId: id, restaurantCreating: creating };
    case "catalog": return { catalogContextId: id };
  }
}
