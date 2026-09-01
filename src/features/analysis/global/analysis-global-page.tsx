"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseActivityId, parseCategoryId, parseMerchantId, parseMetricId, parsePlaceId, type PersonId } from "@/core/identity";
import { normalizeAnalysisScope, parseDayContext, parseLifeScopeContext, type NormalizedAnalysisScope } from "@/core/scope";
import { addMonths, formatYearMonth, parseGlobalWindow, resolveGlobalWindowMonths } from "@/core/time";
import { useProductRuntime, useProductSurface, useQueryRuntime, useRestorableSubview, useSemanticAnchor } from "@/components/runtime";
import { scopeForRoot, type HistoryRootContext, type NavigationSubviewRef, type SemanticAnchor } from "@/navigation";
import type { AnalysisGlobalInitialReadModel, PersonaTarget } from "@/query-api";
import { queryResourceKeys } from "@/query-api";
import { ErrorState, FilterTrigger, RefreshIndicator, SectionLayout, SectionSkeleton, type UiTransportState } from "@/ui";
import {
  GlobalBaselineModule,
  GlobalEvolutionModule,
  GlobalHabitsModule,
  GlobalOverviewModule,
  GlobalProfilesModule,
  GlobalTypicalModule,
  GlobalUniverseModule,
} from "./global-modules";
import { AnalysisGlobalModuleBoundary } from "./module-boundary";
import styles from "./global.module.css";

type PersonOption = { readonly id: PersonId; readonly label: string };

function dataFrom<T>(state: UiTransportState<T>): T | undefined {
  return state.status === "success" ? state.response.data : state.status === "error" ? state.previousData?.data : undefined;
}

function readinessFrom<T>(state: UiTransportState<T>) {
  const data = dataFrom(state);
  return state.status === "idle" || state.status === "loading" ? "pending" as const : state.status === "error" && data === undefined ? "terminal_without_anchor" as const : "ready" as const;
}

function csv(form: FormData, key: string): readonly string[] {
  const value = String(form.get(key) ?? "").trim();
  return value.length === 0 ? [] : value.split(",").map((item) => item.trim()).filter(Boolean);
}

function SectionAnchor({ anchor, children }: { readonly anchor: SemanticAnchor; readonly children: React.ReactNode }) {
  const ref = useSemanticAnchor(anchor);
  return <div ref={ref} id={`analysis-global-${anchor.itemKey ?? "overview"}`}>{children}</div>;
}

const windowLabels = {
  last_12_months: "12 derniers mois",
  last_6_months: "6 derniers mois",
  last_3_months: "3 derniers mois",
  last_complete_summer: "Dernier été complet",
} as const;

