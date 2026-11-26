import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantBadgePolicy, merchantGenericBadgeCategory } from "@/core/identity/merchant-kind";
import type { MerchantBadgeSuggestion, PersonalBadge } from "@/domain/phase2/commerce-media";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";

type MerchantRow = { merchant_id: string; label: string; activity_key: string; activity: string;
  badge_policy: string; visual_brand_merchant_id: string | null; generic_badge_category: string | null; purchase_count: number };

export async function readMerchantSuggestions(
  client: SupabaseClient,
  readMedia: (keys?: readonly string[]) => Promise<readonly PersonalBadge[]>,
  selection?: { activities: ReadonlySet<string>; limit: number },
): Promise<readonly MerchantBadgeSuggestion[]> {
  const readRows = async () => {
    const { data, error } = await (selection
      ? client.rpc("composer_merchant_suggestions_v2", {
        p_activity_keys: [...selection.activities], p_limit: selection.limit,
      })
      : client.rpc("composer_merchant_suggestions"));
    if (error || !data) throw new TypeError("BADGE_LIBRARY_UNAVAILABLE");
    return data as MerchantRow[];
  };
  const rowsRead = readRows();
  const imagesRead = selection ? rowsRead.then(rows => readMedia([...new Set(rows.flatMap(row => [
    "merchant:" + row.merchant_id,
    ...(row.visual_brand_merchant_id ? ["merchant:" + row.visual_brand_merchant_id] : []),
  ]))])) : readMedia();
  const [rows, images] = await Promise.all([rowsRead, imagesRead]);
  const visuals = new Map(images.map(image => [image.key, image]));
  return rows.map(row => {
    const key = "merchant:" + row.merchant_id;
    const sharedKey = row.visual_brand_merchant_id ? "merchant:" + row.visual_brand_merchant_id : undefined;
    const policy = merchantBadgePolicy(row.badge_policy);
    const personal = visuals.get(key);
    const image = commerceBadgeImages({ identityKey: key, sharedKey, policy,
      category: personal?.category ?? merchantGenericBadgeCategory(row.generic_badge_category),
      personalSrc: personal?.imageUrl, sharedPersonalSrc: sharedKey ? visuals.get(sharedKey)?.imageUrl : undefined })[0];
    return { key, label: row.label, policy, activity: row.activity, activityKey: row.activity_key,
      purchaseCount: row.purchase_count, imageUrl: image?.src };
  });
}
