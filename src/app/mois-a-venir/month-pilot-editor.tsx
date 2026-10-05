"use client";
import { useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { controlMoney as money, controlMonth } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, primary, secondary } from "./month-choice-controls";
import { ControlFormFields } from "./currency-stepper";
import { updateMonthInputs } from "./actions";
import material from "./month-material.module.css";
import { MonthPreviewStatus } from "./month-preview-status";
import styles from "./month-control-center.module.css";

export function MonthPilotEditor({ model, category, trial, operations, pending, replaceDraft, reset, apply }: {
  model: MonthControlModel; category: MonthControlModel["categoryControls"][number];
  trial: Awaited<ReturnType<typeof previewMonthControlCenter>> | null;
  operations: readonly MonthChoiceOperation[]; pending: boolean;
  replaceDraft: (operation: MonthChoiceOperation) => void; reset: () => void; apply: () => void;
}) {
  const { openEntity } = useMonthLocalFocus();
  const op = operations.find(row => row.kind === "CATEGORY" && row.categoryKey === category.key);
  const [amount, setAmount] = useState(op?.kind === "CATEGORY" && op.strategy === "TEST_AMOUNT" ? op.amount : category.forecast);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fresh = !!trial?.preview && !!op && !pending && !error && !editing;
  const tested = fresh ? trial.scenario.categoryControls.find(row => row.key === category.key) : null;
  const blocked = !model.editable || operations.length >= 2 && !op;
  const history = model.categoryHistory[category.key];
  const commit = (value: string, testOrigin?: Extract<MonthChoiceOperation, { strategy: "TEST_AMOUNT" }>["testOrigin"]) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) || Number(value) < Number(category.irreversibleFloor)) {
      setError(`Le montant doit être au moins ${money(category.irreversibleFloor, true)}. Les dépenses irréversibles restent comptées.`);
      return;
    }
    setError(null);
    setAmount(value); setEditing(false);
    if (Number(value) === Number(category.forecast)) reset();
    else if (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) replaceDraft({ kind: "CATEGORY", categoryKey: category.key, strategy: "TEST_AMOUNT", amount: value, ...(testOrigin ? { testOrigin } : {}) });
  };
  const targetForm = (value: string, label: string) => <form action={updateMonthInputs} data-after-save={`pilot:category:${category.key}`}><ControlFormFields month={model.targetMonth} intent="save-category-target" values={{ categoryKey: category.key, categoryTarget: value }} /><button className={secondary} disabled={!model.editable || pending || !category.capabilities.targetAllowed}>{label}</button></form>;
  const footer = op ? <><button type="button" className={styles.textAction} onClick={() => { reset(); setAmount(category.forecast); }}>Annuler le test</button>{fresh && tested && Number(tested.forecast) !== Number(category.target ?? -1) && targetForm(tested.forecast, category.target === null ? "Définir ce budget cible" : "Remplacer le budget cible")}<button type="button" className={primary} disabled={!fresh || !trial?.applicable} onClick={apply}>Appliquer à {controlMonth(model.targetMonth)}</button></> : undefined;
  return <LocalChoiceScreen kind="pilot-category" title={category.label} backLabel="Piloter mon mois" back={() => openEntity("pilot")} footer={footer}>
    <div className={styles.categoryContextBand}>
      <span>Habituel<strong>{money(model.habitualControls.find(row => row.key === category.key)?.forecast)}</strong></span>
      <span>Prévu ce mois<strong>{money(category.forecast)}</strong>{model.settings.assumptions[category.key] && <small>Ajusté</small>}</span>
      <span>Cible<strong>{category.target === null ? "—" : money(category.target)}</strong>{category.target === null && !op && targetForm(category.forecast, "+ Définir")}</span>
      <span>Déjà dépensé<strong>{money(category.realized, true)} observés</strong>{model.reliability.importsMissing !== false && <small>À consolider</small>}</span>
    </div>
    <div className={styles.pilotInteraction} data-pilot-category={category.key}>
      <div className={styles.testAmount}><span>Montant testé</span>{editing ? <input autoFocus aria-label="Montant testé (€)" className={material.field} type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} onBlur={() => commit(amount)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(amount); } }} /> : <button type="button" disabled={blocked || category.capabilities.adjustability !== "ADJUSTABLE"} onClick={() => setEditing(true)}>{money(op ? tested?.forecast ?? amount : category.forecast)}</button>}</div>
      {!blocked && <div className={styles.quickChoices}>{(model.categoryTestPresets[category.key] ?? []).map(row => <button type="button" className={styles.smallChoice} key={row.label} onClick={() => commit(row.amount, row.testOrigin)}>{row.label}</button>)}</div>}
      {blocked && <p>{model.editable ? "Deux postes sont déjà dans le scénario." : "Ce mois est terminé."}</p>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.pilotConsequence} aria-live="polite">{fresh && tested ? <><div><span>Prévu → Testé</span><strong>{money(category.forecast)} → {money(tested.forecast)}</strong></div><div><span>Impact fin de mois</span><strong>{Number(trial.budgetMarginGain) > 0 ? "+" : ""}{money(trial.budgetMarginGain)}</strong></div><div><span>Fin de mois estimée</span><strong>{money(model.projectionSummary.economic?.central)} → {money(trial.scenario.projectionSummary.economic?.central)}</strong></div></> : <p>{op ? <MonthPreviewStatus active /> : "Votre mois reste inchangé."}</p>}</div>
      {op && operations.length < 2 && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot:add")}>+ Ajouter un autre poste au scénario</button>}
      {operations.length === 2 && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot:review")}>Scénario · 2 postes · Voir le résumé</button>}
    </div>
    <div className={styles.categoryHistory} data-category-history="">{history?.status === "AVAILABLE" ? <><span>Vos mois précédents comparables · {history.count} mois</span><div><span><strong>{money(history.min)}</strong>Mois bas</span><span><strong>{money(history.median)}</strong>Médiane</span><span><strong>{money(history.max)}</strong>Mois haut</span></div><p>{money(category.forecast)} ce mois{tested && ` · ${money(tested.forecast)} dans le scénario`}</p></> : <><div><span><strong>—</strong>Mois bas</span><span><strong>—</strong>Médiane</span><span><strong>—</strong>Mois haut</span></div><p>Historique insuffisant · {history?.count ?? 0} mois comparables sur 3 nécessaires</p></>}</div>
  </LocalChoiceScreen>;
}
