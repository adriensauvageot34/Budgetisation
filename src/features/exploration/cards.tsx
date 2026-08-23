"use client";

import type { LifeEventId, MerchantId, MomentId, PersonId, PlaceId } from "@/core/identity";
import type { LocalDate } from "@/core/time";
import type { ReactNode } from "react";
import type { SemanticAnchor } from "@/navigation";
import { useSemanticAnchor } from "@/components/runtime/product-runtime-provider";
import type {
  ScopedCountMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "@/query-api";
import {
  CardSurface,
  MediaSurface,
  MetricDisplay,
  resolveMediaFallback,
} from "@/ui";
import type { ExplorationNavigation, OperationPreviewModel } from "./types";
import { PublishedMetric } from "./shared";
import styles from "./exploration.module.css";

function AnchoredCard({ anchor, children }: { readonly anchor: SemanticAnchor; readonly children: ReactNode }) {
  const ref = useSemanticAnchor(anchor);
  return <div ref={ref} className={styles.anchorCard} data-semantic-anchor="exploration">{children}</div>;
}

function FallbackMedia({
  kind,
  label,
  personaKind,
}: {
  readonly kind: "moment" | "place" | "merchant" | "persona" | "life_event";
  readonly label: string;
  readonly personaKind?: "person" | "ensemble";
}) {
  return (
    <MediaSurface
      className={styles.cardMedia}
      state={{
        kind: "fallback",
        geometry: { aspectRatio: kind === "moment" ? 16 / 9 : 1.6 },
        role: kind === "merchant" ? "logo" : "illustration",
        fallback: resolveMediaFallback({ kind, reason: "absent", label, ...(personaKind ? { personaKind } : {}) }),
      }}
    />
  );
}

function ScopedMetric({ metric }: { readonly metric?: ScopedMoneyMetricReadModel | ScopedCountMetricReadModel }) {
  return metric ? <PublishedMetric metric={metric} /> : null;
}

export function MomentCard({
  momentId,
  title,
  timeline,
  causalCost,
  duringCost,
  navigation,
}: {
  readonly momentId: MomentId;
  readonly title: string;
  readonly timeline?: string;
  readonly causalCost?: ScopedMoneyMetricReadModel;
  readonly duringCost?: ScopedMoneyMetricReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = { moduleId: "exploration", item: { kind: "moment", id: momentId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.momentCard} action={{ kind: "callback", onAction: () => navigation.push({ kind: "moment", id: momentId }, anchor) }} ariaLabel={`Explorer le Moment ${title}`}>
      <FallbackMedia kind="moment" label={title} />
      <strong>{title}</strong>
      {timeline ? <span className={styles.metadata}>{timeline}</span> : null}
      <ScopedMetric metric={causalCost} />
      {duringCost ? <span className={styles.secondaryMetric}>Pendant : <ScopedMetric metric={duringCost} /></span> : null}
    </CardSurface></AnchoredCard>
  );
}

export function PlaceCard({
  placeId,
  label,
  visitCount,
  distinctVisitDays,
  localizedSpend,
  accessCostEstimate,
  navigation,
}: {
  readonly placeId: PlaceId;
  readonly label: string;
  readonly visitCount?: ScopedCountMetricReadModel;
  readonly distinctVisitDays?: ScopedCountMetricReadModel;
  readonly localizedSpend?: ScopedMoneyMetricReadModel;
  readonly accessCostEstimate?: ScopedMoneyMetricReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = { moduleId: "exploration", item: { kind: "place", id: placeId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.placeCard} action={{ kind: "callback", onAction: () => navigation.push({ kind: "place", id: placeId }, anchor) }} ariaLabel={`Explorer le lieu ${label}`}>
      <FallbackMedia kind="place" label={label} />
      <strong>{label}</strong>
      <ScopedMetric metric={visitCount ?? distinctVisitDays} />
      {localizedSpend ? <span className={styles.secondaryMetric}>Dépense localisée : <ScopedMetric metric={localizedSpend} /></span> : null}
      {accessCostEstimate ? <span className={styles.secondaryMetric}>Accès estimé : <ScopedMetric metric={accessCostEstimate} /></span> : null}
    </CardSurface></AnchoredCard>
  );
}

export function MerchantCard({
  merchantId,
  label,
  spatialMode,
  economicAmount,
  purchaseCount,
  navigation,
}: {
  readonly merchantId: MerchantId;
  readonly label: string;
  readonly spatialMode?: string;
  readonly economicAmount?: ScopedMoneyMetricReadModel;
  readonly purchaseCount?: ScopedCountMetricReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = { moduleId: "exploration", item: { kind: "merchant", id: merchantId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.merchantCard} action={{ kind: "callback", onAction: () => navigation.push({ kind: "merchant", id: merchantId }, anchor) }} ariaLabel={`Explorer le marchand ${label}`}>
      <FallbackMedia kind="merchant" label={label} />
      <strong>{label}</strong>
      {spatialMode ? <span className={styles.metadata}>{spatialMode}</span> : null}
      <ScopedMetric metric={economicAmount} />
      {purchaseCount ? <span className={styles.secondaryMetric}>Achats : <ScopedMetric metric={purchaseCount} /></span> : null}
    </CardSurface></AnchoredCard>
  );
}

export function PersonaCard({
  personaId,
  title,
  primaryMetric,
  navigation,
}: {
  readonly personaId: PersonId | "ensemble";
  readonly title: string;
  readonly primaryMetric?: ScopedMoneyMetricReadModel | ScopedCountMetricReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = personaId === "ensemble"
    ? { moduleId: "exploration", itemKey: "persona:ensemble" }
    : { moduleId: "exploration", item: { kind: "person", id: personaId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.personaCard} action={{ kind: "callback", onAction: () => navigation.push({ kind: "persona", id: personaId }, anchor) }} ariaLabel={`Explorer ${title}`}>
      <FallbackMedia kind="persona" label={title} personaKind={personaId === "ensemble" ? "ensemble" : "person"} />
      <strong>{title}</strong>
      <span className={styles.metadata}>Identité analytique</span>
      <ScopedMetric metric={primaryMetric} />
    </CardSurface></AnchoredCard>
  );
}

export function LifeEventCard({
  lifeEventId,
  title,
  startsOn,
  endsOn,
  navigation,
}: {
  readonly lifeEventId: LifeEventId;
  readonly title: string;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = { moduleId: "exploration", item: { kind: "life_event", id: lifeEventId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.lifeEventCard} action={{ kind: "callback", onAction: () => navigation.push({ kind: "life_event", id: lifeEventId }, anchor) }} ariaLabel={`Explorer l’événement ${title}`}>
      <FallbackMedia kind="life_event" label={title} />
      <strong>{title}</strong>
      <span className={styles.metadata}>{startsOn} → {endsOn}</span>
      <span className={styles.metadata}>Une occurrence canonique</span>
    </CardSurface></AnchoredCard>
  );
}

export function OperationPreviewCard({
  operation,
  navigation,
}: {
  readonly operation: OperationPreviewModel;
  readonly navigation: ExplorationNavigation;
}) {
  const anchor: SemanticAnchor = { moduleId: "exploration", item: { kind: "operation", id: operation.operationId } };
  return (
    <AnchoredCard anchor={anchor}><CardSurface variant="outlined" className={styles.operationPreview} action={{ kind: "callback", onAction: () => navigation.push({ kind: "operation", id: operation.operationId }, anchor) }} ariaLabel={`Ouvrir la preuve bancaire ${operation.label}`}>
      <span className={styles.eyebrow}>Preuve bancaire</span>
      <strong>{operation.label}</strong>
      {operation.bankDate ? <span className={styles.metadata}>{operation.bankDate}</span> : null}
    </CardSurface></AnchoredCard>
  );
}
