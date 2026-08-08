import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarRange } from "lucide-react";
import { getBudgetRepository } from "@/data";
import {
  categoryBreakdown,
  descriptiveStats,
  monthlySummaries,
} from "@/domain/calculations";
import {
  formatCurrency,
  formatMonth,
  formatPercent,
  titleCase,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Historique",
};

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const repository = await getBudgetRepository();
  const [months, operations, categories] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
  ]);
  if (!months.length) {
    return <p className="card p-6">Aucune opération disponible.</p>;
  }
  const summaries = monthlySummaries(operations, months);
  const stats = descriptiveStats(summaries);
  const maximum = Math.max(...summaries.map((summary) => summary.expenses));

  return (
    <div>
      <PageHeader
        eyebrow="Mois par mois"
        title="Historique"
        description="Une lecture calme de ce qui s’est passé chaque mois, avec les écarts et les postes qui ont compté."
        action={
          <span className="badge">
            <CalendarRange size={14} />
            {titleCase(formatMonth(months[0]))} — {formatMonth(months.at(-1)!)}
          </span>
        }
      />

      <section className="card mb-5 grid overflow-hidden sm:grid-cols-3">
        <div className="bg-[var(--color-primary)] p-5 text-white sm:p-6">
          <p className="text-sm font-bold text-white/70">Moyenne mensuelle</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em]">
            {formatCurrency(stats.average)}
          </p>
        </div>
        <div className="border-b border-[var(--color-border)] p-5 sm:border-b-0 sm:border-r sm:p-6">
          <p className="text-sm font-bold text-[var(--color-muted)]">
            Mois le plus léger
          </p>
          <p className="mt-2 text-xl font-black capitalize">
            {formatMonth(stats.best.month)}
          </p>
          <p className="mt-1 text-sm positive">
            {formatCurrency(stats.best.expenses)}
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm font-bold text-[var(--color-muted)]">
            Mois le plus chargé
          </p>
          <p className="mt-2 text-xl font-black capitalize">
            {formatMonth(stats.worst.month)}
          </p>
          <p className="mt-1 text-sm negative">
            {formatCurrency(stats.worst.expenses)}
          </p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <h2 className="text-lg font-black">
            {months.length} mois disponibles
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {[...summaries].reverse().map((summary) => {
            const topCategories = categoryBreakdown(
              operations,
              summary.month,
              months,
              categories,
            ).slice(0, 3);
            return (
              <article
                key={summary.month}
                className="group grid gap-4 px-4 py-5 transition hover:bg-[#fafaf7] sm:px-6 lg:grid-cols-[170px_minmax(220px,1fr)_1.3fr_150px] lg:items-center"
              >
                <div>
                  <p className="font-black capitalize">
                    {formatMonth(summary.month)}
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      summary.averageDelta > 0 ? "negative" : "positive"
                    }`}
                  >
                    {formatPercent(summary.averageDelta, true)} vs moyenne
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Dépenses</span>
                    <span className="font-black">
                      {formatCurrency(summary.expenses)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{
                        width: `${Math.max(
                          12,
                          (summary.expenses / maximum) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-[var(--color-muted)]">
                    <span>Revenus {formatCurrency(summary.income)}</span>
                    <span
                      className={summary.net >= 0 ? "positive" : "negative"}
                    >
                      Net {summary.net >= 0 ? "+" : ""}
                      {formatCurrency(summary.net)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {topCategories.map((category) => (
                    <span
                      key={category.category}
                      className="badge"
                      style={{
                        background: `${category.color}18`,
                        color: category.color,
                      }}
                    >
                      {category.category} · {formatCurrency(category.amount)}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/?month=${summary.month}`}
                  className="button-secondary justify-self-start text-sm lg:justify-self-end"
                >
                  Voir le mois
                  <ArrowRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        {titleCase(formatMonth(months[0]))} marque le début de l’historique
        disponible.
      </p>
    </div>
  );
}
