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
  ArrowRight,
  ChevronRight,
  CircleAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  updateOperation,
  type OperationUpdateInput,
} from "@/app/operations/actions";
import { PageHeader } from "@/components/ui/page-header";
import { MonthTimeline } from "@/components/ui/month-timeline";
import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  Importance,
  MonthKey,
  Operation,
  Recurrence,
  ResourceType,
} from "@/domain/budget";
import {
  descriptiveStats,
  importanceBreakdown,
  isConsumptionExpense,
  mean,
  monthlySummaries,
  statusBreakdown,
  totalExpenses,
} from "@/domain/calculations";
import {
  averageMonthlyByDimension,
  categoryReferenceDeltas,
  dimensionBreakdown,
  eventGroups,
  monthlySpendingContexts,
  spendingContextBreakdown,
  type HistoryDimension,
} from "@/domain/history-analysis";
import { operationAnalysisMonth } from "@/domain/inflow-analysis";
import { getSpendingContext } from "@/domain/spending-context";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatMonth,
  formatPercent,
  formatShortMonth,
  titleCase,
} from "@/lib/format";

type HistoryView = "period" | "month";
type ContextFilter = "all" | "current" | "events" | "unconfirmed";

export type HistoryInitialContext = {
  detail?: boolean;
  view?: HistoryView;
  month?: MonthKey;
  start?: MonthKey;
  end?: MonthKey;
  person?: string;
  account?: string;
  category?: string;
  subcategory?: string;
  importance?: Importance;
  recurrence?: Recurrence;
  status?: AnalyticalStatus;
  context?: ContextFilter;
  event?: string;
  eventDetail?: string;
};

const importanceColors = ["#52766f", "#d69a3c", "#d36e53", "#806da5"];
const statusColors = ["#52766f", "#d69a3c", "#d36e53", "#989b95"];
const contextColors = {
  current: "#52766f",
  events: "#d69a3c",
  unconfirmed: "#d36e53",
};

const detailKeys = [
  "category",
  "subcategory",
  "importance",
  "recurrence",
  "status",
  "context",
  "event",
  "eventDetail",
] as const;

function detailLabel(context: HistoryInitialContext) {
  return (
    context.eventDetail ??
    context.event ??
    context.subcategory ??
    context.category ??
    context.importance ??
    context.recurrence ??
    context.status ??
    (context.context === "current"
      ? "Vie courante"
      : context.context === "events"
        ? "Événements"
        : context.context === "unconfirmed"
          ? "À confirmer"
          : "Analyse détaillée")
  );
}

