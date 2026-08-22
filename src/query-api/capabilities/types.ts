import type { ActiveMetricId } from "../../analytics/production";
import type { ApiError } from "../../core/api";
import type { Brand, MetricId } from "../../core/identity";
import type { QueryResourceKey } from "../request";

export type QuerySectionKey<Name extends string = string> = Brand<
  Name,
  "QuerySectionKey"
>;

export const queryFilterKeys = [
  "categoryIds",
  "activityIds",
  "merchantIds",
  "placeIds",
  "lifeScopeContext",
  "dayContext",
] as const;

export type QueryFilterKey = (typeof queryFilterKeys)[number];

export type UnavailableReason =
  | "not_applicable"
  | "scope_incompatible"
  | "filter_incompatible"
  | "measure_incompatible"
  | "section_incompatible"
  | "permission_limited"
  | "contract_not_supported";

export type QueryUnavailableCapability =
  | {
      readonly kind: "section";
      readonly section: QuerySectionKey;
      readonly reason: UnavailableReason;
    }
  | {
      readonly kind: "measure";
      readonly metricId: MetricId;
      readonly reason: UnavailableReason;
    }
  | {
      readonly kind: "filter";
      readonly filter: QueryFilterKey;
      readonly reason: UnavailableReason;
    };

export type QueryCapabilities = {
  readonly resource: QueryResourceKey;
  readonly availableSections: readonly QuerySectionKey[];
  readonly availableMeasures: readonly ActiveMetricId[];
  readonly compatibleFilters: readonly QueryFilterKey[];
  readonly unavailable: readonly QueryUnavailableCapability[];
};

export type QueryCapabilityMaximum = {
  readonly resource: QueryResourceKey;
  readonly sections: readonly QuerySectionKey[];
  readonly measures: readonly ActiveMetricId[];
  readonly filters: readonly QueryFilterKey[];
};

export type QueryCapabilitySelection = {
  readonly sections?: readonly QuerySectionKey[];
  readonly measures?: readonly ActiveMetricId[];
  readonly filters?: readonly QueryFilterKey[];
};

export type QueryPermissionDecision =
  | {
      readonly granted: false;
      readonly errorCode: "PERMISSION_DENIED" | "NOT_FOUND";
    }
  | ({ readonly granted: true } & QueryCapabilitySelection);

export type QueryCapabilityEvaluationContext = {
  readonly requestId: string;
  readonly permission: QueryPermissionDecision;
  readonly applicability?: QueryCapabilitySelection & {
    readonly resourceApplicable?: boolean;
  };
  readonly contractSupport?: QueryCapabilitySelection;
};

export type QueryCapabilityResult =
  | { readonly ok: true; readonly capabilities: QueryCapabilities }
  | { readonly ok: false; readonly error: ApiError };
