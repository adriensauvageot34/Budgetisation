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
  return <div className={styles.personaView}>
    <header className={styles.personaModuleHeader}>
      <div><span className="eyebrow">Portraits personnels</span><h2 id={headingId}>Nos profils</h2><p className={styles.personaHeroLead}>Deux quotidiens, deux façons de dépenser.</p></div>
    </header>
    <nav className={styles.personaMobileSwitch} aria-label="Personne affichée sur mobile">
      {profiles.map((profile) => <button key={profile.personId} type="button" aria-pressed={activePersonId === profile.personId} onClick={() => setActivePersonId(profile.personId)}>{profile.name}</button>)}
    </nav>
    <section className={`${styles.personaEditorialColumns} ${styles.personaProfileColumns}`} aria-label="Portraits personnels en parallèle" data-column-count={profiles.length}>
      {profiles.map((profile, index) => <article key={profile.personId} className={styles.personaProfileColumn} data-persona-column={index + 1} data-mobile-active={activePersonId === profile.personId} aria-labelledby={`persona-portrait-${index + 1}`}>
        <header className={styles.personaPersonHeader}><h2 id={`persona-portrait-${index + 1}`}>{profile.name}</h2></header>
        {sections.map((section) => <PortraitSection key={section.collection} profile={profile} {...section} />)}
      </article>)}
    </section>
  </div>;
}
