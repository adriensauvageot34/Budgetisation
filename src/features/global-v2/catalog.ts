import type {
  GlobalExpandedSectionKey,
  GlobalPrimaryModuleKey,
  GlobalPrimaryResourceName,
  GlobalV2ExpandedResourceName,
} from "@/query-api/global-v2";

export type GlobalModulePresentation = {
  readonly key: GlobalPrimaryModuleKey;
  readonly resource: GlobalPrimaryResourceName;
  readonly expandedResource: GlobalV2ExpandedResourceName;
  readonly detailResource?: GlobalV2ExpandedResourceName;
  readonly order: number;
  readonly shortLabel: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
};

export const globalModulePresentations = Object.freeze([
  { key: "ECONOMIC", resource: "analysis_global_economic", expandedResource: "analysis_global_economic_expanded", detailResource: "analysis_global_economic_recurrence_detail", order: 1, shortLabel: "Dépenses", title: "Nos dépenses", eyebrow: "", description: "" },
  { key: "CATEGORIES_NEEDS", resource: "analysis_global_categories_needs", expandedResource: "analysis_global_categories_needs_expanded", detailResource: "analysis_global_category_need_detail", order: 2, shortLabel: "Catégories", title: "Où va notre argent ?", eyebrow: "", description: "Les postes qui structurent nos dépenses sur la période analysée." },
  { key: "TRANSFORMATIONS", resource: "analysis_global_transformations", expandedResource: "analysis_global_transformations_expanded", detailResource: "analysis_global_transformation_detail", order: 3, shortLabel: "Changements", title: "Changements durables", eyebrow: "M3", description: "Les évolutions qui dépassent une variation isolée." },
  { key: "RHYTHM", resource: "analysis_global_rhythm", expandedResource: "analysis_global_rhythm_expanded", detailResource: "analysis_global_routine_detail", order: 4, shortLabel: "Rythmes", title: "Vos rythmes", eyebrow: "M4", description: "Les activités et habitudes observées pour chaque personne." },
  { key: "RELATIONSHIPS", resource: "analysis_global_relationships", expandedResource: "analysis_global_relationships_expanded", detailResource: "analysis_global_relationship_detail", order: 5, shortLabel: "Vie et argent", title: "Vie et argent", eyebrow: "M5", description: "Les relations mesurables entre vos contextes de vie et vos dépenses." },
  { key: "MOMENTS", resource: "analysis_global_moments", expandedResource: "analysis_global_moments_expanded", detailResource: "analysis_global_moment_experience_detail", order: 6, shortLabel: "Moments", title: "Moments marquants", eyebrow: "M6", description: "Les expériences qui ressortent du récit de l’année." },
  { key: "GEO_MOBILITY", resource: "analysis_global_geo_mobility", expandedResource: "analysis_global_geo_mobility_expanded", detailResource: "analysis_global_place_mobility_detail", order: 7, shortLabel: "Lieux", title: "Vos lieux", eyebrow: "M7", description: "Les lieux réellement visités et ce qu’ils racontent." },
  { key: "CONSUMPTION", resource: "analysis_global_consumption", expandedResource: "analysis_global_consumption_expanded", detailResource: "analysis_global_purchase_merchant_detail", order: 8, shortLabel: "Achats", title: "Achats et consommation", eyebrow: "M8", description: "Vos achats lorsque leur identité est suffisamment établie." },
  { key: "PERSONAS", resource: "analysis_global_personas", expandedResource: "analysis_global_personas_expanded", detailResource: "analysis_global_persona_detail", order: 9, shortLabel: "Profils", title: "Vos profils", eyebrow: "M9", description: "Des repères factuels par personne, sur des données comparables." },
  { key: "TOGETHER", resource: "analysis_global_together", expandedResource: "analysis_global_together_expanded", detailResource: "analysis_global_participation_detail", order: 10, shortLabel: "Nous deux", title: "Nous deux", eyebrow: "M10", description: "La participation partagée sans inventer de faux profil Couple." },
] as const satisfies readonly GlobalModulePresentation[]);

export const globalExpandedSections = Object.freeze([
  { key: "OVERVIEW", label: "Vue d’ensemble" },
  { key: "EVOLUTION", label: "Évolution" },
  { key: "BREAKDOWN", label: "Composition" },
  { key: "PATTERNS", label: "Motifs" },
  { key: "COMPARISONS", label: "Comparaisons" },
] as const satisfies readonly { readonly key: GlobalExpandedSectionKey; readonly label: string }[]);

export function globalModulePresentation(key: GlobalPrimaryModuleKey): GlobalModulePresentation {
  const presentation = globalModulePresentations.find((entry) => entry.key === key);
  if (presentation === undefined) throw new TypeError(`GLOBAL_UI_MODULE_UNKNOWN:${key}`);
  return presentation;
}
const copy: Readonly<Record<string, string>> = Object.freeze({
  "global.detail": "Explorer le module",
  "global.actual": "Dépenses réelles",
  "global.typical": "Niveau habituel",
  "global.minimal": "Nos dépenses minimum",
  "global.change": "Évolution récente",
  "global.coverage": "Couverture",
  "global.support": "Support",
  "global.economic": "Nos dépenses sur 12 mois",
  "global.category": "Catégories principales",
  "global.needs": "Besoins structurants",
  "global.transformation": "Transformation durable",
  "global.rhythm": "Cadence observée",
  "global.relationship": "Relation mesurée",
  "global.moment": "Moment significatif",
  "global.place": "Lieu visité",
  "global.purchase": "Achats retenus",
  "global.persona": "Profil comparable",
  "global.together": "Participation partagée",
  "global.method": "Méthode et preuves",
  "global.insight.economic.title": "Le niveau économique reste lisible",
  "global.insight.economic.statement": "Les dépenses observées restent proches du fonctionnement habituel certifié.",
  "global.insight.categories.title": "Le quotidien concentre l’essentiel",
  "global.insight.categories.statement": "Les besoins courants restent le premier univers de dépenses observé.",
  "global.insight.transformations.title": "Un nouveau chapitre se stabilise",
  "global.insight.transformations.statement": "La transformation détectée persiste au-delà d’une variation isolée.",
  "global.insight.rhythm.title": "Un rythme hebdomadaire se dessine",
  "global.insight.rhythm.statement": "La cadence est régulière sur l’exposition réellement observable.",
  "global.insight.relationships.title": "Une relation est mesurable",
  "global.insight.relationships.statement": "L’effet observé est publié avec son support, sans causalité présumée.",
  "global.insight.moments.title": "Une expérience ressort du récit",
  "global.insight.moments.statement": "Son importance ne dépend pas uniquement de son coût.",
  "global.insight.places.title": "Quelques lieux structurent les visites",
  "global.insight.places.statement": "Les visites prouvées restent séparées de la finance localisée.",
  "global.insight.consumption.title": "L’identité d’achat reste partielle",
  "global.insight.consumption.statement": "Les résultats disponibles se limitent aux actes d’achat autoritairement reliés.",
  "global.insight.personas.title": "Les profils ne partagent pas le même support",
  "global.insight.personas.statement": "La comparaison utilise uniquement l’intersection observable.",
  "global.insight.together.title": "Le partagé est décrit sans faux couple",
  "global.insight.together.statement": "Le taux porte seulement sur les occurrences dont la participation est résolue.",
});

export function globalUiCopy(key: string): string {
  const known = copy[key];
  if (known !== undefined) return known;
  if (/^(global\.|activity:|place:|relationship:|[0-9a-f]{8}-[0-9a-f-]{27,})/iu.test(key)) return "Information disponible";
  return key.replaceAll("_", " ");
}
