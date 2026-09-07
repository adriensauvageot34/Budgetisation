import { Temporal } from "@js-temporal/polyfill";
import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { EconomicComponentFact, PersonDayFact, PlaceVisitFact, PurchaseEventFact } from "../facts";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { addMoney, type Money } from "../../core/money";
import { parseLocalDate, type LocalDate } from "../../core/time";

export const GLOBAL_M7_METHOD_VERSION = "global_place_mobility@v1" as const;
export type GlobalPlaceResolutionLevel = "VENUE" | "ADDRESS" | "SITE" | "LOCALITY" | "MUNICIPALITY" | "REGION" | "UNKNOWN";
export type GlobalVisitKind = "STOP" | "STAY" | "TRANSIT" | "PASS_THROUGH";
export type GlobalPlaceLifecycle = "NEWLY_OBSERVED" | "REGULAR" | "NEW_REGULAR" | "GROWING" | "DECLINING" | "REGULAR_STABLE" | "DORMANT" | "ABANDONED" | "ROLE_ENDED" | "OBSERVED";
export type GlobalEconomicPlaceAttributionMode = "DIRECT_CANONICAL" | "PURCHASE_ESTABLISHMENT" | "CAUSAL_EVENT_PLACE" | "DECLARED_PLACE_ATTRIBUTION";

export type GlobalPlaceNode = {
  readonly placeId: string;
  readonly parentPlaceId?: string;
  readonly resolutionLevel: GlobalPlaceResolutionLevel;
  readonly evidenceRefs: readonly string[];
};

export type GlobalVisitSemanticEvidence = {
  readonly visitKey: string;
  readonly visitKind: GlobalVisitKind;
  readonly sourceMode: "CANONICAL_VISIT" | "EXPLICIT_ACTIVITY_OR_EVENT" | "PASSIVE_LOCATION";
  readonly evidenceRefs: readonly string[];
};

export type GlobalPlaceRoleAssertion = {
  readonly personId: string;
  readonly placeId: string;
  readonly role: "HOME" | "PRIMARY_WORK" | "OTHER";
  readonly validFrom: LocalDate;
  readonly validTo?: LocalDate;
  readonly evidenceRefs: readonly string[];
};

