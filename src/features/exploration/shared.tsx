"use client";

import type { ReactNode } from "react";
import type { MetricId } from "@/core/identity";
import type { ExplorationNode } from "@/navigation";
import {
  querySectionKeys,
  type EntityIdentity,
  type QueryCapabilities,
  type QuerySectionName,
  type ScopedCountMetricReadModel,
  type ScopedMetricReadModel,
  type SemanticEntityRef,
} from "@/query-api";
import {
  Button,
  ContentRail,
  EmptyState,
  MediaSurface,
  MetricDisplay,
  SectionLayout,
  Surface,
  Tabs,
  TabPanel,
  resolveMediaFallback,
} from "@/ui";
import { useId, useState } from "react";
import type { ExplorationNavigation } from "./types";
import styles from "./exploration.module.css";

export function hasCapabilitySection(
  capabilities: QueryCapabilities,
  section: QuerySectionName,
): boolean {
  const key = querySectionKeys[section];
  return capabilities.availableSections.some((candidate) => candidate === key);
}

export function semanticRefToNode(ref: SemanticEntityRef): ExplorationNode {
  switch (ref.kind) {
    case "moment":
      return { kind: "moment", id: ref.id };
    case "place":
      return { kind: "place", id: ref.id };
    case "merchant":
      return { kind: "merchant", id: ref.id };
    case "life_event":
      return { kind: "life_event", id: ref.id };
    case "operation":
      return { kind: "operation", id: ref.id };
    case "person":
      return { kind: "persona", id: ref.id };
    case "ensemble":
      return { kind: "persona", id: "ensemble" };
    case "methodology":
      return { kind: "methodology", metricId: ref.id };
  }
}

function isCountMetric(metric: ScopedMetricReadModel): metric is ScopedCountMetricReadModel {
  return metric.envelope.unit === "count" || metric.envelope.unit === "count/month";
}

export function PublishedMetric({ metric }: { readonly metric: ScopedMetricReadModel }) {
  if (isCountMetric(metric)) {
    return <MetricDisplay metric={metric.envelope} variant="compact" />;
  }
  return <MetricDisplay metric={metric.envelope} variant="compact" />;
}

export function EntityIdentityRegion({
  identity,
  profile,
  typeLabel,
  mediaKind,
  personaKind,
  authoritativeType,
  children,
}: {
  readonly identity: EntityIdentity;
  readonly profile: "moment" | "place" | "merchant" | "persona" | "life_event";
  readonly typeLabel: string;
  readonly mediaKind: "moment" | "place" | "merchant" | "persona" | "life_event";
  readonly personaKind?: "person" | "ensemble";
  readonly authoritativeType?: string;
  readonly children?: ReactNode;
}) {
  const fallback = resolveMediaFallback({
    kind: mediaKind,
    reason: "absent",
    label: identity.title,
    ...(personaKind ? { personaKind } : {}),
    ...(authoritativeType ? { authoritativeType } : {}),
  });
  return (
    <header className={styles.identity} data-entity-profile={profile}>
      <MediaSurface
        className={styles.identityMedia}
        state={{
          kind: "fallback",
          geometry: { aspectRatio: profile === "moment" ? 16 / 9 : 1 },
          role: profile === "merchant" ? "logo" : "illustration",
          fallback,
        }}
      />
      <div className={styles.identityCopy}>
        <span className={styles.eyebrow}>{typeLabel}</span>
        <h2 data-exploration-heading="" tabIndex={-1}>{identity.title}</h2>
        {identity.subtitle ? <p>{identity.subtitle}</p> : null}
        {identity.status ? <span className={styles.identityStatus}>{identity.status}</span> : null}
        {children}
      </div>
    </header>
  );
}

export type EntitySection = {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
};

export function EntitySections({
  label,
  sections,
}: {
  readonly label: string;
  readonly sections: readonly EntitySection[];
}) {
  const generatedId = useId();
  const groupId = `exploration-sections-${generatedId}`;
  const [selected, setSelected] = useState(sections[0]?.id ?? "");
  if (sections.length === 0) return null;
  if (sections.length === 1) {
    const section = sections[0]!;
    return <SectionLayout title={section.label}>{section.content}</SectionLayout>;
  }
  const current = sections.some((section) => section.id === selected)
    ? selected
    : sections[0]!.id;
  return (
    <div className={styles.tabbedSections}>
      <Tabs
        id={groupId}
        label={label}
        value={current}
        tabs={sections.map((section) => ({ value: section.id, label: section.label }))}
        onChange={setSelected}
      />
      {sections.map((section) => (
        <TabPanel key={section.id} groupId={groupId} value={section.id} active={section.id === current}>
          {section.content}
        </TabPanel>
      ))}
    </div>
  );
}

export function RelationPreviewCard({
  relation,
  navigation,
}: {
  readonly relation: SemanticEntityRef;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <Surface
      variant="outlined"
      className={styles.previewCard}
      action={{ kind: "callback", onAction: () => navigation.push(semanticRefToNode(relation)) }}
      ariaLabel={`Explorer ${relation.label ?? relation.kind}`}
    >
      <span className={styles.eyebrow}>{relation.kind}</span>
      <strong>{relation.label ?? "Entité liée"}</strong>
    </Surface>
  );
}

export function RelatedRail({
  title,
  relations,
  navigation,
  applicable = true,
  seeAll,
}: {
  readonly title: string;
  readonly relations: readonly SemanticEntityRef[];
  readonly navigation: ExplorationNavigation;
  readonly applicable?: boolean;
  readonly seeAll?: Extract<ExplorationNode, { readonly kind: "gallery" }>;
}) {
  if (!applicable) return null;
  if (relations.length === 0) {
    return <SectionLayout title={title}><EmptyState title={`Aucun élément — ${title}`} /></SectionLayout>;
  }
  return (
    <SectionLayout
      title={title}
      actions={seeAll ? (
        <Button tone="quiet" size="sm" action={{ kind: "callback", onAction: () => navigation.push(seeAll) }}>
          Voir tout
        </Button>
      ) : undefined}
    >
      <ContentRail
        label={title}
        mode="rail"
        items={relations.map((relation) => ({
          key: `${relation.kind}-${"id" in relation ? relation.id : "ensemble"}`,
          content: <RelationPreviewCard relation={relation} navigation={navigation} />,
        }))}
      />
    </SectionLayout>
  );
}

export function MethodologyTrigger({
  metricId,
  navigation,
}: {
  readonly metricId?: MetricId;
  readonly navigation: ExplorationNavigation;
}) {
  if (metricId === undefined) return null;
  return (
    <Button
      tone="quiet"
      size="sm"
      action={{ kind: "callback", onAction: () => navigation.push({ kind: "methodology", metricId }) }}
    >
      Méthodologie
    </Button>
  );
}
