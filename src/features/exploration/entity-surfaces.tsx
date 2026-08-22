"use client";

import type { SemanticEntityRef } from "@/query-api";
import type {
  EntityLifeEventReadModel,
  EntityMerchantReadModel,
  EntityMomentReadModel,
  EntityPersonaReadModel,
  EntityPlaceReadModel,
  ScopedMetricReadModel,
} from "@/query-api";
import {
  EmptyState,
  SectionLayout,
  StatusBadge,
  Surface,
} from "@/ui";
import {
  EntityIdentityRegion,
  EntitySections,
  RelatedRail,
  RelationPreviewCard,
  PublishedMetric,
  hasCapabilitySection,
} from "./shared";
import { OperationPreviewCard } from "./cards";
import type { ExplorationNavigation } from "./types";
import styles from "./exploration.module.css";

function HeadlineMetrics({
  metrics,
}: {
  readonly metrics: readonly { readonly label: string; readonly metric: ScopedMetricReadModel }[];
}) {
  if (metrics.length === 0) return null;
  return (
    <div className={styles.headlineMetrics} aria-label="Métriques principales">
      {metrics.map(({ label, metric }) => (
        <Surface key={`${label}-${metric.metricId}`} variant="outlined">
          <span className={styles.metadata}>{label}</span>
          <PublishedMetric metric={metric} />
        </Surface>
      ))}
    </div>
  );
}

function PreviewLabels({
  labels,
  emptyTitle,
}: {
  readonly labels: readonly string[];
  readonly emptyTitle: string;
}) {
  return labels.length === 0 ? (
    <EmptyState title={emptyTitle} />
  ) : (
    <ul className={styles.factList}>{labels.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}</ul>
  );
}

