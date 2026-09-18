"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, ChevronRight, ExternalLink, Info, RefreshCw, Sparkles } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { parseMetricId } from "@/core/identity";
import { parseMoney, type Money } from "@/core/money";
import type { MetricEnvelope } from "@/core/metrics";
import { MultiSeriesMonetaryEvolution, OverlayFrame, RankingBar } from "@/ui";
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
  GlobalTimelineComparisonEventObservation,
  GlobalNavigationDestination,
  ImportedGlobalSummaryReadModel,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelTransportState,
  GlobalV2ExpandedResourceName,
} from "@/query-api/global-v2";
import { globalV2MethodRef } from "@/query-api/global-v2";
import { globalModulePresentation, globalUiCopy } from "./catalog";
import { ComparisonRange } from "./comparison-range";
import { economicMetric, economicStructureGroups, economicStructureLabel } from "./economic-ui";
import { emitGlobalV2UxEvent } from "./instrumentation";
import { GlobalModuleBoundary } from "./module-boundary";
import { LifeTimeline, TimelineComparator } from "./life-timeline";
import type { TimelineDensityMode } from "./life-timeline-presentation";
import { buildHabitCoverageModel, groupRhythmMomentsByYear } from "./rhythm-collections";
import { resolveRhythmDetailContext, rhythmDetailReturnSection, type RhythmDetailContext, type RhythmDetailOrigin } from "./rhythm-detail-routing";
import { useGlobalV2Resource, useMobileGlobalLayout, useNearViewport } from "./use-global-resource";
import { GlobalV2VisitRuntime, parseGlobalDeepLink, type GlobalV2UiRequest, type GlobalV2UiTransport } from "./visit-runtime";
import styles from "./global-v2.module.css";

export type GlobalV2PageBundle = {
  readonly initial: GlobalInitialReadModel;
  readonly summary: ImportedGlobalSummaryReadModel;
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
  "ECONOMIC", "CATEGORIES_NEEDS", "RHYTHM", "GEO_MOBILITY", "TOGETHER", "PERSONAS", "CONSUMPTION",
] as const satisfies readonly GlobalPrimaryModuleKey[]);

const internalNavigation = Object.freeze([
  { label: "Synthèse", anchor: "synthese" },
  { label: "Nos dépenses", anchor: "economie" },
  { label: "Catégories", anchor: "categories" },
  { label: "Vie & dépenses", anchor: "rythmes" },
  { label: "Lieux", anchor: "lieux" },
  { label: "Profils", anchor: "profils" },
  { label: "Nous deux", anchor: "nous-deux" },
] as const);

const moduleTabs: Readonly<Record<GlobalPrimaryModuleKey, readonly { readonly key: GlobalExpandedSectionKey; readonly label: string }[]>> = Object.freeze({
  ECONOMIC: [{ key: "OVERVIEW", label: "Résumé" }, { key: "EVOLUTION", label: "Évolution" }, { key: "BREAKDOWN", label: "Répartition" }, { key: "PATTERNS", label: "Dépenses récurrentes" }],
  CATEGORIES_NEEDS: [{ key: "BREAKDOWN", label: "Catégories" }, { key: "PATTERNS", label: "Besoins renseignés" }, { key: "EVOLUTION", label: "Évolution" }],
  TRANSFORMATIONS: [{ key: "OVERVIEW", label: "Vue d’ensemble" }],
  RHYTHM: [{ key: "PATTERNS", label: "Habitudes & dépenses" }, { key: "BREAKDOWN", label: "Moments" }, { key: "EVOLUTION", label: "Changements" }],
  RELATIONSHIPS: [{ key: "OVERVIEW", label: "Vue d’ensemble" }],
  MOMENTS: [{ key: "OVERVIEW", label: "Moments" }, { key: "COMPARISONS", label: "Comparaisons" }],
  GEO_MOBILITY: [{ key: "OVERVIEW", label: "Lieux" }, { key: "BREAKDOWN", label: "Dépenses" }, { key: "EVOLUTION", label: "Évolution" }],
  CONSUMPTION: [{ key: "OVERVIEW", label: "Vue d’ensemble" }],
  PERSONAS: [{ key: "OVERVIEW", label: "Profils" }],
  TOGETHER: [{ key: "OVERVIEW", label: "Nous deux" }],
});

