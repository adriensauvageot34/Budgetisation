export const merchantIdentityKinds = new Set([
  "commercial", "private_person", "personal_transfer_label", "unknown",
] as const);

export type MerchantIdentityKind = typeof merchantIdentityKinds extends Set<infer Kind> ? Kind : never;

export const merchantBadgePolicies = new Set(["normal", "reuse_only", "none"] as const);
export type MerchantBadgePolicy = typeof merchantBadgePolicies extends Set<infer Policy> ? Policy : never;

export function merchantBadgePolicy(value: unknown): MerchantBadgePolicy {
  return merchantBadgePolicies.has(value as MerchantBadgePolicy) ? value as MerchantBadgePolicy : "normal";
}

export function canCreateMerchantBadge(kind: MerchantIdentityKind, policy: MerchantBadgePolicy) {
  return policy === "normal" && !isPrivateMerchantKind(kind);
}

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
  DIGITAL: "Services numériques",
  SHOP: "Commerce général",
  CLOTHING: "Mode / vêtements",
  TRANSPORT: "Transports",
  TICKETS: "Événement / billetterie",
  ACTIVITY: "Loisirs",
  HOME: "Maison / bricolage",
  PUBLIC_SERVICES: "Services publics",
  INSURANCE: "Assurance",
  BANK: "Banque",
  ICE_CREAM: "Glacier",
  SPORT: "Sport",
  AUTOMOTIVE: "Automobile",
  UTILITIES: "Eau / énergie",
  PAYMENT: "Paiement / titres-restaurant",
  PHOTO: "Photo / impression",
  BEAUTY: "Beauté",
  TRAINING: "Formation",
  GARDEN: "Jardinerie",
  PARKING: "Parking",
  VAPE: "Vape",
  HOTEL: "Hébergement / hôtel",
  REAL_ESTATE: "Immobilier",
  CAR_RENTAL: "Location de voiture",
  TELECOM: "Télécommunications",
  TOURISM: "Voyage / tourisme",
  ASSOCIATION: "Association",
  BUTCHER: "Boucherie",
  CHEESE: "Fromagerie",
  PROFESSIONAL_SERVICES: "Services professionnels",
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