export type GlobalPlaceNightEvidence = {
  readonly visitKey: string;
  readonly nightDate: LocalDate;
  readonly kind: "EXPLICIT_MOMENT_OR_EVENT" | "EXPLICIT_LODGING" | "GEOGRAPHIC_22_08_4H";
  readonly contextId: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalEconomicPlaceAttributionInput = {
  readonly attributionId: string;
  readonly canonicalComponentKey: string;
  readonly placeId: string;
  readonly attributedAmount: Money;
  readonly attributionMode: GlobalEconomicPlaceAttributionMode;
  readonly purchaseEventId?: string;
  readonly economicIdentityRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type GlobalPlaceEngineInput = {
  readonly householdId: string;
  readonly householdTimeZone: string;
  readonly certifiedThrough: LocalDate;
  readonly places: readonly GlobalPlaceNode[];
  readonly visits: readonly PlaceVisitFact[];
  readonly personDays: readonly PersonDayFact[];
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly purchaseEvents: readonly PurchaseEventFact[];
  readonly visitSemantics?: readonly GlobalVisitSemanticEvidence[];
  readonly nightEvidence?: readonly GlobalPlaceNightEvidence[];
  readonly roleAssertions?: readonly GlobalPlaceRoleAssertion[];
  readonly economicAttributions?: readonly GlobalEconomicPlaceAttributionInput[];
  readonly activityTypesByVisit?: Readonly<Record<string, readonly string[]>>;
  readonly narrativePlaceEvidence?: Readonly<Record<string, readonly string[]>>;
  readonly dependencyDigests: Readonly<Record<string, string>>;
};

type WorkingVisit = {
  readonly visitId: string;
  readonly personId: string;
  readonly placeId: string;
  readonly sourceVisitKeys: readonly string[];
  readonly startAt?: string;
  readonly endAt?: string;
  readonly durationMinutes?: number;
  readonly timePrecision: PlaceVisitFact["timePrecision"];
  readonly visitKind: GlobalVisitKind;
  readonly sourceMode: GlobalVisitSemanticEvidence["sourceMode"];
  readonly evidenceRefs: readonly string[];
  readonly localDate: LocalDate;
  readonly status: "KNOWN" | "PARTIAL" | "CONFLICT";
  readonly rollupOnly?: boolean;
};

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const unique = (values: readonly string[]) => [...new Set(values)].sort();
const zero = "0" as Money;
const instant = (value: string) => Temporal.Instant.from(value);
const durationMinutes = (start: string, end: string) => instant(start).until(instant(end)).total({ unit: "minutes" });
const overlapMinutes = (a: WorkingVisit, b: WorkingVisit) => {
  if (!a.startAt || !a.endAt || !b.startAt || !b.endAt) return 0;
  const start = Temporal.Instant.compare(instant(a.startAt), instant(b.startAt)) >= 0 ? a.startAt : b.startAt;
  const end = Temporal.Instant.compare(instant(a.endAt), instant(b.endAt)) <= 0 ? a.endAt : b.endAt;
  return Temporal.Instant.compare(instant(start), instant(end)) < 0 ? durationMinutes(start, end) : 0;
};
const resolutionRank: Readonly<Record<GlobalPlaceResolutionLevel, number>> = { VENUE: 6, ADDRESS: 5, SITE: 4, LOCALITY: 3, MUNICIPALITY: 2, REGION: 1, UNKNOWN: 0 };

function normalizePlaces(values: readonly GlobalPlaceNode[]) {
  const result = new Map<string, GlobalPlaceNode>();
  for (const value of values) {
    if (!value.placeId || !value.evidenceRefs.length) throw new TypeError("M7_PLACE_AUTHORITY_REQUIRED");
    const normalized = { ...value, evidenceRefs: unique(value.evidenceRefs) };
    const previous = result.get(value.placeId);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M7_CONTRADICTORY_PLACE");
    result.set(value.placeId, normalized);
  }
  for (const place of result.values()) {
    const seen = new Set([place.placeId]); let current = place;
    while (current.parentPlaceId) {
      if (seen.has(current.parentPlaceId)) throw new TypeError("M7_PLACE_HIERARCHY_CYCLE");
      seen.add(current.parentPlaceId);
      const parent = result.get(current.parentPlaceId); if (!parent) throw new TypeError("M7_MISSING_PARENT_PLACE");
      if (parent.resolutionLevel !== "UNKNOWN" && current.resolutionLevel !== "UNKNOWN" && resolutionRank[parent.resolutionLevel] >= resolutionRank[current.resolutionLevel]) throw new TypeError("M7_PARENT_MUST_BE_LESS_PRECISE");
      current = parent;
    }
  }
  return result;
}

function ancestors(placeId: string, places: ReadonlyMap<string, GlobalPlaceNode>) {
  const result: string[] = []; let current = places.get(placeId);
  while (current?.parentPlaceId) { result.push(current.parentPlaceId); current = places.get(current.parentPlaceId); }
  return result;
}
const related = (a: string, b: string, places: ReadonlyMap<string, GlobalPlaceNode>) => a === b || ancestors(a, places).includes(b) || ancestors(b, places).includes(a);

function initialVisits(input: GlobalPlaceEngineInput, places: ReadonlyMap<string, GlobalPlaceNode>): WorkingVisit[] {
  const semantics = new Map((input.visitSemantics ?? []).map((value) => [value.visitKey, value]));
  if (semantics.size !== (input.visitSemantics ?? []).length) throw new TypeError("M7_DUPLICATE_VISIT_SEMANTIC");
  return input.visits.map((fact) => {
    if (String(fact.householdId) !== input.householdId || !places.has(String(fact.placeId))) throw new TypeError("M7_VISIT_SCOPE_OR_PLACE_INVALID");
    const semantic = semantics.get(String(fact.visitKey));
    const startAt = fact.interval.kind === "known" ? fact.interval.startedAt : fact.interval.kind === "partial" && fact.interval.startedAt ? fact.interval.startedAt : undefined;
    const endAt = fact.interval.kind === "known" ? fact.interval.endedAt : fact.interval.kind === "partial" && fact.interval.endedAt ? fact.interval.endedAt : undefined;
    const minutes = startAt && endAt ? durationMinutes(startAt, endAt) : undefined;
    const sourceMode = semantic?.sourceMode ?? "CANONICAL_VISIT";
    let visitKind = semantic?.visitKind ?? "STOP";
    if (sourceMode === "PASSIVE_LOCATION" && minutes !== undefined) {
      const threshold = resolutionRank[places.get(String(fact.placeId))!.resolutionLevel] >= resolutionRank.LOCALITY ? 10 : 20;
      if (minutes < threshold) visitKind = "PASS_THROUGH";
    }
    return {
      visitId: `visit:${fact.visitKey}`, personId: String(fact.personId), placeId: String(fact.placeId), sourceVisitKeys: [String(fact.visitKey)],
      ...(startAt === undefined ? {} : { startAt }), ...(endAt === undefined ? {} : { endAt }), ...(minutes === undefined ? {} : { durationMinutes: minutes }),
      timePrecision: fact.timePrecision, visitKind, sourceMode, evidenceRefs: unique([`fct_place_visit:${fact.visitKey}`, ...(semantic?.evidenceRefs ?? [])]),
      localDate: fact.localDate, status: fact.interval.kind === "known" ? "KNOWN" as const : "PARTIAL" as const,
    };
  }).sort((a, b) => a.personId.localeCompare(b.personId) || (a.startAt ?? a.localDate).localeCompare(b.startAt ?? b.localDate) || a.visitId.localeCompare(b.visitId));
}

function mergeVisits(raw: readonly WorkingVisit[], places: ReadonlyMap<string, GlobalPlaceNode>): WorkingVisit[] {
  const result: WorkingVisit[] = [];
  for (const current of raw) {
    const previous = result.at(-1);
    const gap = previous?.endAt && current.startAt ? durationMinutes(previous.endAt, current.startAt) : Number.POSITIVE_INFINITY;
    const incompatibleBetween = previous?.endAt && current.startAt && raw.some((candidate) => candidate.personId === current.personId && candidate.placeId !== current.placeId && !related(candidate.placeId, current.placeId, places) && candidate.startAt && candidate.endAt && Temporal.Instant.compare(instant(candidate.startAt), instant(previous.endAt!)) >= 0 && Temporal.Instant.compare(instant(candidate.endAt), instant(current.startAt!)) <= 0);
    if (previous && previous.personId === current.personId && previous.placeId === current.placeId && previous.status === "KNOWN" && current.status === "KNOWN" && gap >= 0 && gap <= 15 && !incompatibleBetween && previous.visitKind === current.visitKind) {
      result[result.length - 1] = { ...previous, visitId: `merged:${digest([...previous.sourceVisitKeys, ...current.sourceVisitKeys]).slice(0, 16)}`, sourceVisitKeys: unique([...previous.sourceVisitKeys, ...current.sourceVisitKeys]), endAt: current.endAt, durationMinutes: durationMinutes(previous.startAt!, current.endAt!), evidenceRefs: unique([...previous.evidenceRefs, ...current.evidenceRefs, "policy:visit-merge-15m@v1"]) };
    } else result.push(current);
  }
  const adjusted = result.map((value) => ({ ...value }));
  for (let i = 0; i < adjusted.length; i++) for (let j = i + 1; j < adjusted.length; j++) {
    const a = adjusted[i], b = adjusted[j];
    if (a.personId !== b.personId || a.placeId === b.placeId) continue;
    const overlap = overlapMinutes(a, b); if (overlap <= 0) continue;
    if (related(a.placeId, b.placeId, places)) {
      const primary = resolutionRank[places.get(a.placeId)!.resolutionLevel] >= resolutionRank[places.get(b.placeId)!.resolutionLevel] ? a : b;
      const parent = primary === a ? b : a;
      adjusted[primary === a ? j : i] = { ...parent, rollupOnly: true };
    } else if (overlap <= 5 && a.endAt && b.startAt && Temporal.Instant.compare(instant(a.startAt!), instant(b.startAt)) <= 0) {
      adjusted[j] = { ...b, startAt: a.endAt, durationMinutes: durationMinutes(a.endAt, b.endAt!), evidenceRefs: unique([...b.evidenceRefs, "policy:overlap-boundary-5m@v1"]) };
    } else if (overlap > 5) {
      const { durationMinutes: _aDuration, ...aWithoutDuration } = a;
      const { durationMinutes: _bDuration, ...bWithoutDuration } = b;
      adjusted[i] = { ...aWithoutDuration, status: "CONFLICT" };
      adjusted[j] = { ...bWithoutDuration, status: "CONFLICT" };
    }
  }
  return adjusted;
}

function visitDaySlices(visit: WorkingVisit, timeZone: string) {
  if (!visit.startAt || !visit.endAt || visit.status !== "KNOWN") return [];
  const result: { date: LocalDate; minutes: number }[] = [];
  let cursor = instant(visit.startAt), end = instant(visit.endAt);
  while (Temporal.Instant.compare(cursor, end) < 0) {
    const zoned = cursor.toZonedDateTimeISO(timeZone), date = zoned.toPlainDate();
    const nextDay = date.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: "00:00" }).toInstant();
    const sliceEnd = Temporal.Instant.compare(nextDay, end) < 0 ? nextDay : end;
    result.push({ date: parseLocalDate(date.toString()), minutes: cursor.until(sliceEnd).total({ unit: "minutes" }) });
    cursor = sliceEnd;
  }
  return result;
}

