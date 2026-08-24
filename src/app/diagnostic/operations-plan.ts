import type { YearMonth } from "@/core/time";
import { queryResourceKeys, type QueryRequest } from "@/query-api";

export function diagnosticOperationsRequest(
  input: {
    readonly latestBankMonth: YearMonth | null;
    readonly completeClosedFinancePeriodCount: number;
  },
): QueryRequest<"operations_browse"> | null {
  const { latestBankMonth } = input;
  if (latestBankMonth === null) return null;
  const time = { kind: "bank_month" as const, month: latestBankMonth };
  return {
    resource: queryResourceKeys.operationsBrowse,
    scope: {
      kind: "operations",
      subject: { kind: "household" },
      time,
    },
    params: { time, limit: 1 },
  };
}
