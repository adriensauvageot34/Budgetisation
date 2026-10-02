/** Presentation grammar. Canonical eligibility, money, routes and readiness stay in their domain owners. */
import Big from "big.js";
import { PLANNED_SUBTYPE_LABELS, type AssetModule, type PlannedExpenseFamily, type PlannedAsset } from "./planned-assets";
import type { PlannedExpenseDraft, PlannedExpenseContext, PlannedWalletOption } from "./planned-contract";
import type { CostItem, FundingAllocation } from "./planned-contract";
import { costItemCashTreatment } from "./planned-money";
import { prospectivePersonLabel } from "./planned-product";
import type { PlannedPlaceOption } from "./planned-places";
import { restaurantTitle } from "./planned-restaurant";

export type BuilderIntent = "restaurant" | "fast_food" | "work_meal" | "groceries" | "party" | "visit" | "activity" | "purchase" | "trip";
export const BUILDER_INTENTS: readonly { key: BuilderIntent; label: string; hint: string; icon: string; tint: string; family: PlannedExpenseFamily; subtype: string | null }[] = [
  { key: "restaurant", label: "Restaurant", hint: "Une table, un moment ensemble", icon: "Utensils", tint: "orange", family: "food", subtype: "restaurant" },
  { key: "fast_food", label: "Fast-food / snack", hint: "Sur place, à emporter ou livré", icon: "Sandwich", tint: "amber", family: "food", subtype: "fast_food" },
  { key: "work_meal", label: "Repas au travail", hint: "Un repas pour votre journée", icon: "BriefcaseBusiness", tint: "sky", family: "food", subtype: "work_meal" },
  { key: "groceries", label: "Courses", hint: "Le quotidien ou un repas spécial", icon: "ShoppingBasket", tint: "emerald", family: "food", subtype: "groceries" },
  { key: "party", label: "Soirée", hint: "Un bar, une soirée, un événement", icon: "PartyPopper", tint: "violet", family: "outing", subtype: null },
  { key: "visit", label: "Voir quelqu’un", hint: "Des proches et du temps ensemble", icon: "UsersRound", tint: "rose", family: "visit_trip", subtype: "friend_visit" },
  { key: "activity", label: "Activité", hint: "Une sortie qui vous fait envie", icon: "Ticket", tint: "cyan", family: "activity", subtype: null },
  { key: "purchase", label: "Achat", hint: "Un objet, un produit, un cadeau", icon: "ShoppingBag", tint: "pink", family: "purchase", subtype: null },
  { key: "trip", label: "Voyage / déplacement", hint: "Un séjour ou un aller-retour", icon: "Luggage", tint: "indigo", family: "visit_trip", subtype: "trip_stay" },
];
export function intentForDraft(draft: Pick<PlannedExpenseDraft, "familyKey" | "subtypeKey">): BuilderIntent {
  if (draft.familyKey === "food") return draft.subtypeKey as BuilderIntent;
  if (draft.familyKey === "visit_trip") return ["family_visit", "friend_visit"].includes(draft.subtypeKey ?? "") ? "visit" : "trip";
  return ({ outing: "party", activity: "activity", purchase: "purchase", other: "purchase" } as const)[draft.familyKey];
}
export const PARTY_CHOICES = [{ key: "bar", label: "Bar / apéro" }, { key: "club_festival", label: "Club / boîte" },
  { key: "house_party", label: "Soirée privée" }, { key: "EVENT", label: "Festival / événement" }] as const;
export const PURCHASE_CHOICES = PLANNED_SUBTYPE_LABELS.purchase.filter((part) => part.key !== "household")
  .map((part) => ({ ...part, label: part.key === "beauty" ? "Beauté / produits de soin" : part.key === "automotive" ? "Équipement automobile" : part.label }));
