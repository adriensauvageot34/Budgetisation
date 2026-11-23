import { plannerDigest } from "./json";

export const JULY_COMPOSER_MONTH = "2026-07";
export const JULY_COMPOSER_HREF = `/mois-a-venir/composer?month=${JULY_COMPOSER_MONTH}`;
export const JULY_COMPOSER_EDIT_HREF = `${JULY_COMPOSER_HREF}&view=edition`;
export const JULY_V2_HREF = "/mois-a-venir/juillet-v2";
export const REALIZED_2025_MONTHS = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12"] as const;

export function isRealized2025Month(month: string): boolean {
  return REALIZED_2025_MONTHS.some(value => value === month);
}

export function realizedComposerHref(month: string) {
  return `/mois-a-venir/composer?month=${month}`;
}

export function reconstructedId(month: string, key: string) {
  const digest = plannerDigest({ owner: "composer-reconstruction", month, key });
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
