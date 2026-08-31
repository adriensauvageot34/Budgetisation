import type {
  ActivityId,
  CategoryId,
  HouseholdId,
  LifeEventId,
  MerchantId,
  MomentId,
  PlaceId,
} from "../../core/identity";
import type { ApiMeta } from "../../core/api";
import type { PublicationMeta } from "../../core/history-v2";
import type { Instant, YearMonth } from "../../core/time";
import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
  MethodVersion,
} from "../../core/versions";
import type { ProducedMetric } from "../production";

export type AnalyticsImpactReason =
  | "canonical_data_changed"
  | "classification_changed"
  | "completeness_changed"
  | "new_complete_month"
  | "method_version_changed"
  | "facts_hash_changed";

export type AnalyticsEntity =
  | { readonly kind: "merchant"; readonly id: MerchantId }
  | { readonly kind: "place"; readonly id: PlaceId }
  | { readonly kind: "life_event"; readonly id: LifeEventId }
  | { readonly kind: "moment"; readonly id: MomentId }
  | { readonly kind: "category"; readonly id: CategoryId }
  | { readonly kind: "activity"; readonly id: ActivityId };

export type AnalyticsImpact =
  | {
      readonly kind: "month";
      readonly month: YearMonth;
      readonly reason: AnalyticsImpactReason;
    }
  | {
      readonly kind: "entity";
      readonly entity: AnalyticsEntity;
      readonly reason: AnalyticsImpactReason;
    }
  | {
      readonly kind: "global-reference";
      readonly asOf: YearMonth;
      readonly referenceFamily: "current";
      readonly reason: AnalyticsImpactReason;
    }
  | {
      readonly kind: "narrative";
      readonly factsHash: string;
      readonly reason: "facts_hash_changed";
    };

export type AnalyticsChange =
  | {
      readonly kind: "month";
      readonly month: YearMonth;
      readonly reason: Extract<
        AnalyticsImpactReason,
        | "canonical_data_changed"
        | "classification_changed"
        | "completeness_changed"
      >;
      readonly affectsCurrentReferences: boolean;
      readonly asOf?: YearMonth;
    }
  | {
      readonly kind: "entity";
      readonly entity: AnalyticsEntity;
      readonly reason: Extract<
        AnalyticsImpactReason,
        "canonical_data_changed" | "classification_changed"
      >;
    }
  | {
      readonly kind: "new_complete_month";
      readonly month: YearMonth;
      readonly asOf: YearMonth;
    }
  | {
      readonly kind: "method_version";
      readonly asOf: YearMonth;
      readonly methodVersion: MethodVersion;
    }
  | {
      readonly kind: "facts_hash";
      readonly factsHash: string;
    }
  | { readonly kind: "technical_result_preserving" };

export type AnalyticsRevisionState = {
  readonly householdId: HouseholdId;
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
  readonly publishedAt?: Instant;
};

export type AnalyticsRecomputeDraft = {
  readonly householdId: HouseholdId;
  readonly baseDataRevision: DataRevision;
  readonly baseAnalyticsRevision: AnalyticsRevision;
  readonly sourceDataRevision: DataRevision;
  readonly impacts: readonly AnalyticsImpact[];
  readonly requiredArtifactIds: readonly string[];
};

export type PublicationDependency = {
  readonly artifactId: string;
  readonly status: "fresh" | "stale";
  readonly sourceDataRevision: DataRevision;
  readonly methodVersion?: MethodVersion;
  readonly requiredMethodVersion?: MethodVersion;
};

export type AnalyticsPublicationArtifact = {
  readonly artifactId: string;
  readonly metric: ProducedMetric;
  readonly sourceDataRevision: DataRevision;
  readonly dependencies: readonly PublicationDependency[];
};

export type AnalyticsPublicationCandidate = {
  readonly draft: AnalyticsRecomputeDraft;
  readonly artifacts: readonly AnalyticsPublicationArtifact[];
  readonly publishedAt: Instant;
};

export type AnalyticsPublishedState = AnalyticsRevisionState & {
  readonly artifacts: readonly AnalyticsPublicationArtifact[];
};

export type AnalyticsPublicationStore = {
  readonly readRevisionState: (
    householdId: HouseholdId,
  ) => Promise<AnalyticsRevisionState>;
  readonly publishAtomically: (input: {
    readonly expectedAnalyticsRevision: AnalyticsRevision;
    readonly nextState: AnalyticsPublishedState;
  }) => Promise<boolean>;
};

export type PublicationApiMetaInput = {
  readonly contractVersion: ContractVersion;
  readonly computedAt: Instant;
  readonly publication?: PublicationMeta;
  readonly cachePolicy?: ApiMeta["cachePolicy"];
};

export type PublishedApiMeta = ApiMeta;
