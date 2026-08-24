import { notFound, redirect } from "next/navigation";
import { normalizeAnalysisScope } from "@/core/scope";
import { AnalysisGlobalPage } from "@/features/analysis";
import type { AnalysisGlobalInitialReadModel } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { parseRootNavigation, serializeRootNavigation } from "@/navigation";
import type { HistoryRootContext } from "@/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { isAllowedGlobalAsOf, resolveDefaultGlobalAsOf } from "@/server/bootstrap/global-as-of";
import { executeAuthenticatedQuery } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Analyse globale" };
export const dynamic = "force-dynamic";

export default async function AnalysisGlobalRoute({
  searchParams,
}: {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const rawSearch = await searchParams;
  let route;
  try {
    const query = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(rawSearch)) {
      for (const value of Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue]) query.append(key, value);
    }
    route = parseRootNavigation(`/historique/analyse/global${query.size === 0 ? "" : `?${query.toString()}`}`);
    if (!("area" in route) || route.area !== "analysis" || route.context.kind !== "analysis_global") notFound();
  } catch {
    notFound();
  }

  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  if (route.context.kind !== "analysis_global") notFound();
  const globalContext = route.context;
  const defaultAsOf = resolveDefaultGlobalAsOf(context.periods);
  if (globalContext.asOf !== undefined && !isAllowedGlobalAsOf(context.periods, globalContext.asOf)) notFound();
  const asOf = globalContext.asOf ?? defaultAsOf;
  if (asOf === null) notFound();
  const canonicalRoute: HistoryRootContext = globalContext.asOf === undefined
    ? { ...route, context: { ...globalContext, asOf } }
    : route;
  if (globalContext.asOf === undefined) redirect(serializeRootNavigation(canonicalRoute));
  const selectedPersonId = globalContext.personId;
  if (selectedPersonId && !context.persons.some(({ personId }) => personId === selectedPersonId)) notFound();
  const scope = normalizeAnalysisScope({
    subject: selectedPersonId ? { kind: "person", personId: selectedPersonId } : { kind: "household" },
    time: { kind: "global", observationWindow: globalContext.observationWindow, asOf },
    filters: globalContext.filters,
  });
  const result = await withProductAuthentication(() => executeAuthenticatedQuery({
    resource: queryResourceKeys.analysisGlobalInitial,
    scope,
    params: {},
  }));

  return (
    <AnalysisGlobalPage
      route={canonicalRoute}
      scope={scope}
      persons={context.persons.map(({ personId, displayName }) => ({ id: personId, label: displayName }))}
      initialState={queryResultToState<AnalysisGlobalInitialReadModel>(result)}
    />
  );
}
