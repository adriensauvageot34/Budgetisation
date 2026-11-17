import profiles from "./composer-generic-badge-profiles.json";
import { presetForContext } from "./composer-presets";
import type { CommerceContext, CommerceBadge } from "./commerce-badges";
import type { ComposerCardView } from "./composer-contract";
import { plannerDigest } from "./json";

const presets: Readonly<Record<string, readonly string[]>> = profiles.presets;
const templates: Readonly<Record<string, readonly string[]>> = profiles.templates;
const controls: Readonly<Record<string, readonly string[]>> = profiles.controls;
const personalControls: Readonly<Record<string, readonly string[]>> = {
  "adrien-work-coffee": ["categories:cafe"],
  "adrien-work-meals": ["categories:restaurant", "categories:fast-food", "categories:bakery"],
  "manon-work-meals": ["categories:restaurant", "categories:fast-food", "categories:bakery"],
  hairdresser: ["categories:hairdresser"],
  "need:hairdresser": ["categories:hairdresser"],
  "need:maquillage_manon_mascara": ["categories:cosmetics", "categories:perfume", "categories:pharmacy"],
  "need:maquillage_manon_sourcils": ["categories:cosmetics", "categories:perfume", "categories:pharmacy"],
  "need:maquillage_manon_eyeliner": ["categories:cosmetics", "categories:perfume", "categories:pharmacy"],
  "need:cire_adrien": ["categories:beauty", "categories:pharmacy", "categories:hairdresser"],
  "need:haircare_adrien_cire": ["categories:beauty", "categories:pharmacy", "categories:hairdresser"],
  "need:haircare_manon": ["categories:beauty", "categories:pharmacy", "categories:hairdresser"],
  "need:skincare_manon": ["categories:beauty", "categories:pharmacy", "categories:perfume"],
};

/** Explicit workbook choices suggest visuals only; they never classify a merchant. */
export function contextBadgeSuggestions(context: CommerceContext): readonly string[] {
  const preset = presetForContext(context);
  if (preset) return presets[preset.presetKey] ?? [];
  if (context.templateKey === "purchase" && context.fields.budgetDomain === "groceries") return presets["groceries-purchase"];
  return templates[context.templateKey] ?? [];
}

export function monthlyCommerceBadges(card: Pick<ComposerCardView, "targetRef" | "label" | "kind">): readonly CommerceBadge[] {
  const semanticKey = card.targetRef.split(":").slice(2).join(":");
  const suggestedKeys = controls[card.targetRef] ?? personalControls[semanticKey];
  if (card.kind === "SAVINGS" || !suggestedKeys?.length) return [];
  return [{ kind: "seller", label: card.label, cardLabel: card.label, text: "Badge entreprise", custom: true, suggestedKeys,
    anchor: { key: "control:" + plannerDigest(card.targetRef), digest: plannerDigest({ kind: "monthly-commerce-badge", targetRef: card.targetRef }) } }];
}
