import type {
  LifeEventId,
  MerchantId,
  MetricId,
  MomentId,
  OperationId,
  PersonId,
  PlaceId,
} from "../../../core/identity";
import type { Coverage } from "../../../core/metrics";
import type { QueryCapabilities } from "../../capabilities";

export type EntityIdentity = {
  readonly title: string;
  readonly subtitle?: string;
  readonly status?: string;
};

export type EntityReadModelBase<Id extends string> = {
  readonly id: Id;
  readonly identity: EntityIdentity;
  readonly capabilities: QueryCapabilities;
};

export type EntityPreview<T> = {
  readonly items: readonly T[];
  readonly hasMore: boolean;
  readonly totalCount?: number;
};

export type ApplicabilitySection<T> =
  | {
      readonly state: "available";
      readonly value: T;
      readonly coverage?: Coverage;
    }
  | {
      readonly state: "not_applicable" | "unknown" | "conflict";
      readonly value: null;
    };

export type PersonRef = {
  readonly kind: "person";
  readonly id: PersonId;
  readonly label?: string;
};

export type PersonaRef =
  | PersonRef
  | { readonly kind: "ensemble"; readonly label?: string };

export type SemanticEntityRef =
  | { readonly kind: "moment"; readonly id: MomentId; readonly label?: string }
  | { readonly kind: "place"; readonly id: PlaceId; readonly label?: string }
  | { readonly kind: "merchant"; readonly id: MerchantId; readonly label?: string }
  | PersonaRef
  | { readonly kind: "life_event"; readonly id: LifeEventId; readonly label?: string }
  | { readonly kind: "operation"; readonly id: OperationId; readonly label?: string }
  | { readonly kind: "methodology"; readonly id: MetricId; readonly label?: string };
