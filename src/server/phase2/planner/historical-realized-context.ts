import "server-only";
import type { ActivityOccurrenceFact, MobilityLegFact, PlaceVisitFact } from "@/analytics/facts";
import { addDays } from "@/core/time";
import type { JulyParticipant } from "./july-realized-decisions";
import { realizedPlaceKey, realizedTown, type RealizedPlace } from "./realized-places";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";

type ObservedEvent = Readonly<{ event: ActivityOccurrenceFact; title: string; places: readonly RealizedPlace[]; placeIds: readonly string[] }>;
type ParticipantIds = { adrien?: string; manon?: string };
type PlaceLookup = (id: string) => RealizedPlace | undefined;
type EventGroup = { root: ObservedEvent; members: ObservedEvent[]; end: ActivityOccurrenceFact["endDate"];
  places: RealizedPlace[]; title?: string; townsByDay: Map<string, Set<string>>; placeIds: Set<string> };

const familyTowns = new Set(["fontes", "servian"]);
const localTowns = new Set(["montpellier", "castelnau le lez"]);
const sessionKinds = new Set(["voyage_sejour", "visite_famille", "visite_ami", "celebration"]);
const tripKinds = new Set([...sessionKinds, "activite_loisir", "spectacle_culture", "sortie_soiree", "deplacement_pro"]);
const activityKinds = new Set(["courses_alimentaires", "repas_restaurant", "activite_loisir", "shopping_commerce",
  "visite_famille", "visite_ami", "spectacle_culture", "soin_personnel"]);
const coupleDefaults = new Set(["voyage_sejour", "sortie_soiree", "spectacle_culture", "celebration", "activite_loisir", "repas_restaurant", "journee_maison"]);
const townKey = (place?: RealizedPlace) => realizedPlaceKey(place?.town ?? "");
const eventTown = (item: ObservedEvent) => townKey(item.places.find(place => place.town));
const within = (day: string, start: string, end: string) => day >= start && day <= end;

