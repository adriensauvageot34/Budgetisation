"use client";

import type { ReactNode } from "react";
import { useSemanticAnchor } from "@/components/runtime";
import type { ExplorationNode, SemanticAnchor } from "@/navigation";
import type { EntityOperationReadModel } from "@/query-api";
import {
  Button,
  EmptyState,
  QualityBadge,
  SectionLayout,
  Surface,
  formatMetricValue,
} from "@/ui";
import type { ExplorationNavigation } from "./types";
import styles from "./exploration.module.css";

function ExactMoney({ value }: { readonly value: EntityOperationReadModel["bankTruth"]["amount"] }) {
  const formatted = formatMetricValue(value, "EUR", { kind: "exact" });
  return <span aria-label={formatted.accessibleValueText}>{formatted.primaryText}</span>;
}

function EvidenceRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <div className={styles.evidenceRow}><dt>{label}</dt><dd>{children}</dd></div>;
}

function EvidenceEntityAction({
  label,
  node,
  anchor,
  navigation,
}: {
  readonly label: string;
  readonly node: ExplorationNode;
  readonly anchor: SemanticAnchor;
  readonly navigation: ExplorationNavigation;
}) {
  const anchorRef = useSemanticAnchor(anchor);
  return (
    <span ref={anchorRef} data-semantic-anchor="exploration">
      <Button tone="quiet" action={{ kind: "callback", onAction: () => navigation.push(node, anchor) }}>{label}</Button>
    </span>
  );
}

function officialNecessityLabel(value: string): string {
  if (["Indispensable", "necessary"].includes(value)) return "Indispensable";
  if (["Contraint", "Contrainte"].includes(value)) return "Contraint";
  if (value === "Ajustable") return "Ajustable";
  if (["Optionnel", "Optionnelle", "discretionary"].includes(value)) return "Optionnel";
  return value;
}

function CompositionList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly EntityOperationReadModel["composition"]["allocations"][number][];
}) {
  return (
    <Surface variant="subtle" className={styles.compositionGroup}>
      <h4>{title}</h4>
      {items.length === 0 ? <p className={styles.metadata}>Aucun composant exposé</p> : (
        <ul className={styles.factList}>
          {items.map((item) => <li key={item.id}><span>{item.label ?? item.id}</span>{item.amount ? <ExactMoney value={item.amount} /> : null}</li>)}
        </ul>
      )}
    </Surface>
  );
}

