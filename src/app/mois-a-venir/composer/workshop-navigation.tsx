"use client";

import { createContext, useContext } from "react";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import styles from "./workshop-navigation.module.css";

export function intentionNavigationEntries(cards: readonly ComposerContextCardView[]) {
  const totals = new Map<string, number>(), seen = new Map<string, number>();
  for (const card of cards) totals.set(card.label, (totals.get(card.label) ?? 0) + 1);
  return cards.map(card => {
    const number = (seen.get(card.label) ?? 0) + 1;
    seen.set(card.label, number);
    const date = typeof card.fields.plannedDate === "string" ? card.fields.plannedDate : null;
    const caption = date ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(date + "T12:00:00Z")) : "Date à préciser";
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

export function IntentionSwitcher({ contextId, compact = false }: { contextId?: string | null; compact?: boolean }) {
  const navigation = useContext(WorkshopNavigationContext);
  if (!navigation?.entries.length) return null;
  return <label className={styles.switcher}>
    <span>{compact ? "Mes intentions" : "Intention en cours"}</span>
    <select aria-label={compact ? "Retrouver une intention du mois" : "Changer d’intention"}
      disabled={navigation.busy} value={contextId && navigation.entries.some(entry => entry.id === contextId) ? contextId : ""}
      onChange={event => { if (event.target.value) navigation.open(event.target.value); }}>
      <option value="" disabled>Choisir une intention</option>
      {navigation.entries.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
  </label>;
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