function buildStays(visits: readonly WorkingVisit[], evidence: readonly GlobalPlaceNightEvidence[]) {
  const visitByKey = new Map(visits.flatMap((visit) => visit.sourceVisitKeys.map((key) => [key, visit] as const)));
  const rows = evidence.map((row) => {
    const visit = visitByKey.get(row.visitKey); if (!visit || !row.evidenceRefs.length) throw new TypeError("M7_NIGHT_EVIDENCE_WITHOUT_VISIT");
    return { ...row, visit };
  }).sort((a, b) => a.visit.personId.localeCompare(b.visit.personId) || a.visit.placeId.localeCompare(b.visit.placeId) || a.contextId.localeCompare(b.contextId) || a.nightDate.localeCompare(b.nightDate));
  const groups: typeof rows[] = [];
  for (const row of rows) {
    const group = groups.at(-1), previous = group?.at(-1);
    if (group && previous && previous.visit.personId === row.visit.personId && previous.visit.placeId === row.visit.placeId && previous.contextId === row.contextId && Temporal.PlainDate.from(previous.nightDate).add({ days: 1 }).toString() === row.nightDate) group.push(row);
    else groups.push([row]);
  }
  return groups.map((group) => ({ stayId: `stay:${digest(group.map((row) => [row.visit.visitId, row.nightDate, row.contextId])).slice(0, 16)}`, personIds: unique(group.map((row) => row.visit.personId)), basePlaceId: group[0].visit.placeId, startDate: group[0].nightDate, endDate: group.at(-1)!.nightDate, nightCount: group.length, visitRefs: unique(group.map((row) => row.visit.visitId)), evidenceRefs: unique(group.flatMap((row) => row.evidenceRefs)), knowledgeState: "KNOWN" as const }));
}

function monthRange(endMonth: string, count: number) {
  const end = Temporal.PlainYearMonth.from(endMonth); return Array.from({ length: count }, (_, index) => end.subtract({ months: count - 1 - index }).toString());
}

