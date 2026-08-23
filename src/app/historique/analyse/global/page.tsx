import { notFound, redirect } from "next/navigation";
import { parsePersonId } from "@/core/identity";
import { parseGlobalWindow, parseYearMonth, yearMonthOf } from "@/core/time";
import { AnalysisGlobalPage } from "@/features/analysis";
import type {
  AnalysisGlobalBreakdownReadModel,
  AnalysisGlobalContextsReadModel,
  AnalysisGlobalEvolutionReadModel,
  AnalysisGlobalInitialReadModel,
  EntityPersonaReadModel,
  GalleryPlacesReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Analyse globale" };
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AnalysisGlobalRoute({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  const latest = context.periods.at(-1);
  if (latest === undefined) notFound();
  const params = await searchParams;
  let window;
  let asOf;
  let personId;
  try {
    window = parseGlobalWindow(one(params.window) ?? "last_12_months");
    asOf = parseYearMonth(one(params.asOf) ?? yearMonthOf(latest.month));
    personId = one(params.personId) ? parsePersonId(one(params.personId)) : undefined;
  } catch {
    notFound();
  }
  if (personId && !context.persons.some((person) => person.personId === personId)) notFound();
  if (one(params.asOf) === undefined) {
    const canonical = new URLSearchParams({ window, asOf });
    if (personId) canonical.set("personId", personId);
    redirect(`/historique/analyse/global?${canonical.toString()}`);
  }
  const subject = personId
    ? { kind: "person" as const, personId }
    : { kind: "household" as const };
  const scope = {
    subject,
    time: { kind: "global" as const, observationWindow: window, asOf },
  };
  const results = await withProductAuthentication(() =>
    executeAuthenticatedQueries([
      { resource: queryResourceKeys.analysisGlobalInitial, scope, params: {} },
      { resource: queryResourceKeys.analysisGlobalEvolution, scope, params: { metricId: "economic_consumption_net_attributable" } },
      { resource: queryResourceKeys.analysisGlobalContexts, scope, params: {} },
      { resource: queryResourceKeys.analysisGlobalBreakdown, scope, params: { dimension: "category", measure: "category_amount", limit: 8 } },
      { resource: queryResourceKeys.entityPersona, scope, params: { target: personId ? { kind: "person", personId } : { kind: "ensemble" } } },
      { resource: queryResourceKeys.galleryPlaces, scope, params: {} },
    ]),
  );

  return (
    <AnalysisGlobalPage
      window={window}
      asOf={asOf}
      {...(personId ? { personId } : {})}
      persons={context.persons.map((person) => ({ id: person.personId, label: person.displayName }))}
      initial={queryResultToState<AnalysisGlobalInitialReadModel>(results[0]!)}
      evolution={queryResultToState<AnalysisGlobalEvolutionReadModel>(results[1]!)}
      contexts={queryResultToState<AnalysisGlobalContextsReadModel>(results[2]!)}
      habits={queryResultToState<AnalysisGlobalBreakdownReadModel>(results[3]!)}
      profiles={queryResultToState<EntityPersonaReadModel>(results[4]!)}
      universe={queryResultToState<GalleryPlacesReadModel>(results[5]!)}
    />
  );
}
