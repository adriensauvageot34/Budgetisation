import type { ApiResponse } from "@/core/api";
import type { MetricId, OperationId } from "@/core/identity";
import type { LocalDate } from "@/core/time";
import type {
  ActiveExplorationState,
  ExplorationNode,
  NavigationCommandResult,
} from "@/navigation";
import type {
  EntityLifeEventReadModel,
  EntityMerchantReadModel,
  EntityMomentReadModel,
  EntityOperationReadModel,
  EntityPersonaReadModel,
  EntityPlaceReadModel,
  GalleryMerchantsReadModel,
  GalleryMomentsReadModel,
  GalleryPlacesReadModel,
  MerchantsGalleryFilters,
  NormalizedGalleryMerchantsParams,
  MetricMethodologyReadModel,
  MomentsGalleryFilters,
  NormalizedGalleryMomentsParams,
  PlacesGalleryFilters,
  NormalizedGalleryPlacesParams,
} from "@/query-api";
import type { UiTransportState } from "@/ui";

export type ExplorationNavigation = {
  push(node: ExplorationNode): NavigationCommandResult;
  pop(): NavigationCommandResult;
  close(): NavigationCommandResult;
};

export type OperationPreviewModel = {
  readonly operationId: OperationId;
  readonly label: string;
  readonly bankDate?: LocalDate;
};

export type ExplorationNodeTransport =
  | {
      readonly kind: "moment";
      readonly node: Extract<ExplorationNode, { readonly kind: "moment" }>;
      readonly transport: UiTransportState<EntityMomentReadModel>;
    }
  | {
      readonly kind: "place";
      readonly node: Extract<ExplorationNode, { readonly kind: "place" }>;
      readonly transport: UiTransportState<EntityPlaceReadModel>;
    }
  | {
      readonly kind: "merchant";
      readonly node: Extract<ExplorationNode, { readonly kind: "merchant" }>;
      readonly transport: UiTransportState<EntityMerchantReadModel>;
    }
  | {
      readonly kind: "persona";
      readonly node: Extract<ExplorationNode, { readonly kind: "persona" }>;
      readonly transport: UiTransportState<EntityPersonaReadModel>;
    }
  | {
      readonly kind: "life_event";
      readonly node: Extract<ExplorationNode, { readonly kind: "life_event" }>;
      readonly transport: UiTransportState<EntityLifeEventReadModel>;
    }
  | {
      readonly kind: "operation";
      readonly node: Extract<ExplorationNode, { readonly kind: "operation" }>;
      readonly transport: UiTransportState<EntityOperationReadModel>;
    }
  | {
      readonly kind: "methodology";
      readonly node: Extract<ExplorationNode, { readonly kind: "methodology" }>;
      readonly transport: UiTransportState<MetricMethodologyReadModel>;
    }
  | {
      readonly kind: "gallery_moments";
      readonly node: Extract<ExplorationNode, { readonly kind: "gallery"; readonly gallery: "moments" }>;
      readonly transport: UiTransportState<GalleryMomentsReadModel>;
    }
  | {
      readonly kind: "gallery_places";
      readonly node: Extract<ExplorationNode, { readonly kind: "gallery"; readonly gallery: "places" }>;
      readonly transport: UiTransportState<GalleryPlacesReadModel>;
    }
  | {
      readonly kind: "gallery_merchants";
      readonly node: Extract<ExplorationNode, { readonly kind: "gallery"; readonly gallery: "merchants" }>;
      readonly transport: UiTransportState<GalleryMerchantsReadModel>;
    }
  | {
      readonly kind: "analysis";
      readonly node: Extract<ExplorationNode, { readonly kind: "analysis" }>;
      readonly transport?: never;
    };

export type ExplorationPanelState = {
  readonly exploration: ActiveExplorationState;
  readonly current: ExplorationNodeTransport;
};

export type GalleryQueryState<SortKey extends string, Filters> = {
  readonly search: string;
  readonly sort: SortKey;
  readonly filters: Filters;
};

export type GalleryActions<SortKey extends string> = {
  readonly onSearch: (search: string) => void;
  readonly onSort: (sort: SortKey) => void;
  readonly onRemoveFilter: (filter: "activityIds" | "placeIds") => void;
  readonly onLoadMore: (cursor: string) => void;
  readonly onRetry?: () => void;
};

export type MomentsGallerySortKey = NormalizedGalleryMomentsParams["sort"]["key"];
export type PlacesGallerySortKey = NormalizedGalleryPlacesParams["sort"]["key"];
export type MerchantsGallerySortKey = NormalizedGalleryMerchantsParams["sort"]["key"];

export type GalleryRuntime =
  | {
      readonly gallery: "moments";
      readonly query: GalleryQueryState<MomentsGallerySortKey, MomentsGalleryFilters>;
      readonly actions: GalleryActions<MomentsGallerySortKey>;
    }
  | {
      readonly gallery: "places";
      readonly query: GalleryQueryState<PlacesGallerySortKey, PlacesGalleryFilters>;
      readonly actions: GalleryActions<PlacesGallerySortKey>;
    }
  | {
      readonly gallery: "merchants";
      readonly query: GalleryQueryState<MerchantsGallerySortKey, MerchantsGalleryFilters>;
      readonly actions: GalleryActions<MerchantsGallerySortKey>;
    };

export type RevisionIdentity = Pick<
  ApiResponse<unknown>["meta"],
  "dataRevision" | "analyticsRevision" | "contractVersion"
>;

export function sameRevision(
  left: RevisionIdentity,
  right: RevisionIdentity,
): boolean {
  return left.dataRevision === right.dataRevision &&
    left.analyticsRevision === right.analyticsRevision &&
    left.contractVersion === right.contractVersion;
}

export type MethodologyDestination = {
  readonly kind: "methodology";
  readonly metricId: MetricId;
};