export function OperationEvidenceSurface({
  model,
  navigation,
}: {
  readonly model: EntityOperationReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const economic = model.economicTruth;
  const merchantId = model.links.merchant.state === "resolved" ? model.links.merchant.id : undefined;
  const placeId = model.links.place.state === "resolved" ? model.links.place.id : undefined;
  return (
    <article className={styles.operationSurface} data-entity-surface="operation">
      <header className={styles.operationHeader}>
        <span className={styles.eyebrow}>Preuve bancaire canonique</span>
        <h2 data-exploration-heading="" tabIndex={-1}>{model.identity.title}</h2>
        {model.identity.subtitle ? <p>{model.identity.subtitle}</p> : null}
        <span className={styles.badges}>
          {model.traceability.dataState === "partial" ? <QualityBadge state="partial" /> : null}
          {model.traceability.dataState === "conflict" ? <QualityBadge state="conflict" /> : null}
          {model.traceability.dataState === "unknown" ? <QualityBadge state="incomplete" /> : null}
        </span>
      </header>

      <SectionLayout title="Vérité bancaire">
        <Surface variant="outlined">
          <dl className={styles.evidenceList}>
            <EvidenceRow label="Date bancaire">{model.bankTruth.bankDate}</EvidenceRow>
            <EvidenceRow label="Libellé bancaire">{model.bankTruth.label}</EvidenceRow>
            <EvidenceRow label="Montant bancaire exact"><ExactMoney value={model.bankTruth.amount} /></EvidenceRow>
            {model.bankTruth.accountRef ? <EvidenceRow label="Référence compte">{model.bankTruth.accountRef}</EvidenceRow> : null}
          </dl>
        </Surface>
      </SectionLayout>

      <SectionLayout title="Vérité économique">
        <Surface variant="outlined">
          <p>État : {economic.state}</p>
          <dl className={styles.evidenceList}>
            {economic.gross ? <EvidenceRow label="Brut"><ExactMoney value={economic.gross} /></EvidenceRow> : null}
            {economic.refundApplied ? <EvidenceRow label="Remboursement appliqué"><ExactMoney value={economic.refundApplied} /></EvidenceRow> : null}
            {economic.net ? <EvidenceRow label="Net économique"><ExactMoney value={economic.net} /></EvidenceRow> : null}
            <EvidenceRow label="Temporalité économique">
              {economic.economicTiming === undefined || economic.economicTiming.kind === "unknown"
                ? "Inconnue — aucune substitution par la date bancaire"
                : economic.economicTiming.kind === "conflict"
                  ? "À vérifier"
                  : (
                    <ul className={styles.factList}>
                      {economic.economicTiming.segments.map((segment) => (
                        <li key={segment.segmentKey}>
                          <span>{segment.periodStart ?? "Début inconnu"} → {segment.periodEnd ?? "Fin inconnue"} · {segment.timingState}</span>
                          <ExactMoney value={segment.amount} />
                        </li>
                      ))}
                    </ul>
                  )}
            </EvidenceRow>
          </dl>
        </Surface>
      </SectionLayout>

      <SectionLayout title="Classification">
        <dl className={styles.evidenceList}>
          <EvidenceRow label="Catégorie">{model.classification.category.state === "resolved" ? model.classification.category.categoryId : model.classification.category.state}</EvidenceRow>
          {model.classification.necessity ? <EvidenceRow label="Nécessité">{officialNecessityLabel(model.classification.necessity)}</EvidenceRow> : null}
          {model.classification.behavior ? <EvidenceRow label="Comportement">{model.classification.behavior}</EvidenceRow> : null}
          {model.classification.lifeScope ? <EvidenceRow label="LifeScope">{model.classification.lifeScope}</EvidenceRow> : null}
        </dl>
      </SectionLayout>

      <SectionLayout title="Liens canoniques">
        <div className={styles.relationActions}>
          {merchantId ? <EvidenceEntityAction label="Marchand" node={{ kind: "merchant", id: merchantId }} anchor={{ moduleId: "exploration", item: { kind: "merchant", id: merchantId } }} navigation={navigation} /> : null}
          {placeId ? <EvidenceEntityAction label="Lieu" node={{ kind: "place", id: placeId }} anchor={{ moduleId: "exploration", item: { kind: "place", id: placeId } }} navigation={navigation} /> : null}
          {model.links.lifeEvents.map((event) => <EvidenceEntityAction key={event.id} label={event.label} node={{ kind: "life_event", id: event.id }} anchor={{ moduleId: "exploration", item: { kind: "life_event", id: event.id } }} navigation={navigation} />)}
          {model.links.moments.map((id) => <EvidenceEntityAction key={id} label="Moment direct" node={{ kind: "moment", id }} anchor={{ moduleId: "exploration", item: { kind: "moment", id } }} navigation={navigation} />)}
        </div>
      </SectionLayout>

      <SectionLayout title="Composition" description="Familles de preuves distinctes ; aucun total n’est recomposé dans l’UI.">
        <div className={styles.compositionGrid}>
          <CompositionList title="Allocations" items={model.composition.allocations} />
          <CompositionList title="Items" items={model.composition.items} />
          <CompositionList title="Payment components" items={model.composition.paymentComponents} />
          <CompositionList title="Cash uses" items={model.composition.cashUses} />
        </div>
      </SectionLayout>

      <SectionLayout title="Traçabilité">
        {model.traceability.canonicalComponentKeys.length === 0 && model.traceability.evidence.length === 0 ? <EmptyState title="Aucune preuve technique exposée" /> : (
          <div className={styles.traceabilityGrid}>
            <Surface variant="subtle"><h4>Clés de composant</h4><ul className={styles.factList}>{model.traceability.canonicalComponentKeys.map((key) => <li key={key}>{key}</li>)}</ul></Surface>
            <Surface variant="subtle"><h4>EvidenceRefs</h4><ul className={styles.factList}>{model.traceability.evidence.map((item) => <li key={`${item.sourceType}-${item.sourceId}`}>{item.sourceType} · {item.sourceId}</li>)}</ul></Surface>
          </div>
        )}
      </SectionLayout>
    </article>
  );
}
