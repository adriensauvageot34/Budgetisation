import "server-only";

import type { HouseholdId } from "@/core/identity";
import { canCreateMerchantBadge, merchantBadgePolicy, merchantDisplayName, merchantGenericBadgeCategory } from "@/core/identity/merchant-kind";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { getCanonicalCommerceClient } from "./canonical";

type MerchantRow = {
  merchant_id: string;
  nom_canonique: string;
  identity_kind: "commercial" | "unknown";
  commercial_display_name: string | null;
  visual_brand_merchant_id: string | null;
  generic_badge_category: string | null;
  badge_policy: string;
};

export async function readMerchantBadgeCatalog(householdId: HouseholdId) {
  const client = await getCanonicalCommerceClient(householdId);
  const rows: MerchantRow[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("merchants")
      .select("merchant_id,nom_canonique,identity_kind,commercial_display_name,visual_brand_merchant_id,generic_badge_category,badge_policy")
      .in("identity_kind", ["commercial", "unknown"]).order("merchant_id").range(offset, offset + pageSize - 1);
    if (error || !data) throw new TypeError("BADGE_CATALOG_UNAVAILABLE");
    rows.push(...data as MerchantRow[]);
    if (data.length < pageSize) break;
  }
  const brands = new Set(rows.filter(row => row.identity_kind === "commercial" && !row.visual_brand_merchant_id
    && merchantBadgePolicy(row.badge_policy) === "normal").map(row => row.merchant_id));
  return rows.map(row => {
    const label = merchantDisplayName(row) ?? row.nom_canonique;
    const policy = merchantBadgePolicy(row.badge_policy);
    const published = row.identity_kind === "commercial" && commerceBadgeImages({
      identityKey: "merchant:" + row.merchant_id, policy,
      sharedKey: row.visual_brand_merchant_id && brands.has(row.visual_brand_merchant_id) ? "merchant:" + row.visual_brand_merchant_id : undefined,
      category: merchantGenericBadgeCategory(row.generic_badge_category),
    }).length > 0;
    return {
      id: row.merchant_id, label, canonicalLabel: row.nom_canonique, kind: row.identity_kind, policy, published,
      toIllustrate: canCreateMerchantBadge(row.identity_kind, policy) && !published,
    };
  }).sort((a, b) => a.label.localeCompare(b.label, "fr") || a.id.localeCompare(b.id));
}
