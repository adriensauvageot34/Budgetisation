"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertTriangle, ArrowUp, BarChart3, ExternalLink, Info, RefreshCw, Sparkles } from "lucide-react";
import { parseMetricId } from "@/core/identity";
import { parseMoney, type Money } from "@/core/money";
import type { MetricEnvelope } from "@/core/metrics";
import { MultiSeriesMonetaryEvolution, OverlayFrame, RankingBar } from "@/ui";
import type {
  GlobalCompactInsight,
  GlobalCompactKpi,
  GlobalCompactQuality,
  GlobalDetailRow,
  GlobalDetailSeries,
  GlobalExpandedReadModel,
  GlobalExpandedSectionKey,
  GlobalInitialReadModel,
  ImportedGlobalSummaryReadModel,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalReadModelPublicationMeta,
  GlobalReadModelTransportState,
  GlobalV2ExpandedResourceName,
} from "@/query-api/global-v2";
import { globalModulePresentation, globalUiCopy } from "./catalog";
import { emitGlobalV2UxEvent } from "./instrumentation";
import { GlobalModuleBoundary } from "./module-boundary";
import { useGlobalV2Resource, useMobileGlobalLayout, useNearViewport } from "./use-global-resource";
import { GlobalV2VisitRuntime, parseGlobalDeepLink, type GlobalV2UiTransport } from "./visit-runtime";
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
  "ECONOMIC", "CATEGORIES_NEEDS", "RHYTHM", "TRANSFORMATIONS", "MOMENTS",
  "GEO_MOBILITY", "TOGETHER", "PERSONAS", "RELATIONSHIPS", "CONSUMPTION",
] as const satisfies readonly GlobalPrimaryModuleKey[]);

const internalNavigation = Object.freeze([
  { label: "Synthèse", anchor: "synthese" },
  { label: "Économie", anchor: "economie" },
  { label: "Catégories", anchor: "categories" },
  { label: "Rythmes", anchor: "rythmes" },
  { label: "Moments", anchor: "moments" },
  { label: "Lieux", anchor: "lieux" },
  { label: "Profils", anchor: "profils" },
  { label: "Nous deux", anchor: "nous-deux" },
  { label: "Autres analyses", anchor: "autres-analyses" },
] as const);

