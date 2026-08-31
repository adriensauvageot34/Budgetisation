import type { HouseholdId } from "../../../core/identity";
import type {
  CollectionValue,
  MetricValue,
  Provenance,
  QualityEnvelope,
} from "../../../core/history-v2";
import type { LocalDate, YearMonth } from "../../../core/time";
import type { ArtifactInputHash } from "../facts-hash";

export type CalendarRenderMode = "Context" | "Marker" | "Ribbon" | "DetailOnly";
export type MarkerTier = "Dominant" | "Standard" | "Secondary";
export type SpanBehavior =
  | "POINT"
  | "DAILY_CONTEXT"
  | "AUTO_CONTINUOUS"
  | "EXPLICIT_CONTINUITY"
  | "PROJECT_PERIOD"
  | "INCIDENT_PERIOD";
export type ContinuityQualifier = "CONTINUOUS" | "NOT_CONTINUOUS";
export type CalendarSourceKind = "life_event" | "moment" | "fused" | "context" | "aggregate";
export type CalendarTitleKind =
  | "EXPLICIT_HUMAN"
  | "GENERATED_WITH_PLACE"
  | "GENERIC_FALLBACK";
export type CalendarAggregationPolicy = "NONE" | "SAME_TYPE_DAY" | "SAME_SERIES_DAY";

export type CalendarSemanticItem = {
  readonly calendarItemId: string;
  readonly sourceKind: CalendarSourceKind;
  readonly sourceRefs: readonly string[];
  readonly semanticTypeKey: string;
  readonly title: string;
  readonly titleKind: CalendarTitleKind;
  readonly iconKey: string;
  readonly renderMode: CalendarRenderMode;
  readonly markerTier?: MarkerTier;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly priorityWeight: number;
  readonly spanBehavior: SpanBehavior;
  readonly continuityQualifier?: MetricValue<ContinuityQualifier>;
  readonly anchorDate?: LocalDate;
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
  readonly startTime?: string;
  readonly householdParticipants: readonly string[];
  readonly externalParticipants?: readonly string[];
  readonly parentItemId?: string;
  readonly memberSourceIds: readonly string[];
  readonly rawOccurrenceCount: number;
  readonly monthVisibility: boolean;
  readonly authority: Provenance;
  readonly quality?: QualityEnvelope;
};

export type CalendarLifeEventSource = {
  readonly lifeEventId: string;
  readonly typeKey: string;
  readonly title?: string;
  readonly titleKind?: CalendarTitleKind;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly startTime?: string;
  readonly validationStatus: "Confirmé" | "Déduit";
  readonly participantIds: readonly string[];
  readonly externalParticipants?: readonly string[];
  readonly seriesId?: string;
  readonly parentLifeEventId?: string;
  readonly continuityQualifier?: MetricValue<ContinuityQualifier>;
  readonly explicitMonthVisibility?: boolean;
  readonly generatedPlaceTitle?: string;
  readonly authority?: Provenance;
};

export type CalendarMomentSource = {
  readonly momentId: string;
  /** Canonical French label or normalized key from the exhaustive Moment catalog. */
  readonly type: string;
  readonly title?: string;
  readonly titleKind?: CalendarTitleKind;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly participantIds?: readonly string[];
  readonly authority?: Provenance;
};

export type CalendarContextSource = {
  readonly contextId: string;
  readonly typeKey: "travail_site" | "teletravail" | "journee_maison" | "conge_repos" | "deplacement_pro" | "maladie";
  readonly date: LocalDate;
  readonly participantIds: readonly string[];
  readonly title?: string;
  readonly authority: Provenance;
};

export type MomentLifeEventRelationSource = {
  readonly momentId: string;
  readonly lifeEventId: string;
  readonly relationType: "Événement principal" | "Composant" | "Préparation";
  readonly validationStatus: "Confirmé" | "Déduit";
};

export type CalendarSemanticEngineInput = {
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly lifeEvents: readonly CalendarLifeEventSource[];
  readonly moments: readonly CalendarMomentSource[];
  readonly contexts: readonly CalendarContextSource[];
  readonly momentLifeEvents: readonly MomentLifeEventRelationSource[];
  readonly sourceCompleteness: "KNOWN" | "PARTIAL" | "UNKNOWN";
};

export type CalendarDayProjection = {
  readonly date: LocalDate;
  readonly contextItems: readonly CalendarSemanticItem[];
  /** Complete server order for every Marker group observed on the day. */
  readonly orderedMarkerGroups: CollectionValue<CalendarSemanticItem>;
  /** Month projection kept for direct consumers: exact prefix 1-3. */
  readonly markers: readonly CalendarSemanticItem[];
  readonly hiddenMarkerGroupCount: number;
};

export type CalendarRibbonSegment = {
  readonly ribbonItemId: string;
  readonly weekStart: LocalDate;
  readonly segmentStart: LocalDate;
  readonly segmentEnd: LocalDate;
  readonly originalStart: LocalDate;
  readonly originalEnd: LocalDate;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly lane: 1 | 2 | 3 | 4;
};

export type CalendarRibbonOverflowSegment = {
  readonly ribbonItemId: string;
  readonly weekStart: LocalDate;
  readonly segmentStart: LocalDate;
  readonly segmentEnd: LocalDate;
  readonly originalStart: LocalDate;
  readonly originalEnd: LocalDate;
};

export type CalendarRibbonWeek = {
  readonly weekStart: LocalDate;
  readonly segments: readonly CalendarRibbonSegment[];
  /** Exact server-ordered candidates that could not be assigned to lanes 1-4. */
  readonly overflowSegments: readonly CalendarRibbonOverflowSegment[];
  readonly ribbonOverflow: number;
};

export type CalendarSemanticMonthArtifact = {
  readonly artifactFamily: "calendar_semantic_month";
  readonly householdId: HouseholdId;
  readonly month: YearMonth;
  readonly items: CollectionValue<CalendarSemanticItem>;
  readonly days: readonly CalendarDayProjection[];
  readonly ribbonWeeks: readonly CalendarRibbonWeek[];
  readonly semanticIssues: readonly string[];
  readonly sourceScope: {
    readonly monthStart: LocalDate;
    readonly monthEnd: LocalDate;
    readonly includesItemsIntersectingMonth: true;
  };
  readonly dependencyPolicies: {
    readonly canonical_continuity: "v1";
    readonly calendar_semantics: "v1";
    readonly quality_visibility: "v1";
    readonly facts_hash: "v1";
  };
  /** Internal cache/invalidation digest; never PublicationMeta.factsHash. */
  readonly artifactInputHash: ArtifactInputHash;
};
