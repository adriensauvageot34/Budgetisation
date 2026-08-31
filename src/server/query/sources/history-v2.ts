import "server-only";

import {
  QueryTemporaryUnavailableError,
  type QueryReadModelSources,
} from "@/query-api/server";

type HistoryV2Sources = Pick<
  QueryReadModelSources,
  | "readHistoryMonthCalendar"
  | "readHistoryWeek"
  | "readHistoryDayJournal"
  | "readHistoryMonthOverview"
  | "readHistoryMonthBalanceSummary"
  | "readHistoryBankEconomyBridge"
  | "readHistoryMonthCategories"
  | "readHistoryCategoryDetail"
  | "readHistoryMonthSpendingNature"
  | "readHistorySpendingSegmentDetail"
  | "readHistoryMinimalPreview"
  | "readHistoryMonthLifeMoney"
  | "readHistoryActivityDetail"
  | "readHistoryMomentDetail"
  | "readHistoryPlaceDetail"
>;

function requiresFrozenPublication(): never {
  throw new QueryTemporaryUnavailableError(
    "Les ReadModels History V2 sont implémentés en read-only mais ne peuvent pas être servis avant allocation d'un PublicationMeta FROZEN_MONTH réel.",
  );
}

/**
 * The snapshot lot will replace these gates with frozen-publication readers.
 * A dynamic canonical build must never mint a fake publicationId.
 */
export function createHistoryV2QuerySources(): HistoryV2Sources {
  return {
    readHistoryMonthCalendar: requiresFrozenPublication,
    readHistoryWeek: requiresFrozenPublication,
    readHistoryDayJournal: requiresFrozenPublication,
    readHistoryMonthOverview: requiresFrozenPublication,
    readHistoryMonthBalanceSummary: requiresFrozenPublication,
    readHistoryBankEconomyBridge: requiresFrozenPublication,
    readHistoryMonthCategories: requiresFrozenPublication,
    readHistoryCategoryDetail: requiresFrozenPublication,
    readHistoryMonthSpendingNature: requiresFrozenPublication,
    readHistorySpendingSegmentDetail: requiresFrozenPublication,
    readHistoryMinimalPreview: requiresFrozenPublication,
    readHistoryMonthLifeMoney: requiresFrozenPublication,
    readHistoryActivityDetail: requiresFrozenPublication,
    readHistoryMomentDetail: requiresFrozenPublication,
    readHistoryPlaceDetail: requiresFrozenPublication,
  };
}
