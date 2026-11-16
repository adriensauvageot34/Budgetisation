export const merchantIdentityKinds = new Set([
  "commercial", "private_person", "personal_transfer_label", "unknown",
] as const);

export type MerchantIdentityKind = typeof merchantIdentityKinds extends Set<infer Kind> ? Kind : never;

export const merchantGenericBadgeCategories = new Set(["BAKERY", "BAR", "HAIRDRESSER"] as const);
export type MerchantGenericBadgeCategory = typeof merchantGenericBadgeCategories extends Set<infer Category> ? Category : never;

export function merchantDisplayName(row: { identity_kind?: unknown; commercial_display_name?: unknown }): string | undefined {
  return row.identity_kind === "commercial" && typeof row.commercial_display_name === "string"
    ? row.commercial_display_name.trim() || undefined
    : undefined;
}

export function merchantGenericBadgeCategory(value: unknown): MerchantGenericBadgeCategory | undefined {
  return merchantGenericBadgeCategories.has(value as MerchantGenericBadgeCategory)
    ? value as MerchantGenericBadgeCategory : undefined;
}

export function isPrivateMerchantKind(value: unknown): value is "private_person" | "personal_transfer_label" {
  return value === "private_person" || value === "personal_transfer_label";
}
