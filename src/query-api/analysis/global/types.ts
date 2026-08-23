import type { ActiveMetricId } from "../../../analytics/production";
import type { ActivityId, MerchantId, MomentId, PlaceId } from "../../../core/identity";
import type { Support } from "../../../core/metrics";
import type { GlobalWindow, YearMonth } from "../../../core/time";
import type { QueryCapabilities } from "../../capabilities";
import type { MerchantGalleryCard, MomentGalleryCard, PlaceGalleryCard } from "../../exploration";
import type { PersonaTarget } from "../../request";
import type {
  CountMetricEnvelope,
  ReadModelSubject,
  ScopedMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "../../read-models";
import type {
  AnalysisBreakdownReadModel,
  AnalysisContextsReadModelBase,
  AnalysisSeriesPoint,
} from "../shared/types";

export type AnalysisGlobalIdentity = {
  readonly observationWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly subject: ReadModelSubject;
};

export type AnalysisGlobalInitialReadModel = AnalysisGlobalIdentity & {
  readonly documentedMonths: CountMetricEnvelope;
  readonly documentedActivities: CountMetricEnvelope;
  readonly momentsCount: CountMetricEnvelope;
  readonly observedPlacesCount: CountMetricEnvelope;
  readonly operationsCount: CountMetricEnvelope;
  readonly economicConsumptionNetAttributable: ScopedMoneyMetricReadModel;
  readonly capabilities: QueryCapabilities;
};

export type GlobalReferenceSlot =
  | { readonly status: "available"; readonly metric: ScopedMoneyMetricReadModel }
  | {
      readonly status: "unavailable";
      readonly reason: "missing_source" | "blocked_data" | "not_applicable";
    };

export type AnalysisGlobalBaselineReadModel = AnalysisGlobalIdentity & {
  readonly defaultView: "month";
  readonly day: {
    readonly neutral: GlobalReferenceSlot;
    readonly typical: GlobalReferenceSlot;
  };
  readonly week: {
    readonly neutral: GlobalReferenceSlot;
    readonly calendarAdjustedNeutral: GlobalReferenceSlot;
  };
  readonly month: {
    readonly minimal: GlobalReferenceSlot;
    readonly calendarAdjustedNeutral: GlobalReferenceSlot;
  };
  readonly capabilities: QueryCapabilities;
};

export type TypicalBehaviorRow = {
  readonly activityId: ActivityId;
  readonly label: string;
  readonly activePeriodCount: number;
  readonly observablePeriodCount: number;
  readonly activityRate: number | null;
  readonly habitualFrequency: number | null;
  readonly support: Support;
  readonly variability: {
    readonly status: "unavailable";
    readonly reason: "missing_contract";
  };
  readonly destination: {
    readonly kind: "target";
    readonly target: { readonly kind: "activity"; readonly activityId: ActivityId };
  };
};

export type AnalysisGlobalTypicalReadModel = AnalysisGlobalIdentity & {
  readonly monthlyTypical: GlobalReferenceSlot;
  readonly behaviorRows: readonly TypicalBehaviorRow[];
  readonly capabilities: QueryCapabilities;
};

export type AnalysisGlobalEvolutionView = "money" | "behavior";
export type AnalysisGlobalEvolutionSeries = {
  readonly seriesId: string;
  readonly label: string;
  readonly metricId: ActiveMetricId;
  readonly unit: string;
  readonly points: readonly AnalysisSeriesPoint[];
};
export type AnalysisGlobalEvolutionReadModel = AnalysisGlobalIdentity & {
  readonly view: AnalysisGlobalEvolutionView;
  readonly series: readonly AnalysisGlobalEvolutionSeries[];
  readonly smallMultiplesRecommended: boolean;
  readonly capabilities: QueryCapabilities;
};

export type GlobalHeatmapCell = {
  readonly rowId: ActivityId;
  readonly columnId: YearMonth;
  readonly state: "known" | "unknown" | "not_applicable" | "insufficient_support" | "conflict" | "estimated";
  readonly value: number | null;
};
export type GlobalActivityMonthHeatmap = {
  readonly contract: "activity_month_frequency";
  readonly unit: "count/month";
  readonly palette: "sequential";
  readonly rows: readonly { readonly id: ActivityId; readonly label: string }[];
  readonly columns: readonly YearMonth[];
  readonly cells: readonly GlobalHeatmapCell[];
};
export type AnalysisGlobalHabitsReadModel = AnalysisGlobalIdentity & {
  readonly view: "contexts" | "heatmap" | "relationships" | "patterns";
  readonly availableViews: readonly ("contexts" | "heatmap")[];
  readonly content:
    | { readonly kind: "contexts"; readonly contexts: AnalysisContextsReadModelBase }
    | { readonly kind: "heatmap"; readonly heatmap: GlobalActivityMonthHeatmap }
    | { readonly kind: "unavailable"; readonly reason: "missing_method_or_source" };
  readonly capabilities: QueryCapabilities;
};

export type GlobalRankedRef<Id extends string> = {
  readonly id: Id;
  readonly label: string;
  readonly count: number;
  readonly support: Support;
};
export type AnalysisGlobalProfilesReadModel = AnalysisGlobalIdentity & {
  readonly target: PersonaTarget;
  readonly label: string;
  readonly dominantActivity?: GlobalRankedRef<ActivityId>;
  readonly frequentPlace?: GlobalRankedRef<PlaceId>;
  readonly dominantContext?: GlobalRankedRef<string>;
  readonly destination: { readonly kind: "persona"; readonly target: PersonaTarget };
  readonly capabilities: QueryCapabilities;
};

export type AnalysisGlobalUniverseReadModel = AnalysisGlobalIdentity & {
  readonly moments: {
    readonly sort: "recent";
    readonly items: readonly MomentGalleryCard[];
    readonly hasMore: boolean;
  };
  readonly places: {
    readonly sort: "frequent";
    readonly items: readonly PlaceGalleryCard[];
    readonly hasMore: boolean;
  };
  readonly merchants: {
    readonly sort: "spent";
    readonly items: readonly MerchantGalleryCard[];
    readonly hasMore: boolean;
  };
  readonly capabilities: QueryCapabilities;
};

/** Internal compatibility resources; they are not product module authorities. */
export type AnalysisGlobalBreakdownReadModel = AnalysisGlobalIdentity & {
  readonly breakdown: AnalysisBreakdownReadModel;
};
export type AnalysisGlobalContextsReadModel = AnalysisGlobalIdentity & {
  readonly contexts: AnalysisContextsReadModelBase;
};

export type GlobalUniverseIdentity = MomentId | PlaceId | MerchantId;
export type GlobalMetricReadModel = ScopedMetricReadModel;
