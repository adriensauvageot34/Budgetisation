import type { Instant } from "../time";
import type { PublicationMeta } from "../history-v2";
import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
} from "../versions";

export type ApiErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "INVALID_SCOPE"
  | "CONTRACT_MISMATCH"
  | "COMPUTATION_FAILED"
  | "TEMPORARY_UNAVAILABLE";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
}

export interface ApiMeta {
  dataRevision: DataRevision;
  analyticsRevision: AnalyticsRevision;
  contractVersion: ContractVersion;
  computedAt: Instant;
  publication?: PublicationMeta;
  cachePolicy?: {
    readonly source: "materialized" | "computed";
    readonly revalidate: "never" | "stale_while_revalidate";
    readonly sourceRevision: DataRevision;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}
