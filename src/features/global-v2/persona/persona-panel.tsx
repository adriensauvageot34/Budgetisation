"use client";

import { useState, type ReactNode } from "react";
import type { GlobalV2PersonaPanelModel } from "@/query-api/global-v2/persona-panel";
import { PersonaView } from "./persona-view";
import { editorialTopics, PersonaEditorialView } from "./persona-editorial-view";
import styles from "../global-v2.module.css";

export default function PersonaPanel({ model, placeholder }: {
  readonly model: GlobalV2PersonaPanelModel | undefined;
  readonly placeholder: ReactNode;
}) {
  const [topic, setTopic] = useState<typeof editorialTopics[number]["key"]>("portraits");
  if (model === undefined) return placeholder;
  const { persona, personaEditorial } = model;
  if (personaEditorial === undefined) return <PersonaView model={persona} headingId="profils-title" />;
  return <>
    <nav className={styles.workspaceChoices} aria-label="Thèmes des profils">
      {editorialTopics.map(({ key, label }) => <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}>{label}</button>)}
    </nav>
    <PersonaEditorialView model={personaEditorial} direct={persona} headingId="profils-title" topic={topic} />
  </>;
}
