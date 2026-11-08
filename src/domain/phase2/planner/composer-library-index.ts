import type { ComposerAssetView, ComposerContextCardView } from "./composer-contract";
import type { ComposerUiModel } from "./composer-ui-contract";
import type { PlannerJsonObject } from "./json";
import { COMPOSER_PRESETS, presetForContext, type ComposerPreset } from "./composer-presets";
import { canonicalPlannerJson } from "./json";
import { componentId } from "./identity";
import type { PlannedContextState } from "./semantic-state";
import type { ComponentSelectionV1 } from "./component-contract";

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
const clothingPresets = new Set(["clothing-shopping", "shein-purchase", "shoes-purchase"]);
const situatedPresets = new Set(["mascara", "restaurant-for-two", "amazon-purchase", ...clothingPresets]);
const publishedPreset = (context:Parameters<typeof presetForContext>[0]) => {
  try{return presetForContext(context);}catch{return undefined;} // Unsupported metadata is never an exact identity.
};
/** Published purchase presentation, never an inference from an article or merchant name. */
export const isClothingPurchase = (context?: Pick<PlannedContextState, "templateKey" | "fields">) => !!context
  && context.templateKey === "purchase" && context.fields.budgetDomain === "clothing"
  && clothingPresets.has(publishedPreset(context)?.presetKey ?? "");
export const clothingItem = (context: Pick<PlannedContextState, "slotSelections">) => {
  const items = (context.slotSelections.item?.items ?? []) as readonly ComponentSelectionV1[];
  return items.length === 1 && items[0].kind === "COMPONENT" && items[0].optionKey === "item" ? items[0] : undefined;
};
/** Presentation admission only; EDIT_PRESET_CONTEXT and the Compiler retain authority. */
export function clothingItemWritable(model: ComposerUiModel, context: PlannedContextState, card: ComposerContextCardView) {
  const id = context.contextOccurrenceId, item = clothingItem(context), preset = publishedPreset(context);
  const locked = (ref: string) => model.semanticState.preferences.anchors.includes(ref) || model.semanticState.preferences.flexibility[ref] === "PRESERVE";
  const socket = card.sockets.find(s => s.contextOccurrenceId === id && s.slotKey === "item");
  const assetKey = "option:purchase:item:item";
  return !!item && isClothingPurchase(context) && isClothingPurchase(card) && publishedPreset(card)?.presetKey === preset?.presetKey
    && card.contextOccurrenceId === id && card.parentContextOccurrenceId === (context.parentContextOccurrenceId ?? null)
    && card.externalIntentId === null && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT")
    && model.board.targetMonth === model.semanticState.targetMonth
    && canonicalPlannerJson(model.semanticState.contexts.find(c => c.contextOccurrenceId === id) ?? null) === canonicalPlannerJson(context)
    && !locked(id) && !locked(componentId(id, "item", item.selectionId))
    && socket?.cardinality === "REQUIRED_ONE" && socket.capabilityRefs.includes("purchase:item:SELECT_COMPONENT")
    && !!socket.choiceAssetKeys?.includes(assetKey)
    && model.library.searchableAssets.some(asset => asset.assetKey === assetKey && asset.optionKind === "COMPONENT")
    && model.dropCapabilities.some(drop => drop.sourceAssetKey === assetKey && drop.target.kind === "CONTEXT_SOCKET"
      && drop.target.contextOccurrenceId === id && drop.target.slotKey === "item" && drop.resolution !== "BLOCKED" && drop.semanticAction === "PATCH_CONTEXT");
}
export function hairdresserReferenceLines(card:ComposerContextCardView): readonly PlannerJsonObject[] {
  return Array.isArray(card.fields.costItems) ? card.fields.costItems.filter((item):item is PlannerJsonObject=>item!==null
    && typeof item==="object" && !Array.isArray(item) && item.assetKey==="beauty:hairdresser") : [];
}
/** A visible owner's typed reference, never a title-based service or booking. */
export function isHairdresserReference(model:ComposerUiModel, card:ComposerContextCardView):boolean {
  const date=card.fields.plannedDate;
  return model.board.targetMonth===model.semanticState.targetMonth && card.readOnly && card.templateKey==="external-intent"
    && !!card.externalIntentId && card.contextOccurrenceId===`external:${card.externalIntentId}`
    && !model.semanticState.preferences.anchors.includes(card.contextOccurrenceId)
    && model.semanticState.preferences.flexibility[card.contextOccurrenceId]!=="PRESERVE"
    && (date==null || typeof date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && date.startsWith(`${model.board.targetMonth}-`) && Number.isFinite(Date.parse(`${date}T12:00:00Z`))
      && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date)
    && hairdresserReferenceLines(card).length>0;
}
/** Exact presentation identities in the displayed month, never a label/template guess. */
export function libraryOccurrences(model:ComposerUiModel): readonly LibraryOccurrence[] {
  if(model.board.targetMonth!==model.semanticState.targetMonth)return [];
  return model.board.contexts.flatMap(card=>{
    // An existing owner's reference can be found, never created or edited here.
    // The published asset and external identity qualify it; its title does not.
    const hairdresserReference=isHairdresserReference(model,card);
    const preset=publishedPreset(card);
    if(!hairdresserReference&&(!preset||!situatedPresets.has(preset.presetKey)))return [];
    const date=typeof card.fields.plannedDate==="string"?card.fields.plannedDate:null;
    if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(`${model.board.targetMonth}-`)
      ||!Number.isFinite(new Date(`${date}T12:00:00Z`).getTime())))return [];
    const context=model.semanticState.contexts.find(c=>c.contextOccurrenceId===card.contextOccurrenceId);
    if(preset&&clothingPresets.has(preset.presetKey)&&(!isClothingPurchase(card)||!context||!isClothingPurchase(context)
      ||publishedPreset(context)?.presetKey!==preset.presetKey))return [];
    const clothing=isClothingPurchase(card), article=context&&clothing?clothingItem(context):undefined;
    const productLabel=clothing&&typeof card.fields.productLabel==="string"?card.fields.productLabel:"";
    const editable=!hairdresserReference&&!!preset&&!card.readOnly&&card.capabilityRefs.includes("PATCH_CONTEXT")&&context?.templateKey===card.templateKey
      &&publishedPreset(context)?.presetKey===preset.presetKey
      &&!model.semanticState.preferences.anchors.includes(card.contextOccurrenceId)
      &&model.semanticState.preferences.flexibility[card.contextOccurrenceId]!=="PRESERVE"
      &&(!clothing||clothingItemWritable(model,context,card));
    return [{contextOccurrenceId:card.contextOccurrenceId,presetKey:hairdresserReference?null:preset!.presetKey,label:article?`${article.label} · ${productLabel||card.label}`:card.label,
      plannedDate:date,action:editable?"EDIT" as const:"VIEW" as const,
      search:normalizeLibrarySearch(hairdresserReference?`${card.label} Coiffeur prestation coiffure ${card.components
        .filter(item=>item.assetKey==="beauty:hairdresser").map(item=>item.label).join(" ")}`
        :[card.label,preset!.label,libraryPresetGroup(preset!),...preset!.searchTerms,...(clothing?[productLabel]:[]),...(article?[article.label]:[])].join(" "))}];
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

