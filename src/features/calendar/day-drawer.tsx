"use client";

import type { RefObject } from "react";
import type { LocalDate } from "@/core/time";
import type { HistoryDayDetailReadModel } from "@/query-api";
import {
  Button,
  ErrorState,
  MetricDisplay,
  OverlayFrame,
  OverlaySkeleton,
  QualityBadge,
  RefreshIndicator,
  SectionLayout,
  StatusBadge,
  Surface,
  formatMetricValue,
  type UiTransportState,
} from "@/ui";
import type { CalendarNavigation } from "./types";
import styles from "./calendar.module.css";

function fullDateLabel(date: LocalDate): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function ContextSummary({ model }: { readonly model: HistoryDayDetailReadModel }) {
  return (
    <div className={styles.contexts}>
      <Surface variant="subtle">
        <strong>Contexte du jour</strong>
        <p>
          {model.contexts.dayContext.kind === "known"
            ? model.contexts.dayContext.values.join(" · ") || "Non renseigné"
            : model.contexts.dayContext.kind === "conflict"
              ? "À vérifier"
              : "Inconnu"}
        </p>
      </Surface>
      <Surface variant="subtle">
        <strong>Périmètres de vie</strong>
        {model.contexts.lifeScopeSummary.availability === "known" ? (
          <ul className={styles.cleanList}>
            {model.contexts.lifeScopeSummary.entries.map((entry) => (
              <li key={entry.context}><span>{entry.context}</span><MetricDisplay metric={entry.economicAmount} variant="compact" /></li>
            ))}
          </ul>
        ) : (
          <p>{model.contexts.lifeScopeSummary.availability === "conflict" ? "À vérifier" : "Inconnu"}</p>
        )}
      </Surface>
    </div>
  );
}

function FinanceSummary({ model }: { readonly model: HistoryDayDetailReadModel }) {
  const entries = [
    ["Dépense économique", model.finance.economicAmount],
    ["Flux bancaire", model.finance.bankFlowAmount],
    ["Montant causal", model.finance.causalAmount],
    ["Montant pendant", model.finance.duringAmount],
  ] as const;
  return (
    <div className={styles.financeGrid}>
      {entries.map(([label, metric]) => metric ? (
        <Surface key={label} variant={label === "Dépense économique" ? "outlined" : "subtle"}>
          <span className={styles.dayMeta}>{label}</span>
          <MetricDisplay metric={metric} qualifierMode="full" />
        </Surface>
      ) : null)}
    </div>
  );
}

function ActivityPreview({
  model,
  navigation,
}: {
  readonly model: HistoryDayDetailReadModel;
  readonly navigation: CalendarNavigation;
}) {
  if (model.activities.items.length === 0) return null;
  return (
    <SectionLayout title="Activités" headingLevel={3}>
      <ul className={styles.timelineList}>
        {model.activities.items.map((activity) => (
          <li key={activity.lifeEventId}>
            <Surface variant="outlined">
              <span className={styles.previewHeader}>
                <strong>{activity.label}</strong>
                <StatusBadge state={activity.validationStatus === "Confirmé" ? "confirmed" : "deduced"} />
              </span>
              <span className={styles.dayMeta}>Du {fullDateLabel(activity.startsOn)} au {fullDateLabel(activity.endsOn)}</span>
              {activity.causalAmount ? <MetricDisplay metric={activity.causalAmount} variant="compact" /> : null}
              <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration({ kind: "life_event", id: activity.lifeEventId }) }}>
                Explorer le Life Event
              </Button>
            </Surface>
          </li>
        ))}
      </ul>
      {model.activities.truncated ? <p className={styles.dayMeta}>Aperçu limité à {model.activities.maxItems} activités.</p> : null}
    </SectionLayout>
  );
}

function PlacePreview({
  model,
  navigation,
}: {
  readonly model: HistoryDayDetailReadModel;
  readonly navigation: CalendarNavigation;
}) {
  if (model.places.items.length === 0) return null;
  return (
    <SectionLayout title="Lieux" headingLevel={3}>
      <ul className={styles.timelineList}>
        {model.places.items.map((place) => (
          <li key={place.placeId}>
            <Surface variant="outlined">
              <span className={styles.previewHeader}>
                <strong>Visite de lieu</strong>
                {place.visitState === "partial" ? <QualityBadge state="partial" /> : null}
              </span>
              <span className={styles.dayMeta}>Précision : {place.timePrecision}</span>
              {place.localizedSpend ? <MetricDisplay metric={place.localizedSpend} variant="compact" /> : null}
              <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration({ kind: "place", id: place.placeId }) }}>
                Explorer le lieu
              </Button>
            </Surface>
          </li>
        ))}
      </ul>
      {model.places.truncated ? <p className={styles.dayMeta}>Aperçu limité à {model.places.maxItems} lieux.</p> : null}
    </SectionLayout>
  );
}

