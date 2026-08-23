"use client";

import { parseMetricId, type PersonId } from "@/core/identity";
import { normalizeAnalysisScope } from "@/core/scope";
import type {
  AnalysisGlobalBreakdownReadModel,
  AnalysisGlobalContextsReadModel,
  AnalysisGlobalEvolutionReadModel,
  AnalysisGlobalInitialReadModel,
  EntityPersonaReadModel,
  GalleryPlacesReadModel,
} from "@/query-api";
import type { GlobalWindow, YearMonth } from "@/core/time";
import type { CountMetricEnvelope, MoneyMetricEnvelope } from "@/query-api";
import {
  ErrorState,
  MetricDisplay,
  NoDataState,
  NoReferenceState,
  SectionLayout,
  SectionSkeleton,
  Surface,
  type UiTransportState,
} from "@/ui";
import { useProductRuntime, useProductSurface } from "@/components/runtime";
import styles from "./analysis.module.css";

type PersonOption = { readonly id: string; readonly label: string };

function responseData<T>(state: UiTransportState<T>): T | undefined {
  return state.status === "success"
    ? state.response.data
    : state.status === "error"
      ? state.previousData?.data
      : undefined;
}

function AnyMetricDisplay({ metric }: { readonly metric: MoneyMetricEnvelope | CountMetricEnvelope }) {
  return metric.unit.startsWith("EUR")
    ? <MetricDisplay metric={metric as MoneyMetricEnvelope} />
    : <MetricDisplay metric={metric as CountMetricEnvelope} />;
}

function Boundary<T>({
  state,
  children,
}: {
  readonly state: UiTransportState<T>;
  readonly children: (data: T) => React.ReactNode;
}) {
  if (state.status === "idle" || state.status === "loading") return <SectionSkeleton />;
  const data = responseData(state);
  if (state.status === "error" && data === undefined) return <ErrorState error={state.error} />;
  return data === undefined ? null : children(data);
}