function moduleForSlug(slug: string): GlobalPrimaryModuleKey | undefined {
  return (Object.entries(moduleSlugs) as readonly [GlobalPrimaryModuleKey, string][]).find(([, value]) => value === slug)?.[0];
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

function PartialBadge({ onClick }: { readonly onClick: () => void }) {
  return <button type="button" className={styles.partialBadge} onClick={onClick}><Info aria-hidden size={14} /> Analyse partielle</button>;
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

function countEnvelope(value: number | undefined): MetricEnvelope<number, "count"> {
  return value === undefined
    ? { availability: "unknown", value: null, unit: "count", provenance: "derived" }
    : { availability: "known", value, unit: "count", provenance: "derived" };
}

function MoneyRanking({ title, rows, limit = 5 }: { readonly title: string; readonly rows: readonly { readonly id: string; readonly label: string; readonly displayValue?: string }[]; readonly limit?: number }) {
  const metricId = parseMetricId("global-ui-money");
  const values = rows.slice(0, limit).flatMap((item, index) => {
    const value = numericDisplay(item.displayValue);
    return value === undefined ? [] : [{ identity: item.id, label: humanLabel(item.label), rank: index + 1, metricId, metric: moneyEnvelope(value) }];
  });
  if (values.length === 0) return null;
  return <div className={styles.chartCompact}><RankingBar frame={{ title, state: { kind: "ready" }, summary: <span>{values.length} éléments classés à partir des valeurs publiées.</span> }} activeMeasure={{ metricId, unit: "EUR" }} sort={{ metricId, direction: "desc" }} rows={values} /></div>;
}

function CountRanking({ title, rows, limit = 5 }: { readonly title: string; readonly rows: readonly { readonly id: string; readonly label: string; readonly displayValue?: string }[]; readonly limit?: number }) {
  const metricId = parseMetricId("global-ui-count");
  const values = rows.slice(0, limit).flatMap((item, index) => {
    const value = numericDisplay(item.displayValue);
    return value === undefined ? [] : [{ identity: item.id, label: humanLabel(item.label), rank: index + 1, metricId, metric: countEnvelope(value) }];
  });
  if (values.length === 0) return null;
  return <div className={styles.chartCompact}><RankingBar frame={{ title, state: { kind: "ready" }, summary: <span>{values.length} éléments observés.</span> }} activeMeasure={{ metricId, unit: "count" }} sort={{ metricId, direction: "desc" }} rows={values} /></div>;
}

function M2MonetarySeries({ title, series, reference, showLegend = true, showSummary = true, highlightLastPoint = false }: { readonly title: string; readonly series: readonly GlobalDetailSeries[]; readonly reference?: GlobalDetailMetric; readonly showLegend?: boolean; readonly showSummary?: boolean; readonly highlightLastPoint?: boolean }) {
  const comparable = series.slice(0, 3).filter((item) => item.points.length > 0 && item.points.length <= 12 && item.points.every((point) => point.typedMeasure?.kind === "MONEY"));
  const periods = comparable[0]?.points.map(({ unitKey }) => unitKey) ?? [];
  const aligned = comparable.filter((item) => item.points.length === periods.length && item.points.every((point, index) => point.unitKey === periods[index]));
  if (aligned.length === 0) return null;
  const referenceValue = reference?.typedMeasure?.kind === "MONEY" ? m2TypedNumber(reference) : undefined;
  return <div className={styles.m2MonetarySeries}><MultiSeriesMonetaryEvolution frame={{ title, state: { kind: "ready" }, summary: showSummary ? <span>Évolution mensuelle sur la période analysée.</span> : null }} unit="EUR" series={aligned.map((item) => ({ id: item.seriesId, label: humanLabel(item.labelKey), points: item.points.map((point) => ({ period: point.unitKey, label: capitalize(frenchMonth(point.unitKey)), metric: moneyEnvelope(m2TypedNumber(point)) })) }))} {...(referenceValue === undefined ? {} : { referenceLine: { label: "Référence", metric: moneyEnvelope(referenceValue) } })} showLegend={showLegend} highlightLastPoint={highlightLastPoint} /></div>;
}

function InsightCard({ insight }: { readonly insight: GlobalCompactInsight }) {
  return <article className={styles.primaryInsight}><Sparkles aria-hidden size={20} /><div><strong>{humanLabel(insight.titleKey)}</strong><p>{humanLabel(insight.statementKey)}</p></div></article>;
}

function KpiGrid({ kpis, limit = 3 }: { readonly kpis: readonly GlobalCompactKpi[]; readonly limit?: number }) {
  if (kpis.length === 0) return null;
  return <div className={styles.kpis}>{kpis.slice(0, limit).map((kpi) => <div key={kpi.kpiId}><span>{humanLabel(kpi.labelKey)}</span><strong>{kpi.displayValue}</strong></div>)}</div>;
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

function EconomicChartTooltip({ active, payload, overview, targetMonth }: { readonly active?: boolean; readonly payload?: readonly { readonly payload?: EconomicChartDatum }[]; readonly overview: GlobalExpandedReadModel; readonly targetMonth: string }) {
  const datum = payload?.[0]?.payload;
  if (!active || datum === undefined) return null;
  const isTarget = datum.period === targetMonth;
  const targetMonthName = frenchMonth(targetMonth).replace(/\s+\d{4}$/u, "");
  return <div className={styles.chartTooltip}>
    <strong>{capitalize(datum.fullLabel)}</strong>
    <dl>
      <div><dt>Dépenses réelles</dt><dd>{formatMoney(datum.actual ?? undefined)}</dd></div>
      <div><dt>Niveau habituel</dt><dd>{formatMoney(datum.typical ?? undefined)}</dd></div>
      {isTarget ? <><div><dt>Niveau habituel avant {targetMonthName}</dt><dd>{formatMoney(economicNumber(economicMetric(overview, "typical-reference")))}</dd></div><div><dt>Écart</dt><dd>{formatMoney(economicNumber(economicMetric(overview, "actual-reference-delta")), { signed: true })}</dd></div></> : null}
    </dl>
  </div>;
}

function EconomicChart({ evolution, overview, certifiedThrough, compact = false }: { readonly evolution: GlobalExpandedReadModel; readonly overview: GlobalExpandedReadModel; readonly certifiedThrough: string; readonly compact?: boolean }) {
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

function EconomicCompactCard({ overview, evolution, certifiedThrough, onDetail, onMethod }: { readonly overview: GlobalExpandedReadModel; readonly evolution: GlobalExpandedReadModel; readonly certifiedThrough: string; readonly onDetail: () => void; readonly onMethod: () => void }) {
  const period = analysisPeriod(certifiedThrough);
  const targetMonthName = frenchMonth(period.targetMonth).replace(/\s+\d{4}$/u, "");
  const minimal = economicMetric(overview, "minimal-state");
  const minimalKnown = economicNumber(minimal) !== undefined;
  return <div className={styles.economicCompact}>
    <p className={styles.economicPeriod}>{period.label}</p>
    <div className={styles.economicHero} aria-label="Nos trois repères mensuels">
      <article className={styles.economicHeroPrimary}><span>Notre mois habituel</span><EconomicMetricValue metric={economicMetric(overview, "typical-state")} perMonth /></article>
      <article><span>Nos dépenses minimum <InfoTooltip text="Estimation annuelle calculée avec les données disponibles sur les 12 mois analysés." /></span><EconomicMetricValue metric={minimal} perMonth /></article>
      {minimalKnown ? <article><span>Notre marge</span><EconomicMetricValue metric={economicMetric(overview, "typical-minimal-gap")} perMonth /></article> : null}
    </div>
    <div className={styles.lastMonth}><div><span>{period.targetLabel}</span><strong>{formatMoney(economicNumber(economicMetric(overview, "actual")))} dépensés</strong></div><p><strong>{formatMoney(economicNumber(economicMetric(overview, "actual-reference-delta")), { signed: true })}</strong> par rapport à notre niveau habituel avant {targetMonthName}</p></div>
    <EconomicChart evolution={evolution} overview={overview} certifiedThrough={certifiedThrough} compact />
    <p className={styles.economicInsight}>{annualReading}</p>
    <footer className={styles.economicActions}><button type="button" className={styles.methodLink} onClick={onMethod}><Info aria-hidden size={15} /> Méthode</button><button type="button" className={styles.exploreLink} onClick={onDetail}>Explorer <span aria-hidden>→</span></button></footer>
  </div>;
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

function EconomicSignals({ model }: { readonly model: GlobalExpandedReadModel }) {
  const items = [
    { id: "trend-slope", label: "Tendance sur l’année", description: "Orientation générale malgré les variations mensuelles.", trend: true, arrow: "↘ " },
    { id: "recent-delta", label: "Hausse récente", description: "3 derniers mois vs 3 précédents", perMonth: true, signed: true },
    { id: "dispersion-amplitude", label: "Écart entre nos mois extrêmes", description: `${formatMoney(economicNumber(economicMetric(model, "dispersion-min")))} au plus bas · ${formatMoney(economicNumber(economicMetric(model, "dispersion-max")))} au plus haut` },
  ] as const;
  const detailed = [
    { id: "dispersion-median", label: "Notre mois habituel", note: "Médiane des 12 mois analysés." },
    { id: "dispersion-min", label: "Mois le moins coûteux" },
    { id: "dispersion-max", label: "Mois le plus coûteux" },
    { id: "dispersion-mad", label: "Écart autour de notre mois habituel" },
  ] as const;
  return <section className={styles.economicSignals} aria-label="Lectures de l’évolution">
    <div className={styles.signalGrid}>{items.map((item) => { const metric = economicMetric(model, item.id); const value = economicNumber(metric); return <article key={item.id}><span>{item.label}</span><strong>{"arrow" in item ? item.arrow : ""}{"trend" in item ? formatTrend(value) : formatMoney(value, { perMonth: "perMonth" in item && item.perMonth, signed: "signed" in item && item.signed })}</strong><small>{item.description}</small></article>; })}</div>
    <details className={styles.statistics}><summary>Statistiques détaillées <ChevronRight aria-hidden size={16} /></summary><div>{detailed.map((item) => <article key={item.id}><span>{item.label}</span><strong>{formatMoney(economicNumber(economicMetric(model, item.id)))}</strong>{"note" in item ? <small>{item.note}</small> : null}</article>)}</div><p>La moitié de nos mois s’écartent de {formatMoney(economicNumber(economicMetric(model, "dispersion-mad")))} ou moins de notre niveau habituel.</p></details>
  </section>;
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

function EconomicRecurrences({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow) => void }) {
  const rows = model.rows.filter((row) => (row.knowledgeState === "KNOWN" || row.knowledgeState === "PARTIAL") && (economicNumber(row) !== undefined || /\d+\s+(?:occurrence|paiement)/u.test(row.displayValue ?? ""))).sort((left, right) => (economicNumber(right) ?? Number.NEGATIVE_INFINITY) - (economicNumber(left) ?? Number.NEGATIVE_INFINITY) || humanLabel(left.labelKey).localeCompare(humanLabel(right.labelKey), "fr"));
  return rows.length === 0 ? <p className={styles.qualityNote}>Aucun paiement récurrent suffisamment renseigné sur cette période.</p> : <div className={styles.recurrenceList}>{rows.map((row) => {
    const presentation = recurrencePresentation(row);
    const content = <><span className={styles.recurrenceName}>{humanLabel(row.labelKey)}</span><strong>{presentation.amount}</strong><small>{presentation.detail}</small><ChevronRight aria-hidden size={18} /></>;
    return row.entityRef === undefined ? <div key={row.rowId}>{content}</div> : <button key={row.rowId} type="button" onClick={() => onDetail(row)}>{content}</button>;
  })}</div>;
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

type DetailTrailEntry = { readonly target: OverlayTarget; readonly scrollTop: number | undefined; readonly peerRef: string };

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

function M2Concentration({ value }: { readonly value: GlobalCompactKpi | GlobalDetailMetric | undefined }) {
  const ratio = value?.typedMeasure?.kind === "RATIO" ? m2TypedNumber(value) : undefined;
  if (ratio === undefined) return null;
  return <p className={styles.m2Concentration}>Nos 5 principaux postes concentrent <strong>{formatM2Ratio(ratio)} de nos dépenses</strong>.</p>;
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

function destinationHref(destination: GlobalNavigationDestination, certifiedThrough: string): string | undefined {
  const entityRef = destination.entityRef;
  if (entityRef === undefined || !entityRef.startsWith("category:")) return undefined;
  const categoryId = entityRef.slice("category:".length);
  if (destination.kind === "OPERATIONS" && destination.resource === "operations_browse") return `/operations?categoryIds=${encodeURIComponent(categoryId)}`;
  if (destination.kind === "HISTORY" && destination.resource === "history_category_detail") {
    const month = analysisPeriod(certifiedThrough).targetMonth;
    return `/historique/${month}?view=balance&entity=category&entityId=${encodeURIComponent(categoryId)}`;
  }
  return undefined;
}

function M2EntityDetail({ model, entityRef, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly entityRef: string; readonly certifiedThrough: string }) {
  const metric = (id: string) => model.metrics.find(({ metricId }) => metricId === id);
  const annualAmount = metric("detail:annual-amount");
  const isCategory = entityRef.startsWith("category:");
  if (annualAmount === undefined) return <div className={styles.expandedContent}><HumanRows rows={model.rows} onDetail={() => undefined} /><HumanQualityNote quality={model.quality} /></div>;
  const period = analysisPeriod(certifiedThrough);
  const primaryMetrics = [
    ["detail:annual-amount", "Total sur la période"],
    ["detail:annual-share", "Part de nos dépenses"],
    ["detail:active-months", "Mois actifs"],
    ...(!isCategory ? [["detail:current-amount", period.targetLabel], ["detail:typical-amount", "Référence mensuelle"]] as const : []),
  ] as const;
  const current = metric("detail:current-amount");
  const reference = metric("detail:typical-amount");
  const delta = metric("detail:delta-amount");
  const deltaRelative = metric("detail:delta-relative");
  const currentValue = m2TypedNumber(current);
  const referenceValue = m2TypedNumber(reference);
  const deltaValue = m2TypedNumber(delta);
  const deltaRelativeValue = m2TypedNumber(deltaRelative);
  const destinations = model.destinations.flatMap((destination) => {
    const href = destinationHref(destination, certifiedThrough);
    return href === undefined ? [] : [{ destination, href }];
  });
  return <div className={styles.m2Detail}>
    {!isCategory && model.quality.knowledgeState === "PARTIAL" ? <span className={styles.m2PartialStatus}>Analyse partielle</span> : null}
    <section aria-labelledby="m2-detail-markers"><h3 id="m2-detail-markers">Repères</h3><div className={styles.m2DetailMetrics}>{primaryMetrics.flatMap(([id, label]) => {
      const item = metric(id);
      const value = m2TypedNumber(item);
      if (item === undefined || value === undefined) return [];
      const display = item.typedMeasure?.kind === "RATIO" ? formatM2Ratio(value) : item.typedMeasure?.kind === "COUNT" ? `${integerFormatter.format(value)} mois` : formatMoney(value);
      return [<article key={id}><span>{label}</span><strong>{display}</strong></article>];
    })}</div>{isCategory && currentValue !== undefined && referenceValue !== undefined && deltaValue !== undefined ? <article className={styles.m2ReferenceCard}><header><span>{period.targetLabel}</span><strong>{formatMoney(currentValue)}</strong></header><dl><div><dt>Référence</dt><dd>{formatMoney(referenceValue)}</dd></div><div><dt>Écart</dt><dd>{formatMoney(deltaValue, { signed: true })}{deltaValue === 0 || deltaRelativeValue === undefined ? null : <> · {formatM2Ratio(deltaRelativeValue)}</>}</dd></div></dl></article> : null}</section>
    {model.series.length === 0 ? null : isCategory ? <M2MonetarySeries title="Évolution mensuelle" series={model.series.slice(0, 1)} reference={reference} showLegend={false} showSummary={false} highlightLastPoint /> : <section aria-labelledby="m2-detail-evolution"><h3 id="m2-detail-evolution">Évolution sur la période</h3><M2MonetarySeries title="Montant mensuel" series={model.series.slice(0, 1)} /></section>}
    {model.rows.length === 0 ? null : <section aria-labelledby="m2-detail-composition"><h3 id="m2-detail-composition">{isCategory ? "Ce qui compose ce poste" : "Catégories qui contribuent à ce besoin"}</h3><M2MoneyRows rows={model.rows} onDetail={() => undefined} initialLimit={isCategory ? 5 : 10} {...(isCategory ? { expansionLabels: { all: "Voir les autres sous-catégories", fewer: "Réduire la liste" }, showRemainingCount: true } : {})} /></section>}
    {!isCategory && deltaValue !== undefined ? <section className={styles.m2DetailChange} aria-labelledby="m2-detail-change"><h3 id="m2-detail-change">Écart au niveau de référence</h3><p>En {period.targetLabel.toLocaleLowerCase("fr-FR")}, l’écart au niveau de référence est de <strong>{formatMoney(deltaValue, { signed: true })}</strong>{deltaRelativeValue === undefined ? null : <> ({formatM2Ratio(deltaRelativeValue)})</>}. Cette lecture ne déduit aucune cause.</p></section> : null}
    {destinations.length === 0 ? null : <nav className={styles.m2Destinations} aria-label="Continuer l’exploration">{destinations.map(({ destination, href }) => <Link key={destination.targetId} className="button-ghost" href={href}>{destination.kind === "OPERATIONS" ? "Voir les opérations de cette catégorie" : "Voir dans l’Historique"} <ChevronRight aria-hidden size={16} /></Link>)}</nav>}
    <HumanQualityNote quality={model.quality} />
  </div>;
}

function M2ExpandedContent({ model, onDetail, runtime, certifiedThrough }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow, title?: string) => void; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string }) {
  if (model.sectionKey === "BREAKDOWN") return <div className={styles.m2TabContent}><header><h3>Quels postes structurent nos dépenses sur la période ?</h3></header><M2MoneyRows rows={model.rows} onDetail={onDetail} /></div>;
  if (model.sectionKey === "PATTERNS") return <M2NeedsContent model={model} onDetail={onDetail} />;
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

function lifeComparisonDelta(comparison: NonNullable<GlobalDetailRow["momentComparison"]>): string | undefined {
  const delta = m2TypedNumber({ typedMeasure: comparison.absoluteDelta });
  const count = m2TypedNumber({ typedMeasure: comparison.peerCount });
  if (delta === undefined || count === undefined) return undefined;
  const direction = delta < 0 ? "en dessous" : "au-dessus";
  return `${formatLifeMoney(Math.abs(delta))} ${direction} de la médiane de ${integerFormatter.format(count)} moments comparables.`;
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
    {model.sectionKey === "EVOLUTION" ? <ExpandedPreview runtime={runtime} moduleKey="ECONOMIC" sectionKey="OVERVIEW">{(overview) => <><EconomicEvolution model={model} overview={overview} certifiedThrough={certifiedThrough} /><EconomicSignals model={model} /></>}</ExpandedPreview> : null}
    {model.sectionKey === "BREAKDOWN" ? <ExpandedPreview runtime={runtime} moduleKey="ECONOMIC" sectionKey="OVERVIEW">{(overview) => <EconomicStructure model={model} overview={overview} certifiedThrough={certifiedThrough} />}</ExpandedPreview> : null}
    {model.sectionKey === "PATTERNS" ? <EconomicRecurrences model={model} onDetail={onDetail} /> : null}
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

function GlobalDetailOverlay({ target, runtime, mobile, certifiedThrough, restoreFocusRef, onReplace, onClose }: { readonly target: OverlayTarget; readonly runtime: GlobalV2VisitRuntime; readonly mobile: boolean; readonly certifiedThrough: string; readonly restoreFocusRef: RefObject<HTMLElement | null>; readonly onReplace: (target: OverlayTarget) => void; readonly onClose: () => void }) {
  const returnFocusEntityRef = useRef<string | undefined>(target.kind === "ENTITY_DETAIL" ? target.entityRef : undefined);
  const returnScrollTop = useRef<number | undefined>(undefined);
  const returnFocusPeerRef = useRef<string | undefined>(undefined);
  const returnPeerScrollTop = useRef<number | undefined>(undefined);
  const [detailTrail, setDetailTrail] = useState<readonly DetailTrailEntry[]>([]);
  const lifeModule = target.kind === "MODULE_DETAIL" && target.moduleKey === "RHYTHM";
  const lifePatternsRequest = useMemo(() => ({ resource: "analysis_global_rhythm_expanded" as const, params: { sectionKey: "PATTERNS" } }), []);
  const lifeBreakdownRequest = useMemo(() => ({ resource: "analysis_global_rhythm_expanded" as const, params: { sectionKey: "BREAKDOWN" } }), []);
  const lifeComparisonsRequest = useMemo(() => ({ resource: "analysis_global_rhythm_expanded" as const, params: { sectionKey: "COMPARISONS" } }), []);
  const lifeEvolutionRequest = useMemo(() => ({ resource: "analysis_global_rhythm_expanded" as const, params: { sectionKey: "EVOLUTION" } }), []);
  const lifePatterns = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, lifePatternsRequest, lifeModule, "BACKGROUND");
  const lifeBreakdown = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, lifeBreakdownRequest, lifeModule, "BACKGROUND");
  const lifeComparisons = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, lifeComparisonsRequest, lifeModule, "BACKGROUND");
  const lifeEvolution = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, lifeEvolutionRequest, lifeModule, "BACKGROUND");
  const lifePatternsModel = transportData(lifePatterns.state);
  const lifeBreakdownModel = transportData(lifeBreakdown.state);
  const lifeComparisonsModel = transportData(lifeComparisons.state);
  const lifeEvolutionModel = transportData(lifeEvolution.state);
  const tabs = useMemo(() => {
    if (target.kind !== "MODULE_DETAIL") return [];
    if (target.moduleKey !== "RHYTHM") return moduleTabs[target.moduleKey];
    const patternsAvailable = lifePatternsModel?.rows.some((row) => row.typedMeasure?.kind === "MONEY" && row.activityCostProfile !== undefined) ?? false;
    const momentsAvailable = (lifeBreakdownModel?.rows.length ?? 0) > 0 || (lifeComparisonsModel?.rows.length ?? 0) > 0;
    const evolutionAvailable = lifeEvolutionModel !== undefined && (lifeEvolutionModel.primaryInsight !== undefined || lifeEvolutionModel.secondaryInsights.length > 0 || lifeEvolutionModel.metrics.length > 0 || lifeEvolutionModel.series.length > 0 || lifeEvolutionModel.rows.length > 0);
    return moduleTabs.RHYTHM.filter(({ key }) => key === "PATTERNS" && patternsAvailable || key === "BREAKDOWN" && momentsAvailable || key === "EVOLUTION" && evolutionAvailable);
  }, [lifeBreakdownModel, lifeComparisonsModel, lifeEvolutionModel, lifePatternsModel, target.kind, target.moduleKey]);
  const preferredSection = target.kind === "MODULE_DETAIL" && target.moduleKey === "RHYTHM"
    ? target.initialSection !== undefined && target.initialSection !== "OVERVIEW" ? target.initialSection : tabs[0]?.key ?? "PATTERNS"
    : target.initialSection ?? tabs[0]?.key ?? "METHODOLOGY";
  const [section, setSection] = useState<GlobalExpandedSectionKey>(preferredSection);
  useEffect(() => setSection(preferredSection), [preferredSection]);
  useEffect(() => { if (target.kind === "MODULE_DETAIL" && tabs.length > 0 && !tabs.some(({ key }) => key === section)) setSection(tabs[0]!.key); }, [section, tabs, target.kind]);
  const params = useMemo<Readonly<Record<string, string>>>(() => {
    const next: Record<string, string> = {};
    if (target.kind === "METHODOLOGY") {
      next.moduleKey = target.moduleKey;
      next.methodRef = target.entityRef;
    } else if (target.kind === "ENTITY_DETAIL") {
      next.entityRef = target.entityRef;
    } else {
      next.sectionKey = section;
    }
    return next;
  }, [section, target]);
  const request = useMemo(() => ({ resource: target.resource, params }), [params, target.resource]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "DIRECT");
  const model = transportData(result.state);
  useEffect(() => {
    const entityRef = returnFocusEntityRef.current;
    if (target.kind !== "MODULE_DETAIL" || model === undefined || entityRef === undefined) return;
    const frame = document.querySelector<HTMLElement>('[data-overlay-shell][data-topmost="true"]');
    if (frame === null) return;
    const focusRow = () => {
      const row = frame.querySelector<HTMLElement>(`[data-global-entity-ref="${CSS.escape(entityRef)}"], [data-m2-entity-ref="${CSS.escape(entityRef)}"]`);
      if (row === null) return false;
      const content = frame.querySelector<HTMLElement>("[data-overlay-content]");
      if (content !== null && returnScrollTop.current !== undefined) content.scrollTop = returnScrollTop.current;
      row.focus({ preventScroll: true });
      returnFocusEntityRef.current = undefined;
      returnScrollTop.current = undefined;
      return true;
    };
    if (focusRow()) return;
    const observer = new MutationObserver(() => { if (focusRow()) observer.disconnect(); });
    observer.observe(frame, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => { observer.disconnect(); returnFocusEntityRef.current = undefined; returnScrollTop.current = undefined; }, 2_000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); };
  }, [model, target.kind]);
  useEffect(() => {
    const peerRef = returnFocusPeerRef.current;
    if (target.kind !== "ENTITY_DETAIL" || model === undefined || peerRef === undefined || model.rows[0]?.entityRef !== target.entityRef) return;
    const frame = document.querySelector<HTMLElement>('[data-overlay-shell][data-topmost="true"]');
    const peerPoint = frame?.querySelector<HTMLElement>(`[data-peer-ref="${CSS.escape(peerRef)}"]`);
    const content = frame?.querySelector<HTMLElement>("[data-overlay-content]");
    if (peerPoint === null || peerPoint === undefined) return;
    if (content !== null && content !== undefined && returnPeerScrollTop.current !== undefined) content.scrollTop = returnPeerScrollTop.current;
    peerPoint.focus({ preventScroll: true });
    returnFocusPeerRef.current = undefined;
    returnPeerScrollTop.current = undefined;
  }, [model, target.kind]);
  const presentation = globalModulePresentation(target.moduleKey);
  const subtitle = target.kind === "ENTITY_DETAIL"
    ? target.moduleKey === "RHYTHM" ? target.entityRef.startsWith("moment:") ? "Détail du moment" : target.entityRef.startsWith("household-activity:") ? "Détail de l’activité au niveau du foyer" : "Contexte de rythme individuel" : target.entityRef.startsWith("need:") ? "Besoin renseigné" : "Détail de la catégorie"
    : target.moduleKey === "ECONOMIC" ? undefined : presentation.description;
  const localError = target.kind === "METHODOLOGY" && target.moduleKey === "ECONOMIC" ? <div className={styles.methodError} role="alert">Impossible de charger les détails de méthode · <button type="button" onClick={result.retry}>Réessayer</button></div> : <LocalError retry={result.retry} />;
  const activeTabId = `${moduleSlugs[target.moduleKey]}-tab-${section.toLowerCase()}`;
  const activePanelId = `${moduleSlugs[target.moduleKey]}-panel-${section.toLowerCase()}`;
  const rhythmReturnSection = target.kind === "ENTITY_DETAIL" ? rhythmDetailReturnSection(target.rhythmDetailContext) : undefined;
  const returnSection = rhythmReturnSection ?? target.returnSection ?? (target.entityRef.startsWith("need:") ? "PATTERNS" : "BREAKDOWN");
  const detailHasBack = detailTrail.length > 0 || target.kind === "ENTITY_DETAIL" && (target.moduleKey === "CATEGORIES_NEEDS" || rhythmReturnSection !== undefined);
  const showTabs = target.moduleKey !== "RHYTHM" && tabs.length > 1;
  const showRhythmMethod = target.kind === "MODULE_DETAIL" && target.moduleKey === "RHYTHM";
  const rhythmDetailMode = target.kind === "ENTITY_DETAIL" && target.moduleKey === "RHYTHM";
  const returnToCollection = () => onReplace(moduleOverlayTarget(target.moduleKey, returnSection));
  const closeDetail = detailTrail.length > 0 || rhythmReturnSection === undefined ? onClose : returnToCollection;
  const goBack = () => {
    const previous = detailTrail.at(-1);
    if (previous === undefined) returnToCollection();
    else {
      returnFocusPeerRef.current = previous.peerRef;
      returnPeerScrollTop.current = previous.scrollTop;
      setDetailTrail((trail) => trail.slice(0, -1));
      onReplace(previous.target);
    }
  };
  const openPeer = (peer: GlobalMomentPeerObservation) => {
    if (!peer.detailRef.startsWith("global-query:analysis_global_moment_experience_detail:")) return;
    const nextTarget = entityOverlayTarget("RHYTHM", peer.peerRef, peer.canonicalName, undefined, "NARRATIVE");
    if (nextTarget === undefined) return;
    const content = document.querySelector<HTMLElement>('[data-overlay-shell][data-topmost="true"] [data-overlay-content]');
    setDetailTrail((trail) => [...trail, { target, scrollTop: content?.scrollTop, peerRef: peer.peerRef }]);
    onReplace({ ...nextTarget, queryDetailRef: peer.detailRef });
    if (content !== null) content.scrollTop = 0;
  };
  const openTimelinePeer = (peer: GlobalTimelineComparisonEventObservation) => {
    if (peer.sourceKind === "LIFE_EVENT") {
      onClose();
      window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("global-v2:focus-life-event", { detail: { eventRef: peer.eventRef, visibilityTier: peer.visibilityTier } })));
      return;
    }
    const nextTarget = entityOverlayTarget("RHYTHM", peer.eventRef, peer.canonicalName, undefined, "NARRATIVE");
    if (nextTarget === undefined) return;
    const content = document.querySelector<HTMLElement>('[data-overlay-shell][data-topmost="true"] [data-overlay-content]');
    onReplace(nextTarget);
    if (content !== null) content.scrollTop = 0;
  };
  return <OverlayFrame kind="exploration" title={target.title} subtitle={subtitle} closeAction={{ kind: "callback", onAction: closeDetail }} {...(detailHasBack ? { backAction: { kind: "callback" as const, onAction: goBack } } : {})} restoreFocusRef={restoreFocusRef} closeOnBackdrop className={`${styles.detailOverlay} ${rhythmDetailMode ? styles.rhythmDetailSheet : ""} ${mobile ? styles.mobileOverlay : ""}`}>
    {showTabs || showRhythmMethod ? <div className={`${styles.overlayNavigation} ${target.moduleKey === "CATEGORIES_NEEDS" || target.moduleKey === "RHYTHM" ? styles.m2OverlayNavigation : ""}`}>{showTabs ? <div className={`${styles.sectionTabs} ${target.moduleKey === "CATEGORIES_NEEDS" ? styles.m2Tabs : ""}`} role="tablist" aria-label={`Sections de ${target.title}`}>{tabs.map((item) => <button id={`${moduleSlugs[target.moduleKey]}-tab-${item.key.toLowerCase()}`} key={item.key} type="button" role="tab" aria-selected={section === item.key} aria-controls={`${moduleSlugs[target.moduleKey]}-panel-${item.key.toLowerCase()}`} onClick={() => { setSection(item.key); emitGlobalV2UxEvent("global_section_expanded", { moduleKey: target.moduleKey, sectionKey: item.key }); window.history.replaceState(window.history.state, "", `#${moduleSlugs[target.moduleKey]}-${item.key.toLowerCase()}`); }}>{item.label}</button>)}</div> : null}{target.moduleKey === "ECONOMIC" || target.moduleKey === "RHYTHM" ? <button type="button" className={styles.methodLink} onClick={() => onReplace(methodOverlayTarget(target.moduleKey))}><Info aria-hidden size={15} /> {target.moduleKey === "RHYTHM" ? "Fiabilité & méthode" : "Méthode"}</button> : null}</div> : null}
    {target.moduleKey === "CATEGORIES_NEEDS" ? <p className={styles.m2Period}>{analysisPeriod(certifiedThrough).label.replace("—", "→")}</p> : null}
    <div data-rhythm-detail-origin={target.rhythmDetailContext?.origin} data-query-detail-ref={target.queryDetailRef} {...(showTabs ? { id: activePanelId, role: "tabpanel", "aria-labelledby": activeTabId } : {})}>{result.state.status === "IDLE" || result.state.status === "LOADING" ? <LoadingCard label={target.title} /> : result.state.status === "ERROR" && model === undefined ? localError : model === undefined ? null : <GlobalExpandedContent model={model} entityRef={target.entityRef} runtime={runtime} certifiedThrough={certifiedThrough} onOpenPeer={openPeer} onOpenTimelinePeer={openTimelinePeer} onDetail={(row, detailTitle) => {
      if (row.entityRef === undefined) return;
      const rhythmOrigin = target.moduleKey !== "RHYTHM" ? undefined : section === "PATTERNS" ? "HABITS_COLLECTION" : section === "BREAKDOWN" ? "MOMENTS_COLLECTION" : undefined;
      const nextTarget = entityOverlayTarget(target.moduleKey, row.entityRef, detailTitle ?? humanLabel(row.labelKey), section, rhythmOrigin);
      if (nextTarget === undefined) return;
      const content = document.querySelector<HTMLElement>('[data-overlay-shell][data-topmost="true"] [data-overlay-content]');
      returnScrollTop.current = content?.scrollTop;
      returnFocusEntityRef.current = row.entityRef;
      onReplace(nextTarget);
      if (content !== null) content.scrollTop = 0;
    }} />}</div>
  </OverlayFrame>;
}

