import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import Big from "big.js";
import type { AcquisitionEpisode, ReplenishmentProfile, NeedOccurrence, RenewalReadModel } from "@/domain/phase2/planner/renewal-contract";
import { acquisitionEpisodeId, needOccurrenceId } from "@/domain/phase2/planner/identity";
import { plannerDigest } from "@/domain/phase2/planner/json";
import type { PlanningBaselineSources } from "./baseline-sources";
import { compare, diagnostic, knowledgeDate, money, unique } from "./baseline-evidence";
import { referenceQuantile } from "../month-reference";

export const RENEWAL_MODEL_VERSION = "planner-renewals@v2";
export const RENEWAL_NEED_KEYS = ["maquillage_manon_mascara", "maquillage_manon_sourcils", "maquillage_manon_eyeliner",
  "cire_adrien", "haircare_adrien_cire", "skincare_manon", "haircare_manon"] as const;
const autoProducts = new Set<string>(["maquillage_manon_mascara", "maquillage_manon_sourcils"]);
const days = (start: string, end: string) => Temporal.PlainDate.from(start).until(end, { largestUnit: "day" }).days;
const endOfMonth = (month: string) => Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 }).add({ months: 1 }).subtract({ days: 1 }).toString();
function covered(start: string, end: string, months: readonly string[]): boolean {
  let month = Temporal.PlainYearMonth.from(start.slice(0, 7));
  for (; month.toString() <= end.slice(0, 7); month = month.add({ months: 1 })) if (!months.includes(month.toString())) return false;
  return true;
}
function coverageThrough(lastDate: string, months: readonly string[]): string | null {
  let month = Temporal.PlainYearMonth.from(lastDate.slice(0, 7)), through: string | null = null;
  for (; months.includes(month.toString()); month = month.add({ months: 1 })) through = endOfMonth(month.toString());
  return through;
}
/** Acquisition evidence only. No payment allocation, Plan state, shopping-session learning,
 * product substitution, clock, network or durable write is accepted by this owner. */
