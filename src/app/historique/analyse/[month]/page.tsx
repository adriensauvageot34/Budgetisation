import { notFound } from "next/navigation";
import { normalizeAnalysisScope } from "@/core/scope";
import { AnalysisMonthPage } from "@/features/analysis";
import type { AnalysisMonthInitialReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { parseRootNavigation } from "@/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { executeAuthenticatedQuery } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Analyse du mois" };
export const dynamic = "force-dynamic";

export default async function AnalysisMonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const { month: rawMonth } = await params;
  const rawSearch = await searchParams;
  let route;
  let scope;
  try {
    const query = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(rawSearch)) {
      for (const value of Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue]) {
        query.append(key, value);
      }
    }
    const suffix = query.size === 0 ? "" : `?${query.toString()}`;
    const parsed = parseRootNavigation(`/historique/analyse/${rawMonth}${suffix}`);
    if (!("area" in parsed) || parsed.area !== "analysis" || parsed.context.kind !== "analysis_month") notFound();
    route = parsed;
    scope = normalizeAnalysisScope({
      subject: parsed.context.personId
        ? { kind: "person", personId: parsed.context.personId }
        : { kind: "household" },
      time: { kind: "month", month: parsed.context.month },
      filters: parsed.context.filters,
    });
  } catch {
    notFound();
  }

  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const selectedPersonId = scope.subject.kind === "person" ? scope.subject.personId : undefined;
  if (selectedPersonId && !context.persons.some((person) => person.personId === selectedPersonId)) notFound();
  const result = await withProductAuthentication(() => executeAuthenticatedQuery({
    resource: queryResourceKeys.analysisMonthInitial,
    scope,
    params: {},
  }));

  return (
    <AnalysisMonthPage
      route={route}
      scope={scope}
      persons={context.persons.map((person) => ({ id: person.personId, label: person.displayName }))}
      initialState={queryResultToState<AnalysisMonthInitialReadModel>(result)}
    />
  );
}
