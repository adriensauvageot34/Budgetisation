export type TimelineSemanticVisual =
  | "relations"
  | "leisure-culture"
  | "travel"
  | "projects"
  | "material-life"
  | "health"
  | "professional"
  | "neutral";

/** Presentation-only mapping from the server-owned grand semantic family. */
export const TIMELINE_FAMILY_VISUALS: Readonly<Record<string, TimelineSemanticVisual>> = Object.freeze({
  relations_fetes_et_evenements_de_vie: "relations",
  sorties_loisirs_et_culture: "leisure-culture",
  voyages_sejours_et_escapades: "travel",
  projets_et_etapes_personnelles: "projects",
  vie_materielle_achats_et_entretien: "material-life",
  sante_et_soins_personnels: "health",
  vie_professionnelle_et_demarches: "professional",
});

export function timelineSemanticVisual(grandFamilyKey: string): TimelineSemanticVisual {
  return TIMELINE_FAMILY_VISUALS[grandFamilyKey] ?? "neutral";
}
