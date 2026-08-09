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
import { ArrowRight, ChevronRight, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MonthRangeTimeline } from "@/components/ui/month-timeline";
import type {
  AnalyticalStatus,
  MonthKey,
  Operation,
  ResourceType,
} from "@/domain/budget";
import {
  descriptiveStats,
  importanceBreakdown,
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
import {
  cleanHistoryFilters,
  defaultHistoryFilters,
  filterHistoryOperations,
  historyFacetOptions,
  operationHistoryFlow,
  operationHistoryMonth,
  operationHistoryResourceType,
  operationMerchant,
  operationsInHistoryPeriod,
  weeklyExpenseSummaries,
  type HistoryContext,
  type HistoryFilters,
  type HistoryFlow,
} from "@/domain/history-filters";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatMonth,
  formatPercent,
  formatShortMonth,
} from "@/lib/format";

export type HistoryRangeContext = {
  start?: MonthKey;
  end?: MonthKey;
  detail?: boolean;
  detailLabel?: string;
  filters: HistoryFilters;
};

const colors = ["#52766f", "#d69a3c", "#d36e53", "#806da5", "#5b8eaa", "#b65f82"];
const filterParams: Array<[keyof HistoryFilters, string]> = [
  ["flows", "flux"],
  ["families", "families"],
  ["categories", "categories"],
  ["merchants", "merchants"],
  ["statuses", "statuses"],
  ["importances", "importances"],
  ["recurrences", "recurrences"],
  ["contexts", "contexts"],
  ["events", "events"],
  ["eventDetails", "eventDetails"],
  ["resourceTypes", "resourceTypes"],
];

function sameFilters(a: HistoryFilters, b: HistoryFilters) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function periodMonths(months: MonthKey[], start: MonthKey, end: MonthKey) {
  return months.filter((month) => month >= start && month <= end);
}

function buildHistoryHref(
  start: MonthKey,
  end: MonthKey,
  filters: HistoryFilters,
  detail?: { active: boolean; label?: string },
) {
  const params = new URLSearchParams({ start, end });
  for (const [key, param] of filterParams) {
    const values = filters[key] as string[];
    const defaultFlows = key === "flows" && values.length === 2;
    if (values.length && !defaultFlows) params.set(param, values.join(","));
  }
  if (detail?.active) params.set("detail", "1");
  if (detail?.label) params.set("detailLabel", detail.label);
  return `/historique?${params.toString()}`;
}

