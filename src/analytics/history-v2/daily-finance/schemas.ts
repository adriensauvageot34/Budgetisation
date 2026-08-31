import { createMetricValueSchema, parseProvenance } from "../../../core/history-v2";
import { createRuntimeSchema, hasOwn, parseStrictRecord, requireProperty } from "../../../core/validation";
import { parseMoney } from "../../../core/money";
import { parseLocalDate, parseYearMonth } from "../../../core/time";
import { parseArtifactInputHash } from "../facts-hash";
import type { DailyEconomicLedgerMonthArtifact, EconomicAllocationEntry } from "./types";

const dateValueSchema = createMetricValueSchema(createRuntimeSchema(parseLocalDate));

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} invalide.`);
  return value;
}

function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} doit être un tableau.`);
  return value.map((entry) => text(entry, field));
}

export const economicAllocationEntrySchema = createRuntimeSchema((value: unknown): EconomicAllocationEntry => {
  const record = parseStrictRecord(value, ["componentKey", "amount", "economicMonth", "purchaseEventId", "effectiveEconomicDate", "timingPrecision", "timingAuthority", "sourceRefs", "provenance"], "EconomicAllocationEntry");
  const timingPrecision = requireProperty(record, "timingPrecision", "EconomicAllocationEntry");
  if (timingPrecision !== "DAY" && timingPrecision !== "MONTH" && timingPrecision !== "NONE") throw new TypeError("timingPrecision invalide.");
  const timingAuthority = hasOwn(record, "timingAuthority") ? text(record.timingAuthority, "timingAuthority") as EconomicAllocationEntry["timingAuthority"] : undefined;
  return {
    componentKey: text(requireProperty(record, "componentKey", "EconomicAllocationEntry"), "componentKey"),
    amount: parseMoney(requireProperty(record, "amount", "EconomicAllocationEntry")),
    economicMonth: parseYearMonth(requireProperty(record, "economicMonth", "EconomicAllocationEntry")),
    ...(hasOwn(record, "purchaseEventId") ? { purchaseEventId: text(record.purchaseEventId, "purchaseEventId") } : {}),
    effectiveEconomicDate: dateValueSchema.parse(requireProperty(record, "effectiveEconomicDate", "EconomicAllocationEntry")),
    timingPrecision,
    ...(timingAuthority === undefined ? {} : { timingAuthority }),
    sourceRefs: strings(requireProperty(record, "sourceRefs", "EconomicAllocationEntry"), "sourceRefs"),
    provenance: parseProvenance(requireProperty(record, "provenance", "EconomicAllocationEntry")),
  };
});

export const dailyEconomicLedgerMonthArtifactSchema = createRuntimeSchema((value: unknown): DailyEconomicLedgerMonthArtifact => {
  const record = parseStrictRecord(value, ["artifactFamily", "householdId", "month", "currency", "actualMonthAmount", "days", "allocationEntries", "expenseEvents", "unassignedEconomicAmount", "assignedEconomicAmount", "reconciliationResidual", "timingCoverage", "issues", "dependencyPolicies", "artifactInputHash"], "DailyEconomicLedgerMonthArtifact");
  if (requireProperty(record, "artifactFamily", "DailyEconomicLedgerMonthArtifact") !== "daily_economic_ledger_month") throw new TypeError("artifactFamily journalier invalide.");
  const entries = requireProperty(record, "allocationEntries", "DailyEconomicLedgerMonthArtifact");
  const days = requireProperty(record, "days", "DailyEconomicLedgerMonthArtifact");
  const events = requireProperty(record, "expenseEvents", "DailyEconomicLedgerMonthArtifact");
  if (!Array.isArray(entries) || !Array.isArray(days) || !Array.isArray(events)) throw new TypeError("Collections Daily Ledger invalides.");
  const artifact = value as DailyEconomicLedgerMonthArtifact;
  return {
    ...artifact,
    month: parseYearMonth(requireProperty(record, "month", "DailyEconomicLedgerMonthArtifact")),
    actualMonthAmount: parseMoney(requireProperty(record, "actualMonthAmount", "DailyEconomicLedgerMonthArtifact")),
    assignedEconomicAmount: parseMoney(requireProperty(record, "assignedEconomicAmount", "DailyEconomicLedgerMonthArtifact")),
    reconciliationResidual: parseMoney(requireProperty(record, "reconciliationResidual", "DailyEconomicLedgerMonthArtifact")),
    allocationEntries: entries.map((entry) => economicAllocationEntrySchema.parse(entry)),
    artifactInputHash: parseArtifactInputHash(
      requireProperty(record, "artifactInputHash", "DailyEconomicLedgerMonthArtifact"),
    ),
  };
});
