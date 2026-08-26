"use client";

import { useMemo, useState } from "react";
import { parseActivityId, parseCategoryId, parseMerchantId, parsePlaceId, type PersonId } from "@/core/identity";
import { normalizeAnalysisScope, parseDayContext, parseLifeScopeContext, type NormalizedAnalysisScope } from "@/core/scope";
import { formatYearMonth } from "@/core/time";
import { useProductRuntime, useProductSurface, useQueryRuntime, useRestorableSubview, useSemanticAnchor } from "@/components/runtime";
import { scopeForRoot, type HistoryRootContext, type NavigationSubviewRef, type SemanticAnchor } from "@/navigation";
import type {
  AnalysisLivedSubview,
  AnalysisMonthInitialReadModel,
  AnalysisStructureDimension,
  AnalysisStructureMeasure,
  AnalysisStructureView,
} from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { ErrorState, FilterTrigger, RefreshIndicator, SectionLayout, SectionSkeleton, type UiTransportState } from "@/ui";
import {
  EvolutionModule,
  LivedModule,
  MarkedFactsModule,
  MomentsModule,
  StructureModule,
  SummaryModule,
} from "./analysis-month-modules";
import { AnalysisMonthModuleBoundary } from "./module-boundary";
import styles from "./month.module.css";

type PersonOption = { readonly id: PersonId; readonly label: string };
type StructureState = { readonly view: AnalysisStructureView; readonly dimension: AnalysisStructureDimension; readonly measure: AnalysisStructureMeasure; readonly selectedBucketId?: string };

function dataFrom<T>(state: UiTransportState<T>): T | undefined {
  return state.status === "success" ? state.response.data : state.status === "error" ? state.previousData?.data : undefined;
}

function readinessFrom<T>(state: UiTransportState<T>) {
  const data = dataFrom(state);
  return state.status === "idle" || state.status === "loading"
    ? "pending" as const
    : state.status === "error" && data === undefined
      ? "terminal_without_anchor" as const
      : "ready" as const;
}

function csv(form: FormData, key: string): readonly string[] {
  const value = String(form.get(key) ?? "").trim();
  return value.length === 0 ? [] : value.split(",").map((item) => item.trim()).filter(Boolean);
}

function SectionAnchor({ anchor, children }: { readonly anchor: SemanticAnchor; readonly children: React.ReactNode }) {
  const ref = useSemanticAnchor(anchor);
  return <div ref={ref} id={anchor.itemKey ? `analysis-${anchor.itemKey}` : undefined}>{children}</div>;
}

