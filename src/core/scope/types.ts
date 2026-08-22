import type {
  ActivityId,
  Brand,
  CategoryId,
  MerchantId,
  PersonId,
  PlaceId,
} from "../identity";
import type { GlobalWindow, YearMonth } from "../time";
import type { DayContext, LifeScopeContext } from "./contexts";

export type AnalysisSubject =
  | {
      readonly kind: "household";
    }
  | {
      readonly kind: "person";
      readonly personId: PersonId;
    };

export type AnalysisTime =
  | {
      readonly kind: "month";
      readonly month: YearMonth;
    }
  | {
      readonly kind: "global";
      readonly observationWindow: GlobalWindow;
      readonly asOf: YearMonth;
    };

export type AnalysisFilters = {
  readonly categoryIds?: readonly CategoryId[];
  readonly activityIds?: readonly ActivityId[];
  readonly merchantIds?: readonly MerchantId[];
  readonly placeIds?: readonly PlaceId[];
  readonly lifeScopeContext?: readonly LifeScopeContext[];
  readonly dayContext?: readonly DayContext[];
};

export type AnalysisScope = {
  readonly subject: AnalysisSubject;
  readonly time: AnalysisTime;
  readonly filters?: AnalysisFilters;
};

export type NormalizedAnalysisFilters = {
  readonly categoryIds: readonly CategoryId[];
  readonly activityIds: readonly ActivityId[];
  readonly merchantIds: readonly MerchantId[];
  readonly placeIds: readonly PlaceId[];
  readonly lifeScopeContext: readonly LifeScopeContext[];
  readonly dayContext: readonly DayContext[];
};

export type NormalizedAnalysisScope = {
  readonly subject: AnalysisSubject;
  readonly time: AnalysisTime;
  readonly filters: NormalizedAnalysisFilters;
};

export type ScopeHash = Brand<string, "ScopeHash">;
