import "server-only";
/** Serializable UI projection of the existing monthly owners; type imports only. */
import type { MonthInputs, MonthEconomicPlan } from "./month-scenario";

export type MonthUpdateData = {
  resources: readonly { key: string; label: string; amount: string; sourceAmount: string | null; provenance: string }[];
  obligations: readonly { key: string; label: string; amount: string | null; conditional: boolean }[];
  inputs: Pick<MonthInputs, "openingBalance" | "resourceOverrides" | "confirmedObligations" | "declinedConditionalObligations" | "excludedFixedObligations" | "fixedAmountOverrides">;
  bank: MonthEconomicPlan["bankCash"] | null;
  funding: MonthEconomicPlan["plannedFunding"] | null;
};
