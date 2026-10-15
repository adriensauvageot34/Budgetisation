import type { ComposerAssetView } from "./composer-contract";
import type { ComposerUiModel } from "./composer-ui-contract";
import { COMPOSER_PRESETS, type ComposerPreset } from "./composer-presets";

export const LIBRARY_CATEGORIES = [
  ["SOCIAL", "Sortir & faire la fête"], ["FOOD", "Manger & commander"],
  ["ACTIVITY", "Activités & loisirs"], ["PURCHASE", "Acheter"],
  ["BEAUTY", "Beauté & soins"], ["VISIT", "Voir un proche"],
  ["TRAVEL", "Partir & se déplacer"], ["HOME", "Maison & quotidien"],
  ["HEALTH", "Santé"], ["CAR", "Ma voiture"], ["OTHER", "Administratif & imprévus"],
] as const;
const templateCategory: Readonly<Record<string,string>> = {
  "night-out":"SOCIAL", restaurant:"FOOD", "fast-food":"FOOD", delivery:"FOOD", activity:"ACTIVITY",
  purchase:"PURCHASE", "beauty-restock":"BEAUTY", "family-visit":"VISIT", "friend-visit":"VISIT",
  "short-stay":"TRAVEL", "home-project":"HOME", gift:"PURCHASE", "other-context":"OTHER",
};
export const normalizeLibrarySearch = (text:string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
export type LibraryIntention = Readonly<{ key:string; category:string; asset:ComposerAssetView; preset?:ComposerPreset; label:string; search:string }>;
/** Presentation index only. Admission, money and permissions remain server-owned. */
export function composerLibraryIndex(model:ComposerUiModel) {
  const templates = model.library.searchableAssets.filter(a=>a.kind==="CONTEXT_ASSET");
  const generic = templates.map(asset=>({key:asset.assetKey, category:templateCategory[asset.templateKey??""]??"OTHER", asset,
    label:asset.label, search:normalizeLibrarySearch(asset.label)}));
  const presets:LibraryIntention[] = COMPOSER_PRESETS.flatMap(preset=>{
    const asset=templates.find(a=>a.templateKey===preset.templateKey);
    if(!asset || !model.dropCapabilities.some(d=>d.sourceAssetKey===asset.assetKey && d.target.kind==="BOARD_ZONE" && d.resolution!=="BLOCKED")) return [];
    return [{key:"preset:"+preset.presetKey, category:preset.categoryKey, asset,preset,label:preset.label,
      search:normalizeLibrarySearch([preset.label,...preset.searchTerms].join(" "))}];
  });
  const controls=model.library.searchableAssets.filter(a=>a.kind==="PLAN_CONTROL" || a.kind==="RESERVATION_CONTROL");
  return { intentions:[...presets,...generic] as readonly LibraryIntention[], controls };
}
export function filterLibraryIntentions(items:readonly LibraryIntention[], query:string) {
  const terms=normalizeLibrarySearch(query).trim().split(/\s+/u).filter(Boolean);
  return items.filter(item=>terms.every(term=>item.search.includes(term)));
}