export function buildRenewalReadModel(s: PlanningBaselineSources): RenewalReadModel {
  // Product coverage belongs to Canonical analysis periods, not the rolling financial
  // forecast corpus. Long replenishment histories must retain all admitted episodes.
  const months = unique(s.periods.filter(p => p.householdId === s.householdId && p.isClosed && p.sourceRevision !== null
    && p.financeStatus === "complete" && p.lifeStatus === "complete" && p.month.slice(0, 7) < s.targetMonth
    && endOfMonth(p.month.slice(0, 7)) < knowledgeDate(s)).map(p => p.month.slice(0, 7)));
  const observations = [...s.productObservations].filter(o => months.includes(o.observedAt.slice(0, 7))).sort((a, b) => compare(a.observationId, b.observationId));
  const byId = new Map<string, typeof observations[number]>();
  for (const o of observations) {
    Temporal.PlainDate.from(o.observedAt);
    if (o.subject.kind === "PERSON" ? !Object.hasOwn(s.evidence.personNamesById, o.subject.personId) : o.subject.householdId !== s.householdId)
      throw new TypeError("RENEWAL_OBSERVATION_SCOPE_INVALID");
    if (byId.has(o.observationId) && plannerDigest(byId.get(o.observationId)) !== plannerDigest(o)) throw new TypeError("RENEWAL_OBSERVATION_ID_CONFLICT");
    if (o.price !== undefined && new Big(o.price).lt(0)) throw new TypeError("RENEWAL_REFERENCE_PRICE_INVALID");
    if (!o.productKey.trim()) throw new TypeError("RENEWAL_PRODUCT_IDENTITY_INVALID");
    byId.set(o.observationId, o);
  }
  const episodes: AcquisitionEpisode[] = [], profiles: ReplenishmentProfile[] = [], occurrences: NeedOccurrence[] = [], diagnostics = [];
  const subjects = Object.entries(s.needSubjects).sort(([a], [b]) => compare(a, b));
  if (new Set(subjects.map(([, n]) => `${n.needKey}:${n.personId}`)).size !== subjects.length) throw new TypeError("RENEWAL_NEED_IDENTITY_CONFLICT");
  for (const o of byId.values()) {
    const personId = o.subject.kind === "PERSON" ? String(o.subject.personId) : null;
    const mapped = subjects.filter(([, n]) => n.needKey === o.needKey);
    if (!mapped.length) {
      diagnostics.push(diagnostic("RENEWAL_NEED_MAPPING_UNAVAILABLE", `product-observation:${o.observationId}`, o.evidenceRefs,
        "Cette observation historique n’a pas de Need canonique correspondant. Aucun renouvellement automatique n’est déduit."));
      continue;
    }
    if (!mapped.some(([, n]) => n.personId === personId)) throw new TypeError("RENEWAL_NEED_SUBJECT_CONFLICT");
  }
  for (const [needId, n] of subjects) {
    if (n.personId && !Object.hasOwn(s.evidence.personNamesById, n.personId)) throw new TypeError("RENEWAL_NEED_PERSON_SCOPE_INVALID");
    const rows = [...byId.values()].filter(o => o.needKey === n.needKey && (o.subject.kind === "PERSON" ? o.subject.personId : null) === n.personId);
    const dates = unique(rows.map(o => o.observedAt));
    const acquisitions = dates.map(date => {
      const sameDay = rows.filter(o => o.observedAt === date), prices = sameDay.flatMap(o => o.price === undefined ? [] : [Number(o.price)]);
      // A reference unit price is never the sum of a bank basket or a claimed quantity.
      return { acquisitionEpisodeId: acquisitionEpisodeId(needId, date), needId, personId: n.personId, date,
        observationIds: unique(sameDay.map(o => o.observationId)), productKeys: unique(sameDay.map(o => o.productKey)),
        referenceAmount: prices.length === sameDay.length ? money(String(referenceQuantile(prices, .5))) : null,
        coverage: "KNOWN" as const, evidenceRefs: unique(sameDay.flatMap(o => o.evidenceRefs)) };
    });
    episodes.push(...acquisitions);
    const allGaps = dates.slice(1).map((date, i) => ({ gap: days(dates[i]!, date), covered: covered(dates[i]!, date, months) }));
    const gaps = allGaps.filter(g => g.covered).map(g => g.gap);
    const median = gaps.length ? referenceQuantile(gaps, .5) : null, p25 = gaps.length ? referenceQuantile(gaps, .25) : null, p75 = gaps.length ? referenceQuantile(gaps, .75) : null;
    const dispersion = median && p25 !== null && p75 !== null ? (p75 - p25) / median : null;
    const products = unique(acquisitions.flatMap(e => e.productKeys)), identity = products.length === 1 ? "STABLE" as const : products.length ? "MIXED" as const : "UNKNOWN" as const;
    const auto = autoProducts.has(n.needKey) && n.personId !== null && s.evidence.personNamesById[n.personId] === "Manon";
    const certified = auto && acquisitions.length >= 4 && gaps.length >= 3 && allGaps.every(g => g.covered) && identity === "STABLE"
      && dispersion !== null && dispersion <= .5 && Math.max(...gaps) / Math.min(...gaps) <= 3;
    const last = acquisitions.at(-1), through = last ? coverageThrough(last.date, months) : null;
    const priceEpisodes = acquisitions.flatMap(e => e.referenceAmount === null ? [] : [Number(e.referenceAmount)]);
    const profile: ReplenishmentProfile = { needId, needKey: n.needKey, personId: n.personId,
      status: certified ? "REPLENISHMENT_CERTIFIED" : acquisitions.length >= 3 ? "REPLENISHMENT_CANDIDATE" : acquisitions.length ? "DISCRETIONARY_OBSERVED" : "UNKNOWN",
      eligibility: auto ? "AUTO_ELIGIBLE" : "EXPLICIT_ONLY", authority: "OBSERVED", lastEpisodeId: last?.acquisitionEpisodeId ?? null,
      distinctAcquisitionCount: acquisitions.length, intervalCount: allGaps.length, coveredIntervalCount: gaps.length,
      medianGapDays: median, p25GapDays: p25, p75GapDays: p75, dispersionRatio: dispersion,
      coverageDurationDays: gaps.reduce((total, gap) => total + gap, 0), coverageThrough: through, comparableMonths: months,
      productIdentityState: identity, modelVersion: RENEWAL_MODEL_VERSION,
      referenceUnitAmount: identity === "STABLE" && priceEpisodes.length === acquisitions.length && priceEpisodes.length ? money(String(referenceQuantile(priceEpisodes, .5))) : null,
      referencePriceBasis: "OBSERVED_PRODUCT_REFERENCE_PRICE", evidenceRefs: unique(acquisitions.flatMap(e => e.evidenceRefs)),
      limitations: unique(["PRODUCT_REFERENCE_NOT_BANK_ALLOCATION", ...(!auto ? ["EXPLICIT_ONLY"] : []), ...(!certified ? ["NEEDS_NEW_INPUT"] : []),
        ...(allGaps.some(g => !g.covered) ? ["ACQUISITION_COVERAGE_GAP"] : [])]) };
    const addDays = (gap: number | null) => last && gap !== null ? Temporal.PlainDate.from(last.date).add({ days: Math.round(gap) }).toString() : null;
    const window = certified ? { earliest: addDays(p25), central: addDays(median), latest: addDays(p75) } : { earliest: null, central: null, latest: null };
    const today = knowledgeDate(s), targetStart = `${s.targetMonth}-01`, targetEnd = endOfMonth(s.targetMonth);
    const requiredThrough = Temporal.PlainDate.from(today).subtract({ days: 1 }).toString();
    const recent = through !== null && through >= requiredThrough;
    const dueState: NeedOccurrence["dueState"] = !certified || !recent ? "UNKNOWN" : today < window.earliest! ? "EARLY" : today < window.central! ? "POSSIBLE"
      : today <= window.latest! ? "PROBABLE" : through! > window.latest! ? "LATE" : "UNKNOWN";
    const occurrence: NeedOccurrence = { needOccurrenceId: needOccurrenceId(needId, last?.acquisitionEpisodeId ?? null), needId,
      needKey: n.needKey, personId: n.personId, sourceAcquisitionEpisodeId: last?.acquisitionEpisodeId ?? null, dueWindow: window, dueState,
      targetMonthRelation: !window.central ? "CONDITIONAL" : window.latest! < targetStart || window.earliest! > targetEnd ? "OUTSIDE" : "CONDITIONAL",
      knowledge: certified && recent ? "ESTIMATED" : "UNKNOWN", autoEligible: certified && recent, evidenceRefs: profile.evidenceRefs };
    profiles.push(profile); occurrences.push(occurrence);
    if (!certified || !recent) diagnostics.push(diagnostic(!certified ? "RENEWAL_NEEDS_NEW_INPUT" : "RENEWAL_RECENT_COVERAGE_MISSING", needId, profile.evidenceRefs));
  }
  // Personal assertions outrank the household's imprecise historical haircut Need.
  for (const a of [...s.habitAssertions].sort((a, b) => compare(a.assertionId, b.assertionId))) {
    if (a.habitKey !== "hairdresser" || s.evidence.personNamesById[a.personId] !== "Adrien" || Temporal.Instant.compare(a.validatedAt, s.knowledgeCutoff) > 0) continue;
    if (a.authority !== "USER_VALIDATED" || a.priceBasis !== "INDICATIVE_PRICE_NOT_PAYMENT" || !new Big(a.monthlyVisitEstimate).gt(0) || new Big(a.typicalVisitPrice).lt(0))
      throw new TypeError("RENEWAL_HABIT_AUTHORITY_INVALID");
    const needId = `personal-habit:${a.personId}:hairdresser`, refs = [`habit-assertion:${a.assertionId}`];
    if (profiles.some(p => p.needId === needId)) throw new TypeError("RENEWAL_HABIT_IDENTITY_CONFLICT");
    profiles.push({ needId, needKey: "hairdresser", personId: a.personId, status: "REPLENISHMENT_CERTIFIED", eligibility: "AUTO_ELIGIBLE",
      authority: "USER_VALIDATED", lastEpisodeId: null, distinctAcquisitionCount: 0, intervalCount: 0, coveredIntervalCount: 0,
      medianGapDays: null, p25GapDays: null, p75GapDays: null, dispersionRatio: null, coverageThrough: null, coverageDurationDays: 0, comparableMonths: [],
      productIdentityState: "UNKNOWN", modelVersion: RENEWAL_MODEL_VERSION, referenceUnitAmount: money(a.typicalVisitPrice),
      referencePriceBasis: a.priceBasis, evidenceRefs: refs, limitations: ["INDICATIVE_PRICE_NOT_PAYMENT", "NO_INFERRED_VISIT_DATE"] });
    occurrences.push({ needOccurrenceId: needOccurrenceId(needId, null), needId, needKey: "hairdresser", personId: a.personId, sourceAcquisitionEpisodeId: null,
      dueWindow: { earliest: null, central: null, latest: null }, dueState: "UNKNOWN", targetMonthRelation: "CENTRAL", knowledge: "DECLARED", autoEligible: true, evidenceRefs: refs });
  }
  return { modelVersion: RENEWAL_MODEL_VERSION, acquisitionEpisodes: episodes.sort((a, b) => compare(a.acquisitionEpisodeId, b.acquisitionEpisodeId)),
    replenishmentProfiles: profiles.sort((a, b) => compare(a.needId, b.needId)), needOccurrences: occurrences.sort((a, b) => compare(a.needOccurrenceId, b.needOccurrenceId)),
    diagnostics: diagnostics.sort((a, b) => compare(`${a.code}:${a.targetRef}`, `${b.code}:${b.targetRef}`)) };
}
