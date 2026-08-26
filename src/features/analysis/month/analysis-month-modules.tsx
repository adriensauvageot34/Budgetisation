"use client";

import type { ProductRuntimeValue } from "./runtime-types";
import type { NormalizedAnalysisScope } from "@/core/scope";
import { parseMetricId } from "@/core/identity";
import { formatYearMonth, type YearMonth } from "@/core/time";
import type { SemanticAnchor } from "@/navigation";
import { useSemanticAnchor } from "@/components/runtime";
import type {
  AnalysisDestination,
  AnalysisLivedSubview,
  AnalysisMonthEvolutionReadModel,
  AnalysisMonthInitialReadModel,
  AnalysisMonthLivedReadModel,
  AnalysisMonthMomentsReadModel,
  AnalysisMonthStructureReadModel,
  AnalysisStructureDimension,
  AnalysisStructureMeasure,
  AnalysisStructureView,
  CountMetricEnvelope,
  MoneyMetricEnvelope,
  ScopedMetricReadModel,
} from "@/query-api";
import {
  CardSurface,
  ContentRail,
  FrequencyCostScatter,
  MediaSurface,
  MetricDisplay,
  MultiSeriesMonetaryEvolution,
  NoReferenceState,
  RankingList,
  RankingRow,
  SecondaryTabs,
  Surface,
  resolveMediaFallback,
} from "@/ui";
import styles from "./month.module.css";

export function AnyPublishedMetric({ metric }: { readonly metric: ScopedMetricReadModel }) {
  return metric.envelope.unit.startsWith("EUR")
    ? <MetricDisplay metric={metric.envelope as MoneyMetricEnvelope} />
    : <MetricDisplay metric={metric.envelope as CountMetricEnvelope} />;
}

function openDestination(
  runtime: ProductRuntimeValue,
  destination: AnalysisDestination,
  scope: NormalizedAnalysisScope,
  anchor?: SemanticAnchor,
) {
  return runtime.run((controller) => {
    switch (destination.kind) {
      case "target": return controller.openExploration({ kind: "analysis", target: destination.target, scope }, anchor);
      case "moment": return controller.openExploration({ kind: "moment", id: destination.momentId }, anchor);
      case "merchant": return controller.openExploration({ kind: "merchant", id: destination.merchantId }, anchor);
      case "place": return controller.openExploration({ kind: "place", id: destination.placeId }, anchor);
      case "operation": return controller.openExploration({ kind: "operation", id: destination.operationId }, anchor);
      case "methodology": return controller.openExploration({ kind: "methodology", metricId: destination.metricId }, anchor);
    }
  });
}

function Anchored({ anchor, children, className }: { readonly anchor: SemanticAnchor; readonly children: React.ReactNode; readonly className?: string }) {
  const ref = useSemanticAnchor(anchor);
  return <div ref={ref} className={className} data-analysis-anchor={anchor.itemKey ?? anchor.item?.kind}>{children}</div>;
}

export function SummaryModule({ model, runtime, scope }: { readonly model: AnalysisMonthInitialReadModel; readonly runtime: ProductRuntimeValue; readonly scope: NormalizedAnalysisScope }) {
  const delta = model.actualVsTypical?.absoluteDelta;
  const minimalDelta = model.typicalVsMinimal?.absoluteDelta;
  return (
    <div className={styles.summaryGrid}>
      <Surface variant="raised" className={styles.actualMetric}>
        <span className="eyebrow">Réel</span>
        <MetricDisplay metric={model.actual.envelope} variant="hero" />
        <button type="button" className="button-ghost" onClick={() => openDestination(runtime, { kind: "methodology", metricId: model.actual.metricId }, scope, { moduleId: "analysis-month", itemKey: "summary" })}>Voir la méthode</button>
      </Surface>
      <Surface variant="subtle" className={styles.referenceMetric}>
        <span className="eyebrow">Typique</span>
        {model.typical ? <MetricDisplay metric={model.typical.envelope} /> : <NoReferenceState value="—" message="Aucune référence typique publiable pour ce scope." />}
      </Surface>
      <Surface variant="subtle" className={styles.referenceMetric}>
        <span className="eyebrow">Minimal</span>
        {model.minimal ? <MetricDisplay metric={model.minimal.envelope} /> : <NoReferenceState value="—" message="La métrique minimale officielle n’est pas active." />}
      </Surface>
      {delta?.publishable ? (
        <div className={styles.comparison}>
          <span>Écart au fonctionnement habituel</span>
          <MetricDisplay metric={delta} variant="compact" />
        </div>
      ) : null}
      {minimalDelta?.publishable ? (
        <div className={styles.comparison}>
          <span>Écart de fonctionnement habituel au socle minimal</span>
          <MetricDisplay metric={minimalDelta} variant="compact" />
        </div>
      ) : null}
      {model.manualSummary?.text.trim() ? <p className={styles.manualSummary}>{model.manualSummary.text.trim()}</p> : null}
    </div>
  );
}