function operationUpdateInput(
  operation: Operation,
  changes: Partial<OperationUpdateInput>,
): OperationUpdateInput {
  return {
    date: operation.date,
    amount: operation.amount,
    normalizedMerchant:
      operation.normalizedMerchant === "Non renseigné"
        ? null
        : operation.normalizedMerchant,
    flow: operation.flow,
    category:
      operation.category === "Non renseigné" ? null : operation.category,
    subcategory:
      operation.subcategory === "Non renseigné" ? null : operation.subcategory,
    preciseType: operation.preciseType,
    recurrence: operation.recurrence,
    importance: operation.importance,
    status: operation.status,
    note: operation.note,
    event: operation.event,
    eventDetail: operation.eventDetail ?? null,
    spendingContext: operation.spendingContext ?? null,
    lifeContext: operation.lifeContext ?? null,
    momentId: operation.momentId ?? null,
    resourceType: operation.resourceType ?? null,
    resourceContext: operation.resourceContext ?? null,
    analysisMonthOverride: operation.analysisMonthOverride ?? null,
    reimbursesOperationId: operation.reimbursesOperationId ?? null,
    uncertain: operation.uncertain,
    ...changes,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-md)]">
      {label ? <p className="mb-2 font-black">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="flex min-w-44 justify-between gap-5 text-sm">
          <span className="text-[var(--color-muted)]">{entry.name}</span>
          <span className="font-bold">{formatCurrency(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function HistoryDashboard({
  months,
  operations,
  categories,
  accounts,
  initialContext,
}: {
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
  initialContext: HistoryInitialContext;
}) {
  const router = useRouter();
  const view = initialContext.view ?? "period";
  const selectedMonth = months.includes(initialContext.month ?? "")
    ? initialContext.month!
    : months.at(-1)!;
  const [startMonth, setStartMonth] = useState(
    months.includes(initialContext.start ?? "")
      ? initialContext.start!
      : months[0],
  );
  const [endMonth, setEndMonth] = useState(
    months.includes(initialContext.end ?? "")
      ? initialContext.end!
      : months.at(-1)!,
  );
  const [person, setPerson] = useState(initialContext.person ?? "Toutes");
  const [account, setAccount] = useState(initialContext.account ?? "Tous");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [distributionDimension, setDistributionDimension] =
    useState<HistoryDimension>("category");
  const [averageDimension, setAverageDimension] =
    useState<HistoryDimension>("category");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reimbursementQuery, setReimbursementQuery] = useState("");
  const [eventDrafts, setEventDrafts] = useState<
    Record<string, { event: string; detail: string }>
  >({});

  const periodStart = startMonth <= endMonth ? startMonth : endMonth;
  const periodEnd = startMonth <= endMonth ? endMonth : startMonth;
  const periodMonths =
    view === "month"
      ? [selectedMonth]
      : months.filter((month) => month >= periodStart && month <= periodEnd);
  const detailActive = Boolean(initialContext.detail);
  const people = [
    ...new Set(
      operations
        .map((operation) => operation.person)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const knownEvents = [
    ...new Set(
      operations
        .map((operation) => operation.event)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const knownEventDetails = [
    ...new Set(
      operations
        .filter(
          (operation) =>
            !initialContext.event || operation.event === initialContext.event,
        )
        .map((operation) => operation.eventDetail)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  function contextHref(patch: Record<string, string | null> = {}) {
    const params = new URLSearchParams({ view });
    if (view === "month") params.set("month", selectedMonth);
    else {
      params.set("start", periodStart);
      params.set("end", periodEnd);
    }
    if (person !== "Toutes") params.set("person", person);
    if (account !== "Tous") params.set("account", account);
    if (initialContext.detail) params.set("detail", "1");
    for (const key of detailKeys) {
      const value = initialContext[key];
      if (value && value !== "all") params.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/historique?${params.toString()}`;
  }

  function replaceContext(patch: Record<string, string | null>) {
    router.replace(contextHref(patch));
  }

  function clearDetailHref(nextView: HistoryView) {
    const patch: Record<string, string | null> = { view: nextView };
    patch.detail = null;
    detailKeys.forEach((key) => (patch[key] = null));
    if (nextView === "period") patch.month = null;
    else patch.month = selectedMonth;
    return contextHref(patch);
  }

  const contextualOperations = useMemo(
    () =>
      operations.filter((operation) => {
        if (person !== "Toutes" && operation.person !== person) return false;
        if (account !== "Tous" && operation.accountId !== account) return false;
        if (
          initialContext.category &&
          operation.category !== initialContext.category
        ) return false;
        if (
          initialContext.subcategory &&
          operation.subcategory !== initialContext.subcategory
        ) return false;
        if (
          initialContext.importance &&
          operation.importance !== initialContext.importance
        ) return false;
        if (
          initialContext.recurrence &&
          operation.recurrence !== initialContext.recurrence
        ) return false;
        if (initialContext.status && operation.status !== initialContext.status) {
          return false;
        }
        if (initialContext.event && operation.event !== initialContext.event) {
          return false;
        }
        if (
          initialContext.eventDetail &&
          operation.eventDetail !== initialContext.eventDetail
        ) return false;
        const spendingContext = getSpendingContext(operation);
        if (
          initialContext.context === "current" &&
          spendingContext !== "Vie courante"
        ) return false;
        if (
          initialContext.context === "events" &&
          spendingContext !== "Événement"
        ) return false;
        if (
          initialContext.context === "unconfirmed" &&
          spendingContext !== "À confirmer"
        ) return false;
        return true;
      }),
    [account, initialContext, operations, person],
  );
  const filteredOperations = useMemo(
    () =>
      contextualOperations.filter((operation) => {
        const operationMonth = isConsumptionExpense(operation)
          ? operation.importMonth
          : operationAnalysisMonth(operation);
        return periodMonths.includes(operationMonth);
      }),
    [contextualOperations, periodMonths],
  );

  const summaries = monthlySummaries(
    filteredOperations,
    periodMonths,
    operations,
  );
  const stats = descriptiveStats(summaries);
  const contextByMonth = monthlySpendingContexts(
    filteredOperations,
    periodMonths,
    operations,
  );
  const unconfirmedCount = filteredOperations.filter(
    (operation) => getSpendingContext(operation) === "À confirmer",
  ).length;
  const currentAverage = mean(contextByMonth.map((entry) => entry.current));
  const eventsForPeriod = eventGroups(filteredOperations, operations);
  const exceptionalOperations = filteredOperations.filter(
    (operation) => operation.status === "Exceptionnel",
  );
  const exceptionalTotal = totalExpenses(exceptionalOperations, operations);

  const breadcrumbs = detailActive
    ? [
        view === "month"
          ? titleCase(formatMonth(selectedMonth))
          : "Toute la période",
        ...(initialContext.event ? ["Événements"] : []),
        detailLabel(initialContext),
      ]
    : [];

  const operationsParams = new URLSearchParams({
    returnTo: contextHref(),
  });
  if (view === "month") operationsParams.set("month", selectedMonth);
  else {
    operationsParams.set("start", periodStart);
    operationsParams.set("end", periodEnd);
  }
  if (person !== "Toutes") operationsParams.set("person", person);
  if (account !== "Tous") operationsParams.set("account", account);
  for (const key of detailKeys) {
    const value = initialContext[key];
    if (value && value !== "all") operationsParams.set(key, value);
  }
  const operationsHref = `/operations?${operationsParams.toString()}`;

  const incompleteRows = operations
    .filter((operation) => operation.importMonth === selectedMonth)
    .map((operation) => {
      const reasons: string[] = [];
      if (operation.resourceType === "À qualifier") {
        reasons.push("Entrée d’argent à qualifier");
      }
      if (
        operation.resourceType === "Remboursement" &&
        !operation.reimbursesOperationId
      ) {
        reasons.push("Remboursement à rattacher");
      }
      if (getSpendingContext(operation) === "À confirmer") {
        reasons.push("Contexte de dépense à confirmer");
      }
      return { operation, reasons };
    })
    .filter((entry) => entry.reasons.length);
  const normalizedReimbursementQuery = reimbursementQuery
    .trim()
    .toLocaleLowerCase("fr-FR");
  const reimbursementCandidates = operations
    .filter(isConsumptionExpense)
    .filter((operation) =>
      !normalizedReimbursementQuery ||
      [operation.label, operation.sourceLabel, operation.category]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(normalizedReimbursementQuery),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  async function saveOperation(
    operation: Operation,
    changes: Partial<OperationUpdateInput>,
  ) {
    setSavingId(operation.id);
    setSaveError(null);
    try {
      await updateOperation(
        operation.id,
        operationUpdateInput(operation, changes),
      );
      router.refresh();
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "La modification a échoué.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const filterPanel = (
    <section className="card mb-5 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view === "period" ? (
          <>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Du mois
              <select
                className="field mt-1 w-full capitalize text-sm"
                value={startMonth}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartMonth(value);
                  replaceContext({ start: value });
                }}
              >
                {months.map((month) => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Au mois
              <select
                className="field mt-1 w-full capitalize text-sm"
                value={endMonth}
                onChange={(event) => {
                  const value = event.target.value;
                  setEndMonth(value);
                  replaceContext({ end: value });
                }}
              >
                {months.map((month) => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label className="text-xs font-bold text-[var(--color-muted)]">
          Personne
          <select
            className="field mt-1 w-full text-sm"
            value={person}
            onChange={(event) => {
              const value = event.target.value;
              setPerson(value);
              replaceContext({ person: value === "Toutes" ? null : value });
            }}
          >
            <option>Toutes</option>
            {people.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[var(--color-muted)]">
          Compte
          <select
            className="field mt-1 w-full text-sm"
            value={account}
            onChange={(event) => {
              const value = event.target.value;
              setAccount(value);
              replaceContext({ account: value === "Tous" ? null : value });
            }}
          >
            <option value="Tous">Tous</option>
            {accounts.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="button-ghost mt-3 text-sm"
        onClick={() => setAdvancedOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} /> Filtres avancés
      </button>
      {advancedOpen ? (
        <div className="mt-3 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Catégorie
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.category ?? "Toutes"}
              onChange={(event) => replaceContext({
                category: event.target.value === "Toutes" ? null : event.target.value,
              })}
            >
              <option>Toutes</option>
              {categories.map((entry) => <option key={entry.slug}>{entry.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Importance
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.importance ?? "Toutes"}
              onChange={(event) => replaceContext({
                importance: event.target.value === "Toutes" ? null : event.target.value,
              })}
            >
              <option>Toutes</option>
              <option>Indispensable</option><option>Contrainte</option>
              <option>Ajustable</option><option>Optionnelle</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Statut
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.status ?? "Tous"}
              onChange={(event) => replaceContext({
                status: event.target.value === "Tous" ? null : event.target.value,
              })}
            >
              <option>Tous</option><option>Habituel</option>
              <option>Exceptionnel</option><option>Hors budget</option>
              <option>À ventiler</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Contexte
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.context ?? "all"}
              onChange={(event) => replaceContext({
                context: event.target.value === "all" ? null : event.target.value,
              })}
            >
              <option value="all">Tous</option>
              <option value="current">Vie courante</option>
              <option value="events">Événements</option>
              <option value="unconfirmed">À confirmer</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Événement
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.event ?? "Tous"}
              onChange={(event) => replaceContext({
                event: event.target.value === "Tous" ? null : event.target.value,
                eventDetail: null,
              })}
            >
              <option>Tous</option>
              {knownEvents.map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Spécification
            <select
              className="field mt-1 w-full text-sm"
              value={initialContext.eventDetail ?? "Toutes"}
              onChange={(event) => replaceContext({
                eventDetail: event.target.value === "Toutes" ? null : event.target.value,
              })}
            >
              <option>Toutes</option>
              {knownEventDetails.map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Comprendre le passé"
        title="Historique"
        description="Comprenez le coût de votre vie courante, les événements et ce qui fait varier les mois."
        action={
          <div className="flex max-w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-1">
            <Link
              href={clearDetailHref("period")}
              className={`rounded-[0.5rem] px-3 py-2 text-xs font-extrabold sm:text-sm ${
                view === "period" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"
              }`}
            >
              Toute la période
            </Link>
            <Link
              href={clearDetailHref("month")}
              className={`rounded-[0.5rem] px-3 py-2 text-xs font-extrabold sm:text-sm ${
                view === "month" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"
              }`}
            >
              Par mois
            </Link>
          </div>
        }
      />

      {breadcrumbs.length ? (
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]" aria-label="Fil d’Ariane">
          <Link href={clearDetailHref(view)} className="hover:text-[var(--color-ink)]">Historique</Link>
          {breadcrumbs.map((entry, index) => (
            <span key={`${entry}-${index}`} className="contents">
              <ChevronRight size={14} />
              <span className={index === breadcrumbs.length - 1 ? "font-bold text-[var(--color-ink)]" : ""}>{entry}</span>
            </span>
          ))}
        </nav>
      ) : null}

      {view === "month" ? (
        <MonthTimeline
          months={months}
          selected={selectedMonth}
          onChange={(month) => router.replace(contextHref({ month }))}
        />
      ) : null}

      <div className={view === "month" ? "mt-5" : ""}>{filterPanel}</div>

      {detailActive ? (
        <DetailView
          title={detailLabel(initialContext)}
          view={view}
          months={periodMonths}
          operations={filteredOperations}
          referenceMonths={view === "month" ? months : periodMonths}
          referenceOperations={contextualOperations}
          allOperations={operations}
          contextHref={contextHref}
          operationsHref={operationsHref}
        />
      ) : view === "period" ? (
        <>
          <section className="card mb-5 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-[var(--color-primary)] p-5 text-white sm:p-6">
              <p className="text-sm font-bold text-white/70">Dépenses moyennes</p>
              <p className="mt-2 text-3xl font-black">{formatCurrency(stats.average)}/mois</p>
              <p className="mt-2 text-xs text-white/70">Médiane : {formatCurrency(stats.median)}</p>
            </div>
            <div className="border-b border-[var(--color-border)] p-5 sm:border-r sm:p-6 xl:border-b-0">
              <p className="text-sm font-bold text-[var(--color-muted)]">
                {unconfirmedCount ? "Vie courante identifiée" : "Vie courante moyenne"}
              </p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(currentAverage)}/mois</p>
              {unconfirmedCount ? <p className="mt-2 text-xs text-[var(--color-warning)]">{unconfirmedCount} opération{unconfirmedCount > 1 ? "s" : ""} à confirmer</p> : null}
            </div>
            <div className="border-b border-[var(--color-border)] p-5 sm:p-6 xl:border-b-0 xl:border-r">
              <p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus léger</p>
              <p className="mt-2 text-xl font-black capitalize">{formatMonth(stats.best.month)}</p>
              <p className="mt-1 positive">{formatCurrency(stats.best.expenses)}</p>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus chargé</p>
              <p className="mt-2 text-xl font-black capitalize">{formatMonth(stats.worst.month)}</p>
              <p className="mt-1 negative">{formatCurrency(stats.worst.expenses)}</p>
            </div>
          </section>

          <section className="card mb-5 p-4 sm:p-6">
            <p className="eyebrow mb-2">Évolution globale</p>
            <h2 className="text-xl font-black">Dépenses nettes, revenus et autres entrées</h2>
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summaries.map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={formatCompactCurrency} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={(value) => value === "expenses" ? "Dépenses nettes" : value === "income" ? "Revenus" : "Autres entrées"} />
                  <Area type="monotone" dataKey="expenses" name="Dépenses nettes" stroke="#d56f52" fill="#f6dfd8" />
                  <Area type="monotone" dataKey="income" name="Revenus" stroke="#52766f" fill="#dce8e3" />
                  <Area type="monotone" dataKey="otherInflows" name="Autres entrées" stroke="#d69a3c" fill="#f6ead2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card mb-5 p-4 sm:p-6">
            <p className="eyebrow mb-2">Lecture mensuelle</p>
            <h2 className="text-xl font-black">Vie courante et événements</h2>
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contextByMonth.map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={58} tickFormatter={formatCompactCurrency} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="current" name="Vie courante" stackId="context" fill={contextColors.current} />
                  <Bar dataKey="events" name="Événements" stackId="context" fill={contextColors.events} />
                  {contextByMonth.some((entry) => entry.unconfirmed > 0) ? (
                    <Bar dataKey="unconfirmed" name="À confirmer" stackId="context" fill={contextColors.unconfirmed} />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <DistributionModule
            title="Comment se répartissent nos dépenses ?"
            dimension={distributionDimension}
            onDimension={setDistributionDimension}
            rows={dimensionBreakdown(filteredOperations, distributionDimension, operations)}
            contextHref={contextHref}
          />

          <DistributionModule
            title="Ce que chaque poste nous coûte en moyenne"
            dimension={averageDimension}
            onDimension={setAverageDimension}
            rows={averageMonthlyByDimension(filteredOperations, periodMonths, averageDimension, operations)}
            contextHref={contextHref}
            average
          />

          {eventsForPeriod.length ? (
            <section className="card mb-5 overflow-hidden">
              <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
                <p className="eyebrow mb-2">Pourquoi la dépense a eu lieu</p>
                <h2 className="text-xl font-black">Événements et projets</h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {eventsForPeriod.slice(0, 8).map((entry) => (
                  <Link
                    key={`${entry.event}-${entry.eventDetail ?? ""}`}
                    href={contextHref({ detail: "1", event: entry.event, eventDetail: entry.eventDetail })}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--color-surface-soft)] sm:px-6"
                  >
                    <span>
                      <span className="block font-black">{entry.eventDetail ?? entry.event}</span>
                      <span className="mt-1 block text-xs text-[var(--color-muted)]">
                        {entry.event}{entry.eventDetail ? ` · ${entry.eventDetail}` : ""} · {formatDate(entry.firstDate)} — {formatDate(entry.lastDate)} · {entry.count} opération{entry.count > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="font-black">{formatCurrency(entry.value)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {exceptionalTotal > 0 ? (
            <Link
              href={contextHref({ detail: "1", status: "Exceptionnel" })}
              className="card mb-5 flex items-center justify-between gap-4 p-5 transition hover:border-[var(--color-primary)] sm:p-6"
            >
              <span>
                <span className="eyebrow mb-1 block">Statut analytique distinct des événements</span>
                <span className="block text-xl font-black">Dépenses exceptionnelles sur la période</span>
                <span className="mt-1 block text-sm text-[var(--color-muted)]">{exceptionalOperations.length} opération{exceptionalOperations.length > 1 ? "s" : ""}</span>
              </span>
              <span className="text-xl font-black">{formatCurrency(exceptionalTotal)}</span>
            </Link>
          ) : null}
        </>
      ) : (
        <MonthView
          month={selectedMonth}
          months={months}
          operations={filteredOperations}
          referenceOperations={contextualOperations}
          allOperations={operations}
          contextHref={contextHref}
          operationsHref={operationsHref}
          incompleteCount={incompleteRows.length}
          onComplete={() => setCompletionOpen(true)}
        />
      )}

      {completionOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#24322f]/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Données à compléter">
          <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-canvas)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6">
              <div><p className="eyebrow">{titleCase(formatMonth(selectedMonth))}</p><h2 className="text-xl font-black">Données à compléter</h2></div>
              <button type="button" className="button-secondary px-3" onClick={() => setCompletionOpen(false)} aria-label="Fermer"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-4 sm:p-6">
              {saveError ? <p className="rounded-[var(--radius-sm)] bg-[#f7dfda] p-3 text-sm font-bold text-[#9a463c]">{saveError}</p> : null}
              {incompleteRows.map(({ operation, reasons }) => {
                const draft = eventDrafts[operation.id] ?? {
                  event: operation.event ?? "",
                  detail: operation.eventDetail ?? "",
                };
                return (
                  <article key={operation.id} className="card p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{formatDate(operation.date)} · {operation.label}</p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{operation.category} · {formatCurrency(operation.amount, true)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">{reasons.map((reason) => <span key={reason} className="badge" data-tone="warning">{reason}</span>)}</div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {reasons.includes("Entrée d’argent à qualifier") ? (
                        <label className="text-xs font-bold text-[var(--color-muted)]">Qualifier l’entrée
                          <select className="field mt-1 w-full text-sm" disabled={savingId === operation.id} defaultValue="" onChange={(event) => {
                            const value = event.target.value as ResourceType;
                            if (value) saveOperation(operation, { resourceType: value });
                          }}>
                            <option value="" disabled>Choisir</option><option>Revenu</option><option>Entrée d&apos;argent</option><option>Remboursement</option><option>Transfert interne</option><option>Flux technique</option>
                          </select>
                        </label>
                      ) : null}
                      {reasons.includes("Remboursement à rattacher") ? (
                        <label className="text-xs font-bold text-[var(--color-muted)]">Remboursement de
                          <input
                            className="field mt-1 w-full text-sm"
                            value={reimbursementQuery}
                            placeholder="Rechercher une dépense"
                            onChange={(event) => setReimbursementQuery(event.target.value)}
                          />
                          <select className="field mt-1 w-full text-sm" disabled={savingId === operation.id} defaultValue="" onChange={(event) => {
                            if (event.target.value) saveOperation(operation, { reimbursesOperationId: event.target.value });
                          }}>
                            <option value="">Choisir une dépense</option>
                            {reimbursementCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{formatDate(candidate.date)} · {candidate.label} · {formatCurrency(Math.abs(candidate.amount))}</option>)}
                          </select>
                        </label>
                      ) : null}
                    </div>
                    {reasons.includes("Contexte de dépense à confirmer") ? (
                      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3">
                        <p className="text-xs font-bold text-[var(--color-muted)]">Contexte de dépense</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className="button-secondary text-sm" disabled={savingId === operation.id} onClick={() => {
                            if (operation.event && !window.confirm("Confirmer la suppression de l’événement existant ?")) return;
                            saveOperation(operation, { spendingContext: "Vie courante", event: null, eventDetail: null });
                          }}>Vie courante</button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input className="field text-sm" list="known-events" value={draft.event} placeholder="Événement" onChange={(event) => setEventDrafts((values) => ({ ...values, [operation.id]: { ...draft, event: event.target.value } }))} />
                          <input className="field text-sm" value={draft.detail} placeholder="Spécification facultative" onChange={(event) => setEventDrafts((values) => ({ ...values, [operation.id]: { ...draft, detail: event.target.value } }))} />
                          <button type="button" className="button-primary text-sm" disabled={savingId === operation.id || !draft.event.trim()} onClick={() => saveOperation(operation, { spendingContext: "Événement", event: draft.event.trim(), eventDetail: draft.detail.trim() || null })}>Confirmer l’événement</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <datalist id="known-events">{knownEvents.map((entry) => <option key={entry} value={entry} />)}</datalist>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DistributionModule({
  title,
  dimension,
  onDimension,
  rows,
  contextHref,
  average = false,
}: {
  title: string;
  dimension: HistoryDimension;
  onDimension: (dimension: HistoryDimension) => void;
  rows: Array<{ name: string; value: number }>;
  contextHref: (patch?: Record<string, string | null>) => string;
  average?: boolean;
}) {
  const smallDimension = ["importance", "recurrence", "status"].includes(dimension);
  const dimensions: Array<[HistoryDimension, string]> = average
    ? [["category", "Famille"], ["subcategory", "Catégorie"], ["importance", "Importance"]]
    : [["category", "Familles"], ["subcategory", "Catégories"], ["importance", "Importance"], ["recurrence", "Fixe / variable"], ["status", "Statut analytique"]];
  const patchFor = (name: string) => ({ detail: "1", [dimension]: name });
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow mb-2">{average ? "Moyenne mensuelle observée" : "Composition"}</p><h2 className="text-xl font-black">{title}</h2></div>
        <select className="field text-sm font-bold" value={dimension} onChange={(event) => onDimension(event.target.value as HistoryDimension)}>
          {dimensions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {smallDimension && !average ? (
        <div className="mt-4 grid items-center gap-5 lg:grid-cols-[1fr_360px]">
          <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} onClick={(entry) => routerSafe(contextHref(patchFor(String(entry.name))))}>{rows.map((entry, index) => <Cell key={entry.name} fill={importanceColors[index % importanceColors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-2">{rows.map((entry) => <Link key={entry.name} href={contextHref(patchFor(entry.name))} className="flex items-center justify-between rounded-xl bg-[var(--color-surface-soft)] px-4 py-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div>
        </div>
      ) : (
        <div className="mt-4 h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0, 12)} layout="vertical" margin={{ left: 15, right: 20 }} onClick={(event) => {
          const row = event?.activePayload?.[0]?.payload as { name?: string } | undefined;
          if (row?.name) routerSafe(contextHref(patchFor(row.name)));
        }}><CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} /><YAxis type="category" dataKey="name" width={145} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" fill="#52766f" radius={[0, 7, 7, 0]} cursor="pointer" /></BarChart></ResponsiveContainer></div>
      )}
    </section>
  );
}

function routerSafe(href: string) {
  window.location.assign(href);
}

function DetailView({
  title,
  view,
  months,
  operations,
  referenceMonths,
  referenceOperations,
  allOperations,
  contextHref,
  operationsHref,
}: {
  title: string;
  view: HistoryView;
  months: MonthKey[];
  operations: Operation[];
  referenceMonths: MonthKey[];
  referenceOperations: Operation[];
  allOperations: Operation[];
  contextHref: (patch?: Record<string, string | null>) => string;
  operationsHref: string;
}) {
  const total = totalExpenses(operations, allOperations);
  const observedReferenceOperations = referenceOperations.filter((operation) =>
    referenceMonths.includes(
      isConsumptionExpense(operation)
        ? operation.importMonth
        : operationAnalysisMonth(operation),
    ),
  );
  const average = referenceMonths.length
    ? totalExpenses(observedReferenceOperations, allOperations) /
      referenceMonths.length
    : 0;
  const trend = monthlySummaries(
    observedReferenceOperations,
    referenceMonths,
    allOperations,
  );
  const categories = dimensionBreakdown(operations, "category", allOperations);
  const subcategories = dimensionBreakdown(operations, "subcategory", allOperations);
  const contexts = spendingContextBreakdown(operations, allOperations).filter((entry) => entry.value > 0);
  const paidDates = operations
    .filter(isConsumptionExpense)
    .map((operation) => operation.date)
    .sort((a, b) => a.localeCompare(b));
  const paidPeriod = paidDates.length
    ? paidDates[0] === paidDates.at(-1)
      ? formatDate(paidDates[0])
      : `${formatDate(paidDates[0])} — ${formatDate(paidDates.at(-1)!)}`
    : `${formatMonth(months[0])} — ${formatMonth(months.at(-1)!)}`;
  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className="grid sm:grid-cols-3">
          <div className="bg-[var(--color-primary)] p-5 text-white sm:p-6"><p className="text-sm font-bold text-white/70">{title}</p><p className="mt-2 text-3xl font-black">{formatCurrency(total)}</p><p className="mt-2 text-xs text-white/70">Total réellement payé sur la période</p></div>
          <div className="border-b border-[var(--color-border)] p-5 sm:border-b-0 sm:border-r sm:p-6"><p className="text-sm font-bold text-[var(--color-muted)]">Moyenne mensuelle observée</p><p className="mt-2 text-2xl font-black">{formatCurrency(average)}</p></div>
          <div className="p-5 sm:p-6"><p className="text-sm font-bold text-[var(--color-muted)]">Période payée</p><p className="mt-2 text-lg font-black capitalize">{paidPeriod}</p></div>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="card p-4 sm:p-6"><h2 className="text-xl font-black">Évolution réelle</h2><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend.map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }))}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} width={58} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Area dataKey="expenses" stroke="#52766f" fill="#dce8e3" /></AreaChart></ResponsiveContainer></div></div>
        <div className="card p-4 sm:p-6"><h2 className="text-xl font-black">Vie courante / événements</h2><div className="mt-4 space-y-2">{contexts.map((entry) => <Link key={entry.name} href={contextHref({ detail: "1", context: entry.name === "Vie courante" ? "current" : entry.name === "Événement" ? "events" : "unconfirmed" })} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div></div>
      </section>
      <section className="card mt-5 p-4 sm:p-6"><h2 className="text-xl font-black">Principaux postes</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{(subcategories.length > 1 ? subcategories : categories).slice(0, 10).map((entry) => <div key={entry.name} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></div>)}</div></section>
      <Link href={operationsHref} className="button-primary mt-5">Voir les opérations{view === "month" ? " du mois" : ""}<ArrowRight size={16} /></Link>
    </>
  );
}

function MonthView({
  month,
  months,
  operations,
  referenceOperations,
  allOperations,
  contextHref,
  operationsHref,
  incompleteCount,
  onComplete,
}: {
  month: MonthKey;
  months: MonthKey[];
  operations: Operation[];
  referenceOperations: Operation[];
  allOperations: Operation[];
  contextHref: (patch?: Record<string, string | null>) => string;
  operationsHref: string;
  incompleteCount: number;
  onComplete: () => void;
}) {
  const summaries = monthlySummaries(operations, [month], allOperations);
  const summary = summaries[0];
  const allSummaries = monthlySummaries(
    referenceOperations,
    months,
    allOperations,
  );
  const average = mean(allSummaries.map((entry) => entry.expenses));
  const previous = allSummaries[months.indexOf(month) - 1]?.expenses ?? summary.expenses;
  const deltas = categoryReferenceDeltas(
    referenceOperations,
    month,
    months,
    allOperations,
  );
  const monthCategories = dimensionBreakdown(operations, "category", allOperations);
  const monthCategoryDetails = monthCategories.map((entry) => {
    const comparison = deltas.find((delta) => delta.name === entry.name);
    return {
      ...entry,
      share: summary.expenses ? entry.value / summary.expenses : 0,
      reference: comparison?.reference ?? 0,
      delta: comparison?.delta ?? entry.value,
    };
  });
  const contexts = spendingContextBreakdown(operations, allOperations).filter((entry) => entry.value > 0);
  const monthEvents = eventGroups(operations, allOperations);
  const importance = importanceBreakdown(operations, allOperations);
  const statuses = statusBreakdown(operations, allOperations);
  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="bg-[var(--color-primary)] p-6 text-white sm:p-8"><p className="text-sm font-bold text-white/70">Dépenses nettes</p><p className="mt-2 text-5xl font-black">{formatCurrency(summary.expenses)}</p><div className="mt-6 flex flex-wrap gap-5 border-t border-white/20 pt-4 text-sm"><span>vs moyenne {formatPercent(average ? (summary.expenses - average) / average : 0, true)}</span><span>vs mois précédent {formatPercent(previous ? (summary.expenses - previous) / previous : 0, true)}</span><span>référence {formatCurrency(average)}</span></div></div>
          <div className="grid sm:grid-cols-3 lg:grid-cols-1"><div className="border-b border-[var(--color-border)] p-5"><p className="text-sm text-[var(--color-muted)]">Revenus</p><p className="mt-1 text-xl font-black">{formatCurrency(summary.income)}</p></div><div className="border-b border-[var(--color-border)] p-5"><p className="text-sm text-[var(--color-muted)]">Autres entrées</p><p className="mt-1 text-xl font-black">{formatCurrency(summary.otherInflows)}</p></div><div className="p-5"><p className="text-sm text-[var(--color-muted)]">Résultat analytique</p><p className={`mt-1 text-xl font-black ${summary.net >= 0 ? "positive" : "negative"}`}>{formatCurrency(summary.net, true)}</p></div></div>
        </div>
      </section>
      <section className="card mb-5 p-4 sm:p-6"><p className="eyebrow mb-2">Comparer</p><h2 className="text-xl font-black">Pourquoi ce mois est différent</h2>{deltas.length ? <div className="mt-4 h-[330px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={deltas.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 20 }} onClick={(event) => { const row = event?.activePayload?.[0]?.payload as { name?: string } | undefined; if (row?.name) routerSafe(contextHref({ detail: "1", category: row.name })); }}><CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} /><YAxis type="category" dataKey="name" width={135} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(Number(value), true)} /><Bar dataKey="delta" name="Écart" radius={[0, 6, 6, 0]} cursor="pointer">{deltas.slice(0, 10).map((entry) => <Cell key={entry.name} fill={entry.delta >= 0 ? "#d56f52" : "#52766f"} />)}</Bar></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-[var(--color-muted)]">La référence est insuffisante pour comparer ce mois.</p>}</section>
      <section className="card mb-5 p-4 sm:p-6"><p className="eyebrow mb-2">Lecture principale</p><h2 className="text-xl font-black">Où est parti l’argent ?</h2><div className="mt-4 h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthCategoryDetails.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 20 }} onClick={(event) => { const row = event?.activePayload?.[0]?.payload as { name?: string } | undefined; if (row?.name) routerSafe(contextHref({ detail: "1", category: row.name })); }}><CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} /><YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" fill="#52766f" radius={[0, 7, 7, 0]} cursor="pointer" /></BarChart></ResponsiveContainer></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="text-left text-xs text-[var(--color-muted)]"><tr><th className="py-2">Poste</th><th className="py-2 text-right">Montant</th><th className="py-2 text-right">Part</th><th className="py-2 text-right">Référence</th><th className="py-2 text-right">Écart</th></tr></thead><tbody>{monthCategoryDetails.slice(0, 10).map((entry) => <tr key={entry.name} className="border-t border-[var(--color-border)]"><td className="py-2 font-bold"><Link href={contextHref({ detail: "1", category: entry.name })}>{entry.name}</Link></td><td className="py-2 text-right font-bold">{formatCurrency(entry.value)}</td><td className="py-2 text-right">{formatPercent(entry.share)}</td><td className="py-2 text-right">{formatCurrency(entry.reference)}</td><td className={`py-2 text-right font-bold ${entry.delta > 0 ? "negative" : entry.delta < 0 ? "positive" : ""}`}>{formatCurrency(entry.delta, true)}</td></tr>)}</tbody></table></div></section>
      <section className="grid gap-5 xl:grid-cols-2"><div className="card p-4 sm:p-6"><h2 className="text-xl font-black">Vie courante / événements du mois</h2><div className="mt-4 space-y-2">{contexts.map((entry) => <Link key={entry.name} href={contextHref({ detail: "1", context: entry.name === "Vie courante" ? "current" : entry.name === "Événement" ? "events" : "unconfirmed" })} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div>{monthEvents.length ? <div className="mt-4 border-t border-[var(--color-border)] pt-3">{monthEvents.map((entry) => <Link key={`${entry.event}-${entry.eventDetail ?? ""}`} href={contextHref({ detail: "1", event: entry.event, eventDetail: entry.eventDetail })} className="flex justify-between py-2 text-sm font-bold"><span>{entry.eventDetail ?? entry.event}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div> : null}</div><div className="card p-4 sm:p-6"><h2 className="text-xl font-black">Marge de manœuvre</h2><div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={importance} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} onClick={(entry) => routerSafe(contextHref({ detail: "1", importance: String(entry.name) }))}>{importance.map((entry, index) => <Cell key={entry.name} fill={importanceColors[index]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div></div></section>
      <section className="card mt-5 p-4 sm:p-6"><h2 className="text-xl font-black">Habituel, exceptionnel et hors budget</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{statuses.map((entry, index) => <Link key={entry.name} href={contextHref({ detail: "1", status: entry.name })} className="rounded-xl bg-[var(--color-surface-soft)] p-3"><span className="text-sm font-bold">{entry.name}</span><p className="mt-1 font-black" style={{ color: statusColors[index] }}>{formatCurrency(entry.value)}</p></Link>)}</div></section>
      {incompleteCount ? <button type="button" onClick={onComplete} className="card mt-5 flex w-full items-center justify-between p-5 text-left transition hover:border-[var(--color-primary)]"><span className="flex gap-3"><CircleAlert className="text-[var(--color-primary)]" /><span><span className="block font-black">Données à compléter · {incompleteCount} opération{incompleteCount > 1 ? "s" : ""}</span><span className="mt-1 block text-sm text-[var(--color-muted)]">Quelques informations manquent pour fiabiliser l’analyse de {formatMonth(month)}.</span></span></span><span className="font-bold text-[var(--color-primary)]">Compléter</span></button> : null}
      <Link href={operationsHref} className="button-primary mt-5">Voir les opérations de {formatMonth(month)}<ArrowRight size={16} /></Link>
    </>
  );
}
