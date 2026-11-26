"use client";

import { useState } from "react";
import type { PersonaDirectBlock, PersonaDirectFact, PersonaDirectProfile } from "@/query-api/global-v2/persona-direct-presentation";
import type { PersonaEditorialModel } from "@/query-api/global-v2/persona-editorial";
import type { GlobalV2PersonaPanelModel } from "@/query-api/global-v2/persona-panel";
import { GlobalClayIcon, type GlobalClayIconName } from "../global-clay-icon";
import { PersonaVehicleModule } from "./persona-editorial-view";
import { profileBlocks } from "./profile-content";
import styles from "../global-atomic.module.css";

const icons: Readonly<Record<string, GlobalClayIconName>> = {
  "work-mobility": "travel", meal: "restaurant", social: "family", outings: "night",
  services: "home", beauty: "health", grooming: "health", vape: "categories",
  tobacco: "categories", creative: "photo", permit: "car", suno: "concert",
};

function ProfileFacts({ facts }: { readonly facts: readonly PersonaDirectFact[] }) {
  return facts.length > 0 && <dl className={styles.profileFacts}>
    {facts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

function ProfileTopicDetail({ block }: { readonly block: PersonaDirectBlock }) {
  return <article className={styles.profileTopicDetail}>
    <h4>{block.title}</h4>
    {block.description && <p className={styles.note}>{block.description}</p>}
    <ProfileFacts facts={block.facts} />
    {block.items.length > 0 && <ul className={styles.profileItems}>
      {block.items.map(({ title, facts }, index) => <li key={`${title}:${index}`}>
        <strong>{title}</strong>
        <ProfileFacts facts={facts} />
      </li>)}
    </ul>}
  </article>;
}

function ProfileSummary({ profiles, editorial }: { readonly profiles: readonly PersonaDirectProfile[]; readonly editorial?: PersonaEditorialModel }) {
  const [selection, setSelection] = useState<string>();
  const entries = profiles.map((profile) => ({ profile, blocks: profileBlocks(profile, editorial) }));
  const current = entries.flatMap(({ profile, blocks }) => blocks.map((block) => ({ profile, block })))
    .find(({ profile, block }) => `${profile.personId}:${block.key}` === selection);

  return <div className={styles.profileOverview} data-profile-overview data-profile-open={current ? "" : undefined}>
    <div className={styles.profileSummaries}>
      {entries.map(({ profile, blocks }) => <section key={profile.personId} className={styles.profileSummary} data-profile-name={profile.name}>
        {profiles.length > 1 && <h4>{profile.name}</h4>}
        {blocks.length === 0 ? <p className={styles.note}>Aucune donnée publiée pour ce profil.</p> :
          <ul>
            {blocks.map((block) => {
              const id = `${profile.personId}:${block.key}`;
              const firstItem = block.items[0];
              const fact = block.facts[0] ?? firstItem?.facts[0];
              const nextFact = block.facts[1];
              const supportingText = block.facts.length > 0
                ? firstItem?.title ?? (nextFact && `${nextFact.value} · ${nextFact.label}`)
                : (fact ? block.items[1]?.title : block.items.slice(0, 2).map(({ title }) => title).join(" · "));
              return <li key={id}>
                <button type="button" aria-pressed={selection === id} aria-controls={selection === id ? "global-profile-block" : undefined}
                  onClick={() => setSelection(selection === id ? undefined : id)}>
                  <GlobalClayIcon name={icons[block.key] ?? "activity"} size={26} className={styles.profileBlockIcon} />
                  <strong>{block.title}</strong>
                  {current === undefined && fact && <span className={styles.profileMeasure}><b>{fact.value}</b><small>{block.facts.length ? fact.label : firstItem?.title}</small></span>}
                  {current === undefined && supportingText && <small className={styles.profileSupportingText}>{supportingText}</small>}
                </button>
              </li>;
            })}
          </ul>}
      </section>)}
    </div>
    {current && <div key={selection} id="global-profile-block" className={styles.profileExpanded}>
      {profiles.length > 1 && <strong className={styles.profileOwner}>{current.profile.name}</strong>}
      <ProfileTopicDetail block={current.block} />
    </div>}
  </div>;
}

export default function AtomicPersona({ model, person, vehicle = false }: { readonly model: GlobalV2PersonaPanelModel; readonly person?: "adrien" | "manon"; readonly vehicle?: boolean }) {
  const profiles = person === undefined ? model.persona.profiles : model.persona.profiles.filter(({ name }) => name.toLocaleLowerCase("fr-FR") === person);
  const editorial = model.personaEditorial;
  if (vehicle) {
    return editorial === undefined ? <p className={styles.note}>Bilan de la voiture indisponible pour cette période.</p>
      : <PersonaVehicleModule vehicle={editorial.vehicle} />;
  }

  return profiles.length === 0 ? <p className={styles.note}>Aucune donnée publiée pour ce profil.</p>
    : <ProfileSummary profiles={profiles} editorial={editorial} />;
}
