import type {
  CalendarAggregationPolicy,
  CalendarRenderMode,
  MarkerTier,
  SpanBehavior,
} from "./types";

export type MonthVisibilityPolicy = "YES" | "NO" | "CONTEXT_BAND" | "IF_SPECIFIC";
export type CalendarCatalogEntry = {
  readonly renderMode: CalendarRenderMode;
  readonly markerTier?: MarkerTier;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly priorityWeight: number;
  readonly iconKey: string;
  readonly monthVisibility: MonthVisibilityPolicy;
  readonly spanBehavior: SpanBehavior;
  readonly aggregationPolicy: CalendarAggregationPolicy;
};

const entry = (value: CalendarCatalogEntry): CalendarCatalogEntry => Object.freeze(value);

/** Exhaustive 25-entry catalog from the FINAL CIBLE Brief. */
export const LIFE_EVENT_ACTIVITY_CATALOG = Object.freeze({
  shopping_commerce: entry({ renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 40, iconKey: "shopping", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  courses_alimentaires: entry({ renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 30, iconKey: "groceries", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  demarche_admin: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 55, iconKey: "administrative", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  retrait_banque: entry({ renderMode: "DetailOnly", priorityBand: 1, priorityWeight: 25, iconKey: "bank_cash", monthVisibility: "NO", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  celebration: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 90, iconKey: "celebration", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  journee_maison: entry({ renderMode: "Context", priorityBand: 1, priorityWeight: 35, iconKey: "home", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  spectacle_culture: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 90, iconKey: "culture", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  sortie_soiree: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "nightlife", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  activite_loisir: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 75, iconKey: "leisure", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  examen_permis: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 80, iconKey: "permit_exam", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  lecon_conduite: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 65, iconKey: "driving_lesson", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  livraison_repas: entry({ renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 45, iconKey: "food_delivery", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  repas_restaurant: entry({ renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 45, iconKey: "restaurant", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  rdv_medical: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 60, iconKey: "medical", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  pharmacie: entry({ renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 35, iconKey: "pharmacy", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  visite_famille: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 65, iconKey: "family", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  visite_ami: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 60, iconKey: "friends", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  soin_personnel: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 2, priorityWeight: 50, iconKey: "personal_care", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  voyage_sejour: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 95, iconKey: "travel", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  entretien_voiture: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 55, iconKey: "vehicle_service", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  carburant: entry({ renderMode: "DetailOnly", priorityBand: 1, priorityWeight: 25, iconKey: "fuel", monthVisibility: "NO", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  deplacement_pro: entry({ renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 75, iconKey: "business_trip", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  travail_site: entry({ renderMode: "Context", priorityBand: 1, priorityWeight: 70, iconKey: "work_site", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  teletravail: entry({ renderMode: "Context", priorityBand: 1, priorityWeight: 70, iconKey: "remote_work", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  funeraire: entry({ renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 100, iconKey: "funeral", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
} satisfies Record<string, CalendarCatalogEntry>);

export type LifeEventActivityTypeKey = keyof typeof LIFE_EVENT_ACTIVITY_CATALOG;

const moment = (normalizedKey: string, value: CalendarCatalogEntry) =>
  Object.freeze({ normalizedKey, ...value });

/** Exhaustive 20-entry catalog. French live labels are first-class keys, not fallbacks. */
export const MOMENT_CATALOG = Object.freeze({
  "Anniversaire": moment("anniversaire", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 90, iconKey: "birthday", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Boîte de nuit": moment("boite-de-nuit", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 85, iconKey: "nightlife", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  "Concert / spectacle": moment("concert-spectacle", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 90, iconKey: "culture", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  "Déplacement professionnel": moment("deplacement-professionnel", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "business_trip", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Entretien / contrôle véhicule": moment("entretien-controle-vehicule", { renderMode: "DetailOnly", priorityBand: 3, priorityWeight: 60, iconKey: "vehicle_service", monthVisibility: "NO", spanBehavior: "PROJECT_PERIOD", aggregationPolicy: "NONE" }),
  "Événement familial / déplacement": moment("evenement-familial-deplacement", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 90, iconKey: "family_event", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Fête / célébration": moment("fete-celebration", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 90, iconKey: "celebration", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Projet / achat maison": moment("projet-achat-maison", { renderMode: "DetailOnly", priorityBand: 3, priorityWeight: 60, iconKey: "home_project", monthVisibility: "NO", spanBehavior: "PROJECT_PERIOD", aggregationPolicy: "NONE" }),
  "Projet / séance photo": moment("projet-seance-photo", { renderMode: "DetailOnly", priorityBand: 3, priorityWeight: 60, iconKey: "photo_project", monthVisibility: "NO", spanBehavior: "PROJECT_PERIOD", aggregationPolicy: "NONE" }),
  "Projet personnel": moment("projet-personnel", { renderMode: "DetailOnly", priorityBand: 3, priorityWeight: 55, iconKey: "personal_project", monthVisibility: "NO", spanBehavior: "PROJECT_PERIOD", aggregationPolicy: "NONE" }),
  "Réparation / imprévu": moment("reparation-imprevu", { renderMode: "DetailOnly", priorityBand: 3, priorityWeight: 70, iconKey: "incident_repair", monthVisibility: "NO", spanBehavior: "INCIDENT_PERIOD", aggregationPolicy: "NONE" }),
  "Soirée": moment("soiree", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "nightlife", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  "Soirée techno": moment("soiree-techno", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 85, iconKey: "techno_night", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  "Sortie / activité": moment("sortie-activite", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 75, iconKey: "leisure", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Sortie / événement": moment("sortie-evenement", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "event_outing", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Sortie / excursion": moment("sortie-excursion", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "excursion", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  "Sortie / plage": moment("sortie-plage", { renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 70, iconKey: "beach", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  "Visite familiale": moment("visite-familiale", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 70, iconKey: "family", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  "Voyage": moment("voyage", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 95, iconKey: "travel", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  "Week-end / escapade": moment("week-end-escapade", { renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 92, iconKey: "weekend_trip", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
} satisfies Record<string, CalendarCatalogEntry & { readonly normalizedKey: string }>);

export type MomentCatalogLabel = keyof typeof MOMENT_CATALOG;

const momentByNormalizedKey = new Map(
  Object.values(MOMENT_CATALOG).map((value) => [value.normalizedKey, value]),
);

export function requireLifeEventCatalogEntry(typeKey: string): CalendarCatalogEntry {
  const value = LIFE_EVENT_ACTIVITY_CATALOG[typeKey as LifeEventActivityTypeKey];
  if (value === undefined) throw new TypeError(`Type Life Event/Activity non contractuel: ${typeKey}.`);
  return value;
}

export function requireMomentCatalogEntry(type: string): CalendarCatalogEntry & { readonly normalizedKey: string } {
  const value = MOMENT_CATALOG[type as MomentCatalogLabel] ?? momentByNormalizedKey.get(type);
  if (value === undefined) throw new TypeError(`Type Moment non contractuel: ${type}.`);
  return value;
}

export function assertCalendarCatalogsExhaustive(): void {
  if (Object.keys(LIFE_EVENT_ACTIVITY_CATALOG).length !== 25) {
    throw new TypeError("Le catalogue Life Event/Activity doit contenir exactement 25 types.");
  }
  if (Object.keys(MOMENT_CATALOG).length !== 20) {
    throw new TypeError("Le catalogue Moment doit contenir exactement 20 types.");
  }
}
