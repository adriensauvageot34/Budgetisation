import registry from "./commerce-illustrations.json";
import type { BundledMediaAsset } from "./media-registry";
import type { BadgeCategory } from "@/domain/phase2/commerce-media";

export type CommerceIllustrations = Readonly<{
  identities: Readonly<Record<string, BundledMediaAsset>>;
  categories: Readonly<Partial<Record<BadgeCategory, BundledMediaAsset>>>;
}>;
export const commerceIllustrations: CommerceIllustrations = registry;
function commerceAssetPath(asset: BundledMediaAsset | undefined) {
  return asset && /^\/planned-visuals\/(commerce\/(merchants|places|platforms|categories)|builder\/clay\/(bar-compact|v22\/compact))\/[a-z0-9-]+\.webp$/u.test(asset.src)
    && asset.width > 0 && asset.height > 0 ? asset.src : undefined;
}

type BadgeImage = Readonly<{ src: string; kind: "IDENTITY" | "CATEGORY" }>;

export function commerceBadgeImages({
  identityKey, sharedKey, category, personalSrc, sharedPersonalSrc,
}: {
  identityKey?: string;
  sharedKey?: string;
  category?: BadgeCategory;
  personalSrc?: string;
  sharedPersonalSrc?: string;
}): readonly BadgeImage[] {
  const specific = identityKey ? commerceAssetPath(commerceIllustrations.identities[identityKey]) : undefined;
  const shared = sharedKey ? commerceAssetPath(commerceIllustrations.identities[sharedKey]) : undefined;
  const activity = category === "INDIAN_RESTAURANT" ? "RESTAURANT" : category;
  const generic = activity ? commerceAssetPath(commerceIllustrations.categories[activity]) : undefined;
  const identities = [personalSrc, specific, sharedPersonalSrc, shared].flatMap(src =>
    src ? [{ src, kind: "IDENTITY" as const }] : [],
  );
  return generic ? [...identities, { src: generic, kind: "CATEGORY" }] : identities;
}