function ExpandedPreview({ runtime, moduleKey, sectionKey, children }: { readonly runtime: GlobalV2VisitRuntime; readonly moduleKey: GlobalPrimaryModuleKey; readonly sectionKey: GlobalExpandedSectionKey; readonly children: (model: GlobalExpandedReadModel) => React.ReactNode }) {
  const resource = globalModulePresentation(moduleKey).expandedResource;
  const request = useMemo(() => ({ resource, params: { sectionKey } }), [resource, sectionKey]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "BACKGROUND");
  const model = transportData(result.state);
  if (model !== undefined) return children(model);
  if (result.state.status === "ERROR") return <LocalError retry={result.retry} />;
  return <LoadingCard label="la visualisation" compact />;
}

function SeeDetail({ onClick }: { readonly onClick: () => void }) {
  return <button type="button" className={styles.detailButton} onClick={onClick}>Voir le détail <span aria-hidden>→</span></button>;
}

function M2CompactRecentInsight({ insight, runtime, certifiedThrough, onDetail }: { readonly insight: GlobalCompactInsight; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly onDetail: (entityRef: string, title: string) => void }) {
  const entityRef = insight.entityRefs[0];
  const request = useMemo<GlobalV2UiRequest>(() => ({ resource: "analysis_global_category_need_detail", params: { entityRef: entityRef ?? "" } }), [entityRef]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, entityRef !== undefined, "BACKGROUND");
  const detail = transportData(result.state);
  if (detail === undefined) return null;
  const metric = (id: string) => detail.metrics.find(({ metricId }) => metricId === id);
  const current = m2TypedNumber(metric("detail:current-amount"));
  const reference = m2TypedNumber(metric("detail:typical-amount"));
  const delta = m2TypedNumber(metric("detail:delta-amount"));
  if (current === undefined || reference === undefined || delta === undefined) return null;
  const targetLabel = analysisPeriod(certifiedThrough).targetLabel.toLocaleLowerCase("fr-FR");
  const comparison = delta === 0 ? "au même niveau que" : `${formatMoney(delta)} ${delta > 0 ? "au-dessus de" : "en dessous de"}`;
  return <section className={styles.m2CompactChange} aria-labelledby="m2-compact-change"><h3 id="m2-compact-change">Ce qui distingue {targetLabel}</h3><button type="button" className={`${styles.primaryInsight} ${styles.m2InsightButton}`} data-m2-entity-ref={entityRef} onClick={() => onDetail(entityRef, humanLabel(insight.titleKey))} aria-label={`Explorer ${humanLabel(insight.titleKey)}`}><Sparkles aria-hidden size={20} /><span><strong>{humanLabel(insight.titleKey)}</strong><p>En {targetLabel} : {formatMoney(current)}, soit {comparison} son niveau de référence de {formatMoney(reference)}.</p></span></button></section>;
}

