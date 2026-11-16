export const merchantIdentityKinds = new Set([
  "commercial", "private_person", "personal_transfer_label", "unknown",
] as const);

export type MerchantIdentityKind = typeof merchantIdentityKinds extends Set<infer Kind> ? Kind : never;

export function isPrivateMerchantKind(value: unknown): value is "private_person" | "personal_transfer_label" {
  return value === "private_person" || value === "personal_transfer_label";
}
