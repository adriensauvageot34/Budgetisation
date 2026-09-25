import type { GlobalBackgroundFoodMoney } from "@/query-api/global-v2";
import { formatMoney } from "./annual-month-focus";

export function formatFoodMoney(value: GlobalBackgroundFoodMoney): string {
  return `${value.quality === "LOWER_BOUND" ? "≥ " : ""}${formatMoney(value.amount, true)}`;
}

export function foodMoneyAccessibleLabel(value: GlobalBackgroundFoodMoney): string {
  const amount = formatMoney(value.amount, true).replace(/\s*€/u, "").trim();
  return `${value.quality === "LOWER_BOUND" ? "au moins " : ""}${amount} euros`;
}
