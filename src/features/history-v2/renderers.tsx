"use client";

import type { ReactNode } from "react";
import type {
  CollectionValue,
  DisplayNode,
  MetricValue,
  QualityEnvelope,
} from "@/core/history-v2";
import type { Money } from "@/core/money";
import { formatMetricValue } from "@/ui/metrics/metric-format";
import { QualityBadge } from "@/ui";
import styles from "./history-v2.module.css";

const reasonLabels: Readonly<Record<string, string>> = {
  DATA_NO_SOURCE: "Indisponible",
  DATA_PARTIAL_SOURCE: "Données partielles",
  DATA_UNASSIGNED_TIMING: "Temporalité non affectée",
  DATA_UNCLASSIFIED_COMPONENT: "Classification incomplète",
  DATA_NO_PURCHASE_EVENT: "Achat non identifié",
  DATA_NO_CONTINUITY_ASSERTION: "Continuité non établie",
  DATA_NO_LOCATION_AUTHORITY: "Lieu non établi",
  DATA_NO_CAUSAL_LINK: "Lien causal non établi",
  DATA_CONFLICTING_AUTHORITIES: "Sources en conflit",
  REFERENCE_INSUFFICIENT_SUPPORT: "Support insuffisant",
  REFERENCE_LIMITED_SUPPORT: "Support limité",
  COVERAGE_INSUFFICIENT: "Couverture insuffisante",
  COVERAGE_PARTIAL: "Couverture partielle",
  POLICY_NOT_APPLICABLE: "Non applicable",
  POLICY_NOT_MATERIAL: "Non significatif",
  POLICY_NOT_ELIGIBLE: "Non éligible",
  COLLECTION_KNOWN_EMPTY: "Aucun élément",
  COLLECTION_PARTIAL: "Collection partielle",
  FEATURE_DEFERRED: "Fonction différée",
  PUBLICATION_STALE: "Publication à actualiser",
  PUBLICATION_CONTRACT_MISMATCH: "Contrat incompatible",
  PUBLICATION_POLICY_MISMATCH: "Politique incompatible",
  PUBLICATION_FACTS_MISMATCH: "Données incompatibles",
};

function primaryBadge(quality?: QualityEnvelope) {
  if (quality?.reasonCode === "DATA_CONFLICTING_AUTHORITIES") return "conflict" as const;
  if (quality?.support?.level === "insufficient") return "insufficient_support" as const;
  if (quality?.support?.level === "limited") return "limited_support" as const;
  if (quality?.coverage?.level === "low" || quality?.coverage?.level === "medium") return "incomplete" as const;
  if (quality?.badges?.includes("ESTIMATED")) return "estimated" as const;
  return undefined;
}

export function QualityMark({ quality }: { readonly quality?: QualityEnvelope }) {
  const badge = primaryBadge(quality);
  return badge === undefined ? null : <QualityBadge state={badge} />;
}

export function formatMoney(value: Money): string {
  return formatMetricValue(value, "EUR").primaryText;
}

export function MetricState<T>({
  metric,
  format,
  className,
}: {
  readonly metric: MetricValue<T>;
  readonly format: (value: T) => ReactNode;
  readonly className?: string;
}) {
  if (metric.status === "KNOWN") {
    return <span className={className}>{format(metric.value)}<QualityMark quality={metric.quality} /></span>;
  }
  if (metric.status === "PARTIAL") {
    return (
      <span className={className} data-quality="partial">
        {metric.partialMeaning === "LOWER_BOUND" ? "Au moins " : "Observé : "}
        {format(metric.value)} <QualityBadge state="partial" />
      </span>
    );
  }
  const label = metric.status === "NOT_APPLICABLE"
    ? "Non applicable"
    : metric.status === "CONFLICT"
      ? "À vérifier"
      : "Indisponible";
  return <span className={[styles.unavailable, className].filter(Boolean).join(" ")}>{label}<QualityMark quality={metric.quality} /></span>;
}

export function MoneyMetric({ metric, className }: { readonly metric: MetricValue<Money>; readonly className?: string }) {
  return <MetricState metric={metric} format={formatMoney} className={className} />;
}

export function CollectionState<T>({
  collection,
  children,
  emptyLabel = "Aucun élément pour ce mois",
}: {
  readonly collection: CollectionValue<T>;
  readonly children: (items: readonly T[]) => ReactNode;
  readonly emptyLabel?: string;
}) {
  if (collection.status === "KNOWN") {
    return collection.items.length === 0
      ? <p className={styles.emptyState}>{emptyLabel}</p>
      : <>{children(collection.items)}</>;
  }
  if (collection.status === "PARTIAL") {
    return <><div className={styles.inlineStatus}><QualityBadge state="partial" /> Éléments observés uniquement</div>{children(collection.items)}</>;
  }
  return <p className={styles.emptyState}>{collection.status === "NOT_APPLICABLE" ? "Non applicable" : collection.status === "CONFLICT" ? "Données à vérifier" : "Indisponible"}</p>;
}

export function DisplayState<T>({
  node,
  children,
  placeholder,
}: {
  readonly node: DisplayNode<T>;
  readonly children: (data: T) => ReactNode;
  readonly placeholder?: ReactNode;
}) {
  if (node.visibility === "HIDDEN") return null;
  if (node.visibility === "PLACEHOLDER") {
    return <div className={styles.placeholder}>{placeholder ?? reasonLabels[node.reasonCode] ?? "Indisponible"}<QualityMark quality={node.quality} /></div>;
  }
  return <>{children(node.data)}</>;
}

export function StateBoundary<T>({
  state,
  children,
  skeleton,
}: {
  readonly state: import("@/ui").UiTransportState<T>;
  readonly children: (data: T) => ReactNode;
  readonly skeleton?: ReactNode;
}) {
  const data = state.status === "success" ? state.response.data : state.status === "error" ? state.previousData?.data : undefined;
  if (data !== undefined) return <>{children(data)}</>;
  if (state.status === "error") {
    return <div className={styles.errorState} role="alert"><strong>Impossible de charger</strong><p>{state.error.message}</p><button type="button" className="button-secondary" onClick={() => window.location.reload()}>Réessayer</button></div>;
  }
  return <>{skeleton ?? <div className={styles.skeleton} aria-label="Chargement" />}</>;
}
