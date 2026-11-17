import { merchantBadgePolicy, merchantGenericBadgeCategory, type MerchantGenericBadgeCategory } from "./merchant-kind";

export type MerchantActivity = Readonly<{
  label: string;
  sector: string;
  badgeCategory?: MerchantGenericBadgeCategory;
}>;

type MerchantActivityReference = {
  activity_key?: unknown;
  activity_review_required?: unknown;
};

export function referencedMerchantActivities(rows: readonly MerchantActivityReference[]): string[] {
  return [...new Set(rows.flatMap(row => typeof row.activity_key === "string" ? [row.activity_key] : []))];
}

export function indexMerchantActivities(rows: readonly {
  activity_key?: unknown; label?: unknown; sector?: unknown; badge_category?: unknown;
}[]) {
  return new Map<string, MerchantActivity>(rows.flatMap(row =>
    typeof row.activity_key === "string" && typeof row.label === "string" && typeof row.sector === "string"
      ? [[row.activity_key, { label: row.label, sector: row.sector, badgeCategory: merchantGenericBadgeCategory(row.badge_category) }]]
      : [],
  ));
}

export function merchantActivityFor(row: MerchantActivityReference, activities: ReadonlyMap<string, MerchantActivity>) {
  return typeof row.activity_key === "string" ? activities.get(row.activity_key) : undefined;
}

export function merchantBadgeCategoryFor(row: MerchantActivityReference & {
  identity_kind?: unknown; badge_policy?: unknown; generic_badge_category?: unknown;
}, activities: ReadonlyMap<string, MerchantActivity>) {
  if (row.identity_kind !== "commercial" || merchantBadgePolicy(row.badge_policy) === "none") return undefined;
  const override = merchantGenericBadgeCategory(row.generic_badge_category);
  if (override || row.activity_review_required === true) return override;
  return merchantActivityFor(row, activities)?.badgeCategory;
}
