import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";

// A fulfilled promise is reused across focus, click and reopening. A rejected
// import is cleared so the open panel can explicitly retry without losing Draft.
function once<T>(importer: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => pending ??= importer().catch(error => { pending = undefined; throw error; });
}

export const editorChunks = {
  restaurant: once(async () => (await import("./restaurant-editor")).RestaurantEditor),
  family: once(async () => (await import("./family-visit-editor")).FamilyVisitEditor),
  stay: once(async () => (await import("./short-stay-editor")).ShortStayEditor),
  gift: once(async () => (await import("./gift-editor")).GiftEditor),
  catalog: once(async () => (await import("./catalog-context-editor")).CatalogContextEditor),
};

export type EditorChunkKind = keyof typeof editorChunks;
export type LoadedEditorChunks = { [K in EditorChunkKind]?: Awaited<ReturnType<(typeof editorChunks)[K]>> };

export function editorChunkForAsset(asset: ComposerAssetView): EditorChunkKind | null {
  if (asset.kind !== "CONTEXT_ASSET") return null;
  switch (asset.templateKey) {
    case "restaurant": return "restaurant";
    case "night-out": return null; // The frequent cold editor is in the entry.
    case "family-visit": return "family";
    case "short-stay": return "stay";
    case "gift": return "gift";
    default: return "catalog";
  }
}

export function preloadEditorForAsset(asset: ComposerAssetView) {
  const kind = editorChunkForAsset(asset);
  if (kind) void editorChunks[kind]().catch(() => { /* Open-panel retry owns the visible error. */ });
}
