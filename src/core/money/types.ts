import type { Brand } from "../identity";

export type DecimalString = Brand<string, "DecimalString">;
export type Money = Brand<DecimalString, "Money">;

export type Currency = "EUR";
export const ACCOUNTING_CURRENCY: Currency = "EUR";

export type MetricUnit =
  | "EUR"
  | "EUR/day"
  | "EUR/week"
  | "EUR/month"
  | "EUR/occurrence"
  | "count"
  | "count/month"
  | "ratio";

export type MonetaryMetricUnit = Extract<MetricUnit, `EUR${string}`>;
export type CountMetricUnit = Extract<MetricUnit, `count${string}`>;
