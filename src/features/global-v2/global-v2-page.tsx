"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, BarChart3, ChevronDown, ExternalLink, Info, RefreshCw, Sparkles } from "lucide-react";
import { OverlayFrame } from "@/ui";
import type {
  GlobalCompactQuality,
  GlobalDetailRow,
  GlobalExpandedReadModel,
  GlobalExpandedSectionKey,
  GlobalModuleCompactReadModel,
  GlobalPrimaryModuleKey,
  GlobalReadModelTransportState,
  GlobalV2ExpandedResourceName,
} from "@/query-api/global-v2";
import { globalExpandedSections, globalModulePresentation, globalModulePresentations, globalUiCopy } from "./catalog";
import { createGlobalV2FixtureTransport, type GlobalV2FixtureBundle, type GlobalV2FixtureScenario } from "./fixture-data";
import { emitGlobalV2UxEvent } from "./instrumentation";
import { GlobalModuleBoundary } from "./module-boundary";
import { useGlobalV2Resource, useMobileGlobalLayout, useNearViewport } from "./use-global-resource";
import { GlobalV2VisitRuntime, parseGlobalDeepLink, updateExpandedModules } from "./visit-runtime";
import styles from "./global-v2.module.css";

const moduleSlugs: Readonly<Record<GlobalPrimaryModuleKey, string>> = Object.freeze({
  ECONOMIC: "economie",
  CATEGORIES_NEEDS: "besoins",
  TRANSFORMATIONS: "chapitres",
  RHYTHM: "rythmes",
  RELATIONSHIPS: "relations",
  MOMENTS: "moments",
  GEO_MOBILITY: "lieux",
  CONSUMPTION: "achats",
  PERSONAS: "profils",
  TOGETHER: "nous-deux",
});

function moduleForSlug(slug: string): GlobalPrimaryModuleKey | undefined {
  return (Object.entries(moduleSlugs) as readonly [GlobalPrimaryModuleKey, string][]).find(([, value]) => value === slug)?.[0];
}

function formatCertifiedDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(value));
}

function qualityLabel(quality: GlobalCompactQuality): string {
  if (quality.knowledgeState === "KNOWN") return "Donnée connue";
  if (quality.knowledgeState === "PARTIAL") return quality.partialMeaning === "LOWER_BOUND" ? "Borne basse" : "Périmètre observé";
  if (quality.knowledgeState === "NOT_APPLICABLE") return "Non applicable";
  if (quality.knowledgeState === "CONFLICT") return "Conflit à résoudre";
  return "Information inconnue";
}

function transportData<Data>(state: GlobalReadModelTransportState<Data>): Data | undefined {
  return state.status === "READY" ? state.data : state.status === "ERROR" ? state.previousData : undefined;
}

function LoadingCard({ label }: { readonly label: string }) {
  return <div className={styles.skeleton} role="status" aria-label={`Chargement de ${label}`} aria-busy="true"><span>Chargement de {label}…</span></div>;
}

function LocalError({ code, retry }: { readonly code: string; readonly retry: () => void }) {
  return <div className={styles.localError} role="alert"><strong>Ce contenu n’a pas pu être chargé.</strong><p>Le reste de l’analyse reste disponible. Référence : {code}</p><button type="button" className="button-secondary" onClick={retry}><RefreshCw aria-hidden size={16} /> Réessayer</button></div>;
}

function QualityLine({ quality }: { readonly quality: GlobalCompactQuality }) {
  return <div className={styles.qualityLine}><span className={styles.qualityBadge} data-state={quality.knowledgeState}>{qualityLabel(quality)}</span>{quality.effectiveCoverage === undefined ? null : <span>{Math.round(quality.effectiveCoverage * 100)} % couverts</span>}{quality.supportStatus === undefined ? null : <span>Support {quality.supportStatus.toLowerCase().replaceAll("_", " ")}</span>}</div>;
}

type OverlayTarget = {
  readonly kind: "ANALYTICAL_DETAIL" | "ENTITY_DETAIL" | "METHODOLOGY";
  readonly title: string;
  readonly resource: GlobalV2ExpandedResourceName;
  readonly entityRef: string;
  readonly moduleKey: GlobalPrimaryModuleKey;
};

