import type { GlobalMaterialityPolicyId } from "./materiality";
import { timelineSemanticTaxonomy } from "./timeline-semantic-taxonomy";

export const TIMELINE_SEMANTIC_COMPARATOR_VERSION = "timeline-semantic-comparator@v1" as const;
export const TIMELINE_SEMANTIC_HOUSEHOLD_FACET = "HOUSEHOLD_PARTICIPATION" as const;

export type TimelineSemanticComparatorPolicy = Readonly<{
  closeFamilyKey: string;
  seriesPolicy: "EXPLICIT_CANONICAL_ONLY";
  closePolicy: "YES" | "NO_UNRESOLVED";
  intermediatePolicy: "NO" | "NO_REDUNDANT" | "YES_WITH_FACET_GATE";
  intermediateRequiredFacets: readonly string[];
  materialityPolicyId: Extract<GlobalMaterialityPolicyId, "MOMENT_SHORT" | "MOMENT_TRAVEL" | "MOMENT_PROJECT">;
  policyVersion: typeof TIMELINE_SEMANTIC_COMPARATOR_VERSION;
}>;

const unresolvedCloseFamilies = new Set(["activite_de_loisir_a_preciser"]);
const nightlifeIntermediateCloseFamilies = new Set([
  "club_boite_de_nuit",
  "soiree_bars_tournee_de_bars",
  "soiree_techno_rave",
  "sortie_nocturne_en_etablissement",
]);
const redundantIntermediateCloseFamilies = new Set([
  "audition_convocation",
  "projet_seance_photo",
  "salon_evenement_professionnel",
  "session_shopping_vetements",
  "sejour_ski",
  "week_end_escapade_regionale",
]);
const travelMaterialityCloseFamilies = new Set([
  "deplacement_professionnel_avec_nuitee",
  "sejour_ski",
  "sejour_vacances_en_france",
  "voyage_vacances_a_l_etranger",
  "week_end_escapade_regionale",
]);
const projectMaterialityCloseFamilies = new Set([
  "achat_installation_d_un_equipement_important",
  "amenagement_interieur",
  "controle_technique",
  "entretien_courant_vehicule",
  "examen_du_code",
  "parcours_permis_de_conduire",
  "projet_seance_photo",
  "recherche_de_mobilier_pour_un_projet",
  "reparation",
  "session_shopping_vetements",
]);

const closeEntries = timelineSemanticTaxonomy.filter(({ level }) => level === "CLOSE");

export const timelineSemanticComparatorPolicies = Object.freeze(closeEntries.map((entry): TimelineSemanticComparatorPolicy => {
  const nightlife = nightlifeIntermediateCloseFamilies.has(entry.key);
  if (nightlife && entry.parentKey !== "sorties_festives_et_nocturnes") {
    throw new TypeError(`TIMELINE_SEMANTIC_INTERMEDIATE_POLICY_PARENT_INVALID:${entry.key}`);
  }
  return {
    closeFamilyKey: entry.key,
    seriesPolicy: "EXPLICIT_CANONICAL_ONLY",
    closePolicy: unresolvedCloseFamilies.has(entry.key) ? "NO_UNRESOLVED" : "YES",
    intermediatePolicy: nightlife
      ? "YES_WITH_FACET_GATE"
      : redundantIntermediateCloseFamilies.has(entry.key)
        ? "NO_REDUNDANT"
        : "NO",
    intermediateRequiredFacets: nightlife ? [TIMELINE_SEMANTIC_HOUSEHOLD_FACET] : [],
    materialityPolicyId: travelMaterialityCloseFamilies.has(entry.key)
      ? "MOMENT_TRAVEL"
      : projectMaterialityCloseFamilies.has(entry.key)
        ? "MOMENT_PROJECT"
        : "MOMENT_SHORT",
    policyVersion: TIMELINE_SEMANTIC_COMPARATOR_VERSION,
  };
}));

if (timelineSemanticComparatorPolicies.length !== 53) {
  throw new TypeError("TIMELINE_SEMANTIC_COMPARATOR_POLICY_CARDINALITY_INVALID");
}

const policiesByCloseFamily = new Map(timelineSemanticComparatorPolicies.map((policy) => [policy.closeFamilyKey, policy]));

export function resolveTimelineSemanticComparatorPolicy(closeFamilyKey: string): TimelineSemanticComparatorPolicy {
  const policy = policiesByCloseFamily.get(closeFamilyKey);
  if (policy === undefined) throw new TypeError(`TIMELINE_SEMANTIC_COMPARATOR_POLICY_MISSING:${closeFamilyKey}`);
  return policy;
}
