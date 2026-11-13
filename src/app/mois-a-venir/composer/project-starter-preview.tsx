"use client";

import { useEffect, useRef, useState } from "react";
import { composerPreset, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { projectPresetAvailable, type ProjectStarter, type ProjectStarterChoices } from "./project-starters";
import { PresetIllustration } from "./preset-illustration";
import { libraryOccurrences } from "@/domain/phase2/planner/composer-library-index";
import styles from "./composer.module.css";

/** Only the confirmed proposal reaches the Shell's atomic evaluator. */
export function ProjectStarterPreview({ starter, model, busy, error, blockedReason, create, close, openExisting }: {
  starter: ProjectStarter; model: ComposerUiModel; busy: boolean;
  error?: string | null;
  blockedReason?: string | null;
  create(choices: ProjectStarterChoices): void; close(): void;
  openExisting?: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(true);
  const [label, setLabel] = useState<string>(starter.label);
  const [date, setDate] = useState("");
  const [showExisting, setShowExisting] = useState(false);
  const [selected, setSelected] = useState<readonly ComposerPresetKey[]>(() => starter.children.filter(key => projectPresetAvailable(model, key)));
  const parent = composerPreset(starter.parent);
  const admitted = projectPresetAvailable(model, starter.parent);
  const existing = openExisting ? libraryOccurrences(model).filter(row => row.presetKey === starter.parent) : [];
  const chosen = starter.children.filter(key => selected.includes(key) && projectPresetAvailable(model, key));
  const lastDay = new Date(`${model.semanticState.targetMonth}-01T12:00:00Z`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  useEffect(() => {
    const origin = document.activeElement;
    dialog.current?.showModal();
    return () => { if (restoreFocus.current && origin instanceof HTMLElement && origin.isConnected) origin.focus({ preventScroll: true }); };
  }, []);
  const cancel = () => { if (!busy) { restoreFocus.current = true; close(); } };
  return <dialog ref={dialog} className={`${styles.workshopConfirmation} ${styles.projectPreview}`}
    aria-labelledby="project-starter-title" aria-describedby="project-starter-description" data-project-starter-preview
    onCancel={event => { event.preventDefault(); cancel(); }}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!busy && !blockedReason && admitted && label.trim()) { restoreFocus.current = false; create({ label: label.trim(), children: chosen, ...(date ? { plannedDate: date } : {}) }); }
    }}>
      <h2 id="project-starter-title">Préparer {starter.label}</h2>
      <p>Mois du projet · {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${model.semanticState.targetMonth}-01T12:00:00Z`))}</p>
      {parent && <PresetIllustration preset={parent} className={styles.projectPreviewVisual} />}
      <p id="project-starter-description">Choisissez les intentions à préparer. Les prix et participants resteront à préciser. Chaque intention pourra être complétée après la création.</p>
      {existing.length > 0 && <section aria-label="Intentions du même type déjà présentes" className={styles.projectExisting}>
        <h3>Déjà dans ce mois</h3><p>Ces intentions sont du même type que la structure proposée. Vous pouvez en ouvrir une avant de décider de créer un nouveau projet.</p>
        {(showExisting ? existing : existing.slice(0, 3)).map(row => <button type="button" key={row.contextOccurrenceId} disabled={busy}
          data-open-existing-project={row.contextOccurrenceId} onClick={() => { restoreFocus.current = false; openExisting?.(row.contextOccurrenceId); }}>
          {row.action === "EDIT" ? "Ouvrir" : "Voir"} {row.label}{row.occurrence ? ` · Intention ${row.occurrence}` : ""}
        </button>)}
        {!showExisting && existing.length > 3 && <button type="button" disabled={busy} onClick={() => setShowExisting(true)}>Voir les {existing.length - 3} autres intentions</button>}
      </section>}
      <label className={styles.projectName}>Nom du projet<input autoFocus value={label} maxLength={120} required disabled={busy}
        onChange={event => setLabel(event.target.value)} /></label>
      <label className={styles.projectName}>Date facultative du projet<input type="date" value={date} disabled={busy}
        min={`${model.semanticState.targetMonth}-01`} max={lastDay.toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} /></label>
      <p>Cette date concerne le projet. Les dates des compléments restent à choisir séparément.</p>
      <p><strong>{parent?.label}</strong> · Structure du projet{admitted ? "" : " · Indisponible"}</p>
      {starter.children.length > 0 && <fieldset disabled={busy}><legend>Compléments facultatifs</legend>
        {starter.children.map(key => {
          const available = projectPresetAvailable(model, key);
          return <label className={styles.projectChoice} key={key}><input type="checkbox" checked={available && selected.includes(key)} disabled={!available}
            onChange={event => setSelected(previous => event.target.checked ? [...previous.filter(item => item !== key), key] : previous.filter(item => item !== key))} />
            <span>{composerPreset(key)?.label}<small>{available ? "Prix inconnu · à compléter" : "Indisponible avec les droits actuels"}</small></span></label>;
        })}
      </fieldset>}
      {!starter.children.length && <p>Le panier sera vide. Vous choisirez les articles dans son éditeur.</p>}
      <p>{chosen.length + 1} intention{chosen.length ? "s" : ""} à créer. Chaque rattachement sera vérifié avant l’ajout au brouillon.</p>
      {error && <p role="alert">{error}</p>}
      {blockedReason && <p role="alert">{blockedReason}</p>}
      <footer><button type="button" disabled={busy} onClick={cancel}>Annuler</button>
        <button data-confirm-workshop disabled={busy || !!blockedReason || !admitted || !label.trim()}>{busy ? "Préparation…" : "Créer ce projet dans le brouillon"}</button></footer>
    </form>
  </dialog>;
}