export function buildHistoricalRealizedContext(items: readonly ObservedEvent[], visits: readonly PlaceVisitFact[],
  legs: readonly MobilityLegFact[], lookup: PlaceLookup, people: ParticipantIds) {
  const byId = new Map(items.map(item => [String(item.event.lifeEventId), item]));
  const parents = new Map<string, string>();
  const extendedTitles = new Map<string, string>();
  const seen = new Map<string, Set<string>>();
  const towns = new Map<string, RealizedPlace>();
  const visitedTownsByDay = new Map<string, Set<string>>();
  for (const visit of visits) {
    const place = lookup(visit.placeId), key = townKey(place);
    if (!place?.town || !key) continue;
    towns.set(key, realizedTown(place.town));
    const presence = `${visit.personId}:${visit.localDate}`;
    const at = seen.get(presence) ?? new Set();
    at.add(key);
    seen.set(presence, at);
    const dateTowns = visitedTownsByDay.get(visit.localDate) ?? new Set();
    dateTowns.add(key);
    visitedTownsByDay.set(visit.localDate, dateTowns);
  }
  const personIn = (id: string | undefined, day: string, key: string) => !!id && !!seen.get(`${id}:${day}`)?.has(key);
  const endpointTown = (endpoint: MobilityLegFact["origin"]) => {
    const mapped = endpoint.placeId ? lookup(endpoint.placeId) : undefined;
    if (mapped?.town) return townKey(mapped);
    const source = realizedPlaceKey(endpoint.sourceLabel ?? "");
    if (towns.has(source)) return source;
    return [...familyTowns].find(town => source.split(" ").includes(town)) ?? "";
  };
  const familyLegTown = (leg: MobilityLegFact) => [endpointTown(leg.destination), endpointTown(leg.origin)]
    .find(town => familyTowns.has(town));

  // Favor the explicit relationship that already exists in the historical calendar.
  for (const item of items) {
    const parent = item.event.parentLifeEventId && byId.get(item.event.parentLifeEventId);
    if (parent && sessionKinds.has(parent.event.activityId)) parents.set(item.event.lifeEventId, parent.event.lifeEventId);
  }
  function rootId(id: string) {
    const visited = new Set<string>();
    let current = id;
    while (parents.has(current) && !visited.has(current)) {
      visited.add(current);
      current = parents.get(current)!;
    }
    return visited.has(current) ? id : current;
  }
  function participant(ids: readonly string[]): JulyParticipant | undefined {
    const adrien = people.adrien && ids.includes(people.adrien);
    const manon = people.manon && ids.includes(people.manon);
    return adrien && manon ? "Couple" : adrien ? "Adrien" : manon ? "Manon" : undefined;
  }
  function elsewhere(personId: string | undefined, item: ObservedEvent, timing: readonly CanonicalRecord[]) {
    const town = eventTown(item);
    if (!personId || !town) return false;
    const bounds = timing.flatMap(row => {
      const start = Date.parse(optionalCanonicalString(row, ["start_at"]) ?? "");
      const end = Date.parse(optionalCanonicalString(row, ["end_at"]) ?? "");
      return Number.isFinite(start) && end > start ? [{ start, end }] : [];
    });
    const overlap = visits.filter(visit => visit.personId === personId && visit.interval?.kind === "known" && bounds.some(({ start, end }) =>
      visit.interval.kind === "known" && Math.min(Date.parse(visit.interval.endedAt), end) - Math.max(Date.parse(visit.interval.startedAt), start) >= 30 * 60_000));
    const observedTowns = new Set(overlap.map(visit => townKey(lookup(visit.placeId))).filter(Boolean));
    if (observedTowns.size) return !observedTowns.has(town);
    const recorded = seen.get(`${personId}:${item.event.startDate}`);
    // A precisely located overnight stay can disambiguate a visit when no hours are available.
    return item.event.startDate < item.event.endDate && ["fontes", "servian", "paris"].includes(town)
      && !!recorded?.size && !recorded.has(town)
      && !!seen.get(`${personId}:${item.event.endDate}`)?.size && !personIn(personId, item.event.endDate, town);
  }
  const hasFamilyConnection = (first: ObservedEvent, second: ObservedEvent) => {
    const from = eventTown(first), to = eventTown(second);
    return from !== to && first.event.participantIds.some(id => second.event.participantIds.includes(id))
      && legs.some(leg => leg.date === second.event.startDate && leg.source.status === "CERTIFIED_SOURCE"
        && [endpointTown(leg.origin), endpointTown(leg.destination)].includes(from)
        && [endpointTown(leg.origin), endpointTown(leg.destination)].includes(to));
  };
  const holiday = items.filter(item => item.event.activityId === "celebration"
    && /^noel\b/u.test(realizedPlaceKey(item.title)) && item.event.startDate < item.event.endDate);
  const family = items.filter(item => item.event.activityId === "visite_famille" && familyTowns.has(eventTown(item)));
  for (const item of family) {
    if (parents.has(item.event.lifeEventId)) continue;
    const town = eventTown(item);
    const candidates = holiday.filter(session => within(item.event.startDate, session.event.startDate, session.event.endDate)
      && item.event.endDate <= session.event.endDate
      && item.event.participantIds.some(id => personIn(id, item.event.startDate, town) || personIn(id, item.event.endDate, town)));
    if (candidates.length === 1) parents.set(item.event.lifeEventId, candidates[0]!.event.lifeEventId);
  }
  for (const first of family) {
    if (parents.has(first.event.lifeEventId) || first.event.startDate === first.event.endDate) continue;
    const candidates = family.filter(second => !parents.has(second.event.lifeEventId) && second.event.startDate > first.event.startDate
      && second.event.startDate <= first.event.endDate && second.event.endDate > first.event.endDate
      && hasFamilyConnection(first, second));
    if (candidates.length !== 1) continue;
    parents.set(candidates[0]!.event.lifeEventId, first.event.lifeEventId);
    extendedTitles.set(first.event.lifeEventId, "Week-end en famille · Fontès / Servian");
  }
  for (const visit of family) {
    const { lifeEventId, startDate, endDate } = visit.event;
    if (parents.has(lifeEventId) || startDate !== endDate) continue;
    const candidates = family.filter(stay => stay.event.startDate < stay.event.endDate
      && within(startDate, stay.event.startDate, stay.event.endDate) && hasFamilyConnection(stay, visit));
    if (candidates.length !== 1) continue;
    const parentId = candidates[0]!.event.lifeEventId;
    parents.set(lifeEventId, parentId);
    const root = rootId(parentId);
    if (byId.get(root)?.event.activityId === "visite_famille" && !extendedTitles.has(root)) {
      extendedTitles.set(root, "Séjour en famille · Fontès / Servian");
    }
  }

  const groups = new Map<string, EventGroup>();
  for (const item of items) {
    const id = rootId(item.event.lifeEventId);
    const root = byId.get(id)!;
    const entry: EventGroup = groups.get(id) ?? { root, members: [], end: root.event.endDate, places: [],
      title: extendedTitles.get(id), townsByDay: new Map(), placeIds: new Set() };
    entry.members.push(item);
    for (const id of item.placeIds) entry.placeIds.add(id);
    if (item.event.endDate > entry.end) entry.end = item.event.endDate;
    groups.set(id, entry);
  }
  const sessions = [...groups.values()].filter(group => sessionKinds.has(group.root.event.activityId)
    && (group.root.event.startDate < group.end || group.members.length > 1));
  for (const group of sessions) {
    const { root, members } = group;
    const participants = new Set(members.flatMap(item => item.event.participantIds));
    const anchored = new Set(members.map(eventTown).filter(Boolean));
    for (let day = root.event.startDate; day <= group.end; day = addDays(day, 1)) {
      const found = new Set(members.filter(item => within(day, item.event.startDate, item.event.endDate)).map(eventTown).filter(Boolean));
      // Shared localizations recover intermediate towns during documented stays.
      if (participants.size >= 2) {
        for (const town of seen.get(`${participants.values().next().value}:${day}`) ?? []) {
          if (!localTowns.has(town) && [...participants].every(id => personIn(id, day, town))) found.add(town);
        }
      }
      group.townsByDay.set(day, found);
      for (const town of found) {
        const place = towns.get(town);
        if (place && !anchored.has(town)) group.places.push(place);
      }
    }
  }
  for (const item of items) {
    if (parents.has(item.event.lifeEventId) || sessions.some(group => group.root === item)
      || !activityKinds.has(item.event.activityId) || item.event.startDate !== item.event.endDate) continue;
    const town = eventTown(item);
    if (!town || localTowns.has(town)) continue;
    const applicable = sessions.filter(group => group.townsByDay.get(item.event.startDate)?.has(town)
      && item.event.participantIds.some(id => personIn(id, item.event.startDate, town)
        && group.members.some(member => member.event.participantIds.includes(id))));
    if (applicable.length !== 1) continue;
    const group = applicable[0]!;
    parents.set(item.event.lifeEventId, group.root.event.lifeEventId);
    group.members.push(item);
    for (const placeId of item.placeIds) group.placeIds.add(placeId);
  }
  return {
    rootId,
    groups,
    purchaseTown(day: string, bankLabel: string) {
      const statement = ` ${realizedPlaceKey(bankLabel)} `;
      if (!statement.startsWith(" paiement par carte ") || /\b(amazon|paypal|apple com|google|www)\b/u.test(statement)) return undefined;
      const matches = [...(visitedTownsByDay.get(day) ?? [])].filter(town => town.length >= 4 && statement.includes(` ${town} `));
      return matches.length === 1 ? towns.get(matches[0]!) : undefined;
    },
    paymentEvent(day: string, place: RealizedPlace | undefined) {
      const town = townKey(place);
      if (!town || localTowns.has(town)) return undefined;
      const candidates = sessions.filter(group => group.townsByDay.get(day)?.has(town));
      return candidates.length === 1 ? candidates[0]!.root.event.lifeEventId : undefined;
    },
    tollEvent(day: string, merchant: string, legsByEvent: ReadonlyMap<string, readonly MobilityLegFact[]>) {
      if (realizedPlaceKey(merchant) !== "viaduc de millau") return undefined;
      const matches = sessions.filter(group => group.root.event.activityId === "voyage_sejour"
        && legsByEvent.get(group.root.event.lifeEventId)?.some(leg => {
          if (leg.date !== day) return false;
          const towns = [endpointTown(leg.origin), endpointTown(leg.destination)];
          return towns.includes("montpellier") && towns.some(town => ["la loubiere", "rodez"].includes(town));
        }));
      return matches.length === 1 ? matches[0]!.root.event.lifeEventId : undefined;
    },
    participant,
    eventParticipant(item: ObservedEvent, ids: readonly string[], timing: readonly CanonicalRecord[], afterWork = false) {
      const confirmed = participant(timing.filter(row => row.participation_status === "Confirmée").map(row => String(row.person_id)));
      const recorded = participant(ids);
      if (confirmed || recorded === "Couple") return confirmed === "Couple" || recorded === "Couple" ? "Couple" : confirmed;
      const { activityId, startDate } = item.event;
      const title = realizedPlaceKey(item.title);
      const town = eventTown(item);
      if (activityId === "visite_famille" && familyTowns.has(town)) {
        if (recorded === "Adrien") return "Adrien";
        return personIn(people.adrien, startDate, town) && !elsewhere(people.adrien, item, timing) ? "Couple" : recorded ?? (people.manon ? "Manon" : undefined);
      }
      if (activityId === "repas_restaurant" && (item.event.parentLifeEventId || recorded && !afterWork)) return recorded;
      if (coupleDefaults.has(activityId) && people.adrien && people.manon) {
        if (elsewhere(people.adrien, item, timing) && recorded !== "Adrien") return "Manon";
        if (elsewhere(people.manon, item, timing) && recorded !== "Manon") return "Adrien";
        return "Couple";
      }
      if (recorded) return recorded;
      if (people.manon && (activityId === "deplacement_pro" || activityId === "visite_ami" && /\bamandine\b/u.test(title))) return "Manon";
      if (people.adrien && activityId === "pharmacie" && item.places.some(place => /^pharmacie richter\b/u.test(realizedPlaceKey(place.label)))) return "Adrien";
    },
    groceryShopper(day: string, place?: RealizedPlace) {
      if (!place || place.certainty === "town") return undefined;
      const matches = items.filter(item => item.event.activityId === "courses_alimentaires"
        && item.event.startDate === day && item.placeIds.includes(place.key));
      const who = matches.length === 1 ? participant(matches[0]!.event.participantIds) : undefined;
      return who === "Adrien" || who === "Manon" ? who : undefined;
    },
    deliveryParticipant(day: PlaceVisitFact["localDate"]) {
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) return "Couple";
      const otherDay = addDays(day, weekday === 6 ? 1 : -1);
      const reachedHome = (personId: string | undefined) => personIn(personId, day, "montpellier");
      const away = (personId: string | undefined) => [day, otherDay].every(date => {
        const visited = seen.get(`${personId}:${date}`);
        return personId && visited?.size && [...visited].every(town => !localTowns.has(town));
      });
      if (reachedHome(people.adrien) && away(people.manon)) return "Adrien";
      if (reachedHome(people.manon) && away(people.adrien)) return "Manon";
      return "Couple";
    },
    familyParticipant(day: string, town: string): JulyParticipant | undefined {
      return familyTowns.has(town) && people.manon
        ? personIn(people.adrien, day, town) ? "Couple" : "Manon"
        : undefined;
    },
    familyLegTown,
    assignedLegs() {
      const result = new Map<string, MobilityLegFact[]>();
      const standalone: MobilityLegFact[] = [];
      for (const leg of legs) {
        const endpoints = [leg.origin, leg.destination];
        const ids = endpoints.flatMap(endpoint => endpoint.placeId ? [String(endpoint.placeId)] : []);
        const legTowns = endpoints.map(endpointTown);
        const candidates = [...groups.values()].filter(group => rootId(group.root.event.lifeEventId) === group.root.event.lifeEventId
          && tripKinds.has(group.root.event.activityId) && within(leg.date, group.root.event.startDate, group.end));
        const exact = candidates.filter(group => ids.some(id => group.placeIds.has(id)));
        const byTown = candidates.filter(group => sessionKinds.has(group.root.event.activityId)).filter(group => {
          const today = group.townsByDay.get(leg.date);
          return legTowns.some(town => town && !localTowns.has(town) && (today?.has(town) || eventTown(group.root) === town));
        });
        const matches = exact.length ? exact : byTown;
        if (matches.length === 1) {
          const id = matches[0]!.root.event.lifeEventId;
          const list = result.get(id) ?? [];
          list.push(leg);
          result.set(id, list);
        } else if (familyLegTown(leg)) {
          standalone.push(leg);
        }
      }
      return { result, standalone };
    },
  };
}