function GlobalSeries({ model }: { readonly model: GlobalExpandedReadModel }) {
  if (model.series.length === 0) return null;
  return <div className={styles.seriesGrid}>{model.series.map((series) => <figure key={series.seriesId} className={styles.chart} aria-labelledby={`${series.seriesId}-title`}><figcaption id={`${series.seriesId}-title`}>{globalUiCopy(series.labelKey)}</figcaption><div className={styles.seriesTrack} role="list" aria-label={`${globalUiCopy(series.labelKey)} : chronologie`}>{series.points.map((point) => <div key={point.unitKey} role="listitem"><small>{point.unitKey}</small><strong>{point.displayValue ?? "Indisponible"}</strong><span>{qualityLabel({ knowledgeState: point.knowledgeState, dataNature: "OBSERVED", limitationCodes: [], evidenceRefs: [] })}</span></div>)}</div><details><summary>Alternative textuelle</summary><ul>{series.points.map((point) => <li key={point.unitKey}>{point.unitKey} : {point.displayValue ?? qualityLabel({ knowledgeState: point.knowledgeState, dataNature: "OBSERVED", limitationCodes: [], evidenceRefs: [] })}</li>)}</ul></details></figure>)}</div>;
}

function GlobalExpandedContent({
  model,
  onDetail,
  onMethodology,
}: {
  readonly model: GlobalExpandedReadModel;
  readonly onDetail: (row: GlobalDetailRow) => void;
  readonly onMethodology: () => void;
}) {
  return <div className={styles.expandedContent}>
    {model.primaryInsight === undefined ? null : <article className={styles.secondaryInsight}><strong>{globalUiCopy(model.primaryInsight.titleKey)}</strong><p>{globalUiCopy(model.primaryInsight.statementKey)}</p></article>}
    {model.secondaryInsights.map((item) => <article key={item.insightId} className={styles.secondaryInsight}><strong>{globalUiCopy(item.titleKey)}</strong><p>{globalUiCopy(item.statementKey)}</p></article>)}
    {model.metrics.length === 0 ? null : <div className={styles.expandedMetrics}>{model.metrics.map((metric) => <div key={metric.metricId}><span>{globalUiCopy(metric.labelKey)}</span><strong>{metric.dataNature === "ESTIMATED" && !metric.displayValue.startsWith("≈") ? `≈ ${metric.displayValue}` : metric.displayValue}</strong><small>{qualityLabel({ knowledgeState: metric.knowledgeState, ...(metric.partialMeaning === undefined ? {} : { partialMeaning: metric.partialMeaning }), dataNature: metric.dataNature, limitationCodes: [], evidenceRefs: [] })}</small></div>)}</div>}
    <GlobalSeries model={model} />
    {model.rows.length === 0 ? null : <div className={styles.rows}>{model.rows.map((row) => row.entityRef === undefined ? <div key={row.rowId}><span>{globalUiCopy(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong></div> : <button key={row.rowId} type="button" onClick={() => onDetail(row)}><span>{globalUiCopy(row.labelKey)}</span><strong>{row.displayValue ?? "Indisponible"}</strong><ExternalLink aria-hidden size={15} /></button>)}</div>}
    <QualityLine quality={model.quality} />
    <div className={styles.expandedActions}><button type="button" className="button-ghost" onClick={onMethodology}><Info aria-hidden size={16} /> Méthode et preuves</button><Link className="button-ghost" href="/historique">Voir dans l’Historique</Link><Link className="button-ghost" href="/operations">Voir les opérations</Link></div>
    <details className={styles.evidence}><summary>Support et limitations</summary><p>Preuves : {model.quality.evidenceRefs.join(" · ") || "aucune référence publiée"}</p>{model.quality.limitationCodes.length === 0 ? <p>Aucune limitation bloquante publiée.</p> : <ul>{model.quality.limitationCodes.map((code) => <li key={code}>{code}</li>)}</ul>}</details>
  </div>;
}

function GlobalModulePanel({
  moduleKey,
  runtime,
  expanded,
  eager,
  direct,
  requestedSection,
  onToggle,
  onOverlay,
}: {
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly runtime: GlobalV2VisitRuntime;
  readonly expanded: boolean;
  readonly eager: boolean;
  readonly direct: boolean;
  readonly requestedSection?: GlobalExpandedSectionKey;
  readonly onToggle: () => void;
  readonly onOverlay: (target: OverlayTarget) => void;
}) {
  const presentation = globalModulePresentation(moduleKey);
  const nearViewport = useNearViewport();
  const shouldLoad = eager || direct || nearViewport.near;
  const request = useMemo(() => ({ resource: presentation.resource, params: {} }), [presentation.resource]);
  const compact = useGlobalV2Resource<GlobalModuleCompactReadModel>(runtime, request, shouldLoad, direct ? "DIRECT" : "BACKGROUND");
  const [section, setSection] = useState<GlobalExpandedSectionKey>(requestedSection ?? "OVERVIEW");
  useEffect(() => { if (requestedSection !== undefined) setSection(requestedSection); }, [requestedSection]);
  const expandedRequest = useMemo(() => ({ resource: presentation.expandedResource, params: { sectionKey: section } }), [presentation.expandedResource, section]);
  const detail = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, expandedRequest, expanded, "DIRECT");
  const compactModel = transportData(compact.state);
  const expandedModel = transportData(detail.state);
  const viewed = useRef(false);
  useEffect(() => {
    if (compactModel === undefined || viewed.current) return;
    viewed.current = true;
    emitGlobalV2UxEvent("global_module_viewed", { moduleKey });
  }, [compactModel, moduleKey]);

  return <section ref={nearViewport.ref} id={moduleSlugs[moduleKey]} className={styles.module} data-module={moduleKey} data-expanded={expanded || undefined} aria-labelledby={`${moduleSlugs[moduleKey]}-title`}>
    <header className={styles.moduleHeader}>
      <div><span className="eyebrow">{presentation.eyebrow}</span><h2 id={`${moduleSlugs[moduleKey]}-title`}>{presentation.title}</h2><p>{presentation.description}</p></div>
      {compactModel?.visibility === "VISIBLE" ? <button type="button" className={styles.expandButton} aria-expanded={expanded} aria-controls={`${moduleSlugs[moduleKey]}-expanded`} onClick={onToggle}>{expanded ? "Réduire" : "Développer"}<ChevronDown aria-hidden size={18} /></button> : null}
    </header>
    {compact.state.status === "IDLE" || compact.state.status === "LOADING" ? <LoadingCard label={presentation.title} /> : compact.state.status === "ERROR" && compactModel === undefined ? <LocalError code={compact.state.errorCode} retry={compact.retry} /> : null}
    {compactModel?.visibility === "PLACEHOLDER" ? <div className={styles.placeholder} role="status"><strong>Analyse en préparation</strong><p>{compactModel.placeholder?.messageKey}</p>{compactModel.placeholder?.progress === undefined ? null : <span>{compactModel.placeholder.progress.current}/{compactModel.placeholder.progress.required} {compactModel.placeholder.progress.unit}</span>}<QualityLine quality={compactModel.quality} /></div> : null}
    {compactModel?.visibility === "VISIBLE" ? <div className={styles.compact}>
      {compactModel.primaryInsight === undefined ? <p className={styles.calmState}>Aucun fait suffisamment robuste ne ressort pour cette période.</p> : <article className={styles.primaryInsight}><Sparkles aria-hidden size={20} /><div><strong>{globalUiCopy(compactModel.primaryInsight.titleKey)}</strong><p>{globalUiCopy(compactModel.primaryInsight.statementKey)}</p></div></article>}
      <div className={styles.kpis}>{compactModel.kpis.map((kpi) => <div key={kpi.kpiId}><span>{globalUiCopy(kpi.labelKey)}</span><strong>{kpi.displayValue}</strong></div>)}</div>
      <QualityLine quality={compactModel.quality} />
    </div> : null}
    {expanded && compactModel?.visibility === "VISIBLE" ? <div id={`${moduleSlugs[moduleKey]}-expanded`} className={styles.expanded}>
      <div className={styles.sectionTabs} role="tablist" aria-label={`Sections de ${presentation.title}`}>{globalExpandedSections.map((item) => <button key={item.key} type="button" role="tab" aria-selected={section === item.key} onClick={() => { setSection(item.key); emitGlobalV2UxEvent("global_section_expanded", { moduleKey, sectionKey: item.key }); window.history.replaceState(window.history.state, "", `#${moduleSlugs[moduleKey]}-${item.key.toLowerCase()}`); }}>{item.label}</button>)}</div>
      {detail.state.status === "IDLE" || detail.state.status === "LOADING" ? <LoadingCard label={`${presentation.title} · ${section.toLowerCase()}`} /> : detail.state.status === "ERROR" && expandedModel === undefined ? <LocalError code={detail.state.errorCode} retry={detail.retry} /> : expandedModel === undefined ? null : <GlobalExpandedContent model={expandedModel} onDetail={(row) => presentation.detailResource === undefined ? undefined : onOverlay({ kind: "ANALYTICAL_DETAIL", title: globalUiCopy(row.labelKey), resource: presentation.detailResource, entityRef: row.entityRef!, moduleKey })} onMethodology={() => onOverlay({ kind: "METHODOLOGY", title: `Méthode · ${presentation.title}`, resource: "analysis_global_methodology", entityRef: `method:${moduleKey.toLowerCase()}`, moduleKey })} />}
    </div> : null}
  </section>;
}

function GlobalDetailOverlay({ target, runtime, mobile, onClose, onEntity }: { readonly target: OverlayTarget; readonly runtime: GlobalV2VisitRuntime; readonly mobile: boolean; readonly onClose: () => void; readonly onEntity: () => void }) {
  const params = useMemo<Readonly<Record<string, string>>>(() => {
    if (target.kind === "METHODOLOGY") return { moduleKey: target.moduleKey, methodRef: target.entityRef } as Readonly<Record<string, string>>;
    return { entityRef: target.entityRef } as Readonly<Record<string, string>>;
  }, [target]);
  const request = useMemo(() => ({ resource: target.resource, params }), [params, target.resource]);
  const result = useGlobalV2Resource<GlobalExpandedReadModel>(runtime, request, true, "DIRECT");
  const model = transportData(result.state);
  return <OverlayFrame kind="exploration" title={target.title} subtitle={target.kind === "ENTITY_DETAIL" ? "Fiche entité" : target.kind === "METHODOLOGY" ? "Preuve et méthode" : "Détail analytique"} closeAction={{ kind: "callback", onAction: onClose }} closeOnBackdrop className={`${styles.detailOverlay} ${mobile ? styles.mobileOverlay : ""}`}>
    {result.state.status === "IDLE" || result.state.status === "LOADING" ? <LoadingCard label={target.title} /> : result.state.status === "ERROR" && model === undefined ? <LocalError code={result.state.errorCode} retry={result.retry} /> : model === undefined ? null : <GlobalExpandedContent model={model} onDetail={() => undefined} onMethodology={() => undefined} />}
    {target.kind === "ANALYTICAL_DETAIL" ? <button type="button" className="button-primary" onClick={onEntity}><ExternalLink aria-hidden size={16} /> Ouvrir la fiche entité</button> : null}
  </OverlayFrame>;
}

export function GlobalV2Page({ bundle, scenario = "contract" }: { readonly bundle: GlobalV2FixtureBundle; readonly scenario?: GlobalV2FixtureScenario }) {
  const mobile = useMobileGlobalLayout();
  const runtime = useMemo(() => new GlobalV2VisitRuntime(bundle.initial.publicationMeta, createGlobalV2FixtureTransport(bundle, scenario), 2), [bundle, scenario]);
  const navigation = useMemo(() => bundle.initial.navigation.filter((entry) => entry.visibility !== "HIDDEN"), [bundle.initial.navigation]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [directModule, setDirectModule] = useState<GlobalPrimaryModuleKey | undefined>();
  const [requestedSection, setRequestedSection] = useState<GlobalExpandedSectionKey | undefined>();
  const [activeAnchor, setActiveAnchor] = useState("synthese");
  const [overlay, setOverlay] = useState<OverlayTarget | null>(null);
  const deepLinkApplied = useRef(false);

  useEffect(() => {
    if (deepLinkApplied.current) return;
    deepLinkApplied.current = true;
    const deepLink = parseGlobalDeepLink(window.location.hash);
    if (deepLink === null || deepLink.anchor === "synthese") return;
    const [slug, rawSection] = deepLink.anchor.split(/-(?=overview|evolution|breakdown|patterns|comparisons$)/u);
    const moduleKey = moduleForSlug(slug);
    if (moduleKey === undefined) return;
    setDirectModule(moduleKey);
    if (rawSection !== undefined) setRequestedSection(rawSection.toUpperCase() as GlobalExpandedSectionKey);
    setExpanded((current) => updateExpandedModules(current, moduleKey, mobile));
    requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
  }, [mobile]);

  useEffect(() => {
    const elements = [document.getElementById("synthese"), ...navigation.map(({ moduleKey }) => document.getElementById(moduleSlugs[moduleKey]))].filter((entry): entry is HTMLElement => entry !== null);
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveAnchor(visible.target.id);
    }, { rootMargin: "-25% 0px -62% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [navigation]);

  const goTo = useCallback((moduleKey?: GlobalPrimaryModuleKey) => {
    const anchor = moduleKey === undefined ? "synthese" : moduleSlugs[moduleKey];
    if (moduleKey !== undefined) setDirectModule(moduleKey);
    window.history.replaceState(window.history.state, "", `#${anchor}`);
    document.getElementById(anchor)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);

  return <div className={styles.page} data-global-v2="" data-publication-id={bundle.initial.publicationMeta.publicationId}>
    <header className={styles.hero}>
      <div><span className="eyebrow">Analyse globale · nouvelle architecture</span><h1>Notre vie, dans son ensemble</h1><p>Une lecture continue de l’économie, des rythmes, des expériences et du partagé — sans filtre temporel artificiel.</p></div>
      <div className={styles.certification}><span>Données certifiées jusqu’au</span><strong>31 juillet 2026</strong><small>Publication générée le {formatCertifiedDate(bundle.initial.publicationMeta.generatedAt)}</small></div>
    </header>
    {bundle.newerPublication === undefined ? null : <aside className={styles.generationBanner} role="status" aria-live="polite"><div><strong>Une version plus récente est disponible.</strong><span>La page reste épinglée à la publication en cours jusqu’à votre décision.</span></div><button type="button" className="button-primary" onClick={() => window.location.reload()}><RefreshCw aria-hidden size={16} /> Actualiser</button></aside>}
    <nav className={styles.stickyNav} aria-label="Navigation dans l’analyse globale"><button type="button" aria-current={activeAnchor === "synthese" ? "location" : undefined} onClick={() => goTo()}>Synthèse</button>{navigation.map(({ moduleKey }) => <button key={moduleKey} type="button" aria-current={activeAnchor === moduleSlugs[moduleKey] ? "location" : undefined} onClick={() => goTo(moduleKey)}>{globalModulePresentation(moduleKey).shortLabel}</button>)}</nav>
    <section id="synthese" className={styles.summary} aria-labelledby="global-summary-title">
      <header><div><span className="eyebrow">Synthèse</span><h2 id="global-summary-title">Ce que raconte la période certifiée</h2></div><span className={styles.summaryStatus}>{bundle.summary.status === "FRESH" ? "Importée · à jour" : bundle.summary.status === "STALE" ? "Importée · à actualiser" : "Non importée"}</span></header>
      {bundle.summary.status === "MISSING" ? <p>La synthèse importée n’est pas disponible. Les modules certifiés restent accessibles.</p> : <div className={styles.summaryCopy} dangerouslySetInnerHTML={{ __html: bundle.summary.sanitizedHtml! }} />}
      <small>Ce texte résume les ReadModels publiés ; il ne produit aucun calcul Analytics.</small>
    </section>
    <main className={styles.story}>
      {navigation.map(({ moduleKey }, index) => <GlobalModuleBoundary key={moduleKey}><GlobalModulePanel moduleKey={moduleKey} runtime={runtime} expanded={expanded.has(moduleKey)} eager={index === 0} direct={directModule === moduleKey} requestedSection={directModule === moduleKey ? requestedSection : undefined} onToggle={() => { setExpanded((current) => updateExpandedModules(current, moduleKey, mobile)); emitGlobalV2UxEvent("global_module_expanded", { moduleKey, state: expanded.has(moduleKey) ? "compact" : "expanded" }); }} onOverlay={(target) => { setOverlay(target); emitGlobalV2UxEvent(target.kind === "METHODOLOGY" ? "global_methodology_opened" : "global_entity_opened", { moduleKey, target: target.entityRef }); }} /></GlobalModuleBoundary>)}
    </main>
    <button type="button" className={styles.backToTop} onClick={() => goTo()}><ArrowUp aria-hidden size={17} /> Retour au sommet</button>
    {overlay === null ? null : <GlobalDetailOverlay target={overlay} runtime={runtime} mobile={mobile} onClose={() => setOverlay(null)} onEntity={() => { setOverlay({ ...overlay, kind: "ENTITY_DETAIL", title: `Fiche · ${overlay.title}` }); emitGlobalV2UxEvent("global_entity_opened", { moduleKey: overlay.moduleKey, target: overlay.entityRef }); }} />}
  </div>;
}

export function GlobalV2ActivationPending() {
  return <section className={styles.activationPending}><BarChart3 aria-hidden size={28} /><span className="eyebrow">Analyse globale V2</span><h1>Interface prête pour le cutover</h1><p>La nouvelle expérience reste volontairement inactive tant que le schéma et les publications Global V2 n’ont pas été certifiés en production.</p><Link className="button-primary" href="/historique/analyse/global">Ouvrir l’analyse actuellement active</Link></section>;
}
