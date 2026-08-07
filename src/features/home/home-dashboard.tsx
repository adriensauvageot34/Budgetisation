"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Eye,
  EyeOff,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Account,
  CategoryBreakdown,
  CategoryDefinition,
  MonthKey,
  Operation,
} from "@/domain/budget";
import {
  categoryBreakdown,
  importanceBreakdown,
  mean,
  monthlySummaries,
  totalExpenses,
  totalIncome,
  netResult,
} from "@/domain/calculations";
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonth,
  formatPercent,
  titleCase,
} from "@/lib/format";
import { MonthTimeline } from "@/components/ui/month-timeline";

const importanceColors = ["#52766f", "#d69a3c", "#d36e53", "#806da5"];

function DeltaBadge({ value }: { value: number }) {
  const favorable = value <= 0;
  const Icon = favorable ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1 font-extrabold">
      <Icon size={15} />
      {formatPercent(Math.abs(value))}
    </span>
  );
}

function CategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-md)]">
      <p className="mb-2 font-extrabold">{label}</p>
      {payload.map((item) => (
        <div
          key={String(item.dataKey)}
          className="flex min-w-44 items-center justify-between gap-5 text-sm"
        >
          <span className="flex items-center gap-2 text-[var(--color-muted)]">
            <span
              className="size-2 rounded-full"
              style={{ background: item.color }}
            />
            {item.dataKey === "amount" ? "Août sélectionné" : "Moyenne"}
          </span>
          <span className="font-bold">{formatCurrency(Number(item.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function HomeDashboard({
  months,
  operations,
  categories,
  accounts: _accounts,
  initialMonth,
}: {
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
  initialMonth: MonthKey;
}) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [grouping, setGrouping] = useState<"Catégories" | "Niveaux d’importance">(
    "Catégories",
  );
  const [sortBy, setSortBy] = useState<"Montant" | "Écart" | "Part">("Montant");
  const [categoryCount, setCategoryCount] = useState(6);
  const [showTable, setShowTable] = useState(false);

  const summaries = useMemo(
    () => monthlySummaries(operations, months),
    [operations, months],
  );
  const selectedIndex = months.indexOf(selectedMonth);
  const selectedOperations = operations.filter(
    (operation) => operation.importMonth === selectedMonth,
  );
  const expenses = totalExpenses(selectedOperations);
  const income = totalIncome(selectedOperations);
  const net = netResult(selectedOperations);
  const average = mean(summaries.map((summary) => summary.expenses));
  const previous = summaries[selectedIndex - 1]?.expenses ?? expenses;
  const averageDelta = average ? (expenses - average) / average : 0;
  const previousDelta = previous ? (expenses - previous) / previous : 0;

  const breakdown = useMemo(() => {
    const rows = categoryBreakdown(
      operations,
      selectedMonth,
      months,
      categories,
    );
    return [...rows].sort((a, b) => {
      if (sortBy === "Écart") return b.delta - a.delta;
      if (sortBy === "Part") return b.share - a.share;
      return b.amount - a.amount;
    });
  }, [categories, months, operations, selectedMonth, sortBy]);

  const visibleCategories = breakdown.slice(0, categoryCount);
  const hiddenCategories = breakdown.slice(categoryCount);
  const groupedCategories: CategoryBreakdown[] = hiddenCategories.length
    ? [
        ...visibleCategories,
        {
          category: "Autres",
          slug: "autres",
          color: "#a1a59e",
          amount: hiddenCategories.reduce((total, item) => total + item.amount, 0),
          average: hiddenCategories.reduce((total, item) => total + item.average, 0),
          share: hiddenCategories.reduce((total, item) => total + item.share, 0),
          delta: 0,
        },
      ]
    : visibleCategories;

  const importance = importanceBreakdown(selectedOperations);

  function categoryHref(row: CategoryBreakdown) {
    const query =
      row.slug === "autres"
        ? `&hidden=${hiddenCategories.map((item) => item.slug).join(",")}`
        : "";
    return `/categorie/${row.slug}?month=${selectedMonth}${query}`;
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Bilan mensuel</p>
          <h1 className="text-[clamp(1.9rem,3.6vw,3rem)] font-black leading-none tracking-[-0.05em]">
            Bonjour Adrien et Manon
          </h1>
          <p className="mt-3 text-[var(--color-muted)]">
            Voici ce qui a marqué {formatMonth(selectedMonth)}.
          </p>
        </div>
        <span className="badge self-start sm:self-auto">
          <span className="size-2 rounded-full bg-[var(--color-positive)]" />
          Dernier import disponible
        </span>
      </header>

      <MonthTimeline
        months={months}
        selected={selectedMonth}
        onChange={setSelectedMonth}
      />

      <section className="card mt-5 overflow-hidden">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="bg-[var(--color-primary)] p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white/70">Dépenses du mois</p>
                <p className="mt-2 text-[clamp(2.7rem,7vw,4.8rem)] font-black leading-none tracking-[-0.06em]">
                  {formatCurrency(expenses)}
                </p>
              </div>
              <span className="rounded-xl bg-white/12 p-3">
                <WalletCards size={23} />
              </span>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/20 pt-5 text-sm">
              <p>
                <span className="block text-white/65">vs moyenne</span>
                <DeltaBadge value={averageDelta} />
              </p>
              <p>
                <span className="block text-white/65">vs mois précédent</span>
                <DeltaBadge value={previousDelta} />
              </p>
              <p>
                <span className="block text-white/65">référence mensuelle</span>
                <span className="font-extrabold">{formatCurrency(average)}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)] lg:divide-y-0">
            <div className="p-5 sm:p-6">
              <p className="text-sm font-bold text-[var(--color-muted)]">Revenus</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {formatCurrency(income)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Flux de revenus uniquement
              </p>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-sm font-bold text-[var(--color-muted)]">Résultat net</p>
              <p
                className={`mt-2 text-2xl font-black tracking-[-0.03em] ${
                  net >= 0 ? "positive" : "negative"
                }`}
              >
                {net >= 0 ? "+" : ""}
                {formatCurrency(net)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Remboursements inclus
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow mb-1">Lecture principale</p>
            <h2 className="text-xl font-black tracking-[-0.025em]">
              Où est parti l’argent ?
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Regroupement du graphique</span>
              <select
                className="field appearance-none pr-9 text-sm font-bold"
                value={grouping}
                onChange={(event) =>
                  setGrouping(
                    event.target.value as "Catégories" | "Niveaux d’importance",
                  )
                }
              >
                <option>Catégories</option>
                <option>Niveaux d’importance</option>
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              />
            </label>
            <button
              type="button"
              className="button-secondary text-sm"
              onClick={() => setShowTable((value) => !value)}
            >
              {showTable ? <EyeOff size={16} /> : <Eye size={16} />}
              {showTable ? "Masquer le tableau" : "Afficher le tableau"}
            </button>
          </div>
        </div>

        {grouping === "Catégories" ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-muted)]">
                Classer par
                <select
                  className="field min-h-10 py-2 text-sm"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as "Montant" | "Écart" | "Part")
                  }
                >
                  <option>Montant</option>
                  <option>Écart</option>
                  <option>Part</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-muted)]">
                Afficher
                <select
                  className="field min-h-10 py-2 text-sm"
                  value={categoryCount}
                  onChange={(event) => setCategoryCount(Number(event.target.value))}
                >
                  <option value={4}>4 catégories</option>
                  <option value={6}>6 catégories</option>
                  <option value={8}>8 catégories</option>
                  <option value={10}>10 catégories</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
              <div className="h-[370px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groupedCategories}
                    layout="vertical"
                    margin={{ top: 5, right: 18, left: 8, bottom: 0 }}
                    onClick={(event) => {
                      const row = event?.activePayload?.[0]?.payload as
                        | CategoryBreakdown
                        | undefined;
                      if (row) router.push(categoryHref(row));
                    }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompactCurrency}
                      tick={{ fill: "#697673", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={128}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#45534f", fontSize: 12, fontWeight: 700 }}
                    />
                    <Tooltip content={<CategoryTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={32}
                      formatter={(value) =>
                        value === "amount" ? "Mois sélectionné" : "Moyenne"
                      }
                    />
                    <Bar
                      dataKey="amount"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={18}
                      cursor="pointer"
                    >
                      {groupedCategories.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="average"
                      fill="#d7d9d3"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={10}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1">
                {groupedCategories.map((row) => (
                  <Link
                    href={categoryHref(row)}
                    key={row.category}
                    className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--color-surface-soft)]"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">
                        {row.category}
                      </span>
                      <span className="block text-xs text-[var(--color-muted)]">
                        {formatPercent(row.share)} des dépenses
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-black">
                        {formatCurrency(row.amount)}
                      </span>
                      <span
                        className={`block text-xs font-bold ${
                          row.delta > 0 ? "negative" : "positive"
                        }`}
                      >
                        {formatPercent(row.delta, true)}
                      </span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="text-[var(--color-faint)] transition group-hover:translate-x-0.5"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={importance}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="83%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {importance.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={importanceColors[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {importance.map((entry, index) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-soft)] px-4 py-3.5"
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ background: importanceColors[index] }}
                  />
                  <span className="flex-1 font-extrabold">{entry.name}</span>
                  <span className="text-right">
                    <span className="block font-black">
                      {formatCurrency(entry.value)}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {formatPercent(expenses ? entry.value / expenses : 0)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showTable ? (
          <div className="table-shell mt-6">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Regroupement</th>
                    <th>Montant</th>
                    <th>Part</th>
                    <th>Moyenne</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {(grouping === "Catégories"
                    ? groupedCategories
                    : importance.map((item, index) => ({
                        category: item.name,
                        amount: item.value,
                        share: expenses ? item.value / expenses : 0,
                        average: 0,
                        delta: 0,
                        slug: "",
                        color: importanceColors[index],
                      }))
                  ).map((row) => (
                    <tr key={row.category}>
                      <td className="font-extrabold">{row.category}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>{formatPercent(row.share)}</td>
                      <td>
                        {"average" in row && row.average
                          ? formatCurrency(row.average)
                          : "—"}
                      </td>
                      <td>
                        {"delta" in row && row.average
                          ? formatPercent(row.delta, true)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="eyebrow mb-2">À retenir</p>
          <h2 className="text-xl font-black tracking-[-0.02em]">
            {averageDelta > 0
              ? "Un mois plus chargé que votre rythme habituel"
              : "Un mois maîtrisé par rapport à votre moyenne"}
          </h2>
          <p className="mt-2 max-w-2xl leading-6 text-[var(--color-muted)]">
            {titleCase(formatMonth(selectedMonth))} se situe à{" "}
            {formatPercent(Math.abs(averageDelta))}{" "}
            {averageDelta > 0 ? "au-dessus" : "en dessous"} de la moyenne.
            Ouvrez une catégorie pour voir ses sous-catégories, son évolution et
            les opérations correspondantes.
          </p>
        </div>
        <Link
          href={`/operations?month=${selectedMonth}`}
          className="card group flex items-center justify-between p-5 transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]"
        >
          <span>
            <span className="eyebrow mb-2 block">Explorer</span>
            <span className="block text-lg font-black">Voir les opérations</span>
            <span className="mt-1 block text-sm text-[var(--color-muted)]">
              {selectedOperations.length} lignes ce mois-ci
            </span>
          </span>
          <ArrowRight className="transition group-hover:translate-x-1" />
        </Link>
      </section>
    </div>
  );
}
