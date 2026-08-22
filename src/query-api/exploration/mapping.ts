import {
  queryResourceKeys,
  type QueryResourceKey,
} from "../request";

export type QueryExplorationDestination =
  | { readonly kind: "moment" }
  | { readonly kind: "place" }
  | { readonly kind: "merchant" }
  | { readonly kind: "persona" }
  | { readonly kind: "life_event" }
  | { readonly kind: "operation" }
  | { readonly kind: "methodology" }
  | { readonly kind: "gallery"; readonly gallery: "moments" | "places" | "merchants" };

export const explorationResourceByKind = Object.freeze({
  moment: queryResourceKeys.entityMoment,
  place: queryResourceKeys.entityPlace,
  merchant: queryResourceKeys.entityMerchant,
  persona: queryResourceKeys.entityPersona,
  life_event: queryResourceKeys.entityLifeEvent,
  operation: queryResourceKeys.entityOperation,
  methodology: queryResourceKeys.metricMethodology,
} as const);

export const galleryResourceByKind = Object.freeze({
  moments: queryResourceKeys.galleryMoments,
  places: queryResourceKeys.galleryPlaces,
  merchants: queryResourceKeys.galleryMerchants,
} as const);

export function queryResourceForExplorationDestination(
  destination: QueryExplorationDestination,
): QueryResourceKey {
  return destination.kind === "gallery"
    ? galleryResourceByKind[destination.gallery]
    : explorationResourceByKind[destination.kind];
}
