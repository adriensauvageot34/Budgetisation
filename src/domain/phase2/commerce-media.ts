import { plannerDigest, plannerDigestString, plannerKeys, plannerRecord, plannerString, plannerUuid } from "./planner/json";
import { MERCHANT_GENERIC_BADGE_LABELS, type MerchantGenericBadgeCategory, type MerchantIdentityKind } from "../../core/identity/merchant-kind";

export const BADGE_CATEGORIES = {
  ...MERCHANT_GENERIC_BADGE_LABELS,
  BEAUTY: "Beauté", CLOTHING: "Vêtements", HOME: "Maison", ACTIVITY: "Activités", SHOP: "Commerce",
} as const;
export type BadgeCategory = keyof typeof BADGE_CATEGORIES;
export type BadgeIdentity = Readonly<{ key: string; label: string }>;
export type BadgeAnchor = Readonly<{ key: string; digest: string }>;
export type BadgeBinding = BadgeAnchor & Readonly<{ identityKey: string | null; category: BadgeCategory | null; version: number }>;
export type PersonalBadge = BadgeIdentity & Readonly<{ category: BadgeCategory | null; version: number; hasImage: boolean; imageUrl?: string }>;
export type MerchantBadgeIdentity = Readonly<{
  key: string;
  kind: MerchantIdentityKind;
  displayName?: string;
  visualKey?: string;
  genericCategory?: MerchantGenericBadgeCategory;
}>;
export type BadgeLibraryRead = Readonly<{
  media: readonly PersonalBadge[];
  bindings: readonly BadgeBinding[];
  merchants?: readonly MerchantBadgeIdentity[];
}>;
export const BADGE_BUCKET = "composer-badge-illustrations";
export const MAX_BADGE_BYTES = 5 * 1024 * 1024;
export function badgeIdentityKey(raw: unknown): string {
  if (raw === "platform:amazon") return raw;
  if (typeof raw !== "string" || !/^(merchant|place|personal):/u.test(raw)) throw new TypeError("BADGE_IDENTITY_INVALID");
  const [kind, id, extra] = raw.split(":");
  if (extra) throw new TypeError("BADGE_IDENTITY_INVALID");
  return kind + ":" + plannerUuid(id);
}
export function badgeCategory(raw: unknown): BadgeCategory | null {
  if (raw === null) return null;
  if (typeof raw !== "string" || !Object.hasOwn(BADGE_CATEGORIES, raw)) throw new TypeError("BADGE_CATEGORY_INVALID");
  return raw as BadgeCategory;
}
export function badgeLabel(raw: unknown): string {
  const value = plannerString(raw).trim();
  if (value.length > 120) throw new TypeError("BADGE_LABEL_INVALID");
  return value;
}
export function badgeAnchor(raw: unknown): BadgeAnchor {
  const value = plannerRecord(raw);
  plannerKeys(value, ["key", "digest"]);
  if (typeof value.key !== "string" || !/^(seller|provider|place):/u.test(value.key)) throw new TypeError("BADGE_ANCHOR_INVALID");
  const [role, id, extra] = value.key.split(":");
  if (extra) throw new TypeError("BADGE_ANCHOR_INVALID");
  return { key: role + ":" + plannerUuid(id), digest: plannerDigestString(value.digest) };
}
export function commerceAnchor(contextId: string | undefined, role: "seller" | "provider" | "place", subject: unknown): BadgeAnchor | undefined {
  if (!contextId || !/^[0-9a-f-]{36}$/iu.test(contextId)) return undefined;
  return { key: role + ":" + contextId, digest: plannerDigest(subject) };
}
export function badgeVersion(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || Number(raw) < 0) throw new TypeError("BADGE_VERSION_INVALID");
  return Number(raw);
}
