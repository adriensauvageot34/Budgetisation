/** UI draft arithmetic only. Never computes a forecast, gain, or financial floor. */
export function relativeAmountDraft(reference: string, percent: number): string {
  const cents = Math.round(Number(reference) * 100);
  return (Math.max(0, Math.round(cents * (100 + percent) / 100)) / 100).toFixed(2);
}
export const relativePercentDraft = (reference: string, amount: string) => Number(reference) > 0
  ? Math.round((Number(amount) / Number(reference) - 1) * 10000) / 100 : 0;
export function rankChoiceCategories<T extends { key: string; target: string | null; forecast: string; capabilities: { adjustability: string } }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.target !== null) - Number(a.target !== null)
    || Number(b.capabilities.adjustability === "ADJUSTABLE") - Number(a.capabilities.adjustability === "ADJUSTABLE")
    || Number(b.forecast) - Number(a.forecast) || a.key.localeCompare(b.key));
}
export const choicePage = <T,>(rows: readonly T[], page: number, size = 6): readonly T[] => rows.slice(page * size, (page + 1) * size);
