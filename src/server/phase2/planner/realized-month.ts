import "server-only";
import Big from "big.js";
import { sumMobilityEstimatedFuelCost } from "@/analytics/facts";
import { parseActivityCausalFinancialLinks } from "@/analytics/facts/activity-cost";
import { addMonths, parseInstant, parseLocalDate, type YearMonth } from "@/core/time";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import type { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { createAuthorizedRuntimeContext } from "@/server/canonical/context";
import { canonicalString, optionalCanonicalString } from "@/server/canonical/record";
import { CanonicalRepository } from "@/server/canonical/repository";
import { buildOperationRow, groupFactsByOperation, loadOperationReferenceLabels } from "@/server/query/sources/operations";
import { operationFromCanonicalRow } from "@/server/query/sources/shared";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { matchJulyCarTrips, readJulyCarLegs } from "./july-car-trips";
import { cashActivityPlace, distinctRealizedPlaces, merchantPlaceAlias, probableMerchantPlace, realizedPlace, type RealizedPlace } from "./realized-places";

type Art = Readonly<{ assetKey?: string; templateKey?: string; iconKey: string }>;
type Badge = Readonly<{ label: string; sources: readonly string[] }>;
type Flow = "expense" | "income" | "refund" | "transfer" | "other";
export type RealizedPayment = Readonly<{
  id: string;
  date: string;
  label: string;
  bankLabel: string;
  category: string | undefined;
  amount: string;
  flow: Flow;
  badge: Badge | undefined;
  art: Art | undefined;
  place?: RealizedPlace;
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
}>;
type CardGroup = {
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
};
export type RealizedCard = Readonly<CardGroup & {
  amount: string | null;
  transferAmounts?: { incoming: string; outgoing: string };
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
  groups: readonly RealizedCardGroup[];
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
    });
  }
  return summaries;
}

