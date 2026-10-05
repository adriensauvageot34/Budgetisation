import "server-only";
import Big from "big.js";
import type { PlanningPlanSlot, UnresolvedBehavioralReserve } from "@/domain/phase2/planner/baseline-contract";
import type { PlanningBaselineSources } from "./baseline-sources";
import { closedMonths, compare, diagnostic, emptyValue, makeSlot, money, references, sourceRef, unique } from "./baseline-evidence";

export const BASELINE_MOBILITY_MODEL = "planner-canonical-personal-mobility@v1";
export function buildMobilityBaseline(s: PlanningBaselineSources) {
  const months = closedMonths(s, ["MOBILITY"]), slots: PlanningPlanSlot[] = [];
  const sourceRefs = [], diagnostics = [], unresolvedReserves: UnresolvedBehavioralReserve[] = [];
  const byId = new Map<string, typeof s.mobilityLegs[number]>();
  for (const leg of s.mobilityLegs.filter(l => months.includes(l.date.slice(0, 7)))) {
    if (leg.householdId !== s.householdId) throw new TypeError("BASELINE_MOBILITY_HOUSEHOLD_SCOPE_INVALID");
    if (byId.has(leg.legId)) throw new TypeError("BASELINE_MOBILITY_IDENTITY_CONFLICT");
    byId.set(leg.legId, leg);
  }
  const legs = [...byId.values()].sort((a, b) => compare(a.legId, b.legId));
  const unresolved: typeof legs = [], groups = new Map<string, { personId: string; purpose: string; legs: typeof legs; contexts: string[] }>();
  for (const leg of legs) {
    const links = s.mobilityContexts.filter(c => c.mobilityLegId === leg.legId && c.scope === "PERSONAL" && c.linkState === "LINKED"
      && ["CONFIRMED", "DERIVED"].includes(c.knowledgeState) && c.subjectPersonId !== null && c.purpose !== "UNKNOWN");
    const signatures = unique(links.map(c => `${c.subjectPersonId}:${c.purpose.startsWith("WORK_") ? "WORK" : c.purpose}`));
    // Shared usage / competing contexts cannot silently become multiple personal slots.
    if (leg.source.status !== "CERTIFIED_SOURCE" || signatures.length !== 1) { unresolved.push(leg); continue; }
    const personId = links[0]!.subjectPersonId!, purpose = links[0]!.purpose.startsWith("WORK_") ? "WORK" : links[0]!.purpose;
    if (!Object.hasOwn(s.evidence.personNamesById, personId)) throw new TypeError("BASELINE_MOBILITY_PERSON_SCOPE_INVALID");
    const key = `${personId}:${purpose}`, group = groups.get(key) ?? { personId, purpose, legs: [], contexts: [] };
    group.legs.push(leg);
    group.contexts.push(...links.map(c => `${leg.date.slice(0, 7)}:${purpose === "WORK" ? leg.date : c.contextKind === "LIFE_EVENT" && c.contextRef ? c.contextRef : leg.date}`));
    groups.set(key, group);
  }
  for (const [key, group] of [...groups].sort(([a], [b]) => compare(a, b))) {
    const work = group.purpose === "WORK", sourceKey = `mobility:${key}`;
    const history = references("OCCURRENCE_COUNT", ["MOBILITY"], months.map(month => ({ month,
      value: String(unique(group.contexts.filter(c => c.startsWith(month))).length), minimum: null,
      evidenceRefs: group.legs.filter(l => l.date.startsWith(month)).map(l => `mobility-leg:${l.legId}`) })));
    sourceRefs.push(sourceRef(sourceKey, s.personalMobility.methodVersion, {
      legs: group.legs, contexts: unique(group.contexts), comparableMonths: months,
      // Summaries are nonadditive rollups; never import ALL_PERSONAL as a new envelope.
      metricId: s.personalMobility.costMetricId,
    }, history.evidenceRefs));
    slots.push(makeSlot({ semanticKey: `mobility:${group.purpose}`, controlKey: null,
      kind: "OCCURRENCE", scope: { kind: "PERSON", personId: group.personId },
      inclusion: work && history.range.central !== null ? "CENTRAL" : "SUGGESTION_ONLY",
      baselineValue: { ...emptyValue(), count: history.range.central }, historicalReferences: history,
      knowledge: history.range.central === null ? "UNKNOWN" : "ESTIMATED", provenance: ["CANONICAL_HISTORY"], sourceRefs: [sourceKey],
      capabilities: [{ action: "REVIEW_REFERENCE", availability: "AVAILABLE",
        reason: work ? "CURRENT_WORK_PATTERN_STRUCTURAL" : "CONTEXTUAL_GROSS_USAGE_NOT_INCREMENTAL_COST" }] }));
  }
  const incomplete = (s.evidence.history.incompleteMobilityLegs ?? []).filter(l => months.includes(l.date.slice(0, 7)));
  if (unresolved.length || incomplete.length || !months.length) {
    const key = "mobility:UNRESOLVED";
    const history = references("GROSS_MOBILITY_USAGE", ["MOBILITY"], months.map(month => {
      const rows = unresolved.filter(l => l.date.startsWith(month)), missing = incomplete.filter(l => l.date.startsWith(month));
      const minimum = money(rows.reduce((n, l) => n.plus(l.estimatedFuelCost), new Big(0)).toString());
      return { month, value: missing.length ? null : minimum, minimum,
        evidenceRefs: unique([...rows.map(l => `mobility-leg:${l.legId}`), ...missing.map(l => `mobility-leg:${l.id}`)]) };
    }));
    sourceRefs.push(sourceRef(key, "CanonicalMobility", history.samples, history.evidenceRefs));
    unresolvedReserves.push({ reserveKey: key, replacesSlotKey: null, reason: "MOBILITY_CONTEXT_UNRESOLVED",
      value: history.range, historicalReferences: history, knowledge: incomplete.length ? "PARTIAL" : history.range.central === null ? "UNKNOWN" : "ESTIMATED", sourceRefs: [key] });
    diagnostics.push(diagnostic("BASELINE_MOBILITY_CONTEXT_UNRESOLVED", key, history.evidenceRefs));
  }
  return { slots, sourceRefs, diagnostics, unresolvedReserves };
}
