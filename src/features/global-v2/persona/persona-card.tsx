import { BadgeCheck, BriefcaseBusiness, Clock3, Heart, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import { formatPersonaDate, type PersonaPortraitMarker, type PersonaPresentationBlock, type PersonaPresentationIcon, type PersonaPresentationMetric } from "./persona-presentation";
import styles from "../global-v2.module.css";

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const iconByPresentation: Readonly<Record<PersonaPresentationIcon, LucideIcon>> = Object.freeze({
  RHYTHM: Clock3,
  CREATIVE: WandSparkles,
  BEAUTY: Heart,
  DRIVING: BadgeCheck,
  MOBILITY: BriefcaseBusiness,
  DIGITAL: Sparkles,
});

function numericMetricValue(metric: PersonaPresentationMetric): number | undefined {
  const value = typeof metric.value === "number" ? metric.value : Number(metric.value);
  return Number.isFinite(value) ? value : undefined;
}

function formatPersonaMetric(metric: PersonaPresentationMetric): string {
  if (metric.format === "DATE") return formatPersonaDate(String(metric.value));
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

export function PersonaMarker({ marker }: { readonly marker: PersonaPortraitMarker }) {
  const Icon = iconByPresentation[marker.icon];
  return <li className={styles.personaMarker}><span aria-hidden="true"><Icon size={22} strokeWidth={1.65} /></span><strong>{marker.title}</strong></li>;
}

export function PersonaEditorialBlock({ block }: { readonly block: PersonaPresentationBlock }) {
  const Icon = iconByPresentation[block.icon];
  return <article className={styles.personaEditorialBlock} data-persona-renderer={block.renderer}>
    <header className={styles.personaEditorialHeader}>
      <span className={styles.personaEditorialIcon}><Icon aria-hidden="true" size={19} strokeWidth={1.7} /></span>
      <div>
        <div className={styles.personaEditorialTitle}><h4>{block.title}</h4>{block.statusLabel === undefined ? null : <strong>{block.statusLabel}</strong>}</div>
        <p>{block.description}</p>
      </div>
    </header>
    <PersonaMetrics metrics={block.metrics} />
    {block.examples.length === 0 ? null : <ul className={styles.personaExamples} aria-label="Pratiques renseignées">{block.examples.map((example) => <li key={example}>{example}</li>)}</ul>}
    {block.children.length === 0 ? null : <ul className={styles.personaChildren}>{block.children.map((child) => <li key={child.traitId}>
      <div><strong>{child.title}</strong>{child.statusLabel === undefined ? null : <span>{child.statusLabel}</span>}</div>
      <PersonaMetrics metrics={child.metrics} />
    </li>)}</ul>}
  </article>;
}
