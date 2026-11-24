import "server-only";
import Big from "big.js";
import { sumMobilityEstimatedFuelCost, type ActivityOccurrenceFact, type MobilityLegFact } from "@/analytics/facts";
import { parseActivityCausalFinancialLinks } from "@/analytics/facts/activity-cost";
import { addDays, addMonths, parseInstant, parseLocalDate, type YearMonth } from "@/core/time";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { isArchivedRealizedMonth, isImportedRealizedMonth, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { canonicalString, optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { CanonicalRepository } from "@/server/canonical/repository";
import { buildOperationRow, groupFactsByOperation, loadOperationReferenceLabels } from "@/server/query/sources/operations";
import { operationFromCanonicalRow } from "@/server/query/sources/shared";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { matchJulyCarTrips, readJulyCarLegs } from "./july-car-trips";
import { cashActivityPlace, distinctRealizedPlaces, merchantPlaceAlias, probableMerchantPlace, realizedPlace, realizedPlaceKey, type RealizedPlace } from "./realized-places";
import { realizedWorkDays, realizedWorkPeople, workDayItems, workPurchaseDate, type ObservedWorkMeal, type RealizedWork, type WorkDay } from "./realized-work";
import { julyEventParticipant, julyPaymentParticipant, type JulyParticipant } from "./july-realized-decisions";
import { buildHistoricalRealizedContext } from "./historical-realized-context";
import { groceryDetour, groceryShopper, historicalMealPerson, historicalPaymentParticipant, historicalProjectTags, isUberRide } from "./historical-realized-patterns";
import { applyRealizedReview, parseRealizedReview, type ReviewReference } from "./realized-review";

type Art = Readonly<{ assetKey?: string; templateKey?: string; iconKey: string; src?: string }>;
type Badge = Readonly<{ label: string; sources: readonly string[] }>;
type Flow = "expense" | "income" | "refund" | "transfer" | "other";
export type RealizedPayment = Readonly<{
  id: string;
  date: string;
  activityDate?: string;
  label: string;
  bankLabel: string;
  category: string | undefined;
  preciseType?: string;
  amount: string;
  flow: Flow;
  badge: Badge | undefined;
  art: Art | undefined;
  place?: RealizedPlace;
  participant?: JulyParticipant;
  shopper?: "Adrien" | "Manon";
  shopperInferred?: boolean;
  recipient?: string;
  mobilityNote?: string;
  reviewGroup?: string;
  reviewActor?: string;
  inferredEvent?: boolean;
  components: readonly { id: string; label: string; amount: string }[];
}>;
type Occurrence = Readonly<{
  id: string; label: string; date: string; endDate: string; status: string; places: readonly RealizedPlace[];
}>;
type Section = "fixed" | "daily" | "events" | "flows";
type RelatedPayment = Readonly<{
  id: string;
  label: string;
  date: string;
  cardId: string;
  cardLabel: string;
  component?: { key: string; amount: string | null };
}>;
type RealizedCarTrip = Readonly<{
  route: string;
  compactRoute: string;
  distanceKm: string;
  estimatedFuel: string;
  legIds?: readonly string[];
  legs?: readonly { id: string; date: string; route: string; distanceKm: string; estimatedFuel: string; participant?: JulyParticipant; driver?: "Manon" }[];
}>;
export type CardGroup = {
  id: string;
  section: Section;
  label: string;
  art: Art;
  date?: string;
  endDate?: string;
  eventStatus?: string;
  places?: readonly RealizedPlace[];
  payments: RealizedPayment[];
  occurrences?: Occurrence[];
  relatedPayments?: RelatedPayment[];
  carTrip?: RealizedCarTrip;
  mobilityNote?: string;
  participant?: JulyParticipant;
  keepPaymentsTogether?: boolean;
  reviewNotes?: readonly string[];
  reviewReferences?: readonly ReviewReference[];
};
export type RealizedCard = Readonly<CardGroup & {
  amount: string | null;
  pilotSourceId?: string;
  pilotStatus?: import("@/domain/phase2/planner/july-pilot").JulyPilotStatus;
  transferAmounts?: { incoming: string; outgoing: string };
  work?: RealizedWork;
}>;
export type RealizedCardGroup = Readonly<{
  id: RealizedGroupId;
  label: string;
  shortLabel: string;
  cardIds: readonly string[];
}>;
export type RealizedBoard = Readonly<{
  month: YearMonth;
  totals: Readonly<Record<Flow, { amount: string; count: number }>>;
  operationCount: number;
  net: string;
  cards: readonly RealizedCard[];
  categoryCards?: readonly RealizedCard[];
  groups: readonly RealizedCardGroup[];
  participantPortraits: Readonly<Record<string, string>>;
  julyPortraits: Readonly<Partial<Record<JulyParticipant, string>>>;
}>;

const purchase = { templateKey: "purchase", iconKey: "activity" };
const groceries = { assetKey: "intent:groceries", iconKey: "groceries" };
const coffee = { assetKey: "scene:coffee", iconKey: "coffee" };
const restaurant = { templateKey: "restaurant", iconKey: "restaurant" };
const bar = { assetKey: "scene:bar-closed", iconKey: "night-out" };
const transport = { assetKey: "scene:transport", iconKey: "mobility" };
const activity = { templateKey: "activity", iconKey: "activity" };
const health = { iconKey: "activity" };
const beauty = { iconKey: "beauty" };
const gift = { templateKey: "gift", iconKey: "gift" };
const bank = { assetKey: "other:fee", iconKey: "savings" };
const home = { iconKey: "home" };
const cannabis = { iconKey: "tobacco", src: "/composer/realized/cannabis.webp" };

const groceriesCardId = "daily-alimentation__courses_alimentaires";
const groupDefinitions = {
  fixed: { label: "Charges fixes", shortLabel: "Charges fixes" },
  groceries: { label: "Courses alimentaires", shortLabel: "Courses" },
  restaurants: { label: "Restaurants et cafés", shortLabel: "Restauration" },
  activities: { label: "Activités et sorties", shortLabel: "Activités" },
  transport: { label: "Mobilité", shortLabel: "Mobilité" },
  daily: { label: "Vie courante", shortLabel: "Vie courante" },
  flows: { label: "Revenus et mouvements", shortLabel: "Mouvements" },
} satisfies Record<string, { label: string; shortLabel: string }>;
type RealizedGroupId = keyof typeof groupDefinitions;

function realizedGroupId(card: RealizedCard): RealizedGroupId {
  if (card.section === "fixed" || card.section === "flows") return card.section;
  if (card.id === groceriesCardId) return "groceries";
  if (["restaurant", "fast-food", "delivery"].includes(card.art.templateKey ?? "")
    || card.art.assetKey === coffee.assetKey || card.art.assetKey === bar.assetKey
    || card.id.startsWith("daily-restauration")) return "restaurants";
  if (card.art.assetKey === transport.assetKey || card.art.iconKey === "car") return "transport";
  return card.section === "events" || card.art.templateKey === "activity" ? "activities" : "daily";
}

function realizedGroups(cards: readonly RealizedCard[]): RealizedCardGroup[] {
  const members = new Map<RealizedGroupId, string[]>();
  for (const card of cards) {
    const id = realizedGroupId(card);
    const current = members.get(id);
    if (current) current.push(card.id);
    else members.set(id, [card.id]);
  }
  return (Object.keys(groupDefinitions) as RealizedGroupId[]).flatMap(id => {
    const cardIds = members.get(id);
    return cardIds?.length ? [{ ...groupDefinitions[id], id, cardIds }] : [];
  });
}

const categoryArt: Readonly<Record<string, Art>> = {
  alimentation: groceries,
  restauration: restaurant,
  tabac_vape: { iconKey: "tobacco" },
  transport_voiture: transport,
  permis_de_conduire: { assetKey: "scene:car", iconKey: "car" },
  loisirs_activites: activity,
  logement: home,
  sante: health,
  soins_personnels: beauty,
  cadeaux: gift,
  banque: bank,
  assurances: { assetKey: "other:administrative", iconKey: "savings" },
};
const specialized: Readonly<Record<string, { label?: string; art: Art; item?: Art }>> = {
  alimentation__cafe_au_travail: { label: "Cafés au travail", art: coffee, item: coffee },
  alimentation__courses_alimentaires: { label: "Courses alimentaires", art: groceries, item: { assetKey: "groceries:food", iconKey: "groceries" } },
  alimentation__boulangerie: { label: "Boulangerie", art: { assetKey: "groceries:bread", iconKey: "meal" } },
  alimentation__titres_restaurant: { label: "Titres restaurant", art: { iconKey: "ticket" } },
  restauration__bar: { label: "Bar / Apéro", art: bar },
  restauration__fast_food_snack: { label: "Restauration rapide", art: { templateKey: "fast-food", iconKey: "fast-food" } },
  restauration__glacier_dessert: { label: "Glacier / Dessert", art: { assetKey: "restaurant:dessert", iconKey: "meal" } },
  transport_voiture__carburant: { art: transport, item: { assetKey: "transport:fuel_usage", iconKey: "fuel" } },
  transport_voiture__stationnement: { art: transport, item: { assetKey: "transport:parking", iconKey: "car" } },
  transport_voiture__pieces_entretien_automobile: { art: transport, item: { assetKey: "automotive:part", iconKey: "car" } },
  soins_personnels__coiffure: { art: beauty, item: { iconKey: "haircut" } },
  loisirs_activites__activite_loisir: { art: activity, item: { assetKey: "activity:entry", iconKey: "ticket" } },
  logement__electricite: { art: home, item: { assetKey: "home:electric", iconKey: "home" } },
};
const eventVisuals: Readonly<Record<string, { label: string; art: Art; recurring?: boolean }>> = {
  travail_site: { label: "Travail sur site", art: { assetKey: "scene:work_meal", iconKey: "coffee" }, recurring: true },
  teletravail: { label: "Télétravail", art: home, recurring: true },
  journee_maison: { label: "Journées à la maison", art: home, recurring: true },
  deplacement_pro: { label: "Déplacement professionnel", art: transport },
  repas_restaurant: { label: "Restaurant", art: restaurant },
  courses_alimentaires: { label: "Courses alimentaires", art: groceries, recurring: true },
  lecon_conduite: { label: "Leçons de conduite", art: categoryArt.permis_de_conduire!, recurring: true },
  visite_famille: { label: "Visite en famille", art: { templateKey: "family-visit", iconKey: "family" } },
  visite_ami: { label: "Visite chez des amis", art: { templateKey: "friend-visit", iconKey: "family" } },
  activite_loisir: { label: "Activité de loisir", art: activity },
  sortie_soiree: { label: "Sortie / Soirée", art: { templateKey: "night-out", iconKey: "night-out" } },
  pharmacie: { label: "Pharmacie", art: health },
  shopping_commerce: { label: "Shopping", art: purchase },
  soin_personnel: { label: "Soin personnel", art: beauty },
  voyage_sejour: { label: "Séjour", art: { templateKey: "short-stay", iconKey: "travel" } },
  celebration: { label: "Célébration", art: { templateKey: "party", iconKey: "celebration" } },
  spectacle_culture: { label: "Spectacle", art: { templateKey: "activity", iconKey: "culture" } },
  rdv_medical: { label: "Rendez-vous médical", art: health },
  entretien_voiture: { label: "Entretien du véhicule", art: transport },
  retrait_banque: { label: "Retrait au distributeur", art: bank },
};

function flowOf(flux: unknown): Flow {
  switch (flux) {
    case "Dépense": return "expense";
    case "Revenu": return "income";
    case "Remboursement": return "refund";
    case "Transfert interne": return "transfer";
    default: return "other";
  }
}

function paymentCard(flow: Flow, fixed: boolean, category: string, categoryKey: string, subcategoryKey: string): CardGroup {
  const specific = specialized[subcategoryKey];
  if (flow === "expense") {
    const art = categoryArt[categoryKey] ?? purchase;
    if (fixed) return { id: `fixed-${categoryKey}`, section: "fixed", label: category, art, payments: [] };
    return {
      id: specific?.label ? `daily-${subcategoryKey}` : `daily-${categoryKey}`,
      section: "daily", label: specific?.label ?? category, art: specific?.label ? specific.art : art, payments: [],
    };
  }
  const flows = {
    income: { label: "Revenus", art: { iconKey: "savings" } },
    refund: { label: "Remboursements", art: { iconKey: "savings" } },
    transfer: { label: "Transferts internes", art: bank },
    other: { label: "Autres mouvements", art: bank },
  };
  const salary = flow === "income" && subcategoryKey === "revenus__salaire_revenu_professionnel";
  return { id: salary ? "flows-salary" : `flows-${flow}`, section: "flows",
    ...flows[flow], ...(salary ? { label: "Salaires" } : {}), payments: [] };
}

type Links = Map<string, Set<string>>;
function link(links: Links, operationId: string, eventId: string) {
  const targets = links.get(operationId) ?? new Set<string>();
  targets.add(eventId);
  links.set(operationId, targets);
}

function realizedBankSum(payments: readonly RealizedPayment[]) {
  return payments.reduce((sum, payment) => sum.plus(payment.amount), new Big(0)).toFixed(2);
}

function realizedCarTrips(trips: ReturnType<typeof matchJulyCarTrips>, places: Awaited<ReturnType<CanonicalRepository["loadEntityRows"]>>) {
  const names = new Map(places.flatMap(place => {
    const name = optionalCanonicalString(place, ["nom_canonique"]);
    if (!name) return [];
    const commune = optionalCanonicalString(place, ["commune"]);
    const privatePlace = place.private_place === true;
    const roles = derivePlannedPlaceRoles({ privatePlace, name, nature: optionalCanonicalString(place, ["nature_lieu"]) ?? null,
      usage: optionalCanonicalString(place, ["usage_principal"]) ?? null, subtype: optionalCanonicalString(place, ["sous_type"]) ?? null });
    const home = roles.includes("OWN_HOME");
    const shortName = home ? "Domicile" : privatePlace && commune ? commune
      : commune && name.endsWith(` – ${commune}`) ? name.slice(0, -commune.length - 3) : name;
    return [[String(place.place_id), { full: home ? "Domicile" : name, short: shortName }] as const];
  }));
  const summaries = new Map<string, RealizedCarTrip>();
  for (const { event, placeIds, pair } of trips) {
    const [originId, venueId, endId] = placeIds;
    const origin = names.get(originId), venue = names.get(venueId), end = names.get(endId);
    if (!origin || !venue || !end) continue;
    summaries.set(event.lifeEventId, {
      route: [origin.full, venue.full, end.full].join(" → "),
      compactRoute: originId === endId ? `${origin.short} ⇄ ${venue.short}` : `${origin.short} → … → ${end.short}`,
      distanceKm: new Big(pair[0].distanceKm).plus(pair[1].distanceKm).toFixed(2),
      estimatedFuel: new Big(sumMobilityEstimatedFuelCost(pair)).toFixed(2),
      legIds: pair.map(leg => leg.legId),
    });
  }
  return summaries;
}

function historicalCarTrip(legs: readonly MobilityLegFact[], places: ReadonlyMap<string, CanonicalRecord>,
  participant: (leg: MobilityLegFact) => JulyParticipant | undefined, driver?: "Manon", showVenue = false): RealizedCarTrip {
  const endpointLabel = (endpoint: MobilityLegFact["origin"]) => {
    const place = endpoint.placeId ? places.get(endpoint.placeId) : undefined;
    if (!place) return endpoint.sourceLabel ?? "Lieu à préciser";
    const source = optionalCanonicalString(place, ["nom_canonique"]) ?? "";
    if (place.private_place !== false) {
      return /^domicile\b/iu.test(source) ? "Montpellier · domicile" : optionalCanonicalString(place, ["commune"]) ?? "Lieu privé";
    }
    return showVenue && source ? source : optionalCanonicalString(place, ["commune"]) ?? source;
  };
  const entries = [...legs].sort((a, b) => a.date.localeCompare(b.date)
    || (a.time.observedTime ?? "").localeCompare(b.time.observedTime ?? "") || a.legId.localeCompare(b.legId)).map(leg => ({
    id: leg.legId, date: leg.date, route: `${endpointLabel(leg.origin)} → ${endpointLabel(leg.destination)}`,
    distanceKm: new Big(leg.distanceKm).toFixed(2), estimatedFuel: new Big(leg.estimatedFuelCost).toFixed(2), participant: participant(leg), driver,
  }));
  return {
    route: entries.map(entry => entry.route).join(" · "),
    compactRoute: entries.length === 1 ? entries[0]!.route : `${entries.length} tronçons de voiture`,
    distanceKm: legs.reduce((total, leg) => total.plus(leg.distanceKm), new Big(0)).toFixed(2),
    estimatedFuel: legs.reduce((total, leg) => total.plus(leg.estimatedFuelCost), new Big(0)).toFixed(2),
    legIds: entries.map(leg => leg.id),
    legs: entries,
  };
}

export async function readRealizedMonth(bootstrap: Awaited<ReturnType<typeof getBootstrapContext>>, month: YearMonth): Promise<RealizedBoard> {
  const range = { start: parseLocalDate(`${month}-01`), endExclusive: parseLocalDate(`${addMonths(month, 1)}-01`) };
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(new Date().toISOString()));
  const repository = new CanonicalRepository(createCanonicalReadClient(), context, { shareEconomicReads: true });
  const operationRead = repository.loadOperationsByBankRange(range).then(rows => rows.map(operationFromCanonicalRow));
  const factRead = repository.loadEconomicFacts(range);
  const occurrenceRead = repository.loadActivityOccurrences(range);
  const eventIds = occurrenceRead.then(events => events.map(event => event.lifeEventId));
  const july = month === JULY_COMPOSER_MONTH;
  const historical = isArchivedRealizedMonth(month);
  const imported = isImportedRealizedMonth(month);
  const reviewRead = (july || historical) && bootstrap.household
    ? repository.loadRealizedReview(bootstrap.household.householdId, month).then(parseRealizedReview)
    : Promise.resolve(undefined);
  const people = july || historical || imported ? realizedWorkPeople(bootstrap.household, bootstrap.persons) : { profiles: [], portraits: {} };
  const julyPortraits: Partial<Record<JulyParticipant, string>> = {};
  for (const profile of people.profiles) {
    if (people.portraits[profile.ref.personId]) julyPortraits[profile.name] = people.portraits[profile.ref.personId];
  }
  try {
    const image = JSON.parse(process.env.COMPOSER_COUPLE_PORTRAIT ?? "null");
    if ((july || historical) && bootstrap.household && image?.householdId === bootstrap.household.householdId
      && typeof image.portrait === "string" && image.portrait.length < 16_000 && /^[a-z\d+/]+={0,2}$/iu.test(image.portrait)) {
      julyPortraits.Couple = `data:image/webp;base64,${image.portrait}`;
    }
  } catch { /* A missing configured portrait has a text fallback. */ }
  const previousDates = (july || historical) && people.profiles.length ? operationRead.then(operations => {
    const earliest = operations.flatMap(operation => workPurchaseDate(operation.raw) ?? [])
      .filter(date => date < range.start && date >= addDays(range.start, -7)).sort()[0];
    return earliest ? repository.loadActivityOccurrences({ start: earliest, endExclusive: range.start }) : [];
  }) : [];
  const referenceRead = Promise.all([operationRead, factRead]).then(([rows, facts]) => loadOperationReferenceLabels(repository, rows, facts));
  const [operations, facts, occurrences, labels, eventDetails, localizations, aliases, directLinks, momentLinks, causalLinks, carLegs, previousWork, participants, visits, tags, products, review] = await Promise.all([
    operationRead, factRead, occurrenceRead,
    referenceRead,
    historical ? Promise.all([eventIds, previousDates]).then(([ids, previous]) =>
      repository.loadLifeEventRecords([...ids, ...previous.map(event => event.lifeEventId)])) : eventIds.then(ids => repository.loadLifeEventRecords(ids)),
    eventIds.then(ids => repository.loadLifeEventLocalizationRows(ids, "confirmed-venues")),
    referenceRead.then(labels => repository.loadRealizedMerchantPlaceAliases([...labels.merchantIdentity.keys()])),
    operationRead.then(rows => repository.loadFinancialLinkRowsByOperationIds(rows.map(operation => operation.operationId))),
    eventIds.then(ids => repository.loadMomentLifeEventRowsByLifeEventIds(ids)),
    eventIds.then(ids => repository.loadActivityCausalFinancialLinkRows(ids)).then(parseActivityCausalFinancialLinks),
    july ? readJulyCarLegs(repository) : historical
      ? repository.loadMobilityLegFacts(range).then(legs => legs.filter(leg => leg.source.status === "CERTIFIED_SOURCE")) : [],
    previousDates,
    (july || historical) && people.profiles.length ? occurrenceRead.then(events => repository.loadLifeEventParticipationRows(
      events.filter(event => historical || event.activityId === "repas_restaurant").map(event => event.lifeEventId),
    )) : [],
    july || historical ? repository.loadPlaceVisits(range) : [],
    historical && people.profiles.length ? operationRead.then(rows =>
      repository.loadRealizedOperationTags(rows.map(operation => operation.operationId), historicalProjectTags)) : [],
    historical && people.profiles.length ? operationRead.then(rows =>
      repository.loadRealizedProductPeople(rows.filter(operation => operation.raw.flux === "Dépense").map(operation => operation.operationId))) : [],
    reviewRead,
  ]);

  const mealTiming = new Map(participants.map(row => [`${row.life_event_id}:${row.person_id}`, row]));
  const timingByEvent = new Map<string, CanonicalRecord[]>();
  for (const row of participants) {
    const key = String(row.life_event_id);
    const entries = timingByEvent.get(key) ?? [];
    entries.push(row);
    timingByEvent.set(key, entries);
  }
  const tagKeysByOperation = new Map<string, string[]>();
  for (const row of tags) {
    const key = String(row.operation_id);
    const tag = optionalCanonicalString((row.tags ?? {}) as CanonicalRecord, ["tag_key"]);
    if (!tag) continue;
    const entries = tagKeysByOperation.get(key) ?? [];
    entries.push(tag);
    tagKeysByOperation.set(key, entries);
  }
  const productPeople = new Map<string, (string | undefined)[]>();
  for (const row of products) {
    const key = String(row.operation_id);
    const entries = productPeople.get(key) ?? [];
    entries.push(optionalCanonicalString(row, ["person_id"]));
    productPeople.set(key, entries);
  }
  const eventById = new Map(eventDetails.map(row => [String(row.life_event_id), row]));
  const localizationIdsByEvent: Links = new Map();
  for (const row of localizations) link(localizationIdsByEvent, String(row.life_event_id), String(row.place_id));
  const aliasesByMerchant = new Map<string, typeof aliases[number][]>();
  for (const alias of aliases) {
    const id = String(alias.merchant_id);
    const entries = aliasesByMerchant.get(id) ?? [];
    entries.push(alias);
    aliasesByMerchant.set(id, entries);
  }
  const matchedTrips = july && carLegs.length ? matchJulyCarTrips(occurrences, eventDetails, carLegs, true) : [];
  const adrien = people.profiles.find(profile => profile.name === "Adrien")?.ref.personId;
  const manon = people.profiles.find(profile => profile.name === "Manon")?.ref.personId;
  const placeIds = new Set([
    ...eventDetails.flatMap(row => optionalCanonicalString(row, ["primary_place_id"]) ?? []),
    ...localizations.map(row => String(row.place_id)),
    ...aliases.map(row => String(row.place_id)),
    ...labels.places.keys(),
    ...matchedTrips.flatMap(trip => trip.placeIds),
    ...visits.filter(visit => historical || visit.personId === adrien).map(visit => visit.placeId),
    ...(historical || july ? carLegs.flatMap(leg => [leg.origin.placeId, leg.destination.placeId].flatMap(id => id ?? [])) : []),
  ]);
  const places = placeIds.size ? await repository.loadEntityRows("places", "place_id", [...placeIds]) : [];
  const placeById = new Map(places.map(row => [String(row.place_id), row]));
  function placeOf(id: string, certainty: "confirmed" | "probable") {
    const row = placeById.get(id);
    return row && realizedPlace(row, certainty);
  }
  const workDays = realizedWorkDays([...previousWork, ...occurrences], people.profiles, historical ? eventId => {
    const id = optionalCanonicalString(eventById.get(eventId) ?? {}, ["primary_place_id"]);
    const place = id ? placeOf(id, "confirmed") : undefined;
    return place?.certainty === "town" ? { ...place, label: `Site de travail · ${place.label}`, mapsUrl: undefined } : place;
  } : undefined);
  const observedEvents = occurrences.map(event => {
    const detail = eventById.get(event.lifeEventId);
    const visual = eventVisuals[event.activityId] ?? { label: "Événement", art: activity };
    const primaryId = detail && optionalCanonicalString(detail, ["primary_place_id"]);
    const linkedIds = [...(localizationIdsByEvent.get(event.lifeEventId) ?? [])];
    const eventPlaces = distinctRealizedPlaces(linkedIds.flatMap(id => placeOf(id, "confirmed") ?? []));
    if (!eventPlaces.length && primaryId) {
      const place = placeOf(primaryId, event.validationStatus === "Confirmé" ? "confirmed" : "probable");
      if (place) eventPlaces.push(place);
    }
    return { event, title: (detail && optionalCanonicalString(detail, ["title"])?.trim()) || visual.label, places: eventPlaces,
      placeIds: primaryId ? [primaryId, ...linkedIds] : linkedIds };
  });
  const sessions = historical ? buildHistoricalRealizedContext(observedEvents, visits, carLegs, id => placeOf(id, "confirmed"), { adrien, manon }) : null;
  const assigned = sessions?.assignedLegs();
  function tripParticipant(leg: MobilityLegFact) {
    const town = sessions?.familyLegTown(leg);
    return town && sessions ? sessions.familyParticipant(leg.date, town) : undefined;
  }
  const trips = realizedCarTrips(matchedTrips, places);
  const driver = manon ? "Manon" : undefined;
  for (const [eventId, legs] of assigned?.result ?? []) trips.set(eventId, historicalCarTrip(legs, placeById, tripParticipant, driver));
  const cards = new Map<string, CardGroup>();
  const eventCards = new Map<string, CardGroup>();
  const workCards = new Map<string, { day: WorkDay; meals: ObservedWorkMeal[] }>();
  const coffeeCards = new Map<string, typeof people.profiles[number]>();
  const paidMeals = new Set<string>();
  const separateInCategory = new Set<string>();
  function getWorkCard(day: WorkDay) {
    const id = `work-${day.key}`;
    const existing = cards.get(id);
    if (existing) return existing;
    const visual = eventVisuals[day.mode === "remote" ? "teletravail" : "travail_site"]!;
    const card: CardGroup = { id, section: "events", label: day.label, art: visual.art, date: day.day, places: [day.place], payments: [] };
    cards.set(id, card);
    workCards.set(id, { day, meals: [] });
    return card;
  }
  // Create parent cards first so every child and financial link has a single owner.
  const orderedEvents = sessions ? [...observedEvents].sort((a, b) =>
    Number(sessions.rootId(a.event.lifeEventId) !== a.event.lifeEventId)
    - Number(sessions.rootId(b.event.lifeEventId) !== b.event.lifeEventId)) : observedEvents;
  const nightReturns = new Map<string, Set<CardGroup>>();
  const homeClock = new Intl.DateTimeFormat("fr-CA", { timeZone: bootstrap.household?.timezone ?? "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const travelNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const travelMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const onsite = historical ? occurrences.filter(event => event.activityId === "travail_site") : [];
  for (const observed of orderedEvents) {
    const { event, title, places: eventPlaces } = observed;
    const visual = eventVisuals[event.activityId] ?? { label: "Événement", art: activity };
    const groceryEvent = event.activityId === "courses_alimentaires"
      ? paymentCard("expense", false, visual.label, "alimentation", "alimentation__courses_alimentaires") : null;
    const id = groceryEvent?.id ?? (visual.recurring ? `events-${event.activityId}` : `event-${event.lifeEventId}`);
    const carTrip = !visual.recurring ? trips.get(event.lifeEventId) : undefined;
    const worked = workDays.forEvent(event.lifeEventId);
    const lunch = bootstrap.household && workDays.forMeal(event,
      mealTiming.get(`${event.lifeEventId}:${event.participantIds[0]}`), bootstrap.household.timezone);
    if (worked || lunch) {
      const card = getWorkCard((worked ?? lunch)!);
      eventCards.set(event.lifeEventId, card);
      if (lunch) {
        workCards.get(card.id)!.meals.push({ id: event.lifeEventId, place: eventPlaces[0] });
        if (historical) card.mobilityNote = lunch.person.name === "Adrien"
          ? "Pause de midi · marche habituelle" : "Pause de midi · voiture habituelle, essence à préciser";
      }
      continue;
    }
    const root = sessions?.rootId(event.lifeEventId);
    const parentCard = root && root !== event.lifeEventId ? eventCards.get(root) : undefined;
    if (parentCard) {
      (parentCard.occurrences ??= []).push({ id: event.lifeEventId, label: title, date: event.startDate,
        endDate: event.endDate, status: event.validationStatus, places: eventPlaces });
      parentCard.places = distinctRealizedPlaces([...(parentCard.places ?? []), ...eventPlaces]);
      eventCards.set(event.lifeEventId, parentCard);
      continue;
    }
    if (historical && ["travail_site", "teletravail"].includes(event.activityId)) continue;
    const card: CardGroup = cards.get(id) ?? {
      ...(groceryEvent ?? { id, section: "events", label: visual.recurring ? visual.label : title, art: visual.art, payments: [] }),
      ...(visual.recurring ? { occurrences: [] } : { date: event.startDate, endDate: event.endDate, eventStatus: event.validationStatus }),
      ...(carTrip ? { carTrip } : {}),
    };
    if (july && !visual.recurring) {
      const names = people.profiles.filter(profile => event.participantIds.includes(profile.ref.personId as typeof event.participantIds[number])).map(profile => profile.name);
      const family = event.activityId === "visite_famille" && /servian|fontès/iu.test(title);
      const familyVisit = family && visits.some(visit => visit.personId === adrien && visit.localDate >= event.startDate
        && visit.localDate <= event.endDate && /^(Servian|Fontès)$/iu.test(String(placeById.get(visit.placeId)?.commune)));
      const start = mealTiming.get(`${event.lifeEventId}:${event.participantIds[0]}`)?.start_at;
      const hour = typeof start === "string" && Number.isFinite(Date.parse(start)) && bootstrap.household ? Number(new Intl.DateTimeFormat("fr-FR", {
        hour: "numeric", hourCycle: "h23", timeZone: bootstrap.household.timezone,
      }).format(new Date(start))) : undefined;
      const castelnauAnge = eventPlaces.some(place => /boulangerie ange.*castelnau/iu.test(place.label));
      card.participant = julyEventParticipant(event.activityId, title, names, familyVisit, castelnauAnge ? hour : undefined);
      if (family || /chez lucas|kayak|h[oô]pital arnaud/iu.test(title) || event.activityId === "shopping_commerce") card.keepPaymentsTogether = true;
    }
    if (sessions && !visual.recurring) {
      const group = sessions.groups.get(event.lifeEventId);
      const participants = group?.members.flatMap(member => member.event.participantIds) ?? event.participantIds;
      const timing = timingByEvent.get(event.lifeEventId) ?? [];
      const afterWork = timing.some(row => {
        const start = Date.parse(optionalCanonicalString(row, ["start_at"]) ?? "");
        return Number.isFinite(start) && Number(homeClock.formatToParts(start).find(part => part.type === "hour")?.value) >= 17;
      });
      card.participant = sessions.eventParticipant(observed, participants, timing, afterWork);
      if (["sortie_soiree", "repas_restaurant", "spectacle_culture"].includes(event.activityId) && !carTrip) {
        const departures = timing.flatMap(row => {
          const start = Date.parse(optionalCanonicalString(row, ["start_at"]) ?? "");
          const person = people.profiles.find(profile => profile.ref.personId === row.person_id);
          if (!person || !Number.isFinite(start) || !["Confirmée", "Déduite"].includes(String(row.participation_status))) return [];
          const eligible = onsite.some(work => work.startDate === event.startDate && work.participantIds.includes(person.ref.personId as typeof work.participantIds[number])
            && timingByEvent.get(work.lifeEventId)?.some(part => {
              const end = Date.parse(optionalCanonicalString(part, ["end_at"]) ?? "");
              return part.person_id === row.person_id && end <= start && start - end <= 60 * 60_000;
            }));
          return eligible ? [`${person.name} · départ possible depuis le travail`] : [];
        });
        if (departures.length) card.mobilityNote = [...new Set(departures)].join(" · ");
      }
      if (event.activityId === "sortie_soiree") {
        const returns = new Set(timing.flatMap(row => {
          if (row.participation_status !== "Confirmée" && row.participation_status !== "Déduite") return [];
          const end = Date.parse(optionalCanonicalString(row, ["end_at"]) ?? "");
          if (!Number.isFinite(end)) return [];
          const parts = Object.fromEntries(homeClock.formatToParts(end).map(part => [part.type, part.value]));
          const hour = Number(parts.hour), minute = Number(parts.minute);
          return (hour > 2 || hour === 2 && minute > 0) && hour < 7 ? [`${parts.year}-${parts.month}-${parts.day}`] : [];
        }));
        if (returns.size === 1) {
          const day = [...returns][0]!;
          const candidates = nightReturns.get(day) ?? new Set();
          candidates.add(card);
          nightReturns.set(day, candidates);
          const note = /\bmelomane\b/u.test(realizedPlaceKey(title))
            ? "Retour à pied ou en Uber · à préciser" : "Retour nocturne · Uber probable, coût à confirmer";
          card.mobilityNote = [card.mobilityNote, note].filter(Boolean).join(" · ");
        }
      }
      if (group && group.members.length > 1) {
        card.endDate = group.end;
        card.label = group.title ?? card.label;
      }
      if (group?.places.length) card.places = distinctRealizedPlaces([...(card.places ?? []), ...group.places]);
      if (group && (group.members.length > 1 || event.startDate < group.end || event.activityId === "voyage_sejour")) card.keepPaymentsTogether = true;
    }
    if (eventPlaces.length) card.places = distinctRealizedPlaces([...(card.places ?? []), ...eventPlaces]);
    card.occurrences?.push({ id: event.lifeEventId, label: title, date: event.startDate, endDate: event.endDate,
      status: event.validationStatus, places: eventPlaces });
    cards.set(id, card);
    eventCards.set(event.lifeEventId, card);
  }
  for (const leg of assigned?.standalone ?? []) {
    const route = historicalCarTrip([leg], placeById, tripParticipant, driver);
    const town = sessions?.familyLegTown(leg);
    const id = `certified-trip-${leg.legId}`;
    cards.set(id, { id, section: "events", label: town === "fontes" ? "Trajet vers / depuis Fontès" : "Trajet vers / depuis Servian",
      art: transport, date: leg.date, payments: [], carTrip: route, participant: tripParticipant(leg) });
  }

  const explicit: Links = new Map(), primary: Links = new Map(), during: Links = new Map();
  for (const row of directLinks) {
    if (historical && row.relation_type === "Effectue_pendant" && row.validation_status === "Confirmé") {
      link(during, canonicalString(row, ["operation_id"], "financial_links"), canonicalString(row, ["life_event_id"], "financial_links"));
      continue;
    }
    if (row.relation_type !== "Paiement_activite" && row.relation_type !== "Cause_par_evenement" && row.relation_type !== "Preparation") continue;
    link(explicit, canonicalString(row, ["operation_id"], "financial_links"), canonicalString(row, ["life_event_id"], "financial_links"));
  }
  for (const row of momentLinks) {
    if (row.relation_type !== "Événement principal") continue;
    link(primary, canonicalString(row, ["moment_id"], "life_events"), canonicalString(row, ["life_event_id"], "life_events"));
  }
  const factsByOperation = groupFactsByOperation(facts);
  const factsByKey = new Map(facts.map(fact => [fact.canonicalComponentKey, fact]));
  const componentLinksByOperation = new Map<string, typeof causalLinks[number][]>();
  for (const relation of causalLinks) {
    if (relation.canonicalComponentKey.startsWith("operation:")) continue;
    const source = factsByKey.get(relation.canonicalComponentKey)?.sourceOperation;
    if (source?.kind !== "resolved") continue;
    const links = componentLinksByOperation.get(source.id) ?? [];
    links.push(relation);
    componentLinksByOperation.set(source.id, links);
  }
  const ridesByDay = new Map<string, number>();
  if (historical) for (const operation of operations) {
    const day = workPurchaseDate(operation.raw);
    const merchant = labels.merchantKeys.get(String(operation.raw.merchant_id)) ?? "";
    const subcategory = labels.subcategoryKeys.get(String(operation.raw.subcategory_id)) ?? "";
    if (day && operation.raw.flux === "Dépense" && isUberRide(merchant, subcategory)) {
      ridesByDay.set(day, (ridesByDay.get(day) ?? 0) + 1);
    }
  }
  const payments: RealizedPayment[] = [];
  for (const operation of operations) {
    const operationFacts = factsByOperation.get(operation.operationId) ?? [];
    const row = buildOperationRow(operation, operationFacts, labels);
    const flow = flowOf(operation.raw.flux);
    const category = row.category?.label ?? "À classer";
    const categoryKey = labels.categoryKeys.get(row.category?.id ?? "") ?? "unclassified";
    const subcategoryKey = labels.subcategoryKeys.get(row.subcategory?.id ?? "") ?? "";
    const badgeSources = row.merchantIdentityKind === "commercial" ? commerceBadgeImages({
      identityKey: row.merchant && `merchant:${row.merchant.id}`,
      sharedKey: row.merchantVisualId && `merchant:${row.merchantVisualId}`,
      category: row.merchantGenericBadgeCategory,
      policy: row.merchantBadgePolicy,
    }).map(image => image.src) : [];
    const importedLabel = imported ? optionalCanonicalString(operation.raw, ["marchand"]) : undefined;
    const label = importedLabel ?? row.merchant?.label ?? row.bankLabel;
    const merchant = row.merchant ? labels.merchantKeys.get(row.merchant.id) ?? "" : "";
    const fixed = row.fixedVariable === "fixed";
    const purchaseDate = workPurchaseDate(operation.raw);
    const alias = row.merchant && flow === "expense" && !row.canonicalPlace
      ? merchantPlaceAlias(aliasesByMerchant.get(row.merchant.id) ?? [], row.bankLabel, row.bankDate) : undefined;
    const publicPlace = flow === "expense" && row.merchantIdentityKind === "commercial" ? probableMerchantPlace(label, row.bankLabel) : undefined;
    const sourcedPlace = row.canonicalPlace ? placeOf(row.canonicalPlace.id, imported ? "probable" : "confirmed")
      : (alias && placeOf(alias.id, alias.certainty))
        ?? publicPlace;
    const place = historical && publicPlace && sourcedPlace?.certainty === "town"
      && realizedPlaceKey(sourcedPlace.town ?? "") === realizedPlaceKey(publicPlace.town ?? "") ? publicPlace
      : sourcedPlace ?? (flow === "expense" && !fixed && purchaseDate ? sessions?.purchaseTown(purchaseDate, row.bankLabel) : undefined);
    const componentLinks = componentLinksByOperation.get(operation.operationId) ?? [];
    const showComponents = componentLinks.length > 0 || operationFacts.length > 1 || operationFacts.some(fact =>
      fact.sourceKind === "Allocation" || fact.sourceKind === "Item" || fact.sourceKind === "Cash_economic_use");
    const components = showComponents ? operationFacts.map(fact => ({
        id: fact.canonicalComponentKey,
        label: (fact.subcategory.kind === "resolved" ? labels.subcategories.get(fact.subcategory.id) : undefined)
          ?? (fact.category.kind === "resolved" ? labels.categories.get(fact.category.id) : undefined)
          ?? "Composant de dépense",
        amount: fact.net,
      })) : [];
    const isCannabis = july && subcategoryKey === "tabac_vape__cannabis";
    const namedPerson = optionalCanonicalString(operation.raw, ["personne_concernee"]);
    const documentedPerson = imported && namedPerson ? people.profiles.find(person => person.name === namedPerson) : undefined;
    const explicitPeople = [...new Set(operationFacts.flatMap(fact => fact.person.kind === "resolved" ? [String(fact.person.id)] : []))];
    const historicalPeople = explicitPeople.length ? explicitPeople : people.profiles.filter(person => namedPerson
      && namedPerson.trim().toLowerCase() === person.name.toLowerCase()).map(person => person.ref.personId);
    const canonicalParticipant = sessions?.participant(historicalPeople);
    const hasPersonConflict = operationFacts.some(fact => fact.person.kind === "conflict" || fact.person.kind === "partial");
    const shared = operationFacts.flatMap(fact => fact.person.kind === "shared" ? fact.person.shares.map(share => String(share.personId)) : []);
    const bothPeople = sessions?.participant(shared) === "Couple";
    const groceryPurchase = historical && flow === "expense" && subcategoryKey === "alimentation__courses_alimentaires";
    const productOwners = productPeople.get(operation.operationId) ?? [];
    const personalProduct = !groceryPurchase && operation.raw.operation_mixte !== true && productOwners[0]
      && productOwners.every(person => person === productOwners[0]) ? sessions?.participant([productOwners[0]]) : undefined;
    const defaultParticipant = historical && adrien && manon && !hasPersonConflict
      ? historicalPaymentParticipant({ merchant, bankLabel: row.bankLabel, subcategory: subcategoryKey, flow, fixed,
        preciseType: operation.preciseType, tags: tagKeysByOperation.get(operation.operationId) })
      : undefined;
    const deliveryParticipant = merchant === "uber_eats" && flow === "expense" && purchaseDate && adrien && manon
      ? sessions?.deliveryParticipant(purchaseDate) : undefined;
    const recipient = historical && flow === "expense" && categoryKey === "cadeaux" ? namedPerson : undefined;
    const participant = july ? julyPaymentParticipant({ merchant, subcategory: subcategoryKey, fixed, place, bankLabel: row.bankLabel })
      : flow === "transfer" && defaultParticipant ? defaultParticipant
        : hasPersonConflict ? undefined : bothPeople ? "Couple" : (recipient ? undefined : canonicalParticipant)
          ?? documentedPerson?.name ?? personalProduct ?? deliveryParticipant ?? defaultParticipant;
    const observedShopper = groceryPurchase && purchaseDate ? sessions?.groceryShopper(purchaseDate, place) : undefined;
    const shopper = groceryPurchase && !hasPersonConflict && !bothPeople
      ? observedShopper ?? groceryShopper(place, operation.preciseType ?? "", row.bankLabel) : undefined;
    const weekday = purchaseDate ? new Date(`${purchaseDate}T12:00:00Z`).getUTCDay() : 0;
    const localShop = /^(montpellier|castelnau le lez)$/u.test(realizedPlaceKey(place?.town ?? ""));
    const detour = groceryPurchase && purchaseDate && place && shopper !== "Adrien" ? groceryDetour(purchaseDate, place, carLegs) : undefined;
    const mobilityNote = detour
      ? `Détour estimé · ${travelNumber.format(Number(detour.distance))} km · ${travelMoney.format(Number(detour.fuel))} d’essence comprise dans le trajet`
      : shopper === "Adrien" && weekday > 0 && weekday < 6 && localShop ? "Tram habituel · 0 € estimé" : undefined;
    const payment = {
      id: operation.operationId, date: row.bankDate, label: isCannabis ? "Retrait pour cannabis" : label, bankLabel: row.bankLabel,
      ...((july || imported) && purchaseDate ? { activityDate: purchaseDate } : {}),
      category: row.subcategory?.label ?? row.preciseType ?? row.category?.label, amount: operation.bankAmount, flow,
      ...(july && operation.preciseType ? { preciseType: operation.preciseType } : {}),
      badge: badgeSources.length ? { label, sources: badgeSources } : undefined,
      art: isCannabis ? cannabis : specialized[subcategoryKey]?.item ?? specialized[subcategoryKey]?.art,
      ...(place ? { place } : {}),
      ...(participant ? { participant } : {}),
      ...(recipient ? { recipient } : {}),
      ...(shopper ? { shopper, shopperInferred: !observedShopper } : {}),
      ...(mobilityNote ? { mobilityNote } : {}),
      components,
    } satisfies RealizedPayment;
    payments.push(payment);

    const momentId = optionalCanonicalString(operation.raw, ["moment_id"]);
    const contextualCards = new Set([...(during.get(operation.operationId) ?? [])].flatMap(id => eventCards.get(id) ?? []));
    const directEvents = explicit.get(operation.operationId);
    // A link to part of a payment does not assign the full bank movement to that event.
    const linkedEvents = directEvents ?? (momentId && !componentLinks.length ? primary.get(momentId) : undefined);
    const linkedCards = new Set([...(linkedEvents ?? [])].flatMap(id => eventCards.get(id) ?? [])
      .filter(card => directEvents || !contextualCards.has(card)));
    let card = flow === "expense" && !fixed && linkedCards.size === 1 ? [...linkedCards][0] : undefined;
    let inferredEvent = false;
    if (historical && flow === "expense" && purchaseDate && isUberRide(merchant, subcategoryKey)) {
      const returns = nightReturns.get(purchaseDate);
      const matched = returns?.size === 1 ? [...returns][0] : undefined;
      if (matched && card === matched) card.mobilityNote = "Retour nocturne · Uber associé";
      if (!card && matched && ridesByDay.get(purchaseDate) === 1 && !linkedCards.size && !componentLinks.length
        && !contextualCards.has(matched)) {
        card = matched;
        card.mobilityNote = "Retour nocturne · Uber probablement associé";
        inferredEvent = true;
      }
    }
    if (july && flow === "expense" && !fixed && purchaseDate) {
      const matchingEvent = (test: (event: ActivityOccurrenceFact, title: string) => boolean) => {
        const candidates = occurrences.filter(event => test(event, String(eventById.get(event.lifeEventId)?.title ?? "")));
        return candidates.length === 1 ? eventCards.get(candidates[0]!.lifeEventId) : undefined;
      };
      if (["boulangerie_saint_julien", "espace_fleuri", "la_fromangerie"].includes(merchant)) {
        const visit = matchingEvent((event, title) => event.startDate <= purchaseDate && purchaseDate <= event.endDate
          && event.activityId === "visite_famille" && /servian|fontès/iu.test(title));
        if (visit) {
          card = visit;
          if (merchant === "boulangerie_saint_julien") separateInCategory.add(payment.id);
        }
      }
      if (["sephora", "pharmacie_polygone"].includes(merchant)) {
        card = matchingEvent(event => event.startDate === purchaseDate && event.activityId === "shopping_commerce"
          && eventById.get(event.lifeEventId)?.primary_place_id != null
          && /polygone/iu.test(String(placeById.get(String(eventById.get(event.lifeEventId)?.primary_place_id))?.nom_canonique ?? ""))) ?? card;
      }
      if (merchant === "cent_administ_andre_benech") {
        card = matchingEvent((event, title) => event.startDate === purchaseDate && /h[oô]pital arnaud/iu.test(title)) ?? card;
      }
      if (merchant === "vinci_autoroutes") {
        card = matchingEvent((event, title) => event.startDate === purchaseDate && /servian|fontès/iu.test(title)
          && trips.has(event.lifeEventId)) ?? card;
      }
    }
    if ((july || historical && merchant === "coiffeur_paiement_en_especes") && flow === "expense" && !fixed && purchaseDate
      && subcategoryKey === "soins_personnels__coiffure") {
      const linkedCash = componentLinks.filter(relation => relation.relationType === "Paiement_activite"
        && factsByKey.get(relation.canonicalComponentKey)?.sourceKind === "Cash_economic_use"
        && relation.economicAmountLinked !== null && new Big(relation.economicAmountLinked).abs().eq(new Big(payment.amount).abs()));
      const target = linkedCash.length === 1 ? eventCards.get(linkedCash[0]!.lifeEventId) : undefined;
      if (target && (july || !card || card === target)) {
        card = target;
        card.participant = july ? "Adrien" : card.participant ?? "Adrien";
      }
    }
    if (!card && flow === "expense" && !fixed) {
      const workDay = workDays.forPayment(operation.raw, operationFacts, subcategoryKey, operation.preciseType);
      if (workDay) card = getWorkCard(workDay);
      if (!card && historical && purchaseDate && place && !linkedCards.size && !componentLinks.length && !hasPersonConflict
        && subcategoryKey.startsWith("alimentation__")) {
        const mealPerson = historicalMealPerson(place);
        const siteMeals = [...workCards.entries()].filter(([, work]) => work.day.day === purchaseDate
          && work.day.person.name === mealPerson && (!canonicalParticipant || canonicalParticipant === mealPerson)
          && work.meals.some(meal => meal.place?.key === place.key));
        if (siteMeals.length === 1) card = cards.get(siteMeals[0]![0]);
      }
    }
    if (!card && sessions && flow === "expense" && !fixed && purchaseDate && !componentLinks.length && !linkedCards.size
      && !/retrait\b/iu.test(row.bankLabel)) {
      const matched = sessions.paymentEvent(purchaseDate, place) ?? (assigned && sessions.tollEvent(purchaseDate, label, assigned.result));
      const inferredCard = matched ? eventCards.get(matched) : undefined;
      if (inferredCard && !contextualCards.has(inferredCard)) {
        card = inferredCard;
        inferredEvent = true;
      }
    }
    if (!card && imported && flow === "expense" && subcategoryKey === "alimentation__cafe_au_travail" && documentedPerson?.coffee && purchaseDate) {
      const id = `coffee-${documentedPerson.ref.personId}-${purchaseDate}`;
      card = cards.get(id) ?? { id, section: "daily", label: `Cafés au travail · ${documentedPerson.name}`,
        art: coffee, date: purchaseDate, payments: [] };
      cards.set(id, card);
      coffeeCards.set(id, documentedPerson);
    }
    if (!card) {
      const fallback = paymentCard(flow, fixed, category, categoryKey, subcategoryKey);
      card = cards.get(fallback.id) ?? fallback;
      cards.set(card.id, card);
    }
    card.payments.push(inferredEvent ? { ...payment, inferredEvent } : payment);
    const work = workCards.get(card.id);
    if (work) {
      for (const eventId of linkedEvents ?? []) paidMeals.add(eventId);
      if (historical && purchaseDate === work.day.day && place) {
        const matchingMeals = work.meals.filter(meal => meal.place?.key === place.key);
        if (matchingMeals.length === 1) paidMeals.add(matchingMeals[0]!.id);
      }
    }
    const referenceCards = new Set([...linkedCards, ...contextualCards]);
    for (const linkedCard of referenceCards) {
      if (linkedCard === card) continue;
      (linkedCard.relatedPayments ??= []).push({
        id: payment.id, label: payment.label, date: payment.date, cardId: card.id, cardLabel: card.label,
      });
    }
    for (const relation of componentLinks) {
      const linkedCard = eventCards.get(relation.lifeEventId);
      if (linkedCard && relation.relationType === "Paiement_activite"
        && factsByKey.get(relation.canonicalComponentKey)?.sourceKind === "Cash_economic_use" && !linkedCard.places?.length) {
        const cashPlace = cashActivityPlace(label);
        if (cashPlace) linkedCard.places = [cashPlace];
      }
      if (!linkedCard || linkedCard === card || linkedCards.has(linkedCard)) continue;
      const component = payment.components.find(item => item.id === relation.canonicalComponentKey);
      const related = linkedCard.relatedPayments ??= [];
      const priorIndex = related.findIndex(reference => reference.id === payment.id && reference.component?.key === relation.canonicalComponentKey);
      if (priorIndex !== -1) {
        const prior = related[priorIndex]!;
        if (prior.component?.amount !== relation.economicAmountLinked) {
          related[priorIndex] = { ...prior, component: { key: relation.canonicalComponentKey, amount: null } };
        }
        continue;
      }
      related.push({
        id: payment.id, label: component?.label ?? payment.label, date: payment.date, cardId: card.id, cardLabel: card.label,
        component: { key: relation.canonicalComponentKey, amount: relation.economicAmountLinked },
      });
    }
  }
  if (review) {
    const byEvent = new Map(observedEvents.map(observed => [String(observed.event.lifeEventId), observed]));
    const byLeg = new Map(carLegs.map(leg => [leg.legId, leg]));
    const references = new Map(payments.map(payment => [payment.id, payment]));
    const referenceIds = [...new Set(review.cards.flatMap(card => card.references?.map(reference => reference.id) ?? []))]
      .filter(id => !references.has(id));
    const external = referenceIds.length ? await repository.loadOperationsByIds(referenceIds) : [];
    const lines = new Map<string, Omit<ReviewReference, "role">>(references);
    for (const raw of external) {
      const operation = operationFromCanonicalRow(raw);
      const label = optionalCanonicalString(raw, ["marchand"]) ?? operation.label;
      lines.set(operation.operationId, { id: operation.operationId, date: operation.bankDate, label, amount: operation.bankAmount });
    }
    applyRealizedReview({
      review, cards, references: lines,
      event: id => {
        const observed = byEvent.get(id);
        return observed && { places: observed.places, eventStatus: observed.event.validationStatus };
      },
      art: kind => eventVisuals[kind]?.art ?? purchase,
      trip: (ids, participant) => {
        const legs = ids.flatMap(id => byLeg.get(id) ?? []);
        return legs.length ? historicalCarTrip(legs, placeById, leg => participant ?? tripParticipant(leg), manon ? "Manon" : undefined, true) : undefined;
      },
    });
  }
  const totals = Object.fromEntries((["expense", "income", "refund", "transfer", "other"] as const).map(flow => {
    const items = payments.filter(payment => payment.flow === flow);
    return [flow, { amount: realizedBankSum(items), count: items.length }];
  })) as RealizedBoard["totals"];
  const realizedCards: RealizedCard[] = [...cards.values()].flatMap(card => {
    const work = workCards.get(card.id);
    const coffeePerson = coffeeCards.get(card.id);
    const meals = work?.meals.filter(meal => !paidMeals.has(meal.id)) ?? [];
    if (work && !card.payments.length && !card.relatedPayments?.length && (historical || !meals.length)) return [];
    if ((july || historical) && ["events-lecon_conduite", "events-journee_maison"].includes(card.id)
      && !card.payments.length && !card.relatedPayments?.length) return [];
    const peopleOnPayments = new Set(card.payments.flatMap(payment => payment.participant ?? []));
    const participant = card.participant ?? (card.id === groceriesCardId ? "Couple"
      : peopleOnPayments.size === 1 && card.payments.every(payment => payment.participant) ? [...peopleOnPayments][0] : undefined);
    return [{
      ...card,
      ...(participant ? { participant } : {}),
      places: historical ? distinctRealizedPlaces([...(card.places ?? []), ...card.payments.flatMap(payment => payment.place ?? [])])
        : card.places?.length ? card.places : card.section === "events" ? [] : distinctRealizedPlaces(card.payments.flatMap(payment => payment.place ?? [])),
      amount: card.payments.length ? realizedBankSum(card.payments) : null,
      ...(work ? { work: { participant: work.day.person.ref, name: work.day.person.name, mode: work.day.mode,
        items: workDayItems(card.payments, meals) } } : {}),
      ...(coffeePerson ? { work: { participant: coffeePerson.ref, name: coffeePerson.name, mode: "unspecified" as const,
        items: workDayItems(card.payments, []) } } : {}),
      ...(card.payments[0]?.flow === "transfer" ? {
        transferAmounts: {
          incoming: realizedBankSum(card.payments.filter(payment => new Big(payment.amount).gt(0))),
          outgoing: realizedBankSum(card.payments.filter(payment => new Big(payment.amount).lt(0))),
        },
      } : {}),
    }];
  });
  const categoryCards = separateInCategory.size ? realizedCards.flatMap(card => {
    const standalone = card.payments.filter(payment => separateInCategory.has(payment.id));
    if (!standalone.length) return [card];
    const remaining = card.payments.filter(payment => !separateInCategory.has(payment.id));
    return [{ ...card, payments: remaining, amount: remaining.length ? realizedBankSum(remaining) : null },
      ...standalone.map(payment => ({
        id: `category-payment-${payment.id}`, section: "daily" as const, label: payment.label,
        art: payment.art ?? { assetKey: "groceries:bread", iconKey: "meal" }, date: payment.date,
        amount: payment.amount, payments: [payment], participant: card.participant, places: payment.place ? [payment.place] : [],
      }))];
  }) : undefined;
  return {
    month, totals, operationCount: payments.length,
    net: new Big(totals.income.amount).plus(totals.expense.amount).plus(totals.refund.amount).plus(totals.other.amount).toFixed(2),
    cards: realizedCards,
    ...(categoryCards ? { categoryCards } : {}),
    groups: realizedGroups(categoryCards ?? realizedCards),
    participantPortraits: people.portraits,
    julyPortraits,
  };
}
