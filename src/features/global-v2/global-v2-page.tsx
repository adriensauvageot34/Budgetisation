"use client";

import Link from "next/link";
import Image from "next/image";
import { lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Info, Maximize2, Minimize2, RefreshCw, Sparkles, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { parseMoney, type Money } from "@/core/money";
import type { MetricEnvelope } from "@/core/metrics";
import { MultiSeriesMonetaryEvolution } from "@/ui";
import type {
  GlobalCompactInsight,
  GlobalCompactKpi,
  GlobalCompactQuality,
  GlobalDetailRow,
  GlobalDetailMetric,
  GlobalDetailSeries,
  GlobalDetailSeriesPoint,
  GlobalExpandedReadModel,
  GlobalExpandedSectionKey,
  GlobalInitialReadModel,
  GlobalMomentComponentRow,
  GlobalMomentPeerObservation,
  GlobalLifeTimelineV2ReadModel,
  GlobalLifeTimelineReadModel,
  GlobalLifeTimelineV3ReadModel,
  GlobalTimelineComparisonEventObservation,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelTransportState,
  GlobalV2ExpandedResourceName,
} from "@/query-api/global-v2";
import { globalV2MethodRef } from "@/query-api/global-v2";
import { globalModulePresentation, globalUiCopy } from "./catalog";
import { economicMetric, economicStructureGroups, economicStructureLabel } from "./economic-ui";
import { emitGlobalV2UxEvent } from "./instrumentation";
import { DensityAtom, useAdaptiveColumn } from "@/components/layout/content-density";
import { focusCategoryRankingRow, useCategoryRankingScroll } from "@/components/layout/category-ranking";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { replaceViewSearch } from "@/components/layout/view-search";
import { startDetailTiming } from "@/components/layout/detail-timing";
import { composerBalanceHref } from "@/app/mois-a-venir/month-entry";
import { isArchivedRealizedMonth } from "@/domain/phase2/planner/realized-month-entry";
import { AtomicDetailPages } from "./atomic-detail-pages";
import { GlobalLayoutMotion, useGlobalLayoutMotion } from "./global-layout-motion";
import atomic from "./global-atomic.module.css";
import { GlobalClayIcon } from "./global-clay-icon";
import { groupTimelineEvents, TimelineComparator, TimelineEventFacts } from "./life-timeline";
import { timelineEventAmount } from "./life-timeline-presentation";
import { buildHabitCoverageModel, groupRhythmMomentsByYear } from "./rhythm-collections";
import { resolveRhythmDetailContext, type RhythmDetailContext, type RhythmDetailOrigin } from "./rhythm-detail-routing";
import { globalV2PersonaPanelResource, type GlobalV2PersonaPanelModel } from "@/query-api/global-v2/persona-panel";
import { BackgroundRhythms, useBackgroundRhythms } from "./background-rhythms";
import { useGlobalV2Resource } from "./use-global-resource";
import { GlobalV2VisitRuntime, parseGlobalDeepLink, type GlobalV2UiRequest, type GlobalV2UiTransport } from "./visit-runtime";
import styles from "./global-v2.module.css";

export type GlobalV2PageBundle = {
  readonly initial: GlobalInitialReadModel;
  readonly newerPublication?: GlobalReadModelPublicationMeta;
};

const moduleSlugs: Readonly<Record<GlobalPrimaryModuleKey, string>> = Object.freeze({
  ECONOMIC: "economie",
  CATEGORIES_NEEDS: "categories",
  TRANSFORMATIONS: "autres-analyses",
  RHYTHM: "rythmes",
  RELATIONSHIPS: "relations",
  MOMENTS: "moments",
  GEO_MOBILITY: "lieux",
  CONSUMPTION: "achats",
  PERSONAS: "profils",
  TOGETHER: "nous-deux",
});

const storyOrder = Object.freeze([
  "ECONOMIC", "CATEGORIES_NEEDS", "RHYTHM", "PERSONAS",
] as const satisfies readonly GlobalPrimaryModuleKey[]);

function moduleForSlug(slug: string): GlobalPrimaryModuleKey | undefined {
  return storyOrder.find((moduleKey) => moduleSlugs[moduleKey] === slug);
}

function humanLabel(value: string): string {
  return globalUiCopy(value);
}

function transportData<Data>(state: GlobalReadModelTransportState<Data>): Data | undefined {
  return state.status === "READY" ? state.data : state.status === "ERROR" ? state.previousData : undefined;
}

function LoadingCard({ label, compact = false }: { readonly label: string; readonly compact?: boolean }) {
  return <div className={`${styles.skeleton} ${compact ? styles.skeletonCompact : ""}`} role="status" aria-label={`Chargement de ${label}`} aria-busy="true"><span>Chargement…</span></div>;
}

function LocalError({ retry }: { readonly retry: () => void }) {
  return <div className={styles.localError} role="alert"><strong>Ce contenu n’a pas pu être chargé.</strong><p>Le reste de l’analyse reste disponible.</p><button type="button" className="button-secondary" onClick={retry}><RefreshCw aria-hidden size={16} /> Réessayer</button></div>;
}

function HumanQualityNote({ quality }: { readonly quality: GlobalCompactQuality }) {
  if (quality.knowledgeState === "KNOWN") return null;
  if (quality.knowledgeState === "PARTIAL") return <p className={styles.qualityNote}>Cette lecture porte uniquement sur les éléments suffisamment renseignés.</p>;
  if (quality.knowledgeState === "CONFLICT") return <p className={styles.qualityNote}>Certaines informations se contredisent et ne sont pas utilisées ici.</p>;
  if (quality.knowledgeState === "NOT_APPLICABLE") return <p className={styles.qualityNote}>Cette lecture ne s’applique pas à la période.</p>;
  return <p className={styles.qualityNote}>Les informations disponibles ne permettent pas encore cette lecture.</p>;
}

function numericDisplay(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replaceAll("\u202f", "").replaceAll(" ", "").replace(",", ".");
  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/u);
  if (match === null) return undefined;
  const result = Number(match[0]);
  return Number.isFinite(result) ? result : undefined;
}

function moneyEnvelope(value: number | undefined): MetricEnvelope<Money, "EUR"> {
  return value === undefined
    ? { availability: "unknown", value: null, unit: "EUR", provenance: "derived" }
    : { availability: "known", value: parseMoney(String(value)), unit: "EUR", provenance: "derived" };
}

function M2MonetarySeries({ title, series, reference, showLegend = true, showSummary = true, highlightLastPoint = false }: { readonly title: string; readonly series: readonly GlobalDetailSeries[]; readonly reference?: GlobalDetailMetric; readonly showLegend?: boolean; readonly showSummary?: boolean; readonly highlightLastPoint?: boolean }) {
  const comparable = series.slice(0, 3).filter((item) => item.points.length > 0 && item.points.length <= 12 && item.points.every((point) => point.typedMeasure?.kind === "MONEY"));
  const periods = comparable[0]?.points.map(({ unitKey }) => unitKey) ?? [];
  const aligned = comparable.filter((item) => item.points.length === periods.length && item.points.every((point, index) => point.unitKey === periods[index]));
  if (aligned.length === 0) return null;
  const referenceValue = reference?.typedMeasure?.kind === "MONEY" ? m2TypedNumber(reference) : undefined;
  return <div className={styles.m2MonetarySeries}><MultiSeriesMonetaryEvolution frame={{ title, state: { kind: "ready" }, summary: showSummary ? <span>Évolution mensuelle sur la période analysée.</span> : null }} unit="EUR" series={aligned.map((item) => ({ id: item.seriesId, label: humanLabel(item.labelKey), points: item.points.map((point) => ({ period: point.unitKey, label: capitalize(frenchMonth(point.unitKey)), metric: moneyEnvelope(m2TypedNumber(point)) })) }))} {...(referenceValue === undefined ? {} : { referenceLine: { label: "Référence", metric: moneyEnvelope(referenceValue) } })} showLegend={showLegend} highlightLastPoint={highlightLastPoint} /></div>;
}

const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const ratioFormatter = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const lifeRatioFormatter = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const lifeMoneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const shortMonths = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] as const;
const longMonths = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;
const annualReading = "Sur l’année, la tendance reste orientée à la baisse ; sur les trois derniers mois, nos dépenses repartent nettement à la hausse.";

type EconomicValue = Pick<GlobalDetailMetric, "displayValue" | "typedMeasure" | "knowledgeState"> & Partial<Pick<GlobalDetailMetric, "phenomenonQuality">>;

