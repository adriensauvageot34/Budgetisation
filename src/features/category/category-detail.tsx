"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Account,
  CategoryDefinition,
  MonthKey,
  Operation,
} from "@/domain/budget";
import {
  categoryTrend,
  mean,
  netExpenseAmount,
  totalExpenses,
} from "@/domain/calculations";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatMonth,
  formatPercent,
  formatShortMonth,
  titleCase,
} from "@/lib/format";

type DetailView = "Sous-catégories" | "Évolution" | "Opérations";

export function CategoryDetail({
  slug,
  month,
  hiddenSlugs,
  months,
  operations,
  categories,
  accounts,
}: {
  slug: string;
  month: MonthKey;
  hiddenSlugs: string[];
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [view, setView] = useState<DetailView>("Sous-catégories");
  const selectedCategories =
    slug === "autres"
      ? categories.filter((category) => hiddenSlugs.includes(category.slug))
      : categories.filter((category) => category.slug === slug);
  const categoryNames = selectedCategories.map((category) => category.name);
  const title =
    slug === "autres"
      ? "Autres catégories"
      : (selectedCategories[0]?.name ?? "Catégorie");

  const selectedOperations = operations.filter(
    (operation) =>
      operation.importMonth === month &&
      categoryNames.includes(operation.category) &&
      operation.flow === "Dépense",
  );
  const total = totalExpenses(selectedOperations, operations);
  const monthTotal = totalExpenses(
    operations.filter((operation) => operation.importMonth === month),
    operations,
  );

  const subcategories = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const operation of selectedOperations) {
      grouped.set(
        operation.subcategory,
        (grouped.get(operation.subcategory) ?? 0) +
          netExpenseAmount(operation, operations),
      );
    }
    return [...grouped.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        share: total ? amount / total : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedOperations, total]);

  const evolution = useMemo(() => {
    if (categoryNames.length === 1) {
      return categoryTrend(operations, months, categoryNames[0]);
    }
    const values = months.map((entry) => ({
      month: entry,
      amount: totalExpenses(
        operations.filter(
          (operation) =>
            operation.importMonth === entry &&
            categoryNames.includes(operation.category),
        ),
      ),
    }));
    const average = mean(values.map((entry) => entry.amount));
    return values.map((entry) => ({ ...entry, average }));
  }, [categoryNames, months, operations]);

  const average = evolution[0]?.average ?? 0;

  return (
    <div>
      <nav
        className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]"
        aria-label="Fil d’Ariane"
      >
        <Link href="/historique" className="hover:text-[var(--color-ink)]">
          Historique
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/historique?month=${month}&start=${month}&end=${month}`}
          className="capitalize hover:text-[var(--color-ink)]"
        >
          {formatMonth(month)}
        </Link>
        <ChevronRight size={14} />
        <span className="font-bold text-[var(--color-ink)]">{title}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/historique?month=${month}&start=${month}&end=${month}`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)]"
          >
            <ArrowLeft size={15} />
            Retour à l’historique
          </Link>
          <h1 className="text-[clamp(1.9rem,3.6vw,3rem)] font-black leading-none tracking-[-0.05em]">
            {title}
          </h1>
          <p className="mt-3 text-[var(--color-muted)]">
            {titleCase(formatMonth(month))} · {formatCurrency(total)} ·{" "}
            {formatPercent(monthTotal ? total / monthTotal : 0)} des dépenses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="field capitalize"
            value={month}
            onChange={(event) =>
              router.replace(
                `/categorie/${slug}?month=${event.target.value}${
                  hiddenSlugs.length
                    ? `&hidden=${hiddenSlugs.join(",")}`
                    : ""
                }`,
              )
            }
            aria-label="Mois du détail"
          >
            {months.map((entry) => (
              <option key={entry} value={entry}>
                {formatMonth(entry)}
              </option>
            ))}
          </select>
          <label className="relative">
            <span className="sr-only">Mode d’affichage</span>
            <select
              className="field appearance-none pr-10 font-extrabold"
              value={view}
              onChange={(event) => setView(event.target.value as DetailView)}
            >
              <option>Sous-catégories</option>
              <option>Évolution</option>
              <option>Opérations</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
          </label>
        </div>
      </div>

      {slug === "autres" ? (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-primary-soft)]/55 p-4">
          <div className="flex gap-3">
            <ListFilter
              size={19}
              className="mt-0.5 shrink-0 text-[var(--color-primary)]"
            />
            <div>
              <p className="font-extrabold">Catégories regroupées</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                {selectedCategories.map((category) => category.name).join(", ")}.
                Ce détail correspond exactement au regroupement « Autres » du
                graphique précédent.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="card p-4 sm:p-6">
        {view === "Sous-catégories" ? (
          <div>
            <div className="mb-6">
              <p className="eyebrow mb-2">Composition du mois</p>
              <h2 className="text-xl font-black tracking-[-0.025em]">
                Les postes qui composent {title.toLowerCase()}
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={subcategories}
                    layout="vertical"
                    margin={{ left: 15, right: 20 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompactCurrency}
                      tick={{ fontSize: 11, fill: "#697673" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={138}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#45534f", fontWeight: 700 }}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Bar
                      dataKey="amount"
                      fill={selectedCategories[0]?.color ?? "#52766f"}
                      radius={[0, 7, 7, 0]}
                      maxBarSize={26}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {subcategories.map((subcategory, index) => (
                  <div
                    key={subcategory.name}
                    className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-soft)] p-3.5"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-black text-[var(--color-muted)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">
                        {subcategory.name}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {formatPercent(subcategory.share)}
                      </span>
                    </span>
                    <span className="font-black">
                      {formatCurrency(subcategory.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {view === "Évolution" ? (
          <div>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-2">
                  {formatMonth(months[0])} — {formatMonth(months.at(-1)!)}
                </p>
                <h2 className="text-xl font-black tracking-[-0.025em]">
                  Évolution mensuelle
                </h2>
              </div>
              <span className="badge">
                Moyenne · {formatCurrency(average)}
              </span>
            </div>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={evolution.map((entry) => ({
                    ...entry,
                    label: formatShortMonth(entry.month),
                  }))}
                  margin={{ top: 15, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#697673", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactCurrency}
                    tick={{ fill: "#697673", fontSize: 11 }}
                    width={55}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "amount" ? "Montant" : "Moyenne",
                    ]}
                  />
                  <Bar
                    dataKey="amount"
                    fill={selectedCategories[0]?.color ?? "#52766f"}
                    radius={[7, 7, 0, 0]}
                    maxBarSize={42}
                  />
                  <Line
                    dataKey="average"
                    type="monotone"
                    stroke="#d56f52"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {view === "Opérations" ? (
          <div>
            <div className="mb-5">
              <p className="eyebrow mb-2">Détail du mois</p>
              <h2 className="text-xl font-black tracking-[-0.025em]">
                {selectedOperations.length} opérations dans cette catégorie
              </h2>
            </div>
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Libellé</th>
                      <th>Personne</th>
                      <th>Compte</th>
                      <th className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedOperations]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((operation) => (
                        <tr key={operation.id}>
                          <td className="whitespace-nowrap">
                            {formatDate(operation.date)}
                          </td>
                          <td>
                            <p className="font-extrabold">{operation.label}</p>
                            <p className="text-xs text-[var(--color-muted)]">
                              {operation.subcategory}
                            </p>
                          </td>
                          <td>{operation.person ?? "Non renseigné"}</td>
                          <td>
                            {accounts.find(
                              (account) => account.id === operation.accountId,
                            )?.name ?? "Non renseigné"}
                          </td>
                          <td className="text-right font-black negative">
                            {formatCurrency(operation.amount, true)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
