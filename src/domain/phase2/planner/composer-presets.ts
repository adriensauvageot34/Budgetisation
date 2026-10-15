import type { PlannerJsonObject } from "./json";
import { plannerKeys, plannerRecord } from "./json";

/** Presentation recipes only. The published template/drop capability remains authoritative. */
export const COMPOSER_PRESETS = [
  { presetKey: "techno-night", label: "Soirée techno", templateKey: "night-out", categoryKey: "SOCIAL",
    illustrationKey: "techno-night", searchTerms: ["techno", "club", "musique", "soirée"],
    defaults: { label: "Soirée techno" }, questions: ["Entrée", "Boissons", "Before", "Repas", "Aller et retour"],
    guidance: "Entrée, boissons, before ou transport : ajoutez seulement ce que vous prévoyez. Une bouteille partagée reste un seul coût." },
  { presetKey: "uber-eats-order", label: "Uber Eats", templateKey: "delivery", categoryKey: "FOOD",
    illustrationKey: "uber-eats-order", searchTerms: ["uber", "eats", "livraison", "repas", "commande"],
    defaults: { label: "Uber Eats" }, questions: ["Participants", "Date", "Commande", "Livraison", "Enveloppe"],
    guidance: "Un repas livré, sans trajet du foyer. Le nom de cette intention ne constitue pas une référence de commerçant." },
  { presetKey: "fishing-day", label: "Journée pêche", templateKey: "activity", categoryKey: "ACTIVITY",
    illustrationKey: "fishing-day", searchTerms: ["pêche", "canne", "activité", "journée"],
    defaults: { label: "Journée pêche" }, questions: ["Participants", "Destination", "Date", "Budget", "Trajet"],
    guidance: "Prévoyez la sortie et ses frais volontaires. Aucun permis ni matériel n’est acheté automatiquement. Les compléments restent des libellés libres." },
  { presetKey: "fontes-family-visit", label: "Visite Fontès", templateKey: "family-visit", categoryKey: "VISIT",
    illustrationKey: "fontes-family-visit", searchTerms: ["fontès", "famille", "visite"],
    defaults: { label: "Visite Fontès" }, questions: ["Personne visitée", "Participants", "Lieu", "Date", "Déplacement"],
    guidance: "Choisissez le lieu exact et les personnes concernées. Aucun domicile, proche ou véhicule n’est déduit du nom Fontès." },
  { presetKey: "clothing-shopping", label: "Acheter des vêtements", templateKey: "purchase", categoryKey: "PURCHASE",
    illustrationKey: "clothing-shopping", searchTerms: ["vêtements", "shopping", "achat", "habit"],
    defaults: { label: "Acheter des vêtements", budgetDomain: "clothing" }, questions: ["Article", "Vendeur facultatif", "Date", "Budget", "Enveloppe"],
    guidance: "Un achat lié à l’enveloppe Vêtements. Choisissez le total ou les articles, puis seulement les frais qui ne sont pas déjà inclus." },
] as const;
export type ComposerPreset = (typeof COMPOSER_PRESETS)[number];
export type ComposerPresetKey = ComposerPreset["presetKey"];
export const COMPOSER_PRESENTATION_VERSION = "composer-context-presentation@v1" as const;
export const composerPreset = (key: string) => COMPOSER_PRESETS.find(p => p.presetKey === key);
/** Single terminal visual registry: no title matching, no remote URL or legacy Builder image. */
export const presetIllustrationPath = (preset: ComposerPreset) => `/planned-visuals/composer/presets/${preset.illustrationKey}.webp`;
export function presetForContext(context: { templateKey: string; fields: PlannerJsonObject }): ComposerPreset | undefined {
  const metadata = context.fields.composerPresentation;
  if (metadata === undefined) return undefined; // Historical revisions keep their original presentation.
  const value = plannerRecord(metadata);
  plannerKeys(value, ["version", "presetKey"]);
  const preset = typeof value.presetKey === "string" ? composerPreset(value.presetKey) : undefined;
  if (value.version !== COMPOSER_PRESENTATION_VERSION || !preset || preset.templateKey !== context.templateKey)
    throw new TypeError("COMPOSER_PRESET_PRESENTATION_INVALID");
  return preset;
}
export function presetCreationFields(templateKey: string, presetKey?: string): PlannerJsonObject {
  if (presetKey === undefined) return {};
  const preset = composerPreset(presetKey);
  if (!preset || preset.templateKey !== templateKey) throw new TypeError("COMPOSER_PRESET_CAPABILITY_MISMATCH");
  return { ...preset.defaults, composerPresentation: { version: COMPOSER_PRESENTATION_VERSION, presetKey: preset.presetKey } };
}
