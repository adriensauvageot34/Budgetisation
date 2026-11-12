import { useRef } from "react";
import styles from "./composer.module.css";

export type SuggestionDismissal = {
  dismissedSuggestions?: readonly string[];
  updateSuggestionDismissal?: (occurrenceId: string, key: string | null) => void;
};

export function SuggestionControls({ occurrenceId, choices, dismissedSuggestions = [], updateSuggestionDismissal, busy }: SuggestionDismissal & {
  occurrenceId: string;
  choices: readonly { key: string; label: string }[];
  busy: boolean;
}) {
  const summary = useRef<HTMLElement>(null);
  if (!updateSuggestionDismissal || !choices.length && !dismissedSuggestions.length) return null;
  return <details className={styles.suggestionControls}>
    <summary ref={summary}>Gérer les suggestions</summary>
    <p>Masquées pour cette intention jusqu’au rechargement.</p>
    {choices.map(choice => <button key={choice.key} type="button" disabled={busy}
      onClick={() => { summary.current?.focus(); updateSuggestionDismissal(occurrenceId, choice.key); }}>Masquer · {choice.label}</button>)}
    {dismissedSuggestions.length > 0 && <button type="button" disabled={busy}
      onClick={() => { summary.current?.focus(); updateSuggestionDismissal(occurrenceId, null); }}>Réafficher les suggestions masquées</button>}
  </details>;
}