function M2CompactCard({ model, runtime, certifiedThrough, onDetail, onEntityDetail }: { readonly model: GlobalModuleCompactReadModel; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly onDetail: () => void; readonly onEntityDetail: (entityRef: string, title: string) => void }) {
  const concentration = model.kpis.find(({ kpiId }) => kpiId === "kpi:categories:top-five-concentration");
  const period = analysisPeriod(certifiedThrough);
  return <div className={styles.m2Compact}>
    <p className={styles.m2Period}>{period.label.replace("—", "→")}</p>
    <M2Concentration value={concentration} />
    <ExpandedPreview runtime={runtime} moduleKey="CATEGORIES_NEEDS" sectionKey="BREAKDOWN">{(breakdown) => <M2MoneyRows rows={breakdown.rows} onDetail={(row) => row.entityRef === undefined ? undefined : onEntityDetail(row.entityRef, humanLabel(row.labelKey))} initialLimit={5} allowExpansion={false} />}</ExpandedPreview>
    {model.primaryInsight === undefined ? null : <M2CompactRecentInsight insight={model.primaryInsight} runtime={runtime} certifiedThrough={certifiedThrough} onDetail={onEntityDetail} />}
    <button type="button" className={styles.detailButton} onClick={onDetail}>Explorer l’analyse <span aria-hidden>→</span></button>
  </div>;
}