export function AnalysisGlobalPage({
  route,
  scope: serverScope,
  persons,
  initialState,
}: {
  readonly route: HistoryRootContext;
  readonly scope: NormalizedAnalysisScope;
  readonly persons: readonly PersonOption[];
  readonly initialState: UiTransportState<AnalysisGlobalInitialReadModel>;
}) {
  const router = useRouter();
  const runtime = useProductRuntime();
  const runtimeRoot = runtime.snapshot?.history.root;
  const currentRoute: HistoryRootContext = runtimeRoot && "area" in runtimeRoot && runtimeRoot.area === "analysis" && runtimeRoot.context.kind === "analysis_global" ? runtimeRoot : route;
  const currentScope = useMemo(() => {
    const runtimeScope = scopeForRoot(currentRoute);
    return runtimeScope?.time.kind === "global" ? runtimeScope : serverScope;
  }, [currentRoute, serverScope]);
  if (currentScope.time.kind !== "global") throw new TypeError("AnalysisGlobalPage exige un scope Global.");
  const globalTime = currentScope.time;
  const defaultSelectedMonth = resolveGlobalWindowMonths(
    globalTime.observationWindow,
    globalTime.asOf,
  ).at(-1)!;

  const defaultProfileTarget: PersonaTarget = currentScope.subject.kind === "person" ? { kind: "person", personId: currentScope.subject.personId } : { kind: "ensemble" };
  const [currentView, setCurrentView] = useState<Extract<NavigationSubviewRef, { kind: "analysis-global" }>["view"]>("overview");
  const [baselineView, setBaselineView] = useState<"day" | "week" | "month">("month");
  const [evolutionView, setEvolutionView] = useState<"money" | "behavior">("money");
  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);
  const [habitsView, setHabitsView] = useState<"contexts" | "heatmap">("contexts");
  const [profileTarget, setProfileTarget] = useState<PersonaTarget>(defaultProfileTarget);
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ readonly activityId: ReturnType<typeof parseActivityId>; readonly month: typeof selectedMonth } | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  useRestorableSubview(currentRoute, (restored) => {
    if (restored?.kind !== "analysis-global") return;
    setCurrentView(restored.view);
    if (restored.baselineView) setBaselineView(restored.baselineView);
    if (restored.evolutionView) setEvolutionView(restored.evolutionView);
    setSelectedMonth(restored.selectedMonth ?? defaultSelectedMonth);
    if (restored.habitsView) setHabitsView(restored.habitsView);
    if (restored.profileTarget) setProfileTarget(restored.profileTarget);
    setSelectedHeatmapCell(restored.selectedHeatmapCell);
  });

  const subview: NavigationSubviewRef = useMemo(() => ({
    kind: "analysis-global",
    view: currentView,
    baselineView,
    evolutionView,
    selectedMonth,
    habitsView,
    profileTarget,
    ...(selectedHeatmapCell === undefined ? {} : { selectedHeatmapCell }),
  }), [baselineView, currentView, evolutionView, habitsView, profileTarget, selectedHeatmapCell, selectedMonth]);

  const initial = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalInitial, scope: currentScope, params: {} }), [currentScope]), initialState);
  useProductSurface({ route: currentRoute, scope: currentScope, subview, readiness: readinessFrom(initial) });
  const baseline = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalBaseline, scope: currentScope, params: {} }), [currentScope]));
  const typical = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalTypical, scope: currentScope, params: {} }), [currentScope]));
  const evolution = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalEvolution, scope: currentScope, params: { view: evolutionView } }), [currentScope, evolutionView]));
  const habits = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalHabits, scope: currentScope, params: { view: habitsView } }), [currentScope, habitsView]));
  const profiles = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalProfiles, scope: currentScope, params: { target: profileTarget } }), [currentScope, profileTarget]));
  const universe = useQueryRuntime(useMemo(() => ({ resource: queryResourceKeys.analysisGlobalUniverse, scope: currentScope, params: {} }), [currentScope]));
  const initialModel = dataFrom(initial);
  const activeFilterCount = currentScope.filters.categoryIds.length + currentScope.filters.activityIds.length +
    currentScope.filters.merchantIds.length + currentScope.filters.placeIds.length +
    currentScope.filters.lifeScopeContext.length + currentScope.filters.dayContext.length;

  const scrollTo = (view: typeof currentView, key: string) => {
    setCurrentView(view);
    document.getElementById(`analysis-global-${key}`)?.scrollIntoView();
  };
  const applySubject = (value: string) => {
    const person = persons.find(({ id }) => id === value);
    const next = normalizeAnalysisScope({ ...currentScope, subject: person ? { kind: "person", personId: person.id } : { kind: "household" } });
    setProfileTarget(person ? { kind: "person", personId: person.id } : { kind: "ensemble" });
    void runtime.run((controller) => controller.updateAnalysisScope(next));
  };

  return (
    <main className={styles.page} data-product-surface="analysis-global" data-global-window={currentScope.time.observationWindow}>
      <header className={styles.header}>
        <div><span className="eyebrow">Historique · Analyse globale</span><h1>Notre vie dans le temps</h1><p>{windowLabels[currentScope.time.observationWindow]} · jusqu’à {formatYearMonth(addMonths(currentScope.time.asOf, -1))}</p></div>
        <nav className={styles.modeNav} aria-label="Mode Historique">
          <button type="button" onClick={() => router.push(`/historique/${selectedMonth}`)}>Calendrier</button>
          <span aria-current="page">Analyse</span><span aria-hidden="true">·</span>
          <button type="button" onClick={() => runtime.run((controller) => controller.goToAnalysisMonthFromGlobal(selectedMonth))}>Mois</button>
          <span aria-current="page">Global</span>
        </nav>
        <div className={styles.controls}>
          <label><span>Fenêtre</span><select value={currentScope.time.observationWindow} onChange={(event) => runtime.run((controller) => controller.goToGlobal(parseGlobalWindow(event.currentTarget.value)))}>{Object.entries(windowLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Perspective</span><select value={currentScope.subject.kind === "person" ? currentScope.subject.personId : ""} onChange={(event) => applySubject(event.currentTarget.value)}><option value="">Foyer</option>{persons.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
          <FilterTrigger activeCount={activeFilterCount} action={{ kind: "callback", onAction: () => setFiltersOpen((open) => !open) }} />
          <button type="button" className="button-secondary" onClick={() => runtime.run((controller) => controller.goToOperations({ timeKind: "global_window", globalWindow: globalTime.observationWindow, asOf: globalTime.asOf }))}>Voir les opérations</button>
        </div>
        {filtersOpen ? <form key={JSON.stringify(currentScope.filters)} className={styles.filterPanel} onSubmit={(event) => { event.preventDefault(); try { const form = new FormData(event.currentTarget); const filters = { categoryIds: csv(form, "categoryIds").map(parseCategoryId), activityIds: csv(form, "activityIds").map(parseActivityId), merchantIds: csv(form, "merchantIds").map(parseMerchantId), placeIds: csv(form, "placeIds").map(parsePlaceId), lifeScopeContext: csv(form, "lifeScopeContext").map(parseLifeScopeContext), dayContext: csv(form, "dayContext").map(parseDayContext) }; setFilterError(null); void runtime.run((controller) => controller.updateAnalysisScope(normalizeAnalysisScope({ ...currentScope, filters }))); } catch (error) { setFilterError(error instanceof Error ? error.message : "Filtres invalides."); } }}>
          <label>Catégories<input name="categoryIds" defaultValue={currentScope.filters.categoryIds.join(", ")} /></label><label>Activités<input name="activityIds" defaultValue={currentScope.filters.activityIds.join(", ")} /></label><label>Marchands<input name="merchantIds" defaultValue={currentScope.filters.merchantIds.join(", ")} /></label><label>Lieux<input name="placeIds" defaultValue={currentScope.filters.placeIds.join(", ")} /></label><label>Contexte de vie<input name="lifeScopeContext" defaultValue={currentScope.filters.lifeScopeContext.join(", ")} /></label><label>Contexte de jour<input name="dayContext" defaultValue={currentScope.filters.dayContext.join(", ")} /></label>{filterError ? <p role="alert">{filterError}</p> : null}<button type="submit" className="button-primary">Appliquer</button>
        </form> : null}
      </header>

      <nav className={styles.localNav} aria-label="Sommaire de l’analyse globale">
        <button type="button" onClick={() => scrollTo("overview", "overview")}>Chiffres</button><button type="button" onClick={() => scrollTo("baseline", "baseline")}>Socle</button><button type="button" onClick={() => scrollTo("typical", "typical")}>Vie habituelle</button><button type="button" onClick={() => scrollTo("evolution", "evolution")}>Évolution</button><button type="button" onClick={() => scrollTo("habits", "habits")}>Habitudes</button><button type="button" onClick={() => scrollTo("profiles", "profiles")}>Profils</button><button type="button" onClick={() => scrollTo("universe", "universe")}>Univers</button>
      </nav>

      <div className={styles.act}><span>Acte 1</span><h2>Références</h2></div>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "overview" }}><SectionLayout title="1. Notre vie en chiffres">{initial.status === "idle" || initial.status === "loading" ? <SectionSkeleton /> : initial.status === "error" && initialModel === undefined ? <ErrorState error={initial.error} /> : initialModel ? <><GlobalOverviewModule model={initialModel} />{initial.status === "success" && initial.refreshing ? <RefreshIndicator /> : null}</> : null}</SectionLayout></SectionAnchor>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "baseline" }}><SectionLayout title="2. Notre socle de vie" description="Des références observées, jamais des objectifs."><AnalysisGlobalModuleBoundary route={currentRoute} module="baseline" state={baseline}>{(model) => <GlobalBaselineModule model={model} view={baselineView} onView={setBaselineView} />}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "typical" }}><SectionLayout title="3. Notre vie habituelle"><AnalysisGlobalModuleBoundary route={currentRoute} module="typical" state={typical}>{(model) => <GlobalTypicalModule model={model} onTarget={(activityId) => runtime.run((controller) => controller.openExploration({ kind: "analysis", target: { kind: "activity", activityId: parseActivityId(activityId) }, scope: currentScope }))} />}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>

      <div className={styles.act}><span>Acte 2</span><h2>Comprendre</h2></div>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "evolution" }}><SectionLayout title="4. Comment notre vie évolue"><div className={styles.tabs} role="tablist" aria-label="Vue de l’évolution"><button type="button" role="tab" aria-selected={evolutionView === "money"} onClick={() => setEvolutionView("money")}>Argent</button><button type="button" role="tab" aria-selected={evolutionView === "behavior"} onClick={() => setEvolutionView("behavior")}>Comportement</button></div><AnalysisGlobalModuleBoundary route={currentRoute} module="evolution" state={evolution}>{(model) => <GlobalEvolutionModule model={model} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} onAnalyze={(month) => router.push(`/historique/${month}`)} onMethodology={(metricId) => runtime.run((controller) => controller.openExploration({ kind: "methodology", metricId: parseMetricId(metricId) }))} />}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "habits" }}><SectionLayout title="5. Nos habitudes"><AnalysisGlobalModuleBoundary route={currentRoute} module="habits" state={habits}>{(model) => <><div className={styles.tabs} role="tablist" aria-label="Vue des habitudes">{model.availableViews.map((view) => <button key={view} type="button" role="tab" aria-selected={habitsView === view} onClick={() => setHabitsView(view)}>{view === "contexts" ? "Contextes" : "Heatmap"}</button>)}</div><GlobalHabitsModule model={model} selectedCell={selectedHeatmapCell ? `${selectedHeatmapCell.activityId}:${selectedHeatmapCell.month}` : undefined} onSelectCell={(activityId, month) => setSelectedHeatmapCell({ activityId: parseActivityId(activityId), month })} /></>}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>

      <div className={styles.act}><span>Acte 3</span><h2>Nous</h2></div>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "profiles" }}><SectionLayout title="6. Nos profils"><label className={styles.profileSelect}><span>Profil local</span><select value={profileTarget.kind === "person" ? profileTarget.personId : "ensemble"} onChange={(event) => { const person = persons.find(({ id }) => id === event.currentTarget.value); setProfileTarget(person ? { kind: "person", personId: person.id } : { kind: "ensemble" }); }}><option value="ensemble">Ensemble</option>{persons.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label><AnalysisGlobalModuleBoundary route={currentRoute} module="profiles" state={profiles}>{(model) => <GlobalProfilesModule model={model} onExplore={() => runtime.run((controller) => controller.openExploration({ kind: "persona", id: model.target.kind === "person" ? model.target.personId : "ensemble" }))} />}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>
      <SectionAnchor anchor={{ moduleId: "analysis-global", itemKey: "universe" }}><SectionLayout title="7. Notre univers"><AnalysisGlobalModuleBoundary route={currentRoute} module="universe" state={universe}>{(model) => <GlobalUniverseModule model={model} onOpen={(destination) => runtime.run((controller) => controller.openExploration(destination))} onSeeAll={(destination) => runtime.run((controller) => controller.openExploration(destination))} />}</AnalysisGlobalModuleBoundary></SectionLayout></SectionAnchor>
    </main>
  );
}