export function MomentSurface({
  model,
  navigation,
}: {
  readonly model: EntityMomentReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const metrics = [];
  if (model.headline.causalCost) metrics.push({ label: "Coût causal", metric: model.headline.causalCost });
  if (model.headline.duringCost) metrics.push({ label: "Coût pendant", metric: model.headline.duringCost });
  const sections = [];
  if (hasCapabilitySection(model.capabilities, "timeline")) {
    sections.push({
      id: "timeline",
      label: "Timeline",
      content: model.timeline.startsOn || model.timeline.endsOn ? (
        <p>{model.timeline.startsOn ?? "Début inconnu"} → {model.timeline.endsOn ?? "Fin inconnue"}</p>
      ) : <EmptyState title="Temporalité non renseignée" />,
    });
  }
  if (hasCapabilitySection(model.capabilities, "participants")) {
    sections.push({
      id: "participants",
      label: "Participants",
      content: model.participants.length === 0 ? <EmptyState title="Aucun participant exposé" /> : (
        <div className={styles.previewGrid}>
          {model.participants.map((participant) => (
            <Surface
              key={participant.personId}
              variant="subtle"
              action={{ kind: "callback", onAction: () => navigation.push({ kind: "persona", id: participant.personId }) }}
              ariaLabel={`Explorer ${participant.label ?? "le participant"}`}
            >
              {participant.label ?? "Participant"}
            </Surface>
          ))}
        </div>
      ),
    });
  }
  if (hasCapabilitySection(model.capabilities, "evidence")) {
    sections.push({
      id: "evidence",
      label: "Preuves liées",
      content: model.evidencePreview.items.length === 0 ? <EmptyState title="Aucune preuve liée" /> : (
        <div className={styles.previewGrid}>
          {model.evidencePreview.items.map((relation) => (
            <RelationPreviewCard key={`${relation.kind}-${"id" in relation ? relation.id : "ensemble"}`} relation={relation} navigation={navigation} />
          ))}
        </div>
      ),
    });
  }
  return (
    <article className={styles.entitySurface} data-entity-surface="moment">
      <EntityIdentityRegion identity={model.identity} profile="moment" typeLabel="Moment" mediaKind="moment">
        {model.narrative ? <p className={styles.narrative}>{model.narrative}</p> : null}
      </EntityIdentityRegion>
      <HeadlineMetrics metrics={metrics} />
      <EntitySections label="Sections du Moment" sections={sections} />
    </article>
  );
}

export function PlaceSurface({
  model,
  navigation,
}: {
  readonly model: EntityPlaceReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const metrics = [];
  if (model.headline.visitCount) metrics.push({ label: "Visites", metric: model.headline.visitCount });
  if (model.headline.distinctVisitDays) metrics.push({ label: "Jours visités", metric: model.headline.distinctVisitDays });
  if (model.headline.localizedSpend) metrics.push({ label: "Dépense localisée", metric: model.headline.localizedSpend });
  if (model.headline.accessCostEstimate) metrics.push({ label: "Accès estimé", metric: model.headline.accessCostEstimate });
  const merchantRefs: SemanticEntityRef[] = model.merchantPreview.items.map((item) => ({ kind: "merchant", id: item.merchantId, label: item.label }));
  const sections = [];
  if (hasCapabilitySection(model.capabilities, "activities")) {
    sections.push({ id: "activities", label: "Activités", content: <PreviewLabels labels={model.activityPreview.items.map((item) => item.label)} emptyTitle="Aucune activité exposée" /> });
  }
  if (hasCapabilitySection(model.capabilities, "merchants")) {
    sections.push({ id: "merchants", label: "Marchands", content: <RelatedRail title="Marchands liés" relations={merchantRefs} navigation={navigation} seeAll={{ kind: "gallery", gallery: "merchants", filters: { sort: "spend" } }} /> });
  }
  if (hasCapabilitySection(model.capabilities, "places")) {
    sections.push({
      id: "visits",
      label: "Visites",
      content: model.visitPreview.items.length === 0 ? <EmptyState title="Aucune visite exposée" /> : (
        <ul className={styles.factList}>{model.visitPreview.items.map((visit) => <li key={visit.visitKey}>{visit.localDate} · {visit.state}</li>)}</ul>
      ),
    });
  }
  return (
    <article className={styles.entitySurface} data-entity-surface="place">
      <EntityIdentityRegion identity={model.identity} profile="place" typeLabel="Lieu" mediaKind="place">
        <span className={styles.spatialState}>Géolocalisation : {model.spatial.state}</span>
      </EntityIdentityRegion>
      <HeadlineMetrics metrics={metrics} />
      <EntitySections label="Sections du lieu" sections={sections} />
    </article>
  );
}

export function MerchantSurface({
  model,
  navigation,
}: {
  readonly model: EntityMerchantReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const metrics = [];
  if (model.headline.economicAmount) metrics.push({ label: "Montant économique", metric: model.headline.economicAmount });
  if (model.headline.purchaseCount) metrics.push({ label: "Actes d’achat", metric: model.headline.purchaseCount });
  const sections = [];
  if (hasCapabilitySection(model.capabilities, "evolution") && model.evolution) {
    sections.push({
      id: "evolution",
      label: "Évolution",
      content: model.evolution.length === 0 ? <EmptyState title="Aucune évolution publiée" /> : (
        <ul className={styles.metricSeries}>{model.evolution.map((point) => <li key={point.period}><span>{point.period}</span><PublishedMetric metric={point.metric} /></li>)}</ul>
      ),
    });
  }
  if (hasCapabilitySection(model.capabilities, "places") && model.placePreview.state === "available") {
    const placeRefs: SemanticEntityRef[] = model.placePreview.value.items.map((item) => ({ kind: "place", id: item.placeId, label: item.label }));
    sections.push({ id: "places", label: "Lieux", content: <RelatedRail title="Lieux canoniques" relations={placeRefs} navigation={navigation} seeAll={{ kind: "gallery", gallery: "places", filters: { sort: "spend" } }} /> });
  }
  if (hasCapabilitySection(model.capabilities, "operations")) {
    sections.push({
      id: "operations",
      label: "Opérations",
      content: model.operationPreview.items.length === 0 ? <EmptyState title="Aucune opération exposée" /> : (
        <div className={styles.previewGrid}>{model.operationPreview.items.map((operation) => <OperationPreviewCard key={operation.operationId} operation={operation} navigation={navigation} />)}</div>
      ),
    });
  }
  return (
    <article className={styles.entitySurface} data-entity-surface="merchant">
      <EntityIdentityRegion identity={model.identity} profile="merchant" typeLabel="Marchand" mediaKind="merchant">
        <span className={styles.spatialState}>Canal spatial : {model.spatialMode}</span>
      </EntityIdentityRegion>
      <HeadlineMetrics metrics={metrics} />
      <EntitySections label="Sections du marchand" sections={sections} />
    </article>
  );
}

export function PersonaSurface({
  model,
  navigation,
}: {
  readonly model: EntityPersonaReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const placeRefs = model.placePreview.items.filter((ref): ref is Extract<SemanticEntityRef, { kind: "place" }> => ref.kind === "place");
  const merchantRefs = model.merchantPreview.items.filter((ref): ref is Extract<SemanticEntityRef, { kind: "merchant" }> => ref.kind === "merchant");
  const sections = [];
  if (hasCapabilitySection(model.capabilities, "activities")) {
    sections.push({ id: "activities", label: "Activités", content: <PreviewLabels labels={model.activityPreview.items.map((item) => item.label)} emptyTitle="Aucune activité exposée" /> });
  }
  if (hasCapabilitySection(model.capabilities, "places")) {
    sections.push({ id: "places", label: "Lieux", content: <RelatedRail title="Lieux" relations={placeRefs} navigation={navigation} seeAll={{ kind: "gallery", gallery: "places", filters: { sort: "frequent" } }} /> });
  }
  if (hasCapabilitySection(model.capabilities, "merchants")) {
    sections.push({ id: "merchants", label: "Marchands", content: <RelatedRail title="Marchands" relations={merchantRefs} navigation={navigation} seeAll={{ kind: "gallery", gallery: "merchants", filters: { sort: "spend" } }} /> });
  }
  return (
    <article className={styles.entitySurface} data-entity-surface="persona">
      <EntityIdentityRegion identity={model.identity} profile="persona" typeLabel="Persona analytique" mediaKind="persona" personaKind={model.target.kind} />
      <HeadlineMetrics metrics={model.headlineMetrics.map((metric) => ({ label: metric.metricId, metric }))} />
      {model.typicalPreview ? <SectionLayout title="Mois typique"><Surface variant="outlined"><span className={styles.metadata}>Coût typique</span><PublishedMetric metric={model.typicalPreview} /></Surface></SectionLayout> : null}
      <EntitySections label="Sections de la Persona" sections={sections} />
    </article>
  );
}

export function LifeEventSurface({
  model,
  navigation,
}: {
  readonly model: EntityLifeEventReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  const sections = [];
  if (hasCapabilitySection(model.capabilities, "participants")) {
    sections.push({
      id: "participants",
      label: "Participants",
      content: model.participantIds.length === 0 ? <EmptyState title="Aucun participant exposé" /> : (
        <div className={styles.previewGrid}>{model.participantIds.map((personId) => (
          <Surface key={personId} variant="subtle" action={{ kind: "callback", onAction: () => navigation.push({ kind: "persona", id: personId }) }}>Participant</Surface>
        ))}</div>
      ),
    });
  }
  if (hasCapabilitySection(model.capabilities, "places")) {
    sections.push({ id: "places", label: "Lieux", content: <RelatedRail title="Lieux" relations={model.places.items} navigation={navigation} seeAll={{ kind: "gallery", gallery: "places", filters: { sort: "recent" } }} /> });
  }
  if (hasCapabilitySection(model.capabilities, "timeline")) {
    sections.push({ id: "moments", label: "Moments", content: <RelatedRail title="Moments liés" relations={model.relatedMoments.items} navigation={navigation} seeAll={{ kind: "gallery", gallery: "moments", filters: { sort: "recent" } }} /> });
  }
  return (
    <article className={styles.entitySurface} data-entity-surface="life-event">
      <EntityIdentityRegion identity={model.identity} profile="life_event" typeLabel={model.type} mediaKind="life_event" authoritativeType={model.type}>
        <span className={styles.lifeEventDates}>{model.startsOn} → {model.endsOn}</span>
        {model.validationStatus === "Confirmé" ? <StatusBadge state="confirmed" /> : model.validationStatus === "Déduit" ? <StatusBadge state="deduced" /> : <StatusBadge state="pending" />}
      </EntityIdentityRegion>
      <SectionLayout title="Grain analytique"><p>Un LifeEventId canonique, y compris lorsque l’événement couvre plusieurs jours.</p></SectionLayout>
      <EntitySections label="Sections du Life Event" sections={sections} />
    </article>
  );
}
