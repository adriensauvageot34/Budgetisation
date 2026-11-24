import { plannerDigest } from "./json";

export const JULY_COMPOSER_MONTH = "2026-07";
export const JULY_PILOT_DATE = "2026-07-15";
export const JULY_COMPOSER_HREF = `/mois-a-venir/composer?month=${JULY_COMPOSER_MONTH}`;
export const JULY_COMPOSER_EDIT_HREF = `${JULY_COMPOSER_HREF}&view=edition`;
export const JULY_COMPOSER_FULL_HREF = `${JULY_COMPOSER_HREF}&view=bilan`;
export const JULY_V2_HREF = "/mois-a-venir/juillet-v2";
export const ARCHIVED_REALIZED_MONTHS = [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
] as const;

export const IMPORTED_REALIZED_MONTHS = ["2026-08", "2026-09", "2026-10"] as const;

export function isImportedRealizedMonth(month: string): boolean {
  return IMPORTED_REALIZED_MONTHS.some(value => value === month);
}

export function isArchivedRealizedMonth(month: string): boolean {
  return ARCHIVED_REALIZED_MONTHS.some(value => value === month);
}

export function realizedComposerHref(month: string, cardId?: string) {
  const params = new URLSearchParams({ month });
  if (cardId) params.set("carte", cardId);
  return `/mois-a-venir/composer?${params}`;
}

export function reconstructedId(month: string, key: string) {
  const digest = plannerDigest({ owner: "composer-reconstruction", month, key });
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
