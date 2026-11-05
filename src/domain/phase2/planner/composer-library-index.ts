import type { ComposerAssetView } from "./composer-contract";
import type { ComposerUiModel } from "./composer-ui-contract";
import { COMPOSER_PRESETS, presetForContext, type ComposerPreset } from "./composer-presets";

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
export type LibraryOccurrence = Readonly<{ contextOccurrenceId:string; presetKey:string|null; label:string; search:string;
  plannedDate:string|null; action:"EDIT"|"VIEW" }>;
const situatedPresets = new Set(["mascara", "restaurant-for-two", "amazon-purchase"]);
const publishedPreset = (context:Parameters<typeof presetForContext>[0]) => {
  try{return presetForContext(context);}catch{return undefined;} // Unsupported metadata is never an exact identity.
};
/** Exact presentation identities in the displayed month, never a label/template guess. */
export function libraryOccurrences(model:ComposerUiModel): readonly LibraryOccurrence[] {
  if(model.board.targetMonth!==model.semanticState.targetMonth)return [];
  return model.board.contexts.flatMap(card=>{
    // An existing owner's reference can be found, never created or edited here.
    // The published asset and external identity qualify it; its title does not.
    const hairdresserReference=card.readOnly&&card.templateKey==="external-intent"&&!!card.externalIntentId
      &&card.contextOccurrenceId===`external:${card.externalIntentId}`&&Array.isArray(card.fields.costItems)
      &&card.fields.costItems.some(item=>item!==null&&typeof item==="object"&&!Array.isArray(item)&&item.assetKey==="beauty:hairdresser");
    const preset=publishedPreset(card);
    if(!hairdresserReference&&(!preset||!situatedPresets.has(preset.presetKey)))return [];
    const date=typeof card.fields.plannedDate==="string"?card.fields.plannedDate:null;
    if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(`${model.board.targetMonth}-`)
      ||!Number.isFinite(new Date(`${date}T12:00:00Z`).getTime())))return [];
    const context=model.semanticState.contexts.find(c=>c.contextOccurrenceId===card.contextOccurrenceId);
    const editable=!hairdresserReference&&!!preset&&!card.readOnly&&card.capabilityRefs.includes("PATCH_CONTEXT")&&context?.templateKey===card.templateKey
      &&publishedPreset(context)?.presetKey===preset.presetKey
      &&!model.semanticState.preferences.anchors.includes(card.contextOccurrenceId)
      &&model.semanticState.preferences.flexibility[card.contextOccurrenceId]!=="PRESERVE";
    return [{contextOccurrenceId:card.contextOccurrenceId,presetKey:hairdresserReference?null:preset!.presetKey,label:card.label,
      plannedDate:date,action:editable?"EDIT" as const:"VIEW" as const,
      search:normalizeLibrarySearch(hairdresserReference?`${card.label} Coiffeur prestation coiffure`
        :[card.label,preset!.label,libraryPresetGroup(preset!),...preset!.searchTerms].join(" "))}];
  });
}
export type LibrarySearchAction = Readonly<{kind:"OPEN";contextOccurrenceId:string}>|Readonly<{kind:"ADD";key:string}>|Readonly<{kind:"FOCUS"}>;
export function librarySearchAction(items:readonly LibraryIntention[], occurrences:readonly LibraryOccurrence[], query:string):LibrarySearchAction {
  if(occurrences.length===1)return {kind:"OPEN",contextOccurrenceId:occurrences[0].contextOccurrenceId};
  if(occurrences.length>1)return {kind:"FOCUS"};
  const exact=items.filter(item=>normalizeLibrarySearch(item.label)===normalizeLibrarySearch(query));
  const item=items.length===1?items[0]:exact.length===1?exact[0]:undefined;
  return item?{kind:"ADD",key:item.key}:{kind:"FOCUS"};
}
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
  return { intentions:[...presets,...generic] as readonly LibraryIntention[], controls, occurrences:libraryOccurrences(model) };
}
export function filterLibraryIntentions<T extends Readonly<{label:string;search:string}>>(items:readonly T[], query:string):T[] {
  const normalized=normalizeLibrarySearch(query), terms=normalized.split(/\s+/u).filter(Boolean);
  const matched=items.filter(item=>terms.every(term=>item.search.includes(term)));
  if(!terms.length) return matched;
  const score=(item:T)=>{const label=normalizeLibrarySearch(item.label);return label===normalized?0:label.startsWith(normalized)?1:terms.every(term=>label.includes(term))?2:3;};
  return matched.sort((a,b)=>score(a)-score(b));
}

