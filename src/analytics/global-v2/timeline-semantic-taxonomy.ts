export const TIMELINE_SEMANTIC_TAXONOMY_VERSION = "timeline_semantic_taxonomy@v1" as const;

export type TimelineSemanticTaxonomyLevel = "CLOSE" | "INTERMEDIATE" | "GRAND";

export type TimelineSemanticTaxonomyEntry = {
  readonly level: TimelineSemanticTaxonomyLevel;
  readonly key: string;
  readonly label: string;
  readonly parentKey?: string | undefined;
  readonly parentLevel?: Exclude<TimelineSemanticTaxonomyLevel, "CLOSE"> | undefined;
};

export type TimelineSemanticClassification = {
  readonly taxonomyVersion: typeof TIMELINE_SEMANTIC_TAXONOMY_VERSION;
  readonly close: Readonly<{ key: string; label: string }>;
  readonly intermediate: Readonly<{ key: string; label: string }>;
  readonly grand: Readonly<{ key: string; label: string }>;
};

/** Exact code catalog compiled from TIMELINE_IMPLEMENTATION_FIXTURE.json. */
export const timelineSemanticTaxonomy = Object.freeze([
  { level: "GRAND", key: "projets_et_etapes_personnelles", label: "Projets & étapes personnelles", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "relations_fetes_et_evenements_de_vie", label: "Relations, fêtes & événements de vie", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "sante_et_soins_personnels", label: "Santé & soins personnels", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "sorties_loisirs_et_culture", label: "Sorties, loisirs & culture", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "vie_materielle_achats_et_entretien", label: "Vie matérielle, achats & entretien", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "vie_professionnelle_et_demarches", label: "Vie professionnelle & démarches", parentKey: undefined, parentLevel: undefined },
  { level: "GRAND", key: "voyages_sejours_et_escapades", label: "Voyages, séjours & escapades", parentKey: undefined, parentLevel: undefined },
  { level: "INTERMEDIATE", key: "apparence_et_soins_personnels", label: "Apparence & soins personnels", parentKey: "sante_et_soins_personnels", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "culture_et_evenements_publics", label: "Culture & événements publics", parentKey: "sorties_loisirs_et_culture", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "celebrations_privees", label: "Célébrations privées", parentKey: "relations_fetes_et_evenements_de_vie", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "demarches_administratives_et_juridiques", label: "Démarches administratives & juridiques", parentKey: "vie_professionnelle_et_demarches", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "loisirs_et_activites", label: "Loisirs & activités", parentKey: "sorties_loisirs_et_culture", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "missions_et_interventions_professionnelles", label: "Missions & interventions professionnelles", parentKey: "vie_professionnelle_et_demarches", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "permis_et_apprentissages", label: "Permis & apprentissages", parentKey: "projets_et_etapes_personnelles", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "projets_creatifs", label: "Projets créatifs", parentKey: "projets_et_etapes_personnelles", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "projets_maison", label: "Projets maison", parentKey: "projets_et_etapes_personnelles", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "sante_medicale", label: "Santé médicale", parentKey: "sante_et_soins_personnels", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "shopping_et_achats_personnels", label: "Shopping & achats personnels", parentKey: "vie_materielle_achats_et_entretien", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "sorties_festives_et_nocturnes", label: "Sorties festives & nocturnes", parentKey: "sorties_loisirs_et_culture", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "sorties_restauration_et_gourmandes", label: "Sorties restauration & gourmandes", parentKey: "sorties_loisirs_et_culture", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "sejours_thematiques", label: "Séjours thématiques", parentKey: "voyages_sejours_et_escapades", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "vacances_et_voyages", label: "Vacances & voyages", parentKey: "voyages_sejours_et_escapades", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "visites_et_temps_avec_les_proches", label: "Visites & temps avec les proches", parentKey: "relations_fetes_et_evenements_de_vie", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "vehicule", label: "Véhicule", parentKey: "vie_materielle_achats_et_entretien", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "week_ends_et_escapades", label: "Week-ends & escapades", parentKey: "voyages_sejours_et_escapades", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "evenements_familiaux_marquants", label: "Événements familiaux marquants", parentKey: "relations_fetes_et_evenements_de_vie", parentLevel: "GRAND" },
  { level: "INTERMEDIATE", key: "evenements_professionnels", label: "Événements professionnels", parentKey: "vie_professionnelle_et_demarches", parentLevel: "GRAND" },
  { level: "CLOSE", key: "achat_installation_d_un_equipement_important", label: "Achat / installation d’un équipement important", parentKey: "projets_maison", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "activite_de_loisir_a_preciser", label: "Activité de loisir à préciser", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "activite_nautique", label: "Activité nautique", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "amenagement_interieur", label: "Aménagement intérieur", parentKey: "projets_maison", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "anniversaire", label: "Anniversaire", parentKey: "celebrations_privees", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "audition_convocation", label: "Audition / convocation", parentKey: "demarches_administratives_et_juridiques", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "bowling", label: "Bowling", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "club_boite_de_nuit", label: "Club / boîte de nuit", parentKey: "sorties_festives_et_nocturnes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "coiffeur_barbier", label: "Coiffeur / barbier", parentKey: "apparence_et_soins_personnels", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "concert_spectacle_musical", label: "Concert / spectacle musical", parentKey: "culture_et_evenements_publics", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "consultation_medicale", label: "Consultation médicale", parentKey: "sante_medicale", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "controle_technique", label: "Contrôle technique", parentKey: "vehicule", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "celebration_de_couple", label: "Célébration de couple", parentKey: "celebrations_privees", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "deplacement_professionnel_avec_nuitee", label: "Déplacement professionnel avec nuitée", parentKey: "missions_et_interventions_professionnelles", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "diner_social_restaurant", label: "Dîner social / restaurant", parentKey: "sorties_restauration_et_gourmandes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "entretien_courant_vehicule", label: "Entretien courant véhicule", parentKey: "vehicule", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "examen_du_code", label: "Examen du code", parentKey: "permis_et_apprentissages", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "fast_food_comme_sortie", label: "Fast-food comme sortie", parentKey: "sorties_restauration_et_gourmandes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "feria_fete_populaire", label: "Feria / fête populaire", parentKey: "culture_et_evenements_publics", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "fete_annuelle_familiale", label: "Fête annuelle familiale", parentKey: "celebrations_privees", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "glace_dessert_gouter", label: "Glace / dessert / goûter", parentKey: "sorties_restauration_et_gourmandes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "intervention_rendez_vous_professionnel_exterieur", label: "Intervention / rendez-vous professionnel extérieur", parentKey: "missions_et_interventions_professionnelles", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "jeux_activite_ludique", label: "Jeux / activité ludique", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "journee_plage_baignade", label: "Journée plage / baignade", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "loisir_sportif", label: "Loisir sportif", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "obseques_funerailles", label: "Obsèques / funérailles", parentKey: "evenements_familiaux_marquants", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "parcours_permis_de_conduire", label: "Parcours permis de conduire", parentKey: "permis_et_apprentissages", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "piercing_modification_corporelle", label: "Piercing / modification corporelle", parentKey: "apparence_et_soins_personnels", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "projet_seance_photo", label: "Projet / séance photo", parentKey: "projets_creatifs", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "recherche_de_mobilier_pour_un_projet", label: "Recherche de mobilier pour un projet", parentKey: "projets_maison", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "reparation", label: "Réparation", parentKey: "vehicule", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "reunion_familiale_festive", label: "Réunion familiale festive", parentKey: "celebrations_privees", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "reveillon_nouvel_an", label: "Réveillon / Nouvel An", parentKey: "celebrations_privees", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "salon_evenement_professionnel", label: "Salon / événement professionnel", parentKey: "evenements_professionnels", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "session_shopping_vetements", label: "Session shopping vêtements", parentKey: "shopping_et_achats_personnels", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "soin_consultation_dentaire", label: "Soin / consultation dentaire", parentKey: "sante_medicale", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "soiree_bars_tournee_de_bars", label: "Soirée bars / tournée de bars", parentKey: "sorties_festives_et_nocturnes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "soiree_techno_rave", label: "Soirée techno / rave", parentKey: "sorties_festives_et_nocturnes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sortie_cafe_verre", label: "Sortie café / verre", parentKey: "sorties_restauration_et_gourmandes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sortie_nature_site_remarquable", label: "Sortie nature / site remarquable", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sortie_nocturne_en_etablissement", label: "Sortie nocturne en établissement", parentKey: "sorties_festives_et_nocturnes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sortie_restaurant", label: "Sortie restaurant", parentKey: "sorties_restauration_et_gourmandes", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "spectacle_representation_culturelle", label: "Spectacle / représentation culturelle", parentKey: "culture_et_evenements_publics", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sejour_chez_des_amis", label: "Séjour chez des amis", parentKey: "visites_et_temps_avec_les_proches", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sejour_chez_la_famille", label: "Séjour chez la famille", parentKey: "visites_et_temps_avec_les_proches", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sejour_ski", label: "Séjour ski", parentKey: "sejours_thematiques", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "sejour_vacances_en_france", label: "Séjour vacances en France", parentKey: "vacances_et_voyages", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "visite_ami", label: "Visite ami", parentKey: "visites_et_temps_avec_les_proches", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "visite_de_site_decouverte", label: "Visite de site / découverte", parentKey: "loisirs_et_activites", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "visite_famille", label: "Visite famille", parentKey: "visites_et_temps_avec_les_proches", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "visite_a_un_proche_hospitalise", label: "Visite à un proche hospitalisé", parentKey: "evenements_familiaux_marquants", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "voyage_vacances_a_l_etranger", label: "Voyage vacances à l’étranger", parentKey: "vacances_et_voyages", parentLevel: "INTERMEDIATE" },
  { level: "CLOSE", key: "week_end_escapade_regionale", label: "Week-end / escapade régionale", parentKey: "week_ends_et_escapades", parentLevel: "INTERMEDIATE" },
] as const satisfies readonly TimelineSemanticTaxonomyEntry[]);

const taxonomyByKey = new Map<string, TimelineSemanticTaxonomyEntry>();
for (const entry of timelineSemanticTaxonomy) {
  if (taxonomyByKey.has(entry.key)) throw new TypeError(`TIMELINE_SEMANTIC_TAXONOMY_DUPLICATE:${entry.key}`);
  taxonomyByKey.set(entry.key, entry);
}

const levelCounts = Object.freeze({
  GRAND: timelineSemanticTaxonomy.filter(({ level }) => level === "GRAND").length,
  INTERMEDIATE: timelineSemanticTaxonomy.filter(({ level }) => level === "INTERMEDIATE").length,
  CLOSE: timelineSemanticTaxonomy.filter(({ level }) => level === "CLOSE").length,
});

if (timelineSemanticTaxonomy.length !== 80 || levelCounts.GRAND !== 7 || levelCounts.INTERMEDIATE !== 20 || levelCounts.CLOSE !== 53) {
  throw new TypeError("TIMELINE_SEMANTIC_TAXONOMY_CARDINALITY_INVALID");
}

for (const rawEntry of timelineSemanticTaxonomy) {
  const entry: TimelineSemanticTaxonomyEntry = rawEntry;
  if (entry.level === "GRAND") {
    if (entry.parentKey !== undefined || entry.parentLevel !== undefined) throw new TypeError(`TIMELINE_SEMANTIC_GRAND_PARENT_FORBIDDEN:${entry.key}`);
    continue;
  }
  const parent = entry.parentKey === undefined ? undefined : taxonomyByKey.get(entry.parentKey);
  const expectedParentLevel = entry.level === "CLOSE" ? "INTERMEDIATE" : "GRAND";
  if (entry.parentLevel !== expectedParentLevel || parent?.level !== expectedParentLevel) {
    throw new TypeError(`TIMELINE_SEMANTIC_TAXONOMY_PARENT_INVALID:${entry.key}`);
  }
}

export const timelineSemanticTaxonomyCounts = levelCounts;

export function assertTimelineSemanticTaxonomyVersion(value: unknown): asserts value is typeof TIMELINE_SEMANTIC_TAXONOMY_VERSION {
  if (value !== TIMELINE_SEMANTIC_TAXONOMY_VERSION) throw new TypeError("TIMELINE_SEMANTIC_TAXONOMY_VERSION_INVALID");
}

export function isTimelineSemanticCloseFamilyKey(value: unknown): value is string {
  return typeof value === "string" && taxonomyByKey.get(value)?.level === "CLOSE";
}

export function resolveTimelineSemanticClassification(
  closeFamilyKey: string,
  taxonomyVersion: unknown = TIMELINE_SEMANTIC_TAXONOMY_VERSION,
): TimelineSemanticClassification {
  assertTimelineSemanticTaxonomyVersion(taxonomyVersion);
  const close = taxonomyByKey.get(closeFamilyKey);
  if (close?.level !== "CLOSE" || close.parentKey === undefined) throw new TypeError("TIMELINE_SEMANTIC_CLOSE_FAMILY_UNKNOWN");
  const intermediate = taxonomyByKey.get(close.parentKey);
  if (intermediate?.level !== "INTERMEDIATE" || intermediate.parentKey === undefined) throw new TypeError("TIMELINE_SEMANTIC_INTERMEDIATE_FAMILY_INVALID");
  const grand = taxonomyByKey.get(intermediate.parentKey);
  if (grand?.level !== "GRAND") throw new TypeError("TIMELINE_SEMANTIC_GRAND_FAMILY_INVALID");
  return {
    taxonomyVersion: TIMELINE_SEMANTIC_TAXONOMY_VERSION,
    close: { key: close.key, label: close.label },
    intermediate: { key: intermediate.key, label: intermediate.label },
    grand: { key: grand.key, label: grand.label },
  };
}
