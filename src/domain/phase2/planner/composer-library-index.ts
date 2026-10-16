import type { ComposerAssetView } from "./composer-contract";
import type { ComposerUiModel } from "./composer-ui-contract";
import { COMPOSER_PRESETS, type ComposerPreset } from "./composer-presets";

export const LIBRARY_CATEGORIES = [
  ["SOCIAL", "Sortir & faire la fête"], ["FOOD", "Manger & commander"],
  ["ACTIVITY", "Activités & loisirs"], ["PURCHASE", "Acheter"],
  ["BEAUTY", "Beauté & soins"], ["VISIT", "Voir un proche"],
  ["TRAVEL", "Week-ends & séjours"], ["HOME", "Maison & quotidien"],
  ["HEALTH", "Santé"], ["CAR", "Ma voiture"], ["OTHER", "Imprévus & autres"],
] as const;
const templateCategory: Readonly<Record<string,string>> = {
  "night-out":"SOCIAL", restaurant:"FOOD", "fast-food":"FOOD", delivery:"FOOD", activity:"ACTIVITY",
  purchase:"PURCHASE", "beauty-restock":"BEAUTY", "family-visit":"VISIT", "friend-visit":"VISIT",
  "short-stay":"TRAVEL", "home-project":"HOME", gift:"PURCHASE", "other-context":"OTHER",
};
const genericLabels: Readonly<Record<string,string>> = {
  "night-out":"Autre soirée", delivery:"Autre livraison", "fast-food":"Autre repas rapide", restaurant:"Restaurant libre",
  activity:"Autre activité", purchase:"Autre achat", gift:"Cadeau libre", "beauty-restock":"Autre soin",
  "family-visit":"Autre visite familiale", "friend-visit":"Autre visite amicale", "short-stay":"Autre séjour",
  "home-project":"Autre projet maison", "other-context":"Autre intention",
};
const beautyGroups: Readonly<Record<string,string>> = { mascara:"Maquillage", eyeliner:"Maquillage", "eyebrow-pencil":"Maquillage", "makeup-remover":"Maquillage", "hair-wax":"Cheveux", "care-lotion":"Autres soins" };
export function libraryPresetGroup(preset:ComposerPreset):string {
  if(preset.categoryKey==="PURCHASE") return "merchantLabel" in preset.defaults ? "Acheter chez…" : "Choisir un achat";
  if(preset.categoryKey==="BEAUTY") return beautyGroups[preset.presetKey]??"Visage";
  if(preset.categoryKey==="HOME") return "Consommables";
  return "";
}
export const normalizeLibrarySearch = (text:string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").replace(/[\p{P}\p{S}]+/gu," ").replace(/\s+/gu," ").trim();
export type LibraryIntention = Readonly<{ key:string; category:string; asset:ComposerAssetView; preset?:ComposerPreset; label:string; search:string; group:string }>;
/** Presentation index only. Admission, money and permissions remain server-owned. */
export function composerLibraryIndex(model:ComposerUiModel) {
  const templates = model.library.searchableAssets.filter(a=>a.kind==="CONTEXT_ASSET");
  const generic = templates.map(asset=>({key:asset.assetKey, category:templateCategory[asset.templateKey??""]??"OTHER", asset,
    label:genericLabels[asset.templateKey??""]??asset.label, group:"Intentions libres",
    search:normalizeLibrarySearch([asset.label,genericLabels[asset.templateKey??""]??"","libre personnaliser générique"].join(" "))}));
  const presets:LibraryIntention[] = COMPOSER_PRESETS.flatMap(preset=>{
    const asset=templates.find(a=>a.templateKey===preset.templateKey);
    if(!asset || !model.dropCapabilities.some(d=>d.sourceAssetKey===asset.assetKey && d.target.kind==="BOARD_ZONE" && d.resolution!=="BLOCKED")) return [];
    const group=libraryPresetGroup(preset);
    return [{key:"preset:"+preset.presetKey, category:preset.categoryKey, asset,preset,label:preset.label,group,
      search:normalizeLibrarySearch([preset.label,group,...preset.searchTerms].join(" "))}];
  });
  const controls=model.library.searchableAssets.filter(a=>a.kind==="PLAN_CONTROL" || a.kind==="RESERVATION_CONTROL");
  return { intentions:[...presets,...generic] as readonly LibraryIntention[], controls };
}
export function filterLibraryIntentions(items:readonly LibraryIntention[], query:string) {
  const normalized=normalizeLibrarySearch(query), terms=normalized.split(/\s+/u).filter(Boolean);
  const matched=items.filter(item=>terms.every(term=>item.search.includes(term)));
  if(!terms.length) return matched;
  const score=(item:LibraryIntention)=>{const label=normalizeLibrarySearch(item.label);return label===normalized?0:label.startsWith(normalized)?1:terms.every(term=>label.includes(term))?2:3;};
  return matched.sort((a,b)=>score(a)-score(b));
}

