import Big from "big.js";

export type QuantityPrice = Readonly<{ quantity: string; unitAmount: string }>;

/** One rounded economic line amount for drafts, persistence, calendar and forecast. */
export const plannedLineGross = (item: QuantityPrice): string =>
  new Big(item.quantity).times(item.unitAmount).round(2).toFixed(2);
