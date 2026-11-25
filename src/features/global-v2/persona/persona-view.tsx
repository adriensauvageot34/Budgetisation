"use client";

import { useState } from "react";
import type { PersonaDirectBlock, PersonaDirectModel, PersonaDirectProfile } from "@/query-api/global-v2/persona-direct-presentation";
import { PersonaEditorialBlock } from "./persona-card";
import styles from "../global-v2.module.css";

type Collection = "daily" | "recurring" | "phases";
const sections: readonly { readonly collection: Collection; readonly title: string }[] = [
  { collection: "daily", title: "Vos rythmes du quotidien" },
  { collection: "recurring", title: "Ce qui revient chez chacun" },
  { collection: "phases", title: "Ce qui vit par phases" },
];

function PortraitSection({ profile, collection, title }: { readonly profile: PersonaDirectProfile; readonly collection: Collection; readonly title: string }) {
  const blocks: readonly PersonaDirectBlock[] = profile[collection];
  if (blocks.length === 0) return null;
  const id = `persona-${profile.personId}-${collection}`;
  return <section className={styles.personaEditorialSection} aria-labelledby={id} data-persona-section={collection}>
    <header className={styles.personaSectionHeading}><h3 id={id}>{title}</h3></header>
    <div className={styles.personaEditorialBlocks}>{blocks.map((block) => <PersonaEditorialBlock key={block.key} block={block} />)}</div>
  </section>;
}

export function PersonaView({ model, headingId }: { readonly model: PersonaDirectModel; readonly headingId: string }) {
  const profiles = model.profiles.slice(0, 2);
  const [activePersonId, setActivePersonId] = useState<string | undefined>(profiles[0]?.personId);
  const [activeCollection, setActiveCollection] = useState<Collection>("daily");
  const activeSection = sections.find(({ collection }) => collection === activeCollection)!;
  return <div className={styles.personaView}>
    <header className={styles.personaModuleHeader}>
      <h2 id={headingId}>Nos profils</h2>
    </header>
    <nav className={styles.workspaceChoices} aria-label="Thèmes des profils">
      {sections.map(({ collection, title }) => <button key={collection} type="button" aria-pressed={activeCollection === collection} onClick={() => setActiveCollection(collection)}>{title}</button>)}
    </nav>
    <nav className={styles.personaMobileSwitch} aria-label="Personne affichée sur mobile">
      {profiles.map((profile) => <button key={profile.personId} type="button" aria-pressed={activePersonId === profile.personId} onClick={() => setActivePersonId(profile.personId)}>{profile.name}</button>)}
    </nav>
    <section className={`${styles.personaEditorialColumns} ${styles.personaProfileColumns}`} aria-label="Portraits personnels en parallèle" data-column-count={profiles.length}>
      {profiles.map((profile, index) => <article key={profile.personId} className={styles.personaProfileColumn} data-persona-column={index + 1} data-mobile-active={activePersonId === profile.personId} aria-labelledby={`persona-portrait-${index + 1}`}>
        <header className={styles.personaPersonHeader}><h2 id={`persona-portrait-${index + 1}`}>{profile.name}</h2></header>
        <PortraitSection key={activeCollection} profile={profile} {...activeSection} />
      </article>)}
    </section>
  </div>;
}
