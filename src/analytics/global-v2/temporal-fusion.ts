import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseLocalDate, parseYearMonth } from "../../core/time";

export const transformationDomains = ["ECONOMIC_STRUCTURE", "WORK_AND_DAY_CONTEXT", "ACTIVITY_BEHAVIOR", "GEOGRAPHY_AND_MOBILITY", "RECURRING_OBLIGATIONS", "CONSUMPTION", "MOMENTS_AND_PROJECTS", "RELATIONAL_AND_SHARED_LIFE"] as const;
export type TransformationDomain = typeof transformationDomains[number];
export type GlobalSemanticChange = {
  readonly signalId: string;
  readonly subjectRef: string;
  readonly domain: TransformationDomain;
  readonly interval: { readonly start: string; readonly end: string };
  readonly certifiedOnset?: { readonly value: string; readonly precision: "MONTH" | "DAY" };
  readonly semanticRefs: readonly string[];
  readonly dependencyRefs: readonly string[];
  readonly qualification: "CONFIRMED" | "CANDIDATE";
  readonly materiality: "MATERIAL" | "NOT_MATERIAL" | "INELIGIBLE" | "QUALIFIED_PARTIAL";
};
export type GlobalSemanticRelation = {
  readonly signalIds: readonly string[];
  readonly kind: "CANONICAL_DELAY" | "CATALOG_NARRATIVE";
  readonly authorityRef: string;
  readonly dependencyRefs: readonly string[];
};
export type GlobalDriverAuthority = {
  readonly kind: "CANONICAL_DESIGNATION" | "SEMANTIC_ANCHOR";
  readonly signalId: string;
  readonly authorityRef: string;
  readonly dependencyRefs: readonly string[];
};
const days = (date: string) => Date.parse(`${parseLocalDate(date)}T00:00:00Z`) / 86400000;
const gap = (a: GlobalSemanticChange, b: GlobalSemanticChange) => Math.max(0, days(a.interval.start) - days(b.interval.end), days(b.interval.start) - days(a.interval.end));
const unique = (values: readonly string[]) => [...new Set(values)].sort();
const hash = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** Semantic proof is mandatory. Complete-link groups avoid transitive temporal chaining. */
export function fuseGlobalTemporalSignals(input: {
  readonly signals: readonly GlobalSemanticChange[];
  readonly relations: readonly GlobalSemanticRelation[];
  readonly driverAuthorities?: readonly GlobalDriverAuthority[];
}) {
  const byId = new Map<string, GlobalSemanticChange>();
  for (const raw of input.signals) {
    if (raw.certifiedOnset !== undefined) {
      if (raw.certifiedOnset.precision === "MONTH") parseYearMonth(raw.certifiedOnset.value);
      else if (raw.certifiedOnset.precision === "DAY") parseLocalDate(raw.certifiedOnset.value);
      else throw new TypeError("Invalid onset precision.");
      const start = raw.certifiedOnset.precision === "MONTH" ? raw.interval.start.slice(0, 7) : raw.interval.start;
      const end = raw.certifiedOnset.precision === "MONTH" ? raw.interval.end.slice(0, 7) : raw.interval.end;
      if (raw.certifiedOnset.value < start || raw.certifiedOnset.value > end) throw new TypeError("Certified onset outside change interval.");
    }
    if (!transformationDomains.includes(raw.domain) || !raw.signalId || !raw.subjectRef ||
      days(raw.interval.end) < days(raw.interval.start) || raw.dependencyRefs.length === 0 ||
      [...raw.semanticRefs, ...raw.dependencyRefs].some((ref) => typeof ref !== "string" || ref.trim().length === 0)) throw new TypeError("Invalid semantic signal authority.");
    const signal = { ...raw, semanticRefs: unique(raw.semanticRefs), dependencyRefs: unique(raw.dependencyRefs) };
    const previous = byId.get(signal.signalId);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(signal)) throw new TypeError("Contradictory semantic signal.");
    byId.set(signal.signalId, signal);
  }
  const relations = input.relations.map((r) => {
    if (!r.authorityRef || r.dependencyRefs.length === 0 || r.signalIds.length < 2 ||
      !["CANONICAL_DELAY", "CATALOG_NARRATIVE"].includes(r.kind) || r.signalIds.some((id) => !byId.has(id))) throw new TypeError("Invalid semantic relation authority.");
    return { ...r, signalIds: unique(r.signalIds), dependencyRefs: unique(r.dependencyRefs) };
  }).sort((a, b) => canonicalSerializeGlobal(a).localeCompare(canonicalSerializeGlobal(b)))
    .filter((value, index, values) => index === 0 || canonicalSerializeGlobal(value) !== canonicalSerializeGlobal(values[index - 1]));
  const eligible = [...byId.values()].filter((s) => s.qualification === "CONFIRMED" && s.materiality === "MATERIAL").sort((a, b) => a.signalId.localeCompare(b.signalId));
  const driverAuthorities = (input.driverAuthorities ?? []).map((authority) => {
    if (!["CANONICAL_DESIGNATION", "SEMANTIC_ANCHOR"].includes(authority.kind) || !byId.has(authority.signalId) ||
      !authority.authorityRef || authority.dependencyRefs.length === 0) throw new TypeError("Invalid primary driver authority.");
    if (authority.kind === "SEMANTIC_ANCHOR" && !byId.get(authority.signalId)!.semanticRefs.includes(authority.authorityRef)) {
      throw new TypeError("Primary driver must be directly attached to its semantic anchor.");
    }
    return { ...authority, dependencyRefs: unique(authority.dependencyRefs) };
  }).sort((a, b) => canonicalSerializeGlobal(a).localeCompare(canonicalSerializeGlobal(b)))
    .filter((value, index, values) => index === 0 || canonicalSerializeGlobal(value) !== canonicalSerializeGlobal(values[index - 1]));
  const compatible = (group: readonly GlobalSemanticChange[]) => {
    if (new Set(group.map((s) => s.subjectRef)).size !== 1) return false;
    const ids = group.map((s) => s.signalId);
    const commonRelations = relations.filter((r) => ids.every((id) => r.signalIds.includes(id)));
    const delay = commonRelations.some((r) => r.kind === "CANONICAL_DELAY");
    const inWindow = group.every((a) => group.every((b) => gap(a, b) <= 31));
    if (!inWindow && !delay) return false;
    const commonSemantic = group[0].semanticRefs.some((ref) => group.every((s) => s.semanticRefs.includes(ref)));
    if (commonSemantic || delay) return true;
    return inWindow && group.length >= 3 && new Set(group.map((s) => s.domain)).size >= 2 && commonRelations.some((r) => r.kind === "CATALOG_NARRATIVE");
  };
  // Narrative groups without an anchor must be considered as a whole (not pairwise).
  const groups: GlobalSemanticChange[][] = [];
  const assigned = new Set<string>();
  for (const relation of relations.filter((r) => r.kind === "CATALOG_NARRATIVE")) {
    const group = eligible.filter((s) => relation.signalIds.includes(s.signalId) && !assigned.has(s.signalId));
    if (group.length >= 3 && compatible(group)) { groups.push(group); group.forEach((s) => assigned.add(s.signalId)); }
  }
  for (const signal of eligible.filter((s) => !assigned.has(s.signalId))) {
    const group = groups.find((g) => compatible([...g, signal]));
    if (group) group.push(signal); else groups.push([signal]);
  }
  return {
    groups: groups.map((group) => {
      const ids = group.map((s) => s.signalId).sort();
      const authorities = driverAuthorities.filter((a) => ids.includes(a.signalId));
      const designated = authorities.filter((a) => a.kind === "CANONICAL_DESIGNATION");
      const anchored = authorities.filter((a) => a.kind === "SEMANTIC_ANCHOR");
      const preferred = designated.length ? designated : anchored;
      const candidates = group.filter((s) => !preferred.length || preferred.some((a) => a.signalId === s.signalId));
      const monthPrecision = candidates.some((s) => s.certifiedOnset?.precision === "MONTH");
      const onset = (s: GlobalSemanticChange) => {
        const value = s.certifiedOnset?.value ?? s.interval.start;
        return monthPrecision ? value.slice(0, 7) : value;
      };
      candidates.sort((a, b) => onset(a).localeCompare(onset(b)) || a.signalId.localeCompare(b.signalId));
      const primaryDriver = candidates[0].signalId;
      const tied = candidates.length > 1 && onset(candidates[0]) === onset(candidates[1]);
      const reason = designated.length ? "CANONICAL_DESIGNATION" as const : anchored.length ? "SEMANTIC_ANCHOR" as const : "EARLIEST_CERTIFIED_ONSET" as const;
      return {
        groupId: hash({ subject: group[0].subjectRef, ids }),
        signalIds: ids,
        domains: unique(group.map((s) => s.domain)),
        primaryDriver,
        supportingSignals: ids.filter((id) => id !== primaryDriver),
        driverProvenance: {
          reasonCode: tied ? "DETERMINISTIC_TIEBREAK" as const : reason,
          selectionTier: reason,
          authorityRefs: unique(preferred.filter((a) => a.signalId === primaryDriver).map((a) => a.authorityRef)),
          causalEvidence: false,
          policy: "global-primary-driver-human-arbitration@v1",
          comparisonPrecision: monthPrecision ? "MONTH" as const : "DAY" as const,
        },
        dependencyRefs: unique([...group.flatMap((s) => s.dependencyRefs), ...authorities.flatMap((a) => a.dependencyRefs), ...relations.filter((r) => ids.every((id) => r.signalIds.includes(id))).flatMap((r) => r.dependencyRefs)]),
      };
    }).sort((a, b) => a.groupId.localeCompare(b.groupId)),
    excludedSignalIds: [...byId.keys()].filter((id) => !eligible.some((s) => s.signalId === id)).sort(),
    methodVersion: "global_temporal_fusion@v2",
    inputHash: hash({ signals: [...byId.values()].sort((a, b) => a.signalId.localeCompare(b.signalId)), relations, driverAuthorities, policy: "global-temporal-fusion@v2", driverPolicy: "global-primary-driver-human-arbitration@v1" }),
  };
}
