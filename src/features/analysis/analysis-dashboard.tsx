"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
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
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  SlidersHorizontal,
} from "lucide-react";
import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  Importance,
  MonthKey,
  Operation,
  Person,
} from "@/domain/budget";
import {
  descriptiveStats,
  eventNetCost,
  importanceBreakdown,
  isConsumptionExpense,
  monthlySummaries,
  statusBreakdown,
  totalExpenses,
} from "@/domain/calculations";
import { operationAnalysisMonth } from "@/domain/inflow-analysis";
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonth,
  formatPercent,
  formatShortMonth,
  titleCase,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

const importanceColors = ["#52766f", "#d69a3c", "#d36e53", "#806da5"];
const statusColors = ["#52766f", "#d69a3c", "#d36e53", "#989b95"];

type ExpenseScope = "all" | "current" | "events";

export type AnalysisInitialFilters = {
  startMonth?: MonthKey;
  endMonth?: MonthKey;
  category?: string;
  person?: Person;
  accountId?: string;
  importance?: Importance;
  status?: AnalyticalStatus;
  scope?: ExpenseScope;
  event?: string;
  eventDetail?: string;
};

export function AnalysisDashboard({
  months,
  operations,
  categories,
  accounts,
  embedded = false,
  initialFilters,
}: {
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
  embedded?: boolean;
  initialFilters?: AnalysisInitialFilters;
}) {
  const router = useRouter();
  const initialStart = months.includes(initialFilters?.startMonth ?? "")
    ? initialFilters!.startMonth!
    : months[0];
  const initialEnd = months.includes(initialFilters?.endMonth ?? "")
    ? initialFilters!.endMonth!
    : months.at(-1)!;
  const [startMonth, setStartMonth] = useState<MonthKey>(initialStart);
  const [endMonth, setEndMonth] = useState<MonthKey>(initialEnd);
  const [category, setCategory] = useState(initialFilters?.category ?? "Toutes");
  const [person, setPerson] = useState<Person | "Toutes">(
    initialFilters?.person ?? "Toutes",
  );
  const [accountId, setAccountId] = useState(initialFilters?.accountId ?? "Tous");
  const [importanceFilter, setImportanceFilter] = useState<Importance | "Toutes">(
    initialFilters?.importance ?? "Toutes",
  );
  const [status, setStatus] = useState<AnalyticalStatus | "Tous">(
    initialFilters?.status ?? "Tous",
  );
  const [expenseScope, setExpenseScope] = useState<ExpenseScope>(
    initialFilters?.scope ?? "all",
  );
  const [eventFilter, setEventFilter] = useState(initialFilters?.event ?? "Tous");
  const [eventDetailFilter, setEventDetailFilter] = useState(
    initialFilters?.eventDetail ?? "Toutes",
  );
  const people = [
    ...new Set(
      operations
        .map((operation) => operation.person)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const events = [
    ...new Set(
      operations
        .map((operation) => operation.event)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const eventDetails = [
    ...new Set(
      operations
        .filter(
          (operation) =>
            eventFilter === "Tous" ||
            operation.event === eventFilter,
        )
        .map((operation) => operation.eventDetail)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  const selectedMonths = months.filter(
    (month) => month >= startMonth && month <= endMonth,
  );
  const filteredOperations = useMemo(
    () =>
      operations.filter(
        (operation) =>
          selectedMonths.includes(
            isConsumptionExpense(operation)
              ? operation.importMonth
              : operationAnalysisMonth(operation),
          ) &&
          (category === "Toutes" || operation.category === category) &&
          (person === "Toutes" || operation.person === person) &&
          (accountId === "Tous" || operation.accountId === accountId) &&
          (importanceFilter === "Toutes" ||
            operation.importance === importanceFilter) &&
          (status === "Tous" || operation.status === status) &&
          (expenseScope === "all" ||
            (expenseScope === "current" && !operation.event) ||
            (expenseScope === "events" && Boolean(operation.event))) &&
          (eventFilter === "Tous" ||
            operation.event === eventFilter) &&
          (eventDetailFilter === "Toutes" ||
            operation.eventDetail === eventDetailFilter),
      ),
    [
      accountId,
      category,
      eventDetailFilter,
      eventFilter,
      expenseScope,
      importanceFilter,
      operations,
      person,
      selectedMonths,
      status,
    ],
  );
  const summaries = monthlySummaries(
    filteredOperations,
    selectedMonths,
    operations,
  );
  const stats = descriptiveStats(summaries);
  const importance = importanceBreakdown(filteredOperations, operations);
  const statuses = statusBreakdown(filteredOperations, operations);

  const categoryRanking = useMemo(() => {
    return categories
      .filter((definition) => definition.includedInConsumption)
      .map((definition) => ({
        category: definition.name,
        amount: totalExpenses(
          filteredOperations.filter(
            (operation) => operation.category === definition.name,
          ),
          operations,
        ),
        color: definition.color,
      }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [categories, filteredOperations, operations]);

  const total = summaries.reduce((sum, summary) => sum + summary.expenses, 0);
  const usual = statuses.find((entry) => entry.name === "Habituel")?.value ?? 0;
  const selectedEventCost =
    eventFilter === "Tous"
      ? null
      : eventNetCost(
          filteredOperations,
          eventFilter,
          eventDetailFilter === "Toutes" ? null : eventDetailFilter,
          operations,
        );
  const selectedEventMonths = filteredOperations
    .filter(isConsumptionExpense)
    .map((operation) => operation.importMonth)
    .sort();

  function historyHref(patch: Record<string, string | null> = {}) {
    const params = new URLSearchParams({ start: startMonth, end: endMonth });
    if (startMonth === endMonth) params.set("month", startMonth);
    if (category !== "Toutes") params.set("category", category);
    if (person !== "Toutes") params.set("person", person);
    if (accountId !== "Tous") params.set("account", accountId);
    if (importanceFilter !== "Toutes") {
      params.set("importance", importanceFilter);
    }
    if (status !== "Tous") params.set("status", status);
    if (expenseScope !== "all") params.set("scope", expenseScope);
    if (eventFilter !== "Tous") params.set("event", eventFilter);
    if (eventDetailFilter !== "Toutes") {
      params.set("eventDetail", eventDetailFilter);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/historique?${params.toString()}`;
  }

  function replaceHistoryContext(patch: Record<string, string | null>) {
    router.replace(historyHref(patch));
  }

  const returnTo = historyHref();
  const operationsParams = new URLSearchParams({
    start: startMonth,
    end: endMonth,
    returnTo,
  });
  if (startMonth === endMonth) operationsParams.set("month", startMonth);
  if (category !== "Toutes") operationsParams.set("category", category);
  if (person !== "Toutes") operationsParams.set("person", person);
  if (accountId !== "Tous") operationsParams.set("account", accountId);
  if (importanceFilter !== "Toutes") {
    operationsParams.set("importance", importanceFilter);
  }
  if (status !== "Tous") operationsParams.set("status", status);
  if (expenseScope !== "all") operationsParams.set("scope", expenseScope);
  if (eventFilter !== "Tous") operationsParams.set("event", eventFilter);
  if (eventDetailFilter !== "Toutes") {
    operationsParams.set("eventDetail", eventDetailFilter);
  }
  const operationsHref = `/operations?${operationsParams.toString()}`;

  return (
    <div>
      {embedded ? (
        <div className="mb-5 mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-1">Comparer et expliquer</p>
            <h2 className="text-2xl font-black">Analyse de la période</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Affinez le contexte sans perdre les règles de calcul centrales.
            </p>
          </div>
          <span className="badge self-start sm:self-auto">
            <CalendarRange size={14} /> {selectedMonths.length} mois analysés
          </span>
        </div>
      ) : (
      <PageHeader
        eyebrow="Tendances"
        title="Analyse"
        description="Prenez de la hauteur sur plusieurs mois et vérifiez ce qui relève du rythme habituel, d’un événement ou d’un choix ponctuel."
        action={
          <span className="badge">
            <CalendarRange size={14} />
            {selectedMonths.length} mois analysés
          </span>
        }
      />
      )}

      <section className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-black">Périmètre des dépenses</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Vie courante et événements restent distincts du statut analytique.
          </p>
        </div>
        <div className="flex flex-wrap rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-1">
          {([
            ["all", "Toutes les dépenses"],
            ["current", "Vie courante"],
            ["events", "Événements"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-[0.5rem] px-3 py-2 text-xs font-extrabold transition ${
                expenseScope === value
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
              }`}
              onClick={() => {
                setExpenseScope(value);
                replaceHistoryContext({ scope: value === "all" ? null : value });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card mb-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-[var(--color-primary)]" />
          <h2 className="font-black">Filtres de l’analyse</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Du mois
            <select
              className="field mt-1 w-full capitalize text-sm"
              value={startMonth}
              onChange={(event) => {
                const value = event.target.value as MonthKey;
                setStartMonth(value);
                if (value > endMonth) setEndMonth(value);
                replaceHistoryContext({
                  start: value,
                  end: value > endMonth ? value : endMonth,
                  month: value === endMonth ? value : null,
                });
              }}
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Au mois
            <select
              className="field mt-1 w-full capitalize text-sm"
              value={endMonth}
              onChange={(event) => {
                const value = event.target.value as MonthKey;
                setEndMonth(value);
                if (value < startMonth) setStartMonth(value);
                replaceHistoryContext({
                  start: value < startMonth ? value : startMonth,
                  end: value,
                  month: value === startMonth ? value : null,
                });
              }}
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Catégorie
            <select
              className="field mt-1 w-full text-sm"
              value={category}
              onChange={(event) => {
                const value = event.target.value;
                setCategory(value);
                replaceHistoryContext({
                  category: value === "Toutes" ? null : value,
                });
              }}
            >
              <option>Toutes</option>
              {categories
                .filter((entry) => entry.includedInConsumption)
                .map((entry) => (
                  <option key={entry.slug}>{entry.name}</option>
                ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Personne
            <select
              className="field mt-1 w-full text-sm"
              value={person}
              onChange={(event) => {
                const value = event.target.value as Person | "Toutes";
                setPerson(value);
                replaceHistoryContext({ person: value === "Toutes" ? null : value });
              }}
            >
              <option>Toutes</option>
              {people.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Compte
            <select
              className="field mt-1 w-full text-sm"
              value={accountId}
              onChange={(event) => {
                const value = event.target.value;
                setAccountId(value);
                replaceHistoryContext({ account: value === "Tous" ? null : value });
              }}
            >
              <option value="Tous">Tous</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Importance
            <select
              className="field mt-1 w-full text-sm"
              value={importanceFilter}
              onChange={(event) => {
                const value = event.target.value as Importance | "Toutes";
                setImportanceFilter(value);
                replaceHistoryContext({
                  importance: value === "Toutes" ? null : value,
                });
              }}
            >
              <option>Toutes</option>
              <option>Indispensable</option>
              <option>Contrainte</option>
              <option>Ajustable</option>
              <option>Optionnelle</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Statut
            <select
              className="field mt-1 w-full text-sm"
              value={status}
              onChange={(event) => {
                const value = event.target.value as AnalyticalStatus | "Tous";
                setStatus(value);
                replaceHistoryContext({ status: value === "Tous" ? null : value });
              }}
            >
              <option>Tous</option>
              <option>Habituel</option>
              <option>Exceptionnel</option>
              <option>Hors budget</option>
              <option>À ventiler</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Événement
            <select
              className="field mt-1 w-full text-sm"
              value={eventFilter}
              onChange={(event) => {
                setEventFilter(event.target.value);
                setEventDetailFilter("Toutes");
                replaceHistoryContext({
                  event: event.target.value === "Tous" ? null : event.target.value,
                  eventDetail: null,
                });
              }}
            >
              <option>Tous</option>
              {events.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Spécification
            <select
              className="field mt-1 w-full text-sm"
              value={eventDetailFilter}
              onChange={(event) => {
                const value = event.target.value;
                setEventDetailFilter(value);
                replaceHistoryContext({
                  eventDetail: value === "Toutes" ? null : value,
                });
              }}
            >
              <option>Toutes</option>
              {eventDetails.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedEventCost !== null ? (
        <section className="card mb-5 p-4 sm:p-5">
          <p className="text-xs font-bold text-[var(--color-muted)]">
            Coût net de l’événement
          </p>
          <p className="mt-1 text-2xl font-black">
            {eventFilter}
            {eventDetailFilter !== "Toutes" ? ` · ${eventDetailFilter}` : ""}
            {" · "}
            {formatCurrency(selectedEventCost)}
          </p>
          {selectedEventMonths.length ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Période bancaire : {formatMonth(selectedEventMonths[0])} —{" "}
              {formatMonth(selectedEventMonths.at(-1)!)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card mb-5 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-6">
          {[
            ["Moyenne", stats.average],
            ["Médiane", stats.median],
            ["Minimum", stats.minimum],
            ["Maximum", stats.maximum],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`border-b border-r border-[var(--color-border)] p-4 sm:p-5 ${
                index > 1 ? "lg:border-b-0" : ""
              }`}
            >
              <p className="text-xs font-bold text-[var(--color-muted)]">{label}</p>
              <p className="mt-1 text-xl font-black tracking-[-0.03em]">
                {formatCurrency(Number(value))}
              </p>
            </div>
          ))}
          <div className="border-b border-r border-[var(--color-border)] bg-[#edf4f0] p-4 sm:p-5 lg:border-b-0">
            <p className="flex items-center gap-1 text-xs font-bold text-[var(--color-positive)]">
              <ArrowDownRight size={14} />
              Meilleur mois
            </p>
            <p className="mt-1 font-black capitalize">
              {titleCase(formatMonth(stats.best.month))}
            </p>
            <p className="mt-0.5 text-sm">{formatCurrency(stats.best.expenses)}</p>
          </div>
          <div className="bg-[#f8e9e5] p-4 sm:p-5">
            <p className="flex items-center gap-1 text-xs font-bold text-[var(--color-negative)]">
              <ArrowUpRight size={14} />
              Pire mois
            </p>
            <p className="mt-1 font-black capitalize">
              {titleCase(formatMonth(stats.worst.month))}
            </p>
            <p className="mt-0.5 text-sm">{formatCurrency(stats.worst.expenses)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="card p-4 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow mb-2">Évolution globale</p>
            <h2 className="text-xl font-black">
              Dépenses nettes, revenus et autres entrées
            </h2>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summaries.map((summary) => ({
                  ...summary,
                  label: formatShortMonth(summary.month),
                }))}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d56f52" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#d56f52" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#52766f" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#52766f" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="otherInflowsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d69a3c" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#d69a3c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                  width={58}
                  tick={{ fill: "#697673", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === "expenses"
                      ? "Dépenses nettes"
                      : name === "otherInflows"
                        ? "Autres entrées d’argent"
                        : "Revenus",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "expenses"
                      ? "Dépenses nettes"
                      : value === "otherInflows"
                        ? "Autres entrées d’argent"
                        : "Revenus"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#52766f"
                  strokeWidth={2.5}
                  fill="url(#incomeFill)"
                />
                <Area
                  type="monotone"
                  dataKey="otherInflows"
                  stroke="#d69a3c"
                  strokeWidth={2.5}
                  fill="url(#otherInflowsFill)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#d56f52"
                  strokeWidth={2.5}
                  fill="url(#expensesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="mb-3">
            <p className="eyebrow mb-2">Importance</p>
            <h2 className="text-xl font-black">Marge de manœuvre</h2>
          </div>
          <div className="relative h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={importance}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {importance.map((entry, index) => (
                    <Cell key={entry.name} fill={importanceColors[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-[var(--color-muted)]">
                Dépenses
              </span>
              <span className="text-xl font-black">{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {importance.map((entry, index) => (
              <button
                type="button"
                key={entry.name}
                className="rounded-xl bg-[var(--color-surface-soft)] p-3 text-left transition hover:ring-2 hover:ring-[var(--color-primary-soft)]"
                onClick={() => {
                  setImportanceFilter(entry.name as Importance);
                  replaceHistoryContext({ importance: entry.name });
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: importanceColors[index] }}
                  />
                  <span className="text-xs font-bold">{entry.name}</span>
                </div>
                <p className="mt-1 font-black">
                  {formatPercent(total ? entry.value / total : 0)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card p-4 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow mb-2">Classement</p>
            <h2 className="text-xl font-black">Catégories sur la période</h2>
          </div>
          <div className="h-[390px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryRanking}
                layout="vertical"
                margin={{ left: 14, right: 15 }}
                onClick={(event) => {
                  const row = event?.activePayload?.[0]?.payload as
                    | { category?: string }
                    | undefined;
                  if (row?.category) {
                    setCategory(row.category);
                    replaceHistoryContext({ category: row.category });
                  }
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
                  width={140}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#45534f", fontSize: 12, fontWeight: 700 }}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar
                  dataKey="amount"
                  radius={[0, 7, 7, 0]}
                  maxBarSize={24}
                  cursor="pointer"
                >
                  {categoryRanking.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow mb-2">Nature analytique</p>
            <h2 className="text-xl font-black">
              Habituel, exceptionnel et hors budget
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {formatPercent(total ? usual / total : 0)} des dépenses filtrées
              relèvent du rythme habituel.
            </p>
          </div>
          <div className="space-y-4">
            {statuses.map((entry, index) => (
              <button
                type="button"
                key={entry.name}
                className="block w-full rounded-xl p-2 text-left transition hover:bg-[var(--color-surface-soft)]"
                onClick={() => {
                  setStatus(entry.name as AnalyticalStatus);
                  replaceHistoryContext({ status: entry.name });
                }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-extrabold">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: statusColors[index] }}
                    />
                    {entry.name}
                  </span>
                  <span className="text-sm font-black">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(
                        entry.value ? 2 : 0,
                        total ? (entry.value / total) * 100 : 0,
                      )}%`,
                      background: statusColors[index],
                    }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-[var(--color-muted)]">
                  {formatPercent(total ? entry.value / total : 0)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Link
        href={operationsHref}
        className="card group mt-5 flex items-center justify-between p-5 transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]"
      >
        <span>
          <span className="eyebrow mb-1 block">Expliquer</span>
          <span className="block text-lg font-black">Voir les opérations</span>
          <span className="mt-1 block text-sm text-[var(--color-muted)]">
            Ouvrir les lignes correspondant exactement à ce contexte
          </span>
        </span>
        <span className="font-black text-[var(--color-primary)]">→</span>
      </Link>
    </div>
  );
}
