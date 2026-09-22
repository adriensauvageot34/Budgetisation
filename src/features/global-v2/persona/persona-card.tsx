import { BriefcaseBusiness, Heart, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import type { PersonaDirectBlock, PersonaDirectFact } from "@/query-api/global-v2/persona-direct-presentation";
import styles from "../global-v2.module.css";

const icons: Readonly<Record<string, LucideIcon>> = {
  "work-mobility": BriefcaseBusiness, meal: BriefcaseBusiness, social: Heart,
  beauty: Heart, vape: Sparkles, services: Sparkles, creative: WandSparkles, permit: WandSparkles,
};

function Facts({ facts }: { readonly facts: readonly PersonaDirectFact[] }) {
  return facts.length === 0 ? null : <dl className={styles.personaMetrics}>{facts.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl>;
}

export function PersonaEditorialBlock({ block }: { readonly block: PersonaDirectBlock }) {
  const Icon = icons[block.key] ?? Sparkles;
  return <article className={styles.personaEditorialBlock} data-persona-renderer={block.key}>
    <header className={styles.personaEditorialHeader}>
      <span className={styles.personaEditorialIcon}><Icon aria-hidden="true" size={19} strokeWidth={1.7} /></span>
      <div><div className={styles.personaEditorialTitle}><h4>{block.title}</h4></div>{block.description === undefined ? null : <p>{block.description}</p>}</div>
    </header>
    <Facts facts={block.facts} />
    {block.items.length === 0 ? null : <ul className={styles.personaChildren}>{block.items.map((item) => <li key={item.title}>
      <div><strong>{item.title}</strong></div><Facts facts={item.facts} />
    </li>)}</ul>}
  </article>;
}