function operationsHref(
  start: MonthKey,
  end: MonthKey,
  filters: HistoryFilters,
  returnTo: string,
) {
  const params = new URLSearchParams({ start, end, returnTo });
  for (const [key, param] of filterParams) {
    const values = filters[key] as string[];
    if (values.length) params.set(param, values.join(","));
  }
  return `/operations?${params.toString()}`;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function Facet({
  label,
  values,
  options,
  onChange,
  labels,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  labels?: Record<string, string>;
}) {
  if (!options.length) return null;
  return (
    <details className="relative">
      <summary className="button-secondary cursor-pointer list-none text-sm">
        {label}{values.length ? ` · ${values.length}` : ""}
      </summary>
      <div className="absolute left-0 z-30 mt-2 max-h-72 min-w-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-[var(--shadow-md)]">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--color-surface-soft)]">
            <input type="checkbox" checked={values.includes(option)} onChange={() => onChange(toggleValue(values, option))} />
            <span>{labels?.[option] ?? option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function formatWeekLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))}–${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

export function HistoryRangeDashboard({
  months,
  operations,
  initialContext,
}: {
  months: MonthKey[];
  operations: Operation[];
  initialContext: HistoryRangeContext;
}) {
  const router = useRouter();
  const [pendingStart, setPendingStart] = useState<MonthKey | undefined>();
  const [draft, setDraft] = useState<HistoryFilters>(initialContext.filters);
  const start = initialContext.start;
  const end = initialContext.end;
  const selecting = Boolean(pendingStart);
  const complete = Boolean(start && end && !selecting);

  function selectMonth(month: MonthKey) {
    if (!pendingStart) {
      setPendingStart(month);
      return;
    }
    const normalizedStart = pendingStart <= month ? pendingStart : month;
    const normalizedEnd = pendingStart <= month ? month : pendingStart;
    setPendingStart(undefined);
    router.replace(buildHistoryHref(normalizedStart, normalizedEnd, defaultHistoryFilters));
  }

  function clearPeriod() {
    setPendingStart(undefined);
    setDraft(defaultHistoryFilters);
    router.replace("/historique");
  }

  const selectedMonths = complete ? periodMonths(months, start!, end!) : [];
  const periodOperations = complete
    ? operationsInHistoryPeriod(operations, start!, end!)
    : [];
  const facets = useMemo(
    () => historyFacetOptions(periodOperations, draft),
    [periodOperations, draft],
  );

  function changeDraft<K extends keyof HistoryFilters>(key: K, values: HistoryFilters[K]) {
    const next = cleanHistoryFilters(periodOperations, { ...draft, [key]: values });
    setDraft(next);
  }

  function applyFilters() {
    if (!start || !end || !draft.flows.length) return;
    router.replace(buildHistoryHref(start, end, draft));
  }

  const applied = initialContext.filters;
  const filtered = complete
    ? filterHistoryOperations(periodOperations, applied)
    : [];
  const hasExpenses = applied.flows.includes("expenses");
  const hasInflows = applied.flows.includes("inflows");
  const currentHref = complete
    ? buildHistoryHref(start!, end!, applied, initialContext.detail
      ? { active: true, label: initialContext.detailLabel }
      : undefined)
    : "/historique";
  const operationLink = complete
    ? operationsHref(start!, end!, applied, currentHref)
    : "/operations";

  function detailHref(
    patch: Partial<HistoryFilters>,
    label: string,
  ) {
    const next = cleanHistoryFilters(periodOperations, { ...applied, ...patch });
    return buildHistoryHref(start!, end!, next, { active: true, label });
  }

  const expenseFacetVisible = draft.flows.includes("expenses");
  const inflowFacetVisible = draft.flows.includes("inflows");
  const modificationsPending = !sameFilters(draft, applied);

  return (
    <div>
      <PageHeader
        eyebrow="Comprendre le passé"
        title="Historique"
        description="Sélectionnez la période dont vous souhaitez comprendre le fonctionnement financier."
      />

      {initialContext.detail && complete ? (
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]" aria-label="Fil d’Ariane">
          <Link href={buildHistoryHref(start!, end!, applied)}>Historique</Link>
          <ChevronRight size={14} />
          <span className="capitalize">{formatMonth(start!)} — {formatMonth(end!)}</span>
          <ChevronRight size={14} />
          <span className="font-bold text-[var(--color-ink)]">{initialContext.detailLabel ?? "Analyse ciblée"}</span>
        </nav>
      ) : null}

      <MonthRangeTimeline
        months={months}
        start={selecting ? undefined : start}
        end={selecting ? undefined : end}
        pendingStart={pendingStart}
        onSelect={selectMonth}
        onClear={clearPeriod}
      />

      {!complete ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          <p>{pendingStart ? `Début sélectionné : ${formatMonth(pendingStart)}. Choisissez maintenant la fin.` : "Sélectionnez un mois de début puis un mois de fin."}</p>
          <p className="mt-1">Sélectionnez deux fois le même mois pour analyser un seul mois.</p>
        </div>
      ) : (
        <>
          <section className="card my-5 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Facet
                label="Flux"
                values={draft.flows}
                options={["expenses", "inflows"]}
                labels={{ expenses: "Dépenses", inflows: "Rentrées d’argent" }}
                onChange={(values) => changeDraft("flows", values as HistoryFlow[])}
              />
              {expenseFacetVisible ? (
                <>
                  <Facet label="Famille" values={draft.families} options={facets.families} onChange={(values) => changeDraft("families", values)} />
                  {draft.families.length ? <Facet label="Catégorie" values={draft.categories} options={facets.categories} onChange={(values) => changeDraft("categories", values)} /> : null}
                  <Facet label="Statut" values={draft.statuses} options={facets.statuses} onChange={(values) => changeDraft("statuses", values as AnalyticalStatus[])} />
                  <Facet label="Contexte" values={draft.contexts} options={facets.contexts} labels={{ current: "Vie courante", events: "Événement", unconfirmed: "À confirmer" }} onChange={(values) => changeDraft("contexts", values as HistoryContext[])} />
                  {draft.contexts.includes("events") ? <Facet label="Événement" values={draft.events} options={facets.events} onChange={(values) => changeDraft("events", values)} /> : null}
                  {draft.contexts.includes("events") && draft.events.length && facets.eventDetails.length ? <Facet label="Spécification" values={draft.eventDetails} options={facets.eventDetails} onChange={(values) => changeDraft("eventDetails", values)} /> : null}
                </>
              ) : null}
              <Facet label="Tiers" values={draft.merchants} options={facets.merchants} onChange={(values) => changeDraft("merchants", values)} />
              {inflowFacetVisible ? <Facet label="Type d’entrée" values={draft.resourceTypes} options={facets.resourceTypes} onChange={(values) => changeDraft("resourceTypes", values as ResourceType[])} /> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <p className={`text-sm font-bold ${modificationsPending ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}`}>
                {modificationsPending ? "Modifications non appliquées" : "Filtres appliqués"}
              </p>
              <div className="flex gap-2">
                <button type="button" className="button-ghost" onClick={() => setDraft(defaultHistoryFilters)}><RotateCcw size={15} /> Réinitialiser</button>
                <button type="button" className="button-primary" disabled={!modificationsPending || !draft.flows.length} onClick={applyFilters}>Appliquer les filtres</button>
              </div>
            </div>
          </section>

          {initialContext.detail ? (
            <TargetedAnalysis
              operations={filtered}
              allOperations={operations}
              months={selectedMonths}
              label={initialContext.detailLabel ?? "Analyse ciblée"}
              operationsHref={operationLink}
            />
          ) : hasInflows && !hasExpenses ? (
            <InflowAnalysis
              operations={filtered}
              months={selectedMonths}
              operationsHref={operationLink}
            />
          ) : start === end ? (
            <SingleMonthAnalysis
              month={start!}
              months={months}
              operations={filtered}
              referenceOperations={filterHistoryOperations(operations, applied)}
              allOperations={operations}
              hasInflows={hasInflows}
              detailHref={detailHref}
              operationsHref={operationLink}
            />
          ) : (
            <MultiMonthAnalysis
              months={selectedMonths}
              operations={filtered}
              allOperations={operations}
              hasInflows={hasInflows}
              detailHref={detailHref}
              operationsHref={operationLink}
            />
          )}
        </>
      )}
    </div>
  );
}

