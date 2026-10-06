import "server-only";
import Big from "big.js";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import type { PlanningBaselineV1, PlanningPlanSlot } from "@/domain/phase2/planner/baseline-contract";
import type { SimpleDomain, SimpleSlotAuthority } from "@/domain/phase2/planner/simple-lever-contract";
import { TOBACCO_SUBCATEGORIES, referenceQuantile } from "../month-reference";
import { requiredForecastSources } from "../forecast-opportunities";
import type { PlanningBaselineSources } from "./baseline-sources";
import { buildPlanningBaseline, planningBaselineDigest } from "./baseline";
import { closedMonths, compare, diagnostic, emptyValue, knowledgeDate, makeSlot, money, references, sourceRef, unique } from "./baseline-evidence";
import { foodIdentity, uniqueEconomicRows } from "./baseline-food";
import { diningDomain, SIMPLE_MAPPING_VERSION } from "./simple-mappings";

export const SIMPLE_BASELINE_VERSION = "planner-simple-baseline@v1";
export const SIMPLE_OCCURRENCE_VERSION = "planner-simple-occurrences@v1";
const channels = ["restaurants", "fast-food", "delivery"] as const;
const authority = (domain: SimpleDomain, referenceKeys: readonly string[], gate: SimpleSlotAuthority["gate"],
  optionalBudget = false): { -readonly [P in keyof SimpleSlotAuthority]: SimpleSlotAuthority[P] } => ({ version: SIMPLE_BASELINE_VERSION, domain, referenceKeys,
  ownershipGroup: channels.some(c => c === domain) ? "household-dining" : domain,
  gate, reason: gate === "NEEDS_NEW_INPUT" ? "NEEDS_NEW_INPUT" : null, optionalBudget, occurrenceModel: null, hardFloor: null });

/** Adds real simple domains to the C1 read-model. No semantic state, legacy assumptions,
 * scenario calculation, time read or persistence. Count and price are separate evidence. */