export function AnalysisMonthPage({
  route,
  scope: serverScope,
  persons,
  initialState,
}: {
  readonly route: HistoryRootContext;
  readonly scope: NormalizedAnalysisScope;
  readonly persons: readonly PersonOption[];
  readonly initialState: UiTransportState<AnalysisMonthInitialReadModel>;
}) {
  const runtime = useProductRuntime();
  const runtimeRoot = runtime.snapshot?.history.root;
  const currentRoute: HistoryRootContext = runtimeRoot && "area" in runtimeRoot && runtimeRoot.area === "analysis" && runtimeRoot.context.kind === "analysis_month"
    ? runtimeRoot
    : route;
  const currentScope = useMemo(() => {
    const runtimeScope = scopeForRoot(currentRoute);
    return runtimeScope?.time.kind === "month" ? runtimeScope : serverScope;
  }, [currentRoute, serverScope]);
  if (currentScope.time.kind !== "month") throw new TypeError("AnalysisMonthPage exige un scope Month.");
  const month = currentScope.time.month;

  const [selectedPoint, setSelectedPoint] = useState(month);
  const [structure, setStructure] = useState<StructureState>({ view: "destination", dimension: "category", measure: "amount" });
  const [livedSubview, setLivedSubview] = useState<AnalysisLivedSubview>("summary");
  const [currentView, setCurrentView] = useState<Extract<NavigationSubviewRef, { kind: "analysis-month" }>["view"]>("summary");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  useRestorableSubview(currentRoute, (restored) => {
    if (restored?.kind !== "analysis-month") return;
    setCurrentView((current) => current === restored.view ? current : restored.view);
    if (restored.selectedPoint) setSelectedPoint((current) => current === restored.selectedPoint ? current : restored.selectedPoint!);
    if (restored.structure) setStructure((current) => JSON.stringify(current) === JSON.stringify(restored.structure) ? current : restored.structure!);
    if (restored.lived) setLivedSubview((current) => current === restored.lived!.activeSubview ? current : restored.lived!.activeSubview);
  });

  const subview: NavigationSubviewRef = useMemo(() => ({
    kind: "analysis-month",
    view: currentView,
    selectedPoint,
    structure,
    lived: { activeSubview: livedSubview },
  }), [currentView, livedSubview, selectedPoint, structure]);

  const initialRequest = useMemo(() => ({ resource: queryResourceKeys.analysisMonthInitial, scope: currentScope, params: {} }), [currentScope]);
  const initial = useQueryRuntime(initialRequest, initialState);
  useProductSurface({ route: currentRoute, scope: currentScope, subview, readiness: readinessFrom(initial) });

  const moneyActive = currentView === "money";
  const evolution = useQueryRuntime<"analysis_month_evolution">(useMemo(() => moneyActive ? ({ resource: queryResourceKeys.analysisMonthEvolution, scope: currentScope, params: {} }) : null, [currentScope, moneyActive]));
  const structureTransport = useQueryRuntime<"analysis_month_structure">(useMemo(() => moneyActive ? ({ resource: queryResourceKeys.analysisMonthStructure, scope: currentScope, params: { view: structure.view, dimension: structure.dimension, measure: structure.measure } }) : null, [currentScope, moneyActive, structure.dimension, structure.measure, structure.view]));
  const lived = useQueryRuntime<"analysis_month_lived">(useMemo(() => currentView === "life" ? ({ resource: queryResourceKeys.analysisMonthLived, scope: currentScope, params: {} }) : null, [currentScope, currentView]));
  const moments = useQueryRuntime<"analysis_month_moments">(useMemo(() => currentView === "moments" ? ({ resource: queryResourceKeys.analysisMonthMoments, scope: currentScope, params: {} }) : null, [currentScope, currentView]));
  const initialModel = dataFrom(initial);
  const activeFilterCount = currentScope.filters.categoryIds.length
    + currentScope.filters.activityIds.length
    + currentScope.filters.merchantIds.length
    + currentScope.filters.placeIds.length
    + currentScope.filters.lifeScopeContext.length
    + currentScope.filters.dayContext.length;

  const applySubject = (personId: string) => {
    const person = persons.find(({ id }) => id === personId);
    const next = normalizeAnalysisScope({ ...currentScope, subject: person ? { kind: "person", personId: person.id } : { kind: "household" } });
    void runtime.run((controller) => controller.updateAnalysisScope(next));
  };

  return (
    <main className={styles.page} data-product-surface="analysis-month" data-scope-month={month}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">Historique · Analyse mensuelle</span>
          <h1>{formatYearMonth(month)}</h1>
        </div>
        <nav className={styles.modeNav} aria-label="Mode Historique">
          <button type="button" onClick={() => runtime.run((controller) => controller.openCalendarMonth(month))}>Calendrier</button>
          <span aria-current="page">Analyse</span>
          <span aria-hidden="true">·</span>
          <span aria-current="page">Mois</span>
          <button type="button" onClick={() => runtime.run((controller) => controller.goToGlobal("last_12_months"))}>Global</button>
        </nav>
        <div className={styles.headerControls}>
          <label>
            <span>Données</span>
            <select value={currentScope.subject.kind === "person" ? currentScope.subject.personId : ""} onChange={(event) => applySubject(event.currentTarget.value)}>
              <option value="">Foyer</option>
              {persons.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
            </select>
          </label>
          <FilterTrigger activeCount={activeFilterCount} action={{ kind: "callback", onAction: () => setFiltersOpen((open) => !open) }} />
          <button type="button" className="button-secondary" onClick={() => runtime.run((controller) => controller.goToOperations({ timeKind: "economic_month", month }))}>Voir les opérations</button>
        </div>
        {filtersOpen ? (
          <form
            key={JSON.stringify(currentScope.filters)}
            className={styles.filterPanel}
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const form = new FormData(event.currentTarget);
                const filters = {
                  categoryIds: csv(form, "categoryIds").map(parseCategoryId),
                  activityIds: csv(form, "activityIds").map(parseActivityId),
                  merchantIds: csv(form, "merchantIds").map(parseMerchantId),
                  placeIds: csv(form, "placeIds").map(parsePlaceId),
                  lifeScopeContext: csv(form, "lifeScopeContext").map(parseLifeScopeContext),
                  dayContext: csv(form, "dayContext").map(parseDayContext),
                };
                setFilterError(null);
                void runtime.run((controller) => controller.updateAnalysisScope(normalizeAnalysisScope({ ...currentScope, filters })));
              } catch (error) {
                setFilterError(error instanceof Error ? error.message : "Filtres invalides.");
              }
            }}
          >
            <label>Catégories (UUID, séparés par des virgules)<input name="categoryIds" defaultValue={currentScope.filters.categoryIds.join(", ")} /></label>
            <label>Activités (IDs, séparés par des virgules)<input name="activityIds" defaultValue={currentScope.filters.activityIds.join(", ")} /></label>
            <label>Marchands (UUID)<input name="merchantIds" defaultValue={currentScope.filters.merchantIds.join(", ")} /></label>
            <label>Lieux (UUID)<input name="placeIds" defaultValue={currentScope.filters.placeIds.join(", ")} /></label>
            <label>Contexte de vie<input name="lifeScopeContext" placeholder="Vie courante, Hors quotidien" defaultValue={currentScope.filters.lifeScopeContext.join(", ")} /></label>
            <label>Contexte de jour<input name="dayContext" placeholder="work_onsite, remote…" defaultValue={currentScope.filters.dayContext.join(", ")} /></label>
            {filterError ? <p role="alert">{filterError}</p> : null}
            <button type="submit" className="button-primary">Appliquer les filtres</button>
          </form>
        ) : null}
      </header>

      <nav className={styles.localNav} aria-label="Sommaire du mois">
        <button type="button" onClick={() => { setCurrentView("summary"); document.getElementById("analysis-summary")?.scrollIntoView(); }}>Résumé</button>
        <button type="button" onClick={() => { setCurrentView("money"); document.getElementById("analysis-evolution")?.scrollIntoView(); }}>Argent</button>
        <button type="button" onClick={() => { setCurrentView("life"); document.getElementById("analysis-lived")?.scrollIntoView(); }}>Vie</button>
        <button type="button" onClick={() => { setCurrentView("moments"); document.getElementById("analysis-moments")?.scrollIntoView(); }}>Moments</button>
      </nav>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "summary" }}>
        <SectionLayout title="1. Résumé du mois" description="Réel, référence habituelle et références disponibles.">
          {initial.status === "idle" || initial.status === "loading" ? <SectionSkeleton /> : initial.status === "error" && initialModel === undefined ? <ErrorState error={initial.error} /> : initialModel ? <><SummaryModule model={initialModel} runtime={runtime} scope={currentScope} />{initial.status === "success" && initial.refreshing ? <RefreshIndicator /> : initial.status === "error" ? <RefreshIndicator failed /> : null}</> : null}
        </SectionLayout>
      </SectionAnchor>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "marked-facts" }}>
        <SectionLayout title="2. Ce qui a marqué le mois">
          {initialModel ? <MarkedFactsModule model={initialModel} runtime={runtime} scope={currentScope} /> : initial.status === "error" ? <ErrorState error={initial.error} /> : <SectionSkeleton />}
        </SectionLayout>
      </SectionAnchor>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "evolution" }}>
        <SectionLayout title="3. Évolution">
          <AnalysisMonthModuleBoundary route={currentRoute} module="evolution" state={evolution}>{(model) => <EvolutionModule model={model} selectedPoint={selectedPoint} onSelectPoint={(period) => { setSelectedPoint(period); setCurrentView("money"); }} runtime={runtime} />}</AnalysisMonthModuleBoundary>
        </SectionLayout>
      </SectionAnchor>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "structure" }}>
        <SectionLayout title="4. Structure de consommation">
          <AnalysisMonthModuleBoundary route={currentRoute} module="structure" state={structureTransport}>{(model) => <StructureModule model={model} selectedBucketId={structure.selectedBucketId} onChange={(next) => setStructure(next)} onSelectBucket={(selectedBucketId) => { setStructure((current) => ({ ...current, selectedBucketId })); setCurrentView("money"); }} runtime={runtime} scope={currentScope} />}</AnalysisMonthModuleBoundary>
        </SectionLayout>
      </SectionAnchor>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "lived" }}>
        <SectionLayout title="5. Comment avons-nous vécu ?">
          <AnalysisMonthModuleBoundary route={currentRoute} module="lived" state={lived}>{(model) => <LivedModule model={model} activeSubview={livedSubview} onChange={(view) => { setLivedSubview(view); setCurrentView("life"); }} runtime={runtime} scope={currentScope} />}</AnalysisMonthModuleBoundary>
        </SectionLayout>
      </SectionAnchor>

      <SectionAnchor anchor={{ moduleId: "analysis-month", itemKey: "moments" }}>
        <SectionLayout title="6. Moments du mois">
          <AnalysisMonthModuleBoundary route={currentRoute} module="moments" state={moments}>{(model) => <MomentsModule model={model} runtime={runtime} scope={currentScope} />}</AnalysisMonthModuleBoundary>
        </SectionLayout>
      </SectionAnchor>
    </main>
  );
}