const groceryRoutineEntityRef = "household-activity:courses_alimentaires";

function LifeBackgroundRhythms({ runtime, onMethod }: { readonly runtime: GlobalV2VisitRuntime; readonly onMethod: () => void }) {
  const request = useMemo(() => ({ resource: "analysis_global_routine_detail" as const, params: { entityRef: groceryRoutineEntityRef } }), []);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "BACKGROUND");
  const model = transportData(result.state);
  const rhythm = model?.groceryRhythm;
  if (rhythm === undefined) {
    if (result.state.status === "ERROR") return <section className={styles.lifeRhythms} aria-labelledby="life-rhythms-title"><header><h3 id="life-rhythms-title">Nos rythmes de fond</h3></header><LocalError retry={result.retry} /></section>;
    return <section className={styles.lifeRhythms} aria-labelledby="life-rhythms-title"><header><h3 id="life-rhythms-title">Nos rythmes de fond</h3></header><LoadingCard label="nos rythmes de fond" compact /></section>;
  }
  const lowerThreshold = m2TypedNumber({ typedMeasure: rhythm.thresholds.p25 });
  const upperThreshold = m2TypedNumber({ typedMeasure: rhythm.thresholds.p75 });
  return <section className={styles.lifeRhythms} aria-labelledby="life-rhythms-title" data-rhythm-source="analysis_global_routine_detail">
    <header className={styles.lifeRhythmsHeader}><div><span className="eyebrow">Habitudes récurrentes</span><h3 id="life-rhythms-title">Nos rythmes de fond</h3><p>Les courses dessinent un rythme mensuel régulier, présenté ici sans attribuer de dépense à une personne.</p></div><button type="button" className={styles.methodLink} onClick={onMethod}><Info aria-hidden size={15} /> Fiabilité & méthode</button></header>
    <article className={styles.groceryRhythmCard}>
      <header><div><h4>Courses</h4><p>Nos passages en courses, ce que nous avons dépensé chaque mois et la structure de nos paniers lorsque les données sont suffisamment complètes.</p></div><dl><div><dt>Petits paniers</dt><dd>jusqu’à {formatLifeMoney(lowerThreshold)}</dd></div><div><dt>Gros paniers</dt><dd>à partir de {formatLifeMoney(upperThreshold)}</dd></div><div><dt>Structure des paniers</dt><dd>{integerFormatter.format(rhythm.eligibleMonthCount)} mois sur {integerFormatter.format(rhythm.months.length)}</dd></div></dl></header>
      <div className={styles.groceryMonthGrid}>{rhythm.months.map((month) => {
        const monthlyAmount = month.monthlyGrocerySpend.status === "KNOWN" || month.monthlyGrocerySpend.status === "PARTIAL"
          ? month.monthlyGrocerySpend.value.kind === "MONEY" ? m2TypedNumber({ typedMeasure: month.monthlyGrocerySpend.value }) : undefined
          : undefined;
        const monthLabel = capitalize(frenchMonth(month.month));
        return <article key={month.month} className={styles.groceryMonthCard} aria-label={`Courses ${monthLabel}`}>
          <header><time dateTime={month.month}>{monthLabel}</time><strong>{formatLifeMoney(monthlyAmount)}</strong></header>
          <p>{integerFormatter.format(month.occurrenceCount)} passages · couverture {formatLifeRatio(month.coverage)}</p>
          {month.basketStructure.status === "KNOWN"
            ? <dl className={styles.groceryBasket}><div><dt>Petits</dt><dd>{integerFormatter.format(month.basketStructure.small)}</dd></div><div><dt>Intermédiaires</dt><dd>{integerFormatter.format(month.basketStructure.intermediate)}</dd></div><div><dt>Gros</dt><dd>{integerFormatter.format(month.basketStructure.large)}</dd></div></dl>
            : <small>Pas assez de passages renseignés pour détailler les paniers ce mois-ci.</small>}
        </article>;
      })}</div>
    </article>
  </section>;
}

