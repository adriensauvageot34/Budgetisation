import { parseHouseholdId } from "../../core/identity";
import { parseYearMonth, type YearMonth } from "../../core/time";
import { createRuntimeSchema, parseStrictRecord, requireProperty } from "../../core/validation";

/** Transport control metadata, not a sixteenth History business resource. */
export type HistoryGenerationSignal = {
  readonly householdId: string;
  readonly month: YearMonth;
  readonly publicationId: string | null;
};

export const historyGenerationSignalSchema = createRuntimeSchema<HistoryGenerationSignal>((value) => {
  const row = parseStrictRecord(value, ["householdId", "month", "publicationId"], "HistoryGenerationSignal");
  const publicationId = requireProperty(row, "publicationId", "HistoryGenerationSignal");
  if (publicationId !== null && (typeof publicationId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(publicationId))) {
    throw new TypeError("Invalid History publication identity.");
  }
  return {
    householdId: parseHouseholdId(requireProperty(row, "householdId", "HistoryGenerationSignal")),
    month: parseYearMonth(requireProperty(row, "month", "HistoryGenerationSignal")),
    publicationId,
  };
});

export function parseHistoryGenerationRequest(value: unknown): YearMonth {
  const row = parseStrictRecord(value, ["month"], "HistoryGenerationRequest");
  return parseYearMonth(requireProperty(row, "month", "HistoryGenerationRequest"));
}