export function MarkedFactsModule({ model, runtime, scope }: { readonly model: AnalysisMonthInitialReadModel; readonly runtime: ProductRuntimeValue; readonly scope: NormalizedAnalysisScope }) {
  if (model.markedFacts.length === 0) {
    const unavailable = model.markedFactsSelection.kind === "unavailable";
    const insufficient = unavailable && model.markedFactsSelection.reason === "insufficient_data";
    return (
      <Surface variant="subtle" className={styles.inRhythm}>
        <strong>{insufficient ? "Mois non qualifiable" : unavailable ? "Faits marquants indisponibles" : "Un mois dans le rythme"}</strong>
        <span>{insufficient ? "Les données disponibles ne permettent pas de comparer ce mois à une référence." : unavailable ? "Aucun fait n’est affirmé sans doctrine de matérialité versionnée." : "Aucun fait matériel retenu pour ce scope."}</span>
      </Surface>
    );
  }
  return (
    <div className={styles.factGrid}>
      {model.markedFacts.map((fact) => (
        <CardSurface
          key={fact.id}
          variant="outlined"
          action={fact.destination ? { kind: "callback", onAction: () => openDestination(runtime, fact.destination!, scope) } : undefined}
          ariaLabel={fact.title}
        >
          <span className="eyebrow">{fact.kind}</span>
          <strong>{fact.title}</strong>
          {fact.description ? <p>{fact.description}</p> : null}
          <AnyPublishedMetric metric={fact.primaryMetric} />
        </CardSurface>
      ))}
    </div>
  );
}

