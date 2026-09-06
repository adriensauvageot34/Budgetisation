import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseLocalDate, parseYearMonth, type YearMonth } from "../../core/time";
import { buildGlobalTemporalChangeCandidates, type GlobalTemporalChangeInput } from "./temporal-change";
import { buildGlobalTemporalChapters, buildGlobalCurrentRegime, buildGlobalGradualTransitions } from "./temporal-lifecycle";
import { fuseGlobalTemporalSignals, type GlobalSemanticChange, type GlobalSemanticRelation, type TransformationDomain, type GlobalDriverAuthority } from "./temporal-fusion";
import { createGlobalTemporalDependencyDeclaration } from "./temporal-dependencies";
import { validateGlobalM5TransformationFeed, type GlobalRelationshipEvolution } from "./relationship-m3";

/** Master P2940–3042. No arbitrary column, transaction count or UI rank is a signal. */
export const transformationSignalCatalog = {
  ECONOMIC_TOTAL: "ECONOMIC_STRUCTURE", CATEGORY: "ECONOMIC_STRUCTURE", SUBCATEGORY: "ECONOMIC_STRUCTURE", NEED: "ECONOMIC_STRUCTURE",
  FIXED_VARIABLE: "ECONOMIC_STRUCTURE", NECESSITY: "ECONOMIC_STRUCTURE", LIFE_SCOPE: "ECONOMIC_STRUCTURE",
  WORK_CONTEXT_RATE: "WORK_AND_DAY_CONTEXT",
  ACTIVITY_FREQUENCY: "ACTIVITY_BEHAVIOR", ACTIVITY_CADENCE: "ACTIVITY_BEHAVIOR", ACTIVITY_LIFECYCLE: "ACTIVITY_BEHAVIOR", ACTIVITY_COST_PER_OCCURRENCE: "ACTIVITY_BEHAVIOR",
  PLACE_VISITS: "GEOGRAPHY_AND_MOBILITY", PLACE_PRESENCE: "GEOGRAPHY_AND_MOBILITY", PLACE_ROLE: "GEOGRAPHY_AND_MOBILITY", REGULAR_ROUTE: "GEOGRAPHY_AND_MOBILITY", GEOGRAPHY: "GEOGRAPHY_AND_MOBILITY",
  RECURRENCE_LIFECYCLE: "RECURRING_OBLIGATIONS", RECURRENCE_AMOUNT: "RECURRING_OBLIGATIONS", RECURRENCE_CADENCE: "RECURRING_OBLIGATIONS", RECURRENCE_MONTHLY_EQUIVALENT: "RECURRING_OBLIGATIONS",
  MERCHANT_FREQUENCY: "CONSUMPTION", PURCHASE_BASKET: "CONSUMPTION", MERCHANT_LIFECYCLE: "CONSUMPTION", PRODUCT_CADENCE: "CONSUMPTION", CONSUMPTION_SUBSTITUTION: "CONSUMPTION",
  MOMENT_PROJECT_PHASE: "MOMENTS_AND_PROJECTS",
  SHARED_ACTIVITY: "RELATIONAL_AND_SHARED_LIFE", FAMILY_VISITS: "RELATIONAL_AND_SHARED_LIFE", SHARED_HABIT: "RELATIONAL_AND_SHARED_LIFE", SHARED_GROUP: "RELATIONAL_AND_SHARED_LIFE",
} as const satisfies Record<string, TransformationDomain>;
export type GlobalTransformationSeries = GlobalTemporalChangeInput & {
  readonly signalId: string;
  readonly subjectRef: string;
  readonly catalogKey: keyof typeof transformationSignalCatalog;
  readonly semanticRefs: readonly string[];
  readonly structuralAuthorityRefs: readonly string[];
};
const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
/** Historical classification comparison only: never an input to metric production. */
export function compareGlobalTransformationClassification(
  previous: { readonly transformationId: string; readonly kind: string },
  current: { readonly transformationId: string; readonly kind: string; readonly status: "CANDIDATE" | "CONFIRMED_ONGOING" | "CONFIRMED_CLOSED" },
) {
  if (previous.transformationId !== current.transformationId) throw new TypeError("Cannot reclassify different transformation identities.");
  return { status: current.status !== "CANDIDATE" && previous.kind !== current.kind ? "RECLASSIFIED" as const : current.status,
    previousKind: previous.kind, currentKind: current.kind, changesPublishedArtifact: false };
}
const monthInterval = (month: YearMonth) => {
  const [year, number] = month.split("-").map(Number);
  return { start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` };
};

/** Pure C2 assembly. Monthly interval endpoints are matching bounds, never claimed event dates. */
export function buildGlobalTransformations(input: {
  readonly series: readonly GlobalTransformationSeries[];
  readonly relations: readonly GlobalSemanticRelation[];
  readonly driverAuthorities?: readonly GlobalDriverAuthority[];
  readonly relationshipEvolution?: readonly GlobalRelationshipEvolution[];
  readonly anchors?: readonly {
    readonly anchorRef: string;
    readonly signalId: string;
    readonly date: string;
    readonly strongPhaseAuthority: boolean;
    readonly dependencyRefs: readonly string[];
  }[];
}) {
  const relationshipChanges = input.relationshipEvolution === undefined ? undefined : validateGlobalM5TransformationFeed(input.relationshipEvolution);
  const ids = new Set<string>();
  const analyses = [...input.series].sort((a, b) => a.signalId.localeCompare(b.signalId)).map((series) => {
    if (!Object.hasOwn(transformationSignalCatalog, series.catalogKey) || !series.signalId || !series.subjectRef || ids.has(series.signalId)) throw new TypeError("Invalid or duplicate transformation catalog signal.");
    ids.add(series.signalId);
    parseYearMonth(series.certifiedThroughMonth);
    return { series, changes: buildGlobalTemporalChangeCandidates(series), chapters: buildGlobalTemporalChapters(series), gradual: buildGlobalGradualTransitions(series) };
  });
  if (new Set(analyses.map((a) => a.series.certifiedThroughMonth)).size > 1) throw new TypeError("Transformation signals must share the certified boundary.");
  const entries = analyses.flatMap(({ series, changes, chapters, gradual }) => {
    const starts = new Map<YearMonth, { readonly start: YearMonth; readonly end?: YearMonth; readonly reason?: string; readonly shape: "STEP_CHANGE" | "GRADUAL_TRANSITION"; readonly settled?: YearMonth; readonly beforeLevel: string; readonly afterLevel: string }>();
    for (const c of changes.candidates.filter((c) => c.status === "CONFIRMED_LEVEL_CHANGE")) starts.set(c.boundaryMonth, { start: c.boundaryMonth, shape: "STEP_CHANGE", beforeLevel: c.beforeLevel, afterLevel: c.afterLevel });
    for (const c of gradual) starts.set(c.start, { start: c.start, settled: c.settled, shape: "GRADUAL_TRANSITION", beforeLevel: c.beforeLevel, afterLevel: c.afterLevel });
    for (const c of chapters.chapters) starts.set(c.start, { start: c.start, end: c.end, reason: c.endReason, shape: "STEP_CHANGE", beforeLevel: c.beforeLevel, afterLevel: c.chapterLevel });
    return [...starts.values()].map((phase) => ({
      series, phase,
      signal: {
        signalId: `${series.signalId}@${phase.start}`, subjectRef: series.subjectRef,
        domain: transformationSignalCatalog[series.catalogKey], interval: { start: monthInterval(phase.start).start, end: monthInterval(phase.settled ?? phase.start).end },
        certifiedOnset: { value: phase.start, precision: "MONTH" },
        semanticRefs: [...series.semanticRefs].sort(),
        dependencyRefs: [...new Set([...changes.dependencyRefs, ...series.structuralAuthorityRefs, ...series.evidence.evidenceRefs])].sort(),
        qualification: "CONFIRMED", materiality: "MATERIAL",
      } satisfies GlobalSemanticChange,
    }));
  });
  // Relation identities address certified change instances, not arbitrary input rows.
  const applicableAnchors = (input.anchors ?? []).filter((a) => entries.some((e) => e.signal.signalId === a.signalId && e.signal.semanticRefs.includes(a.anchorRef) && a.date.slice(0, 7) === e.phase.start));
  for (const a of applicableAnchors) {
    parseLocalDate(a.date);
    if (!a.dependencyRefs.length || typeof a.strongPhaseAuthority !== "boolean") throw new TypeError("Anchor requires Canonical provenance.");
  }
  const fusion = fuseGlobalTemporalSignals({ signals: entries.map((e) => e.signal), relations: input.relations,
    driverAuthorities: [...(input.driverAuthorities ?? []), ...applicableAnchors.map((a) => ({
      kind: "SEMANTIC_ANCHOR" as const, signalId: a.signalId, authorityRef: a.anchorRef, dependencyRefs: a.dependencyRefs,
    }))] });
  const transformations = fusion.groups.map((group) => {
    const members = entries.filter((e) => group.signalIds.includes(e.signal.signalId));
    const primary = members.find((e) => e.signal.signalId === group.primaryDriver)!;
    const starts = members.map((e) => e.phase.start).sort();
    const closed = members.every((e) => e.phase.end !== undefined);
    const multiDomain = group.domains.length >= 2;
    const structural = members.some((e) => e.series.structuralAuthorityRefs.length > 0);
    const anchors = applicableAnchors.filter((a) => group.signalIds.includes(a.signalId));
    const strongAnchor = anchors.some((a) => a.strongPhaseAuthority);
    const kind = closed ? "TEMPORARY_CHAPTER" as const : multiDomain || strongAnchor ? "NEW_PHASE" as const : "DURABLE_CHANGE" as const;
    const hasNonAnchorSignal = members.some((m) => m.series.catalogKey !== "MOMENT_PROJECT_PHASE");
    const confirmed = hasNonAnchorSignal && (closed || multiDomain || strongAnchor || structural);
    const start = anchors.length ? anchors.map((a) => a.date).sort()[0] : starts[0];
    const end = closed ? members.map((e) => e.phase.end!).sort().at(-1)! : undefined;
    if (end !== undefined) parseLocalDate(`${end}-01`);
    const status = !confirmed ? "CANDIDATE" as const : closed ? "CONFIRMED_CLOSED" as const : "CONFIRMED_ONGOING" as const;
    return {
      transformationId: group.groupId, kind, status,
      shape: anchors.length ? "ANCHORED_ONSET" as const : primary.phase.shape, start, ...(end === undefined ? {} : { end, endSemantics: "EXCLUSIVE_MONTH_BOUNDARY" as const }),
      datePrecision: anchors.length ? "DAY" as const : "MONTH" as const,
      primaryDriver: group.primaryDriver, supportingSignals: group.supportingSignals,
      driverProvenance: group.driverProvenance,
      titleKey: `global.transformation.${kind.toLowerCase()}`,
      beforeSummary: members.map((m) => ({ signalId: m.signal.signalId, value: m.phase.beforeLevel })),
      afterSummary: members.map((m) => ({ signalId: m.signal.signalId, value: m.phase.afterLevel })),
      support: members.map((m) => ({ signalId: m.signal.signalId, sourceSupport: m.series.evidence.support })),
      affectedDomains: group.domains, evidenceRefs: [...new Set([...group.dependencyRefs, ...anchors.flatMap((a) => a.dependencyRefs)])].sort(),
      currentRegime: buildGlobalCurrentRegime({ points: primary.series.points, certifiedThroughMonth: primary.series.certifiedThroughMonth,
        regime: { kind, status, start: primary.phase.settled ?? primary.phase.start, evidenceRefs: group.dependencyRefs } }),
      methodVersion: "global_transformations@v1",
    };
  });
  return {
    dependencyDeclaration: createGlobalTemporalDependencyDeclaration({ includeRelationships: relationshipChanges !== undefined }),
    ...(relationshipChanges === undefined ? {} : { relationshipChanges, relationshipEnrichmentHash: digest(relationshipChanges), relationshipEnrichmentAffectsRegime: false as const }),
    transformations,
    diagnostics: analyses.map((a) => ({ signalId: a.series.signalId, changes: a.changes, chapters: a.chapters, gradual: a.gradual })),
    methodVersion: relationshipChanges === undefined ? "global_transformations@v1" : "global_transformations_with_relationships@v1",
    inputHash: digest({ fusion: fusion.inputHash, transformations, analyses: analyses.map((a) => ({ signalId: a.series.signalId, catalogKey: a.series.catalogKey, changes: a.changes.inputHash, chapters: a.chapters })), catalog: transformationSignalCatalog, method: "global_transformations@v1", ...(relationshipChanges === undefined ? {} : { relationshipChanges, relationshipEvolutionMethod: "global_m5_m3_evolution@v1" }) }),
  };
}
