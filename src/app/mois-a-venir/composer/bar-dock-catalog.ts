import { barSearchText } from "./bar-search";

/** A bounded projection, never a new catalogue or a source of decisions.
 * Search always runs over the complete admissible input before limiting DOM. */
export function barDockCatalog<T extends { label: string; hint?: string }>(choices: readonly T[], query: string, limit = 24) {
  const words = barSearchText(query).split(/\s+/u).filter(Boolean);
  const matches = words.length ? choices.filter(choice => {
    const text = barSearchText(`${choice.label} ${choice.hint ?? ""}`);
    return words.every(word => text.includes(word));
  }) : choices;
  const count = Math.max(24, limit);
  return { visible: matches.slice(0, count), remaining: Math.max(0, matches.length - count), total: matches.length };
}