function EvolutionChart({
  operations,
  allOperations,
  months,
  start,
  end,
  hasInflows,
  monthlyChoice = true,
}: {
  operations: Operation[];
  allOperations: Operation[];
  months: MonthKey[];
  start: MonthKey;
  end: MonthKey;
  hasInflows: boolean;
  monthlyChoice?: boolean;
}) {
  const [granularity, setGranularity] = useState<"month" | "week">(monthlyChoice ? "month" : "week");
  const monthly = monthlySummaries(operations, months, allOperations).map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }));
  const weekly = weeklyExpenseSummaries(operations, start, end, allOperations).map((entry) => ({ ...entry, label: formatWeekLabel(entry.weekStart, entry.weekEnd) }));
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow mb-2">Évolution</p><h2 className="text-xl font-black">{granularity === "month" ? "Évolution globale" : start === end ? "Évolution des dépenses dans le mois" : "Dépenses nettes par semaine"}</h2></div>
        {monthlyChoice ? <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-1"><button type="button" onClick={() => setGranularity("month")} className={`rounded-md px-3 py-2 text-xs font-black ${granularity === "month" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"}`}>Par mois</button><button type="button" onClick={() => setGranularity("week")} className={`rounded-md px-3 py-2 text-xs font-black ${granularity === "week" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"}`}>Par semaine</button></div> : null}
      </div>
      <div className="mt-4 h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          {granularity === "month" ? (
            <AreaChart data={monthly}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis width={58} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Area dataKey="expenses" name="Dépenses nettes" stroke="#d36e53" fill="#f6dfd8" />{hasInflows ? <><Area dataKey="income" name="Revenus" stroke="#52766f" fill="#dce8e3" /><Area dataKey="otherInflows" name="Autres entrées" stroke="#d69a3c" fill="#f6ead2" /></> : null}</AreaChart>
          ) : (
            <BarChart data={weekly}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis width={58} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="expenses" name="Dépenses nettes" fill="#52766f" radius={[6, 6, 0, 0]} /></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MultiMonthAnalysis({
  months,
  operations,
  allOperations,
  hasInflows,
  detailHref,
  operationsHref,
}: {
  months: MonthKey[];
  operations: Operation[];
  allOperations: Operation[];
  hasInflows: boolean;
  detailHref: (patch: Partial<HistoryFilters>, label: string) => string;
  operationsHref: string;
}) {
  const summaries = monthlySummaries(operations, months, allOperations);
  const stats = descriptiveStats(summaries);
  const contextByMonth = monthlySpendingContexts(operations, months, allOperations);
  const currentAverage = mean(contextByMonth.map((entry) => entry.current));
  const [dimension, setDimension] = useState<HistoryDimension>("category");
  const [averageDimension, setAverageDimension] = useState<HistoryDimension>("category");
  const events = eventGroups(operations, allOperations);
  const exceptional = totalExpenses(operations.filter((operation) => operation.status === "Exceptionnel"), allOperations);
  return (
    <>
      <section className="card mb-5 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4"><div className="bg-[var(--color-primary)] p-5 text-white"><p className="text-sm font-bold text-white/70">Dépenses moyennes</p><p className="mt-2 text-3xl font-black">{formatCurrency(stats.average)}/mois</p><p className="mt-2 text-xs text-white/70">Médiane : {formatCurrency(stats.median)}</p></div><div className="p-5"><p className="text-sm font-bold text-[var(--color-muted)]">Vie courante moyenne</p><p className="mt-2 text-2xl font-black">{formatCurrency(currentAverage)}/mois</p></div><div className="p-5"><p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus léger</p><p className="mt-2 font-black capitalize">{formatMonth(stats.best.month)}</p><p>{formatCurrency(stats.best.expenses)}</p></div><div className="p-5"><p className="text-sm font-bold text-[var(--color-muted)]">Mois le plus chargé</p><p className="mt-2 font-black capitalize">{formatMonth(stats.worst.month)}</p><p>{formatCurrency(stats.worst.expenses)}</p></div></section>
      <EvolutionChart operations={operations} allOperations={allOperations} months={months} start={months[0]} end={months.at(-1)!} hasInflows={hasInflows} />
      <section className="card mb-5 p-4 sm:p-6"><h2 className="text-xl font-black">Vie courante et événements</h2><div className="mt-4 h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={contextByMonth.map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }))}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis width={58} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Bar dataKey="current" name="Vie courante" stackId="context" fill="#52766f" /><Bar dataKey="events" name="Événements" stackId="context" fill="#d69a3c" />{contextByMonth.some((entry) => entry.unconfirmed > 0) ? <Bar dataKey="unconfirmed" name="À confirmer" stackId="context" fill="#d36e53" /> : null}</BarChart></ResponsiveContainer></div></section>
      <Breakdown title="Comment se répartissent nos dépenses ?" rows={dimensionBreakdown(operations, dimension, allOperations)} dimension={dimension} onDimension={setDimension} detailHref={detailHref} />
      <Breakdown title="Ce que chaque poste nous coûte en moyenne" rows={averageMonthlyByDimension(operations, months, averageDimension, allOperations)} dimension={averageDimension} onDimension={setAverageDimension} detailHref={detailHref} average />
      {events.length ? <section className="card mb-5 overflow-hidden"><div className="p-5"><h2 className="text-xl font-black">Événements et projets</h2></div>{events.slice(0, 8).map((entry) => <Link key={`${entry.event}-${entry.eventDetail ?? ""}`} href={detailHref({ contexts: ["events"], events: [entry.event], eventDetails: entry.eventDetail ? [entry.eventDetail] : [] }, entry.eventDetail ?? entry.event)} className="flex justify-between border-t border-[var(--color-border)] px-5 py-4 font-bold"><span>{entry.eventDetail ?? entry.event}<small className="ml-2 text-[var(--color-muted)]">{formatDate(entry.firstDate)} — {formatDate(entry.lastDate)}</small></span><span>{formatCurrency(entry.value)}</span></Link>)}</section> : null}
      {exceptional > 0 ? <Link href={detailHref({ statuses: ["Exceptionnel"] }, "Exceptionnel")} className="card mb-5 flex justify-between p-5 font-black"><span>Dépenses exceptionnelles sur la période</span><span>{formatCurrency(exceptional)}</span></Link> : null}
      <Link href={operationsHref} className="button-primary">Voir les opérations<ArrowRight size={16} /></Link>
    </>
  );
}

function SingleMonthAnalysis({
  month,
  months,
  operations,
  referenceOperations,
  allOperations,
  hasInflows,
  detailHref,
  operationsHref,
}: {
  month: MonthKey;
  months: MonthKey[];
  operations: Operation[];
  referenceOperations: Operation[];
  allOperations: Operation[];
  hasInflows: boolean;
  detailHref: (patch: Partial<HistoryFilters>, label: string) => string;
  operationsHref: string;
}) {
  const summary = monthlySummaries(operations, [month], allOperations)[0];
  const references = monthlySummaries(referenceOperations, months, allOperations);
  const average = mean(references.map((entry) => entry.expenses));
  const previous = references[months.indexOf(month) - 1]?.expenses ?? summary.expenses;
  const deltas = categoryReferenceDeltas(referenceOperations, month, months, allOperations);
  const categories = dimensionBreakdown(operations, "category", allOperations);
  const contexts = spendingContextBreakdown(operations, allOperations).filter((entry) => entry.value > 0);
  const events = eventGroups(operations, allOperations);
  const importance = importanceBreakdown(operations, allOperations);
  const statuses = statusBreakdown(operations, allOperations);
  return (
    <>
      <section className="card mb-5 overflow-hidden"><div className={`grid ${hasInflows ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}><div className="bg-[var(--color-primary)] p-6 text-white sm:p-8"><p className="text-sm font-bold text-white/70">Dépenses nettes</p><p className="mt-2 text-5xl font-black">{formatCurrency(summary.expenses)}</p><div className="mt-5 flex flex-wrap gap-4 border-t border-white/20 pt-4 text-sm"><span>vs moyenne {formatPercent(average ? (summary.expenses - average) / average : 0, true)}</span><span>vs mois précédent {formatPercent(previous ? (summary.expenses - previous) / previous : 0, true)}</span></div></div>{hasInflows ? <div className="grid sm:grid-cols-3 lg:grid-cols-1"><div className="p-5"><p className="text-sm text-[var(--color-muted)]">Revenus</p><p className="text-xl font-black">{formatCurrency(summary.income)}</p></div><div className="p-5"><p className="text-sm text-[var(--color-muted)]">Autres entrées</p><p className="text-xl font-black">{formatCurrency(summary.otherInflows)}</p></div><div className="p-5"><p className="text-sm text-[var(--color-muted)]">Résultat analytique</p><p className="text-xl font-black">{formatCurrency(summary.net, true)}</p></div></div> : null}</div></section>
      <EvolutionChart operations={operations} allOperations={allOperations} months={[month]} start={month} end={month} hasInflows={false} monthlyChoice={false} />
      <section className="card mb-5 p-4 sm:p-6"><h2 className="text-xl font-black">Pourquoi ce mois est différent</h2><div className="mt-4 h-[310px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={deltas.slice(0, 10)} layout="vertical" onClick={(event) => { const row = event?.activePayload?.[0]?.payload as { name?: string } | undefined; if (row?.name) window.location.assign(detailHref({ families: [row.name] }, row.name)); }}><CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" tickFormatter={formatCompactCurrency} /><YAxis type="category" dataKey="name" width={135} /><Tooltip formatter={(value) => formatCurrency(Number(value), true)} /><Bar dataKey="delta" name="Écart">{deltas.slice(0, 10).map((entry) => <Cell key={entry.name} fill={entry.delta >= 0 ? "#d36e53" : "#52766f"} />)}</Bar></BarChart></ResponsiveContainer></div></section>
      <section className="card mb-5 p-4 sm:p-6"><h2 className="text-xl font-black">Où est parti l’argent ?</h2><div className="mt-4 space-y-2">{categories.slice(0, 10).map((entry) => <Link key={entry.name} href={detailHref({ families: [entry.name] }, entry.name)} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div></section>
      <section className="grid gap-5 xl:grid-cols-2"><div className="card p-5"><h2 className="text-xl font-black">Vie courante / événements du mois</h2><div className="mt-3 space-y-2">{contexts.map((entry) => <Link key={entry.name} href={detailHref({ contexts: [entry.name === "Vie courante" ? "current" : entry.name === "Événement" ? "events" : "unconfirmed"] }, entry.name)} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div>{events.length ? <div className="mt-3 border-t border-[var(--color-border)] pt-2">{events.map((entry) => <Link key={`${entry.event}-${entry.eventDetail ?? ""}`} href={detailHref({ contexts: ["events"], events: [entry.event], eventDetails: entry.eventDetail ? [entry.eventDetail] : [] }, entry.eventDetail ?? entry.event)} className="flex justify-between py-2 text-sm font-bold"><span>{entry.eventDetail ?? entry.event}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div> : null}</div><div className="card p-5"><h2 className="text-xl font-black">Marge de manœuvre</h2><div className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={importance} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%">{importance.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{importance.map((entry) => <Link key={entry.name} href={detailHref({ importances: [entry.name] }, entry.name)} className="flex justify-between text-sm font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></Link>)}</div></div></section>
      <section className="card mt-5 p-5"><h2 className="text-xl font-black">Habituel, exceptionnel et hors budget</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{statuses.map((entry, index) => <Link key={entry.name} href={detailHref({ statuses: [entry.name] }, entry.name)} className="rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold" style={{ color: colors[index] }}>{entry.name}<span className="mt-1 block">{formatCurrency(entry.value)}</span></Link>)}</div></section>
      <Link href={operationsHref} className="button-primary mt-5">Voir les opérations de {formatMonth(month)}<ArrowRight size={16} /></Link>
    </>
  );
}

function Breakdown({ title, rows, dimension, onDimension, detailHref, average = false }: { title: string; rows: Array<{ name: string; value: number }>; dimension: HistoryDimension; onDimension: (value: HistoryDimension) => void; detailHref: (patch: Partial<HistoryFilters>, label: string) => string; average?: boolean }) {
  const options: Array<[HistoryDimension, string]> = average ? [["category", "Famille"], ["subcategory", "Catégorie"], ["importance", "Importance"]] : [["category", "Famille"], ["subcategory", "Catégorie"], ["importance", "Importance"], ["recurrence", "Fixe / variable"], ["status", "Statut"]];
  const filterKey: keyof HistoryFilters = dimension === "category" ? "families" : dimension === "subcategory" ? "categories" : dimension === "importance" ? "importances" : dimension === "recurrence" ? "recurrences" : "statuses";
  return <section className="card mb-5 p-4 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-xl font-black">{title}</h2><select className="field text-sm" value={dimension} onChange={(event) => onDimension(event.target.value as HistoryDimension)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-4 space-y-2">{rows.slice(0, 12).map((entry) => filterKey ? <Link key={entry.name} href={detailHref({ [filterKey]: [entry.name] }, entry.name)} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}{average ? "/mois" : ""}</span></Link> : <div key={entry.name} className="flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}{average ? "/mois" : ""}</span></div>)}</div></section>;
}

function InflowAnalysis({ operations, months, operationsHref }: { operations: Operation[]; months: MonthKey[]; operationsHref: string }) {
  const byType = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  for (const operation of operations.filter((entry) => operationHistoryFlow(entry) === "inflows")) {
    const type = operationHistoryResourceType(operation);
    byType.set(type, (byType.get(type) ?? 0) + operation.amount);
    const merchant = operationMerchant(operation);
    byMerchant.set(merchant, (byMerchant.get(merchant) ?? 0) + operation.amount);
  }
  const typeRows = [...byType].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const merchantRows = [...byMerchant].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const monthly = months.map((month) => ({ month, label: formatShortMonth(month), value: operations.filter((operation) => operationHistoryMonth(operation) === month && operationHistoryFlow(operation) === "inflows").reduce((sum, operation) => sum + operation.amount, 0) }));
  const total = typeRows.reduce((sum, entry) => sum + entry.value, 0);
  return <><section className="card mb-5 bg-[var(--color-primary)] p-6 text-white"><p className="text-sm font-bold text-white/70">Rentrées d’argent bancaires</p><p className="mt-2 text-4xl font-black">{formatCurrency(total)}</p><p className="mt-2 text-sm text-white/70">Répartition analytique conservée par type, sans assimiler tous les crédits à des revenus.</p></section><section className="card mb-5 p-5"><h2 className="text-xl font-black">Évolution des flux entrants</h2><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis width={58} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="value" name="Rentrées" fill="#52766f" /></BarChart></ResponsiveContainer></div></section><section className="grid gap-5 xl:grid-cols-2"><div className="card p-5"><h2 className="text-xl font-black">Types d’entrée</h2>{typeRows.map((entry) => <div key={entry.name} className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></div>)}</div><div className="card p-5"><h2 className="text-xl font-black">Tiers principaux</h2>{merchantRows.slice(0, 10).map((entry) => <div key={entry.name} className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></div>)}</div></section><Link href={operationsHref} className="button-primary mt-5">Voir les opérations<ArrowRight size={16} /></Link></>;
}

function TargetedAnalysis({ operations, allOperations, months, label, operationsHref }: { operations: Operation[]; allOperations: Operation[]; months: MonthKey[]; label: string; operationsHref: string }) {
  const total = totalExpenses(operations, allOperations);
  const average = months.length ? total / months.length : 0;
  const trend = monthlySummaries(operations, months, allOperations);
  const categories = dimensionBreakdown(operations, "category", allOperations);
  const contexts = spendingContextBreakdown(operations, allOperations).filter((entry) => entry.value > 0);
  return <><section className="card mb-5 grid overflow-hidden sm:grid-cols-3"><div className="bg-[var(--color-primary)] p-6 text-white"><p className="text-sm font-bold text-white/70">{label}</p><p className="mt-2 text-3xl font-black">{formatCurrency(total)}</p></div><div className="p-6"><p className="text-sm text-[var(--color-muted)]">Moyenne mensuelle observée</p><p className="mt-2 text-2xl font-black">{formatCurrency(average)}</p></div><div className="p-6"><p className="text-sm text-[var(--color-muted)]">Période</p><p className="mt-2 font-black capitalize">{formatMonth(months[0])} — {formatMonth(months.at(-1)!)}</p></div></section><section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><div className="card p-5"><h2 className="text-xl font-black">Évolution</h2><div className="h-[290px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend.map((entry) => ({ ...entry, label: formatShortMonth(entry.month) }))}><XAxis dataKey="label" /><YAxis width={58} tickFormatter={formatCompactCurrency} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Area dataKey="expenses" stroke="#52766f" fill="#dce8e3" /></AreaChart></ResponsiveContainer></div></div><div className="card p-5"><h2 className="text-xl font-black">Vie courante / événements</h2>{contexts.map((entry) => <div key={entry.name} className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></div>)}</div></section><section className="card mt-5 p-5"><h2 className="text-xl font-black">Principales familles</h2>{categories.slice(0, 10).map((entry) => <div key={entry.name} className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"><span>{entry.name}</span><span>{formatCurrency(entry.value)}</span></div>)}</section><Link href={operationsHref} className="button-primary mt-5">Voir les opérations<ArrowRight size={16} /></Link></>;
}

