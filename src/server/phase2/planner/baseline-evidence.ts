import "server-only";
import Big from "big.js";
import { Temporal } from "@js-temporal/polyfill";
import { plannerDigest, parsePlannerJson } from "@/domain/phase2/planner/json";
import { planSlotId } from "@/domain/phase2/planner/identity";
import type { BaselineSourceRef, HistoricalReferenceSet, PlanningPlanSlot, BaselineRange } from "@/domain/phase2/planner/baseline-contract";
import type { PlannerDiagnostic } from "@/domain/phase2/planner/diagnostics";
import { referenceQuantile } from "../month-reference";
import type { EvidenceSource } from "../forecast-opportunities";
import type { PlanningBaselineSources } from "./baseline-sources";

export const BASELINE_REFERENCE_POLICY = "planner-closed-local-reference@v1";
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
export const nullRange = (): BaselineRange => ({ low: null, central: null, high: null });
export function money(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new TypeError("BASELINE_MONEY_INVALID");
  return new Big(value).toFixed(2);
}
export const knowledgeDate = (s: PlanningBaselineSources): string =>
  Temporal.Instant.from(s.knowledgeCutoff).toZonedDateTimeISO(s.timezone).toPlainDate().toString();
export function closedMonths(s: PlanningBaselineSources, sources: readonly EvidenceSource[]): string[] {
  const today = knowledgeDate(s);
  return unique(s.periods.filter(p => {
    const month = p.month.slice(0, 7);
    const end = Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 }).add({ months: 1 }).subtract({ days: 1 }).toString();
    return p.householdId === s.householdId && p.isClosed && p.sourceRevision !== null && month < s.targetMonth && end < today
      && month >= s.evidence.history.startMonth && month <= s.evidence.history.endMonth
      && sources.every(source => (source === "MOBILITY" ? p.locationStatus : p.financeStatus) === "complete"
        && s.evidence.completeMonthsBySource?.[source]?.includes(month));
  }).map(p => p.month.slice(0, 7))).slice(-12);
}
export function sourceRef(sourceKey: string, owner: string, value: unknown, evidenceRefs: readonly string[] = []): BaselineSourceRef {
  return { sourceKey, owner, digest: plannerDigest(parsePlannerJson(value)), evidenceRefs: unique(evidenceRefs) };
}
export function diagnostic(code: string, targetRef: string, evidenceRefs: readonly string[] = []): PlannerDiagnostic {
  return { code, severity: "WARN", targetRef, message: code, evidenceRefs: unique(evidenceRefs) };
}
/** Samples are local to their owner and source mask. A covered empty month may be zero;
 * absence of coverage or an unknown amount never supplies a zero sample. */
export function references(basis: HistoricalReferenceSet["basis"], sources: readonly EvidenceSource[],
  samples: HistoricalReferenceSet["samples"]): HistoricalReferenceSet {
  const sorted = [...samples].sort((a, b) => compare(a.month, b.month));
  if (new Set(sorted.map(s => s.month)).size !== sorted.length) throw new TypeError("BASELINE_DUPLICATE_MONTH");
  const values = sorted.flatMap(s => s.value === null ? [] : [Number(s.value)]);
  const range = values.length < 3 ? nullRange() : {
    low: money(String(referenceQuantile(values, .25))), central: money(String(referenceQuantile(values, .5))),
    high: money(String(referenceQuantile(values, .75))),
  };
  return { policyVersion: BASELINE_REFERENCE_POLICY, basis, requiredSources: unique(sources),
    comparableMonths: sorted.filter(s => s.value !== null).map(s => s.month), samples: sorted,
    range, evidenceRefs: unique(sorted.flatMap(s => s.evidenceRefs)), hardFloor: false };
}
export function makeSlot(input: Omit<PlanningPlanSlot, "planSlotId" | "slotIdentityKey">): PlanningPlanSlot {
  const slotIdentityKey = `${input.scope.kind}:${input.scope.personId ?? "household"}:${input.semanticKey}`;
  return { ...input, planSlotId: planSlotId(slotIdentityKey), slotIdentityKey };
}
export const emptyValue = () => ({ amount: null, count: null, unitAmount: null, minimumAmount: null, dueState: null });
