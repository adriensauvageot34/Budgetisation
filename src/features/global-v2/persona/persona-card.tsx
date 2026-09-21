import type { PersonaPresentationCard, PersonaPresentationMetric } from "./persona-presentation";
import styles from "../global-v2.module.css";

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const kindLabels: Readonly<Record<PersonaPresentationCard["kind"], string>> = Object.freeze({
  ROUTINE: "Routine",
  HABIT: "Habitude",
  UNIVERSE: "Univers",
  PROJECT: "Projet",
  MOBILITY: "Mobilité",
  HOUSEHOLD_ORGANIZATION: "Organisation",
});

function numericMetricValue(metric: PersonaPresentationMetric): number | undefined {
  const value = typeof metric.value === "number" ? metric.value : Number(metric.value);
  return Number.isFinite(value) ? value : undefined;
}

function formatPersonaMetric(metric: PersonaPresentationMetric): string {
  if (metric.format === "DATE") return String(metric.value);
  const value = numericMetricValue(metric);
  if (value === undefined) return String(metric.value);
  if (metric.format === "MONEY_EUR") return moneyFormatter.format(value);
  if (metric.format === "DAYS") return `${numberFormatter.format(value)} jours`;
  if (metric.format === "DISTANCE_KM") return `${numberFormatter.format(value)} km`;
  return numberFormatter.format(value);
}

function PersonaMetrics({ metrics }: { readonly metrics: readonly PersonaPresentationMetric[] }) {
  if (metrics.length === 0) return null;
  return <dl className={styles.personaMetrics}>{metrics.map((metric) => <div key={metric.metricKey}><dt>{metric.label}</dt><dd>{formatPersonaMetric(metric)}</dd></div>)}</dl>;
}

export function PersonaCard({ card }: { readonly card: PersonaPresentationCard }) {
  return <article className={styles.personaCard} data-persona-kind={card.kind}>
    <header className={styles.personaCardHeader}>
      <span>{kindLabels[card.kind]}</span>
      <div><h4>{card.title}</h4>{card.statusLabel === undefined ? null : <strong>{card.statusLabel}</strong>}</div>
      <p>{card.description}</p>
    </header>
    <PersonaMetrics metrics={card.metrics} />
    {card.examples.length === 0 ? null : <ul className={styles.personaExamples} aria-label="Exemples">{card.examples.map((example) => <li key={example}>{example}</li>)}</ul>}
    {card.children.length === 0 ? null : <ul className={styles.personaChildren}>{card.children.map((child) => <li key={child.traitId}><div><strong>{child.title}</strong>{child.statusLabel === undefined ? null : <span>{child.statusLabel}</span>}</div><PersonaMetrics metrics={child.metrics} /></li>)}</ul>}
  </article>;
}
