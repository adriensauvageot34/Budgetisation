import { redirect } from "next/navigation";
import { normalizeAnalysisScope } from "@/core/scope";
import { parseLocalDate, yearMonthOf } from "@/core/time";
import { queryResourceKeys } from "@/query-api";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  AmbiguousHouseholdError,
  BootstrapAuthenticationRequiredError,
} from "@/server/bootstrap/errors";
import { resolveDefaultGlobalAsOf } from "@/server/bootstrap/global-as-of";
import {
  executeAuthenticatedQueries,
  executeAuthenticatedQuery,
  readAuthenticatedCanonicalSourceHealth,
  resolveLatestBankOperationMonth,
} from "@/server/query/runtime";
import { safeRuntimeEnvironment } from "@/server/runtime-environment";
import { diagnosticOperationsRequest } from "./operations-plan";

export const metadata = { title: "Diagnostic technique" };
export const dynamic = "force-dynamic";

function resultLabel(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "PASS · résultat Query réel" : `ERREUR · ${result.error?.code ?? "INCONNUE"}`;
}

export default async function DiagnosticPage() {
  const runtimeEnvironment = safeRuntimeEnvironment();
  let context: Awaited<ReturnType<typeof getBootstrapContext>>;
  try {
    context = await getBootstrapContext();
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) redirect("/connexion");
    if (error instanceof AmbiguousHouseholdError) {
      return <section className="card p-8"><span className="eyebrow">Diagnostic V2</span><h1>Contexte Household ambigu</h1><p>{error.message}</p></section>;
    }
    throw error;
  }
  if (context.household === null) redirect("/acces-refuse");
  const latestPeriod = [...context.periods]
    .sort((left, right) => left.month.localeCompare(right.month))
    .at(-1);
  const month = latestPeriod === undefined ? null : yearMonthOf(latestPeriod.month);
  const asOf = resolveDefaultGlobalAsOf(context.periods);
  const completeClosedPeriodCount = context.periods.filter(
    ({ financeStatus, isClosed }) => financeStatus === "complete" && isClosed,
  ).length;
  const monthScope = month === null
    ? null
    : normalizeAnalysisScope({
        subject: { kind: "household" },
        time: { kind: "month", month },
      });
  const globalScope = asOf === null
    ? null
    : normalizeAnalysisScope({
        subject: { kind: "household" },
        time: { kind: "global", observationWindow: "last_12_months", asOf },
      });
  const latestBankMonth = await resolveLatestBankOperationMonth();
  const operationRequest = diagnosticOperationsRequest({
    latestBankMonth,
    completeClosedFinancePeriodCount: completeClosedPeriodCount,
  });
  const operationResult = operationRequest === null
    ? null
    : await executeAuthenticatedQuery<"operations_browse">(operationRequest);
  const firstOperationId = operationResult?.ok
    ? operationResult.response.data.page.items[0]?.operationId
    : undefined;
  const operationEntityScope = latestBankMonth === null
    ? null
    : normalizeAnalysisScope({
        subject: { kind: "household" },
        time: { kind: "month", month: latestBankMonth },
      });
  const plannedQueries = [
    ...(monthScope === null || month === null
      ? []
      : [
          { label: "Calendar", request: { resource: queryResourceKeys.historyCalendarMonth, scope: monthScope, params: {} } },
          { label: "Day", request: { resource: queryResourceKeys.historyDayDetail, scope: monthScope, params: { date: parseLocalDate(`${month}-01`) } } },
          { label: "Analysis Month Initial", request: { resource: queryResourceKeys.analysisMonthInitial, scope: monthScope, params: {} } },
        ]),
    ...(globalScope === null || asOf === null
      ? []
      : [
          { label: "Analysis Global Initial", request: { resource: queryResourceKeys.analysisGlobalInitial, scope: globalScope, params: {} } },
          { label: "Metric Methodology", request: { resource: queryResourceKeys.metricMethodology, scope: globalScope, params: { metricId: "economic_consumption_net_attributable", asOf } } },
        ]),
    ...(operationEntityScope === null || firstOperationId === undefined
      ? []
      : [{ label: "Entity Operation", request: { resource: queryResourceKeys.entityOperation, scope: operationEntityScope, params: { operationId: firstOperationId } } }]),
  ];
  const queryResults = await executeAuthenticatedQueries(
    plannedQueries.map(({ request }) => request),
  );
  const resultByLabel = new Map(
    plannedQueries.map(({ label }, index) => [label, queryResults[index]!] as const),
  );
  const queryHealth = plannedQueries.map(({ label }, index) => ({
    label,
    status: resultLabel(queryResults[index]!),
  }));
  queryHealth.splice(monthScope === null ? 0 : 3, 0, {
    label: "Operations Browse",
    status: operationResult === null
      ? "NON APPLICABLE · aucune opération bancaire disponible"
      : resultLabel(operationResult),
  });
  if (firstOperationId === undefined) {
    queryHealth.push({
      label: "Entity Operation",
      status: operationResult !== null && !operationResult.ok
        ? `NON APPLICABLE · Operations Browse ${operationResult.error.code}`
        : "NON APPLICABLE · aucune opération disponible",
    });
  }
  const sourceHealth = await readAuthenticatedCanonicalSourceHealth();
  const monthInitial = resultByLabel.get("Analysis Month Initial");
  const minimalStatus = monthInitial?.ok
    ? (() => {
        const data = monthInitial.response.data;
        if (!("minimal" in data) || data.minimal === undefined) return "MISSING_SOURCE";
        return data.minimal.envelope.availability === "known" ? "AVAILABLE" : "MISSING_SOURCE";
      })()
    : "UNAVAILABLE";
  return (
    <div className="space-y-6" data-product-surface="diagnostic">
      <header><span className="eyebrow">Route secondaire</span><h1 className="mt-3 text-4xl font-black">Diagnostic technique V2</h1><p className="muted">Auth, RLS et contexte de révision — sans écriture distante.</p></header>
      <section className="card grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="eyebrow">Household</span><p className="text-xl font-black">{context.household.name}</p></div>
        <div><span className="eyebrow">Timezone</span><p className="text-xl font-black">{context.household.timezone}</p></div>
        <div><span className="eyebrow">Persons</span><p className="text-xl font-black">{context.persons.map((person) => person.displayName).join(", ") || "Aucune"}</p></div>
        <div><span className="eyebrow">Analysis periods</span><p className="text-xl font-black">{context.periods.length}</p></div>
        <div><span className="eyebrow">Finance complete + closed</span><p className="text-xl font-black">{completeClosedPeriodCount}</p></div>
        <div><span className="eyebrow">DataRevision</span><p className="text-xl font-black">{context.revision?.dataRevision ?? "—"}</p></div>
        <div><span className="eyebrow">AnalyticsRevision</span><p className="text-xl font-black">{context.revision?.analyticsRevision ?? "—"}</p></div>
        <div><span className="eyebrow">Supabase public ref</span><p className="text-xl font-black">{runtimeEnvironment.publicSupabaseProjectRef ?? "—"}</p></div>
        <div><span className="eyebrow">Supabase server ref</span><p className="text-xl font-black">{runtimeEnvironment.serverSupabaseProjectRef ?? "—"}</p></div>
        <div><span className="eyebrow">Même projet Supabase</span><p className="text-xl font-black">{runtimeEnvironment.sameSupabaseProject ? "YES" : "NO"}</p></div>
        <div><span className="eyebrow">Vercel environment</span><p className="text-xl font-black">{runtimeEnvironment.environment ?? "—"}</p></div>
        <div><span className="eyebrow">Commit SHA</span><p className="text-xl font-black">{runtimeEnvironment.commitSha ?? "—"}</p></div>
      </section>
      <section className="card p-6">
        <span className="eyebrow">Query Runtime réel</span>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queryHealth.map(({ label, status }) => <div key={label}><strong>{label}</strong><p>{status}</p></div>)}
        </div>
      </section>
      <section className="card p-6">
        <span className="eyebrow">Source Health</span>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(sourceHealth).map(([source, status]) => <div key={source}><strong>{source}</strong><p>{status}</p></div>)}
          <div><strong>minimal_neutral_variable</strong><p>{minimalStatus}</p></div>
          <div><strong>minimal_obligations_provisions</strong><p>{minimalStatus}</p></div>
        </div>
      </section>
    </div>
  );
}