const withLowerRelation = (label: string) => /^(Père|Mère|Grand)/u.test(label) ? `le ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label;
export function projectPlaceLabel(context: PlannedExpenseContext, places: readonly PlannedPlaceOption[]): string {
  if (context.housePartyPlaceMode === "OWN_HOME") return "Domicile";
  const ref = context.place;
  return ref?.kind === "TEXT" ? ref.label : ref?.kind === "KNOWN" ? places.find((part) => part.placeId === ref.placeId)?.name ?? "" : "";
}
type TitleFacts = { draft: PlannedExpenseDraft; personName?: string; place: string; contact: string; merchant: string };
/** Exactly one title template per entry point; event access converges on one template. */
export const PROJECT_TITLE_TEMPLATES: Record<BuilderIntent, (facts: TitleFacts) => string> = {
  restaurant: ({ draft, place }) => restaurantTitle(draft, place),
  fast_food: ({ draft, merchant, place }) => `${merchant || place || "Fast-food"}${draft.context.companionMode === "SOLO" ? " en solo" : draft.context.companionMode === "COUPLE" ? " à deux" : ""}`,
  work_meal: ({ personName }) => personName ? `Repas au travail de ${personName}` : "Repas au travail",
  groceries: ({ draft, merchant }) => `${draft.context.groceriesNature === "TOP_UP" ? "Petites courses" : "Courses"}${merchant ? ` ${merchant}` : ""}`,
  party: ({ draft, place, contact }) => draft.context.outingKind === "EVENT" ? draft.context.eventName || "Festival / événement"
    : draft.subtypeKey === "house_party" ? draft.context.housePartyPlaceMode === "OTHER_HOME" ? `Soirée chez ${withLowerRelation(contact || "des proches")}` : "Soirée chez nous"
      : draft.subtypeKey === "bar" ? place ? `Sortie au ${place}` : "Sortie au bar" : place ? `Soirée au ${place}` : "Soirée en club",
  visit: ({ draft, contact }) => draft.context.socialOccasion === "CHRISTMAS" ? `Noël chez ${withLowerRelation(contact || "des proches")}`
    : draft.context.socialOccasion === "BIRTHDAY" ? `Anniversaire de ${contact || "notre proche"}` : `Voir ${withLowerRelation(contact || "un proche")}`,
  activity: ({ draft, place }) => `${PLANNED_SUBTYPE_LABELS.activity.find((part) => part.key === draft.subtypeKey)?.label || "Activité"}${place ? ` · ${place}` : ""}`,
  purchase: ({ draft }) => draft.subtypeKey === "gift" ? `Cadeau${draft.context.socialOccasion === "BIRTHDAY" ? " d’anniversaire" : draft.context.socialOccasion === "CHRISTMAS" ? " de Noël" : ""}${draft.context.gift?.recipient ? ` pour ${draft.context.gift.recipient}` : ""}`
    : draft.context.purchaseDescription || PURCHASE_CHOICES.find((part) => part.key === draft.subtypeKey)?.label || "Achat",
  trip: ({ draft, place }) => `${draft.subtypeKey === "other_trip" ? "Déplacement" : "Séjour"}${place ? ` à ${place}` : ""}`,
};
export function deriveProjectTitle(draft: PlannedExpenseDraft, places: readonly PlannedPlaceOption[], personName?: string): string {
  const intent = intentForDraft(draft), c = draft.context, entity = c.project?.entity;
  let title = PROJECT_TITLE_TEMPLATES[intent]({ draft, personName, place: projectPlaceLabel(c, places),
    contact: prospectivePersonLabel(c.host ?? c.personVisited) ?? "", merchant: c.seller ?? entity?.label ?? "" });
  if (c.project?.version === 2) {
    if (intent === "activity" && entity) title = entity.label;
    if (intent === "trip") title = `${c.project.tripKind === "PUNCTUAL" ? "Déplacement" : "Séjour"}${entity?.label ? ` à ${entity.label}` : ""}`;
    if (c.socialOccasion && c.socialOccasion !== "NONE" && ["restaurant", "party", "groceries"].includes(intent)) {
      const occasion = c.occasionLabel || ({ BIRTHDAY: "Anniversaire", CHRISTMAS: "Noël", CELEBRATION: "Célébration", OTHER_SPECIAL: "Occasion spéciale" } as const)[c.socialOccasion];
      title = `${occasion}${entity ? ` · ${entity.label}` : intent === "groceries" ? " · courses" : intent === "restaurant" ? " au restaurant" : c.housePartyPlaceMode === "OWN_HOME" ? " chez nous" : ""}`;
    }
  }
  return title.slice(0, 120);
}
export const detailActionLabel = (module: AssetModule) => (({ restaurant: "Détailler la note", groceries: "Détailler le panier",
  fast_food: "Détailler la commande", work_meal: "Détailler le repas", trip: "Détailler le séjour" } as Record<string, string>)[module] ?? "Préciser les éléments");
export function uxAssetGroup(asset: PlannedAsset): string {
  if (asset.module === "trip") return ["rental_car", "rental_scooter"].includes(asset.assetKey.split(":")[1]!) ? "TRANSPORT"
    : asset.assetKey === "trip:breakfast" ? "REPAS" : "AUTRES";
  if (asset.module === "groceries") return ["hygiene", "cleaning"].includes(asset.assetKey.split(":")[1]!) ? "MAISON" : "ALIMENTATION";
  if (asset.module === "household") return "MAISON";
  if (/wine|beer|cocktail|shot|vodka|rum|alcohol/u.test(asset.assetKey)) return "ALCOOL";
  if (/soft|water|coffee|drink|mixer|crazy_tiger/u.test(asset.assetKey)) return "BOISSONS";
  if (/ticket|entry|cloakroom/u.test(asset.assetKey)) return "ACCÈS";
  return ["restaurant", "fast_food", "work_meal"].includes(asset.module) ? "REPAS" : "À PRÉVOIR";
}
export function visibleUxAssets(assets: readonly PlannedAsset[], context: PlannedExpenseContext): readonly PlannedAsset[] {
  const hidden = new Set(["restaurant:meal_total", "restaurant:alcohol_total", "groceries:food", "groceries:special_meal",
    "work_meal:bakery", "work_meal:mcdo", "work_meal:grand_frais", "fast_food:thai", "fast_food:kebab", "fast_food:sandwich",
    "beauty:hairdresser", "automotive:wash", "activity:entry", "fast_food:meal_total", "trip:flight", "trip:hotel", "trip:airbnb", "trip:visits"]);
  const focus = context.project?.groceryFocus;
  return assets.filter((asset) => (!focus || focus === "OTHER" || asset.module !== "groceries"
    || (focus === "HYGIENE" ? asset.assetKey === "groceries:hygiene" : focus === "CLEANING" ? asset.assetKey === "groceries:cleaning"
      : focus === "DRINKS" ? asset.assetKey === "groceries:drinks" : !["groceries:hygiene", "groceries:cleaning"].includes(asset.assetKey)))
    && !hidden.has(asset.assetKey) && (!/domino/iu.test(context.seller ?? "")
    || asset.module !== "fast_food" || ["fast_food:pizza", "fast_food:fries", "fast_food:drink", "fast_food:dessert", "fast_food:water"].includes(asset.assetKey)));
}
export function compatibleWallets(wallets: readonly PlannedWalletOption[], context: PlannedExpenseContext, workMeal: boolean): readonly PlannedWalletOption[] {
  const owners = context.project?.financialScope?.personIds ?? context.participantPersonIds;
  return wallets.filter((wallet) => !(workMeal || context.project?.version === 2)
    || !!wallet.ownerPersonId && !!owners?.includes(wallet.ownerPersonId));
}
export function plausibleTransportModes(draft: PlannedExpenseDraft, _places: readonly PlannedPlaceOption[]): readonly string[] {
  // No city-name guess: trips suggest Train; an existing explicit Train choice remains editable.
  const longDistance = intentForDraft(draft) === "trip" || draft.context.transportMode === "TRAIN";
  return ["CAR", ...(longDistance ? ["TRAIN"] : []), ...(intentForDraft(draft) === "trip" ? ["PLANE"] : []), "BUS", "TAXI", "OTHER"];
}
export const localCostGross = (quantity: string, amount: string): string | null => {
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u.test(quantity) || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(amount)) return null;
  const gross = new Big(quantity).times(amount).round(2);
  return new Big(quantity).gt(0) && new Big(amount).gt(0) && gross.gte("0.01") ? gross.toFixed(2) : null;
};
export function walletAllocation(gross: string | null, source: "SWILE" | "EDENRED" | "", amount: string): readonly FundingAllocation[] | undefined | null {
  if (!source) return undefined;
  if (!gross || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(amount)) return null;
  const value = new Big(amount), total = new Big(gross);
  if (value.lte(0) || value.gt(total)) return null;
  return [{ source, amount: value.toFixed(2) }, ...(value.lt(total) ? [{ source: "BANK" as const, amount: total.minus(value).toFixed(2) }] : [])];
}
export function draftSummary(items: readonly CostItem[]) {
  const sums = { gross: new Big(0), bank: new Big(0), swile: new Big(0), edenred: new Big(0), fuel: new Big(0) };
  for (const item of items) {
    const amount = localCostGross(item.quantity, item.unitAmount);
    if (!amount) continue;
    sums.gross = sums.gross.plus(amount);
    if (costItemCashTreatment(item) === "ECONOMIC_ONLY") { sums.fuel = sums.fuel.plus(amount); continue; }
    if (!item.fundingAllocations?.length) sums.bank = sums.bank.plus(amount);
    for (const part of item.fundingAllocations ?? []) if (/^\d+(?:\.\d{1,2})?$/u.test(part.amount)) {
      const source = part.source.toLowerCase() as "bank" | "swile" | "edenred";
      sums[source] = sums[source].plus(part.amount);
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, value.toFixed(2)])) as Record<keyof typeof sums, string>;
}