export async function readRealizedMonth(bootstrap: Awaited<ReturnType<typeof getBootstrapContext>>, month: YearMonth): Promise<RealizedBoard> {
  const range = { start: parseLocalDate(`${month}-01`), endExclusive: parseLocalDate(`${addMonths(month, 1)}-01`) };
  const context = createAuthorizedRuntimeContext(bootstrap, parseInstant(new Date().toISOString()));
  const repository = new CanonicalRepository(createCanonicalReadClient(), context, { shareEconomicReads: true });
  const operationRead = repository.loadOperationsByBankRange(range).then(rows => rows.map(operationFromCanonicalRow));
  const factRead = repository.loadEconomicFacts(range);
  const occurrenceRead = repository.loadActivityOccurrences(range);
  const eventIds = occurrenceRead.then(events => events.map(event => event.lifeEventId));
  const referenceRead = Promise.all([operationRead, factRead]).then(([rows, facts]) => loadOperationReferenceLabels(repository, rows, facts));
  const [operations, facts, occurrences, labels, eventDetails, localizations, aliases, directLinks, momentLinks, causalLinks, carLegs] = await Promise.all([
    operationRead, factRead, occurrenceRead,
    referenceRead,
    eventIds.then(ids => repository.loadLifeEventRecords(ids)),
    eventIds.then(ids => repository.loadLifeEventLocalizationRows(ids, "confirmed-venues")),
    referenceRead.then(labels => repository.loadRealizedMerchantPlaceAliases([...labels.merchantIdentity.keys()])),
    operationRead.then(rows => repository.loadFinancialLinkRowsByOperationIds(rows.map(operation => operation.operationId))),
    eventIds.then(ids => repository.loadMomentLifeEventRowsByLifeEventIds(ids)),
    eventIds.then(ids => repository.loadActivityCausalFinancialLinkRows(ids)).then(parseActivityCausalFinancialLinks),
    month === JULY_COMPOSER_MONTH ? readJulyCarLegs(repository) : [],
  ]);

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
  const matchedTrips = carLegs.length ? matchJulyCarTrips(occurrences, eventDetails, carLegs) : [];
  const placeIds = new Set([
    ...eventDetails.flatMap(row => optionalCanonicalString(row, ["primary_place_id"]) ?? []),
    ...localizations.map(row => String(row.place_id)),
    ...aliases.map(row => String(row.place_id)),
    ...labels.places.keys(),
    ...matchedTrips.flatMap(trip => trip.placeIds),
  ]);
  const places = placeIds.size ? await repository.loadEntityRows("places", "place_id", [...placeIds]) : [];
  const placeById = new Map(places.map(row => [String(row.place_id), row]));
  function placeOf(id: string, certainty: "confirmed" | "probable") {
    const row = placeById.get(id);
    return row && realizedPlace(row, certainty);
  }
  const trips = realizedCarTrips(matchedTrips, places);
  const cards = new Map<string, CardGroup>();
  const eventCards = new Map<string, CardGroup>();
  for (const event of occurrences) {
    const detail = eventById.get(event.lifeEventId);
    const visual = eventVisuals[event.activityId] ?? { label: "Événement", art: activity };
    const title = (detail && optionalCanonicalString(detail, ["title"])?.trim()) || visual.label;
    const groceryEvent = event.activityId === "courses_alimentaires"
      ? paymentCard("expense", false, visual.label, "alimentation", "alimentation__courses_alimentaires") : null;
    const id = groceryEvent?.id ?? (visual.recurring ? `events-${event.activityId}` : `event-${event.lifeEventId}`);
    const carTrip = !visual.recurring ? trips.get(event.lifeEventId) : undefined;
    const primaryPlaceId = detail && optionalCanonicalString(detail, ["primary_place_id"]);
    const linkedIds = localizationIdsByEvent.get(event.lifeEventId);
    const eventPlaces = distinctRealizedPlaces([...(linkedIds ?? [])].flatMap(id => placeOf(id, "confirmed") ?? []));
    if (!eventPlaces.length && primaryPlaceId) {
      const place = placeOf(primaryPlaceId, event.validationStatus === "Confirmé" ? "confirmed" : "probable");
      if (place) eventPlaces.push(place);
    }
    const card: CardGroup = cards.get(id) ?? {
      ...(groceryEvent ?? { id, section: "events", label: visual.recurring ? visual.label : title, art: visual.art, payments: [] }),
      ...(visual.recurring ? { occurrences: [] } : { date: event.startDate, endDate: event.endDate, eventStatus: event.validationStatus }),
      ...(carTrip ? { carTrip } : {}),
    };
    if (eventPlaces.length) card.places = distinctRealizedPlaces([...(card.places ?? []), ...eventPlaces]);
    card.occurrences?.push({ id: event.lifeEventId, label: title, date: event.startDate, endDate: event.endDate,
      status: event.validationStatus, places: eventPlaces });
    cards.set(id, card);
    eventCards.set(event.lifeEventId, card);
  }

  const explicit: Links = new Map(), primary: Links = new Map();
  for (const row of directLinks) {
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
    const label = row.merchant?.label ?? row.bankLabel;
    const alias = row.merchant && flow === "expense" && !row.canonicalPlace
      ? merchantPlaceAlias(aliasesByMerchant.get(row.merchant.id) ?? [], row.bankLabel, row.bankDate) : undefined;
    const place = row.canonicalPlace ? placeOf(row.canonicalPlace.id, "confirmed")
      : (alias && placeOf(alias.id, alias.certainty))
        ?? (flow === "expense" && row.merchantIdentityKind === "commercial" ? probableMerchantPlace(label, row.bankLabel) : undefined);
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
    const payment = {
      id: operation.operationId, date: row.bankDate, label, bankLabel: row.bankLabel,
      category: row.subcategory?.label ?? row.preciseType ?? row.category?.label, amount: operation.bankAmount, flow,
      badge: badgeSources.length ? { label, sources: badgeSources } : undefined,
      art: specialized[subcategoryKey]?.item ?? specialized[subcategoryKey]?.art,
      ...(place ? { place } : {}),
      components,
    } satisfies RealizedPayment;
    payments.push(payment);

    const fixed = row.fixedVariable === "fixed";
    const momentId = optionalCanonicalString(operation.raw, ["moment_id"]);
    // A link to part of a payment does not assign the full bank movement to that event.
    const linkedEvents = explicit.get(operation.operationId) ?? (momentId && !componentLinks.length ? primary.get(momentId) : undefined);
    const linkedCards = new Set([...(linkedEvents ?? [])].flatMap(id => eventCards.get(id) ?? []));
    let card = flow === "expense" && !fixed && linkedEvents?.size === 1 ? [...linkedCards][0] : undefined;
    if (!card) {
      const fallback = paymentCard(flow, fixed, category, categoryKey, subcategoryKey);
      card = cards.get(fallback.id) ?? fallback;
      cards.set(card.id, card);
    }
    card.payments.push(payment);
    for (const linkedCard of linkedCards) {
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
  const totals = Object.fromEntries((["expense", "income", "refund", "transfer", "other"] as const).map(flow => {
    const items = payments.filter(payment => payment.flow === flow);
    return [flow, { amount: realizedBankSum(items), count: items.length }];
  })) as RealizedBoard["totals"];
  const realizedCards: RealizedCard[] = [...cards.values()].map(card => ({
      ...card,
      places: card.places?.length ? card.places : card.section === "events"
        ? [] : distinctRealizedPlaces(card.payments.flatMap(payment => payment.place ?? [])),
      amount: card.payments.length ? realizedBankSum(card.payments) : null,
      ...(card.payments[0]?.flow === "transfer" ? {
        transferAmounts: {
          incoming: realizedBankSum(card.payments.filter(payment => new Big(payment.amount).gt(0))),
          outgoing: realizedBankSum(card.payments.filter(payment => new Big(payment.amount).lt(0))),
        },
      } : {}),
    }));
  return {
    month, totals, operationCount: payments.length,
    net: new Big(totals.income.amount).plus(totals.expense.amount).plus(totals.refund.amount).plus(totals.other.amount).toFixed(2),
    cards: realizedCards,
    groups: realizedGroups(realizedCards),
  };
}