function buildLifecycle(input: { placeId: string; level: GlobalPlaceResolutionLevel; visits: readonly WorkingVisit[]; dayDates: readonly LocalDate[]; observableMonths: readonly string[]; roles: readonly GlobalPlaceRoleAssertion[]; certifiedThrough: LocalDate }) {
  const lastSix = monthRange(input.certifiedThrough.slice(0, 7), 6), previous = lastSix.slice(0, 3), recent = lastSix.slice(3);
  const units = (months: readonly string[]) => input.level === "VENUE" || input.level === "ADDRESS"
    ? input.visits.filter((visit) => months.includes((visit.startAt ?? visit.localDate).slice(0, 7))).length
    : new Set(input.dayDates.filter((date) => months.includes(date.slice(0, 7)))).size;
  const observable = (months: readonly string[]) => months.filter((month) => input.observableMonths.includes(month)).length;
  const recentRate = observable(recent) ? units(recent) / observable(recent) : undefined, previousRate = observable(previous) ? units(previous) / observable(previous) : undefined;
  const observedMonths = unique(input.visits.map((visit) => (visit.startAt ?? visit.localDate).slice(0, 7)));
  const lastObserved = [...input.visits].map((visit) => (visit.endAt ?? visit.localDate).slice(0, 7)).sort().at(-1);
  const roleEnded = input.roles.some((role) => role.placeId === input.placeId && (role.role === "HOME" || role.role === "PRIMARY_WORK") && role.validTo !== undefined && role.validTo <= input.certifiedThrough);
  const recentMonths = observedMonths.filter((month) => recent.includes(month)).length, sixMonths = observedMonths.filter((month) => lastSix.includes(month)).length;
  const noRecent = recent.every((month) => !observedMonths.includes(month) && input.observableMonths.includes(month));
  const lastSixNoVisit = lastSix.every((month) => !observedMonths.includes(month) && input.observableMonths.includes(month));
  const historicallyRegular = observedMonths.length >= 3;
  let status: GlobalPlaceLifecycle = "OBSERVED";
  if (roleEnded) status = "ROLE_ENDED";
  else if (lastSixNoVisit && historicallyRegular) status = "ABANDONED";
  else if (noRecent && historicallyRegular) status = "DORMANT";
  else if (sixMonths >= 3 && observedMonths.every((month) => lastSix.includes(month))) status = "NEW_REGULAR";
  else if (recentMonths > 0 && observedMonths.filter((month) => month < recent[0]).length === 0) status = "NEWLY_OBSERVED";
  else if (recentRate !== undefined && previousRate !== undefined && previousRate > 0 && recentRate - previousRate >= 1 && (recentRate - previousRate) / previousRate >= .3) status = "GROWING";
  else if (recentRate !== undefined && previousRate !== undefined && previousRate > 0 && recentRate - previousRate <= -1 && (recentRate - previousRate) / previousRate <= -.3) status = "DECLINING";
  else if (sixMonths >= 3 && recentRate !== undefined && previousRate !== undefined) status = "REGULAR_STABLE";
  else if (sixMonths >= 3) status = "REGULAR";
  return { status, ...(recentRate === undefined ? {} : { recentRate }), ...(previousRate === undefined ? {} : { previousRate }), observedMonths, ...(lastObserved === undefined ? {} : { lastObserved }), windowMonths: lastSix, policyRef: "global-place-lifecycle-3plus3@v1" };
}

function normalizeScores(rows: readonly { placeId: string; frequency: number; duration: number; recency: number; diversity: number; narrative: number }[]) {
  const max = (key: keyof (typeof rows)[number]) => Math.max(0, ...rows.map((row) => typeof row[key] === "number" ? row[key] as number : 0));
  const maxima = { frequency: max("frequency"), duration: max("duration"), recency: max("recency"), diversity: max("diversity"), narrative: max("narrative") };
  const n = (value: number, maximum: number) => maximum === 0 ? 0 : value / maximum;
  return rows.map((row) => ({ placeId: row.placeId, currentImportance: .3 * n(row.frequency, maxima.frequency) + .15 * n(row.duration, maxima.duration) + .15 * row.recency + .15 * n(row.diversity, maxima.diversity) + .25 * n(row.narrative, maxima.narrative), historicalImportance: .3 * n(row.frequency, maxima.frequency) + .2 * n(row.duration, maxima.duration) + .2 * n(row.diversity, maxima.diversity) + .3 * n(row.narrative, maxima.narrative), internalOnly: true as const }));
}

