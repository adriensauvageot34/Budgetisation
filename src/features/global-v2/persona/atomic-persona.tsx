"use client";

import { useState } from "react";
import type { PersonaDirectProfile } from "@/query-api/global-v2/persona-direct-presentation";
import type { GlobalV2PersonaPanelModel } from "@/query-api/global-v2/persona-panel";
import { PersonaEditorialBlock } from "./persona-card";
import { editorialTopics, PersonaEditorialView, PersonaVehicleModule } from "./persona-editorial-view";
import styles from "../global-atomic.module.css";

function ProfileSummary({ profiles }: { readonly profiles: readonly PersonaDirectProfile[] }) {
  const [selection, setSelection] = useState<string>();
  const entries = profiles.map((profile) => ({
    profile,
    blocks: [...profile.daily, ...profile.recurring, ...profile.phases],
  }));
  const current = entries.flatMap(({ profile, blocks }) => blocks.map((block) => ({ profile, block })))
    .find(({ profile, block }) => `${profile.personId}:${block.key}` === selection);

  return <div className={styles.profileOverview} data-profile-overview data-profile-open={current ? "" : undefined}>
    <div className={styles.profileSummaries}>
      {entries.map(({ profile, blocks }) => <section key={profile.personId} className={styles.profileSummary}>
        {profiles.length > 1 && <h4>{profile.name}</h4>}
        {blocks.length === 0 ? <p className={styles.note}>Aucune donnée publiée pour ce profil.</p> :
          <ul>
            {blocks.map((block) => {
              const id = `${profile.personId}:${block.key}`;
              const fact = block.facts[0] ?? block.items[0]?.facts[0];
              return <li key={id}>
                <button type="button" aria-pressed={selection === id} aria-controls={selection === id ? "global-profile-block" : undefined}
                  onClick={() => setSelection(selection === id ? undefined : id)}>
                  <strong>{block.title}</strong>
                  {current === undefined && <small>{fact ? `${fact.value} · ${fact.label}` : block.items[0]?.title}</small>}
                </button>
              </li>;
            })}
          </ul>}
      </section>)}
    </div>
    {current && <div id="global-profile-block"><PersonaEditorialBlock block={current.block} /></div>}
  </div>;
}

export default function AtomicPersona({ model, person, vehicle = false }: { readonly model: GlobalV2PersonaPanelModel; readonly person?: "adrien" | "manon"; readonly vehicle?: boolean }) {
  const [topic, setTopic] = useState<"personal" | typeof editorialTopics[number]["key"]>("personal");
  const profiles = person === undefined ? model.persona.profiles : model.persona.profiles.filter(({ name }) => name.toLocaleLowerCase("fr-FR") === person);
  const editorial = model.personaEditorial;
  if (vehicle) {
    return editorial === undefined ? <p className={styles.note}>Bilan de la voiture indisponible pour cette période.</p>
      : <PersonaVehicleModule vehicle={editorial.vehicle} />;
  }

  return <>
    {editorial && <label className={styles.profileTopic}>Informations du profil <select value={topic} onChange={(event) => setTopic(event.currentTarget.value as typeof topic)}>
      <option value="personal">Repères et projets individuels</option>
      {editorialTopics.filter(({ key }) => key !== "portraits" || person === undefined).map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    {editorial && topic !== "personal" ? <PersonaEditorialView model={editorial} direct={model.persona} headingId="global-profile-editorial" topic={topic} /> :
      profiles.length === 0 ? <p className={styles.note}>Aucune donnée publiée pour ce profil.</p> :
        <ProfileSummary profiles={profiles} />}
  </>;
}
