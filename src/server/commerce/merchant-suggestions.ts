import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantDisplayName } from "@/core/identity/merchant-kind";
import { clayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";
import type { BadgeLibraryRead, MerchantBadgeSuggestion } from "@/domain/phase2/commerce-media";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { readMerchantActivities } from "./merchant-activities";

const activitiesByVisual: Readonly<Record<string, readonly string[]>> = {
  activity: ["LEISURE"],
  bakery: ["BAKERY"],
  bar: ["BAR", "CAFE_BRASSERIE", "GAME_BAR", "TAPAS_BAR", "BAR_RESTAURANT"],
  beauty: ["COSMETICS"],
  bowling: ["BOWLING"],
  butcher: ["BUTCHER"],
  cafe: ["CAFE", "CAFE_BRASSERIE", "COFFEE", "CAFETERIA", "VENDING_COFFEE"],
  "canoe-kayak": ["KAYAK"],
  caterer: ["CATERING"],
  cheese: ["CHEESE"],
  clothing: ["FASHION"],
  cosmetics: ["COSMETICS"],
  delicatessen: ["FINE_GROCERY"],
  "digital-game-shop": ["GAMING"],
  electronics: ["ELECTRONICS"],
  "fast-food": ["FASTFOOD", "FOOD_TRUCK_ASIAN"],
  festival: ["EVENTS", "TICKETING"],
  florist: ["FLORIST"],
  "furniture-shop": ["FURNITURE"],
  garden: ["GARDEN"],
  greengrocer: ["FRESH_FOOD"],
  groceries: ["GROCERY", "SUPERMARKET", "HYPERMARKET", "FOOD_HALL", "FINE_GROCERY", "FRESH_FOOD"],
  hairdresser: ["HAIRDRESSER"],
  home: ["DIY", "FURNITURE"],
  hotel: ["HOTEL"],
  "household-shop": ["GENERAL_RETAIL", "DIY"],
  jewellery: ["JEWELRY", "WATCHES_JEWELRY", "WATCHES"],
  marketplace: ["MARKETPLACE"],
  "meal-delivery": ["DELIVERY"],
  museum: ["MUSEUM"],
  nightclub: ["NIGHTLIFE"],
  perfume: ["COSMETICS"],
  pharmacy: ["PHARMACY"],
  photo: ["PHOTO", "REPROGRAPHY"],
  pizzeria: ["PIZZA"],
  "professional-services": ["BUSINESS_SERVICES"],
  "pub-brasserie": ["BRASSERIE", "CAFE_BRASSERIE", "BAR_RESTAURANT"],
  restaurant: ["RESTAURANT", "ASIAN", "INDIAN", "PORTUGUESE_RESTAURANT", "BAR_RESTAURANT", "FOOD_TRUCK_ASIAN"],
  "shoe-shop": ["FASHION"],
  shop: ["GENERAL_RETAIL", "DEALS"],
  sport: ["SPORT_STORE", "FITNESS"],
  stadium: ["SPORT_EVENT"],
  takeaway: ["FASTFOOD", "FOOD_TRUCK_ASIAN"],
  tickets: ["TICKETING"],
  tobacco: ["TOBACCO"],
  "toy-shop": ["CHILDREN_RETAIL"],
  vape: ["VAPE"],
  "video-game-shop": ["GAMING"],
};

type Merchant = { merchant_id: string; nom_canonique: string; identity_kind: "commercial";
  commercial_display_name: string | null; activity_key: string };

export async function readMerchantSuggestions(client: SupabaseClient, rawKeys: unknown,
  readBadges: (keys: readonly string[]) => Promise<BadgeLibraryRead>): Promise<readonly MerchantBadgeSuggestion[]> {
  if (!Array.isArray(rawKeys) || rawKeys.length > 32) throw new TypeError("BADGE_SUGGESTIONS_INVALID");
  const activityKeys = new Set<string>();
  for (const key of rawKeys) {
    const asset = clayBadgeAsset(key);
    if (asset?.type !== "generic") throw new TypeError("BADGE_SUGGESTIONS_INVALID");
    for (const activity of activitiesByVisual[asset.key.slice("categories:".length)] ?? []) activityKeys.add(activity);
  }
  if (!activityKeys.size) return [];

  const merchants: Merchant[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("merchants")
      .select("merchant_id,nom_canonique,identity_kind,commercial_display_name,activity_key")
      .eq("identity_kind", "commercial").neq("badge_policy", "none").eq("activity_review_required", false)
      .in("activity_key", [...activityKeys]).order("merchant_id").range(offset, offset + pageSize - 1);
    if (error || !data) throw new TypeError("BADGE_LIBRARY_UNAVAILABLE");
    merchants.push(...data as Merchant[]);
    if (data.length < pageSize) break;
  }
  if (!merchants.length) return [];

  const usage = new Map<string, { count: number; lastDate: string }>();
  const ids = merchants.map(merchant => merchant.merchant_id);
  for (let start = 0; start < ids.length; start += 100) {
    const group = ids.slice(start, start + 100);
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from("operations").select("merchant_id,date_bancaire")
        .in("merchant_id", group).eq("flux", "Dépense").or("statut.is.null,statut.neq.Hors budget")
        .order("operation_id").range(offset, offset + pageSize - 1);
      if (error || !data) throw new TypeError("BADGE_LIBRARY_UNAVAILABLE");
      for (const row of data as { merchant_id: string; date_bancaire: string | null }[]) {
        const previous = usage.get(row.merchant_id);
        const date = row.date_bancaire ?? "";
        const lastDate = previous?.lastDate ?? "";
        usage.set(row.merchant_id, { count: (previous?.count ?? 0) + 1, lastDate: date > lastDate ? date : lastDate });
      }
      if (data.length < pageSize) break;
    }
  }

  const ranked = merchants.map(merchant => ({ merchant, label: merchantDisplayName(merchant) ?? merchant.nom_canonique,
    count: usage.get(merchant.merchant_id)?.count ?? 0, lastDate: usage.get(merchant.merchant_id)?.lastDate ?? "" }))
    .sort((left, right) => right.count - left.count || right.lastDate.localeCompare(left.lastDate)
      || left.label.localeCompare(right.label, "fr") || left.merchant.merchant_id.localeCompare(right.merchant.merchant_id));
  const activities = await readMerchantActivities(client, [...activityKeys]);
  const suggestions: MerchantBadgeSuggestion[] = [];
  for (let offset = 0; offset < ranked.length; offset += 100) {
    const group = ranked.slice(offset, offset + 100);
    const library = await readBadges(group.map(({ merchant }) => "merchant:" + merchant.merchant_id));
    for (const { merchant, label, count } of group) {
      const key = "merchant:" + merchant.merchant_id;
      const identity = library.merchants?.find(row => row.key === key);
      if (identity?.kind !== "commercial" || identity.policy === "none") continue;
      const personal = library.media.find(row => row.key === key);
      const shared = library.media.find(row => row.key === identity.visualKey);
      const image = commerceBadgeImages({ identityKey: key, sharedKey: identity.visualKey, policy: identity.policy,
        category: personal?.category ?? identity.genericCategory, personalSrc: personal?.imageUrl, sharedPersonalSrc: shared?.imageUrl })[0];
      suggestions.push({ key, label, policy: identity.policy, activity: activities.get(merchant.activity_key)?.label ?? "Commerce",
        purchaseCount: count, imageUrl: image?.src });
    }
  }
  return suggestions;
}