function resolveFinance(input: GlobalPlaceEngineInput, places: ReadonlyMap<string, GlobalPlaceNode>) {
  const facts = new Map(input.economicFacts.map((fact) => [String(fact.canonicalComponentKey), fact]));
  if (facts.size !== input.economicFacts.length) throw new TypeError("M7_DUPLICATE_ECONOMIC_COMPONENT");
  const direct: GlobalEconomicPlaceAttributionInput[] = input.economicFacts.flatMap((fact) => fact.canonicalPlace.kind === "resolved" ? [{ attributionId: `direct:${fact.canonicalComponentKey}`, canonicalComponentKey: String(fact.canonicalComponentKey), placeId: String(fact.canonicalPlace.placeId), attributedAmount: fact.net, attributionMode: "DIRECT_CANONICAL" as const, economicIdentityRefs: [`economic-component:${fact.canonicalComponentKey}`], evidenceRefs: [`operation-place:${fact.canonicalComponentKey}`] }] : []);
  const grouped = new Map<string, GlobalEconomicPlaceAttributionInput[]>();
  for (const raw of [...direct, ...(input.economicAttributions ?? [])]) {
    const fact = facts.get(raw.canonicalComponentKey); if (!fact || !places.has(raw.placeId) || !raw.evidenceRefs.length || !raw.economicIdentityRefs.length) throw new TypeError("M7_INVALID_ECONOMIC_PLACE_ATTRIBUTION");
    const values = grouped.get(raw.canonicalComponentKey) ?? []; values.push({ ...raw, economicIdentityRefs: unique(raw.economicIdentityRefs), evidenceRefs: unique(raw.evidenceRefs) }); grouped.set(raw.canonicalComponentKey, values);
  }
  const resolved: Array<GlobalEconomicPlaceAttributionInput & { readonly leafPlaceId: string; readonly knowledgeState: "KNOWN"; readonly methodVersion: typeof GLOBAL_M7_METHOD_VERSION }> = [];
  const conflicts: Array<{ readonly canonicalComponentKey: string; readonly placeIds: readonly string[]; readonly reasonCode: "INCOMPATIBLE_STRONG_PLACE_AUTHORITIES" }> = [];
  for (const [key, values] of grouped) {
    const fact = facts.get(key)!;
    const byEconomicIdentity = new Map<string, GlobalEconomicPlaceAttributionInput[]>();
    for (const value of values) {
      const identity = canonicalSerializeGlobal(value.economicIdentityRefs);
      const rows = byEconomicIdentity.get(identity) ?? []; rows.push(value); byEconomicIdentity.set(identity, rows);
    }
    const selected: GlobalEconomicPlaceAttributionInput[] = [];
    let authorityConflict = false;
    for (const identityRows of byEconomicIdentity.values()) {
      const amounts = unique(identityRows.map(({ attributedAmount }) => attributedAmount));
      const incompatible = identityRows.some((a) => identityRows.some((b) => !related(a.placeId, b.placeId, places)));
      if (amounts.length !== 1 || incompatible) { authorityConflict = true; break; }
      // The same economic identity at leaf and ancestor is one attribution;
      // retain the finest proof and derive ancestors only as roll-ups.
      selected.push([...identityRows].sort((a, b) => resolutionRank[places.get(b.placeId)!.resolutionLevel] - resolutionRank[places.get(a.placeId)!.resolutionLevel] || a.attributionId.localeCompare(b.attributionId))[0]);
    }
    if (authorityConflict) { conflicts.push({ canonicalComponentKey: key, placeIds: unique(values.map((value) => value.placeId)), reasonCode: "INCOMPATIBLE_STRONG_PLACE_AUTHORITIES" }); continue; }
    const magnitude = new Big(fact.net).abs(), total = selected.reduce((sum, value) => sum.plus(new Big(value.attributedAmount).abs()), new Big(0));
    if (total.gt(magnitude)) throw new TypeError("M7_PLACE_ALLOCATION_EXCEEDS_COMPONENT");
    for (const value of selected) resolved.push({ ...value, leafPlaceId: value.placeId, knowledgeState: "KNOWN" as const, methodVersion: GLOBAL_M7_METHOD_VERSION });
  }
  const eligible = input.economicFacts.filter((fact) => fact.canonicalPlace.kind !== "not_applicable");
  const localizedAmounts = new Map<string, Big>();
  for (const value of resolved) localizedAmounts.set(value.canonicalComponentKey, (localizedAmounts.get(value.canonicalComponentKey) ?? new Big(0)).plus(new Big(value.attributedAmount).abs()));
  const eligibleAmount = eligible.reduce((sum, fact) => sum.plus(new Big(fact.net).abs()), new Big(0));
  const localizedAmount = [...localizedAmounts.values()].reduce((sum, value) => sum.plus(value), new Big(0));
  const amountRatio = eligibleAmount.eq(0) ? undefined : localizedAmount.div(eligibleAmount).toNumber();
  const eligibleEvents = input.purchaseEvents.length;
  const localizedEventIds = new Set(input.purchaseEvents.filter((event) => {
    const componentKeys = unique(event.sources.filter(({ membershipKind }) => membershipKind === "CONSUMPTION_COMPONENT").map(({ canonicalComponentKey }) => String(canonicalComponentKey)));
    return componentKeys.length > 0 && componentKeys.every((key) => {
      const fact = facts.get(key); return fact !== undefined && (localizedAmounts.get(key) ?? new Big(0)).gte(new Big(fact.net).abs());
    });
  }).map((event) => String(event.purchaseEventId)));
  const eventRatio = eligibleEvents === 0 ? undefined : localizedEventIds.size / eligibleEvents;
  const rankingMode = amountRatio === undefined || amountRatio < .6 ? "UNAVAILABLE" as const : amountRatio < .85 ? "LOCALIZED_ONLY" as const : "GLOBAL" as const;
  const byPlace = new Map<string, Money>();
  const rollups: Array<{ readonly canonicalComponentKey: string; readonly economicIdentityRefs: readonly string[]; readonly leafPlaceId: string; readonly placeId: string; readonly resolutionLevel: GlobalPlaceResolutionLevel; readonly amount: Money }> = [];
  for (const value of resolved) {
    for (const placeId of [value.leafPlaceId, ...ancestors(value.leafPlaceId, places)]) {
      byPlace.set(placeId, addMoney(byPlace.get(placeId) ?? zero, value.attributedAmount));
      rollups.push({ canonicalComponentKey: value.canonicalComponentKey, economicIdentityRefs: value.economicIdentityRefs, leafPlaceId: value.leafPlaceId, placeId, resolutionLevel: places.get(placeId)!.resolutionLevel, amount: value.attributedAmount });
    }
  }
  return { attributions: resolved.sort((a, b) => a.attributionId.localeCompare(b.attributionId)), conflicts: conflicts.sort((a, b) => a.canonicalComponentKey.localeCompare(b.canonicalComponentKey)), localizedAmountCoverage: { status: amountRatio === undefined ? "NOT_APPLICABLE" as const : amountRatio === 1 ? "KNOWN" as const : "PARTIAL" as const, localizedEligibleEconomicAmount: localizedAmount.toFixed(), totalEligibleEconomicAmount: eligibleAmount.toFixed(), ...(amountRatio === undefined ? {} : { ratio: amountRatio }) }, localizedEventCoverage: { status: eventRatio === undefined ? "NOT_APPLICABLE" as const : eventRatio === 1 ? "KNOWN" as const : "PARTIAL" as const, localizedPurchaseEvents: localizedEventIds.size, eligiblePurchaseEvents: eligibleEvents, ...(eventRatio === undefined ? {} : { ratio: eventRatio }) }, rankingMode, amountByPlace: [...byPlace].sort(([a], [b]) => a.localeCompare(b)).map(([placeId, amount]) => ({ placeId, amount })), rollups: rollups.sort((a, b) => a.canonicalComponentKey.localeCompare(b.canonicalComponentKey) || a.placeId.localeCompare(b.placeId)) };
}

