"use client";

import type { AnalysisTargetReadModel } from "@/query-api";
import { EmptyState, SectionLayout, Surface } from "@/ui";
import type { ExplorationNavigation } from "./types";
import { PublishedMetric } from "./shared";
import styles from "./exploration.module.css";

function targetIdentity(target: AnalysisTargetReadModel["target"]): string {
  switch (target.kind) {
    case "family": return target.familyId;
    case "category": return target.categoryId;
    case "activity": return target.activityId;
    case "context": return target.context;
  }
}

function targetKind(target: AnalysisTargetReadModel["target"]): string {
  switch (target.kind) {
    case "family": return "Famille";
    case "category": return "Catégorie";
    case "activity": return "Activité";
    case "context": return "Contexte de vie";
  }
}

export function TargetedAnalysisSurface({
  model,
  navigation,
}: {
  readonly model: AnalysisTargetReadModel;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <article className={styles.analysisDestination} data-analysis-target={model.target.kind}>
      <header>
        <span className="eyebrow">Analyse ciblée · {targetKind(model.target)}</span>
        <h2 data-exploration-heading="" tabIndex={-1}>{targetIdentity(model.target)}</h2>
        <p>Le mois, le sujet et les filtres d’origine sont conservés.</p>
      </header>
      {model.status === "blocked_contract" ? (
        <Surface variant="subtle">Analyse Famille bloquée par contrat : aucune taxonomie financière Family n’est inventée.</Surface>
      ) : model.status === "unsupported" ? (
        <EmptyState title="Analyse ciblée non disponible" description="Cette famille ne possède pas encore de métrique canonique active." />
      ) : model.status === "outside_scope" ? (
        <EmptyState title="Cible hors du scope" description="La cible ne fait pas partie des filtres actifs." />
      ) : model.headlineMetrics.length === 0 ? (
        <EmptyState title="Aucune mesure publiable" />
      ) : (
        <SectionLayout title="Mesures disponibles">
          {model.headlineMetrics.map((metric) => (
            <Surface key={metric.metricId} variant="outlined">
              <PublishedMetric metric={metric} />
              <button type="button" className="button-ghost" onClick={() => navigation.push({ kind: "methodology", metricId: metric.metricId })}>
                Voir la méthode
              </button>
            </Surface>
          ))}
        </SectionLayout>
      )}
    </article>
  );
}
