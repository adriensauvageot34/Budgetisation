import type {
  CalendarAggregationPolicy,
  CalendarRenderMode,
  MarkerTier,
  SpanBehavior,
} from "./types";
import type { CalendarFilterTag } from "../../../core/history-v2";

export type MonthVisibilityPolicy = "YES" | "NO" | "CONTEXT_BAND" | "IF_SPECIFIC";
export type CalendarCatalogEntry = {
  readonly publicLabel?: string;
  readonly renderMode: CalendarRenderMode;
  readonly markerTier?: MarkerTier;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly priorityWeight: number;
  readonly iconKey: string;
  readonly monthVisibility: MonthVisibilityPolicy;
  readonly spanBehavior: SpanBehavior;
  readonly aggregationPolicy: CalendarAggregationPolicy;
};

const entry = <T extends CalendarCatalogEntry>(value: T): Readonly<T> => Object.freeze(value);

/** Exhaustive 25-entry catalog from the FINAL CIBLE Brief. */
export const LIFE_EVENT_ACTIVITY_CATALOG = Object.freeze({
  shopping_commerce: entry({ publicLabel: "Shopping / commerce", renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 40, iconKey: "shopping", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  courses_alimentaires: entry({ publicLabel: "Courses alimentaires", renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 30, iconKey: "groceries", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  demarche_admin: entry({ publicLabel: "Démarche administrative", renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 55, iconKey: "administrative", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  retrait_banque: entry({ publicLabel: "Retrait bancaire", renderMode: "DetailOnly", priorityBand: 1, priorityWeight: 25, iconKey: "bank_cash", monthVisibility: "NO", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  celebration: entry({ publicLabel: "Célébration", renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 90, iconKey: "celebration", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  journee_maison: entry({ publicLabel: "Journée à la maison", renderMode: "Context", priorityBand: 1, priorityWeight: 35, iconKey: "home", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  spectacle_culture: entry({ publicLabel: "Spectacle / culture", renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 90, iconKey: "culture", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  sortie_soiree: entry({ publicLabel: "Sortie / soirée", renderMode: "Marker", markerTier: "Dominant", priorityBand: 4, priorityWeight: 80, iconKey: "nightlife", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  activite_loisir: entry({ publicLabel: "Activité de loisir", renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 75, iconKey: "leisure", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  examen_permis: entry({ publicLabel: "Examen du permis", renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 80, iconKey: "permit_exam", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  lecon_conduite: entry({ publicLabel: "Leçon de conduite", renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 65, iconKey: "driving_lesson", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  livraison_repas: entry({ publicLabel: "Livraison de repas", renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 45, iconKey: "food_delivery", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  repas_restaurant: entry({ publicLabel: "Repas au restaurant", renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 45, iconKey: "restaurant", monthVisibility: "IF_SPECIFIC", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  rdv_medical: entry({ publicLabel: "Rendez-vous médical", renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 60, iconKey: "medical", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  pharmacie: entry({ publicLabel: "Pharmacie", renderMode: "Marker", markerTier: "Secondary", priorityBand: 2, priorityWeight: 35, iconKey: "pharmacy", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "SAME_TYPE_DAY" }),
  visite_famille: entry({ publicLabel: "Visite familiale", renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 65, iconKey: "family", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  visite_ami: entry({ publicLabel: "Visite amicale", renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 60, iconKey: "friends", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  soin_personnel: entry({ publicLabel: "Soin personnel", renderMode: "Marker", markerTier: "Standard", priorityBand: 2, priorityWeight: 50, iconKey: "personal_care", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  voyage_sejour: entry({ publicLabel: "Voyage / séjour", renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 95, iconKey: "travel", monthVisibility: "YES", spanBehavior: "AUTO_CONTINUOUS", aggregationPolicy: "NONE" }),
  entretien_voiture: entry({ publicLabel: "Entretien du véhicule", renderMode: "Marker", markerTier: "Standard", priorityBand: 3, priorityWeight: 55, iconKey: "vehicle_service", monthVisibility: "YES", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  carburant: entry({ publicLabel: "Carburant", renderMode: "DetailOnly", priorityBand: 1, priorityWeight: 25, iconKey: "fuel", monthVisibility: "NO", spanBehavior: "POINT", aggregationPolicy: "NONE" }),
  deplacement_pro: entry({ publicLabel: "Déplacement professionnel", renderMode: "Marker", markerTier: "Standard", priorityBand: 4, priorityWeight: 75, iconKey: "business_trip", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
  travail_site: entry({ publicLabel: "Travail sur site", renderMode: "Context", priorityBand: 1, priorityWeight: 70, iconKey: "work_site", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  teletravail: entry({ publicLabel: "Télétravail", renderMode: "Context", priorityBand: 1, priorityWeight: 70, iconKey: "remote_work", monthVisibility: "CONTEXT_BAND", spanBehavior: "DAILY_CONTEXT", aggregationPolicy: "NONE" }),
  funeraire: entry({ publicLabel: "Événement funéraire", renderMode: "Marker", markerTier: "Dominant", priorityBand: 5, priorityWeight: 100, iconKey: "funeral", monthVisibility: "YES", spanBehavior: "EXPLICIT_CONTINUITY", aggregationPolicy: "NONE" }),
} satisfies Record<string, CalendarCatalogEntry & { readonly publicLabel: string }>);

export type LifeEventActivityTypeKey = keyof typeof LIFE_EVENT_ACTIVITY_CATALOG;

const LIFE_EVENT_FILTER_TAGS = Object.freeze({
  shopping_commerce: ["ACTIVITY_OUTING"],
  courses_alimentaires: ["GROCERY"],
  demarche_admin: ["ACTIVITY_OUTING"],
  retrait_banque: [],
  celebration: ["EVENT_VISIT", "ACTIVITY_OUTING"],
  journee_maison: [],
  spectacle_culture: ["ACTIVITY_OUTING"],
  sortie_soiree: ["ACTIVITY_OUTING", "DINING"],
  activite_loisir: ["ACTIVITY_OUTING"],
  examen_permis: ["ACTIVITY_OUTING", "TRANSPORT"],
  lecon_conduite: ["ACTIVITY_OUTING", "TRANSPORT"],
  livraison_repas: ["DINING"],
  repas_restaurant: ["DINING"],
  rdv_medical: ["HEALTH_CARE"],
  pharmacie: ["HEALTH_CARE"],
  visite_famille: ["EVENT_VISIT"],
  visite_ami: ["EVENT_VISIT"],
  soin_personnel: ["HEALTH_CARE"],
  voyage_sejour: ["EVENT_VISIT", "ACTIVITY_OUTING", "TRANSPORT"],
  entretien_voiture: ["TRANSPORT"],
  carburant: ["TRANSPORT"],
  deplacement_pro: ["TRANSPORT", "WORK"],
  travail_site: ["WORK"],
  teletravail: ["WORK"],
  funeraire: ["EVENT_VISIT"],
} as const satisfies Record<LifeEventActivityTypeKey, readonly CalendarFilterTag[]>);

export function lifeEventFilterTags(typeKey: LifeEventActivityTypeKey): readonly CalendarFilterTag[] {
  return LIFE_EVENT_FILTER_TAGS[typeKey];
}

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

const MOMENT_FILTER_TAGS = Object.freeze({
  anniversaire: ["EVENT_VISIT"],
  "boite-de-nuit": ["ACTIVITY_OUTING", "DINING"],
  "concert-spectacle": ["ACTIVITY_OUTING"],
  "deplacement-professionnel": ["TRANSPORT", "WORK"],
  "entretien-controle-vehicule": ["TRANSPORT"],
  "evenement-familial-deplacement": ["EVENT_VISIT", "TRANSPORT"],
  "fete-celebration": ["EVENT_VISIT", "ACTIVITY_OUTING"],
  "projet-achat-maison": [],
  "projet-seance-photo": ["ACTIVITY_OUTING"],
  "projet-personnel": [],
  "reparation-imprevu": [],
  soiree: ["ACTIVITY_OUTING", "DINING"],
  "soiree-techno": ["ACTIVITY_OUTING", "DINING"],
  "sortie-activite": ["ACTIVITY_OUTING"],
  "sortie-evenement": ["EVENT_VISIT", "ACTIVITY_OUTING"],
  "sortie-excursion": ["ACTIVITY_OUTING", "TRANSPORT"],
  "sortie-plage": ["ACTIVITY_OUTING"],
  "visite-familiale": ["EVENT_VISIT"],
  voyage: ["EVENT_VISIT", "ACTIVITY_OUTING", "TRANSPORT"],
  "week-end-escapade": ["EVENT_VISIT", "ACTIVITY_OUTING", "TRANSPORT"],
} as const satisfies Record<(typeof MOMENT_CATALOG)[MomentCatalogLabel]["normalizedKey"], readonly CalendarFilterTag[]>);

export type MomentNormalizedKey = keyof typeof MOMENT_FILTER_TAGS;

export function momentFilterTags(normalizedKey: MomentNormalizedKey): readonly CalendarFilterTag[] {
  return MOMENT_FILTER_TAGS[normalizedKey];
}

const momentByPublicLabel = new Map(
  Object.entries(MOMENT_CATALOG).map(([publicLabel, value]) => [
    publicLabel,
    Object.freeze({ publicLabel, ...value }),
  ]),
);
const momentByNormalizedKey = new Map(
  [...momentByPublicLabel.values()].map((value) => [value.normalizedKey, value]),
);

export function requireLifeEventCatalogEntry(typeKey: string): CalendarCatalogEntry & { readonly publicLabel: string } {
  const value = LIFE_EVENT_ACTIVITY_CATALOG[typeKey as LifeEventActivityTypeKey];
  if (value === undefined) throw new TypeError(`Type Life Event/Activity non contractuel: ${typeKey}.`);
  return value;
}

export function requireMomentCatalogEntry(type: string): CalendarCatalogEntry & { readonly normalizedKey: string; readonly publicLabel: string } {
  const value = momentByPublicLabel.get(type) ?? momentByNormalizedKey.get(type);
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
