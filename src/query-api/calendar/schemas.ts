import { createRuntimeSchema } from "../../core/validation";
import {
  parseHistoryCalendarMonthReadModel,
  parseHistoryCalendarMonthSummaryReadModel,
} from "./validation";
import { parseHistoryDayDetailReadModel } from "./day-detail-validation";

export const historyCalendarMonthReadModelSchema = createRuntimeSchema(
  parseHistoryCalendarMonthReadModel,
);
export const historyCalendarMonthSummaryReadModelSchema = createRuntimeSchema(
  parseHistoryCalendarMonthSummaryReadModel,
);
export const historyDayDetailReadModelSchema = createRuntimeSchema(
  parseHistoryDayDetailReadModel,
);