function PersonaColumns({ rows, limit = 5 }: { readonly rows: readonly GlobalDetailRow[]; readonly limit?: number }) {
  const groups = new Map<string, GlobalDetailRow[]>();
  for (const row of rows) {
    const [person = "Profil", ...label] = humanLabel(row.labelKey).split(" · ");
    const current = groups.get(person) ?? [];
    if (current.length < limit) current.push({ ...row, labelKey: label.join(" · ") || humanLabel(row.labelKey) });
    groups.set(person, current);
  }
  if (groups.size === 0) return null;
  return <div className={styles.personColumns}>{[...groups.entries()].map(([person, entries]) => <section key={person}><h3>{person}</h3><HumanRows rows={entries} onDetail={() => undefined} /></section>)}</div>;
}

function ModuleContent({ moduleKey, model, runtime, certifiedThrough, onDetail, onEntityDetail, onMethod }: { readonly moduleKey: GlobalPrimaryModuleKey; readonly model: GlobalModuleCompactReadModel; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly onDetail: () => void; readonly onEntityDetail: (entityRef: string, title: string) => void; readonly onMethod: () => void }) {
  if (moduleKey === "TRANSFORMATIONS" || moduleKey === "RELATIONSHIPS" || moduleKey === "MOMENTS" || moduleKey === "RHYTHM") return null;
  if (moduleKey === "CONSUMPTION") return <div className={styles.neutralState}><strong>Analyse pas encore disponible</strong><p>L’identité des achats ne couvre pas encore suffisamment la période pour proposer une lecture fiable.</p></div>;

  const insight = model.primaryInsight;
  if (moduleKey === "ECONOMIC") return <div className={styles.compact}><ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(overview) => <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="EVOLUTION">{(evolution) => <EconomicCompactCard overview={overview} evolution={evolution} certifiedThrough={certifiedThrough} onDetail={onDetail} onMethod={onMethod} />}</ExpandedPreview>}</ExpandedPreview></div>;

  if (moduleKey === "CATEGORIES_NEEDS") return <M2CompactCard model={model} runtime={runtime} certifiedThrough={certifiedThrough} onDetail={onDetail} onEntityDetail={onEntityDetail} />;

  if (moduleKey === "GEO_MOBILITY") return <div className={styles.compact}>
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(expanded) => <CountRanking title="Lieux les plus visités" rows={expanded.rows.map((row) => ({ id: row.rowId, label: row.labelKey, displayValue: row.displayValue }))} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;

  if (moduleKey === "PERSONAS") return <div className={styles.compact}>
    <PartialBadge onClick={onMethod} />
    <div className={styles.neutralHeadline}><strong>Aucune différence nette à mettre en avant entre vos profils</strong><p>Les métriques factuelles restent présentées séparément, sans classement entre les personnes.</p></div>
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(expanded) => <PersonaColumns rows={expanded.rows} limit={3} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;

  return <div className={styles.compact}>
    <PartialBadge onClick={onMethod} />
    <p className={styles.moduleSubtitle}>Ce que les données vous voient explicitement faire ensemble</p>
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(expanded) => <CountRanking title="Univers partagés observés" rows={expanded.rows.map((row) => ({ id: row.rowId, label: row.labelKey, displayValue: row.displayValue }))} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;
}

