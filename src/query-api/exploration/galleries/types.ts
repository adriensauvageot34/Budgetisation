import type { MerchantId, MomentId, PlaceId } from "../../../core/identity";
import type { QueryCapabilities } from "../../capabilities";
import type { CursorPage } from "../../collections";
import type { ScopedCountMetricReadModel, ScopedMoneyMetricReadModel } from "../../read-models";

export type MomentGalleryCard = {
  readonly momentId: MomentId;
  readonly title: string;
};
export type PlaceGalleryCard = {
  readonly placeId: PlaceId;
  readonly label: string;
  readonly visitCount?: ScopedCountMetricReadModel;
  readonly localizedSpend?: ScopedMoneyMetricReadModel;
};
export type MerchantGalleryCard = {
  readonly merchantId: MerchantId;
  readonly label: string;
  readonly economicAmount?: ScopedMoneyMetricReadModel;
  readonly purchaseCount?: ScopedCountMetricReadModel;
};

export type GalleryMomentsReadModel = {
  readonly page: CursorPage<MomentGalleryCard>;
  readonly capabilities: QueryCapabilities;
};
export type GalleryPlacesReadModel = {
  readonly page: CursorPage<PlaceGalleryCard>;
  readonly capabilities: QueryCapabilities;
};
export type GalleryMerchantsReadModel = {
  readonly page: CursorPage<MerchantGalleryCard>;
  readonly capabilities: QueryCapabilities;
};