export function buildGlobalPlaceMobility(input: GlobalPlaceEngineInput) {
  parseLocalDate(input.certifiedThrough);
  const places = normalizePlaces(input.places);
  const raw = initialVisits(input, places).filter((visit) => visit.localDate <= input.certifiedThrough);
  const visits = mergeVisits(raw, places);
  const eligible = visits.filter((visit) => !visit.rollupOnly && (visit.visitKind === "STOP" || visit.visitKind === "STAY"));
  const slices = eligible.flatMap((visit) => visitDaySlices(visit, input.householdTimeZone).map((slice) => ({ ...slice, visitId: visit.visitId, personId: visit.personId, placeId: visit.placeId, explicitlyProved: visit.sourceMode !== "PASSIVE_LOCATION" })));
  const dayGroups = new Map<string, typeof slices>();
  for (const slice of slices) { const key = `${slice.personId}:${slice.placeId}:${slice.date}`, rows = dayGroups.get(key) ?? []; rows.push(slice); dayGroups.set(key, rows); }
  const visitDays = [...dayGroups].flatMap(([key, rows]) => {
    const minutes = rows.reduce((sum, row) => sum + row.minutes, 0), first = rows[0];
    return minutes >= 15 || rows.some((row) => row.explicitlyProved) ? [{ dayKey: key, personId: first.personId, placeId: first.placeId, localDate: first.date, durationMinutes: minutes, visitRefs: unique(rows.map((row) => row.visitId)) }] : [];
  }).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const roles = (input.roleAssertions ?? []).map((role) => ({ ...role, validFrom: parseLocalDate(role.validFrom), ...(role.validTo === undefined ? {} : { validTo: parseLocalDate(role.validTo) }), evidenceRefs: unique(role.evidenceRefs) }));
  const observableMonthsByPerson = new Map<string, Set<string>>();
  for (const day of input.personDays.filter((day) => String(day.householdId) === input.householdId && day.localDate <= input.certifiedThrough && day.locationObservability !== "unknown")) { const set = observableMonthsByPerson.get(String(day.personId)) ?? new Set<string>(); set.add(day.localDate.slice(0, 7)); observableMonthsByPerson.set(String(day.personId), set); }
  const placeMetrics = [...places.values()].map((place) => {
    const placeVisits = eligible.filter((visit) => visit.placeId === place.placeId), days = visitDays.filter((day) => day.placeId === place.placeId);
    const persons = unique(placeVisits.map((visit) => visit.personId));
    const observableMonths = unique(persons.flatMap((personId) => [...(observableMonthsByPerson.get(personId) ?? [])]));
    const activityTypes = unique(placeVisits.flatMap((visit) => visit.sourceVisitKeys.flatMap((key) => input.activityTypesByVisit?.[key] ?? [])));
    const narrativeRefs = unique(input.narrativePlaceEvidence?.[place.placeId] ?? []);
    const lastDate = [...days.map((day) => day.localDate)].sort().at(-1);
    const monthsAgo = lastDate === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Temporal.PlainYearMonth.from(lastDate.slice(0, 7)).until(Temporal.PlainYearMonth.from(input.certifiedThrough.slice(0, 7))).months);
    const lifecycle = buildLifecycle({ placeId: place.placeId, level: place.resolutionLevel, visits: placeVisits, dayDates: days.map((day) => day.localDate), observableMonths, roles, certifiedThrough: input.certifiedThrough });
    const activeRoutine = roles.some((role) => role.placeId === place.placeId && (role.role === "HOME" || role.role === "PRIMARY_WORK") && role.validFrom <= input.certifiedThrough && (role.validTo === undefined || role.validTo > input.certifiedThrough));
    const durationValues = placeVisits.flatMap((visit) => visit.durationMinutes === undefined ? [] : [visit.durationMinutes]).sort((a, b) => a - b);
    const medianDuration = durationValues.length ? durationValues[Math.floor((durationValues.length - 1) / 2)] : undefined;
    const visitRate = observableMonths.length ? placeVisits.length / observableMonths.length : undefined;
    return { placeId: place.placeId, resolutionLevel: place.resolutionLevel, visitCount: placeVisits.length, visitDays: days.length, totalObservedDuration: placeVisits.reduce((sum, visit) => sum + (visit.durationMinutes ?? 0), 0), ...(medianDuration === undefined ? {} : { medianDuration }), observableMonthCount: observableMonths.length, ...(visitRate === undefined ? {} : { visitRate }), activityTypes, narrativeEvidenceRefs: narrativeRefs, lifecycle, roleStatus: lifecycle.status === "ROLE_ENDED" ? "ROLE_ENDED" as const : activeRoutine ? "ACTIVE_ROUTINE" as const : "UNKNOWN" as const, routinePlacePenalty: activeRoutine ? .35 : 1, rawImportanceInputs: { frequency: observableMonths.length ? placeVisits.length / observableMonths.length : 0, duration: placeVisits.reduce((sum, visit) => sum + (visit.durationMinutes ?? 0), 0), recency: Number.isFinite(monthsAgo) ? 1 / (1 + monthsAgo) : 0, diversity: activityTypes.length, narrative: narrativeRefs.length } };
  });
  const scores = new Map(normalizeScores(placeMetrics.map((metric) => ({ placeId: metric.placeId, ...metric.rawImportanceInputs }))).map((score) => [score.placeId, score]));
  const placesOutput = placeMetrics.map(({ rawImportanceInputs: _raw, ...metric }) => ({ ...metric, importance: scores.get(metric.placeId)!, discoveryImportance: scores.get(metric.placeId)!.currentImportance * metric.routinePlacePenalty })).sort((a, b) => b.discoveryImportance - a.discoveryImportance || a.placeId.localeCompare(b.placeId));
  const discoveryRail = (() => { const output: string[] = [], routine = new Set<string>(); for (const place of placesOutput) { if (place.roleStatus === "ACTIVE_ROUTINE" && routine.size >= 1) continue; output.push(place.placeId); if (place.roleStatus === "ACTIVE_ROUTINE") routine.add(place.placeId); if (output.length === 6) break; } return output; })();
  const stays = buildStays(visits, input.nightEvidence ?? []);
  const transitions = unique(eligible.map((visit) => visit.personId)).flatMap((personId) => {
    const ordered = eligible.filter((visit) => visit.personId === personId && visit.startAt && visit.endAt).sort((a, b) => a.startAt!.localeCompare(b.startAt!));
    return ordered.slice(1).flatMap((destination, index) => { const origin = ordered[index]; return origin.placeId === destination.placeId ? [] : [{ transitionId: `od:${digest([personId, origin.visitId, destination.visitId]).slice(0, 16)}`, personId, originPlaceId: origin.placeId, destinationPlaceId: destination.placeId, originVisitId: origin.visitId, destinationVisitId: destination.visitId, routeKnown: false as const, distanceKnown: false as const, modeKnown: false as const, evidenceRefs: unique([...origin.evidenceRefs, ...destination.evidenceRefs]) }]; });
  });
  const finance = resolveFinance(input, places);
  const mobilityCapabilities = {
    placeVisits: { state: "AVAILABLE" as const, reasonCodes: [] as string[] },
    placeEvolution: { state: "AVAILABLE" as const, reasonCodes: [] as string[] },
    placeImportance: { state: "AVAILABLE" as const, reasonCodes: [] as string[] },
    stays: { state: "AVAILABLE" as const, reasonCodes: stays.length ? [] as string[] : ["DATA_GATED_NO_NIGHT_EVIDENCE"] },
    routes: { state: "UNAVAILABLE" as const, authorityGateIds: ["AG006", "AG007"], reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"] },
    routeDistance: { state: "UNAVAILABLE" as const, authorityGateIds: ["AG009"], reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"] },
    fuelEstimation: { state: "UNAVAILABLE" as const, authorityGateIds: ["AG001", "AG010", "AG011"], reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"] },
    sharedTrips: { state: "UNAVAILABLE" as const, authorityGateIds: ["AG023"], reasonCodes: ["AUTHORITY_NOT_PROVEN_GA0"] },
    localizedFinance: { state: "AVAILABLE" as const, reasonCodes: finance.attributions.length ? [] as string[] : ["DATA_GATED_NO_LOCALIZED_COMPONENT"] },
    localizedFinanceRanking: { state: finance.rankingMode === "UNAVAILABLE" ? "UNAVAILABLE" as const : "AVAILABLE" as const, reasonCodes: finance.rankingMode === "UNAVAILABLE" ? ["INSUFFICIENT_LOCALIZED_AMOUNT_COVERAGE"] : [] as string[] },
  };
  const mobility = {
    legs: [] as const,
    routes: [] as const,
    costSummaries: [] as const,
    estimatedUsageCost: { status: "UNKNOWN" as const, reasonCode: "AUTHORITY_NOT_PROVEN_GA0" },
    observedFuelDoubleCountPrevented: true as const,
  };
  const consumedRefs = unique([
    ...input.places.flatMap((place) => place.evidenceRefs), ...input.visits.map((visit) => `fct_place_visit:${visit.visitKey}`),
    ...input.personDays.map((day) => `fct_person_day:${day.personDayId}`), ...input.economicFacts.map((fact) => `economic-component:${fact.canonicalComponentKey}`),
    ...input.purchaseEvents.map((event) => `purchase-event:${event.purchaseEventId}`), ...(input.visitSemantics ?? []).flatMap((row) => row.evidenceRefs),
    ...(input.nightEvidence ?? []).flatMap((row) => row.evidenceRefs), ...roles.flatMap((row) => row.evidenceRefs), ...(input.economicAttributions ?? []).flatMap((row) => row.evidenceRefs),
    ...Object.values(input.activityTypesByVisit ?? {}).flatMap((values) => values.map((value) => `activity-type:${value}`)), ...Object.values(input.narrativePlaceEvidence ?? {}).flat(),
  ]);
  for (const ref of consumedRefs) if (!input.dependencyDigests[ref]) throw new TypeError(`M7_DEPENDENCY_CLOSURE_MISSING:${ref}`);
  const dependencyClosure = consumedRefs.map((ref) => ({ ref, digest: input.dependencyDigests[ref] }));
  const policies = { visit: "global-place-visit-resolution@v1", merge: "global-place-merge-15m@v1", overlap: "global-place-overlap-5m@v1", days: "global-place-visit-day-15m@v1", stay: "global-place-night-evidence@v1", importance: "global-place-importance@v1", lifecycle: "global-place-lifecycle-3plus3@v1", finance: "global-place-finance-coverage-85-60@v1", mobility: "ga0-authority-gates@v1" };
  const crossModuleSignals = placesOutput.flatMap((place) => ["NEW_REGULAR", "GROWING", "DECLINING", "ROLE_ENDED"].includes(place.lifecycle.status) ? [{ signalId: `place:${place.placeId}:${place.lifecycle.status}`, placeId: place.placeId, kind: place.lifecycle.status, m3Eligible: place.lifecycle.status !== "NEWLY_OBSERVED" }] : []);
  const relationshipReplay = { m6MomentDefinitionsExamined: true, m7MobilityDefinitions: "EXCLUDED_AUTHORITY_GATED" as const, m7PlaceDefinitions: "EXAMINED_CORE_ONLY" as const, fdrUniverseChanged: false as const, reason: "NO_NEW_ELIGIBLE_STATISTICAL_DEFINITION_WITH_AUTHORITATIVE_COMPARATOR_AND_OUTCOME", sourceDependsOnRelationshipResult: false as const };
  const output = { methodVersion: GLOBAL_M7_METHOD_VERSION, policies, visits, visitDays, stays, transitions, places: placesOutput, discoveryRail, finance, mobilityCapabilities, mobility, crossModuleSignals, relationshipReplay, dependencyClosure, liveWrites: "NONE" as const };
  const semanticInput = {
    householdId: input.householdId,
    householdTimeZone: input.householdTimeZone,
    certifiedThrough: input.certifiedThrough,
    places: [...input.places].sort((a, b) => a.placeId.localeCompare(b.placeId)),
    visits: [...input.visits].sort((a, b) => String(a.visitKey).localeCompare(String(b.visitKey))),
    personDays: [...input.personDays].sort((a, b) => String(a.personDayId).localeCompare(String(b.personDayId))),
    economicFacts: [...input.economicFacts].sort((a, b) => String(a.canonicalComponentKey).localeCompare(String(b.canonicalComponentKey))),
    purchaseEvents: [...input.purchaseEvents].sort((a, b) => String(a.purchaseEventId).localeCompare(String(b.purchaseEventId))),
    visitSemantics: [...(input.visitSemantics ?? [])].sort((a, b) => a.visitKey.localeCompare(b.visitKey)),
    nightEvidence: [...(input.nightEvidence ?? [])].sort((a, b) => a.visitKey.localeCompare(b.visitKey) || a.nightDate.localeCompare(b.nightDate)),
    roleAssertions: [...roles].sort((a, b) => a.personId.localeCompare(b.personId) || a.placeId.localeCompare(b.placeId) || a.validFrom.localeCompare(b.validFrom)),
    activityTypesByVisit: input.activityTypesByVisit ?? {},
    narrativePlaceEvidence: input.narrativePlaceEvidence ?? {},
  };
  return { ...output, inputHash: digest({ input: semanticInput, dependencyClosure, policies }), outputHash: digest(output) };
}
