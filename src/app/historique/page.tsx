import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarRange, ChevronRight, CircleAlert } from "lucide-react";
import { getBudgetRepository } from "@/data";
import type {
  AnalyticalStatus,
  Importance,
  MonthKey,
} from "@/domain/budget";
import {
  categoryBreakdown,
  descriptiveStats,
  monthlySummaries,
} from "@/domain/calculations";
import { HomeDashboard } from "@/features/home/home-dashboard";
import {
  AnalysisDashboard,
  type AnalysisInitialFilters,
} from "@/features/analysis/analysis-dashboard";
import {
  formatCurrency,
  formatMonth,
  formatPercent,
  titleCase,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Historique" };
export const dynamic = "force-dynamic";

type HistoryQuery = {
  month?: string;
  start?: string;
  end?: string;
  category?: string;
  person?: string;
  account?: string;
  importance?: string;
  status?: string;
  scope?: string;
  event?: string;
  eventDetail?: string;
};

const importanceValues: Importance[] = [
  "Indispensable",
  "Contrainte",
  "Ajustable",
  "Optionnelle",
];
const statusValues: AnalyticalStatus[] = [
  "Habituel",
  "Exceptionnel",
  "Hors budget",
  "À ventiler",
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<HistoryQuery>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, categories, accounts] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
    repository.getAccounts(),
  ]);

  if (!months.length) {
    return <p className="card p-6">Aucune opération disponible.</p>;
  }

  const selectedMonth = months.includes(query.month ?? "")
    ? (query.month as MonthKey)
    : months.at(-1)!;
  const requestedStart = months.includes(query.start ?? "")
    ? (query.start as MonthKey)
    : query.month
      ? selectedMonth
      : months[0];
  const requestedEnd = months.includes(query.end ?? "")
    ? (query.end as MonthKey)
    : query.month
      ? selectedMonth
      : months.at(-1)!;
  const startMonth = requestedStart <= requestedEnd ? requestedStart : requestedEnd;
  const endMonth = requestedStart <= requestedEnd ? requestedEnd : requestedStart;
  const scope = ["all", "current", "events"].includes(query.scope ?? "")
    ? (query.scope as "all" | "current" | "events")
    : "all";
  const initialFilters: AnalysisInitialFilters = {
    startMonth,
    endMonth,
    category: query.category,
    person: query.person,
    accountId: query.account,
    importance: importanceValues.includes(query.importance as Importance)
      ? (query.importance as Importance)
      : undefined,
    status: statusValues.includes(query.status as AnalyticalStatus)
      ? (query.status as AnalyticalStatus)
      : undefined,
    scope,
    event: query.event,
    eventDetail: query.eventDetail,
  };

  const summaries = monthlySummaries(operations, months);
  const stats = descriptiveStats(summaries);
  const maximum = Math.max(1, ...summaries.map((summary) => summary.expenses));
  const toQualify = operations.filter(
    (operation) => operation.resourceType === "À qualifier",
  ).length;
  const refundsToLink = operations.filter(
    (operation) =>
      operation.resourceType === "Remboursement" &&
      !operation.reimbursesOperationId,
  ).length;

  const contextSegments: string[] = [];
  if (query.month) contextSegments.push(titleCase(formatMonth(selectedMonth)));
  else if (query.start || query.end) {
    contextSegments.push(
      startMonth === endMonth
        ? titleCase(formatMonth(startMonth))
        : `${titleCase(formatMonth(startMonth))} — ${formatMonth(endMonth)}`,
    );
  }
  if (scope === "current") contextSegments.push("Vie courante");
  if (scope === "events") contextSegments.push("Événements");
  if (query.event) contextSegments.push(query.event);
  if (query.eventDetail) contextSegments.push(query.eventDetail);
  if (query.status) contextSegments.push(query.status);
  if (query.importance) contextSegments.push(query.importance);
  if (query.category) contextSegments.push(query.category);

  return (
    <div>
      <PageHeader
        eyebrow="Comprendre le passé"
        title="Historique"
        description="Découvrez comment le foyer vit financièrement, comparez les mois et expliquez les dépenses jusqu’aux opérations bancaires."
        action={
          <span className="badge">
            <CalendarRange size={14} />
            {titleCase(formatMonth(months[0]))} — {formatMonth(months.at(-1)!)}
          </span>
        }
      />

      {contextSegments.length ? (
        <nav
          className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]"
          aria-label="Fil d’Ariane de l’analyse"
        >
          <Link href="/historique" className="hover:text-[var(--color-ink)]">
            Historique
          </Link>
          {contextSegments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="contents">
              <ChevronRight size={14} />
              <span
                className={
                  index === contextSegments.length - 1
                    ? "font-bold text-[var(--color-ink)]"
                    : ""
                }
              >
                {segment}
              </span>
            </span>
          ))}
        </nav>
      ) : null}

      <HomeDashboard
        months={months}
        operations={operations}
        categories={categories}
        accounts={accounts}
        initialMonth={selectedMonth}
        embedded
      />

      <details className="card mt-5 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <span>
            <span className="eyebrow mb-1 block">Comparer</span>
            <span className="text-xl font-black">Les {months.length} mois disponibles</span>
          </span>
          <span className="text-sm font-bold text-[var(--color-primary)]">
            Ouvrir la comparaison
          </span>
        </summary>

        <div className="grid border-t border-[var(--color-border)] sm:grid-cols-3">
          <div className="bg-[var(--color-primary)] p-5 text-white sm:p-6">
            <p className="text-sm font-bold text-white/70">Moyenne mensuelle</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em]">
              {formatCurrency(stats.average)}
            </p>
          </div>
          <div className="border-b border-[var(--color-border)] p-5 sm:border-b-0 sm:border-r sm:p-6">
            <p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus léger</p>
            <p className="mt-2 text-xl font-black capitalize">{formatMonth(stats.best.month)}</p>
            <p className="mt-1 text-sm positive">{formatCurrency(stats.best.expenses)}</p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus chargé</p>
            <p className="mt-2 text-xl font-black capitalize">{formatMonth(stats.worst.month)}</p>
            <p className="mt-1 text-sm negative">{formatCurrency(stats.worst.expenses)}</p>
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {[...summaries].reverse().map((summary) => {
            const topCategories = categoryBreakdown(
              operations,
              summary.month,
              months,
              categories,
            ).slice(0, 3);
            const monthHref = `/historique?${new URLSearchParams({
              month: summary.month,
              start: summary.month,
              end: summary.month,
            }).toString()}`;
            return (
              <article
                key={summary.month}
                className="group grid gap-4 px-4 py-5 transition hover:bg-[#fafaf7] sm:px-6 lg:grid-cols-[170px_minmax(220px,1fr)_1.3fr_170px] lg:items-center"
              >
                <div>
                  <p className="font-black capitalize">{formatMonth(summary.month)}</p>
                  <p className={`mt-1 text-sm font-bold ${summary.averageDelta > 0 ? "negative" : "positive"}`}>
                    {formatPercent(summary.averageDelta, true)} vs moyenne
                  </p>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Dépenses nettes</span>
                    <span className="font-black">{formatCurrency(summary.expenses)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${Math.max(12, (summary.expenses / maximum) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                    <span>Revenus {formatCurrency(summary.income)}</span>
                    <span>Autres entrées {formatCurrency(summary.otherInflows)}</span>
                    <span className={summary.net >= 0 ? "positive" : "negative"}>
                      Résultat {summary.net >= 0 ? "+" : ""}{formatCurrency(summary.net)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map((category) => (
                    <Link
                      key={category.category}
                      href={`${monthHref}&category=${encodeURIComponent(category.category)}`}
                      className="badge"
                      style={{ background: `${category.color}18`, color: category.color }}
                    >
                      {category.category} · {formatCurrency(category.amount)}
                    </Link>
                  ))}
                </div>
                <Link href={monthHref} className="button-secondary justify-self-start text-sm lg:justify-self-end">
                  Voir le mois <ArrowRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      </details>

      <section className="card mt-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex gap-3">
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
          <div>
            <p className="font-black">Données à compléter</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Ces éléments sont signalés sans inventer le sens des opérations.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge" data-tone={toQualify ? "warning" : "positive"}>
            {toQualify} entrée{toQualify > 1 ? "s" : ""} à qualifier
          </span>
          <span className="badge" data-tone={refundsToLink ? "warning" : "positive"}>
            {refundsToLink} remboursement{refundsToLink > 1 ? "s" : ""} à rattacher
          </span>
        </div>
      </section>

      <AnalysisDashboard
        key={JSON.stringify(initialFilters)}
        months={months}
        operations={operations}
        categories={categories}
        accounts={accounts}
        initialFilters={initialFilters}
        embedded
      />
    </div>
  );
}