function GlobalModulePanel({ moduleKey, runtime, certifiedThrough, eager, direct, onOverlay }: { readonly moduleKey: GlobalPrimaryModuleKey; readonly runtime: GlobalV2VisitRuntime; readonly certifiedThrough: string; readonly eager: boolean; readonly direct: boolean; readonly onOverlay: (target: OverlayTarget) => void }) {
  const presentation = globalModulePresentation(moduleKey);
  const nearViewport = useNearViewport();
  const shouldLoad = eager || direct || nearViewport.near;
  const request = useMemo(() => ({ resource: presentation.resource, params: {} }), [presentation.resource]);
  const compact = useGlobalV2Resource<GlobalModuleCompactReadModel>(runtime, request, shouldLoad, direct ? "DIRECT" : "BACKGROUND");
  const compactModel = transportData(compact.state);
  const viewed = useRef(false);
  useEffect(() => {
    if (compactModel === undefined || viewed.current) return;
    viewed.current = true;
    emitGlobalV2UxEvent("global_module_viewed", { moduleKey });
  }, [compactModel, moduleKey]);
  const openDetail = () => { onOverlay(moduleOverlayTarget(moduleKey)); emitGlobalV2UxEvent("global_module_expanded", { moduleKey, state: "overlay" }); };
  const openEntityDetail = (entityRef: string, title: string) => {
    const target = entityOverlayTarget(moduleKey, entityRef, title);
    if (target === undefined) return;
    onOverlay(target);
    emitGlobalV2UxEvent("global_entity_opened", { moduleKey });
  };
  const openMethod = () => { onOverlay(methodOverlayTarget(moduleKey)); emitGlobalV2UxEvent("global_methodology_opened", { moduleKey }); };
  return <section ref={nearViewport.ref} id={moduleSlugs[moduleKey]} className={styles.module} data-module={moduleKey} aria-labelledby={`${moduleSlugs[moduleKey]}-title`}>
    <header className={styles.moduleHeader}><div>{presentation.eyebrow.length === 0 ? null : <span className="eyebrow">{presentation.eyebrow}</span>}<h2 id={`${moduleSlugs[moduleKey]}-title`}>{presentation.title}</h2>{presentation.description.length === 0 ? null : <p>{presentation.description}</p>}</div></header>
    {compact.state.status === "IDLE" || compact.state.status === "LOADING" ? <LoadingCard label={presentation.title} /> : compact.state.status === "ERROR" && compactModel === undefined ? <LocalError retry={compact.retry} /> : compactModel === undefined ? null : <ModuleContent moduleKey={moduleKey} model={compactModel} runtime={runtime} certifiedThrough={certifiedThrough} onDetail={openDetail} onEntityDetail={openEntityDetail} onMethod={openMethod} />}
  </section>;
}

function GlobalLifeTimelinePanel({ runtime, onOverlay }: { readonly runtime: GlobalV2VisitRuntime; readonly onOverlay: (target: OverlayTarget) => void }) {
  const presentation = globalModulePresentation("RHYTHM");
  const [density, setDensity] = useState<TimelineDensityMode>("PRINCIPAL");
  const [focusInvitation, setFocusInvitation] = useState(false);
  const focusControlRef = useRef<HTMLButtonElement>(null);
  const focusInvitationPlayed = useRef(false);
  useEffect(() => {
    const control = focusControlRef.current;
    if (control === null || density !== "PRINCIPAL" || focusInvitationPlayed.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let hasScrolled = false;
    let invitationTimer: number | undefined;
    let resetTimer: number | undefined;
    const invite = () => {
      if (!visible || !hasScrolled || focusInvitationPlayed.current) return;
      focusInvitationPlayed.current = true;
      invitationTimer = window.setTimeout(() => {
        setFocusInvitation(true);
        resetTimer = window.setTimeout(() => setFocusInvitation(false), 420);
      }, 120);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting === true && entry.intersectionRatio >= .75;
      invite();
    }, { threshold: [.75] });
    const handleScroll = (event: Event) => {
      const target = event.target;
      const scrollDepth = target instanceof HTMLElement ? target.scrollTop : window.scrollY;
      if (scrollDepth < 48) return;
      hasScrolled = true;
      invite();
    };
    observer.observe(control);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll, true);
      if (invitationTimer !== undefined) window.clearTimeout(invitationTimer);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, [density]);
  const expanded = density === "EXTENDED";
  return <section id={moduleSlugs.RHYTHM} className={styles.module} data-module="RHYTHM" aria-labelledby="rythmes-title">
    <header className={`${styles.moduleHeader} ${styles.timelineModuleHeader}`}><div className={styles.timelineTitleRow}><h2 id="rythmes-title">{presentation.title}</h2><button
      ref={focusControlRef}
      type="button"
      className={styles.timelineFocusControl}
      data-expanded={expanded}
      data-invitation={focusInvitation}
      aria-pressed={expanded}
      aria-label={expanded ? "Recentrer la timeline sur les événements principaux" : "Élargir la timeline aux événements étendus"}
      onClick={() => { setFocusInvitation(false); setDensity(expanded ? "PRINCIPAL" : "EXTENDED"); }}
    >
      <span className={styles.timelineFocusFrame} aria-hidden><i /><i /><i /><i /></span>
      <span className={styles.timelineFocusLabels} aria-hidden>
        <span data-active={!expanded}>Élargir</span>
        <span className={styles.timelineFocusRecenter} data-active={expanded}>Recentrer</span>
      </span>
    </button></div></header>
    <LifeTimeline runtime={runtime} density={density} onDensityChange={setDensity} onMomentDetail={(eventRef, title) => {
      const target = entityOverlayTarget("RHYTHM", eventRef, title, undefined, "NARRATIVE");
      if (target === undefined) return;
      onOverlay(target);
      emitGlobalV2UxEvent("global_entity_opened", { moduleKey: "RHYTHM" });
    }} />
    <LifeBackgroundRhythms runtime={runtime} onMethod={() => {
      onOverlay(methodOverlayTarget("RHYTHM"));
      emitGlobalV2UxEvent("global_methodology_opened", { moduleKey: "RHYTHM" });
    }} />
  </section>;
}

type SummarySlotDefinition = { readonly slot: string; readonly moduleKey: GlobalPrimaryModuleKey; readonly kind: "KPI" | "INSIGHT"; readonly kpiIndex?: number };

