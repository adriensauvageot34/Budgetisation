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
  queryResourceKeys.historyMonthCalendar,
  queryResourceKeys.historyWeek,
  queryResourceKeys.historyDayJournal,
  queryResourceKeys.historyMonthOverview,
  queryResourceKeys.historyMonthBalanceSummary,
  queryResourceKeys.historyBankEconomyBridge,
  queryResourceKeys.historyMonthCategories,
  queryResourceKeys.historyCategoryDetail,
  queryResourceKeys.historyMonthSpendingNature,
  queryResourceKeys.historySpendingSegmentDetail,
  queryResourceKeys.historyMinimalPreview,
  queryResourceKeys.historyMonthLifeMoney,
  queryResourceKeys.historyActivityDetail,
  queryResourceKeys.historyMomentDetail,
  queryResourceKeys.historyPlaceDetail,
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
  queryResourceKeys.analysisGlobalBaseline,
  queryResourceKeys.analysisGlobalTypical,
  queryResourceKeys.analysisGlobalBreakdown,
  queryResourceKeys.analysisGlobalEvolution,
  queryResourceKeys.analysisGlobalContexts,
  queryResourceKeys.analysisGlobalHabits,
  queryResourceKeys.analysisGlobalProfiles,
  queryResourceKeys.analysisGlobalUniverse,
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
    queryResourceKeys.historyMonthCalendar,
    queryResourceKeys.historyWeek,
    queryResourceKeys.historyDayJournal,
    queryResourceKeys.historyMonthOverview,
    queryResourceKeys.historyMonthCategories,
    queryResourceKeys.historyCategoryDetail,
    queryResourceKeys.historyMonthLifeMoney,
    queryResourceKeys.historyActivityDetail,
    queryResourceKeys.historyPlaceDetail,
  ],
  place: [
    queryResourceKeys.entityPlace,
    queryResourceKeys.entityMerchant,
    queryResourceKeys.entityPersona,
    queryResourceKeys.galleryPlaces,
    queryResourceKeys.operationsBrowse,
    queryResourceKeys.historyMonthLifeMoney,
    queryResourceKeys.historyPlaceDetail,
  ],
  life_event: [
    queryResourceKeys.historyMonthCalendar,
    queryResourceKeys.historyWeek,
    queryResourceKeys.historyDayJournal,
    queryResourceKeys.historyMonthOverview,
    queryResourceKeys.historyMonthLifeMoney,
    queryResourceKeys.historyActivityDetail,
    queryResourceKeys.historyMomentDetail,
    queryResourceKeys.entityLifeEvent,
    queryResourceKeys.entityMoment,
    queryResourceKeys.entityOperation,
    queryResourceKeys.galleryMoments,
    queryResourceKeys.operationsBrowse,
  ],
  moment: [
    queryResourceKeys.historyMonthCalendar,
    queryResourceKeys.historyWeek,
    queryResourceKeys.historyDayJournal,
    queryResourceKeys.historyMonthOverview,
    queryResourceKeys.historyMonthLifeMoney,
    queryResourceKeys.historyMomentDetail,
    queryResourceKeys.entityMoment,
    queryResourceKeys.entityLifeEvent,
    queryResourceKeys.entityOperation,
    queryResourceKeys.galleryMoments,
    queryResourceKeys.operationsBrowse,
  ],
  category: [queryResourceKeys.analysisMonthBreakdown, queryResourceKeys.analysisGlobalBreakdown, queryResourceKeys.operationsBrowse, queryResourceKeys.historyMonthCategories, queryResourceKeys.historyCategoryDetail, queryResourceKeys.historyMonthSpendingNature, queryResourceKeys.historySpendingSegmentDetail],
  activity: [queryResourceKeys.entityPersona, queryResourceKeys.galleryMoments, queryResourceKeys.historyMonthLifeMoney, queryResourceKeys.historyActivityDetail],
} as const);

export function queryResourcesInvalidatedByImpact(
  impact: AnalyticsImpact,
): readonly QueryResourceKey[] {
  if (impact.kind === "month") return [...monthResources];
  if (impact.kind === "entity") return [...entityResources[impact.entity.kind]];
  if (impact.kind === "narrative") {
    return [
      queryResourceKeys.historyMonthCalendar,
      queryResourceKeys.historyWeek,
      queryResourceKeys.historyDayJournal,
      queryResourceKeys.historyMonthOverview,
      queryResourceKeys.historyMonthLifeMoney,
      queryResourceKeys.historyMomentDetail,
      queryResourceKeys.historyActivityDetail,
      queryResourceKeys.historyPlaceDetail,
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
