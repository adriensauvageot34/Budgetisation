import { notFound, redirect } from "next/navigation";
import { yearMonthOf } from "@/core/time";
import { OperationsPage } from "@/features/operations";
import {
  parseRootNavigation,
  serializeRootNavigation,
  splitOperationsNavigationState,
  type OperationsNavigationFilters,
} from "@/navigation";
import type {
  OperationsBrowseReadModel,
  OperationsBrowseSortKey,
  OperationsTimeFilter,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  executeAuthenticatedQuery,
  resolveLatestBankOperationMonth,
} from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Opérations" };
export const dynamic = "force-dynamic";

function relativeUrl(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) search.append(key, item);
    else if (value !== undefined) search.set(key, value);
  }
  const query = search.toString();
  return query.length === 0 ? "/operations" : `/operations?${query}`;
}

function timeFrom(filters: OperationsNavigationFilters): OperationsTimeFilter {
  switch (filters.timeKind) {
    case "bank_month":
    case "economic_month":
      if (filters.month === undefined) throw new TypeError("Mois Operations absent.");
      return { kind: filters.timeKind, month: filters.month };
    case "bank_range":
    case "economic_range":
      if (filters.startDate === undefined || filters.endExclusive === undefined) throw new TypeError("Range Operations absent.");
      return { kind: filters.timeKind, start: filters.startDate, endExclusive: filters.endExclusive };
    case "global_window":
      if (filters.globalWindow === undefined || filters.asOf === undefined) throw new TypeError("Global Operations absent.");
      return { kind: filters.timeKind, window: filters.globalWindow, asOf: filters.asOf };
    default:
      throw new TypeError("Période Operations absente.");
  }
}

function sortFrom(value: OperationsNavigationFilters["sort"]): {
  readonly key: OperationsBrowseSortKey;
  readonly direction: "asc" | "desc";
} {
  const match = /^(bank_date|economic_timing|bank_amount|economic_net)_(asc|desc)$/.exec(value ?? "bank_date_desc");
  if (match === null) throw new TypeError("Tri Operations invalide.");
  return { key: match[1] as OperationsBrowseSortKey, direction: match[2] as "asc" | "desc" };
}

export default async function OperationsRoute({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const rawParams = await searchParams;
  let parsedRoot;
  try {
    parsedRoot = parseRootNavigation(relativeUrl(rawParams));
  } catch {
    notFound();
  }
  if (!("kind" in parsedRoot)) notFound();
  let filters = parsedRoot.filters;

  if (filters.timeKind === undefined) {
    const latestMonth = await withProductAuthentication(resolveLatestBankOperationMonth);
    if (latestMonth === null) {
      return (
        <OperationsPage
          initialState={null}
          initialFilters={filters}
          months={[]}
          persons={context.persons.map((person) => ({ id: person.personId, label: person.displayName }))}
          noData
        />
      );
    }
    filters = { ...filters, timeKind: "bank_month", month: latestMonth };
    redirect(serializeRootNavigation({ kind: "operations", filters }));
  }

  const time = timeFrom(filters);
  const { question, display } = splitOperationsNavigationState(filters);
  const subject = question.personId
    ? { kind: "person" as const, personId: question.personId }
    : { kind: "household" as const };
  if (filters.personId && !context.persons.some((person) => person.personId === filters.personId)) notFound();
  const sort = sortFrom(filters.sort);
  const result = await withProductAuthentication(() =>
    executeAuthenticatedQuery<"operations_browse">({
      resource: queryResourceKeys.operationsBrowse,
      scope: { kind: "operations", subject, time },
      params: {
        time,
        search: question.search ?? null,
        sort,
        filters: {
          categoryIds: question.categoryIds,
          subcategoryIds: question.subcategoryIds,
          activityIds: question.activityIds,
          momentIds: question.momentIds,
          lifeEventIds: question.lifeEventIds,
          merchantIds: question.merchantIds,
          placeIds: question.placeIds,
          accountIds: question.accountIds,
          preciseTypes: question.preciseTypes,
          necessity: question.necessity,
          fixedVariable: question.fixedVariable?.map((value) => value === "Fixe" ? "fixed" as const : "variable" as const),
          lifeScope: question.lifeScope,
          dayContext: question.dayContext,
          quality: question.quality,
          amountMin: question.amountMin,
          amountMax: question.amountMax,
        },
        cursor: display.cursor ?? null,
        limit: 50,
      },
    }),
  );
  const latestMonth = time.kind === "bank_month" ? time.month : null;
  const months = [...new Set([
    ...(latestMonth === null ? [] : [latestMonth]),
    ...context.periods.map((period) => yearMonthOf(period.month)),
  ])].sort().reverse();

  return (
    <OperationsPage
      initialState={queryResultToState<OperationsBrowseReadModel>(result)}
      initialFilters={filters}
      months={months}
      persons={context.persons.map((person) => ({ id: person.personId, label: person.displayName }))}
    />
  );
}