function SummarySlot({ definition, runtime }: { readonly definition: SummarySlotDefinition; readonly runtime: GlobalV2VisitRuntime }) {
  const presentation = globalModulePresentation(definition.moduleKey);
  const request = useMemo(() => ({ resource: presentation.resource, params: {} }), [presentation.resource]);
  const result = useGlobalV2Resource<GlobalModuleCompactReadModel>(runtime, request, true, "BACKGROUND");
  const model = transportData(result.state);
  if (model === undefined) return result.state.status === "ERROR" ? null : <LoadingCard label={definition.slot} compact />;
  if (model.visibility !== "VISIBLE") return null;
  if (definition.kind === "KPI") {
    const kpi = model.kpis[definition.kpiIndex ?? 0];
    return kpi === undefined ? null : <article className={styles.summarySlot} data-summary-slot={definition.slot}><span>{humanLabel(kpi.labelKey)}</span><strong>{kpi.displayValue}</strong></article>;
  }
  const insight = model.primaryInsight;
  return insight === undefined ? null : <article className={styles.summarySlot} data-summary-slot={definition.slot}><span>{humanLabel(insight.titleKey)}</span><strong>{humanLabel(insight.statementKey)}</strong></article>;
}

function HumanSummary({ runtime }: { readonly runtime: GlobalV2VisitRuntime }) {
  const s1: SummarySlotDefinition = { slot: "S1", moduleKey: "ECONOMIC", kind: "KPI", kpiIndex: 0 };
  const s2: SummarySlotDefinition = { slot: "S2", moduleKey: "ECONOMIC", kind: "INSIGHT" };
  const row2: readonly SummarySlotDefinition[] = [{ slot: "S3", moduleKey: "CATEGORIES_NEEDS", kind: "INSIGHT" }, { slot: "S4", moduleKey: "RHYTHM", kind: "INSIGHT" }];
  const row3: readonly SummarySlotDefinition[] = [{ slot: "S5", moduleKey: "GEO_MOBILITY", kind: "INSIGHT" }, { slot: "S6", moduleKey: "TOGETHER", kind: "INSIGHT" }];
  return <section id="synthese" className={styles.summary} aria-labelledby="global-summary-title">
    <header><div><span className="eyebrow">Synthèse</span><h2 id="global-summary-title">L’essentiel de notre année</h2></div></header>
    <section className={styles.summaryGroup}><h3>Notre argent</h3><div className={styles.summaryRow}><SummarySlot definition={s1} runtime={runtime} /><SummarySlot definition={s2} runtime={runtime} /></div></section>
    <div className={styles.summaryRow}>{row2.map((definition) => <SummarySlot key={definition.slot} definition={definition} runtime={runtime} />)}</div>
    <div className={styles.summaryRow}>{row3.map((definition) => <SummarySlot key={definition.slot} definition={definition} runtime={runtime} />)}</div>
  </section>;
}

export function GlobalV2Page({ bundle, transport, certifiedThrough }: { readonly bundle: GlobalV2PageBundle; readonly transport: GlobalV2UiTransport; readonly certifiedThrough: string }) {
  const mobile = useMobileGlobalLayout();
  const runtime = useMemo(() => new GlobalV2VisitRuntime(bundle.initial.publicationMeta, transport, 2), [bundle.initial.publicationMeta, transport]);
  const visibleModules = useMemo(() => new Set(bundle.initial.navigation.filter((entry) => entry.visibility !== "HIDDEN").map(({ moduleKey }) => moduleKey)), [bundle.initial.navigation]);
  const orderedModules = useMemo(() => storyOrder.filter((moduleKey) => visibleModules.has(moduleKey)), [visibleModules]);
  const [directModule, setDirectModule] = useState<GlobalPrimaryModuleKey | undefined>();
  const [activeAnchor, setActiveAnchor] = useState("synthese");
  const [overlay, setOverlay] = useState<OverlayTarget | null>(null);
  const overlayInvokerRef = useRef<HTMLElement | null>(null);
  const deepLinkApplied = useRef(false);
  const openOverlay = useCallback((target: OverlayTarget) => {
    overlayInvokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOverlay(target);
  }, []);

  useEffect(() => {
    if (deepLinkApplied.current) return;
    deepLinkApplied.current = true;
    const deepLink = parseGlobalDeepLink(window.location.hash);
    if (deepLink === null || deepLink.anchor === "synthese") return;
    const [slug, rawSection] = deepLink.anchor.split(/-(?=overview|evolution|breakdown|patterns|comparisons$)/u);
    const moduleKey = moduleForSlug(slug);
    if (moduleKey === undefined) return;
    setDirectModule(moduleKey);
    const section = rawSection === undefined ? undefined : rawSection.toUpperCase() as GlobalExpandedSectionKey;
    if (section !== undefined && moduleKey !== "RHYTHM") openOverlay(moduleOverlayTarget(moduleKey, section));
    requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
  }, [openOverlay]);

  useEffect(() => {
    const elements = internalNavigation.map(({ anchor }) => document.getElementById(anchor)).filter((entry): entry is HTMLElement => entry !== null);
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveAnchor(visible.target.id);
    }, { rootMargin: "-25% 0px -62% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((anchor = "synthese") => {
    const moduleKey = moduleForSlug(anchor);
    if (moduleKey !== undefined) setDirectModule(moduleKey);
    window.history.replaceState(window.history.state, "", `#${anchor}`);
    document.getElementById(anchor)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);

  return <div className={styles.page} data-global-v2="" data-publication-id={bundle.initial.publicationMeta.publicationId}>
    <header className={styles.hero}><div><h1>Notre vie, dans son ensemble</h1><p className={styles.period}>{analysisPeriod(certifiedThrough).label.replace("—", "→")}</p><p>Une vue d’ensemble de nos dépenses, habitudes, moments et lieux sur l’année.</p><button type="button" className={styles.methodButton} onClick={() => openOverlay(methodOverlayTarget("ECONOMIC"))}><Info aria-hidden size={17} /> Méthode</button></div></header>
    {bundle.newerPublication === undefined ? null : <aside className={styles.generationBanner} role="status" aria-live="polite"><div><strong>Une version plus récente est disponible.</strong><span>Notre lecture actuelle reste stable jusqu’à l’actualisation.</span></div><button type="button" className="button-primary" onClick={() => window.location.reload()}><RefreshCw aria-hidden size={16} /> Actualiser</button></aside>}
    <nav className={styles.stickyNav} aria-label="Navigation dans l’analyse globale">{internalNavigation.map(({ label, anchor }) => <button key={anchor} type="button" aria-current={activeAnchor === anchor ? "location" : undefined} onClick={() => goTo(anchor)}>{label}</button>)}</nav>
    <HumanSummary runtime={runtime} />
    <main className={styles.story}>{orderedModules.map((moduleKey, index) => <GlobalModuleBoundary key={moduleKey}>{moduleKey === "RHYTHM" ? <GlobalLifeTimelinePanel runtime={runtime} onOverlay={openOverlay} /> : <GlobalModulePanel moduleKey={moduleKey} runtime={runtime} certifiedThrough={certifiedThrough} eager={index < 2} direct={directModule === moduleKey} onOverlay={openOverlay} />}</GlobalModuleBoundary>)}</main>
    <button type="button" className={styles.backToTop} onClick={() => goTo()}><ArrowUp aria-hidden size={17} /> Retour au sommet</button>
    {overlay === null ? null : <GlobalDetailOverlay target={overlay} runtime={runtime} mobile={mobile} certifiedThrough={certifiedThrough} restoreFocusRef={overlayInvokerRef} onReplace={(target) => { setOverlay(target); emitGlobalV2UxEvent("global_entity_opened", { moduleKey: target.moduleKey }); }} onClose={() => setOverlay(null)} />}
  </div>;
}

export function GlobalV2ActivationPending() {
  return <section className={styles.activationPending}><BarChart3 aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Interface prête pour le cutover</h1><p>La nouvelle expérience reste volontairement inactive tant que le schéma et les publications Global V2 n’ont pas été certifiés en production.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}

export function GlobalV2Unavailable() {
  return <section className={styles.activationPending} role="alert"><AlertTriangle aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Publication indisponible</h1><p>La génération publiée n’est pas complète ou compatible. Aucun calcul de remplacement n’a été lancé.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}
