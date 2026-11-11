import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { assetEditorKind } from "./asset-editor-routing";

// A fulfilled promise is reused across focus, click and reopening. A rejected
// import is cleared so the open panel can explicitly retry without losing Draft.
function once<T>(importer: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => pending ??= importer().catch(error => { pending = undefined; throw error; });
}

export const editorChunks = {
  bar: once(async () => (await import("./bar-living-editor")).BarLivingEditor),
  night: once(async () => (await import("./night-out-editor")).NightOutEditor),
  restaurant: once(async () => (await import("./restaurant-editor")).RestaurantEditor),
  family: once(async () => (await import("./family-visit-editor")).FamilyVisitEditor),
  stay: once(async () => (await import("./short-stay-editor")).ShortStayEditor),
  gift: once(async () => (await import("./gift-editor")).GiftEditor),
  catalog: once(async () => (await import("./catalog-context-editor")).CatalogContextEditor),
};

export type EditorChunkKind = keyof typeof editorChunks;
export type LoadedEditorChunks = { [K in EditorChunkKind]?: Awaited<ReturnType<(typeof editorChunks)[K]>> };

export function preloadEditorForAsset(asset: ComposerAssetView, presetKey?: ComposerPresetKey) {
  if (asset.kind !== "CONTEXT_ASSET") return;
  void editorChunks[assetEditorKind(asset.templateKey, presetKey)]().catch(() => { /* Open-panel retry owns the visible error. */ });
}