function OperationPreview({
  model,
  navigation,
}: {
  readonly model: HistoryDayDetailReadModel;
  readonly navigation: CalendarNavigation;
}) {
  if (model.operations.items.length === 0) return null;
  return (
    <SectionLayout title="Opérations" headingLevel={3}>
      <ul className={styles.timelineList}>
        {model.operations.items.map((operation) => {
          const amount = formatMetricValue(operation.amount, "EUR");
          return (
            <li key={operation.operationId}>
              <Surface variant="outlined">
                <span className={styles.previewHeader}>
                  <strong>{operation.label}</strong>
                  <span aria-label={amount.accessibleValueText}>{amount.primaryText}</span>
                </span>
                <span className={styles.previewActions}>
                  <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration({ kind: "operation", id: operation.operationId }) }}>
                    Explorer l’opération
                  </Button>
                  {operation.merchantId ? (
                    <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration({ kind: "merchant", id: operation.merchantId! }) }}>
                      Explorer le marchand
                    </Button>
                  ) : null}
                  {operation.placeId ? (
                    <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.openExploration({ kind: "place", id: operation.placeId! }) }}>
                      Explorer le lieu
                    </Button>
                  ) : null}
                </span>
              </Surface>
            </li>
          );
        })}
      </ul>
      {model.operations.truncated ? <p className={styles.dayMeta}>Aperçu limité à {model.operations.maxItems} opérations.</p> : null}
    </SectionLayout>
  );
}

export function DayDetailDrawer({
  date,
  state,
  navigation,
  open = true,
  topmost = true,
  suspended = false,
  backgroundRootRef,
  restoreFocusRef,
  onRetry,
}: {
  readonly date: LocalDate;
  readonly state: UiTransportState<HistoryDayDetailReadModel>;
  readonly navigation: CalendarNavigation;
  readonly open?: boolean;
  readonly topmost?: boolean;
  readonly suspended?: boolean;
  readonly backgroundRootRef?: RefObject<HTMLElement | null>;
  readonly restoreFocusRef?: RefObject<HTMLElement | null>;
  readonly onRetry?: () => void;
}) {
  const response = state.status === "success" ? state.response : state.status === "error" ? state.previousData : undefined;
  const model = response?.data;
  let content;
  if (state.status === "idle" || state.status === "loading") content = <OverlaySkeleton />;
  else if (state.status === "error" && model === undefined) content = <ErrorState error={state.error} onRetry={onRetry} />;
  else if (model !== undefined) content = (
    <div className={styles.drawerContent}>
      <span className={styles.badges}>
        {model.header.observability === "partial" || model.header.periodCompleteness === "partial" ? <QualityBadge state="partial" /> : null}
        {model.header.dayContext.kind === "conflict" ? <QualityBadge state="conflict" /> : null}
      </span>
      <SectionLayout title="Finance"><FinanceSummary model={model} /></SectionLayout>
      <SectionLayout title="Contextes"><ContextSummary model={model} /></SectionLayout>
      <SectionLayout title="Repères du jour" description="Aperçus canoniques, sans recomposition locale.">
        <div className={styles.drawerSections}>
          <ActivityPreview model={model} navigation={navigation} />
          <PlacePreview model={model} navigation={navigation} />
          <OperationPreview model={model} navigation={navigation} />
        </div>
      </SectionLayout>
      {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
      {state.status === "error" ? <RefreshIndicator failed announce /> : null}
    </div>
  );
  else throw new TypeError("Réponse Day Detail indisponible.");
  return (
    <OverlayFrame
      title={`Journée du ${fullDateLabel(model?.date ?? date)}`}
      subtitle="Détail fourni par history_day_detail"
      kind="day_drawer"
      open={open}
      topmost={topmost}
      suspended={suspended}
      closeAction={{ kind: "callback", onAction: () => navigation.closeDay() }}
      backgroundRootRef={backgroundRootRef}
      restoreFocusRef={restoreFocusRef}
    >
      <div className={styles.drawerContent}>
        <nav className={styles.drawerNavigation} aria-label="Navigation entre les jours">
          <Button tone="secondary" action={{ kind: "callback", onAction: () => navigation.previousDay() }}>Jour précédent</Button>
          <Button tone="secondary" action={{ kind: "callback", onAction: () => navigation.nextDay() }}>Jour suivant</Button>
        </nav>
        {content}
      </div>
    </OverlayFrame>
  );
}
