"use client";

import { createContext, useContext, useId, useState } from "react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";
import styles from "./workshop-navigation.module.css";

export function intentionNavigationEntries(cards: readonly ComposerContextCardView[]) {
  const totals = new Map<string, number>(), seen = new Map<string, number>();
  for (const card of cards) totals.set(card.label, (totals.get(card.label) ?? 0) + 1);
  return cards.map(card => {
    const number = (seen.get(card.label) ?? 0) + 1;
    seen.set(card.label, number);
    const day = card.fields.plannedDate;
    const date = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(day) ? new Date(`${day}T12:00:00Z`) : null;
    const caption = date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
      ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(date) : "Date à préciser";
    return { id: card.contextOccurrenceId, label: card.label + (totals.get(card.label)! > 1 ? " · " + number : "") + " · " + caption };
  });
}

type Navigation = {
  entries: ReturnType<typeof intentionNavigationEntries>;
  parents?: ReadonlyMap<string, string>;
  open(id: string): void;
  back(id: string): void;
  busy: boolean;
};
export const WorkshopNavigationContext = createContext<Navigation | null>(null);

/** Presentation grouping only; the option value remains the occurrence identity. */
export function intentionNavigationGroups(entries: Navigation["entries"], parents: Navigation["parents"], query = "") {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const roots = new Map<string, string>();
  for (const entry of entries) {
    let current = entry.id;
    const seen = new Set([current]);
    while (parents?.has(current)) {
      const parent = parents.get(current)!;
      if (!byId.has(parent) || seen.has(parent)) break;
      seen.add(parent); current = parent;
    }
    roots.set(entry.id, current);
  }
  const projectIds = new Set([...roots].filter(([id, root]) => id !== root).map(([, root]) => root));
  const words = normalizeLibrarySearch(query).split(" ").filter(Boolean);
  const groups = new Map<string, { key: string; label: string; entries: Navigation["entries"] }>();
  for (const entry of entries) {
    const root = roots.get(entry.id)!;
    const search = normalizeLibrarySearch(`${entry.label} ${byId.get(root)?.label ?? ""}`);
    if (!words.every(word => search.includes(word))) continue;
    const key = projectIds.has(root) ? root : "ungrouped";
    let group = groups.get(key);
    if (!group) { group = { key, label: key === "ungrouped" ? "Intentions sans projet" : byId.get(root)!.label, entries: [] }; groups.set(key, group); }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

export function IntentionSwitcher({ contextId, compact = false }: { contextId?: string | null; compact?: boolean }) {
  const navigation = useContext(WorkshopNavigationContext);
  const id = useId(), [query, setQuery] = useState("");
  if (!navigation?.entries.length) return null;
  const filtering = navigation.entries.length > 8;
  const groups = intentionNavigationGroups(navigation.entries, navigation.parents, filtering ? query : "");
  const selected = navigation.entries.find(entry => entry.id === contextId);
  const selectedMissing = selected && !groups.some(group => group.entries.some(entry => entry.id === selected.id));
  return <div className={styles.switcher}>
    <label htmlFor={id}>{compact ? "Mes intentions" : "Intention en cours"}</label>
    {filtering && <input aria-label="Filtrer mes intentions" placeholder="Rechercher une intention ou un projet" value={query}
      onChange={event => setQuery(event.target.value)} type="search" />}
    <select id={id} aria-label={compact ? "Retrouver une intention du mois" : "Changer d’intention"}
      disabled={navigation.busy} value={contextId && navigation.entries.some(entry => entry.id === contextId) ? contextId : ""}
      onChange={event => { if (event.target.value) navigation.open(event.target.value); }}>
      <option value="" disabled>Choisir une intention</option>
      {selectedMissing && <optgroup label="Intention en cours"><option value={selected.id}>{selected.label}</option></optgroup>}
      {groups.map(group => <optgroup key={group.key} label={group.label}>
        {group.entries.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </optgroup>)}
    </select>
    {filtering && query.trim() && !groups.length && <small role="status">Aucune intention ne correspond à cette recherche.</small>}
  </div>;
}

export function WorkshopNavigation({ contextId }: { contextId: string }) {
  const navigation = useContext(WorkshopNavigationContext);
  if (!navigation) return null;
  const parent = navigation.parents?.get(contextId);
  return <nav className={styles.navigation} aria-label="Navigation de cette intention" data-workshop-navigation>
    <button type="button" disabled={navigation.busy} onClick={() => parent ? navigation.open(parent) : navigation.back(contextId)}>
      {parent ? "← Revenir au projet" : "← Mes intentions"}
    </button>
    <IntentionSwitcher contextId={contextId} />
  </nav>;
}
