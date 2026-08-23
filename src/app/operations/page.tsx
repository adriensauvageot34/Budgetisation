import { notFound } from "next/navigation";
import { parsePersonId } from "@/core/identity";
import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  yearMonthOf,
} from "@/core/time";
import { OperationsPage, type OperationsDisplayMode } from "@/features/operations";
import type {
  OperationsBrowseReadModel,
  OperationsBrowseSortKey,
  OperationsTimeFilter,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { executeAuthenticatedQuery } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Opérations" };
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function OperationsRoute({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const params = await searchParams;
  const availableMonths = context.periods
    .map((period) => yearMonthOf(period.month))
    .reverse();
  const fallbackMonth = availableMonths[0];
  if (fallbackMonth === undefined) notFound();

  let month;
  let subject: "household" | ReturnType<typeof parsePersonId>;
  let mode: OperationsDisplayMode;
  let sortKey: OperationsBrowseSortKey;
  let sortDirection: "asc" | "desc";
  let time: OperationsTimeFilter;
  try {
    const rawTimeKind = one(params.timeKind) ?? (
      one(params.globalWindow) ? "global_window" :
      one(params.startDate) ? "bank_range" :
      "bank_month"
    );
    if (rawTimeKind === "bank_month" || rawTimeKind === "economic_month") {
      month = parseYearMonth(one(params.month) ?? fallbackMonth);
      time = { kind: rawTimeKind, month };
    } else if (rawTimeKind === "bank_range" || rawTimeKind === "economic_range") {
      const start = parseLocalDate(one(params.startDate));
      const endExclusive = parseLocalDate(one(params.endExclusive));
      if (start >= endExclusive) throw new TypeError();
      month = parseYearMonth(start.slice(0, 7));
      time = { kind: rawTimeKind, start, endExclusive };
    } else if (rawTimeKind === "global_window") {
      const asOf = parseYearMonth(one(params.asOf) ?? fallbackMonth);
      time = {
        kind: "global_window",
        window: parseGlobalWindow(one(params.globalWindow) ?? "last_12_months"),
        asOf,
      };
      month = asOf;
    } else {
      throw new TypeError();
    }
    const rawSubject = one(params.personId) ?? "household";
    subject = rawSubject === "household" ? "household" : parsePersonId(rawSubject);
    const rawMode = one(params.mode) ?? "standard";
    if (!(rawMode === "compact" || rawMode === "standard" || rawMode === "complete")) throw new TypeError();
    mode = rawMode;
    const match = /^(bank_date|economic_timing|bank_amount|economic_net)_(asc|desc)$/.exec(
      one(params.sort) ?? "bank_date_desc",
    );
    if (match === null) throw new TypeError();
    sortKey = match[1] as OperationsBrowseSortKey;
    sortDirection = match[2] as "asc" | "desc";
  } catch {
    notFound();
  }
  if (
    subject !== "household" &&
    !context.persons.some((person) => person.personId === subject)
  ) {
    notFound();
  }

  const search = one(params.search)?.trim() ?? "";
  const queryScope = time.kind === "global_window"
    ? {
        subject: subject === "household"
          ? { kind: "household" as const }
          : { kind: "person" as const, personId: subject },
        time: {
          kind: "global" as const,
          observationWindow: time.window,
          asOf: time.asOf,
        },
      }
    : {
        subject: subject === "household"
          ? { kind: "household" as const }
          : { kind: "person" as const, personId: subject },
        time: { kind: "month" as const, month },
      };
  const result = await withProductAuthentication(() =>
    executeAuthenticatedQuery<"operations_browse">({
      resource: queryResourceKeys.operationsBrowse,
      scope: queryScope,
      params: {
        time,
        search,
        sort: { key: sortKey, direction: sortDirection },
        filters: {},
        cursor: one(params.cursor) ?? null,
        limit: 50,
      },
    }),
  );

  return (
    <OperationsPage
      state={queryResultToState<OperationsBrowseReadModel>(result)}
      mode={mode}
      time={time}
      search={search}
      sort={`${sortKey}_${sortDirection}`}
      cursor={one(params.cursor) ?? null}
      subject={subject}
      months={availableMonths}
      persons={context.persons.map((person) => ({
        id: person.personId,
        label: person.displayName,
      }))}
    />
  );
}
