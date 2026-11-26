import "server-only";
import Big from "big.js";
import type { ActivityOccurrenceFact, EconomicComponentFact } from "@/analytics/facts";
import { parseLocalDate, type HouseholdTimeZone } from "@/core/time";
import type { ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import type { BootstrapHousehold, BootstrapPerson } from "@/server/bootstrap/types";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import type { RealizedPayment } from "./realized-month";
import type { RealizedPlace } from "./realized-places";

const workProfiles = {
  adrien: { name: "Adrien", site: "OBS", remote: "Maison", siteTitle: "Travail sur site Adrien", coffee: true },
  manon: { name: "Manon", site: "Promotrans", remote: null, siteTitle: "Manon travail", coffee: false },
} as const;

type PersonRef = Extract<ProspectivePersonRef, { kind: "HOUSEHOLD_PERSON" }>;
type WorkPerson = typeof workProfiles[keyof typeof workProfiles] & { ref: PersonRef; siteAddress?: string };
type WorkMode = "onsite" | "remote";
export type WorkDay = Readonly<{
  key: string; label: string; mode: WorkMode; day: ActivityOccurrenceFact["startDate"]; person: WorkPerson; place: RealizedPlace;
}>;
export type ObservedWorkMeal = Readonly<{ id: string; place?: RealizedPlace }>;
export type RealizedWorkItem = Readonly<{
  id: string; label: string; count: number; amount: string | null; badge?: RealizedPayment["badge"]; place?: RealizedPlace;
}>;
export type RealizedWork = Readonly<{
  participant: PersonRef; name: string; mode: WorkMode | "unspecified"; items: readonly RealizedWorkItem[];
}>;

function firstName(label: string) {
  return label.trim().split(/\s+/u)[0]?.toLowerCase();
}

export function realizedWorkPeople(household: BootstrapHousehold | null, people: readonly BootstrapPerson[], includePortraits = true) {
  const portraits: Record<string, string> = {};
  const siteAddresses = new Map<string, string>();
  try {
    const stored = JSON.parse(process.env.COMPOSER_WORK_PROFILES ?? "null");
    if (household && stored?.householdId === household.householdId && Array.isArray(stored.profiles)) {
      for (const item of stored.profiles) {
        if (!item || typeof item.personId !== "string" || !people.some(p => p.personId === item.personId)) continue;
        if (includePortraits && typeof item.portrait === "string" && item.portrait.length < 16_000 && /^[a-z\d+/]+={0,2}$/iu.test(item.portrait)) {
          portraits[item.personId] = `data:image/webp;base64,${item.portrait}`;
        }
        if (typeof item.site?.address === "string" && item.site.address.length < 160) {
          siteAddresses.set(item.personId, item.site.address);
        }
      }
    }
  } catch { /* The work cards also work without customized portraits. */ }

  const profiles = Object.entries(workProfiles).flatMap(([key, profile]) => {
    const matches = people.filter(person => firstName(person.displayName) === key);
    return matches.length === 1 ? [{ ...profile, ref: { kind: "HOUSEHOLD_PERSON", personId: matches[0]!.personId },
      siteAddress: siteAddresses.get(matches[0]!.personId) } satisfies WorkPerson] : [];
  });
  return { portraits, profiles };
}


export function householdCouplePortrait(household: BootstrapHousehold | null) {
  if (!household) return undefined;
  try {
    const image = JSON.parse(process.env.COMPOSER_COUPLE_PORTRAIT ?? "null");
    if (image?.householdId === household.householdId && typeof image.portrait === "string"
      && image.portrait.length < 16_000 && /^[a-z\d+/]+={0,2}$/iu.test(image.portrait)) {
      return `data:image/webp;base64,${image.portrait}`;
    }
  } catch { /* Use the person's label when a portrait is unavailable. */ }
  return undefined;
}


export function workPurchaseDate(row: CanonicalRecord) {
  const date = optionalCanonicalString(row, ["date_transaction_reelle"]);
  return row.date_transaction_precision === "Jour exact" && date ? parseLocalDate(date) : undefined;
}

function personDayKey(personId: string, date: string) {
  return `${personId}:${date}`;
}

export function realizedWorkDays(events: readonly ActivityOccurrenceFact[], profiles: readonly WorkPerson[],
  historicalWorkplace?: (eventId: string) => RealizedPlace | undefined) {
  const byPerson = new Map(profiles.map(profile => [profile.ref.personId, profile]));
  const byPersonDay = new Map<string, WorkDay | null>();
  const eventKeys = new Map<string, string>();
  for (const event of events) {
    const mode = event.activityId === "travail_site" ? "onsite" : event.activityId === "teletravail" ? "remote" : undefined;
    const person = event.participantIds.length === 1 && byPerson.get(event.participantIds[0]!);
    if (!mode || !person || mode === "remote" && !person.remote || event.startDate !== event.endDate) continue;
    const day = event.startDate;
    const key = personDayKey(person.ref.personId, day);
    const prior = byPersonDay.get(key);
    eventKeys.set(event.lifeEventId, key);
    if (prior === null || prior && prior.mode !== mode) {
      byPersonDay.set(key, null);
      continue;
    }
    if (prior) continue;
    const label = mode === "remote" ? person.remote! : historicalWorkplace ? "Site de travail" : person.site;
    const address = mode === "onsite" && !historicalWorkplace ? person.siteAddress : undefined;
    const mapsUrl = mode === "onsite" && !historicalWorkplace
      ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${label}, ${address ?? "Montpellier"}` })}` : undefined;
    byPersonDay.set(key, {
      key, day, mode, person, label: mode === "onsite" ? person.siteTitle : `Télétravail ${person.name}`,
      place: mode === "onsite" && historicalWorkplace?.(event.lifeEventId) || { key: `work:${person.ref.personId}:${mode}`, label, certainty: "confirmed",
        ...(address ? { address } : {}), ...(mapsUrl ? { mapsUrl } : {}) },
    });
  }
  return {
    forEvent(eventId: string) {
      const key = eventKeys.get(eventId);
      return key ? byPersonDay.get(key) ?? undefined : undefined;
    },
    forMeal(event: ActivityOccurrenceFact, participation: CanonicalRecord | undefined, timeZone: HouseholdTimeZone) {
      if (event.activityId !== "repas_restaurant" || event.participantIds.length !== 1) return undefined;
      if (historicalWorkplace && event.parentLifeEventId) {
        const key = eventKeys.get(event.parentLifeEventId);
        const parent = key ? byPersonDay.get(key) : undefined;
        if (parent?.mode === "onsite" && parent.day === event.startDate && parent.person.ref.personId === event.participantIds[0]) return parent;
      }
      if (!participation) return undefined;
      const start = optionalCanonicalString(participation, ["start_at"]);
      const time = start && new Date(start);
      if (!time || Number.isNaN(time.getTime())) return undefined;
      const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);
      if (clock < "11:30" || clock >= "14:30") return undefined;
      const day = byPersonDay.get(personDayKey(event.participantIds[0]!, event.startDate));
      return day?.mode === "onsite" ? day : undefined;
    },
    forPayment(row: CanonicalRecord, facts: readonly EconomicComponentFact[], subcategory: string, preciseType: string | undefined) {
      const coffee = subcategory === "alimentation__cafe_au_travail";
      if (!coffee && preciseType?.trim().toLowerCase() !== "repas du midi au travail") return undefined;
      const date = workPurchaseDate(row);
      if (!date || facts.some(f => f.person.kind === "conflict" || f.person.kind === "shared" || f.person.kind === "partial")) return undefined;
      const ids = new Set(facts.flatMap(f => f.person.kind === "resolved" ? [f.person.id] : []));
      if (ids.size > 1) return undefined;
      const named = optionalCanonicalString(row, ["personne_concernee"]);
      const fallback = named ? profiles.find(profile => profile.name.toLowerCase() === firstName(named))
        : coffee ? profiles.find(profile => profile.coffee) : undefined;
      const id = ids.values().next().value ?? fallback?.ref.personId;
      return id ? byPersonDay.get(personDayKey(id, date)) ?? undefined : undefined;
    },
  };
}

export function workDayItems(payments: readonly RealizedPayment[], observedMeals: readonly ObservedWorkMeal[]): RealizedWorkItem[] {
  const byMerchant = new Map<string, { payment: RealizedPayment; count: number; amount: Big }>();
  for (const payment of payments) {
    const group = byMerchant.get(payment.label);
    if (group) {
      group.count += 1;
      group.amount = group.amount.plus(payment.amount);
    } else byMerchant.set(payment.label, { payment, count: 1, amount: new Big(payment.amount) });
  }
  return [
    ...[...byMerchant.values()].map(({ payment, count, amount }) => ({
      id: payment.id, label: payment.label, count, amount: amount.toFixed(2), badge: payment.badge,
    })),
    ...observedMeals.map(meal => ({ id: meal.id, label: meal.place?.label ?? "Repas du midi", count: 1, amount: null, place: meal.place })),
  ];
}
