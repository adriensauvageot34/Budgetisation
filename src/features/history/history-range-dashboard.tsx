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
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  House,
  RotateCcw,
  Sparkles,
  TrendingDown,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  MonthRangeTimeline,
  type TimelineEventMarker,
} from "@/components/ui/month-timeline";
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
  categoryReferenceDeltas,
  dimensionBreakdown,
  dimensionHistoryProfiles,
  eventGroups,
  historySeriesProfile,
  historyVariationGrid,
  monthlySpendingContexts,
  spendingContextBreakdown,
  type HistoryDimension,
} from "@/domain/history-analysis";
import {
  getCategoryIcon,
  getEventIcon,
  getFamilyIcon,
  historyPresentationIcons,
} from "@/domain/history-icons";
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

type DetailHref = (
  patch: Partial<HistoryFilters>,
  label: string,
) => string;

type MoneyMeasure = "average" | "total" | "share";
type NatureView = "importance" | "status";

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

function dimensionFilterKey(dimension: HistoryDimension): keyof HistoryFilters {
  if (dimension === "category") return "families";
  if (dimension === "subcategory") return "categories";
  if (dimension === "importance") return "importances";
  if (dimension === "recurrence") return "recurrences";
  return "statuses";
}

function dimensionIcon(dimension: HistoryDimension, name: string) {
  if (dimension === "category") return getFamilyIcon(name);
  if (dimension === "subcategory") return getCategoryIcon(name);
  return historyPresentationIcons.fallback;
}