function economicNumber(value: EconomicValue | GlobalDetailSeriesPoint | GlobalDetailRow | undefined): number | undefined {
  if (value === undefined) return undefined;
  const state = value.phenomenonQuality?.knowledgeState ?? value.knowledgeState;
  if (state !== "KNOWN" && state !== "PARTIAL") return undefined;
  const raw = value.typedMeasure?.value;
  const parsed = raw === undefined ? numericDisplay("displayValue" in value ? value.displayValue : undefined) : Number(raw);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

function formatMoney(value: number | undefined, options: { readonly perMonth?: boolean; readonly signed?: boolean; readonly approximate?: boolean; readonly perPayment?: boolean } = {}): string {
  if (value === undefined) return "Non disponible sur cette période";
  const sign = options.signed && value > 0 ? "+" : value < 0 ? "−" : "";
  const magnitude = integerFormatter.format(Math.abs(value));
  return `${options.approximate ? "≈ " : ""}${sign}${magnitude} €${options.perMonth ? " / mois" : options.perPayment ? " / paiement" : ""}`;
}

function m2TypedNumber(value: { readonly typedMeasure?: { readonly value: string } } | undefined): number | undefined {
  if (value !== undefined && "knowledgeState" in value && value.knowledgeState !== "KNOWN" && value.knowledgeState !== "PARTIAL") return undefined;
  const parsed = value?.typedMeasure === undefined ? Number.NaN : Number(value.typedMeasure.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatM2Ratio(value: number | undefined): string {
  return value === undefined ? "Non disponible sur cette période" : ratioFormatter.format(value);
}

function formatLifeRatio(value: number | undefined): string {
  return value === undefined ? "Non disponible sur cette période" : lifeRatioFormatter.format(value);
}

function formatLifeMoney(value: number | undefined): string {
  return value === undefined ? "Non disponible sur cette période" : lifeMoneyFormatter.format(value);
}

type LifeDate = { readonly year: number; readonly month: number; readonly day: number };

function parseLifeDate(value: string): LifeDate | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match === null) return undefined;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCFullYear() === date.year && check.getUTCMonth() + 1 === date.month && check.getUTCDate() === date.day ? date : undefined;
}

function formatLifeDateRange(start: LifeDate, end: LifeDate, detail: boolean): string {
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;
  const monthNames = detail ? longMonths : shortMonths;
  if (start.year === end.year && start.month === end.month && start.day === end.day) return `${start.day} ${monthNames[start.month - 1]} ${start.year}`;
  if (detail) {
    const startText = `${start.day}${sameMonth ? "" : ` ${monthNames[start.month - 1]}${sameYear ? "" : ` ${start.year}`}`}`;
    return `du ${startText} au ${end.day} ${monthNames[end.month - 1]} ${end.year}`;
  }
  const startText = `${start.day}${sameMonth ? "" : ` ${monthNames[start.month - 1]}${sameYear ? "" : ` ${start.year}`}`}`;
  return sameMonth
    ? `${start.day}–${end.day} ${monthNames[end.month - 1]} ${end.year}`
    : `${startText} – ${end.day} ${monthNames[end.month - 1]} ${end.year}`;
}

function lifeMomentDates(value: string | undefined, detail: boolean): string | undefined {
  if (value === undefined) return undefined;
  const rawDates = value.match(/\d{4}-\d{2}-\d{2}/gu) ?? [];
  const start = rawDates[0] === undefined ? undefined : parseLifeDate(rawDates[0]);
  const end = rawDates[1] === undefined ? start : parseLifeDate(rawDates[1]);
  return start === undefined || end === undefined ? undefined : formatLifeDateRange(start, end, detail);
}

function lifeMomentIdentity(value: string | undefined, detail: boolean): string | undefined {
  if (value === undefined) return undefined;
  const type = lifeMomentType(value);
  const dates = lifeMomentDates(value, detail);
  return [type, dates].filter((part): part is string => part !== undefined && part.length > 0).join(" · ") || undefined;
}

function lifeMomentType(value: string | undefined): string | undefined {
  const type = value?.split(" · ")[0]?.trim();
  return type === undefined || type.length === 0 ? undefined : type;
}

function lifeUiCopy(value: string): string {
  const copy = humanLabel(value)
    .replace(/\bpeers?\b/giu, "moments comparables")
    .replace(/(?:de la même )?famille de comparaison/giu, "moments comparables")
    .replace(/expériences comparables/giu, "moments comparables")
    .replace(/occurrences renseignées/giu, "fois avec un coût connu")
    .replace(/historique retenu/giu, "données disponibles")
    .replace(/\bMoment\b/gu, "moment");
  const rawDates = copy.match(/\d{4}-\d{2}-\d{2}/gu) ?? [];
  if (rawDates.length === 0) return copy;
  const formatted = lifeMomentDates(copy, false);
  if (formatted === undefined) return copy.replace(/\d{4}-\d{2}-\d{2}/gu, "date non disponible");
  return copy.replace(rawDates.length > 1 ? `${rawDates[0]} → ${rawDates[1]}` : rawDates[0]!, formatted);
}

function formatTrend(value: number | undefined): string {
  return value === undefined ? formatMoney(value) : `environ ${formatMoney(value, { perMonth: true })}`;
}

function monthParts(value: string): { readonly year: number; readonly month: number } | undefined {
  const match = value.match(/^(\d{4})-(\d{2})/u);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return Number.isInteger(year) && month >= 1 && month <= 12 ? { year, month } : undefined;
}

function frenchMonth(value: string, compact = false): string {
  const parts = monthParts(value);
  if (parts === undefined) return value;
  return `${compact ? shortMonths[parts.month - 1] : longMonths[parts.month - 1]} ${parts.year}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function analysisPeriod(certifiedThrough: string): { readonly label: string; readonly targetLabel: string; readonly targetMonth: string } {
  const target = monthParts(certifiedThrough);
  if (target === undefined) return { label: certifiedThrough, targetLabel: certifiedThrough, targetMonth: certifiedThrough.slice(0, 7) };
  const startDate = new Date(Date.UTC(target.year, target.month - 12, 1));
  const startMonth = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const targetMonth = `${target.year}-${String(target.month).padStart(2, "0")}`;
  return {
    label: `${capitalize(frenchMonth(startMonth))} — ${frenchMonth(targetMonth)} · 12 mois analysés`,
    targetLabel: capitalize(frenchMonth(targetMonth)),
    targetMonth,
  };
}

function InfoTooltip({ text }: { readonly text: string }) {
  return <span className={styles.infoTooltip}><span className={styles.infoTooltipTrigger} tabIndex={0} aria-label={text}><Info aria-hidden size={14} /></span><span role="tooltip">{text}</span></span>;
}

function EconomicMetricValue({ metric, perMonth = false, signed = false, approximate = false, unknownText }: { readonly metric: GlobalDetailMetric | undefined; readonly perMonth?: boolean; readonly signed?: boolean; readonly approximate?: boolean; readonly unknownText?: string }) {
  const value = economicNumber(metric);
  return <strong className={value === undefined ? styles.unavailableValue : undefined}>{value === undefined ? unknownText ?? "Non disponible sur cette période" : formatMoney(value, { perMonth, signed, approximate })}</strong>;
}

type EconomicChartDatum = {
  readonly period: string;
  readonly monthLabel: string;
  readonly fullLabel: string;
  readonly actual: number | null;
  readonly typical: number | null;
};

function EconomicChartTooltip({ active, payload, overview, targetMonth }: { readonly active?: boolean; readonly payload?: readonly { readonly payload?: EconomicChartDatum }[]; readonly overview?: GlobalExpandedReadModel; readonly targetMonth: string }) {
  const datum = payload?.[0]?.payload;
  if (!active || datum === undefined) return null;
  const isTarget = datum.period === targetMonth;
  const targetMonthName = frenchMonth(targetMonth).replace(/\s+\d{4}$/u, "");
  return <div className={styles.chartTooltip}>
    <strong>{capitalize(datum.fullLabel)}</strong>
    <dl>
      <div><dt>Dépenses réelles</dt><dd>{formatMoney(datum.actual ?? undefined)}</dd></div>
      <div><dt>Niveau habituel</dt><dd>{formatMoney(datum.typical ?? undefined)}</dd></div>
      {isTarget && overview !== undefined ? <><div><dt>Niveau habituel avant {targetMonthName}</dt><dd>{formatMoney(economicNumber(economicMetric(overview, "typical-reference")))}</dd></div><div><dt>Écart</dt><dd>{formatMoney(economicNumber(economicMetric(overview, "actual-reference-delta")), { signed: true })}</dd></div></> : null}
    </dl>
  </div>;
}

function EconomicChart({ evolution, overview, certifiedThrough, compact = false }: { readonly evolution: GlobalExpandedReadModel; readonly overview?: GlobalExpandedReadModel; readonly certifiedThrough: string; readonly compact?: boolean }) {
  const actual = evolution.series.find(({ seriesId }) => seriesId === "economic:actual");
  const typical = evolution.series.find(({ seriesId }) => seriesId === "economic:typical-state");
  if (actual === undefined || actual.points.length === 0) return <p className={styles.qualityNote}>L’évolution n’est pas disponible sur cette période.</p>;
  const typicalByMonth = new Map(typical?.points.map((point) => [point.unitKey, point]));
  const data: EconomicChartDatum[] = actual.points.map((point) => {
    const parts = monthParts(point.unitKey);
    return { period: point.unitKey, monthLabel: parts === undefined ? point.unitKey : shortMonths[parts.month - 1], fullLabel: frenchMonth(point.unitKey), actual: economicNumber(point) ?? null, typical: economicNumber(typicalByMonth.get(point.unitKey)) ?? null };
  });
  const period = analysisPeriod(certifiedThrough);
  const lastPoint = [...data].reverse().find(({ actual: value }) => value !== null);
  const startYear = monthParts(data[0]!.period)?.year;
  const endYear = monthParts(data[data.length - 1]!.period)?.year;
  return <section className={`${styles.economicChart} ${compact ? styles.economicChartCompact : styles.economicChartExpanded}`} aria-labelledby={compact ? undefined : "economic-evolution-title"}>
    {compact ? null : <header><div><h3 id="economic-evolution-title">Nos dépenses sur 12 mois</h3><span>€ / mois</span></div></header>}
    <div className={styles.chartLegend} aria-label="Légende du graphique"><span><i data-series="actual" />Dépenses réelles</span><span><i data-series="typical" />Niveau habituel</span></div>
    <div className={styles.economicChartCanvas} role="img" aria-label="Dépenses réelles et niveau habituel sur douze mois">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={compact ? { top: 14, right: 10, bottom: 0, left: 0 } : { top: 18, right: 18, bottom: 4, left: 4 }}>
        {compact ? null : <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5" />}
        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={compact ? false : { fill: "var(--color-muted)", fontSize: 11 }} interval={0} height={compact ? 8 : 34} />
        <YAxis hide={compact} axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickCount={5} width={66} tickFormatter={(value: number) => `${integerFormatter.format(value)} €`} domain={["auto", "auto"]} />
        <Tooltip cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 4" }} content={(props) => <EconomicChartTooltip active={props.active} payload={props.payload as readonly { readonly payload?: EconomicChartDatum }[]} overview={overview} targetMonth={period.targetMonth} />} />
        <Line dataKey="actual" name="Dépenses réelles" type="linear" connectNulls={false} stroke="var(--color-economic-actual)" strokeWidth={compact ? 2.5 : 3} dot={false} activeDot={{ r: compact ? 4 : 5 }} isAnimationActive={false} />
        <Line dataKey="typical" name="Niveau habituel" type="linear" connectNulls={false} stroke="var(--color-economic-typical)" strokeWidth={2} strokeDasharray="7 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        {lastPoint === undefined || lastPoint.actual === null ? null : <ReferenceDot x={lastPoint.monthLabel} y={lastPoint.actual} r={compact ? 4 : 5} fill="white" stroke="var(--color-economic-actual)" strokeWidth={3} />}
      </LineChart></ResponsiveContainer>
    </div>
    {compact ? <div className={styles.chartEndpoints}><span>{capitalize(data[0]!.fullLabel)}</span><span>{capitalize(data[data.length - 1]!.fullLabel)}</span></div> : <div className={styles.chartYears} aria-hidden><span>{startYear}</span><span>{endYear}</span></div>}
  </section>;
}

function EconomicSummary({ model, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly certifiedThrough: string }) {
  const period = analysisPeriod(certifiedThrough);
  const targetMonthName = frenchMonth(period.targetMonth).replace(/\s+\d{4}$/u, "");
  const minimal = economicMetric(model, "minimal-state");
  const minimalKnown = economicNumber(minimal) !== undefined;
  return <div className={styles.economicSummary}>
    <section aria-labelledby="economic-summary-markers"><h3 id="economic-summary-markers">Nos repères mensuels</h3><div className={styles.markerEquation}><article><span>Notre mois habituel</span><EconomicMetricValue metric={economicMetric(model, "typical-state")} perMonth /></article>{minimalKnown ? <><span className={styles.equationSign} aria-hidden>−</span><article><span>Nos dépenses minimum <InfoTooltip text="Estimation annuelle calculée avec les données disponibles sur les 12 mois analysés." /></span><EconomicMetricValue metric={minimal} perMonth /></article><span className={styles.equationSign} aria-hidden>=</span><article><span>Notre marge</span><EconomicMetricValue metric={economicMetric(model, "typical-minimal-gap")} perMonth /></article></> : <article><span>Nos dépenses minimum</span><EconomicMetricValue metric={minimal} /></article>}</div></section>
    <section className={styles.summaryJuly} aria-labelledby="economic-summary-july"><div><h3 id="economic-summary-july">{period.targetLabel}</h3><strong>{formatMoney(economicNumber(economicMetric(model, "actual")))} dépensés</strong></div><div><p><strong>{formatMoney(economicNumber(economicMetric(model, "actual-reference-delta")), { signed: true })}</strong> par rapport à notre niveau habituel avant {targetMonthName}</p><p>Niveau habituel avant {targetMonthName} : <strong>{formatMoney(economicNumber(economicMetric(model, "typical-reference")), { perMonth: true })}</strong></p></div></section>
    <section className={styles.summaryReading} aria-labelledby="economic-summary-reading"><h3 id="economic-summary-reading">Ce que raconte l’année</h3><p>{annualReading}</p><div><article><span>Tendance sur l’année</span><strong>↘ {formatTrend(economicNumber(economicMetric(model, "overview-trend-slope")))}</strong></article><article><span>Hausse récente</span><strong>{formatMoney(economicNumber(economicMetric(model, "overview-recent-delta")), { perMonth: true, signed: true })}</strong><small>3 derniers mois vs 3 précédents</small></article></div></section>
  </div>;
}

function EconomicEvolution({ model, overview, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly overview: GlobalExpandedReadModel; readonly certifiedThrough: string }) {
  return <EconomicChart evolution={model} overview={overview} certifiedThrough={certifiedThrough} />;
}

function rowPercentage(row: GlobalDetailRow): number | undefined {
  const match = row.displayValue?.match(/(\d+(?:[.,]\d+)?)\s*%/u);
  return match === null || match === undefined ? undefined : Number(match[1]!.replace(",", "."));
}

function EconomicStructure({ model, overview, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly overview: GlobalExpandedReadModel; readonly certifiedThrough: string }) {
  const period = analysisPeriod(certifiedThrough);
  const titles = { "Nécessité": "Selon leur nécessité", "Fixe / variable": "Fixes ou variables", "Périmètre de vie": "Dans notre quotidien" } as const;
  const orders: Readonly<Record<string, readonly string[]>> = { "Nécessité": ["Contraint", "Indispensable", "Dépenses ajustables", "Optionnel"], "Fixe / variable": ["Fixe", "Variable"], "Périmètre de vie": ["Vie courante", "Hors quotidien"] };
  const groups = economicStructureGroups(model.rows).map((group) => ({ ...group, rows: group.rows.filter((row) => (economicNumber(row) ?? 0) > 0).sort((left, right) => orders[group.axis]!.indexOf(economicStructureLabel(left)) - orders[group.axis]!.indexOf(economicStructureLabel(right))) })).filter(({ rows }) => rows.length > 0);
  return <div className={styles.breakdownContent}>
    <p className={styles.breakdownPeriod}><strong>{period.targetLabel}</strong> · {formatMoney(economicNumber(economicMetric(overview, "actual")))} dépensés</p>
    {groups.map((group) => <section key={group.axis} aria-labelledby={`economic-axis-${group.axis.replaceAll(" ", "-")}`}>
      <h3 id={`economic-axis-${group.axis.replaceAll(" ", "-")}`}>{titles[group.axis]}</h3>
      <div className={styles.segmentedBar} role="img" aria-label={`Répartition : ${group.rows.map((row) => `${economicStructureLabel(row)} ${rowPercentage(row) ?? 0} %`).join(", ")}`}>
        {group.rows.map((row, index) => <span key={row.rowId} className={styles[`segment${index + 1}`]} style={{ flexBasis: `${rowPercentage(row) ?? 0}%` }} />)}
      </div>
      <div className={styles.breakdownLegend}>{group.rows.map((row, index) => {
        const label = economicStructureLabel(row);
        const percentage = rowPercentage(row);
        return <div key={row.rowId}><i className={styles[`segment${index + 1}`]} /><span>{label}{label === "Dépenses ajustables" ? <> <InfoTooltip text="Dépenses dont le niveau peut généralement être modulé selon nos choix ou le contexte." /></> : null}</span><strong>{formatMoney(economicNumber(row))}{percentage === undefined ? null : <small>· {percentage} %</small>}</strong></div>;
      })}</div>
    </section>)}
  </div>;
}

function recurrencePresentation(row: GlobalDetailRow): { readonly amount: string; readonly detail: string } {
  const count = row.displayValue?.match(/(\d+)\s+(?:occurrence|paiement)/u)?.[1];
  const dates = [...(row.displayValue?.matchAll(/\d{4}-\d{2}(?:-\d{2})?/gu) ?? [])].map((match) => match[0]);
  const parts = row.displayValue?.split(" · ").map((part) => part.trim()) ?? [];
  const humanRange = parts.find((part) => /→|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/u.test(part) && !/Première|Dernière/u.test(part));
  const range = humanRange ?? (dates.length === 0 ? undefined : dates.length === 1 ? frenchMonth(dates[0]!) : `${frenchMonth(dates[0]!)} → ${frenchMonth(dates[dates.length - 1]!)}`);
  const countText = count === undefined ? undefined : `${count} paiement${count === "1" ? "" : "s"} observé${count === "1" ? "" : "s"}`;
  return { amount: formatMoney(economicNumber(row), { approximate: true, perPayment: true }), detail: [countText, range].filter(Boolean).join(" · ") };
}

function frenchDate(value: string | undefined): string {
  if (value === undefined) return "Non disponible sur cette période";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match === null) return value;
  const month = Number(match[2]);
  return month < 1 || month > 12 ? value : `${Number(match[3])} ${longMonths[month - 1]} ${match[1]}`;
}

function EconomicRecurrenceDetail({ model }: { readonly model: GlobalExpandedReadModel }) {
  const metrics = model.metrics.filter((metric) => (metric.knowledgeState === "KNOWN" || metric.knowledgeState === "PARTIAL") && economicNumber(metric) !== undefined);
  const rows = model.rows.filter((row) => (row.knowledgeState === "KNOWN" || row.knowledgeState === "PARTIAL") && !/price-evolution/u.test(row.rowId));
  return <div className={styles.recurrenceDetail}>
    {metrics.length === 0 ? null : <div>{metrics.map((metric) => <article key={metric.metricId}><span>{metric.metricId.includes("typical-occurrence") ? "Coût habituel" : humanLabel(metric.labelKey)}</span><strong>{formatMoney(economicNumber(metric), { perPayment: metric.metricId.includes("occurrence") })}</strong></article>)}</div>}
    {rows.length === 0 ? null : <dl>{rows.map((row) => <div key={row.rowId}><dt>{humanLabel(row.labelKey).replace("occurrence", "paiement")}</dt><dd>{/first-observed|last-observed/u.test(row.rowId) ? frenchDate(row.displayValue) : /cadence/u.test(row.rowId) ? row.displayValue?.replace("occurrence(s)", "paiements") : row.displayValue}</dd></div>)}</dl>}
  </div>;
}

function EconomicMethod({ model, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly certifiedThrough: string }) {
  const period = analysisPeriod(certifiedThrough);
  return <div className={styles.methodContent}><dl><div><dt>Période analysée</dt><dd>{period.label.replace("analysés", "complets")}</dd></div><div><dt>Notre mois habituel</dt><dd>Médiane de nos 12 mois analysés.</dd></div><div><dt>Nos dépenses minimum</dt><dd>Estimation annuelle calculée avec les données disponibles sur les 12 mois analysés.</dd></div><div><dt>Notre marge</dt><dd>Différence entre notre mois habituel et nos dépenses minimum.</dd></div><div><dt>Limite importante</dt><dd>Pour une partie des dépenses, la date exacte à laquelle elles se rapportent n’est pas disponible ; leur date bancaire est alors utilisée.</dd></div></dl><details><summary>Détails techniques <ChevronRight aria-hidden size={16} /></summary><HumanRows rows={model.rows} onDetail={() => undefined} /></details></div>;
}

type OverlayTarget = {
  readonly kind: "MODULE_DETAIL" | "ENTITY_DETAIL" | "METHODOLOGY";
  readonly title: string;
  readonly resource: GlobalV2ExpandedResourceName;
  readonly entityRef: string;
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly initialSection?: GlobalExpandedSectionKey;
  readonly returnSection?: GlobalExpandedSectionKey;
  readonly rhythmDetailContext?: RhythmDetailContext;
  readonly queryDetailRef?: string;
};

function moduleOverlayTarget(moduleKey: GlobalPrimaryModuleKey, initialSection?: GlobalExpandedSectionKey): OverlayTarget {
  const presentation = globalModulePresentation(moduleKey);
  const title = moduleKey === "RHYTHM" && initialSection === "PATTERNS"
    ? "Nos habitudes"
    : moduleKey === "RHYTHM" && initialSection === "BREAKDOWN"
      ? "Nos moments"
      : presentation.title;
  return { kind: "MODULE_DETAIL", title, resource: presentation.expandedResource, entityRef: `module:${moduleKey.toLowerCase()}`, moduleKey, ...(initialSection === undefined ? {} : { initialSection }) };
}

function methodOverlayTarget(moduleKey: GlobalPrimaryModuleKey): OverlayTarget {
  return { kind: "METHODOLOGY", title: "Méthode", resource: "analysis_global_methodology", entityRef: globalV2MethodRef(moduleKey), moduleKey };
}

function entityOverlayTarget(moduleKey: GlobalPrimaryModuleKey, entityRef: string, title: string, returnSection?: GlobalExpandedSectionKey, rhythmOrigin?: RhythmDetailOrigin): OverlayTarget | undefined {
  const inferredRhythmOrigin = rhythmOrigin ?? (returnSection === "PATTERNS" ? "HABITS_COLLECTION" : returnSection === "BREAKDOWN" ? "MOMENTS_COLLECTION" : "NARRATIVE");
  const rhythmDetailContext = moduleKey === "RHYTHM" ? resolveRhythmDetailContext(entityRef, inferredRhythmOrigin) : undefined;
  const resource = moduleKey === "RHYTHM" ? rhythmDetailContext?.resource : globalModulePresentation(moduleKey).detailResource;
  return resource === undefined ? undefined : { kind: "ENTITY_DETAIL", title, resource, entityRef, moduleKey, ...(returnSection === undefined ? {} : { returnSection }), ...(rhythmDetailContext === undefined ? {} : { rhythmDetailContext }) };
}

function GlobalSeries({ model }: { readonly model: GlobalExpandedReadModel }) {
  if (model.series.length === 0) return null;
  return <div className={styles.seriesGrid}>{model.series.map((item) => <figure key={item.seriesId} className={styles.chart} aria-labelledby={`${item.seriesId}-title`}><figcaption id={`${item.seriesId}-title`}>{humanLabel(item.labelKey)}</figcaption><div className={styles.seriesTrack} role="list" aria-label={`${humanLabel(item.labelKey)} : chronologie`}>{item.points.map((point) => <div key={point.unitKey} role="listitem"><small>{point.unitKey}</small><strong>{point.displayValue ?? "Indisponible"}</strong></div>)}</div><details><summary>Alternative textuelle</summary><ul>{item.points.map((point) => <li key={point.unitKey}>{point.unitKey} : {point.displayValue ?? "Indisponible"}</li>)}</ul></details></figure>)}</div>;
}

function HumanRows({ rows, onDetail }: { readonly rows: readonly GlobalDetailRow[]; readonly onDetail: (row: GlobalDetailRow) => void }) {
  if (rows.length === 0) return null;
  return <div className={styles.rows}>{rows.map((row) => row.entityRef === undefined ? <div key={row.rowId}><span>{humanLabel(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong></div> : <button key={row.rowId} type="button" onClick={() => onDetail(row)}><span>{humanLabel(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong><ExternalLink aria-hidden size={15} /></button>)}</div>;
}

const m2CategoryExpansionLabels = Object.freeze({ all: "Voir toutes les catégories", fewer: "Voir moins de catégories" });
const m2NeedExpansionLabels = Object.freeze({ all: "Voir tous les besoins", fewer: "Voir moins de besoins" });

function M2MoneyRows({ rows, onDetail, initialLimit = 9, allowExpansion = true, interactive = true, expansionLabels = m2CategoryExpansionLabels, showRemainingCount = false }: { readonly rows: readonly GlobalDetailRow[]; readonly onDetail: (row: GlobalDetailRow) => void; readonly initialLimit?: number; readonly allowExpansion?: boolean; readonly interactive?: boolean; readonly expansionLabels?: { readonly all: string; readonly fewer: string }; readonly showRemainingCount?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const typedRows = rows.flatMap((row) => {
    const amount = row.typedMeasure?.kind === "MONEY" ? m2TypedNumber(row) : undefined;
    return amount === undefined ? [] : [{ row, amount }];
  });
  if (typedRows.length === 0) return <p className={styles.qualityNote}>La structure annuelle sera disponible après l’actualisation de cette analyse.</p>;
  const visible = expanded ? typedRows : typedRows.slice(0, initialLimit);
  const maximum = Math.max(...typedRows.map(({ amount }) => Math.abs(amount)), 1);
  return <div className={styles.m2Ranking}>
    <div className={styles.m2RankingRows}>{visible.map(({ row, amount }) => {
      const canOpen = interactive && row.entityRef !== undefined;
      const content = <><span><strong>{humanLabel(row.labelKey)}</strong><small>{formatMoney(amount)}</small><i aria-hidden><b style={{ width: `${Math.max(2, Math.abs(amount) / maximum * 100)}%` }} /></i></span>{canOpen ? <ChevronRight aria-hidden size={18} /> : null}</>;
      return canOpen ? <button key={row.rowId} type="button" data-m2-entity-ref={row.entityRef} onClick={() => onDetail(row)} aria-label={`Explorer ${humanLabel(row.labelKey)}`}>{content}</button> : <div key={row.rowId}>{content}</div>;
    })}</div>
    {allowExpansion && typedRows.length > initialLimit ? <button type="button" className={styles.m2ShowAll} onClick={() => setExpanded((value) => !value)}>{expanded ? expansionLabels.fewer : showRemainingCount ? `Voir les ${typedRows.length - initialLimit} autres` : `${expansionLabels.all} (${typedRows.length})`}</button> : null}
  </div>;
}

function M2Comparisons({ model, certifiedThrough, onDetail }: { readonly model: GlobalExpandedReadModel; readonly certifiedThrough: string; readonly onDetail: (row: GlobalDetailRow, title?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const rows = model.rows.flatMap((row) => {
    const amount = row.typedMeasure?.kind === "MONEY" ? m2TypedNumber(row) : undefined;
    return amount === undefined ? [] : [{ row, amount }];
  });
  const targetLabel = analysisPeriod(certifiedThrough).targetLabel;
  if (rows.length === 0) return <p className={styles.qualityNote}>Aucun écart suffisamment net n’est disponible pour {targetLabel.toLocaleLowerCase("fr-FR")}.</p>;
  const visibleRows = expanded ? rows : rows.slice(0, 6);
  return <section className={styles.m2Changes} aria-labelledby="m2-reference-gaps"><h3 id="m2-reference-gaps">Écarts observés en {targetLabel.toLocaleLowerCase("fr-FR")}</h3><p className={styles.m2ComparisonNote}>Chaque montant compare le dernier mois analysé au niveau de référence de la catégorie.</p><div>{visibleRows.map(({ row, amount }) => {
    const label = humanLabel(row.labelKey).replace(/^(?:Hausse|Baisse|Stable) · /u, "");
    const content = <>{amount < 0 ? <ArrowDown aria-hidden size={18} /> : <ArrowUp aria-hidden size={18} />}<span>{label}</span><strong>{formatMoney(amount, { signed: true })}</strong>{row.entityRef === undefined ? null : <ChevronRight aria-hidden size={17} />}</>;
    return row.entityRef === undefined ? <article key={row.rowId} data-direction={amount < 0 ? "down" : "up"}>{content}</article> : <button key={row.rowId} type="button" data-direction={amount < 0 ? "down" : "up"} data-m2-entity-ref={row.entityRef} onClick={() => onDetail(row, label)} aria-label={`Explorer ${label}`}>{content}</button>;
  })}</div>{rows.length > 6 ? <button type="button" className={styles.m2ShowAll} onClick={() => setExpanded((value) => !value)}>{expanded ? "Réduire la liste" : `Voir les ${rows.length - 6} autres`}</button> : null}</section>;
}

function M2NeedsContent({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow) => void }) {
  const metric = (id: string) => model.metrics.find(({ metricId }) => metricId === id);
  const coverage = metric("needs-monetary-coverage");
  const unresolved = metric("needs-unclassified-annual-amount");
  const knownRows = model.rows.filter((row) => row.entityRef !== "need:__UNKNOWN__" && !/non déterminé/iu.test(row.labelKey) && (row.knowledgeState === "KNOWN" || row.knowledgeState === "PARTIAL"));
  return <div className={styles.m2TabContent}>
    <header><div>{model.quality.knowledgeState === "PARTIAL" ? <span className={styles.m2PartialStatus}>Analyse partielle</span> : null}<h3>À quoi servent les dépenses renseignées ?</h3></div></header>
    {coverage?.typedMeasure?.kind === "RATIO" ? <p className={styles.m2Coverage}>Le besoin associé est suffisamment renseigné pour <strong>{formatM2Ratio(m2TypedNumber(coverage))} de nos dépenses</strong>.</p> : <HumanQualityNote quality={model.quality} />}
    <M2MoneyRows rows={knownRows} onDetail={onDetail} initialLimit={8} expansionLabels={m2NeedExpansionLabels} />
    {unresolved?.typedMeasure?.kind === "MONEY" ? <section className={styles.m2Unclassified} aria-labelledby="m2-unclassified-title"><h3 id="m2-unclassified-title">Montant dont le besoin reste à préciser</h3><strong>{formatMoney(m2TypedNumber(unresolved))}</strong><p>Nous préférons laisser cette part non attribuée plutôt que de la deviner.</p></section> : null}
  </div>;
}

function M2EvolutionContent({ model, runtime, certifiedThrough, onDetail }: { readonly model: GlobalExpandedReadModel; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly onDetail: (row: GlobalDetailRow, title?: string) => void }) {
  return <div className={styles.m2TabContent}>
    <header><h3>Quels postes s’écartent le plus de leur niveau de référence, et comment évoluent-ils ?</h3></header>
    <ExpandedPreview runtime={runtime} moduleKey="CATEGORIES_NEEDS" sectionKey="COMPARISONS">{(comparisons) => <M2Comparisons model={comparisons} certifiedThrough={certifiedThrough} onDetail={onDetail} />}</ExpandedPreview>
    <M2MonetarySeries title="Évolution mensuelle des principaux postes" series={model.series} showSummary={false} />
    <section className={styles.m2ExploreCategories} aria-labelledby="m2-explore-evolution"><h3 id="m2-explore-evolution">Explorer l’évolution d’une catégorie</h3><ExpandedPreview runtime={runtime} moduleKey="CATEGORIES_NEEDS" sectionKey="BREAKDOWN">{(breakdown) => <M2MoneyRows rows={breakdown.rows} onDetail={onDetail} initialLimit={3} allowExpansion={false} />}</ExpandedPreview></section>
  </div>;
}

function M2EntityDetail({ model, entityRef, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly certifiedThrough: string }) {
  const metric = (id: string) => model.metrics.find(({ metricId }) => metricId === id);
  const annualAmount = metric("detail:annual-amount");
  const isCategory = entityRef.startsWith("category:");
  const period = analysisPeriod(certifiedThrough);
  const primaryMetrics = [
    ["detail:annual-amount", "Total sur la période"],
    ["detail:annual-share", "Part de nos dépenses"],
    ["detail:active-months", "Mois actifs"],
    ...(!isCategory ? [["detail:current-amount", period.targetLabel], ["detail:typical-amount", "Référence mensuelle"]] as const : []),
  ] as const;
  const reference = metric("detail:typical-amount");
  const deltaValue = m2TypedNumber(metric("detail:delta-amount"));
  const deltaRelativeValue = m2TypedNumber(metric("detail:delta-relative"));
  const composition = model.rows.flatMap((row) => {
    const amount = row.typedMeasure?.kind === "MONEY" ? m2TypedNumber(row) : undefined;
    return amount === undefined ? [] : [{ row, amount }];
  });
  return <div className={atomic.categoryDetail} data-long-composition={composition.length > 10 || undefined}>
    {annualAmount && <dl className={atomic.categoryFacts}>{primaryMetrics.flatMap(([id, label]) => {
      const item = metric(id);
      const value = m2TypedNumber(item);
      if (value === undefined) return [];
      const display = item?.typedMeasure?.kind === "RATIO" ? formatM2Ratio(value) : item?.typedMeasure?.kind === "COUNT" ? `${integerFormatter.format(value)} mois` : formatMoney(value);
      return [<div key={id}><dt>{label}</dt><dd>{display}</dd></div>];
    })}</dl>}
    {model.series.length > 0 && <div className={atomic.categoryTrend}><M2MonetarySeries title="Évolution mensuelle" series={model.series.slice(0, 1)}
      reference={reference} showLegend={false} showSummary={false} highlightLastPoint /></div>}
    {composition.length > 0 && <section className={atomic.categoryBreakdown} aria-labelledby="m2-detail-composition">
      <h4 id="m2-detail-composition">{isCategory ? "Ce qui compose ce poste" : "Catégories qui contribuent à ce besoin"}</h4>
      <ul className={atomic.categoryComposition}>{composition.map(({ row, amount }) => <li key={row.rowId}>
        <span>{humanLabel(row.labelKey)}</span><strong>{formatMoney(amount)}</strong>
      </li>)}</ul>
    </section>}
    {!isCategory && deltaValue !== undefined && <p className={atomic.note}>
      Écart en {period.targetLabel.toLocaleLowerCase("fr-FR")} · {formatMoney(deltaValue, { signed: true })}
      {deltaValue === 0 || deltaRelativeValue === undefined ? null : ` · ${formatM2Ratio(deltaRelativeValue)}`}
    </p>}
    {annualAmount === undefined && composition.length === 0 && <p className={atomic.note}>Aucune ventilation chiffrée publiée.</p>}
  </div>;
}

function M2ExpandedContent({ model, onDetail, runtime, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow, title?: string) => void; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string }) {
  if (model.sectionKey === "BREAKDOWN") return <div className={styles.m2TabContent}><header><h3>Quels postes structurent nos dépenses sur la période ?</h3></header><M2MoneyRows rows={model.rows} onDetail={onDetail} /></div>;
  if (model.sectionKey === "PATTERNS") return <M2NeedsContent model={model} onDetail={onDetail} />;
  if (model.sectionKey === "COMPARISONS") return <M2Comparisons model={model} onDetail={onDetail} certifiedThrough={certifiedThrough} />;
  if (model.sectionKey === "EVOLUTION") return <M2EvolutionContent model={model} runtime={runtime} certifiedThrough={certifiedThrough} onDetail={onDetail} />;
  return <div className={styles.expandedContent}><HumanRows rows={model.rows} onDetail={onDetail} /><HumanQualityNote quality={model.quality} /></div>;
}

function LifeInsightList({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail?: (row: GlobalDetailRow, title?: string) => void }) {
  const insights = [model.primaryInsight, ...model.secondaryInsights].filter((item): item is GlobalCompactInsight => item !== undefined).slice(0, 3);
  if (insights.length === 0) return <p className={styles.qualityNote}>Aucun fait suffisamment étayé n’est disponible pour cette période.</p>;
  return <div className={styles.lifeInsights}>{insights.map((insight) => {
    const row = model.rows.find(({ entityRef }) => entityRef !== undefined && insight.entityRefs.includes(entityRef));
    const content = <><Sparkles aria-hidden size={19} /><span><strong>{lifeUiCopy(insight.titleKey)}</strong><p>{lifeUiCopy(insight.statementKey)}</p></span>{row === undefined || onDetail === undefined ? null : <ChevronRight aria-hidden size={18} />}</>;
    return row === undefined || onDetail === undefined
      ? <article key={insight.insightId}>{content}</article>
      : <button key={insight.insightId} type="button" data-global-entity-ref={row.entityRef} onClick={() => onDetail(row, lifeUiCopy(insight.titleKey))} aria-label={`Explorer ${lifeUiCopy(insight.titleKey)}`}>{content}</button>;
  })}</div>;
}

function LifeMethod({ model }: { readonly model: GlobalExpandedReadModel }) {
  return <div className={styles.methodContent}><dl>
    <div><dt>Coût connu</dt><dd>Un montant est présenté uniquement lorsqu’un coût a pu être relié à l’habitude ou au moment concerné.</dd></div>
    <div><dt>Comparaisons</dt><dd>Un moment est situé seulement lorsque des moments similaires suffisamment renseignés sont disponibles.</dd></div>
    <div><dt>Foyer et personnes</dt><dd>Les montants restent au niveau du foyer. Les fréquences individuelles n’attribuent aucune dépense à une personne.</dd></div>
    <div><dt>Valeur non disponible</dt><dd>Une information absente n’est jamais remplacée par zéro.</dd></div>
  </dl><HumanQualityNote quality={model.quality} /></div>;
}

function LifeActivityProfiles({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow, title?: string) => void }) {
  const rows = model.rows.filter((row) => row.typedMeasure?.kind === "MONEY" && row.activityCostProfile !== undefined);
  if (rows.length === 0) return <p className={styles.lifeEmpty}>Aucune habitude n’est disponible pour le moment.</p>;
  return <section className={styles.lifeSection} aria-labelledby="life-activities-title">
    <header><h3 id="life-activities-title">Toutes nos habitudes</h3><p>Dans l’ordre où elles sont présentées par l’analyse.</p></header>
    <div className={styles.lifeActivityGrid}>{rows.map((row) => {
      const profile = row.activityCostProfile!;
      const amount = m2TypedNumber(row);
      const label = humanLabel(row.labelKey);
      const coverage = buildHabitCoverageModel({ activityLabel: label, knownCausalCostCount: profile.knownCausalCostCount, totalOccurrenceCount: profile.totalOccurrenceCount, coverageRatio: profile.coverageRatio });
      const content = <>
        <span className={styles.lifeActivityName}>{humanLabel(row.labelKey)}</span>
        <strong>{formatMoney(amount)}</strong>
        <span>en médiane quand un coût est connu</span>
        {coverage === undefined ? <small className={styles.lifeCoverageUnknown}>Couverture des coûts non disponible.</small> : <span className={styles.lifeCoverage} aria-label={coverage.accessibleLabel}><small>Coût connu pour {integerFormatter.format(coverage.knownCount)} {label.toLocaleLowerCase("fr-FR")} sur {integerFormatter.format(coverage.totalCount)} · {integerFormatter.format(coverage.percentage)} %</small><i aria-hidden><b style={{ width: `${coverage.barWidth}%` }} /></i></span>}
        {row.entityRef === undefined ? null : <ChevronRight aria-hidden size={18} />}
      </>;
      return row.entityRef === undefined
        ? <article key={row.rowId}>{content}</article>
        : <button key={row.rowId} type="button" data-global-entity-ref={row.entityRef} onClick={() => onDetail(row, label)}>{content}</button>;
    })}</div>
    <p className={styles.lifeNonAdditive}>Chaque habitude est à lire séparément : ces montants ne forment pas un total.</p>
  </section>;
}

function LifeMomentComparisons({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow, title?: string) => void }) {
  const rows = model.rows.filter((row) => {
    const comparison = row.momentComparison;
    return comparison !== undefined
      && m2TypedNumber({ typedMeasure: comparison.subjectCost }) !== undefined
      && m2TypedNumber({ typedMeasure: comparison.peerMedian }) !== undefined
      && m2TypedNumber({ typedMeasure: comparison.peerCount }) !== undefined;
  });
  if (rows.length === 0) return null;
  return <section className={styles.lifeSection} aria-labelledby="life-comparisons-title"><header><h3 id="life-comparisons-title">Des moments qui sortent de l’ordinaire</h3></header><div className={styles.lifeComparisonGrid}>{rows.map((row) => {
    const comparison = row.momentComparison!;
    const subjectCost = m2TypedNumber({ typedMeasure: comparison.subjectCost });
    const peerMedian = m2TypedNumber({ typedMeasure: comparison.peerMedian });
    const peerCount = m2TypedNumber({ typedMeasure: comparison.peerCount });
    const content = <span><strong>{lifeUiCopy(row.labelKey)}</strong><p>{formatLifeMoney(subjectCost)} contre {formatLifeMoney(peerMedian)} en médiane<br />{integerFormatter.format(peerCount!)} moments comparables</p></span>;
    return row.entityRef === undefined
      ? <article key={row.rowId}>{content}</article>
      : <button key={row.rowId} type="button" data-global-entity-ref={row.entityRef} onClick={() => onDetail(row, lifeUiCopy(row.labelKey))}>{content}<ChevronRight aria-hidden size={18} /></button>;
  })}</div></section>;
}

function LifeMoments({ model, runtime, onDetail }: { readonly model: GlobalExpandedReadModel; readonly runtime: GlobalV2VisitRuntime; readonly onDetail: (row: GlobalDetailRow, title?: string) => void }) {
  const rows = model.rows.filter((row) => row.entityRef?.startsWith("moment:") === true);
  const groups = groupRhythmMomentsByYear(rows);
  if (rows.length === 0) return <p className={styles.lifeEmpty}>Aucun moment n’est disponible pour le moment.</p>;
  return <div className={styles.lifeMoments}>
    <section className={styles.lifeSection} aria-labelledby="life-moments-title"><header><h3 id="life-moments-title">Notre timeline de vie</h3><p>Les moments suivent l’ordre temporel fourni par l’analyse.</p></header><div className={styles.lifeTimeline}>{groups.map((group) => <section key={group.key} aria-labelledby={`life-year-${group.key.toLocaleLowerCase("fr-FR")}`}><h4 id={`life-year-${group.key.toLocaleLowerCase("fr-FR")}`}>{group.label}</h4><ol>{group.rows.map((row) => {
      const amount = row.typedMeasure?.kind === "MONEY" ? m2TypedNumber(row) : undefined;
      const identity = lifeMomentIdentity(row.displayValue, false);
      const content = <><i className={styles.lifeTimelineMarker} aria-hidden /><span><strong>{lifeUiCopy(row.labelKey)}</strong>{identity === undefined ? <small>Date ou type non disponible</small> : <small>{identity}</small>}{amount === undefined ? <b className={styles.lifeMomentUnknown}>Montant non disponible</b> : <b>{formatMoney(amount)}</b>}</span>{row.entityRef === undefined ? null : <ChevronRight aria-hidden size={18} />}</>;
      return <li key={row.rowId}>{row.entityRef === undefined ? <article>{content}</article> : <button type="button" data-global-entity-ref={row.entityRef} onClick={() => onDetail(row, lifeUiCopy(row.labelKey))}>{content}</button>}</li>;
    })}</ol></section>)}</div></section>
    <ExpandedPreview runtime={runtime} moduleKey="RHYTHM" sectionKey="COMPARISONS">{(comparisons) => <LifeMomentComparisons model={comparisons} onDetail={onDetail} />}</ExpandedPreview>
  </div>;
}

function metricBySuffix(model: GlobalExpandedReadModel, suffix: string): GlobalDetailMetric | undefined {
  return model.metrics.find(({ metricId }) => metricId.endsWith(suffix));
}

function lifePersonLabel(value: string): string {
  return lifeUiCopy(value.split(" · ").at(-1) ?? value);
}

function lifePersonFrequency(count: number | undefined, cadence: number | undefined): string {
  const countText = count === undefined ? "Fréquence non disponible" : `${integerFormatter.format(count)} fois`;
  if (cadence === undefined || !Number.isFinite(cadence)) return countText;
  return `${countText} · ${cadence <= 1 ? "environ chaque jour" : `environ tous les ${integerFormatter.format(cadence)} jours`}`;
}

function lifeActivityName(model: GlobalExpandedReadModel): string | undefined {
  const source = model.rows.find((row) => row.entityRef?.startsWith("person-activity:"))?.labelKey.split(" · ")[0]?.trim();
  return source === undefined || source.length === 0 ? undefined : lifeUiCopy(source);
}

function LifePersonRhythm({ row, entityRef, runtime }: { readonly row: GlobalDetailRow; readonly entityRef: string; readonly runtime: GlobalV2VisitRuntime }) {
  const request = useMemo(() => ({ resource: "analysis_global_routine_detail" as const, params: { entityRef } }), [entityRef]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "BACKGROUND");
  const detail = transportData(result.state);
  const occurrences = detail === undefined ? undefined : metricBySuffix(detail, ":occurrences");
  const count = m2TypedNumber(occurrences) ?? m2TypedNumber(row);
  const cadence = detail === undefined ? undefined : m2TypedNumber(metricBySuffix(detail, ":cadence"));
  return <article><strong>{lifePersonLabel(row.labelKey)}</strong><span>{lifePersonFrequency(count, cadence)}</span></article>;
}

function LifeActivityDetail({ model, entityRef, runtime }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly runtime: GlobalV2VisitRuntime }) {
  const household = entityRef.startsWith("household-activity:");
  const median = metricBySuffix(model, ":median");
  const known = metricBySuffix(model, ":known-count");
  const total = metricBySuffix(model, ":total-count");
  const coverage = metricBySuffix(model, ":coverage");
  if (!household) {
    const occurrences = metricBySuffix(model, ":occurrences");
    const cadence = metricBySuffix(model, ":cadence");
    const count = m2TypedNumber(occurrences);
    const interval = m2TypedNumber(cadence);
    return <div className={styles.lifeDetail}><section><h3>Rythme individuel observé</h3><p>{count === undefined ? "Fréquence non disponible" : `${integerFormatter.format(count)} fois`}{interval === undefined ? null : <> · {interval <= 1 ? "environ chaque jour" : `environ tous les ${integerFormatter.format(interval)} jours`}</>}</p></section><HumanQualityNote quality={model.quality} /></div>;
  }
  const medianAmount = median?.typedMeasure?.kind === "MONEY" ? m2TypedNumber(median) : undefined;
  const knownCount = m2TypedNumber(known);
  const totalCount = m2TypedNumber(total);
  const coverageRatio = m2TypedNumber(coverage);
  const personRows = model.rows.flatMap((row) => row.entityRef?.startsWith("person-activity:") ? [{ row, entityRef: row.entityRef }] : []);
  const activityName = lifeActivityName(model);
  const activitySubject = activityName?.toLocaleLowerCase("fr-FR") ?? "activités";
  return <div className={styles.lifeDetail}>
    <section><h3>{activityName === undefined ? "Ce que cette habitude nous coûte" : `Ce que nos ${activitySubject} nous coûtent`}</h3>{medianAmount === undefined ? <p className={styles.lifeEmpty}>Aucune conséquence financière n’est suffisamment étayée.</p> : <article className={styles.lifeCausalCard}><strong>{formatMoney(medianAmount)}</strong><span>En médiane quand un coût est connu.</span>{knownCount === undefined || totalCount === undefined || coverageRatio === undefined ? null : <p>Coût connu pour {integerFormatter.format(knownCount)} {activitySubject} sur {integerFormatter.format(totalCount)} · {formatLifeRatio(coverageRatio)}</p>}</article>}</section>
    {personRows.length === 0 ? null : <section><h3>Le rythme de chacun</h3><div className={styles.lifeContextRows}>{personRows.map(({ row, entityRef: personEntityRef }) => <LifePersonRhythm key={row.rowId} row={row} entityRef={personEntityRef} runtime={runtime} />)}</div><p>Aucun montant n’est attribué à une personne.</p></section>}
    <p className={styles.lifeNonAdditive}>Chaque habitude est à lire séparément : ces montants ne forment pas un total.</p><HumanQualityNote quality={model.quality} />
  </div>;
}

function LifeComponentRow({ row }: { readonly row: GlobalMomentComponentRow }) {
  const amount = row.amount.kind === "MONEY" ? m2TypedNumber({ typedMeasure: row.amount }) : undefined;
  return <article><span>{row.primaryLabel}</span><strong>{formatLifeMoney(amount)}</strong></article>;
}

function LifeMomentComposition({ model }: { readonly model: GlobalExpandedReadModel }) {
  const rows = model.momentComponentRows ?? [];
  const groups = model.componentGroups ?? [];
  if (rows.length === 0) return null;
  if (rows.length <= 8 || groups.length === 0) return <section><h3>Ce qui compose ce coût</h3><div className={styles.lifeComposition}>{rows.map((row) => <LifeComponentRow key={row.componentRef} row={row} />)}</div></section>;
  const groupedRefs = new Set(groups.flatMap(({ componentRefs }) => componentRefs));
  const ungroupedRows = rows.filter(({ componentRef }) => !groupedRefs.has(componentRef));
  return <section><h3>Ce qui compose ce coût</h3><div className={styles.lifeComponentGroups}>{groups.map((group) => {
    const amount = group.amount.kind === "MONEY" ? m2TypedNumber({ typedMeasure: group.amount }) : undefined;
    const componentRows = rows.filter(({ componentRef }) => group.componentRefs.includes(componentRef));
    return <details key={group.groupKey}><summary><span><strong>{group.groupLabel}</strong><small>{integerFormatter.format(group.count)} dépenses</small></span><b>{formatLifeMoney(amount)}</b><ChevronRight aria-hidden size={17} /></summary><div>{componentRows.map((row) => <LifeComponentRow key={row.componentRef} row={row} />)}</div></details>;
  })}{ungroupedRows.length === 0 ? null : <details><summary><span><strong>Autres dépenses reliées</strong><small>{integerFormatter.format(ungroupedRows.length)} dépenses</small></span><ChevronRight aria-hidden size={17} /></summary><div>{ungroupedRows.map((row) => <LifeComponentRow key={row.componentRef} row={row} />)}</div></details>}</div></section>;
}

function LifeMomentDetail({ model, entityRef, runtime, onOpenTimelinePeer }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly runtime: GlobalV2VisitRuntime; readonly onOpenTimelinePeer: (peer: GlobalTimelineComparisonEventObservation) => void }) {
  const identity = model.rows[0];
  const causal = metricBySuffix(model, ":causal-cost");
  const timelineRequest = useMemo(() => ({ resource: "analysis_global_life_timeline" as const, params: {} }), []);
  const timelineResult = useGlobalV2Resource<GlobalLifeTimelineV2ReadModel>(runtime, timelineRequest, true, "BACKGROUND");
  const timelineModel = transportData(timelineResult.state);
  const timelineEvent = timelineModel?.events.find((event) => event.eventRef === entityRef);
  const momentType = lifeMomentType(identity?.displayValue);
  const dateRange = lifeMomentDates(identity?.displayValue, true);
  const causalAmount = causal?.typedMeasure?.kind === "MONEY" ? m2TypedNumber(causal) : undefined;
  const spentDuring = model.spentDuringContext;
  const spentDuringAmount = spentDuring?.cost.status === "KNOWN" || spentDuring?.cost.status === "PARTIAL" ? spentDuring.cost.value.kind === "MONEY" ? m2TypedNumber({ typedMeasure: spentDuring.cost.value }) : undefined : undefined;
  return <div className={styles.lifeDetail}>
    {momentType === undefined && dateRange === undefined ? null : <header className={styles.lifeMomentIdentity} aria-label="Identité du moment">{momentType === undefined ? null : <strong>{momentType}</strong>}{dateRange === undefined ? null : <p>{dateRange}</p>}</header>}
    {causalAmount === undefined ? null : <section><h3>Dépenses reliées à ce moment</h3><article className={styles.lifeCausalCard}><strong>{formatLifeMoney(causalAmount)}</strong><p>Ce montant regroupe uniquement les dépenses reliées à ce moment.</p></article></section>}
    <LifeMomentComposition model={model} />
    <section><h3>Relations sémantiques</h3>{timelineEvent === undefined || timelineEvent.comparisonLevels.length === 0 ? <p className={styles.lifeEmpty}>Aucun événement relié n’est disponible.</p> : <TimelineComparator event={timelineEvent} runtime={runtime} onOpenPeer={onOpenTimelinePeer} />}</section>
    {spentDuring === undefined ? null : <details className={styles.lifePeriodContext}><summary>Contexte de période <ChevronRight aria-hidden size={17} /></summary><div><span>{spentDuring.label}</span><strong>{formatLifeMoney(spentDuringAmount)}</strong><p>Ce montant couvre la période, indépendamment des dépenses reliées au moment.</p></div></details>}
    <HumanQualityNote quality={model.quality} />
  </div>;
}

function LifeExpandedContent({ model, entityRef, onDetail, onOpenPeer, onOpenTimelinePeer, runtime }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly onDetail: (row: GlobalDetailRow, title?: string) => void; readonly onOpenPeer: (peer: GlobalMomentPeerObservation) => void; readonly onOpenTimelinePeer: (peer: GlobalTimelineComparisonEventObservation) => void; readonly runtime: GlobalV2VisitRuntime }) {
  if (model.resource === "analysis_global_routine_detail") return <LifeActivityDetail model={model} entityRef={entityRef} runtime={runtime} />;
  if (model.resource === "analysis_global_moment_experience_detail") return <LifeMomentDetail model={model} entityRef={entityRef} runtime={runtime} onOpenTimelinePeer={onOpenTimelinePeer} />;
  if (model.sectionKey === "OVERVIEW") return null;
  if (model.sectionKey === "PATTERNS") return <div className={styles.lifeTabContent}><LifeActivityProfiles model={model} onDetail={onDetail} /></div>;
  if (model.sectionKey === "BREAKDOWN") return <div className={styles.lifeTabContent}><LifeMoments model={model} runtime={runtime} onDetail={onDetail} /></div>;
  return <div className={styles.lifeTabContent}><LifeInsightList model={model} onDetail={onDetail} /></div>;
}

function GlobalExpandedContent({ model, entityRef, onDetail, onOpenPeer, onOpenTimelinePeer, runtime, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly onDetail: (row: GlobalDetailRow, title?: string) => void; readonly onOpenPeer: (peer: GlobalMomentPeerObservation) => void; readonly onOpenTimelinePeer: (peer: GlobalTimelineComparisonEventObservation) => void; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string }) {
  if (model.sectionKey === "METHODOLOGY" && model.moduleKey === "ECONOMIC") return <EconomicMethod model={model} certifiedThrough={certifiedThrough} />;
  if (model.sectionKey === "METHODOLOGY" && model.moduleKey === "RHYTHM") return <LifeMethod model={model} />;
  if (model.sectionKey === "METHODOLOGY") return <div className={styles.expandedContent}><HumanRows rows={model.rows} onDetail={onDetail} /><HumanQualityNote quality={model.quality} /></div>;
  if (model.resource === "analysis_global_economic_recurrence_detail") return <EconomicRecurrenceDetail model={model} />;
  if (model.resource === "analysis_global_category_need_detail") return <M2EntityDetail model={model} entityRef={entityRef} certifiedThrough={certifiedThrough} />;
  if (model.resource === "analysis_global_categories_needs_expanded") return <M2ExpandedContent model={model} onDetail={onDetail} runtime={runtime} certifiedThrough={certifiedThrough} />;
  if (model.moduleKey === "RHYTHM" || model.resource === "analysis_global_moment_experience_detail") return <LifeExpandedContent model={model} entityRef={entityRef} onDetail={onDetail} onOpenPeer={onOpenPeer} onOpenTimelinePeer={onOpenTimelinePeer} runtime={runtime} />;
  if (model.resource === "analysis_global_economic_expanded") return <div className={styles.expandedContent}>
    {model.sectionKey === "OVERVIEW" ? <EconomicSummary model={model} certifiedThrough={certifiedThrough} /> : null}
    {model.sectionKey === "EVOLUTION" ? <ExpandedPreview runtime={runtime} moduleKey="ECONOMIC" sectionKey="OVERVIEW">{(overview) => <><EconomicEvolution model={model} overview={overview} certifiedThrough={certifiedThrough} /><SpendingSignals model={model} /></>}</ExpandedPreview> : null}
    {model.sectionKey === "BREAKDOWN" ? <ExpandedPreview runtime={runtime} moduleKey="ECONOMIC" sectionKey="OVERVIEW">{(overview) => <EconomicStructure model={model} overview={overview} certifiedThrough={certifiedThrough} />}</ExpandedPreview> : null}
    {model.sectionKey === "PATTERNS" ? <RecurringPayments model={model} /> : null}
  </div>;
  return <div className={styles.expandedContent}>
    {model.primaryInsight === undefined ? null : <article className={styles.secondaryInsight}><strong>{humanLabel(model.primaryInsight.titleKey)}</strong><p>{humanLabel(model.primaryInsight.statementKey)}</p></article>}
    {model.secondaryInsights.map((item) => <article key={item.insightId} className={styles.secondaryInsight}><strong>{humanLabel(item.titleKey)}</strong><p>{humanLabel(item.statementKey)}</p></article>)}
    {model.metrics.length === 0 ? null : <div className={styles.expandedMetrics}>{model.metrics.map((metric) => <div key={metric.metricId}><span>{humanLabel(metric.labelKey)}</span><strong>{metric.dataNature === "ESTIMATED" && !metric.displayValue.startsWith("≈") ? `≈ ${metric.displayValue}` : metric.displayValue}</strong></div>)}</div>}
    <GlobalSeries model={model} />
    <HumanRows rows={model.rows} onDetail={onDetail} />
    <HumanQualityNote quality={model.quality} />
    <div className={styles.expandedActions}><Link className="button-ghost" href="/historique">Voir dans l’Historique</Link><Link className="button-ghost" href="/operations">Voir les opérations</Link></div>
  </div>;
}

function useExpandedModule(runtime: GlobalV2VisitRuntime, moduleKey: GlobalPrimaryModuleKey, sectionKey: GlobalExpandedSectionKey, enabled = true) {
  const resource = globalModulePresentation(moduleKey).expandedResource;
  const request = useMemo(() => ({ resource, params: { sectionKey } }), [resource, sectionKey]);
  return useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, enabled, "BACKGROUND");
}

function ExpandedPreview({ runtime, moduleKey, sectionKey, children }: { readonly runtime: GlobalV2VisitRuntime; readonly moduleKey: GlobalPrimaryModuleKey; readonly sectionKey: GlobalExpandedSectionKey; readonly children: (model: GlobalExpandedReadModel) => React.ReactNode }) {
  const result = useExpandedModule(runtime, moduleKey, sectionKey);
  const model = transportData(result.state);
  if (model !== undefined) return children(model);
  if (result.state.status === "ERROR") return <LocalError retry={result.retry} />;
  return <LoadingCard label="la visualisation" compact />;
}

type RhythmSlot = "car" | "food";
type AtomicSlot = "spending" | "categories" | "life" | "profiles" | RhythmSlot;
type AtomicFocus =
  | { readonly kind: "query"; readonly slot: AtomicSlot; readonly target: OverlayTarget }
  | { readonly kind: "event"; readonly slot: "life"; readonly event: DashboardEvent }
  | { readonly kind: "person"; readonly slot: "profiles"; readonly person?: "adrien" | "manon" }
  | { readonly kind: "vehicle"; readonly slot: "car" }
  | { readonly kind: "rhythm-chart"; readonly slot: RhythmSlot }
  | { readonly kind: "rhythm-month"; readonly slot: RhythmSlot; readonly month: string };

type DashboardTimeline = GlobalLifeTimelineReadModel | GlobalLifeTimelineV2ReadModel | GlobalLifeTimelineV3ReadModel;
type DashboardEvent = DashboardTimeline["events"][number];
type OpenFocus = (focus: AtomicFocus) => void;

const timelineRequest = { resource: "analysis_global_life_timeline", params: {} } as const;
const personaPanelRequest = { resource: globalV2PersonaPanelResource, params: {} } as const;
const AtomicPersona = lazy(() => import("./persona/atomic-persona"));
const categoryColors = ["#8051ae", "#b370a4", "#667eb6", "#b27c48", "#647f98", "#946ba8"];
const distributionModes = {
  categories: "Catégories",
  "Fixe / variable": "Fixes et variables",
  "Nécessité": "Degré de nécessité",
  "Périmètre de vie": "Quotidien et hors quotidien",
} as const;
type DistributionMode = keyof typeof distributionModes;

function MonthlyDistribution({ model, axis }: {
  readonly model: GlobalExpandedReadModel;
  readonly axis: Exclude<DistributionMode, "categories">;
}) {
  const rows = economicStructureGroups(model.rows).find((group) => group.axis === axis)?.rows ?? [];
  const measured = rows.flatMap((row) => {
    const amount = economicNumber(row);
    return amount === undefined ? [] : [{ row, amount, label: economicStructureLabel(row), share: rowPercentage(row) }];
  });
  const max = Math.max(1, ...measured.map(({ amount }) => amount));
  if (measured.length === 0) return <p className={atomic.note}>Répartition indisponible pour ce mois.</p>;
  return <ul className={atomic.distributionList} aria-label={distributionModes[axis]}>
    {measured.map(({ row, amount, label, share }, index) => <li key={row.rowId}>
      <span>{label}</span>
      <strong>{formatMoney(amount)}{share !== undefined && <small>{share} %</small>}</strong>
      <i aria-hidden><b style={{ width: `${Math.max(0, share ?? amount / max * 100)}%`, background: categoryColors[index % categoryColors.length] }} /></i>
    </li>)}
  </ul>;
}

const atomicSections = {
  spending: { id: "economie", title: "Nos dépenses", icon: "expenses" },
  categories: { id: "categories", title: "Répartition des dépenses", icon: "categories" },
  life: { id: "rythmes", title: "Vie et dépenses", icon: "events" },
  profiles: { id: "profils", title: "Nos profils", icon: "profiles" },
  car: { id: "voiture", title: "Voiture, trajets et carburant", icon: "car" },
  food: { id: "alimentation", title: "Courses et alimentation", icon: "groceries" },
} as const;

function Atom(props: Omit<ComponentProps<typeof DensityAtom>, "className" | "motionClassName">) {
  return <DensityAtom {...props} className={atomic.atom} motionClassName={atomic.motion} />;
}

function AtomicSection({ slot, children, detail, actions, active }: { readonly slot: AtomicSlot; readonly children: ReactNode; readonly detail?: ReactNode; readonly actions?: ReactNode; readonly active: boolean }) {
  const { id, title, icon } = atomicSections[slot];
  return <section className={atomic.section} data-global-section={slot} data-adaptive-region data-adaptive-active={active || undefined} id={id} aria-labelledby={`${id}-title`}>
    <div className={atomic.flow} data-adaptive-flow>
      <Atom name="heading" priority={100} minimum={1}>
        <div className={atomic.sectionHeader}>
          <h2 id={`${id}-title`} className={atomic.heading}><GlobalClayIcon name={icon} size={34} />{title}</h2>
          {actions}
        </div>
      </Atom>
      {children}
      {detail}
    </div>
  </section>;
}

function FocusLink({ children, onClick }: { readonly children: ReactNode; readonly onClick: () => void }) {
  return <button className={atomic.focusLink} type="button" onClick={onClick}>{children}<ChevronRight size={14} aria-hidden /></button>;
}

function dashboardEventValue(event: DashboardEvent) {
  if ("eventCost" in event) return timelineEventAmount(event);
  const cost = event.causalCost;
  return cost.status === "KNOWN" || cost.status === "PARTIAL" ? `${formatLifeMoney(Number(cost.value.value))}${cost.status === "PARTIAL" ? " · Partiel" : ""}` : "Coût à renseigner";
}


function SpendingSignals({ model }: { readonly model: GlobalExpandedReadModel }) {
  const value = (id: string) => economicNumber(economicMetric(model, id));
  const trend = value("trend-slope");
  const recent = value("recent-delta");
  const recentLevel = value("recent-current");
  const previousLevel = value("recent-previous");
  const levelMax = Math.max(recentLevel ?? 0, previousLevel ?? 0, 1);
  const min = value("dispersion-min");
  const max = value("dispersion-max");
  const median = value("dispersion-median");
  const q1 = value("dispersion-q1");
  const q3 = value("dispersion-q3");
  const spread = value("dispersion-mad");
  if ([trend, recent, min, max, spread].every((number) => number === undefined)) return null;
  const position = (point: number | undefined) => min !== undefined && max !== undefined && point !== undefined
    ? (max > min ? Math.max(0, Math.min(100, (point - min) / (max - min) * 100)) : 50)
    : undefined;
  const medianPosition = position(median);
  const lowerQuartile = position(q1);
  const upperQuartile = position(q3);

  return <div className={atomic.spendingSignals} aria-label="Tendance et écarts sur la période">
    {([[trend, "Tendance sur la période"], [recent, "3 derniers mois vs 3 précédents"]] as const).map(([amount, label]) =>
      amount === undefined ? null : <article key={label}>
        <span>{label}</span>
        <strong>{amount < 0 ? <ArrowDown aria-hidden size={14} /> : amount > 0 ? <ArrowUp aria-hidden size={14} /> : null}{formatMoney(amount, { signed: true, perMonth: true })}</strong>
        {label.startsWith("3 derniers mois") && previousLevel !== undefined && recentLevel !== undefined && <div className={atomic.levelComparison}
          role="img" aria-label={`Niveau précédent ${formatMoney(previousLevel)}, niveau récent ${formatMoney(recentLevel)}`}>
          <i style={{ width: `${previousLevel / levelMax * 100}%` }} /><i style={{ width: `${recentLevel / levelMax * 100}%` }} />
        </div>}
      </article>)}
    {min !== undefined && max !== undefined && <article className={atomic.spendRange}>
      <span>Du mois le moins cher au plus cher</span>
      <div className={atomic.rangeTrack} aria-hidden>
        {lowerQuartile !== undefined && upperQuartile !== undefined && <b style={{ left: `${lowerQuartile}%`, width: `${Math.max(0, upperQuartile - lowerQuartile)}%` }} />}
        {medianPosition !== undefined && <i style={{ left: `${medianPosition}%` }} />}</div>
      <div><strong>{formatMoney(min)}</strong><strong>{formatMoney(max)}</strong></div>
      {spread !== undefined && <small>La moitié des mois à ± {formatMoney(spread)} du mois habituel</small>}
    </article>}
  </div>;
}

function RecurringPayments({ model }: { readonly model: GlobalExpandedReadModel }) {
  const rows = model.rows.filter((row) => (row.knowledgeState === "KNOWN" || row.knowledgeState === "PARTIAL") && economicNumber(row) !== undefined)
    .toSorted((a, b) => (economicNumber(b) ?? 0) - (economicNumber(a) ?? 0));
  return <section aria-label="Dépenses récurrentes">
    <div className={atomic.historyTitle}><h3>Dépenses récurrentes</h3><span>Montant habituel par paiement</span></div>
    {rows.length === 0 ? <p className={atomic.note}>Aucun paiement récurrent suffisamment renseigné.</p> : <div className={atomic.recurrenceRail} tabIndex={0}>
      {rows.map((row) => {
        const [merchant, ...rest] = humanLabel(row.labelKey).split(/\s+[–—]\s+/u);
        const [count, dates] = recurrencePresentation(row).detail.split(" · ");
        const content = <><span>{merchant}</span>{rest.length > 0 && <span title={rest.join(" · ")}>{rest.join(" · ")}</span>}
          <strong>{formatMoney(economicNumber(row), { approximate: true })}</strong>
          {count && <small>{count}</small>}{dates && <small>{dates}</small>}</>;
        return <article key={row.rowId}>{content}</article>;
      })}
    </div>}
  </section>;
}

function AtomicTimeline({ model, open, selectedEvent, onPeriodChange, compact }: {
  readonly model: DashboardTimeline;
  readonly open: OpenFocus;
  readonly selectedEvent?: DashboardEvent;
  readonly onPeriodChange: () => void;
  readonly compact: boolean;
}) {
  const [month, setSelected] = useState<string>();
  const { changeLayout } = useContext(GlobalLayoutMotion);
  const months = useMemo(() => groupTimelineEvents(model.events).flatMap((year) => year.months), [model.events]);
  const current = months.find(({ key }) => key === month);
  const busiestMonth = Math.max(1, ...months.map(({ events }) => events.length));
  const events = current?.events ?? model.events;
  useEffect(() => {
    const month = new URLSearchParams(window.location.search).get("mois-evenements");
    if (months.some(entry => entry.key === month)) setSelected(month ?? undefined);
  }, [months]);
  return <>
    {months.length > 0 && <Atom name="event-months" priority={72} minimum={compact ? 0 : 1}>
      <div className={atomic.timelineSummary}>
        <div className={atomic.historyTitle}><h3>Événements par mois</h3><span>{current ? capitalize(frenchMonth(current.key)) : "Période entière"} · {events.length} {events.length === 1 ? "événement" : "événements"}</span></div>
        <div className={atomic.ruler}>{months.map(({ key, events }) =>
          <button key={key} type="button" aria-pressed={current?.key === key} aria-label={`${capitalize(frenchMonth(key))} · ${events.length} ${events.length === 1 ? "événement" : "événements"}`}
            onClick={() => changeLayout(() => {
              const next = month === key ? undefined : key;
              setSelected(next);
              replaceViewSearch({ "mois-evenements": next });
              onPeriodChange();
            })}>
            <span className={atomic.barWell}><i style={{ height: `${events.length / busiestMonth * 100}%` }} /></span>
            <small>{frenchMonth(key, true).split(" ")[0]}</small>
          </button>)}</div>
      </div>
    </Atom>}
    <Atom name="timeline" priority={68} minimum={compact ? 0 : 1}>
      {events.length === 0 ? <p className={atomic.note}>Aucun événement sur cette période.</p> : <div className={atomic.timelineStrip} aria-label="Événements sur la période" key={current?.key ?? "all"}>
        {events.map((event) => <button type="button" key={event.eventRef} aria-pressed={selectedEvent?.eventRef === event.eventRef} aria-label={`${event.canonicalName} · ${dashboardEventValue(event)}`}
          onClick={() => open({ kind: "event", slot: "life", event })}><i aria-hidden /><time dateTime={event.startDate}>{lifeMomentDates(event.startDate, false)?.split(" ").slice(0, 2).join(" ")}</time><strong title={event.canonicalName}>{event.canonicalName}</strong><small>{dashboardEventValue(event)}</small></button>)}
      </div>}
    </Atom>
  </>;
}

function AtomicQueryDetail({ target, runtime, certifiedThrough, open, slot }: { readonly target: OverlayTarget; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly open: OpenFocus; readonly slot: AtomicSlot }) {
  const section = target.initialSection ?? (target.moduleKey === "CATEGORIES_NEEDS" ? "BREAKDOWN" : "OVERVIEW");
  const params: GlobalV2UiRequest["params"] = target.kind === "METHODOLOGY" ? { moduleKey: target.moduleKey, methodRef: target.entityRef }
    : target.kind === "ENTITY_DETAIL" ? { entityRef: target.entityRef }
      : { sectionKey: section };
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, { resource: target.resource, params }, true, "DIRECT");
  const model = transportData(result.state);
  if (model === undefined) return result.state.status === "ERROR" ? <LocalError retry={result.retry} /> : <LoadingCard label={target.title} compact />;
  const openTarget = (next: OverlayTarget | undefined) => {
    if (next) open({ kind: "query", slot, target: next });
  };
  return <div data-rhythm-detail-origin={target.rhythmDetailContext?.origin}>
    <GlobalExpandedContent model={model} entityRef={target.entityRef} runtime={runtime} certifiedThrough={certifiedThrough}
      onDetail={(row, label) => { if (row.entityRef) openTarget(entityOverlayTarget(target.moduleKey, row.entityRef, label ?? humanLabel(row.labelKey), section)); }}
      onOpenPeer={(peer) => openTarget(entityOverlayTarget("RHYTHM", peer.peerRef, peer.canonicalName, undefined, "NARRATIVE"))}
      onOpenTimelinePeer={(peer) => {
        if (peer.sourceKind === "LIFE_EVENT") window.dispatchEvent(new CustomEvent("global-v2:focus-life-event", { detail: { eventRef: peer.eventRef } }));
        else openTarget(entityOverlayTarget("RHYTHM", peer.eventRef, peer.canonicalName, undefined, "NARRATIVE"));
      }} />
  </div>;
}

function AtomicEventDetail({ event, runtime, certifiedThrough, open }: { readonly event: DashboardEvent; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly open: OpenFocus }) {
  const target = ("momentDetailAvailable" in event ? event.momentDetailAvailable : event.detailAvailability === "MOMENT_DETAIL")
    ? entityOverlayTarget("RHYTHM", event.eventRef, event.canonicalName, undefined, "NARRATIVE") : undefined;
  return <>
    <div className={atomic.eventFacts}>
      <span>{lifeMomentDates(`${event.startDate} → ${event.endDate}`, true)}</span>
      <strong>{dashboardEventValue(event)}</strong>
      {"primaryPlaceLabel" in event && event.primaryPlaceLabel ? <span>{event.primaryPlaceLabel}</span> : null}
      {"eventCost" in event && <TimelineEventFacts event={event} />}
    </div>
    {"eventCost" in event && event.comparisonLevels.length > 0 ? <TimelineComparator event={event} runtime={runtime} onOpenPeer={(peer) => window.dispatchEvent(new CustomEvent("global-v2:focus-life-event", { detail: { eventRef: peer.eventRef } }))} /> : null}
    {target && <AtomicQueryDetail target={target} runtime={runtime} certifiedThrough={certifiedThrough} open={open} slot="life" />}
  </>;
}

function AtomicProfiles({ runtime, person, vehicle }: { readonly runtime: GlobalV2VisitRuntime; readonly person?: "adrien" | "manon"; readonly vehicle?: boolean }) {
  const result = useGlobalV2Resource<GlobalV2PersonaPanelModel>(runtime, personaPanelRequest, true, "DIRECT");
  const model = transportData(result.state);
  const placeholder = result.state.status === "ERROR" ? <LocalError retry={result.retry} /> : <LoadingCard label="Profils" compact />;
  return model === undefined ? placeholder : <Suspense fallback={placeholder}><AtomicPersona model={model} person={person} vehicle={vehicle} /></Suspense>;
}

const slotForModule: Partial<Record<GlobalPrimaryModuleKey, AtomicSlot>> = {
  ECONOMIC: "spending", CATEGORIES_NEEDS: "categories", RHYTHM: "life", PERSONAS: "profiles",
};

export function GlobalV2Page({ bundle, transport, certifiedThrough }: { readonly bundle: GlobalV2PageBundle; readonly transport: GlobalV2UiTransport; readonly certifiedThrough: string }) {
  const runtime = useMemo(() => new GlobalV2VisitRuntime(bundle.initial.publicationMeta, transport, 2), [bundle.initial.publicationMeta, transport]);
  const visible = useMemo(() => new Set(bundle.initial.navigation.filter(({ visibility }) => visibility !== "HIDDEN").map(({ moduleKey }) => moduleKey)), [bundle.initial.navigation]);
  const motion = useGlobalLayoutMotion();
  const { changeLayout } = motion;
  const [trail, setTrail] = useState<readonly AtomicFocus[]>([]);
  const focus = trail.at(-1);
  const left = useAdaptiveColumn(motion.revision, "[data-fit-detail]", "global-layout");
  const right = useAdaptiveColumn(motion.revision, "[data-fit-detail]", "global-layout");
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const [previewMonth, setPreviewMonth] = useState<string>();
  const [distribution, setDistribution] = useState<DistributionMode>("categories");
  const origin = useRef<HTMLElement | null>(null);
  const dashboard = useRef<HTMLDivElement>(null);
  const restoreCategory = useRef<string>(undefined);
  const detailRef = useRef<HTMLElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const timing = useRef<ReturnType<typeof startDetailTiming>>(null);
  const restored = useRef(false);
  const open = useCallback<OpenFocus>((next) => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inside = detailRef.current?.contains(active) ?? false;
    if (!inside && next.kind !== "rhythm-month") origin.current = active;
    if (next.kind === "query") {
      const event = next.target.kind === "ENTITY_DETAIL" ? "global_entity_opened"
        : next.target.kind === "METHODOLOGY" ? "global_methodology_opened" : "global_module_expanded";
      emitGlobalV2UxEvent(event, { moduleKey: next.target.moduleKey });
    }
    timing.current?.cancel();
    timing.current = startDetailTiming("analyse-globale");
    replaceViewSearch({
      "categorie-analyse": next.kind === "query" && next.slot === "categories" ? next.target.entityRef : undefined,
      profil: next.kind === "person" ? next.person ?? "comparaison" : undefined,
      "evenement-analyse": next.kind === "event" ? next.event.eventRef : undefined,
    });
    changeLayout(() => setTrail((current) => {
      const previous = current.at(-1);
      if (next.kind === "rhythm-month" && previous?.slot === next.slot) {
        return previous.kind === "rhythm-chart" ? [previous, next] : [...current.slice(0, -1), next];
      }
      return inside && previous?.slot === next.slot ? [...current, next] : [next];
    }));
  }, [changeLayout]);

  function close() {
    changeLayout(resetFocus);
  }

  function resetFocus() {
    timing.current?.cancel();
    restoreCategory.current = focus?.kind === "query" && focus.slot === "categories" ? focus.target.entityRef : undefined;
    replaceViewSearch({ "categorie-analyse": undefined, profil: undefined, "evenement-analyse": undefined });
    setTrail([]);
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    origin.current?.focus({ preventScroll: true });
  }

  const figures = useExpandedModule(runtime, "ECONOMIC", "OVERVIEW", visible.has("ECONOMIC"));
  const history = useExpandedModule(runtime, "ECONOMIC", "EVOLUTION", visible.has("ECONOMIC"));
  const categoriesResult = useExpandedModule(runtime, "CATEGORIES_NEEDS", "BREAKDOWN", visible.has("CATEGORIES_NEEDS"));
  const timelineResult = useGlobalV2Resource<DashboardTimeline>(runtime, timelineRequest, visible.has("RHYTHM"), "BACKGROUND");
  const recurrences = useExpandedModule(runtime, "ECONOMIC", "PATTERNS", visible.has("ECONOMIC"));
  const structureResult = useExpandedModule(runtime, "ECONOMIC", "BREAKDOWN", visible.has("CATEGORIES_NEEDS") && distribution !== "categories");
  const background = useBackgroundRhythms(runtime, visible.has("RHYTHM"));
  const recentChanges = useExpandedModule(runtime, "CATEGORIES_NEEDS", "COMPARISONS",
    !!selectedMonth && selectedMonth === certifiedThrough.slice(0, 7) && visible.has("CATEGORIES_NEEDS"));
  const recurring = transportData(recurrences.state);
  const structure = transportData(structureResult.state);
  const overview = transportData(figures.state);
  const evolution = transportData(history.state);
  const categories = transportData(categoriesResult.state);
  const timeline = transportData(timelineResult.state);
  const period = analysisPeriod(certifiedThrough);

  useEffect(() => () => timing.current?.cancel(), []);

  useEffect(() => {
    if (restored.current) return;
    const params = new URLSearchParams(window.location.search);
    const month = params.get("mois-depenses");
    const person = params.get("profil");
    const categoryId = params.get("categorie-analyse");
    const eventId = params.get("evenement-analyse");
    if ((month && !evolution) || (categoryId && !categories) || (eventId && !timeline)) return;
    restored.current = true;
    if (month && evolution?.series.some(series => series.seriesId === "economic:actual" && series.points.some(point => point.unitKey === month))) setSelectedMonth(month);
    const category = categories?.rows.find(row => row.entityRef === categoryId);
    const event = timeline?.events.find(entry => entry.eventRef === eventId);
    if (category?.entityRef) {
      const target = entityOverlayTarget("CATEGORIES_NEEDS", category.entityRef, humanLabel(category.labelKey), "BREAKDOWN");
      if (target) setTrail([{ kind: "query", slot: "categories", target }]);
    } else if (event) setTrail([{ kind: "event", slot: "life", event }]);
    else if (visible.has("PERSONAS") && (person === "adrien" || person === "manon" || person === "comparaison")) {
      setTrail([{ kind: "person", slot: "profiles", person: person === "comparaison" ? undefined : person }]);
    }
  }, [categories, evolution, timeline, visible]);

  useEffect(() => {
    function followHash() {
      const anchor = parseGlobalDeepLink(window.location.hash)?.anchor;
      const [slug, raw] = (anchor ?? "").split(/-(?=overview|evolution|breakdown|patterns|comparisons$)/u);
      const moduleKey = moduleForSlug(slug);
      const slot = moduleKey === undefined ? undefined : slotForModule[moduleKey];
      if (moduleKey === undefined || slot === undefined || !visible.has(moduleKey)) { setTrail([]); return; }
      if (slot === "profiles") { setTrail([{ kind: "person", slot }]); return; }
      if (!raw || slot === "categories") { setTrail([]); return; }
      setTrail([{ kind: "query", slot, target: moduleOverlayTarget(moduleKey, raw.toUpperCase() as GlobalExpandedSectionKey) }]);
    }
    if (window.location.hash) followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [visible]);

  useEffect(() => {
    function followEvent(raw: Event) {
      const eventRef = (raw as CustomEvent<{ eventRef?: string }>).detail?.eventRef;
      const event = timeline?.events.find((entry) => entry.eventRef === eventRef);
      if (event) open({ kind: "event", slot: "life", event });
    }
    window.addEventListener("global-v2:focus-life-event", followEvent);
    return () => window.removeEventListener("global-v2:focus-life-event", followEvent);
  }, [open, timeline]);

  useLayoutEffect(() => {
    if (!focus) {
      const category = restoreCategory.current;
      if (category) focusCategoryRankingRow(dashboard.current, category);
      restoreCategory.current = undefined;
      return;
    }
    timing.current?.visible("structure");
    detailHeading.current?.focus({ preventScroll: true });
    const panel = detailRef.current;
    const markReady = () => {
      if (!panel?.querySelector('[aria-busy="true"]')) timing.current?.visible("content");
    };
    markReady();
    const observer = new MutationObserver(markReady);
    if (panel) observer.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-busy"] });
    return () => observer.disconnect();
  }, [focus]);

  const query = (slot: AtomicSlot, moduleKey: GlobalPrimaryModuleKey, section: GlobalExpandedSectionKey, title: string) =>
    open({ kind: "query", slot, target: { ...moduleOverlayTarget(moduleKey, section), title } });

  const actual = evolution?.series.find(({ seriesId }) => seriesId === "economic:actual");
  const typical = evolution?.series.find(({ seriesId }) => seriesId === "economic:typical-state");
  const chartMax = Math.max(1, ...(actual?.points.map((point) => economicNumber(point) ?? 0) ?? []), ...(typical?.points.map((point) => economicNumber(point) ?? 0) ?? []));
  const visibleRows = (categories?.rows ?? []).filter((row) => m2TypedNumber(row) !== undefined);
  const categoryMaximum = Math.max(1, ...visibleRows.map((row) => m2TypedNumber(row) ?? 0));
  const chartMonths = actual?.points ?? [];
  const monthActual = economicNumber(chartMonths.find(({ unitKey }) => unitKey === selectedMonth));
  const monthTypical = economicNumber(typical?.points.find(({ unitKey }) => unitKey === selectedMonth));
  const chartReadoutMonth = previewMonth ?? selectedMonth;
  const chartReadout = economicNumber(chartMonths.find(point => point.unitKey === chartReadoutMonth));
  const chartReadoutReference = economicNumber(typical?.points.find(point => point.unitKey === chartReadoutMonth));
  const latestDrivers = transportData(recentChanges.state)?.rows.slice(0, 3) ?? [];
  const activeCategory = focus?.kind === "query" && focus.slot === "categories" ? focus.target.entityRef : undefined;
  const categoryDetailOpen = activeCategory?.startsWith("category:") === true;
  const selectedCategoryIndex = distribution === "categories" && activeCategory ? visibleRows.findIndex(row => row.entityRef === activeCategory) : -1;
  const selectedCategory = selectedCategoryIndex < 0 ? undefined : visibleRows[selectedCategoryIndex];
  const rankingScroll = useCategoryRankingScroll(selectedCategory?.entityRef, distribution);
  const isFocusing = focus !== undefined;
  const selectSection = (slot: AtomicSlot, moduleKey: GlobalPrimaryModuleKey, section: GlobalExpandedSectionKey, title: string) => {
    if (focus?.kind === "query" && focus.slot === slot && focus.target.initialSection === section && !focus.target.entityRef) close();
    else query(slot, moduleKey, section, title);
  };


  function detail(slot: AtomicSlot) {
    if (focus?.slot !== slot || (focus.kind === "rhythm-month" || focus.kind === "rhythm-chart")) return undefined;
    const title = focus.kind === "query" ? focus.target.title
      : focus.kind === "event" ? focus.event.canonicalName
      : focus.kind === "vehicle" ? "Assurance, entretien et coût du véhicule"
      : focus.person ? capitalize(focus.person) : "Adrien et Manon";
    return <Atom name="detail" priority={240} minimum={1}>
      <article className={atomic.detail} ref={detailRef} aria-labelledby="global-detail-title">
        <header className={atomic.detailHeader}>
          {trail.length > 1 && <button type="button" onClick={() => changeLayout(() => setTrail(trail.slice(0, -1)))} aria-label="Revenir au détail précédent"><ChevronLeft size={17} /></button>}
          <h3 tabIndex={-1} id="global-detail-title" ref={detailHeading}>{title}</h3>
          {focus.kind === "person" && focus.person && <button type="button" className={atomic.profileCompare}
            onClick={() => open({ kind: "person", slot: "profiles" })}>Comparer avec {focus.person === "adrien" ? "Manon" : "Adrien"}</button>}
          <button type="button" onClick={close} aria-label="Fermer le détail"><X size={17} /></button>
        </header>
        <AtomicDetailPages key={focus.kind === "query" ? [focus.target.entityRef, focus.target.initialSection].join(":") : focus.kind === "event" ? focus.event.eventRef : focus.kind === "vehicle" ? "vehicle" : focus.person ?? "profiles"}>
          {focus.kind === "query" ? <AtomicQueryDetail target={focus.target} slot={slot} runtime={runtime} certifiedThrough={certifiedThrough} open={open} />
            : focus.kind === "event" ? <AtomicEventDetail event={focus.event} runtime={runtime} certifiedThrough={certifiedThrough} open={open} />
            : focus.kind === "person" ? <AtomicProfiles runtime={runtime} person={focus.person} />
            : <AtomicProfiles runtime={runtime} vehicle />}
        </AtomicDetailPages>
      </article>
    </Atom>;
  }

  function categoryRow(row: GlobalDetailRow, index: number, expanded = false) {
    const label = humanLabel(row.labelKey);
    const value = m2TypedNumber(row) ?? 0;
    const target = row.entityRef && entityOverlayTarget("CATEGORIES_NEEDS", row.entityRef, label, "BREAKDOWN");
    const item = <><span>{label}</span><strong>{formatMoney(value)}</strong>{target && <ChevronDown size={13} aria-hidden />}
      <i aria-hidden><b style={{ width: `${Math.max(0, (value / categoryMaximum) * 100)}%`, background: categoryColors[index % categoryColors.length] }} /></i></>;
    return <li key={row.rowId} data-expanded={expanded || undefined}>
      {target ? <button type="button" data-category-trigger={row.entityRef} aria-expanded={expanded}
        aria-controls={expanded ? "global-category-detail" : undefined} onClick={() => expanded ? close() : open({ kind: "query", slot: "categories", target })}>{item}</button>
        : <div className={atomic.passiveBar}>{item}</div>}
      {expanded && <div id="global-category-detail">{detail("categories")}</div>}
    </li>;
  }

  function chartSizeButton(slot: RhythmSlot) {
    const enlarged = focus?.kind === "rhythm-chart" && focus.slot === slot;
    const label = slot === "car" ? "du carburant" : "de l’alimentation";
    return <button className={atomic.focusLink} type="button" aria-pressed={enlarged}
      aria-label={`${enlarged ? "Réduire" : "Agrandir"} le graphique ${label}`}
      onClick={() => enlarged ? close() : open({ kind: "rhythm-chart", slot })}>
      {enlarged ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
      {enlarged ? "Réduire" : "Agrandir"}
    </button>;
  }

  function rhythm(slot: RhythmSlot) {
    const selected = focus?.kind === "rhythm-month" && focus.slot === slot ? focus.month : undefined;
    return <Atom name={`${slot}-chart`} priority={120} minimum={isFocusing && focus?.slot !== slot ? 0 : 1}>
      <AtomicDetailPages inline={selected === undefined}>
        <BackgroundRhythms runtime={runtime} result={background} view={slot} selectedMonth={selected} onMonthChange={month => {
          if (month) open({ kind: "rhythm-month", slot, month });
          else if (selected !== undefined) changeLayout(() => setTrail(current => current.slice(0, -1)));
        }} />
      </AtomicDetailPages>
    </Atom>;
  }

  return <GlobalLayoutMotion.Provider value={motion}><div ref={dashboard} className={atomic.dashboard} data-global-v2="" data-publication-id={bundle.initial.publicationMeta.publicationId} onKeyDown={(event) => {
    if (event.key === "Escape" && focus) { event.preventDefault(); close(); }
  }}>
    <AppToolbarContent className={atomic.header}><h1>Analyse globale</h1><p>{period.label.replace("—", "→")}</p>
      {visible.has("ECONOMIC") && <button type="button" className={atomic.method} onClick={() => open({ kind: "query", slot: "spending", target: methodOverlayTarget("ECONOMIC") })}><Info aria-hidden size={15} /> Méthode</button>}
    </AppToolbarContent>
    {bundle.newerPublication && <aside className={atomic.banner} role="status"><strong>Une version plus récente est disponible.</strong><button type="button" onClick={() => window.location.reload()}><RefreshCw aria-hidden size={15} /> Actualiser</button></aside>}
    <div className={atomic.grid} data-focus={focus?.slot} data-category-focused={categoryDetailOpen || undefined} data-chart-focus={focus?.kind === "rhythm-chart" ? focus.slot : undefined} data-focus-size={focus?.kind === "event" && !("eventCost" in focus.event) ? "compact" : undefined}>
      <div ref={left} className={atomic.column} data-side="left">
        {visible.has("ECONOMIC") && <AtomicSection slot="spending" active={focus?.slot === "spending"} detail={detail("spending")}>
          <Atom name="financial-markers" priority={95} minimum={1}>{overview ? <div className={atomic.figures}>
            <div><span>{selectedMonth ? capitalize(frenchMonth(selectedMonth)) : period.targetLabel}</span>
              {selectedMonth ? <strong>{formatMoney(monthActual)}</strong> : <EconomicMetricValue metric={economicMetric(overview, "actual")} unknownText="Indisponible" />}
            </div>
            <div><span>{selectedMonth ? "Référence de ce mois" : "Mois habituel"}</span>
              {selectedMonth ? <strong>{formatMoney(monthTypical)}</strong> : <EconomicMetricValue metric={economicMetric(overview, "typical-state")} unknownText="Indisponible" />}
            </div>
            {selectedMonth ? <div><span>Écart à la référence</span><strong>{formatMoney(monthActual !== undefined && monthTypical !== undefined ? monthActual - monthTypical : undefined, { signed: true })}</strong></div>
              : <div><span>Dépenses minimum</span><EconomicMetricValue metric={economicMetric(overview, "minimal-state")} unknownText="Indisponible" /></div>}
          </div> : figures.state.status === "ERROR" ? <LocalError retry={figures.retry} /> : <LoadingCard label="chiffres clés" compact />}</Atom>
          <Atom name="monthly-history" priority={80} minimum={isFocusing ? 0 : 1}>
            {evolution === undefined ? history.state.status === "ERROR" ? <LocalError retry={history.retry} /> : <LoadingCard label="graphique des dépenses" compact /> :
              chartMonths.length === 0 ? <p className={atomic.note}>Évolution indisponible sur cette période.</p> :
                <section className={atomic.history} aria-label="Dépenses réelles et niveau habituel sur douze mois">
                  <div className={atomic.historyTitle}><h3>Dépenses par mois</h3><span><i />Niveau habituel · échelle en euros</span></div>
                  <div className={atomic.ruler} onPointerLeave={() => setPreviewMonth(undefined)}>{chartMonths.map((point) => {
                    const value = economicNumber(point);
                    const habitual = economicNumber(typical?.points.find(({ unitKey }) => unitKey === point.unitKey));
                    const title = capitalize(frenchMonth(point.unitKey));
                    return <button type="button" key={point.unitKey} aria-label={`${title} · ${formatMoney(value)}`} aria-pressed={selectedMonth === point.unitKey}
                      data-missing={value === undefined || undefined}
                      onPointerEnter={event => { if (event.pointerType === "mouse") setPreviewMonth(point.unitKey); }}
                      onFocus={() => setPreviewMonth(point.unitKey)} onBlur={() => setPreviewMonth(undefined)}
                      onClick={() => changeLayout(() => {
                        const next = selectedMonth === point.unitKey ? undefined : point.unitKey;
                        setSelectedMonth(next);
                        replaceViewSearch({ "mois-depenses": next });
                      })}>
                      <span className={atomic.barWell}><i style={{ height: `${((value ?? 0) / chartMax) * 100}%` }} />
                      {habitual !== undefined && <b style={{ bottom: `${(habitual / chartMax) * 100}%` }} />}</span>
                      <small>{frenchMonth(point.unitKey, true).split(" ")[0]}</small>
                    </button>;
                  })}</div>
                  <div className={atomic.chartReadout} aria-live="polite">
                    {chartReadoutMonth ? <><span>{capitalize(frenchMonth(chartReadoutMonth))}</span><strong>{formatMoney(chartReadout)}</strong>
                      {chartReadout !== undefined && chartReadoutReference !== undefined && <span>{formatMoney(chartReadout - chartReadoutReference, { signed: true })} vs habituel</span>}</>
                      : <span>Survole ou sélectionne un mois pour lire son montant.</span>}
                  </div>
                  {selectedMonth && <Link className={atomic.monthLink} href={isArchivedRealizedMonth(selectedMonth) ? composerBalanceHref(selectedMonth) : `/mois-a-venir/composer?month=${encodeURIComponent(selectedMonth)}`}>
                    {isArchivedRealizedMonth(selectedMonth) ? "Bilan" : "Cartes"} · {frenchMonth(selectedMonth)} <ChevronRight size={13} aria-hidden /></Link>}
                  {selectedMonth === certifiedThrough.slice(0, 7) && latestDrivers.length > 0 && <ul className={atomic.monthDrivers} aria-label="Postes les plus éloignés de l’habitude" data-budget-reveal>
                    {latestDrivers.map(row => {
                      const label = humanLabel(row.labelKey).replace(/^(?:Hausse|Baisse|Stable) · /u, "");
                      const target = row.entityRef && entityOverlayTarget("CATEGORIES_NEEDS", row.entityRef, label, "BREAKDOWN");
                      const content = <><span>{label}</span><strong>{formatMoney(m2TypedNumber(row), { signed: true })}</strong></>;
                      return <li key={row.rowId}>{target ? <button type="button" onClick={() => open({ kind: "query", slot: "categories", target })}>{content}</button> : content}</li>;
                    })}
                  </ul>}
                </section>}
          </Atom>
          {evolution && <Atom name="trend" priority={75} minimum={isFocusing ? 0 : 1}><SpendingSignals model={evolution} /></Atom>}
          <Atom name="recurring-payments" priority={66} minimum={isFocusing ? 0 : 1}>
            {recurring ? <RecurringPayments model={recurring} /> : recurrences.state.status === "ERROR" ? <LocalError retry={recurrences.retry} /> : <LoadingCard label="dépenses récurrentes" compact />}
          </Atom>
        </AtomicSection>}
        {visible.has("RHYTHM") && <AtomicSection slot="life" active={focus?.slot === "life"} detail={detail("life")}>
          {timeline === undefined ? <Atom name="timeline-status" priority={65}>{timelineResult.state.status === "ERROR" ? <LocalError retry={timelineResult.retry} /> : <LoadingCard label="événements" compact />}</Atom> :
            <AtomicTimeline model={timeline} compact={isFocusing} open={(next) => {
              if (next.kind === "event" && focus?.kind === "event" && next.event.eventRef === focus.event.eventRef) close();
              else open(next);
            }} selectedEvent={focus?.kind === "event" ? focus.event : undefined} onPeriodChange={() => { if (focus?.kind === "event") resetFocus(); }} />}
          <Atom name="everyday-rhythms" priority={63} minimum={1}><div className={atomic.actions}>
            <FocusLink onClick={() => selectSection("life", "RHYTHM", "PATTERNS", "Coûts des habitudes")}>Coûts des habitudes</FocusLink>
            <button className={atomic.focusLink} type="button" onClick={() => open({ kind: "query", slot: "life", target: methodOverlayTarget("RHYTHM") })}><Info size={13} aria-hidden /> Fiabilité et méthode</button>
          </div></Atom>
        </AtomicSection>}
      </div>
      <div ref={right} className={atomic.column} data-side="right">
        {visible.has("PERSONAS") && <AtomicSection slot="profiles" active={focus?.slot === "profiles"} detail={detail("profiles")}>
          <Atom name="portraits" priority={86} minimum={1}><div className={atomic.portraits}>
            {(["adrien", "manon"] as const).map((person) => <button type="button" key={person} aria-pressed={focus?.kind === "person" && focus.person === person}
              onClick={() => focus?.kind === "person" && focus.person === person ? close() : open({ kind: "person", slot: "profiles", person })}>
              <span className={atomic.portraitImage} aria-hidden>
                <GlobalClayIcon name="profiles" size={84} />
                <Image src={`/api/persona-portrait/${person}`} alt="" width={84} height={84} unoptimized onError={(event) => { event.currentTarget.hidden = true; }} />
              </span>
              <span><strong>{capitalize(person)}</strong><small>Travail, habitudes et projets</small></span><ChevronRight size={16} aria-hidden />
            </button>)}
          </div></Atom>
        </AtomicSection>}
        {visible.has("RHYTHM") && <AtomicSection slot="car" active={focus?.slot === "car"} detail={detail("car")} actions={
          <div className={atomic.chartActions}>
            {chartSizeButton("car")}
            <button className={atomic.focusLink} type="button" aria-expanded={focus?.kind === "vehicle"}
              onClick={() => focus?.kind === "vehicle" ? close() : open({ kind: "vehicle", slot: "car" })}>
              Assurance et entretien <ChevronRight size={13} aria-hidden />
            </button>
          </div>
        }>
          {focus?.kind !== "vehicle" && rhythm("car")}
        </AtomicSection>}
        {visible.has("RHYTHM") && <AtomicSection slot="food" active={focus?.slot === "food"} actions={chartSizeButton("food")}>
          {rhythm("food")}
        </AtomicSection>}
        {visible.has("CATEGORIES_NEEDS") && <AtomicSection slot="categories" active={focus?.slot === "categories"} detail={selectedCategory ? undefined : detail("categories")}>
          <Atom name="distribution-controls" priority={90} minimum={isFocusing && focus?.slot !== "categories" ? 0 : 1}>
            <div role="group" aria-label="Mode de répartition" className={atomic.distributionModes}>
              {(Object.keys(distributionModes) as DistributionMode[]).map((mode) => <button key={mode} type="button"
                aria-pressed={mode === distribution} onClick={() => {
                  if (mode === distribution) return;
                  changeLayout(() => {
                    if (focus?.slot === "categories") resetFocus();
                    setDistribution(mode);
                  });
                }}>{distributionModes[mode]}</button>)}
            </div>
            <p className={atomic.distributionPeriod}>{distribution === "categories" ? period.label.split(" · ")[0] : period.targetLabel}</p>
          </Atom>
          {selectedCategory && <Atom name="selectedCategory" priority={115} minimum={1}>
            <ul className={`${atomic.ranking} ${atomic.categoryPinned}`} data-open-category aria-label="Catégorie ouverte">
              {categoryRow(selectedCategory, selectedCategoryIndex, true)}
            </ul>
          </Atom>}
          <Atom name="category-ranking" priority={selectedCategory ? 68 : 75} minimum={selectedCategory || (isFocusing && focus?.slot !== "categories") ? 0 : 1}>
            {distribution !== "categories" ? structure ? <MonthlyDistribution model={structure} axis={distribution} /> :
              structureResult.state.status === "ERROR" ? <LocalError retry={structureResult.retry} /> : <LoadingCard label="répartition du mois" compact /> :
              categories === undefined ? categoriesResult.state.status === "ERROR" ? <LocalError retry={categoriesResult.retry} /> : <LoadingCard label="catégories" compact /> :
              visibleRows.length === 0 ? <p className={atomic.note}>Aucune dépense classée sur cette période.</p> :
              (visibleRows.length > 1 || !selectedCategory) && <ul {...rankingScroll} className={atomic.ranking} data-category-list data-compact-list={selectedCategory ? "" : undefined} aria-label={selectedCategory ? "Autres catégories" : "Dépenses par catégorie"}>
                {visibleRows.map((row, index) => index === selectedCategoryIndex ? null : categoryRow(row, index))}
              </ul>}
          </Atom>
        </AtomicSection>}
      </div>
    </div>
  </div></GlobalLayoutMotion.Provider>;
}

export function GlobalV2ActivationPending() {
  return <section className={styles.activationPending}><BarChart3 aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Interface prête pour le cutover</h1><p>La nouvelle expérience reste volontairement inactive tant que le schéma et les publications Global V2 n’ont pas été certifiés en production.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}

export function GlobalV2Unavailable() {
  return <section className={styles.activationPending} role="alert"><AlertTriangle aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Publication indisponible</h1><p>La génération publiée n’est pas complète ou compatible. Aucun calcul de remplacement n’a été lancé.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}
