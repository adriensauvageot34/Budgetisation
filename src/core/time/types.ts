import type { Brand } from "../identity";

export type YearMonth = Brand<string, "YearMonth">;
export type LocalDate = Brand<string, "LocalDate">;
export type Instant = Brand<string, "Instant">;
export type HouseholdTimeZone = Brand<string, "HouseholdTimeZone">;

export type GlobalWindow =
  | "last_12_months"
  | "last_6_months"
  | "last_3_months"
  | "last_complete_summer";
