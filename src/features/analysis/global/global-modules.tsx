import type {
  AnalysisGlobalBaselineReadModel,
  AnalysisGlobalEvolutionReadModel,
  AnalysisGlobalHabitsReadModel,
  AnalysisGlobalInitialReadModel,
  AnalysisGlobalProfilesReadModel,
  AnalysisGlobalTypicalReadModel,
  AnalysisGlobalUniverseReadModel,
  CountMetricEnvelope,
  GlobalReferenceSlot,
  MoneyMetricEnvelope,
} from "@/query-api";
import type { YearMonth } from "@/core/time";
import { MetricDisplay, NoDataState, NoReferenceState, Surface } from "@/ui";
import styles from "./global.module.css";

function AnyMetric({ metric }: { readonly metric: MoneyMetricEnvelope | CountMetricEnvelope }) {
  return <MetricDisplay metric={metric as MoneyMetricEnvelope} />;
}

export function GlobalOverviewModule({ model }: { readonly model: AnalysisGlobalInitialReadModel }) {
  const counters = [
    ["Mois documentés", model.documentedMonths],
    ["Activités observées", model.documentedActivities],
    ["Moments", model.momentsCount],
    ["Lieux observés", model.observedPlacesCount],
    ["Opérations", model.operationsCount],
  ] as const;
  return (
    <div className={styles.metricGrid}>
      {counters.map(([label, metric]) => <Surface key={label} variant="outlined"><span className="eyebrow">{label}</span><MetricDisplay metric={metric} variant="hero" /></Surface>)}
      <Surface variant="raised"><span className="eyebrow">Consommation économique nette</span><MetricDisplay metric={model.economicConsumptionNetAttributable.envelope} variant="hero" /></Surface>
    </div>
  );
}

function Reference({ label, slot }: { readonly label: string; readonly slot: GlobalReferenceSlot }) {
  return (
    <Surface variant="outlined">
      <strong>{label}</strong>
      {slot.status === "available"
        ? <MetricDisplay metric={slot.metric.envelope} />
        : <NoReferenceState value="—" message={slot.reason === "blocked_data" ? "Donnée canonique nécessaire non projetée." : "Référence officielle non disponible."} />}
    </Surface>
  );
}

export function GlobalBaselineModule({ model, view, onView }: { readonly model: AnalysisGlobalBaselineReadModel; readonly view: "day" | "week" | "month"; readonly onView: (view: "day" | "week" | "month") => void }) {
  return (
    <div>
      <div className={styles.tabs} role="tablist" aria-label="Période du socle">
        {(["day", "week", "month"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => onView(value)}>{value === "day" ? "Jour" : value === "week" ? "Semaine" : "Mois"}</button>)}
      </div>
      <div className={styles.cardGrid}>
        {view === "day" ? <><Reference label="Journée neutre" slot={model.day.neutral} /><Reference label="Journée typique" slot={model.day.typical} /></> : null}
        {view === "week" ? <><Reference label="Semaine neutre" slot={model.week.neutral} /><Reference label="Semaine neutre ajustée au calendrier" slot={model.week.calendarAdjustedNeutral} /></> : null}
        {view === "month" ? <><Reference label="Mois minimal réaliste" slot={model.month.minimal} /><Reference label="Mois neutre ajusté au calendrier" slot={model.month.calendarAdjustedNeutral} /></> : null}
      </div>
    </div>
  );
}

