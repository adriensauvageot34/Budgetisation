export const merchantIdentityKinds = new Set([
  "commercial", "private_person", "personal_transfer_label", "unknown",
] as const);

export type MerchantIdentityKind = typeof merchantIdentityKinds extends Set<infer Kind> ? Kind : never;

export const MERCHANT_GENERIC_BADGE_LABELS = {
  TOBACCO: "Tabac",
  BAKERY: "Boulangerie",
  PHARMACY: "Pharmacie",
  RESTAURANT: "Restaurant",
  GROCERIES: "Épicerie",
  BAR: "Bar",
  CAFE: "Café",
  INDIAN_RESTAURANT: "Restaurant indien",
  FLORIST: "Fleuriste",
  HEALTH: "Santé",
  GAS_STATION: "Station-service",
  SKI_RENTAL: "Location de ski",
  HAIRDRESSER: "Coiffure",
} as const;

export type MerchantGenericBadgeCategory = keyof typeof MERCHANT_GENERIC_BADGE_LABELS;
export const merchantGenericBadgeCategories = new Set(
  Object.keys(MERCHANT_GENERIC_BADGE_LABELS) as MerchantGenericBadgeCategory[],
);

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