const moduleTabs: Readonly<Record<GlobalPrimaryModuleKey, readonly { readonly key: GlobalExpandedSectionKey; readonly label: string }[]>> = Object.freeze({
  ECONOMIC: [{ key: "OVERVIEW", label: "Vue d’ensemble" }, { key: "BREAKDOWN", label: "Structure" }, { key: "EVOLUTION", label: "Tendance" }],
  CATEGORIES_NEEDS: [{ key: "BREAKDOWN", label: "Catégories" }, { key: "PATTERNS", label: "Besoins" }, { key: "EVOLUTION", label: "Évolution" }],
  TRANSFORMATIONS: [{ key: "OVERVIEW", label: "Vue d’ensemble" }],
  RHYTHM: [{ key: "OVERVIEW", label: "Habitudes" }, { key: "EVOLUTION", label: "Évolution" }],
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

function MonetarySeries({ title, series }: { readonly title: string; readonly series: readonly GlobalDetailSeries[] }) {
  const comparable = series.slice(0, 3).filter((item) => item.unit === "EUR" && item.points.length > 0 && item.points.length <= 12);
  const periods = comparable[0]?.points.map(({ unitKey }) => unitKey) ?? [];
  const aligned = comparable.filter((item) => item.points.length === periods.length && item.points.every((point, index) => point.unitKey === periods[index]));
  if (aligned.length === 0) return null;
  return <div className={styles.chartWide}><MultiSeriesMonetaryEvolution frame={{ title, state: { kind: "ready" }, summary: <span>Évolution mensuelle des principales catégories publiées.</span> }} unit="EUR" series={aligned.map((item) => ({ id: item.seriesId, label: humanLabel(item.labelKey), points: item.points.map((point) => ({ period: point.unitKey, label: point.unitKey, metric: moneyEnvelope(numericDisplay(point.displayValue)) })) }))} /></div>;
}

function InsightCard({ insight }: { readonly insight: GlobalCompactInsight }) {
  return <article className={styles.primaryInsight}><Sparkles aria-hidden size={20} /><div><strong>{humanLabel(insight.titleKey)}</strong><p>{humanLabel(insight.statementKey)}</p></div></article>;
}

function KpiGrid({ kpis, limit = 3 }: { readonly kpis: readonly GlobalCompactKpi[]; readonly limit?: number }) {
  if (kpis.length === 0) return null;
  return <div className={styles.kpis}>{kpis.slice(0, limit).map((kpi) => <div key={kpi.kpiId}><span>{humanLabel(kpi.labelKey)}</span><strong>{kpi.displayValue}</strong></div>)}</div>;
}

type OverlayTarget = {
  readonly kind: "MODULE_DETAIL" | "ENTITY_DETAIL" | "METHODOLOGY";
  readonly title: string;
  readonly resource: GlobalV2ExpandedResourceName;
  readonly entityRef: string;
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly initialSection?: GlobalExpandedSectionKey;
};

function moduleOverlayTarget(moduleKey: GlobalPrimaryModuleKey, initialSection?: GlobalExpandedSectionKey): OverlayTarget {
  const presentation = globalModulePresentation(moduleKey);
  return { kind: "MODULE_DETAIL", title: presentation.title, resource: presentation.expandedResource, entityRef: `module:${moduleKey.toLowerCase()}`, moduleKey, ...(initialSection === undefined ? {} : { initialSection }) };
}

function methodOverlayTarget(moduleKey: GlobalPrimaryModuleKey): OverlayTarget {
  return { kind: "METHODOLOGY", title: "Méthode & fiabilité", resource: "analysis_global_methodology", entityRef: `method:${moduleKey.toLowerCase()}`, moduleKey };
}

function GlobalSeries({ model }: { readonly model: GlobalExpandedReadModel }) {
  if (model.series.length === 0) return null;
  return <div className={styles.seriesGrid}>{model.series.map((item) => <figure key={item.seriesId} className={styles.chart} aria-labelledby={`${item.seriesId}-title`}><figcaption id={`${item.seriesId}-title`}>{humanLabel(item.labelKey)}</figcaption><div className={styles.seriesTrack} role="list" aria-label={`${humanLabel(item.labelKey)} : chronologie`}>{item.points.map((point) => <div key={point.unitKey} role="listitem"><small>{point.unitKey}</small><strong>{point.displayValue ?? "Indisponible"}</strong></div>)}</div><details><summary>Alternative textuelle</summary><ul>{item.points.map((point) => <li key={point.unitKey}>{point.unitKey} : {point.displayValue ?? "Indisponible"}</li>)}</ul></details></figure>)}</div>;
}

function HumanRows({ rows, onDetail }: { readonly rows: readonly GlobalDetailRow[]; readonly onDetail: (row: GlobalDetailRow) => void }) {
  if (rows.length === 0) return null;
  return <div className={styles.rows}>{rows.map((row) => row.entityRef === undefined ? <div key={row.rowId}><span>{humanLabel(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong></div> : <button key={row.rowId} type="button" onClick={() => onDetail(row)}><span>{humanLabel(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong><ExternalLink aria-hidden size={15} /></button>)}</div>;
}

function GlobalExpandedContent({ model, onDetail }: { readonly model: GlobalExpandedReadModel; readonly onDetail: (row: GlobalDetailRow) => void }) {
  if (model.sectionKey === "METHODOLOGY") return <div className={styles.expandedContent}>
    <article className={styles.secondaryInsight}><strong>Une lecture fondée sur les données certifiées</strong><p>Chaque résultat est publié avec ses propres conditions de disponibilité, de couverture et de fiabilité. Une information insuffisante reste absente ou explicitement limitée.</p></article>
    <HumanQualityNote quality={model.quality} />
    <p className={styles.qualityNote}>Les calculs sont réalisés côté serveur avant la navigation. Cette page les présente sans recalculer la doctrine dans le navigateur.</p>
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

function GlobalDetailOverlay({ target, runtime, mobile, restoreFocusRef, onReplace, onClose }: { readonly target: OverlayTarget; readonly runtime: GlobalV2VisitRuntime; readonly mobile: boolean; readonly restoreFocusRef: RefObject<HTMLElement | null>; readonly onReplace: (target: OverlayTarget) => void; readonly onClose: () => void }) {
  const tabs = target.kind === "MODULE_DETAIL" ? moduleTabs[target.moduleKey] : [];
  const [section, setSection] = useState<GlobalExpandedSectionKey>(target.initialSection ?? tabs[0]?.key ?? "METHODOLOGY");
  useEffect(() => setSection(target.initialSection ?? tabs[0]?.key ?? "METHODOLOGY"), [target, tabs]);
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
  const presentation = globalModulePresentation(target.moduleKey);
  return <OverlayFrame kind="exploration" title={target.title} subtitle={target.kind === "ENTITY_DETAIL" ? "Détail" : target.kind === "METHODOLOGY" ? "Comprendre la qualité de cette analyse" : presentation.description} closeAction={{ kind: "callback", onAction: onClose }} restoreFocusRef={restoreFocusRef} closeOnBackdrop className={`${styles.detailOverlay} ${mobile ? styles.mobileOverlay : ""}`}>
    {tabs.length > 1 ? <div className={styles.sectionTabs} role="tablist" aria-label={`Sections de ${target.title}`}>{tabs.map((item) => <button key={item.key} type="button" role="tab" aria-selected={section === item.key} onClick={() => { setSection(item.key); emitGlobalV2UxEvent("global_section_expanded", { moduleKey: target.moduleKey, sectionKey: item.key }); window.history.replaceState(window.history.state, "", `#${moduleSlugs[target.moduleKey]}-${item.key.toLowerCase()}`); }}>{item.label}</button>)}</div> : null}
    {result.state.status === "IDLE" || result.state.status === "LOADING" ? <LoadingCard label={target.title} /> : result.state.status === "ERROR" && model === undefined ? <LocalError retry={result.retry} /> : model === undefined ? null : <GlobalExpandedContent model={model} onDetail={(row) => presentation.detailResource === undefined || row.entityRef === undefined ? undefined : onReplace({ kind: "ENTITY_DETAIL", title: humanLabel(row.labelKey), resource: presentation.detailResource, entityRef: row.entityRef, moduleKey: target.moduleKey })} />}
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

function ModuleContent({ moduleKey, model, runtime, onDetail, onMethod }: { readonly moduleKey: GlobalPrimaryModuleKey; readonly model: GlobalModuleCompactReadModel; readonly runtime: GlobalV2VisitRuntime; readonly onDetail: () => void; readonly onMethod: () => void }) {
  if (moduleKey === "TRANSFORMATIONS") return <div className={styles.neutralState}><strong>Aucun changement durable clairement identifié</strong><p>Aucun changement suffisamment net et durable n’a été identifié sur la période.</p></div>;
  if (moduleKey === "RELATIONSHIPS") return <div className={styles.neutralState}><strong>Pas encore assez d’éléments pour établir une relation fiable</strong><p>Les associations disponibles ne sont pas assez étayées pour être présentées comme un résultat.</p></div>;
  if (moduleKey === "CONSUMPTION") return <div className={styles.neutralState}><strong>Analyse pas encore disponible</strong><p>L’identité des achats ne couvre pas encore suffisamment la période pour proposer une lecture fiable.</p></div>;

  const insight = model.primaryInsight;
  if (moduleKey === "ECONOMIC") return <div className={styles.compact}>
    <KpiGrid kpis={model.kpis} />
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <MoneyRanking title="Mois observé, habituel et minimum" rows={model.kpis.map((item) => ({ id: item.kpiId, label: item.labelKey, displayValue: item.displayValue }))} limit={3} />
    <HumanQualityNote quality={model.quality} /><SeeDetail onClick={onDetail} />
  </div>;

  if (moduleKey === "CATEGORIES_NEEDS") return <div className={styles.compact}>
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="BREAKDOWN">{(expanded) => <MoneyRanking title="Principales catégories" rows={expanded.rows.map((row) => ({ id: row.rowId, label: row.labelKey, displayValue: row.displayValue }))} />}</ExpandedPreview>
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="EVOLUTION">{(expanded) => <MonetarySeries title="Évolution sur douze mois" series={expanded.series} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;

  if (moduleKey === "RHYTHM") return <div className={styles.compact}>
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(expanded) => <PersonaColumns rows={expanded.rows} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;

  if (moduleKey === "MOMENTS") return <div className={styles.compact}>
    <PartialBadge onClick={onMethod} />
    {insight === undefined ? null : <InsightCard insight={insight} />}
    <div className={styles.momentCards}>{model.kpis.slice(0, 3).map((item) => <article key={item.kpiId}><span>{humanLabel(item.labelKey)}</span><strong>{item.displayValue}</strong></article>)}</div>
    <ExpandedPreview runtime={runtime} moduleKey={moduleKey} sectionKey="OVERVIEW">{(expanded) => <MoneyRanking title="Coûts liés aux moments" rows={expanded.rows.map((row) => ({ id: row.rowId, label: row.labelKey, displayValue: row.displayValue }))} />}</ExpandedPreview>
    <SeeDetail onClick={onDetail} />
  </div>;

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

function GlobalModulePanel({ moduleKey, runtime, eager, direct, onOverlay }: { readonly moduleKey: GlobalPrimaryModuleKey; readonly runtime: GlobalV2VisitRuntime; readonly eager: boolean; readonly direct: boolean; readonly onOverlay: (target: OverlayTarget) => void }) {
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
  const openMethod = () => { onOverlay(methodOverlayTarget(moduleKey)); emitGlobalV2UxEvent("global_methodology_opened", { moduleKey }); };
  return <section ref={nearViewport.ref} id={moduleSlugs[moduleKey]} className={styles.module} data-module={moduleKey} aria-labelledby={`${moduleSlugs[moduleKey]}-title`}>
    <header className={styles.moduleHeader}><div><span className="eyebrow">{presentation.eyebrow}</span><h2 id={`${moduleSlugs[moduleKey]}-title`}>{presentation.title}</h2><p>{presentation.description}</p></div></header>
    {compact.state.status === "IDLE" || compact.state.status === "LOADING" ? <LoadingCard label={presentation.title} /> : compact.state.status === "ERROR" && compactModel === undefined ? <LocalError retry={compact.retry} /> : compactModel === undefined ? null : <ModuleContent moduleKey={moduleKey} model={compactModel} runtime={runtime} onDetail={openDetail} onMethod={openMethod} />}
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
  const row2: readonly SummarySlotDefinition[] = [{ slot: "S3", moduleKey: "CATEGORIES_NEEDS", kind: "INSIGHT" }, { slot: "S4", moduleKey: "RHYTHM", kind: "INSIGHT" }, { slot: "S5", moduleKey: "MOMENTS", kind: "INSIGHT" }];
  const row3: readonly SummarySlotDefinition[] = [{ slot: "S6", moduleKey: "GEO_MOBILITY", kind: "INSIGHT" }, { slot: "S7", moduleKey: "TOGETHER", kind: "INSIGHT" }];
  return <section id="synthese" className={styles.summary} aria-labelledby="global-summary-title">
    <header><div><span className="eyebrow">Synthèse</span><h2 id="global-summary-title">L’essentiel de votre année</h2></div></header>
    <section className={styles.summaryGroup}><h3>Votre argent</h3><div className={styles.summaryRow}><SummarySlot definition={s1} runtime={runtime} /><SummarySlot definition={s2} runtime={runtime} /></div></section>
    <div className={styles.summaryRow}>{row2.map((definition) => <SummarySlot key={definition.slot} definition={definition} runtime={runtime} />)}</div>
    <div className={styles.summaryRow}>{row3.map((definition) => <SummarySlot key={definition.slot} definition={definition} runtime={runtime} />)}</div>
  </section>;
}

export function GlobalV2Page({ bundle, transport }: { readonly bundle: GlobalV2PageBundle; readonly transport: GlobalV2UiTransport; readonly certifiedThrough: string }) {
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
    if (section !== undefined) openOverlay(moduleOverlayTarget(moduleKey, section));
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
    <header className={styles.hero}><div><h1>Notre vie, dans son ensemble</h1><p className={styles.period}>Août 2025 → juillet 2026 · 12 mois analysés</p><p>Une vue d’ensemble de vos dépenses, habitudes, moments et lieux sur l’année.</p><button type="button" className={styles.methodButton} onClick={() => openOverlay(methodOverlayTarget("ECONOMIC"))}><Info aria-hidden size={17} /> Méthode & fiabilité</button></div></header>
    {bundle.newerPublication === undefined ? null : <aside className={styles.generationBanner} role="status" aria-live="polite"><div><strong>Une version plus récente est disponible.</strong><span>Votre lecture actuelle reste stable jusqu’à l’actualisation.</span></div><button type="button" className="button-primary" onClick={() => window.location.reload()}><RefreshCw aria-hidden size={16} /> Actualiser</button></aside>}
    <nav className={styles.stickyNav} aria-label="Navigation dans l’analyse globale">{internalNavigation.map(({ label, anchor }) => <button key={anchor} type="button" aria-current={activeAnchor === anchor ? "location" : undefined} onClick={() => goTo(anchor)}>{label}</button>)}</nav>
    <HumanSummary runtime={runtime} />
    <main className={styles.story}>{orderedModules.map((moduleKey, index) => <GlobalModuleBoundary key={moduleKey}><GlobalModulePanel moduleKey={moduleKey} runtime={runtime} eager={index < 2} direct={directModule === moduleKey} onOverlay={openOverlay} /></GlobalModuleBoundary>)}</main>
    <button type="button" className={styles.backToTop} onClick={() => goTo()}><ArrowUp aria-hidden size={17} /> Retour au sommet</button>
    {overlay === null ? null : <GlobalDetailOverlay target={overlay} runtime={runtime} mobile={mobile} restoreFocusRef={overlayInvokerRef} onReplace={(target) => { setOverlay(target); emitGlobalV2UxEvent("global_entity_opened", { moduleKey: target.moduleKey }); }} onClose={() => setOverlay(null)} />}
  </div>;
}

export function GlobalV2ActivationPending() {
  return <section className={styles.activationPending}><BarChart3 aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Interface prête pour le cutover</h1><p>La nouvelle expérience reste volontairement inactive tant que le schéma et les publications Global V2 n’ont pas été certifiés en production.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}

export function GlobalV2Unavailable() {
  return <section className={styles.activationPending} role="alert"><AlertTriangle aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Publication indisponible</h1><p>La génération publiée n’est pas complète ou compatible. Aucun calcul de remplacement n’a été lancé.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}