function SubjectSelector({
  action,
  selected,
  persons,
  hidden,
}: {
  readonly action: string;
  readonly selected: string;
  readonly persons: readonly PersonOption[];
  readonly hidden?: Readonly<Record<string, string>>;
}) {
  return (
    <form className={styles.selector} method="get" action={action}>
      {Object.entries(hidden ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <label>
        <span>Perspective</span>
        <select className="field" name="personId" defaultValue={selected}>
          <option value="">Foyer</option>
          {persons.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
        </select>
      </label>
      <button type="submit" className="button-secondary">Afficher</button>
    </form>
  );
}

const windowLabels: Readonly<Record<GlobalWindow, string>> = {
  last_12_months: "12 derniers mois",
  last_6_months: "Semestre",
  last_3_months: "Trimestre",
  last_complete_summer: "Été",
};

export function AnalysisGlobalPage({
  window,
  asOf,
  personId,
  persons,
  initial,
  evolution,
  contexts,
  habits,
  profiles,
  universe,
}: {
  readonly window: GlobalWindow;
  readonly asOf: YearMonth;
  readonly personId?: PersonId;
  readonly persons: readonly PersonOption[];
  readonly initial: UiTransportState<AnalysisGlobalInitialReadModel>;
  readonly evolution: UiTransportState<AnalysisGlobalEvolutionReadModel>;
  readonly contexts: UiTransportState<AnalysisGlobalContextsReadModel>;
  readonly habits: UiTransportState<AnalysisGlobalBreakdownReadModel>;
  readonly profiles: UiTransportState<EntityPersonaReadModel>;
  readonly universe: UiTransportState<GalleryPlacesReadModel>;
}) {
  const runtime = useProductRuntime();
  const runtimeAnalysisRoot = runtime.snapshot?.history.root;
  const navigationContext = runtimeAnalysisRoot && "area" in runtimeAnalysisRoot && runtimeAnalysisRoot.area === "analysis" && runtimeAnalysisRoot.context.kind === "analysis_global" && runtimeAnalysisRoot.context.observationWindow === window && runtimeAnalysisRoot.context.asOf === asOf
    ? runtimeAnalysisRoot.context
    : { kind: "analysis_global" as const, observationWindow: window, asOf, ...(personId ? { personId } : {}) };
  const scope = normalizeAnalysisScope({
    subject: navigationContext.personId ? { kind: "person", personId: navigationContext.personId } : { kind: "household" },
    time: { kind: "global", observationWindow: window, asOf },
    filters: navigationContext.filters,
  });
  useProductSurface({
    route: { area: "analysis", context: navigationContext },
    scope,
    readiness: initial.status === "idle" || initial.status === "loading" ? "pending" : initial.status === "error" && initial.previousData === undefined ? "terminal_without_anchor" : "ready",
  });
  return (
    <div className={styles.page} data-product-surface="analysis-global">
      <header className={styles.heroHeader}>
        <span className="eyebrow">Historique</span>
        <h1>Analyse globale</h1>
        <nav className={styles.modeNav} aria-label="Mode Historique">
          <button type="button" onClick={() => runtime.run((controller) => controller.goToCalendar())}>Calendrier</button>
          <span className={styles.active}>Analyse</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => runtime.run((controller) => controller.goToMonth(asOf))}>Mois</button>
          <span className={styles.active}>Global</span>
        </nav>
        <div className={styles.globalControls}>
          <form className={styles.selector} method="get" action="/historique/analyse/global">
            <input type="hidden" name="asOf" value={asOf} />
            {personId ? <input type="hidden" name="personId" value={personId} /> : null}
            <label><span>Fenêtre</span><select className="field" name="window" defaultValue={window}>{Object.entries(windowLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit" className="button-secondary">Afficher</button>
          </form>
          <SubjectSelector action="/historique/analyse/global" selected={personId ?? ""} persons={persons} hidden={{ window, asOf }} />
          <button
            type="button"
            className="button-secondary"
            onClick={() => runtime.run((controller) => controller.goToOperations({
              timeKind: "global_window",
              globalWindow: window,
              asOf,
              ...(personId ? { personId } : {}),
            }))}
          >
            Voir les opérations de la fenêtre
          </button>
        </div>
      </header>

      <div className={styles.act}><span>Acte 1</span><h2>Références</h2></div>
      <SectionLayout title="1. Notre vie en chiffres">
        <Boundary state={initial}>{(model) => <Surface variant="raised" className={styles.primaryMetric}><span className="eyebrow">Mois documentés</span><MetricDisplay metric={model.observedPeriodCount} variant="hero" /></Surface>}</Boundary>
      </SectionLayout>
      <SectionLayout title="2. Notre socle de vie">
        <NoReferenceState value="—" message="Les métriques de socle Jour, Semaine et Mois ne sont pas encore publiées par le read model." />
      </SectionLayout>
      <SectionLayout title="3. Notre vie habituelle">
        <Boundary state={initial}>{(model) => model.monthlyTypical
          ? <MetricDisplay metric={model.monthlyTypical.envelope} variant="hero" />
          : <NoReferenceState value="—" />}
        </Boundary>
      </SectionLayout>

      <div className={styles.act}><span>Acte 2</span><h2>Comprendre</h2></div>
      <SectionLayout title="4. Comment notre vie évolue">
        <Boundary state={evolution}>{(model) => model.points.length === 0
          ? <NoDataState />
          : <><ol className={styles.timeline}>{model.points.map((point) => <li key={point.period}><span>{point.period}</span><AnyMetricDisplay metric={point.metric.envelope} /></li>)}</ol><button className="button-ghost" type="button" onClick={() => runtime.run((controller) => controller.openExploration({ kind: "methodology", metricId: parseMetricId(model.metricId) }))}>Voir la méthode</button></>}
        </Boundary>
      </SectionLayout>
      <SectionLayout title="5. Nos habitudes">
        <Boundary state={habits}>{(model) => model.breakdown.rows.length === 0
          ? <NoDataState description="Aucune habitude économique n’est publiée pour cette fenêtre." />
          : <div className={styles.cards}>{model.breakdown.rows.map((row) => <Surface key={row.label} variant="outlined"><strong>{row.label}</strong><AnyMetricDisplay metric={row.metric.envelope} /></Surface>)}</div>}
        </Boundary>
        <Boundary state={contexts}>{(model) => model.contexts.sections.length === 0 ? null : <p>{model.contexts.sections.length} dimensions contextuelles publiées.</p>}</Boundary>
      </SectionLayout>

      <div className={styles.act}><span>Acte 3</span><h2>Nous</h2></div>
      <SectionLayout title="6. Nos profils">
        <Boundary state={profiles}>{() => <NoDataState description="Le profil est disponible dans Exploration." />}</Boundary>
      </SectionLayout>
      <SectionLayout title="7. Notre univers">
        <Boundary state={universe}>{(model) => model.page.items.length === 0 ? <NoDataState /> : <p>{model.page.items.length} lieux publiés.</p>}</Boundary>
      </SectionLayout>
    </div>
  );
}
