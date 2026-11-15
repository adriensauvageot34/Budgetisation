import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";
import type { ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ClayCatalogEntry } from "../clay-v22-catalog";

// Public Clay identities checked against workbook family, label and provenance.
// A relation describes a concept; only owners can publish an executable action.
export const v22Concepts = {
  ticket: { id: "v22-art:excel:329", label: "Billet de cinéma", topic: "activity" },
  museum: { id: "v22-art:excel:333", label: "Billet de musée", topic: "activity" },
  bowling: { id: "v22-art:excel:342", label: "Partie de bowling", topic: "activity" },
  concert: { id: "v22-art:excel:330", label: "Billet de concert", topic: "activity" },
  beer: { id: "v22-art:excel:2", label: "Bière", topic: "restaurant" },
  mascara: { id: "v22-art:excel:190", label: "Mascara", topic: "beauty" },
  detergent: { id: "v22-art:excel:249", label: "Lessive", topic: "home" },
  game: { id: "v22-art:excel:305", label: "Jeu vidéo", topic: "purchase" },
  lodge: { id: "v22-art:excel:473", label: "Gîte", topic: "stay" },
  breakfast: { id: "v22-art:excel:479", label: "Petit-déjeuner d’hébergement", topic: "stay" },
  tax: { id: "v22-art:excel:483", label: "Taxe de séjour", topic: "stay" },
  taxi: { id: "v22-art:excel:499", label: "Taxi", topic: "transport" },
} as const;
type ConceptKey = keyof typeof v22Concepts;
type Concept = typeof v22Concepts[ConceptKey];

const presetConcepts: Partial<Record<ComposerPresetKey, ConceptKey>> = {
  cinema: "ticket", "museum-exhibition": "museum", bowling: "bowling", concert: "concert",
  mascara: "mascara", "laundry-detergent": "detergent", "video-game-purchase": "game", "weekend-gite": "lodge",
};
export function conceptForPreset(key?: ComposerPresetKey): Concept | undefined {
  const concept = key && Object.hasOwn(presetConcepts, key) ? presetConcepts[key] : undefined;
  return concept ? v22Concepts[concept] : undefined;
}

type Source = { kind: "EXCEL"; id: string; label: string } | { kind: "BUSINESS"; label: string };
export const workbookSource = (concept: Concept): Source => ({ kind: "EXCEL", id: concept.id, label: concept.label });
export const businessSource = (label: string): Source => ({ kind: "BUSINESS", label });
export function clayWorkbookSource(entry: Pick<ClayCatalogEntry, "discovery" | "visualConceptId" | "label">): Source | undefined {
  return entry.discovery.provenance === "EXCEL_NAME_FAMILY" && entry.discovery.sourceRow != null
    ? { kind: "EXCEL", id: entry.visualConceptId, label: entry.label } : undefined;
}
export const sourceReason = (source: Source | undefined) =>
  source?.kind === "EXCEL" ? "Catalogue V22 · " + source.label : source?.label;

export function rankDiscoveryCandidates<T extends { key: string; tiers: readonly number[] }>(candidates: readonly T[]): T[] {
  return [...candidates].sort((a, b) => {
    for (let i = 0; i < Math.max(a.tiers.length, b.tiers.length); i++) {
      const difference = (a.tiers[i] ?? 0) - (b.tiers[i] ?? 0);
      if (difference) return difference;
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

export type QualifiedAffinity = { conceptId: string; value: "SOUVENT" | "PARFOIS" | "RAREMENT" | "JAMAIS" | "NON_UTILISE" };
export type RecommendationPreference = { subject: string; values: readonly QualifiedAffinity[] };
/** A future private caller must supply an independently authorized subject. Search is never filtered by affinity. */
export function preferenceTier(conceptId?: string, scope?: { authorizedSubject: string; profile: RecommendationPreference }) {
  if (!conceptId || !scope?.authorizedSubject || scope.authorizedSubject !== scope.profile.subject) return 1;
  const matches = scope.profile.values.filter(value => value.conceptId === conceptId);
  return matches.length === 1 && (matches[0].value === "SOUVENT" || matches[0].value === "PARFOIS") ? 0 : 1;
}

export function rankCatalogRecommendations<T extends { key: string; tiers: readonly number[]; source?: Source }>(
  candidates: readonly T[], scope?: Parameters<typeof preferenceTier>[1],
): T[] {
  // Existing business tiers decide admissible action and urgency first.
  const ranked = candidates.map(candidate => ({ key: candidate.key, candidate,
    tiers: [...candidate.tiers, candidate.source?.kind === "EXCEL" ? 0 : 1,
      preferenceTier(candidate.source?.kind === "EXCEL" ? candidate.source.id : undefined, scope)] }));
  return rankDiscoveryCandidates(ranked).map(row => row.candidate);
}

export function conceptSearch(terms: string, key?: ComposerPresetKey) {
  const concept = conceptForPreset(key);
  return concept ? terms + " " + normalizeLibrarySearch(concept.label) : terms;
}