function IconBubble({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e7efeb] text-[var(--color-primary)]">
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

function Facet({
  label,
  values,
  options,
  onChange,
  labels,
  iconFor,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  labels?: Record<string, string>;
  iconFor?: (value: string) => LucideIcon;
}) {
  if (!options.length) return null;
  return (
    <details className="relative">
      <summary className="button-secondary cursor-pointer list-none text-sm">
        {label}{values.length ? ` · ${values.length}` : ""}
      </summary>
      <div className="absolute left-0 z-30 mt-2 max-h-72 min-w-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-[var(--shadow-md)]">
        {options.map((option) => {
          const Icon = iconFor?.(option);
          return (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--color-surface-soft)]"
            >
              <input
                type="checkbox"
                checked={values.includes(option)}
                onChange={() => onChange(toggleValue(values, option))}
              />
              {Icon ? <Icon size={15} aria-hidden="true" /> : null}
              <span>{labels?.[option] ?? option}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function formatWeekLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))}–${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

function DetailBreadcrumb({
  start,
  end,
  filters,
  label,
}: {
  start: MonthKey;
  end: MonthKey;
  filters: HistoryFilters;
  label: string;
}) {
  const eventLabel = filters.eventDetails[0] ?? filters.events[0];
  const family = filters.families[0];
  const category = filters.categories[0];
  const EventIcon = getEventIcon(filters.events[0]);
  const FamilyIcon = getFamilyIcon(family);
  const CategoryIcon = getCategoryIcon(category, family);
  const eventOverviewFilters: HistoryFilters = {
    ...filters,
    families: [],
    categories: [],
    contexts: ["events"],
    events: [],
    eventDetails: [],
  };
  const periodLabel = start === end
    ? formatMonth(start)
    : `${formatMonth(start)} — ${formatMonth(end)}`;
  return (
    <nav
      className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]"
      aria-label="Fil d’Ariane"
    >
      <Link href={buildHistoryHref(start, end, filters)}>Historique</Link>
      <ChevronRight size={14} aria-hidden="true" />
      <span className="capitalize">{periodLabel}</span>
      {eventLabel ? (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <Link
            href={buildHistoryHref(start, end, eventOverviewFilters, {
              active: true,
              label: "Événements",
            })}
            className="inline-flex items-center gap-1.5"
          >
            <Sparkles size={15} aria-hidden="true" />
            Événements
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
            <EventIcon size={15} aria-hidden="true" />
            {eventLabel}
          </span>
        </>
      ) : null}
      {family ? (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
            <FamilyIcon size={15} aria-hidden="true" />
            {family}
          </span>
        </>
      ) : null}
      {category ? (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
            <CategoryIcon size={15} aria-hidden="true" />
            {category}
          </span>
        </>
      ) : null}
      {!eventLabel && !family && !category ? (
        <>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="font-bold text-[var(--color-ink)]">{label}</span>
        </>
      ) : null}
    </nav>
  );
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
    router.replace(
      buildHistoryHref(normalizedStart, normalizedEnd, defaultHistoryFilters),
    );
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
  const timelineEvents = useMemo(() => {
    const result: Partial<Record<MonthKey, TimelineEventMarker[]>> = {};
    for (const month of months) {
      const groups = eventGroups(
        operations.filter((operation) => operation.importMonth === month),
        operations,
      );
      if (groups.length) {
        result[month] = groups.map((entry) => {
          const label = entry.eventDetail ?? entry.event;
          return {
            id: `${entry.event}-${entry.eventDetail ?? ""}`,
            event: entry.event,
            label,
            title: `${label}\n${entry.event}\n${formatCurrency(entry.value)}`,
          };
        });
      }
    }
    return result;
  }, [months, operations]);

  function changeDraft<K extends keyof HistoryFilters>(
    key: K,
    values: HistoryFilters[K],
  ) {
    const next = cleanHistoryFilters(periodOperations, {
      ...draft,
      [key]: values,
    });
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
    ? buildHistoryHref(
        start!,
        end!,
        applied,
        initialContext.detail
          ? { active: true, label: initialContext.detailLabel }
          : undefined,
      )
    : "/historique";
  const operationLink = complete
    ? operationsHref(start!, end!, applied, currentHref)
    : "/operations";

  function detailHref(patch: Partial<HistoryFilters>, label: string) {
    const next = cleanHistoryFilters(periodOperations, { ...applied, ...patch });
    return buildHistoryHref(start!, end!, next, { active: true, label });
  }

  function monthDetailHref(
    month: MonthKey,
    patch: Partial<HistoryFilters>,
    label: string,
  ) {
    const monthOperations = operationsInHistoryPeriod(operations, month, month);
    const next = cleanHistoryFilters(monthOperations, { ...applied, ...patch });
    return buildHistoryHref(month, month, next, { active: true, label });
  }

  function selectTimelineEvent(month: MonthKey, marker: TimelineEventMarker) {
    const eventStart = complete ? start! : month;
    const eventEnd = complete ? end! : month;
    const baseFilters = complete ? applied : defaultHistoryFilters;
    const eventDetail = marker.label === marker.event ? [] : [marker.label];
    const next = {
      ...baseFilters,
      contexts: ["events" as const],
      events: [marker.event],
      eventDetails: eventDetail,
    };
    router.replace(
      buildHistoryHref(eventStart, eventEnd, next, {
        active: true,
        label: marker.label,
      }),
    );
  }

  const expenseFacetVisible = draft.flows.includes("expenses");
  const inflowFacetVisible = draft.flows.includes("inflows");
  const modificationsPending = !sameFilters(draft, applied);

  return (
    <div>
      <PageHeader
        eyebrow="La mémoire financière de notre vie"
        title="Historique"
        description="Choisissez une période, repérez ce qui l’a marquée et descendez jusqu’aux opérations."
      />

      {initialContext.detail && complete ? (
        <DetailBreadcrumb
          start={start!}
          end={end!}
          filters={applied}
          label={initialContext.detailLabel ?? "Analyse ciblée"}
        />
      ) : null}

      <MonthRangeTimeline
        months={months}
        start={selecting ? undefined : start}
        end={selecting ? undefined : end}
        pendingStart={pendingStart}
        eventsByMonth={timelineEvents}
        onSelect={selectMonth}
        onEventSelect={selectTimelineEvent}
        onClear={clearPeriod}
      />

      {!complete ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          <p>
            {pendingStart
              ? `Début sélectionné : ${formatMonth(pendingStart)}. Choisissez maintenant la fin.`
              : "Sélectionnez un mois de début puis un mois de fin."}
          </p>
          <p className="mt-1">
            Sélectionnez deux fois le même mois pour analyser un seul mois.
          </p>
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
                onChange={(values) =>
                  changeDraft("flows", values as HistoryFlow[])
                }
              />
              {expenseFacetVisible ? (
                <>
                  <Facet
                    label="Famille"
                    values={draft.families}
                    options={facets.families}
                    iconFor={getFamilyIcon}
                    onChange={(values) => changeDraft("families", values)}
                  />
                  {draft.families.length ? (
                    <Facet
                      label="Catégorie"
                      values={draft.categories}
                      options={facets.categories}
                      iconFor={(value) =>
                        getCategoryIcon(value, draft.families[0])
                      }
                      onChange={(values) => changeDraft("categories", values)}
                    />
                  ) : null}
                  <Facet
                    label="Statut"
                    values={draft.statuses}
                    options={facets.statuses}
                    onChange={(values) =>
                      changeDraft("statuses", values as AnalyticalStatus[])
                    }
                  />
                  <Facet
                    label="Contexte"
                    values={draft.contexts}
                    options={facets.contexts}
                    labels={{
                      current: "Vie courante",
                      events: "Événement",
                      unconfirmed: "À confirmer",
                    }}
                    onChange={(values) =>
                      changeDraft("contexts", values as HistoryContext[])
                    }
                  />
                  {draft.contexts.includes("events") ? (
                    <Facet
                      label="Événement"
                      values={draft.events}
                      options={facets.events}
                      iconFor={getEventIcon}
                      onChange={(values) => changeDraft("events", values)}
                    />
                  ) : null}
                  {draft.contexts.includes("events") &&
                  draft.events.length &&
                  facets.eventDetails.length ? (
                    <Facet
                      label="Spécification"
                      values={draft.eventDetails}
                      options={facets.eventDetails}
                      iconFor={() => getEventIcon(draft.events[0])}
                      onChange={(values) =>
                        changeDraft("eventDetails", values)
                      }
                    />
                  ) : null}
                </>
              ) : null}
              <Facet
                label="Tiers"
                values={draft.merchants}
                options={facets.merchants}
                onChange={(values) => changeDraft("merchants", values)}
              />
              {inflowFacetVisible ? (
                <Facet
                  label="Type d’entrée"
                  values={draft.resourceTypes}
                  options={facets.resourceTypes}
                  onChange={(values) =>
                    changeDraft("resourceTypes", values as ResourceType[])
                  }
                />
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <p
                className={`text-sm font-bold ${
                  modificationsPending
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-muted)]"
                }`}
              >
                {modificationsPending
                  ? "Modifications non appliquées"
                  : "Filtres appliqués"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setDraft(defaultHistoryFilters)}
                >
                  <RotateCcw size={15} /> Réinitialiser
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!modificationsPending || !draft.flows.length}
                  onClick={applyFilters}
                >
                  Appliquer les filtres
                </button>
              </div>
            </div>
          </section>

          {initialContext.detail ? (
            <TargetedAnalysis
              operations={filtered}
              periodOperations={periodOperations}
              allOperations={operations}
              months={selectedMonths}
              label={initialContext.detailLabel ?? "Analyse ciblée"}
              filters={applied}
              detailHref={detailHref}
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
              monthDetailHref={monthDetailHref}
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
  const [granularity, setGranularity] = useState<"month" | "week">(
    monthlyChoice ? "month" : "week",
  );
  const monthly = monthlySummaries(operations, months, allOperations).map(
    (entry) => ({ ...entry, label: formatShortMonth(entry.month) }),
  );
  const weekly = weeklyExpenseSummaries(
    operations,
    start,
    end,
    allOperations,
  ).map((entry) => ({
    ...entry,
    label: formatWeekLabel(entry.weekStart, entry.weekEnd),
  }));
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Évolution</p>
          <h2 className="text-xl font-black">
            {granularity === "month"
              ? "Le rythme de la période"
              : start === end
                ? "Le rythme du mois"
                : "Dépenses nettes par semaine"}
          </h2>
        </div>
        {monthlyChoice ? (
          <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-1">
            {(["month", "week"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGranularity(value)}
                className={`rounded-md px-3 py-2 text-xs font-black ${
                  granularity === value
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-muted)]"
                }`}
              >
                {value === "month" ? "Par mois" : "Par semaine"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {granularity === "month" ? (
            <AreaChart data={monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis
                width={58}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompactCurrency}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Area
                dataKey="expenses"
                name="Dépenses nettes"
                stroke="#d36e53"
                fill="#f6dfd8"
              />
              {hasInflows ? (
                <>
                  <Area
                    dataKey="income"
                    name="Revenus"
                    stroke="#52766f"
                    fill="#dce8e3"
                  />
                  <Area
                    dataKey="otherInflows"
                    name="Autres entrées"
                    stroke="#d69a3c"
                    fill="#f6ead2"
                  />
                </>
              ) : null}
            </AreaChart>
          ) : (
            <BarChart data={weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis
                width={58}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompactCurrency}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar
                dataKey="expenses"
                name="Dépenses nettes"
                fill="#52766f"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SpendingContextChart({
  operations,
  months,
  allOperations,
}: {
  operations: Operation[];
  months: MonthKey[];
  allOperations: Operation[];
}) {
  const rows = monthlySpendingContexts(operations, months, allOperations).map(
    (entry) => ({ ...entry, label: formatShortMonth(entry.month) }),
  );
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <IconBubble icon={House} />
        <div>
          <p className="eyebrow mb-1">Contexte</p>
          <h2 className="text-xl font-black">Vie courante et événements</h2>
        </div>
      </div>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis width={58} tickFormatter={formatCompactCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar
              dataKey="current"
              name="Vie courante"
              stackId="context"
              fill="#52766f"
            />
            <Bar
              dataKey="events"
              name="Événements"
              stackId="context"
              fill="#d69a3c"
            />
            {rows.some((entry) => entry.unconfirmed > 0) ? (
              <Bar
                dataKey="unconfirmed"
                name="À confirmer"
                stackId="context"
                fill="#d36e53"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <span className="block h-8 w-20" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={values.map((value, index) => ({ index, value }))}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="#52766f"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span>
  );
}

function PortraitCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex min-h-36 flex-col justify-between border-b border-[var(--color-border)] p-5 sm:border-r">
      <div className="flex items-center gap-3">
        <IconBubble icon={icon} />
        <p className="text-sm font-bold text-[var(--color-muted)]">{label}</p>
      </div>
      <div className="mt-4">
        <p className="text-xl font-black">{value}</p>
        {detail ? (
          <p className="mt-1 text-xs text-[var(--color-muted)]">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function MoneyDestinationModule({
  operations,
  months,
  allOperations,
  detailHref,
  title = "Où va notre argent ?",
  monthly = false,
  referenceDeltas = [],
}: {
  operations: Operation[];
  months: MonthKey[];
  allOperations: Operation[];
  detailHref: DetailHref;
  title?: string;
  monthly?: boolean;
  referenceDeltas?: Array<{ name: string; reference: number; delta: number }>;
}) {
  const [dimension, setDimension] = useState<HistoryDimension>("category");
  const [measure, setMeasure] = useState<MoneyMeasure>(
    monthly ? "total" : "average",
  );
  const profiles = dimensionHistoryProfiles(
    operations,
    months,
    dimension,
    allOperations,
  );
  const total = profiles.reduce((sum, entry) => sum + entry.total, 0);
  const metric = (entry: (typeof profiles)[number]) => {
    if (measure === "average") return entry.average;
    if (measure === "share") return total ? entry.total / total : 0;
    return entry.total;
  };
  const max = Math.max(...profiles.map(metric), 1);
  const filterKey = dimensionFilterKey(dimension);
  const measureLabel =
    measure === "average"
      ? "Moyenne mensuelle"
      : measure === "total"
        ? "Total période"
        : "Part des dépenses";
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBubble icon={WalletCards} />
          <div>
            <p className="eyebrow mb-1">Composition</p>
            <h2 className="text-xl font-black">{title}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Dimension
            <select
              className="field mt-1 block text-sm"
              value={dimension}
              onChange={(event) =>
                setDimension(event.target.value as HistoryDimension)
              }
            >
              <option value="category">Famille</option>
              <option value="subcategory">Catégorie</option>
              <option value="importance">Importance</option>
              <option value="status">Statut</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--color-muted)]">
            Mesure
            <select
              className="field mt-1 block text-sm"
              value={measure}
              onChange={(event) => setMeasure(event.target.value as MoneyMeasure)}
            >
              <option value="average">Moyenne mensuelle</option>
              <option value="total">Total période</option>
              <option value="share">Part des dépenses</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {profiles.slice(0, 12).map((entry) => {
          const Icon = dimensionIcon(dimension, entry.name);
          const value = metric(entry);
          const share = total ? entry.total / total : 0;
          const reference = referenceDeltas.find(
            (candidate) => candidate.name === entry.name,
          );
          const valueLabel =
            measure === "share"
              ? formatPercent(value)
              : `${formatCurrency(value)}${measure === "average" ? "/mois" : ""}`;
          const tooltip = [
            entry.name,
            `${measureLabel} : ${valueLabel}`,
            `Part : ${formatPercent(share)}`,
            reference ? `Référence : ${formatCurrency(reference.reference)}` : null,
            reference ? `Écart : ${formatCurrency(reference.delta, true)}` : null,
            entry.stability ? `Stabilité : ${entry.stability.label}` : null,
            "Cliquer pour explorer",
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <Link
              key={entry.name}
              href={detailHref({ [filterKey]: [entry.name] }, entry.name)}
              title={tooltip}
              className="group block rounded-xl border border-transparent bg-[var(--color-surface-soft)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] focus-visible:outline focus-visible:outline-2"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-primary)]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3 text-sm font-black">
                    <span className="truncate">{entry.name}</span>
                    <span className="shrink-0">{valueLabel}</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white">
                    <span
                      className="block h-full rounded-full bg-[var(--color-primary)] transition"
                      style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
                    />
                  </span>
                </span>
                {(dimension === "category" || dimension === "subcategory") &&
                months.length > 1 ? (
                  <Sparkline values={entry.values} />
                ) : null}
                <ChevronRight
                  size={17}
                  className="text-[var(--color-muted)] transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NatureModule({
  operations,
  allOperations,
  detailHref,
}: {
  operations: Operation[];
  allOperations: Operation[];
  detailHref: DetailHref;
}) {
  const [view, setView] = useState<NatureView>("importance");
  const rows = (view === "importance"
    ? importanceBreakdown(operations, allOperations)
    : statusBreakdown(operations, allOperations)
  ).filter((entry) => entry.value > 0);
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBubble icon={Gauge} />
          <div>
            <p className="eyebrow mb-1">Lecture</p>
            <h2 className="text-xl font-black">Nature de nos dépenses</h2>
          </div>
        </div>
        <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-1">
          {(["importance", "status"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded-md px-3 py-2 text-xs font-black ${
                view === value
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {value === "importance" ? "Marge de manœuvre" : "Rythme"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
        <div className="h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="84%"
                paddingAngle={3}
              >
                {rows.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((entry, index) => {
            const patch: Partial<HistoryFilters> =
              view === "importance"
                ? {
                    importances: [
                      entry.name as HistoryFilters["importances"][number],
                    ],
                  }
                : {
                    statuses: [
                      entry.name as HistoryFilters["statuses"][number],
                    ],
                  };
            return (
              <Link
                key={entry.name}
                href={detailHref(patch, entry.name)}
                className="rounded-xl border border-[var(--color-border)] p-3 transition hover:border-[var(--color-primary)]"
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  {entry.name}
                </span>
                <span className="mt-1 block font-black">
                  {formatCurrency(entry.value)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EventGallery({
  operations,
  allOperations,
  detailHref,
  title = "Événements de la période",
}: {
  operations: Operation[];
  allOperations: Operation[];
  detailHref: DetailHref;
  title?: string;
}) {
  const events = eventGroups(operations, allOperations);
  if (!events.length) return null;
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <IconBubble icon={Sparkles} />
        <div>
          <p className="eyebrow mb-1">Souvenirs financiers</p>
          <h2 className="text-xl font-black">{title}</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events.slice(0, 9).map((entry) => {
          const Icon = getEventIcon(entry.event);
          const label = entry.eventDetail ?? entry.event;
          return (
            <Link
              key={`${entry.event}-${entry.eventDetail ?? ""}`}
              href={detailHref(
                {
                  contexts: ["events"],
                  events: [entry.event],
                  eventDetails: entry.eventDetail ? [entry.eventDetail] : [],
                },
                label,
              )}
              className="group rounded-2xl border border-[var(--color-border)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-warning)] focus-visible:outline focus-visible:outline-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f6ead2] text-[var(--color-warning)]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="font-black">{formatCurrency(entry.value)}</span>
              </div>
              <p className="mt-4 font-black">{label}</p>
              <p className="text-sm text-[var(--color-muted)]">{entry.event}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {formatDate(entry.firstDate)} — {formatDate(entry.lastDate)} · {entry.count} opération{entry.count > 1 ? "s" : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function VariationHeatmap({
  operations,
  months,
  allOperations,
  monthDetailHref,
}: {
  operations: Operation[];
  months: MonthKey[];
  allOperations: Operation[];
  monthDetailHref: (
    month: MonthKey,
    patch: Partial<HistoryFilters>,
    label: string,
  ) => string;
}) {
  if (months.length < 4) return null;
  const rows = historyVariationGrid(operations, months, allOperations).slice(0, 12);
  return (
    <details className="card mb-5 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-black focus-visible:outline focus-visible:outline-2">
        <span className="flex items-center gap-3">
          <IconBubble icon={ChartNoAxesCombined} />
          <span>
            <span className="block">Voir les variations dans le temps</span>
            <span className="mt-1 block text-xs font-normal text-[var(--color-muted)]">
              Intensité = écart au niveau moyen de chaque famille
            </span>
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </summary>
      <div className="overflow-x-auto border-t border-[var(--color-border)] p-5">
        <div
          className="grid min-w-max gap-1 text-xs"
          style={{
            gridTemplateColumns: `minmax(150px, 1fr) repeat(${months.length}, minmax(72px, 0.55fr))`,
          }}
        >
          <span />
          {months.map((month) => (
            <span
              key={month}
              className="px-1 pb-2 text-center font-bold capitalize text-[var(--color-muted)]"
            >
              {formatShortMonth(month)}
            </span>
          ))}
          {rows.flatMap((row) => {
            const Icon = getFamilyIcon(row.name);
            return [
              <span
                key={`${row.name}-label`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 font-bold"
              >
                <Icon size={15} aria-hidden="true" />
                {row.name}
              </span>,
              ...row.cells.map((cell) => {
                const alpha = Math.min(0.78, 0.12 + Math.abs(cell.intensity) * 0.62);
                const backgroundColor =
                  Math.abs(cell.intensity) < 0.08
                    ? "#edf0ed"
                    : cell.intensity > 0
                      ? `rgba(211, 110, 83, ${alpha})`
                      : `rgba(82, 118, 111, ${alpha})`;
                return (
                  <Link
                    key={`${row.name}-${cell.month}`}
                    href={monthDetailHref(
                      cell.month,
                      { families: [row.name] },
                      row.name,
                    )}
                    title={`${row.name}\n${formatMonth(cell.month)}\nMontant : ${formatCurrency(cell.value)}\nRéférence : ${formatCurrency(row.reference)}\nÉcart : ${formatCurrency(cell.delta, true)}`}
                    className="rounded-lg px-2 py-2 text-center font-black transition hover:ring-2 hover:ring-[var(--color-primary)] focus-visible:outline focus-visible:outline-2"
                    style={{ backgroundColor }}
                  >
                    {formatCompactCurrency(cell.value)}
                  </Link>
                );
              }),
            ];
          })}
        </div>
      </div>
    </details>
  );
}

function MultiMonthAnalysis({
  months,
  operations,
  allOperations,
  hasInflows,
  detailHref,
  monthDetailHref,
  operationsHref,
}: {
  months: MonthKey[];
  operations: Operation[];
  allOperations: Operation[];
  hasInflows: boolean;
  detailHref: DetailHref;
  monthDetailHref: (
    month: MonthKey,
    patch: Partial<HistoryFilters>,
    label: string,
  ) => string;
  operationsHref: string;
}) {
  const summaries = monthlySummaries(operations, months, allOperations);
  const stats = descriptiveStats(summaries);
  const contextByMonth = monthlySpendingContexts(operations, months, allOperations);
  const currentAverage = mean(contextByMonth.map((entry) => entry.current));
  const eventTotal = contextByMonth.reduce((sum, entry) => sum + entry.events, 0);
  const exceptional = totalExpenses(
    operations.filter((operation) => operation.status === "Exceptionnel"),
    allOperations,
  );
  const variableProfile = dimensionHistoryProfiles(
    operations,
    months,
    "category",
    allOperations,
  )
    .filter((entry) => entry.stability)
    .sort(
      (a, b) =>
        (b.stability?.coefficient ?? 0) - (a.stability?.coefficient ?? 0),
    )[0];
  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className="border-b border-[var(--color-border)] p-5">
          <p className="eyebrow mb-1">Portrait</p>
          <h2 className="text-2xl font-black">Votre période en un coup d’œil</h2>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          <PortraitCard
            icon={CircleDollarSign}
            label="Dépenses moyennes"
            value={`${formatCurrency(stats.average)}/mois`}
            detail={`Médiane : ${formatCurrency(stats.median)}`}
          />
          <PortraitCard
            icon={House}
            label="Vie courante moyenne"
            value={`${formatCurrency(currentAverage)}/mois`}
          />
          <PortraitCard
            icon={Sparkles}
            label="Événements"
            value={formatCurrency(eventTotal)}
            detail="Total réel sur la période"
          />
          <PortraitCard
            icon={BadgeAlert}
            label="Exceptionnel"
            value={formatCurrency(exceptional)}
            detail="Total réel sur la période"
          />
          <PortraitCard
            icon={TrendingDown}
            label="Mois le plus léger"
            value={formatMonth(stats.best.month)}
            detail={formatCurrency(stats.best.expenses)}
          />
          {variableProfile ? (
            <PortraitCard
              icon={getFamilyIcon(variableProfile.name)}
              label="Poste le plus variable"
              value={variableProfile.name}
              detail={variableProfile.stability?.label}
            />
          ) : (
            <PortraitCard
              icon={CalendarRange}
              label="Mois le plus chargé"
              value={formatMonth(stats.worst.month)}
              detail={formatCurrency(stats.worst.expenses)}
            />
          )}
        </div>
      </section>
      <EvolutionChart
        operations={operations}
        allOperations={allOperations}
        months={months}
        start={months[0]}
        end={months.at(-1)!}
        hasInflows={hasInflows}
      />
      <SpendingContextChart
        operations={operations}
        months={months}
        allOperations={allOperations}
      />
      <MoneyDestinationModule
        operations={operations}
        months={months}
        allOperations={allOperations}
        detailHref={detailHref}
      />
      <NatureModule
        operations={operations}
        allOperations={allOperations}
        detailHref={detailHref}
      />
      <EventGallery
        operations={operations}
        allOperations={allOperations}
        detailHref={detailHref}
      />
      <VariationHeatmap
        operations={operations}
        months={months}
        allOperations={allOperations}
        monthDetailHref={monthDetailHref}
      />
      <Link href={operationsHref} className="button-primary">
        Voir les opérations <ArrowRight size={16} />
      </Link>
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
  detailHref: DetailHref;
  operationsHref: string;
}) {
  const [showAllDeltas, setShowAllDeltas] = useState(false);
  const summary = monthlySummaries(operations, [month], allOperations)[0];
  const references = monthlySummaries(referenceOperations, months, allOperations);
  const average = mean(references.map((entry) => entry.expenses));
  const previous = references[months.indexOf(month) - 1]?.expenses ?? summary.expenses;
  const deltas = categoryReferenceDeltas(
    referenceOperations,
    month,
    months,
    allOperations,
  );
  const events = eventGroups(operations, allOperations);
  const highlights = [
    ...deltas.slice(0, events.length ? 2 : 3).map((entry) => ({
      key: entry.name,
      icon: getFamilyIcon(entry.name),
      title: formatCurrency(entry.delta, true),
      label: entry.name,
      description:
        entry.delta >= 0
          ? `${entry.name} est au-dessus de sa référence.`
          : `${entry.name} est sous sa référence habituelle.`,
      href: detailHref({ families: [entry.name] }, entry.name),
    })),
    ...events.slice(0, 1).map((entry) => {
      const label = entry.eventDetail ?? entry.event;
      return {
        key: `${entry.event}-${entry.eventDetail ?? ""}`,
        icon: getEventIcon(entry.event),
        title: label,
        label: entry.event,
        description: "Principal événement du mois.",
        href: detailHref(
          {
            contexts: ["events"],
            events: [entry.event],
            eventDetails: entry.eventDetail ? [entry.eventDetail] : [],
          },
          label,
        ),
      };
    }),
  ].slice(0, 4);
  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className={`grid ${hasInflows ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}>
          <div className="bg-[var(--color-primary)] p-6 text-white sm:p-8">
            <p className="text-sm font-bold text-white/70">Dépenses nettes</p>
            <p className="mt-2 text-5xl font-black">
              {formatCurrency(summary.expenses)}
            </p>
            <div className="mt-5 flex flex-wrap gap-4 border-t border-white/20 pt-4 text-sm">
              <span>
                vs moyenne {formatPercent(average ? (summary.expenses - average) / average : 0, true)}
              </span>
              <span>
                vs mois précédent {formatPercent(previous ? (summary.expenses - previous) / previous : 0, true)}
              </span>
            </div>
          </div>
          {hasInflows ? (
            <div className="grid sm:grid-cols-3 lg:grid-cols-1">
              <div className="p-5">
                <p className="text-sm text-[var(--color-muted)]">Revenus</p>
                <p className="text-xl font-black">{formatCurrency(summary.income)}</p>
              </div>
              <div className="p-5">
                <p className="text-sm text-[var(--color-muted)]">Autres entrées</p>
                <p className="text-xl font-black">{formatCurrency(summary.otherInflows)}</p>
              </div>
              <div className="p-5">
                <p className="text-sm text-[var(--color-muted)]">Résultat analytique</p>
                <p className="text-xl font-black">{formatCurrency(summary.net, true)}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card mb-5 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <IconBubble icon={Sparkles} />
          <div>
            <p className="eyebrow mb-1">Résumé du mois</p>
            <h2 className="text-xl font-black capitalize">
              Ce qui a marqué {formatMonth(month)}
            </h2>
          </div>
        </div>
        {highlights.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {highlights.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  className="rounded-xl border border-[var(--color-border)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]"
                >
                  <div className="flex items-center gap-3">
                    <IconBubble icon={Icon} />
                    <div>
                      <p className="font-black">{entry.title}</p>
                      <p className="text-sm text-[var(--color-muted)]">{entry.label}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{entry.description}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            La référence disponible ne permet pas encore d’isoler un écart significatif.
          </p>
        )}
        {deltas.length ? (
          <button
            type="button"
            className="button-secondary mt-4"
            onClick={() => setShowAllDeltas((value) => !value)}
          >
            {showAllDeltas ? "Masquer les écarts" : "Voir tous les écarts"}
          </button>
        ) : null}
        {showAllDeltas ? (
          <div className="mt-4 h-[310px] border-t border-[var(--color-border)] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deltas.slice(0, 10)}
                layout="vertical"
                onClick={(event) => {
                  const row = event?.activePayload?.[0]?.payload as
                    | { name?: string }
                    | undefined;
                  if (row?.name) {
                    window.location.assign(
                      detailHref({ families: [row.name] }, row.name),
                    );
                  }
                }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={formatCompactCurrency} />
                <YAxis type="category" dataKey="name" width={135} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), true)} />
                <Bar dataKey="delta" name="Écart" cursor="pointer">
                  {deltas.slice(0, 10).map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.delta >= 0 ? "#d36e53" : "#52766f"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </section>

      <EvolutionChart
        operations={operations}
        allOperations={allOperations}
        months={[month]}
        start={month}
        end={month}
        hasInflows={false}
        monthlyChoice={false}
      />
      <MoneyDestinationModule
        operations={operations}
        months={[month]}
        allOperations={allOperations}
        detailHref={detailHref}
        title="Où est parti l’argent ?"
        monthly
        referenceDeltas={deltas}
      />
      <SpendingContextSummary
        operations={operations}
        allOperations={allOperations}
        detailHref={detailHref}
      />
      <NatureModule
        operations={operations}
        allOperations={allOperations}
        detailHref={detailHref}
      />
      <EventGallery
        operations={operations}
        allOperations={allOperations}
        detailHref={detailHref}
        title="Événements du mois"
      />
      <Link href={operationsHref} className="button-primary">
        Voir les opérations de {formatMonth(month)} <ArrowRight size={16} />
      </Link>
    </>
  );
}

function SpendingContextSummary({
  operations,
  allOperations,
  detailHref,
}: {
  operations: Operation[];
  allOperations: Operation[];
  detailHref: DetailHref;
}) {
  const rows = spendingContextBreakdown(operations, allOperations).filter(
    (entry) => entry.value > 0,
  );
  return (
    <section className="card mb-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <IconBubble icon={House} />
        <h2 className="text-xl font-black">Vie courante et événements du mois</h2>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {rows.map((entry) => (
          <Link
            key={entry.name}
            href={detailHref(
              {
                contexts: [
                  entry.name === "Vie courante"
                    ? "current"
                    : entry.name === "Événement"
                      ? "events"
                      : "unconfirmed",
                ],
              },
              entry.name,
            )}
            className="rounded-xl bg-[var(--color-surface-soft)] p-4 transition hover:border-[var(--color-primary)]"
          >
            <span className="text-sm font-bold text-[var(--color-muted)]">
              {entry.name}
            </span>
            <span className="mt-1 block font-black">
              {formatCurrency(entry.value)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TargetedAnalysis({
  operations,
  periodOperations,
  allOperations,
  months,
  label,
  filters,
  detailHref,
  operationsHref,
}: {
  operations: Operation[];
  periodOperations: Operation[];
  allOperations: Operation[];
  months: MonthKey[];
  label: string;
  filters: HistoryFilters;
  detailHref: DetailHref;
  operationsHref: string;
}) {
  const eventMode = Boolean(filters.events.length || filters.eventDetails.length);
  const family = filters.families[0];
  const category = filters.categories[0];
  const eventRoot = eventMode && !family && !category;
  const Icon = eventRoot
    ? getEventIcon(filters.events[0])
    : category
      ? getCategoryIcon(category, family)
      : getFamilyIcon(family ?? label);
  const profile = historySeriesProfile(operations, months, allOperations);
  const periodTotal = totalExpenses(periodOperations, allOperations);
  const share = periodTotal ? profile.total / periodTotal : 0;
  const contexts = spendingContextBreakdown(operations, allOperations).filter(
    (entry) => entry.value > 0,
  );
  const sortedOperations = [...operations].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const eventDates = eventMode && sortedOperations.length
    ? `${formatDate(sortedOperations[0].date)} — ${formatDate(sortedOperations.at(-1)!.date)}`
    : null;
  const childDimension: HistoryDimension = eventRoot
    ? "category"
    : family && !category
      ? "subcategory"
      : "category";
  const children = category
    ? [...new Set(operations.map((operation) => operation.preciseType).filter(Boolean))]
        .map((name) => ({
          name: name as string,
          value: totalExpenses(
            operations.filter((operation) => operation.preciseType === name),
            allOperations,
          ),
        }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
    : dimensionBreakdown(operations, childDimension, allOperations);
  return (
    <>
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-col justify-between gap-5 bg-[var(--color-primary)] p-6 text-white sm:flex-row sm:items-end sm:p-8">
          <div>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
              <Icon size={29} aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm font-bold text-white/70">
              {eventRoot
                ? filters.events[0] ?? "Événement"
                : eventMode
                  ? `Dans ${filters.eventDetails[0] ?? filters.events[0]}`
                  : "Fiche d’identité"}
            </p>
            <h1 className="mt-1 text-3xl font-black">{label}</h1>
            {eventDates ? (
              <p className="mt-2 text-sm text-white/75">
                {eventDates} · {operations.length} opération{operations.length > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-bold text-white/70">
              {eventMode ? "Coût net" : "Total période"}
            </p>
            <p className="mt-1 text-4xl font-black">
              {formatCurrency(profile.total)}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <PortraitCard
            icon={CircleDollarSign}
            label="Moyenne mensuelle"
            value={`${formatCurrency(profile.average)}/mois`}
          />
          <PortraitCard
            icon={WalletCards}
            label="Part des dépenses"
            value={formatPercent(share)}
          />
          {profile.stability ? (
            <PortraitCard
              icon={ChartNoAxesCombined}
              label="Stabilité observée"
              value={profile.stability.label}
            />
          ) : null}
          {profile.frequency ? (
            <PortraitCard
              icon={CalendarRange}
              label="Fréquence observée"
              value={profile.frequency.label}
              detail={`${profile.frequency.activeMonths} mois sur ${months.length}`}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="card p-5">
          <h2 className="text-xl font-black">Évolution</h2>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={months.map((month, index) => ({
                  month,
                  label: formatShortMonth(month),
                  value: profile.values[index],
                }))}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis width={58} tickFormatter={formatCompactCurrency} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="value" name="Montant net" stroke="#52766f" fill="#dce8e3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-xl font-black">Vie courante / événements</h2>
          <div className="mt-4 space-y-2">
            {contexts.map((entry) => (
              <div
                key={entry.name}
                className="rounded-xl bg-[var(--color-surface-soft)] p-3"
              >
                <div className="flex justify-between gap-2 text-sm font-bold">
                  <span>{entry.name}</span>
                  <span>{formatCurrency(entry.value)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {formatPercent(profile.total ? entry.value / profile.total : 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {children.length ? (
        <section className="card mt-5 p-5">
          <h2 className="text-xl font-black">
            {eventRoot
              ? "Ce qui a composé cet événement"
              : category
                ? "Types précis observés"
                : "Composantes principales"}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {children.slice(0, 12).map((entry) => {
              const ChildIcon = eventRoot
                ? getFamilyIcon(entry.name)
                : getCategoryIcon(entry.name, family);
              const content = (
                <>
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-white text-[var(--color-primary)]">
                      <ChildIcon size={18} aria-hidden="true" />
                    </span>
                    <span className="font-bold">{entry.name}</span>
                  </span>
                  <span className="font-black">{formatCurrency(entry.value)}</span>
                </>
              );
              if (category) {
                return (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between rounded-xl bg-[var(--color-surface-soft)] p-3"
                  >
                    {content}
                  </div>
                );
              }
              const patch = eventRoot
                ? { families: [entry.name] }
                : { categories: [entry.name] };
              return (
                <Link
                  key={entry.name}
                  href={detailHref(patch, entry.name)}
                  className="flex items-center justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 transition hover:border-[var(--color-primary)]"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      <Link href={operationsHref} className="button-primary mt-5">
        Voir les opérations <ArrowRight size={16} />
      </Link>
    </>
  );
}

function InflowAnalysis({
  operations,
  months,
  operationsHref,
}: {
  operations: Operation[];
  months: MonthKey[];
  operationsHref: string;
}) {
  const byType = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  for (const operation of operations.filter(
    (entry) => operationHistoryFlow(entry) === "inflows",
  )) {
    const type = operationHistoryResourceType(operation);
    byType.set(type, (byType.get(type) ?? 0) + operation.amount);
    const merchant = operationMerchant(operation);
    byMerchant.set(merchant, (byMerchant.get(merchant) ?? 0) + operation.amount);
  }
  const typeRows = [...byType]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const merchantRows = [...byMerchant]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const monthly = months.map((month) => ({
    month,
    label: formatShortMonth(month),
    value: operations
      .filter(
        (operation) =>
          operationHistoryMonth(operation) === month &&
          operationHistoryFlow(operation) === "inflows",
      )
      .reduce((sum, operation) => sum + operation.amount, 0),
  }));
  const total = typeRows.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <>
      <section className="card mb-5 bg-[var(--color-primary)] p-6 text-white">
        <p className="text-sm font-bold text-white/70">Rentrées d’argent bancaires</p>
        <p className="mt-2 text-4xl font-black">{formatCurrency(total)}</p>
        <p className="mt-2 text-sm text-white/70">
          Répartition analytique conservée par type, sans assimiler tous les crédits à des revenus.
        </p>
      </section>
      <section className="card mb-5 p-5">
        <h2 className="text-xl font-black">Évolution des flux entrants</h2>
        <div className="mt-4 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis width={58} tickFormatter={formatCompactCurrency} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" name="Rentrées" fill="#52766f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-xl font-black">Types d’entrée</h2>
          {typeRows.map((entry) => (
            <div
              key={entry.name}
              className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"
            >
              <span>{entry.name}</span>
              <span>{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="text-xl font-black">Tiers principaux</h2>
          {merchantRows.slice(0, 10).map((entry) => (
            <div
              key={entry.name}
              className="mt-2 flex justify-between rounded-xl bg-[var(--color-surface-soft)] p-3 font-bold"
            >
              <span>{entry.name}</span>
              <span>{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </section>
      <Link href={operationsHref} className="button-primary mt-5">
        Voir les opérations <ArrowRight size={16} />
      </Link>
    </>
  );
}
