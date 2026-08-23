import { notFound } from "next/navigation";
import { parsePersonId } from "@/core/identity";
import { parseYearMonth } from "@/core/time";
import { AnalysisMonthPage } from "@/features/analysis";
import type {
  AnalysisMonthBreakdownReadModel,
  AnalysisMonthContextsReadModel,
  AnalysisMonthEvolutionReadModel,
  AnalysisMonthInitialReadModel,
  GalleryMomentsReadModel,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { executeAuthenticatedQueries } from "@/server/query/runtime";
import { queryResultToState, withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Analyse du mois" };
export const dynamic = "force-dynamic";

export default async function AnalysisMonthRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly month: string }>;
  readonly searchParams: Promise<{ readonly personId?: string | string[] }>;
}) {
  const { month: rawMonth } = await params;
  const { personId: rawPersonId } = await searchParams;
  let month;
  let personId;
  try {
    month = parseYearMonth(rawMonth);
    personId = typeof rawPersonId === "string" && rawPersonId.length > 0
      ? parsePersonId(rawPersonId)
      : undefined;
  } catch {
    notFound();
  }

  const context = await withProductAuthentication(() => getBootstrapContext());
  if (context.household === null) notFound();
  if (personId && !context.persons.some((person) => person.personId === personId)) notFound();
  const subject = personId
    ? { kind: "person" as const, personId }
    : { kind: "household" as const };
  const scope = { subject, time: { kind: "month" as const, month } };
  const results = await withProductAuthentication(() =>
    executeAuthenticatedQueries([
      { resource: queryResourceKeys.analysisMonthInitial, scope, params: {} },
      { resource: queryResourceKeys.analysisMonthBreakdown, scope, params: { dimension: "category", measure: "category_amount", limit: 3 } },
      { resource: queryResourceKeys.analysisMonthEvolution, scope, params: { metricId: "economic_consumption_net_attributable" } },
      { resource: queryResourceKeys.analysisMonthContexts, scope, params: {} },
      { resource: queryResourceKeys.galleryMoments, scope, params: {} },
    ]),
  );

  return (
    <AnalysisMonthPage
      month={month}
      {...(personId ? { personId } : {})}
      persons={context.persons.map((person) => ({ id: person.personId, label: person.displayName }))}
      initial={queryResultToState<AnalysisMonthInitialReadModel>(results[0]!)}
      marked={queryResultToState<AnalysisMonthBreakdownReadModel>(results[1]!)}
      evolution={queryResultToState<AnalysisMonthEvolutionReadModel>(results[2]!)}
      contexts={queryResultToState<AnalysisMonthContextsReadModel>(results[3]!)}
      moments={queryResultToState<GalleryMomentsReadModel>(results[4]!)}
      manualSummary={null}
    />
  );
}
