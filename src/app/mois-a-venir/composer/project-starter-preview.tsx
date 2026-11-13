"use client";

import { useEffect, useRef, useState } from "react";
import { composerPreset, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { projectPresetAvailable, type ProjectStarter, type ProjectStarterChoices } from "./project-starters";
import { PresetIllustration } from "./preset-illustration";
import styles from "./composer.module.css";

/** Only the confirmed proposal reaches the Shell's atomic evaluator. */
export function ProjectStarterPreview({ starter, model, busy, error, blockedReason, create, close }: {
  starter: ProjectStarter; model: ComposerUiModel; busy: boolean;
  error?: string | null;
  blockedReason?: string | null;
  create(choices: ProjectStarterChoices): void; close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(true);
  const [label, setLabel] = useState<string>(starter.label);
  const [selected, setSelected] = useState<readonly ComposerPresetKey[]>(() => starter.children.filter(key => projectPresetAvailable(model, key)));
  const parent = composerPreset(starter.parent);
  const admitted = projectPresetAvailable(model, starter.parent);
  const chosen = selected.filter(key => projectPresetAvailable(model, key));
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
      if (!busy && !blockedReason && admitted && label.trim()) { restoreFocus.current = false; create({ label: label.trim(), children: chosen }); }
    }}>
      <h2 id="project-starter-title">Préparer {starter.label}</h2>
      {parent && <PresetIllustration preset={parent} className={styles.projectPreviewVisual} />}
      <p id="project-starter-description">Choisissez les intentions à préparer. Les prix, dates et participants resteront à préciser après la création.</p>
      <label className={styles.projectName}>Nom du projet<input autoFocus value={label} maxLength={120} required disabled={busy}
        onChange={event => setLabel(event.target.value)} /></label>
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