export function EvolutionModule({
  model,
  selectedPoint,
  onSelectPoint,
  runtime,
}: {
  readonly model: AnalysisMonthEvolutionReadModel;
  readonly selectedPoint?: YearMonth;
  readonly onSelectPoint: (period: YearMonth) => void;
  readonly runtime: ProductRuntimeValue;
}) {
  if (model.series.length === 0 || model.series[0]?.points.length === 0) {
    return <Surface variant="subtle">Aucune période mensuelle exploitable.</Surface>;
  }
  const selected = selectedPoint ? model.series[0]?.points.find(({ period }) => period === selectedPoint) : undefined;
  return (
    <div className={styles.evolutionLayout}>
      <MultiSeriesMonetaryEvolution
        unit="EUR"
        selectedPeriod={selectedPoint}
        series={model.series.map((series) => ({
          id: series.id,
          label: series.label,
          points: series.points.map((point) => ({ period: point.period, label: formatYearMonth(point.period), metric: point.metric.envelope })),
        }))}
        onSelectPeriod={(period) => onSelectPoint(period as YearMonth)}
        frame={{
          title: "Évolution mensuelle",
          description: "Total économique net, Vie courante et Hors quotidien — axe monétaire unique, sans interpolation.",
          state: { kind: "ready" },
          summary: "Les ruptures correspondent à des valeurs inconnues, jamais à des zéros.",
          methodologyAction: { kind: "navigation", intent: { kind: "methodology", metricId: parseMetricId(model.series[0]!.metricId) }, onNavigate: (intent) => { void runtime.run((controller) => controller.openExploration(intent, { moduleId: "analysis-month", itemKey: "evolution" })); } },
        }}
      />
      <ol className={styles.accessiblePoints} aria-label="Périodes de l’évolution">
        {model.series[0]!.points.map((point) => (
          <li key={point.period}>
            <button type="button" aria-pressed={selectedPoint === point.period} onClick={() => onSelectPoint(point.period)}>
              <span>{formatYearMonth(point.period)}</span>
              <MetricDisplay metric={point.metric.envelope} variant="compact" />
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
        <Surface variant="outlined" className={styles.selectedPoint}>
          <strong>{formatYearMonth(selected.period)}</strong>
          <MetricDisplay metric={selected.metric.envelope} />
          <button type="button" className="button-secondary" onClick={() => runtime.run((controller) => controller.goToMonth(selected.period))}>Analyser {formatYearMonth(selected.period)}</button>
        </Surface>
      ) : null}
    </div>
  );
}

const viewLabels: Record<AnalysisStructureView, string> = { destination: "Destination", nature: "Nature", life_context: "Contexte de vie" };
const dimensionLabels: Record<AnalysisStructureDimension, string> = { family: "Familles", category: "Catégories", activity: "Activités", merchant: "Marchands", place: "Lieux", fixed_variable: "Fixe / Variable", life_context: "Contexte de vie", necessity: "Nécessité" };
const measureLabels: Record<AnalysisStructureMeasure, string> = { amount: "Montant", share: "Part", occurrences: "Occurrences", cost_per_occurrence: "Coût par occurrence" };

function structureIdentity(row: AnalysisMonthStructureReadModel["rows"][number]): string {
  switch (row.bucket.kind) {
    case "family": return row.bucket.familyId;
    case "category": return row.bucket.categoryId;
    case "activity": return row.bucket.activityId;
    case "merchant": return row.bucket.merchantId;
    case "place": return row.bucket.placeId;
    case "canonical": return row.bucket.key;
    case "undetermined": return "undetermined";
  }
}

function structureAnchor(row: AnalysisMonthStructureReadModel["rows"][number]): SemanticAnchor {
  const identity = structureIdentity(row);
  return row.bucket.kind === "category"
    ? { moduleId: "analysis-month", item: { kind: "category", id: row.bucket.categoryId } }
    : { moduleId: "analysis-month", itemKey: `structure:${row.bucket.kind}:${identity}` };
}

function StructureRankingRow({
  row,
  identity,
  selected,
  onSelect,
}: {
  readonly row: AnalysisMonthStructureReadModel["rows"][number];
  readonly identity: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const presentation = {
    identity,
    label: row.label,
    rankLabel: String(row.rank),
    action: { kind: "callback" as const, onAction: onSelect },
    ...(row.barPercent === undefined ? {} : {
      bar: {
        widthPercent: row.barPercent,
        accessibleText: `${row.label}, barre ${row.barPercent} % du maximum affiché`,
      },
    }),
    ...(selected ? { badge: <span>Sélectionné</span> } : {}),
  };
  return row.metric.envelope.unit.startsWith("EUR")
    ? <RankingRow {...presentation} metric={row.metric.envelope as MoneyMetricEnvelope} />
    : <RankingRow {...presentation} metric={row.metric.envelope as CountMetricEnvelope} />;
}

export function StructureModule({ model, selectedBucketId, onChange, onSelectBucket, runtime, scope }: {
  readonly model: AnalysisMonthStructureReadModel;
  readonly selectedBucketId?: string;
  readonly onChange: (next: { readonly view: AnalysisStructureView; readonly dimension: AnalysisStructureDimension; readonly measure: AnalysisStructureMeasure }) => void;
  readonly onSelectBucket: (id: string) => void;
  readonly runtime: ProductRuntimeValue;
  readonly scope: NormalizedAnalysisScope;
}) {
  const selected = selectedBucketId ? model.rows.find((row) => structureIdentity(row) === selectedBucketId) : undefined;
  return (
    <div className={styles.structureLayout}>
      <div className={styles.structureControls}>
        <label>Vue<select value={model.activeView} onChange={(event) => { const view = event.currentTarget.value as AnalysisStructureView; const combo = model.supportedCombinations.find((item) => item.view === view)!; onChange({ view, dimension: combo.dimension, measure: combo.measures[0]! }); }}>{model.availableViews.map((view) => <option key={view} value={view}>{viewLabels[view]}</option>)}</select></label>
        <label>Dimension<select value={model.activeDimension} onChange={(event) => { const dimension = event.currentTarget.value as AnalysisStructureDimension; const combo = model.supportedCombinations.find((item) => item.view === model.activeView && item.dimension === dimension)!; onChange({ view: model.activeView, dimension, measure: combo.measures[0]! }); }}>{model.availableDimensions.map((dimension) => <option key={dimension} value={dimension}>{dimensionLabels[dimension]}</option>)}</select></label>
        <label>Mesure<select value={model.activeMeasure} onChange={(event) => onChange({ view: model.activeView, dimension: model.activeDimension, measure: event.currentTarget.value as AnalysisStructureMeasure })}>{model.availableMeasures.map((measure) => <option key={measure} value={measure}>{measureLabels[measure]}</option>)}</select></label>
      </div>
      {model.rows.length === 0 ? <Surface variant="subtle">Partition valide vide pour ce scope.</Surface> : (
        <RankingList label={`${dimensionLabels[model.activeDimension]} — ${measureLabels[model.activeMeasure]}`}>
          {model.rows.map((row) => {
            const id = structureIdentity(row);
            const anchor = structureAnchor(row);
            return (
              <Anchored key={id} anchor={anchor}>
                <StructureRankingRow row={row} identity={id} selected={selectedBucketId === id} onSelect={() => onSelectBucket(id)} />
              </Anchored>
            );
          })}
        </RankingList>
      )}
      {selected?.destination ? (
        <button type="button" className="button-secondary" onClick={() => openDestination(runtime, selected.destination!, scope, structureAnchor(selected))}>
          {selected.destination.kind === "target" ? "Analyser cette cible" : "Explorer cette cible"}
        </button>
      ) : null}
      <p className={styles.reconciliation}>Réconciliation : {model.reconciliation === "partial" ? "partielle — aucune catégorie Autres inventée" : model.reconciliation}</p>
      {model.unavailableDimensions.length > 0 ? <p className={styles.localCapability}>Familles et Nécessité restent indisponibles : contrat canonique manquant, aucune taxonomie ou correspondance inventée.</p> : null}
    </div>
  );
}

const livedLabels: Record<AnalysisLivedSubview, string> = { summary: "Synthèse", rhythm: "Rythme", contexts: "Contextes", frequency_cost: "Fréquence × coût" };

export function LivedModule({ model, activeSubview, onChange, runtime, scope }: {
  readonly model: AnalysisMonthLivedReadModel;
  readonly activeSubview: AnalysisLivedSubview;
  readonly onChange: (view: AnalysisLivedSubview) => void;
  readonly runtime: ProductRuntimeValue;
  readonly scope: NormalizedAnalysisScope;
}) {
  const resolvedSubview = model.availableSubviews.includes(activeSubview) ? activeSubview : model.availableSubviews[0] ?? "summary";
  return (
    <div className={styles.livedLayout}>
      <SecondaryTabs label="Sous-vues de la vie du mois" value={resolvedSubview} tabs={model.availableSubviews.map((value) => ({ value, label: livedLabels[value] }))} onChange={onChange} />
      {resolvedSubview === "frequency_cost" ? (
        model.frequencyCost.kind === "available" ? (
          <FrequencyCostScatter
            frame={{
              title: "Fréquence × coût causal médian",
              description: "X = occurrences canoniques ; Y = coût économique causal net médian par occurrence.",
              state: { kind: "ready" },
              summary: "Les activités sans coût causal suffisamment supporté restent listées avec une valeur inconnue.",
              methodologyAction: { kind: "navigation", intent: { kind: "methodology", metricId: parseMetricId("activity_causal_median_cost_per_occurrence") }, onNavigate: (intent) => { void runtime.run((controller) => controller.openExploration(intent, { moduleId: "analysis-month", itemKey: "frequency-cost" })); } },
            }}
            points={model.frequencyCost.points.map((point) => ({
              identity: point.activityId,
              label: point.label,
              occurrences: point.occurrences.envelope as import("@/core/metrics").MetricEnvelope<number, "count" | "count/month">,
              medianCausalCostPerOccurrence: point.medianCausalCostPerOccurrence.envelope as import("@/core/metrics").MetricEnvelope<import("@/core/money").Money, "EUR/occurrence">,
              totalCausalCost: point.totalCausalCost.envelope as import("@/core/metrics").MetricEnvelope<import("@/core/money").Money, "EUR">,
              navigationIntent: { kind: "analysis", target: { kind: "activity", activityId: point.activityId }, scope },
            }))}
            onNavigate={(intent) => { void runtime.run((controller) => controller.openExploration(intent, { moduleId: "analysis-month", itemKey: "frequency-cost" })); }}
          />
        ) : <Surface variant="subtle">Coût causal indisponible pour ce scope.</Surface>
      ) : resolvedSubview === "contexts" ? (
        model.contexts.sections.length === 0 ? <Surface variant="subtle">Aucun contexte analytique publiable.</Surface> : (
          <div className={styles.contextGrid}>{model.contexts.sections.map((section) => section.kind === "available" ? (
            <Surface key={section.capabilityId} variant="outlined">
              <strong>{section.capabilityId}</strong>
              <ul>{section.rows.map((row) => <li key={row.key}><span>{row.label}</span><AnyPublishedMetric metric={row.metric} /></li>)}</ul>
              <small>Contextes superposables : non additifs.</small>
            </Surface>
          ) : <Surface key={section.capabilityId} variant="subtle">{section.capabilityId} — {section.reason}</Surface>)}</div>
        )
      ) : (
        model.activities.length === 0 ? <Surface variant="subtle">Aucune activité canonique dans ce scope.</Surface> : (
          <div className={styles.activityGrid}>{model.activities.map((activity) => {
            const anchor: SemanticAnchor = { moduleId: "analysis-month", item: { kind: "activity", id: activity.activityId } };
            return (
              <Anchored key={activity.activityId} anchor={anchor}>
                <CardSurface variant="outlined" action={{ kind: "callback", onAction: () => openDestination(runtime, activity.destination, scope, anchor) }} ariaLabel={`Analyser ${activity.label}`}>
                  <strong>{activity.label}</strong>
                  <MetricDisplay metric={activity.frequency.envelope} />
                  {activity.cost ? <MetricDisplay metric={activity.cost.envelope} /> : null}
                  <span>{resolvedSubview === "rhythm" ? "Fréquence observée, sans référence habituelle surinterprétée." : "Occurrence canonique du mois."}</span>
                </CardSurface>
              </Anchored>
            );
          })}</div>
        )
      )}
      {model.frequencyCost.kind === "unavailable" ? <p className={styles.localCapability}>Fréquence × coût indisponible : la relation causale canonique n’est pas exploitable pour ce scope.</p> : null}
    </div>
  );
}

export function MomentsModule({ model, runtime, scope }: { readonly model: AnalysisMonthMomentsReadModel; readonly runtime: ProductRuntimeValue; readonly scope: NormalizedAnalysisScope }) {
  if (model.moments.length === 0) return <Surface variant="subtle" className={styles.noMoments}><strong>Aucun moment ce mois-ci</strong><span>La collection canonique du mois est valide et vide.</span></Surface>;
  const items = model.moments.map((moment) => {
    const anchor: SemanticAnchor = { moduleId: "analysis-month", item: { kind: "moment", id: moment.momentId } };
    const dates = moment.startDate ? `${moment.startDate}${moment.endDate && moment.endDate !== moment.startDate ? ` → ${moment.endDate}` : ""}` : undefined;
    return {
      key: moment.momentId,
      content: (
        <Anchored anchor={anchor} className={model.moments.length === 1 ? styles.singleMoment : undefined}>
          <CardSurface variant="outlined" className={styles.momentCard} action={{ kind: "callback", onAction: () => openDestination(runtime, moment.destination, scope, anchor) }} ariaLabel={`Explorer le Moment ${moment.title}`}>
            <MediaSurface className={styles.momentMedia} state={{ kind: "fallback", geometry: { aspectRatio: 16 / 9 }, role: "illustration", fallback: resolveMediaFallback({ kind: "moment", reason: "absent", label: moment.title }) }} />
            <strong>{moment.title}</strong>
            {dates ? <span>{dates}</span> : null}
            {moment.participants.length ? <span>{moment.participants.map((participant) => participant.label ?? participant.personId).join(" · ")}</span> : null}
            {moment.duration ? <span>{moment.duration}</span> : null}
            {moment.economicCost ? <MetricDisplay metric={moment.economicCost.envelope} variant="compact" /> : null}
          </CardSurface>
        </Anchored>
      ),
    };
  });
  return <ContentRail label="Moments du mois" items={items} mode={items.length >= 4 ? "rail" : "row"} />;
}