export function GlobalTypicalModule({ model, onTarget }: { readonly model: AnalysisGlobalTypicalReadModel; readonly onTarget: (activityId: string) => void }) {
  return (
    <div className={styles.stack}>
      <Surface variant="raised">
        <span className="eyebrow">Montant typique</span>
        {model.monthlyTypical.status === "available" ? <MetricDisplay metric={model.monthlyTypical.metric.envelope} variant="hero" /> : <NoReferenceState value="—" message="La référence typique n’est pas attribuable à cette perspective." />}
      </Surface>
      {model.behaviorRows.length === 0 ? <NoDataState description="Aucun comportement observable sur les mois complets de la fenêtre." /> : (
        <div className={styles.rows}>
          {model.behaviorRows.map((row) => (
            <Surface key={row.activityId} variant="outlined" action={{ kind: "callback", onAction: () => onTarget(row.activityId) }}>
              <strong>{row.label}</strong>
              <span>{row.activePeriodCount} mois actifs / {row.observablePeriodCount} observables</span>
              <span>{row.activityRate === null ? "Taux indisponible" : `${Math.round(row.activityRate * 100)} % des mois`}</span>
              <span>{row.habitualFrequency === null ? "Fréquence habituelle : support insuffisant" : `Habituellement ${row.habitualFrequency} fois par mois`}</span>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}

export function GlobalEvolutionModule({ model, selectedMonth, onSelectMonth, onAnalyze, onMethodology }: { readonly model: AnalysisGlobalEvolutionReadModel; readonly selectedMonth?: YearMonth; readonly onSelectMonth: (month: YearMonth) => void; readonly onAnalyze: (month: YearMonth) => void; readonly onMethodology: (metricId: string) => void }) {
  const selected = selectedMonth ?? model.series[0]?.points.at(-1)?.period;
  if (model.series.length === 0) return <NoDataState />;
  return (
    <div className={styles.stack}>
      {model.series.map((series) => (
        <section key={series.seriesId} className={styles.series} aria-label={series.label}>
          <div className={styles.moduleHeader}><strong>{series.label}</strong><button type="button" className="button-ghost" onClick={() => onMethodology(series.metricId)}>Méthode</button></div>
          <ol className={styles.timeline}>
            {series.points.map((point) => <li key={point.period}><button type="button" aria-pressed={selected === point.period} onClick={() => onSelectMonth(point.period)}><span>{point.period}</span><AnyMetric metric={point.metric.envelope} /></button></li>)}
          </ol>
        </section>
      ))}
      {selected ? <button type="button" className="button-primary" onClick={() => onAnalyze(selected)}>Analyser {selected}</button> : null}
    </div>
  );
}

export function GlobalHabitsModule({ model, selectedCell, onSelectCell }: { readonly model: AnalysisGlobalHabitsReadModel; readonly selectedCell?: string; readonly onSelectCell: (activityId: string, month: YearMonth) => void }) {
  if (model.content.kind === "unavailable") return <NoReferenceState value="—" message="Cette vue attend encore une méthode ou une source contractée." />;
  if (model.content.kind === "contexts") {
    const sections = model.content.contexts.sections.filter((section) => section.kind === "available");
    return sections.length === 0 ? <NoDataState /> : <div className={styles.rows}>{sections.flatMap((section) => section.kind === "available" ? section.rows.map((row) => <Surface key={`${section.capabilityId}:${row.key}`} variant="outlined"><strong>{row.label}</strong><AnyMetric metric={row.metric.envelope} /></Surface>) : [])}</div>;
  }
  const heatmap = model.content.heatmap;
  return heatmap.rows.length === 0 ? <NoDataState /> : (
    <div className={styles.tableScroll}>
      <table className={styles.heatmap}><thead><tr><th>Activité</th>{heatmap.columns.map((month) => <th key={month}>{month}</th>)}</tr></thead><tbody>{heatmap.rows.map((row) => <tr key={row.id}><th>{row.label}</th>{heatmap.columns.map((month) => { const cell = heatmap.cells.find((candidate) => candidate.rowId === row.id && candidate.columnId === month); const key = `${row.id}:${month}`; return <td key={month}><button type="button" aria-pressed={selectedCell === key} disabled={cell?.state !== "known"} onClick={() => onSelectCell(row.id, month)}>{cell?.state === "known" ? cell.value : "—"}</button></td>; })}</tr>)}</tbody></table>
    </div>
  );
}

export function GlobalProfilesModule({ model, onExplore }: { readonly model: AnalysisGlobalProfilesReadModel; readonly onExplore: () => void }) {
  const refs = [["Activité dominante", model.dominantActivity], ["Lieu fréquent", model.frequentPlace], ["Contexte dominant", model.dominantContext]] as const;
  return (
    <div className={styles.stack}>
      <Surface variant="raised"><span className="eyebrow">Profil descriptif</span><h3>{model.label}</h3></Surface>
      <div className={styles.cardGrid}>{refs.map(([label, ref]) => <Surface key={label} variant="outlined"><strong>{label}</strong><span>{ref ? `${ref.label} · ${ref.count} observations` : "Non disponible"}</span></Surface>)}</div>
      <button type="button" className="button-secondary" onClick={onExplore}>Explorer ce profil</button>
    </div>
  );
}

export function GlobalUniverseModule({ model, onOpen, onSeeAll }: { readonly model: AnalysisGlobalUniverseReadModel; readonly onOpen: (kind: "moment" | "place" | "merchant", id: string) => void; readonly onSeeAll: (gallery: "moments" | "places" | "merchants", sort: "recent" | "frequent" | "spent") => void }) {
  const groups = [
    { key: "moments" as const, title: "Moments", sort: model.moments.sort, data: model.moments, kind: "moment" as const, id: (item: (typeof model.moments.items)[number]) => item.momentId, label: (item: (typeof model.moments.items)[number]) => item.title },
    { key: "places" as const, title: "Lieux", sort: model.places.sort, data: model.places, kind: "place" as const, id: (item: (typeof model.places.items)[number]) => item.placeId, label: (item: (typeof model.places.items)[number]) => item.label },
    { key: "merchants" as const, title: "Marchands", sort: model.merchants.sort, data: model.merchants, kind: "merchant" as const, id: (item: (typeof model.merchants.items)[number]) => item.merchantId, label: (item: (typeof model.merchants.items)[number]) => item.label },
  ];
  return <div className={styles.universe}>{groups.map((group) => <section key={group.key}><div className={styles.moduleHeader}><h3>{group.title}</h3><button type="button" className="button-ghost" onClick={() => onSeeAll(group.key, group.sort)}>Voir tous</button></div>{group.data.items.length === 0 ? <NoDataState /> : <div className={styles.rows}>{group.data.items.map((item) => <Surface key={group.id(item as never)} variant="outlined" action={{ kind: "callback", onAction: () => onOpen(group.kind, group.id(item as never)) }}><strong>{group.label(item as never)}</strong></Surface>)}</div>}</section>)}</div>;
}
