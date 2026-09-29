import Big from "big.js";
import { plannedAsset } from "./planned-assets";

export type QuantityPrice = Readonly<{ quantity: string; unitAmount: string }>;
export const costItemCashTreatment = (item: Readonly<{ assetKey: string | null }>) =>
  plannedAsset(item.assetKey ?? "")?.cashTreatment ?? "PAYABLE";

/** One rounded economic line amount for drafts, persistence, calendar and forecast. */
export const plannedLineGross = (item: QuantityPrice): string =>
  new Big(item.quantity).times(item.unitAmount).round(2).toFixed(2);
