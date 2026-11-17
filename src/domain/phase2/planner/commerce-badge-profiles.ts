import profiles from "./composer-generic-badge-profiles.json";
import { presetForContext } from "./composer-presets";
import type { CommerceContext, CommerceBadge } from "./commerce-badges";
import type { ComposerCardView } from "./composer-contract";
import { plannerDigest } from "./json";

const presets: Readonly<Record<string, readonly string[]>> = profiles.presets;
const templates: Readonly<Record<string, readonly string[]>> = profiles.templates;
const controls: Readonly<Record<string, readonly string[]>> = profiles.controls;

/** Explicit workbook choices suggest visuals only; they never classify a merchant. */
export function contextBadgeSuggestions(context: CommerceContext): readonly string[] {
  const preset = presetForContext(context);
  if (preset) return presets[preset.presetKey] ?? [];
  if (context.templateKey === "purchase" && context.fields.budgetDomain === "groceries") return presets["groceries-purchase"];
  return templates[context.templateKey] ?? [];
}

export function monthlyCommerceBadges(card: Pick<ComposerCardView, "targetRef" | "label" | "kind">): readonly CommerceBadge[] {
  const suggestedKeys = controls[card.targetRef];
  if (card.kind === "SAVINGS" || !suggestedKeys?.length) return [];
  return [{ kind: "seller", label: card.label, cardLabel: card.label, text: "Badge entreprise", custom: true, suggestedKeys,
    anchor: { key: "control:" + plannerDigest(card.targetRef), digest: plannerDigest({ kind: "monthly-commerce-badge", targetRef: card.targetRef }) } }];
}
