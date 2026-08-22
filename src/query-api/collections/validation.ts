import type { CursorPage } from "./types";
import { parseCursorToken } from "./cursor";
import {
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../core/validation";

export function validateCursorPage<T>(page: CursorPage<T>): CursorPage<T> {
  if (page.pageInfo.returnedCount !== page.items.length) {
    throw new TypeError("CursorPage.returnedCount doit égaler items.length.");
  }
  if (page.pageInfo.hasMore !== (page.pageInfo.nextCursor !== null)) {
    throw new TypeError("CursorPage.hasMore et nextCursor sont incohérents.");
  }
  return page;
}

export function parseCursorPage<T>(
  value: unknown,
  parseItem: (candidate: unknown) => T,
): CursorPage<T> {
  const record = parseStrictRecord(value, ["items", "pageInfo", "state"], "CursorPage");
  const rawItems = requireProperty(record, "items", "CursorPage");
  if (!Array.isArray(rawItems)) throw new TypeError("CursorPage.items doit être un tableau.");
  const pageInfoRecord = parseStrictRecord(
    requireProperty(record, "pageInfo", "CursorPage"),
    ["nextCursor", "hasMore", "returnedCount", "totalCount"],
    "CursorPage.pageInfo",
  );
  const rawNextCursor = requireProperty(pageInfoRecord, "nextCursor", "CursorPage.pageInfo");
  const nextCursor = rawNextCursor === null ? null : parseCursorToken(rawNextCursor);
  const hasMore = requireProperty(pageInfoRecord, "hasMore", "CursorPage.pageInfo");
  const returnedCount = requireProperty(pageInfoRecord, "returnedCount", "CursorPage.pageInfo");
  const totalCount = hasOwn(pageInfoRecord, "totalCount") ? pageInfoRecord.totalCount : undefined;
  if (
    typeof hasMore !== "boolean" ||
    typeof returnedCount !== "number" || !Number.isSafeInteger(returnedCount) || returnedCount < 0 ||
    (totalCount !== undefined &&
      (typeof totalCount !== "number" || !Number.isSafeInteger(totalCount) || totalCount < returnedCount))
  ) {
    throw new TypeError("CursorPage.pageInfo est invalide.");
  }
  const state = requireProperty(record, "state", "CursorPage");
  if (!(state === "nonempty" || state === "empty" || state === "filtered_empty")) {
    throw new TypeError("CursorPage.state est invalide.");
  }
  const page: CursorPage<T> = {
    items: rawItems.map(parseItem),
    pageInfo: {
      nextCursor,
      hasMore,
      returnedCount,
      ...(totalCount === undefined ? {} : { totalCount }),
    },
    state,
  };
  if (page.items.length > 0 && state !== "nonempty") {
    throw new TypeError("Une CursorPage non vide exige state=nonempty.");
  }
  return validateCursorPage(page);
}
