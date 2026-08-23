import "server-only";

import type { AnalyticsImpact } from "../../analytics/publication";
import {
  queryResourceKeys,
  type QueryResourceKey,
} from "../request";

const monthResources = [
  queryResourceKeys.historyCalendarMonth,
  queryResourceKeys.historyCalendarMonthSummary,
  queryResourceKeys.historyDayDetail,
  queryResourceKeys.analysisMonthInitial,
  queryResourceKeys.analysisMonthBreakdown,
  queryResourceKeys.analysisMonthEvolution,
  queryResourceKeys.analysisMonthStructure,
  queryResourceKeys.analysisMonthLived,
  queryResourceKeys.analysisMonthMoments,
  queryResourceKeys.analysisTarget,
  queryResourceKeys.analysisMonthContexts,
  queryResourceKeys.entityPlace,
  queryResourceKeys.entityMerchant,
  queryResourceKeys.entityMoment,
  queryResourceKeys.entityPersona,
  queryResourceKeys.entityLifeEvent,
  queryResourceKeys.entityOperation,
  queryResourceKeys.galleryMoments,
  queryResourceKeys.galleryPlaces,
  queryResourceKeys.galleryMerchants,
  queryResourceKeys.operationsBrowse,
] as const;

const globalReferenceResources = [
  queryResourceKeys.analysisGlobalInitial,
  queryResourceKeys.analysisGlobalBreakdown,
  queryResourceKeys.analysisGlobalEvolution,
  queryResourceKeys.analysisGlobalContexts,
  queryResourceKeys.analysisMonthInitial,
  queryResourceKeys.analysisMonthEvolution,
] as const;

const entityResources = Object.freeze({
  merchant: [
    queryResourceKeys.entityMerchant,
    queryResourceKeys.entityPlace,
    queryResourceKeys.entityPersona,
    queryResourceKeys.galleryMerchants,
    queryResourceKeys.operationsBrowse,
  ],
  place: [
    queryResourceKeys.entityPlace,
    queryResourceKeys.entityMerchant,
    queryResourceKeys.entityPersona,
    queryResourceKeys.galleryPlaces,
    queryResourceKeys.operationsBrowse,
  ],
  life_event: [
    queryResourceKeys.entityLifeEvent,
    queryResourceKeys.entityMoment,
    queryResourceKeys.entityOperation,
    queryResourceKeys.galleryMoments,
    queryResourceKeys.operationsBrowse,
  ],
  moment: [
    queryResourceKeys.entityMoment,
    queryResourceKeys.entityLifeEvent,
    queryResourceKeys.entityOperation,
    queryResourceKeys.galleryMoments,
    queryResourceKeys.operationsBrowse,
  ],
  category: [queryResourceKeys.analysisMonthBreakdown, queryResourceKeys.analysisGlobalBreakdown, queryResourceKeys.operationsBrowse],
  activity: [queryResourceKeys.entityPersona, queryResourceKeys.galleryMoments],
} as const);

export function queryResourcesInvalidatedByImpact(
  impact: AnalyticsImpact,
): readonly QueryResourceKey[] {
  if (impact.kind === "month") return [...monthResources];
  if (impact.kind === "entity") return [...entityResources[impact.entity.kind]];
  if (impact.kind === "narrative") {
    return [
      queryResourceKeys.entityMoment,
      queryResourceKeys.entityLifeEvent,
      queryResourceKeys.galleryMoments,
      queryResourceKeys.operationsBrowse,
    ];
  }
  return impact.reason === "method_version_changed"
    ? [...globalReferenceResources, queryResourceKeys.metricMethodology]
    : [...globalReferenceResources];
}

export function invalidatesQueryResource(
  impact: AnalyticsImpact,
  resource: QueryResourceKey,
): boolean {
  return queryResourcesInvalidatedByImpact(impact).includes(resource);
}
