export type GlobalMomentFamily =
  | "TRAVEL_AND_STAY"
  | "SOCIAL_AND_FAMILY_VISIT"
  | "CELEBRATION"
  | "CULTURAL_AND_LEISURE_EVENT"
  | "SOCIAL_OUTING"
  | "PROJECT_MILESTONE"
  | "OTHER_MOMENT";

export type GlobalMomentFacetKey =
  | "DURATION_BAND"
  | "HOUSEHOLD_PARTICIPATION"
  | "LODGING_MODE"
  | "ORGANIZER_ROLE"
  | "GEOGRAPHIC_SCOPE";

export type GlobalMomentComparisonTier = "SAME_SERIES" | "SAME_TYPE" | "SAME_FAMILY";

export type GlobalMomentComparisonProfile = {
  readonly profileId: string;
  readonly family: GlobalMomentFamily;
  readonly requiredFacets: readonly GlobalMomentFacetKey[];
  readonly preferredFacets: readonly GlobalMomentFacetKey[];
  readonly comparisonLadder: readonly GlobalMomentComparisonTier[];
  readonly allowTotalCostComparison: boolean;
  readonly allowCostPerDay: boolean;
  readonly allowGenericCostPerParticipant: false;
  readonly materialityPolicyId: "MOMENT_SHORT" | "MOMENT_TRAVEL" | "MOMENT_PROJECT";
  readonly methodVersion: "moment_comparison_catalog@v1";
};

const profile = (
  family: GlobalMomentFamily,
  value: Omit<GlobalMomentComparisonProfile, "profileId" | "family" | "methodVersion" | "allowGenericCostPerParticipant">,
): GlobalMomentComparisonProfile => Object.freeze({
  profileId: `moment-comparison:${family.toLowerCase()}@v1`,
  family,
  methodVersion: "moment_comparison_catalog@v1",
  allowGenericCostPerParticipant: false,
  ...value,
});

export const momentComparisonProfiles: Readonly<Record<GlobalMomentFamily, GlobalMomentComparisonProfile>> = Object.freeze({
  TRAVEL_AND_STAY: profile("TRAVEL_AND_STAY", {
    requiredFacets: ["DURATION_BAND", "HOUSEHOLD_PARTICIPATION", "LODGING_MODE"],
    preferredFacets: ["GEOGRAPHIC_SCOPE"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"],
    allowTotalCostComparison: true,
    allowCostPerDay: true,
    materialityPolicyId: "MOMENT_TRAVEL",
  }),
  SOCIAL_AND_FAMILY_VISIT: profile("SOCIAL_AND_FAMILY_VISIT", {
    requiredFacets: ["HOUSEHOLD_PARTICIPATION", "LODGING_MODE"],
    preferredFacets: ["DURATION_BAND", "GEOGRAPHIC_SCOPE"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"],
    allowTotalCostComparison: true,
    allowCostPerDay: true,
    materialityPolicyId: "MOMENT_SHORT",
  }),
  CELEBRATION: profile("CELEBRATION", {
    requiredFacets: ["HOUSEHOLD_PARTICIPATION", "ORGANIZER_ROLE"],
    preferredFacets: ["DURATION_BAND"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"],
    allowTotalCostComparison: true,
    allowCostPerDay: false,
    materialityPolicyId: "MOMENT_SHORT",
  }),
  CULTURAL_AND_LEISURE_EVENT: profile("CULTURAL_AND_LEISURE_EVENT", {
    requiredFacets: ["HOUSEHOLD_PARTICIPATION"],
    preferredFacets: ["DURATION_BAND", "GEOGRAPHIC_SCOPE"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"],
    allowTotalCostComparison: true,
    allowCostPerDay: false,
    materialityPolicyId: "MOMENT_SHORT",
  }),
  SOCIAL_OUTING: profile("SOCIAL_OUTING", {
    requiredFacets: ["HOUSEHOLD_PARTICIPATION"],
    preferredFacets: ["DURATION_BAND"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE", "SAME_FAMILY"],
    allowTotalCostComparison: true,
    allowCostPerDay: false,
    materialityPolicyId: "MOMENT_SHORT",
  }),
  PROJECT_MILESTONE: profile("PROJECT_MILESTONE", {
    requiredFacets: [],
    preferredFacets: ["DURATION_BAND"],
    comparisonLadder: ["SAME_SERIES", "SAME_TYPE"],
    allowTotalCostComparison: true,
    allowCostPerDay: true,
    materialityPolicyId: "MOMENT_PROJECT",
  }),
  OTHER_MOMENT: profile("OTHER_MOMENT", {
    requiredFacets: [], preferredFacets: [], comparisonLadder: [],
    allowTotalCostComparison: false, allowCostPerDay: false,
    materialityPolicyId: "MOMENT_SHORT",
  }),
});

const type = (family: GlobalMomentFamily, normalizedKey: string) => Object.freeze({ family, normalizedKey });

/** Exact 20-type canonical Moment vocabulary already enforced by Calendar V2. */
export const momentComparisonCatalogV1 = Object.freeze({
  "Anniversaire": type("CELEBRATION", "anniversaire"),
  "Boîte de nuit": type("SOCIAL_OUTING", "boite-de-nuit"),
  "Concert / spectacle": type("CULTURAL_AND_LEISURE_EVENT", "concert-spectacle"),
  "Déplacement professionnel": type("TRAVEL_AND_STAY", "deplacement-professionnel"),
  "Entretien / contrôle véhicule": type("PROJECT_MILESTONE", "entretien-controle-vehicule"),
  "Événement familial / déplacement": type("SOCIAL_AND_FAMILY_VISIT", "evenement-familial-deplacement"),
  "Fête / célébration": type("CELEBRATION", "fete-celebration"),
  "Projet / achat maison": type("PROJECT_MILESTONE", "projet-achat-maison"),
  "Projet / séance photo": type("PROJECT_MILESTONE", "projet-seance-photo"),
  "Projet personnel": type("PROJECT_MILESTONE", "projet-personnel"),
  "Réparation / imprévu": type("OTHER_MOMENT", "reparation-imprevu"),
  "Soirée": type("SOCIAL_OUTING", "soiree"),
  "Soirée techno": type("SOCIAL_OUTING", "soiree-techno"),
  "Sortie / activité": type("CULTURAL_AND_LEISURE_EVENT", "sortie-activite"),
  "Sortie / événement": type("CULTURAL_AND_LEISURE_EVENT", "sortie-evenement"),
  "Sortie / excursion": type("TRAVEL_AND_STAY", "sortie-excursion"),
  "Sortie / plage": type("CULTURAL_AND_LEISURE_EVENT", "sortie-plage"),
  "Visite familiale": type("SOCIAL_AND_FAMILY_VISIT", "visite-familiale"),
  "Voyage": type("TRAVEL_AND_STAY", "voyage"),
  "Week-end / escapade": type("TRAVEL_AND_STAY", "week-end-escapade"),
});

const byNormalizedKey = new Map(Object.entries(momentComparisonCatalogV1).map(([label, entry]) => [entry.normalizedKey, { label, ...entry }]));

export function resolveGlobalMomentType(value: string) {
  const direct = momentComparisonCatalogV1[value as keyof typeof momentComparisonCatalogV1];
  if (direct !== undefined) return { label: value, ...direct };
  return byNormalizedKey.get(value);
}

export function assertGlobalMomentCatalogExhaustive(): void {
  if (Object.keys(momentComparisonCatalogV1).length !== 20 || byNormalizedKey.size !== 20) {
    throw new TypeError("M6_MOMENT_CATALOG_MUST_HAVE_20_UNIQUE_TYPES");
  }
}
