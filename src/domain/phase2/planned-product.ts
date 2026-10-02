import { assetsForModule, plannedAsset, type AssetModule, type PlannedAsset, type PlannedExpenseFamily } from "./planned-assets";
import type { CostItem, PlannedExpenseContext, ProspectivePersonRef } from "./planned-contract";
import { BRING_ITEMS_LENS, FISHING_ASSET_LENS, SOCIAL_CONTACTS_V1, type ResolvedPlannedContext } from "./planned-rules";

/** Product entry points, separate from the complete persisted taxonomy. */
export const PLANNED_INTENTS: readonly { label: string; family: PlannedExpenseFamily; subtype: string | null; choices?: readonly string[] }[] = [
  { label: "Restaurant", family: "food", subtype: "restaurant" },
  { label: "Fast-food / snack", family: "food", subtype: "fast_food" },
  { label: "Repas au travail", family: "food", subtype: "work_meal" },
  { label: "Courses", family: "food", subtype: "groceries" },
  { label: "Soirée", family: "outing", subtype: null },
  { label: "Voir quelqu’un", family: "visit_trip", subtype: null, choices: ["family_visit", "friend_visit"] },
  { label: "Voyage / déplacement", family: "visit_trip", subtype: null, choices: ["trip_stay", "other_trip"] },
  { label: "Activité", family: "activity", subtype: null },
  { label: "Achat", family: "purchase", subtype: null },
  { label: "Autre", family: "other", subtype: null },
];
export const prospectivePersonIdentity = (ref: ProspectivePersonRef): string => ref.kind === "HOUSEHOLD_PERSON"
  ? `person:${ref.personId}` : ref.kind === "CONTACT" ? `contact:${ref.contactKey}` : `text:${ref.label.trim().toLocaleLowerCase("fr")}`;
export const prospectivePersonLabel = (ref: ProspectivePersonRef | undefined): string | undefined =>
  ref?.kind === "TEXT" ? ref.label : ref?.kind === "CONTACT" ? SOCIAL_CONTACTS_V1.find((c) => c.key === ref.contactKey)?.label : undefined;
export function plannedParticipantCount(context: PlannedExpenseContext): number {
  const identities = new Set((context.participantPersonIds ?? []).map((id) => `person:${id}`));
  for (const ref of context.participantRefs ?? []) if (ref.kind !== "TEXT" || ref.label.trim()) identities.add(prospectivePersonIdentity(ref));
  if (context.hostParticipates && context.host) identities.add(prospectivePersonIdentity(context.host));
  if (context.visitedPersonParticipates && context.personVisited) identities.add(prospectivePersonIdentity(context.personVisited));
  return identities.size + (context.additionalGuestCount ?? 0);
}
export const assetParticipantCount = (asset: PlannedAsset, context: PlannedExpenseContext): number => asset.module === "transport"
  ? context.travellingParticipantPersonIds?.length ?? context.project?.financialScope?.count ?? plannedParticipantCount(context)
  : context.project?.financialScope?.count ?? plannedParticipantCount(context);
// Read compatibility for old rows only. All new selection happens through root Transport.
export const LEGACY_TRANSPORT_ASSETS = ["restaurant:uber", "restaurant:parking", "bar:parking", "club:uber_out", "club:uber_back", "club:parking"] as const;
export const isTransportCost = (item: Pick<CostItem, "assetKey">) => plannedAsset(item.assetKey ?? "")?.module === "transport"
  || (LEGACY_TRANSPORT_ASSETS as readonly string[]).includes(item.assetKey ?? "");
export const costAllowsBaseline = (item: Pick<CostItem, "assetKey">) => !isTransportCost(item)
  && !item.assetKey?.endsWith(":delivery_fee") && !item.assetKey?.endsWith(":service_fee");
export const transportAssetMatchesMode = (key: string, mode: PlannedExpenseContext["transportMode"]): boolean =>
  ({ CAR: ["transport:fuel_usage", "transport:toll", "transport:parking"], TRAIN: ["transport:train"],
    BUS: ["transport:bus"], TAXI: ["transport:uber"], CARPOOL: ["transport:carpool"],
    OTHER: ["transport:other"], PLANE: ["transport:flight"], FREE: [] } as Record<string, readonly string[]>)[mode ?? ""]?.includes(key) ?? false;
export const isRootCost = (item: CostItem) => item.modulePath?.length !== 2 && !isTransportCost(item)
  && (!(item.modulePath?.[0] === "visit_family" || item.modulePath?.[0] === "visit_friend")
    || !Object.values(BRING_ITEMS_LENS).some((keys) => (keys as readonly string[]).includes(item.assetKey ?? "")))
  && (!item.assetKey || !item.modulePath || plannedAsset(item.assetKey)?.module === item.modulePath[0])
  && !item.assetKey?.endsWith(":delivery_fee") && !item.assetKey?.endsWith(":service_fee");
export function builderAssetChoices(resolved: ResolvedPlannedContext, module: AssetModule, context: PlannedExpenseContext,
  lens: "MODULE" | "BRING_ITEMS" = "MODULE"): readonly PlannedAsset[] {
  if (lens === "BRING_ITEMS") return resolved.bringItems === "FORBIDDEN" ? [] : BRING_ITEMS_LENS[context.visitFormat ?? "SIMPLE"].map((key) => plannedAsset(key)!);
  if (module === "other" && resolved.familyKey !== "other") return [];
  return [...assetsForModule(module), ...(module === "activity" && resolved.subtypeKey === "fishing" ? FISHING_ASSET_LENS.map((key) => plannedAsset(key)!) : [])]
    .filter((asset) => !(LEGACY_TRANSPORT_ASSETS as readonly string[]).includes(asset.assetKey)
      && asset.assetKey !== "transport:fuel_usage"
      && (!asset.assetKey.endsWith(":delivery_fee") && !asset.assetKey.endsWith(":service_fee")
        || context.purchaseMode === "ONLINE" || context.purchaseMode === "DELIVERY"));
}
export const baselineQuestion = (module: AssetModule) => module === "restaurant" || module === "fast_food"
  ? "Ce repas est-il prévu en plus de vos sorties habituelles ?" : module === "groceries"
    ? "Ces courses sont-elles en plus de votre budget habituel ?" : "Ce repas est-il en plus de vos repas habituels au travail ?";
