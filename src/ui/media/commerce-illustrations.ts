import registry from "./commerce-illustrations.json";
import type { BundledMediaAsset } from "./media-registry";
import type { BadgeCategory } from "@/domain/phase2/commerce-media";

export type CommerceIllustrations = Readonly<{
  identities: Readonly<Record<string, BundledMediaAsset>>;
  categories: Readonly<Partial<Record<BadgeCategory, BundledMediaAsset>>>;
}>;
export const commerceIllustrations: CommerceIllustrations = registry;
export function commerceAssetPath(asset: BundledMediaAsset | undefined) {
  return asset && /^\/planned-visuals\/commerce\/(merchants|places|platforms|categories)\/[a-z0-9-]+\.webp$/u.test(asset.src)
    && asset.width > 0 && asset.height > 0 ? asset.src : undefined;
}