export function buildSimplePlanningBaseline(s: PlanningBaselineSources): PlanningBaselineV1 {
  const base = buildPlanningBaseline({ ...s, habitAssertions: s.habitAssertions.filter(a => !["adrien-work-meals", "manon-work-meals"].includes(a.habitKey)) });
  const refs = [...base.sourceRefs], diagnostics = [...base.diagnostics];
  const slots: PlanningPlanSlot[] = base.slots.filter(slot => slot.semanticKey !== "household-restaurants").map(slot => {
    if (!["groceries", "adrien-work-meals", "manon-work-meals"].includes(slot.semanticKey)) return slot;
    const domain = slot.semanticKey as SimpleDomain;
    const assertions = s.habitAssertions.filter(a => a.habitKey === domain && a.personId === slot.scope.personId
      && a.authority === "USER_VALIDATED" && Date.parse(a.validatedAt) <= Date.parse(s.knowledgeCutoff));
    if (assertions.length > 1) throw new TypeError("SIMPLE_HABIT_AUTHORITY_CONFLICT");
    const assertion = assertions[0];
    if (assertion && (assertion.priceBasis !== "INDICATIVE_PRICE_NOT_PAYMENT" || new Big(decisionAmount(assertion.monthlyVisitEstimate)).lte(0)))
      throw new TypeError("SIMPLE_HABIT_AUTHORITY_INVALID");
    if (assertion) decisionAmount(assertion.typicalVisitPrice);
    const missingManon = domain === "manon-work-meals" && !assertion;
    const value = assertion ? { ...slot.baselineValue, count: money(assertion.monthlyVisitEstimate), unitAmount: money(assertion.typicalVisitPrice) }
      : missingManon ? { ...slot.baselineValue, count: null } : slot.baselineValue;
    const known = slot.kind === "AMOUNT" ? value.amount !== null : value.count !== null && value.unitAmount !== null;
    const simple = authority(domain, [domain], known ? "AVAILABLE" : "NEEDS_NEW_INPUT");
    const sourceRefs = [...slot.sourceRefs];
    if (assertion) {
      const key = `simple-habit:${assertion.assertionId}`;
      refs.push(sourceRef(key, "CanonicalPersonHabitAssertion", assertion, [assertion.assertionId])); sourceRefs.push(key);
    }
    if (slot.kind !== "AMOUNT") simple.occurrenceModel = { version: SIMPLE_OCCURRENCE_VERSION, basis: "WORK_LUNCH_DATE", count: value.count, unitAmount: value.unitAmount };
    if (missingManon) { simple.reason = "MANON_MEAL_FREQUENCY_UNIDENTIFIED"; diagnostics.push(diagnostic(simple.reason, slot.slotIdentityKey, sourceRefs)); }
    return { ...slot, baselineValue: value, simpleAuthority: simple, sourceRefs, inclusion: known ? "CENTRAL" : "UNRESOLVED_RESERVE",
      provenance: assertion ? ["USER_VALIDATED_HABIT"] : slot.provenance,
      knowledge: assertion ? "DECLARED" : missingManon ? "UNKNOWN" : slot.knowledge };
  });
  const diningMonths = closedMonths(s, requiredForecastSources("household-restaurants"));
  const rows = uniqueEconomicRows(s.evidence.history.economicEntries);
  const occurrenceInputs = s.simpleOccurrences;
  if (occurrenceInputs?.occurrences.some(e => e.householdId !== s.householdId)) throw new TypeError("SIMPLE_OCCURRENCE_HOUSEHOLD_MISMATCH");
  const events = occurrenceInputs?.occurrences.filter(e => e.householdId === s.householdId && ["Confirmé", "Déduit"].includes(e.validationStatus)
    && ["repas_restaurant", "livraison_repas"].includes(String(e.activityId))
    && e.startDate === e.endDate && diningMonths.includes(e.startDate.slice(0, 7))) ?? [];
  if (new Set(events.map(e => String(e.lifeEventId))).size !== events.length) throw new TypeError("SIMPLE_OCCURRENCE_DUPLICATE");
  const classified = events.map(event => {
    const links = occurrenceInputs!.links.filter(l => l.lifeEventId === event.lifeEventId && l.relationType === "Paiement_activite");
    const linkedRows = uniqueEconomicRows(rows.filter(row => links.some(l => l.canonicalComponentKey === (row.canonicalComponentKey ?? `operation:${row.operationId}`)
      || s.purchaseFacts.some(f => String(f.purchaseEventId) === row.purchaseEventId && f.sourceOperation.kind === "resolved"
        && l.canonicalComponentKey === `operation:${f.sourceOperation.id}`))));
    const domains = unique(linkedRows.flatMap(row => diningDomain(row) ? [diningDomain(row)!] : []));
    const conflictingLinks = links.some(link => links.some(other => other.canonicalComponentKey === link.canonicalComponentKey && other.economicAmountLinked !== link.economicAmountLinked));
    const domain = !conflictingLinks && domains.length === 1 && linkedRows.every(r => diningDomain(r) === domains[0] && r.date.slice(0, 7) === event.startDate.slice(0, 7)) ? domains[0] : null;
    return { event, domain, rows: linkedRows };
  });
  for (const domain of channels) {
    const selectedRows = rows.filter(row => diningDomain(row) === domain && diningMonths.includes(row.date.slice(0, 7)));
    const samples = diningMonths.map(month => {
      const monthly = selectedRows.filter(row => row.date.startsWith(month));
      const occurrences = classified.filter(e => e.event.startDate.startsWith(month) && e.domain === domain);
      const fullyLinked = monthly.every(row => classified.filter(e => e.domain === domain && e.rows.some(r => foodIdentity(r) === foodIdentity(row))).length === 1);
      const ambiguous = classified.some(e => e.event.startDate.startsWith(month) && e.domain === null && (e.rows.some(r => diningDomain(r) !== null) || e.event.activityId === "repas_restaurant"));
      const complete = !!occurrenceInputs && s.periods.some(p => p.month.startsWith(month) && p.lifeStatus === "complete")
        && fullyLinked && !ambiguous && monthly.every(row => row.amountStatus !== "PARTIAL")
        && !s.purchaseFacts.some(f => f.timing.economicMonth === month && f.economicAmount.status !== "KNOWN");
      return { month, value: complete ? String(occurrences.length) : null, minimum: null,
        evidenceRefs: unique([...monthly.map(foodIdentity), ...occurrences.map(e => String(e.event.lifeEventId))]) };
    });
    const history = references("OCCURRENCE_COUNT", requiredForecastSources("household-restaurants"), samples);
    const prices = classified.filter(e => e.domain === domain && history.comparableMonths.includes(e.event.startDate.slice(0, 7))
      && e.rows.length && e.rows.every(row => row.amountStatus !== "PARTIAL"))
      .map(e => Number(e.rows.reduce((n, row) => n.plus(row.amount), new Big(0))));
    const unit = prices.length ? money(String(referenceQuantile(prices, .5))) : null;
    const known = history.range.central !== null && (unit !== null || history.range.central === "0.00");
    const simple = authority(domain, ["household-restaurants"], known && unit !== null ? "AVAILABLE" : "NEEDS_NEW_INPUT");
    simple.occurrenceModel = { version: SIMPLE_OCCURRENCE_VERSION, basis: "CANONICAL_OCCURRENCE", count: history.range.central, unitAmount: unit };
    const sourceKey = `simple:${domain}`;
    refs.push(sourceRef(sourceKey, SIMPLE_OCCURRENCE_VERSION, { history, unit }, history.evidenceRefs));
    slots.push(makeSlot({ semanticKey: domain, controlKey: domain, kind: "OCCURRENCE", scope: { kind: "HOUSEHOLD" },
      inclusion: known ? "CENTRAL" : "UNRESOLVED_RESERVE", baselineValue: { ...emptyValue(), count: history.range.central, unitAmount: unit },
      sourceRefs: [sourceKey], historicalReferences: history, knowledge: known ? unit === null ? "PARTIAL" : "ESTIMATED" : "UNKNOWN", provenance: ["CANONICAL_HISTORY"],
      capabilities: [{ action: "SET_COUNT", availability: "AVAILABLE", reason: known ? null : "NEEDS_NEW_INPUT" }], simpleAuthority: simple }));
    if (!known) diagnostics.push(diagnostic("SIMPLE_OCCURRENCE_NEEDS_NEW_INPUT", domain, history.evidenceRefs));
  }
  const bankMonths = closedMonths(s, ["BANK"]), tobaccoRows = rows.filter(row => TOBACCO_SUBCATEGORIES.some(name => name === row.subcategory));
  const tobaccoHistory = references("ECONOMIC_AMOUNT", ["BANK"], bankMonths.map(month => {
    const entries = tobaccoRows.filter(row => row.date.startsWith(month));
    const minimum = money(entries.reduce((n, row) => n.plus(row.amount), new Big(0)).toString());
    return { month, value: entries.some(row => row.amountStatus === "PARTIAL")
      || s.purchaseFacts.some(f => f.timing.economicMonth === month && f.economicAmount.status !== "KNOWN") ? null : minimum,
      minimum, evidenceRefs: entries.map(foodIdentity) };
  }));
  refs.push(sourceRef("simple:tobacco-vape", "CanonicalEconomicHistory", tobaccoHistory, tobaccoHistory.evidenceRefs));
  slots.push(makeSlot({ semanticKey: "tobacco-vape", controlKey: "tobacco-vape", kind: "AMOUNT", scope: { kind: "HOUSEHOLD" },
    inclusion: tobaccoHistory.range.central === null ? "UNRESOLVED_RESERVE" : "CENTRAL",
    baselineValue: { ...emptyValue(), amount: tobaccoHistory.range.central }, sourceRefs: ["simple:tobacco-vape"],
    historicalReferences: tobaccoHistory, knowledge: tobaccoHistory.range.central === null ? "UNKNOWN" : "ESTIMATED", provenance: ["CANONICAL_HISTORY"],
    capabilities: [{ action: "SET_AMOUNT", availability: "AVAILABLE", reason: null }],
    simpleAuthority: authority("tobacco-vape", ["tobacco-vape"], tobaccoHistory.range.central === null ? "NEEDS_NEW_INPUT" : "AVAILABLE") }));
  // Optional envelopes reserve nothing automatically. Historical purchases are references,
  // never a synthetic purchase or a smoothed compulsory monthly commitment.
  for (const domain of ["clothing", "home-small", "games-digital"] as const) {
    slots.push(makeSlot({ semanticKey: domain, controlKey: domain, kind: "AMOUNT", scope: { kind: "HOUSEHOLD" }, inclusion: "SUGGESTION_ONLY",
      baselineValue: { ...emptyValue(), amount: "0.00" }, sourceRefs: ["simple:optional-policy"], knowledge: "NOT_APPLICABLE", provenance: ["STRUCTURAL_DEFAULT"],
      capabilities: [{ action: "SET_AMOUNT", availability: "AVAILABLE", reason: "OPTIONAL_USER_BUDGET" }],
      simpleAuthority: authority(domain, [domain], "AVAILABLE", true) }));
  }
  refs.push(sourceRef("simple:optional-policy", SIMPLE_MAPPING_VERSION, { domains: ["clothing", "home-small", "games-digital"], automaticReservation: "NONE" }));
  // A real already observed economic cost is irreversible. Historical quantiles never
  // acquire this status. The compiler still gates reconciliation of current observations.
  const finalSlots = slots.map(slot => {
    if (!slot.simpleAuthority || !["groceries", "tobacco-vape"].includes(slot.semanticKey)) return slot;
    const observed = uniqueEconomicRows(s.evidence.currentEconomicEntries.filter(row => row.date.startsWith(s.targetMonth) && row.date <= knowledgeDate(s)
      && (slot.semanticKey === "groceries" ? row.subcategory === "Courses alimentaires" : TOBACCO_SUBCATEGORIES.some(name => name === row.subcategory))));
    const amount = money(observed.reduce((n, row) => n.plus(row.amount), new Big(0)).toString());
    return observed.length ? { ...slot, baselineValue: { ...slot.baselineValue, minimumAmount: amount }, simpleAuthority: { ...slot.simpleAuthority,
      hardFloor: { amount, authority: "CANONICAL_OBSERVED_CONSUMPTION" as const, evidenceRefs: observed.map(foodIdentity) } } } : slot;
  });
  const replaced = new Set(base.slots.filter(slot => slot.semanticKey === "household-restaurants").map(slot => slot.slotIdentityKey));
  const unresolvedReserves = base.unresolvedReserves.filter(r => !r.replacesSlotKey || !replaced.has(r.replacesSlotKey));
  // Tobacco has acquired its own slot. Remove only those exact Canonical identities
  // from C1's unmodeled reserve; all other history and unknown costs remain explicit.
  const unmodeled = unresolvedReserves.find(r => r.reserveKey === "economic:UNRESOLVED");
  if (unmodeled) {
    const ids = new Set(tobaccoRows.map(foodIdentity));
    const samples = unmodeled.historicalReferences.samples.map(sample => {
      const removed = tobaccoRows.filter(row => row.date.startsWith(sample.month) && sample.evidenceRefs.includes(foodIdentity(row)));
      const amount = removed.reduce((n, row) => n.plus(row.amount), new Big(0));
      return { ...sample, value: sample.value === null ? null : money(new Big(sample.value).minus(amount).toString()),
        minimum: sample.minimum === null ? null : money(new Big(sample.minimum).minus(amount).toString()), evidenceRefs: sample.evidenceRefs.filter(id => !ids.has(id)) };
    });
    const history = references("ECONOMIC_AMOUNT", ["BANK"], samples);
    const index = unresolvedReserves.indexOf(unmodeled);
    unresolvedReserves[index] = { ...unmodeled, value: history.range, historicalReferences: history };
    const refIndex = refs.findIndex(ref => ref.sourceKey === "economic:UNRESOLVED");
    if (refIndex >= 0) refs[refIndex] = sourceRef("economic:UNRESOLVED", "CanonicalEconomicHistory", samples, history.evidenceRefs);
  }
  for (const slot of finalSlots.filter(slot => slot.simpleAuthority?.gate === "NEEDS_NEW_INPUT")) {
    if (!unresolvedReserves.some(r => r.replacesSlotKey === slot.slotIdentityKey)) unresolvedReserves.push({ reserveKey: `unresolved:${slot.semanticKey}`,
      replacesSlotKey: slot.slotIdentityKey, reason: slot.simpleAuthority!.reason!, knowledge: "UNKNOWN", value: { low: null, central: null, high: null },
      historicalReferences: slot.historicalReferences ?? references("ECONOMIC_AMOUNT", [], []), sourceRefs: slot.sourceRefs });
  }
  const result = { ...base, slots: finalSlots.sort((a, b) => compare(a.slotIdentityKey, b.slotIdentityKey)),
    sourceRefs: refs.sort((a, b) => compare(a.sourceKey, b.sourceKey)), unresolvedReserves: unresolvedReserves.sort((a, b) => compare(a.reserveKey, b.reserveKey)),
    diagnostics: diagnostics.sort((a, b) => compare(`${a.code}:${a.targetRef}`, `${b.code}:${b.targetRef}`)),
    modelVersions: { ...base.modelVersions, simpleBaseline: SIMPLE_BASELINE_VERSION, simpleMappings: SIMPLE_MAPPING_VERSION, simpleOccurrences: SIMPLE_OCCURRENCE_VERSION } };
  return { ...structuredClone(result), digest: planningBaselineDigest(result) };
}
