"use client";

import { useState } from "react";
import type { GlobalV2PersonaPanelModel } from "@/query-api/global-v2/persona-panel";
import { PersonaEditorialBlock } from "./persona-card";
import { editorialTopics, PersonaEditorialView } from "./persona-editorial-view";
import styles from "../global-atomic.module.css";

export default function AtomicPersona({ model, person }: { readonly model: GlobalV2PersonaPanelModel; readonly person?: "adrien" | "manon" }) {
  const [topic, setTopic] = useState<"personal" | typeof editorialTopics[number]["key"]>("personal");
  const profiles = person === undefined ? model.persona.profiles : model.persona.profiles.filter(({ name }) => name.toLocaleLowerCase("fr-FR") === person);
  const editorial = model.personaEditorial;

  return <>
    {editorial && <label className={styles.profileTopic}>Informations du profil <select value={topic} onChange={(event) => setTopic(event.currentTarget.value as typeof topic)}>
      <option value="personal">Repères et projets individuels</option>
      {editorialTopics.filter(({ key }) => key !== "portraits" || person === undefined).map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    {editorial && topic !== "personal" ? <PersonaEditorialView model={editorial} direct={model.persona} headingId="global-profile-editorial" topic={topic} /> :
      profiles.length === 0 ? <p className={styles.note}>Aucune donnée publiée pour ce profil.</p> :
        profiles.map((profile) => {
          const blocks = [...profile.daily, ...profile.recurring, ...profile.phases];
          return <section className={styles.profileDetails} key={profile.personId}>
            {person === undefined && <h4>{profile.name}</h4>}
            {blocks.length > 0 ? blocks.map((block) => <PersonaEditorialBlock key={block.key} block={block} />) : <p className={styles.note}>Aucune donnée publiée pour ce profil.</p>}
          </section>;
        })}
  </>;
}
