"use client";

import type { MetricMethodologyReadModel } from "@/query-api";
import { SectionLayout, Surface } from "@/ui";
import type { ExplorationNavigation } from "./types";
import styles from "./exploration.module.css";

function contractValue(value: unknown): string {
  if (value === null || value === undefined) return "Non applicable";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(contractValue).join(" · ");
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}: ${contractValue(item)}`).join(" · ");
  }
  return "Non exposé";
}

function MethodFact({ label, value }: { readonly label: string; readonly value: unknown }) {
  return (
    <Surface variant="subtle" className={styles.methodFact}>
      <dt>{label}</dt>
      <dd>{contractValue(value)}</dd>
    </Surface>
  );
}

export function MethodologySurface({
  model,
}: {
  readonly model: MetricMethodologyReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <article className={styles.methodologySurface} data-methodology-metric-id={model.metricId}>
      <header className={styles.methodologyHeader}>
        <span className={styles.eyebrow}>Méthodologie publiée</span>
        <h2 data-exploration-heading="" tabIndex={-1}>{model.userName}</h2>
        <p>{model.description}</p>
      </header>
      <SectionLayout title="Définition">
        <dl className={styles.methodGrid}>
          <MethodFact label="MetricId" value={model.metricId} />
          <MethodFact label="MethodVersion" value={model.methodVersion} />
          <MethodFact label="As of" value={model.asOf} />
          <MethodFact label="Grain" value={model.grain} />
          <MethodFact label="Fait source" value={model.sourceFact} />
          <MethodFact label="Base de date" value={model.dateBasis} />
          <MethodFact label="Formule expliquée" value={model.formulaDescription} />
        </dl>
      </SectionLayout>
      <SectionLayout title="Référence et support">
        <dl className={styles.methodGrid}>
          <MethodFact label="Référence" value={model.reference} />
          <MethodFact label="Support" value={model.support} />
          <MethodFact label="Provenance" value={model.provenanceRule} />
          <MethodFact label="Additivité" value={model.additivity} />
          <MethodFact label="Dimensions compatibles" value={model.compatibleDimensions} />
        </dl>
      </SectionLayout>
    </article>
  );
}
