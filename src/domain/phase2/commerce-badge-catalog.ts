import entries from "./commerce-badge-assets.json";
import { badgeCategory, type BadgeCategory } from "./commerce-media";

export type ClayBadgeAsset = Readonly<{
  key: string;
  label: string;
  src: string;
  width: number;
  height: number;
  type: string;
  category?: BadgeCategory;
  reviewRequired?: boolean;
}>;

export const clayBadgeCatalog: readonly ClayBadgeAsset[] = entries.map(entry => ({
  ...entry,
  category: entry.category ? badgeCategory(entry.category) ?? undefined : undefined,
}));

export function clayBadgeAsset(key: unknown): ClayBadgeAsset | undefined {
  return typeof key === "string" ? clayBadgeCatalog.find(entry => entry.key === key) : undefined;
}
