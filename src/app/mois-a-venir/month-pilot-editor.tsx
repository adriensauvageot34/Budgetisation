"use client";
import { useEffect, useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { controlMoney as money, controlMonth } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, primary } from "./month-choice-controls";
import { ControlFormFields } from "./currency-stepper";
import { updateMonthInputs } from "./actions";
import material from "./month-material.module.css";
import { MonthPreviewStatus } from "./month-preview-status";
import { pilotCandidates } from "./month-pilot-scenario";
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
  useEffect(() => { if (!editing && !error) setAmount(op?.kind === "CATEGORY" && op.strategy === "TEST_AMOUNT" ? (tested?.forecast ?? op.amount) : category.forecast); }, [op, tested?.forecast, category.forecast, editing, error]);
  const history = model.categoryHistory[category.key];
  const commit = (value: string, testOrigin?: Extract<MonthChoiceOperation, { strategy: "TEST_AMOUNT" }>["testOrigin"]) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) || Number(value) < Number(category.irreversibleFloor)) {
      setAmount(value); setEditing(false); setError(`Impossible à appliquer : le montant doit être au moins ${money(category.irreversibleFloor, true)}. Les dépenses irréversibles restent comptées.`);
      return;
    }
    setError(null);
    setAmount(value); setEditing(false);
    if (Number(value) === Number(category.forecast)) reset();
    else if (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) replaceDraft({ kind: "CATEGORY", categoryKey: category.key, strategy: "TEST_AMOUNT", amount: value, ...(testOrigin ? { testOrigin } : {}) });
  };
  const targetForm = (value: string, label: string) => <form action={updateMonthInputs} data-after-save={`pilot:category:${category.key}`}><ControlFormFields month={model.targetMonth} intent="save-category-target" values={{ categoryKey: category.key, categoryTarget: value }} /><button className={styles.textAction} disabled={!model.editable || pending || !category.capabilities.targetAllowed}>{label}</button></form>;
  const changed = !!op || !!error;
  const footer = changed ? <><button type="button" className={styles.textAction} onClick={() => { reset(); setError(null); setAmount(category.forecast); }}>{operations.length > 1 ? `Retirer ${category.label} du scénario` : "Annuler le test"}</button>{fresh && tested && Number(tested.forecast) !== Number(category.target ?? -1) && Number(tested.forecast) !== Number(category.forecast) && targetForm(tested.forecast, category.target === null ? `Définir ${money(tested.forecast)} comme cible` : `Remplacer la cible par ${money(tested.forecast)}`)}<button type="button" className={primary} disabled={!fresh || !trial?.applicable} onClick={apply}>{operations.length > 1 ? `Appliquer les ${operations.length} changements` : `Appliquer à ${controlMonth(model.targetMonth)}`}</button></> : undefined;
  const shortcut = (label: string, value: string | null | undefined) => value !== null && value !== undefined && Number(value) !== Number(amount) && Number(value) >= Number(category.irreversibleFloor) && !blocked && category.capabilities.adjustability === "ADJUSTABLE" ? <button type="button" className={styles.contextShortcut} aria-label={`Tester ${label.toLowerCase()} : ${money(value)}`} onClick={() => commit(value)}>{label}<strong>{money(value)}</strong></button> : <span>{label}<strong>{value === null || value === undefined ? "—" : money(value)}</strong></span>;
  return <LocalChoiceScreen kind="pilot-category" title={category.label} backLabel="Piloter mon mois" back={() => openEntity("pilot")} footer={footer}>
    <div className={styles.categoryContextBand}>
      {shortcut("Habituel", model.habitualControls.find(row => row.key === category.key)?.forecast)}
      <div>{shortcut("Prévu ce mois", category.forecast)}{model.settings.assumptions[category.key] && <small>Ajusté</small>}</div>
      <div>{shortcut("Cible", category.target)}{category.target === null && !op && !error && targetForm(category.forecast, "+ Définir une cible")}</div>
      <span>Déjà dépensé<strong>{money(category.realized, true)} observés</strong>{model.reliability.importsMissing !== false && <small>À consolider</small>}</span>
    </div>
    <div className={styles.pilotInteraction} data-pilot-category={category.key}>
      <div className={styles.testAmount}><span>Montant testé</span>{editing ? <input autoFocus aria-label="Montant testé (€)" className={material.field} type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} onBlur={() => commit(amount)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(amount); } }} /> : <button type="button" disabled={blocked || category.capabilities.adjustability !== "ADJUSTABLE"} onClick={() => setEditing(true)}>{money(changed ? tested?.forecast ?? amount : category.forecast)}</button>}</div>
      {!blocked && <div className={styles.quickChoices}>{(model.categoryTestPresets[category.key] ?? []).map(row => <button type="button" className={styles.smallChoice} key={row.label} onClick={() => commit(row.amount, row.testOrigin)}>{row.label}</button>)}</div>}
      {blocked && <p>{model.editable ? "Deux postes sont déjà dans le scénario." : "Ce mois est terminé."}</p>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.pilotConsequence} aria-live="polite">{fresh && tested ? <><div><span>Prévu → Testé</span><strong>{money(category.forecast)} → {money(tested.forecast)}</strong></div><div><span>{operations.length > 1 ? "Impact total fin de mois" : "Impact fin de mois"}</span><strong>{Number(trial.budgetMarginGain) > 0 ? "+" : ""}{money(trial.budgetMarginGain)}</strong></div><div><span>Fin de mois estimée</span><strong>{money(model.projectionSummary.economic?.central)} → {money(trial.scenario.projectionSummary.economic?.central)}</strong></div></> : op ? <MonthPreviewStatus active /> : null}</div>
      {op && pilotCandidates(model, operations).length > 0 && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot:add")}>+ Ajouter un poste</button>}
      {operations.length === 2 && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot:review")}>2 postes testés · Voir le résumé</button>}
    </div>
    <div className={styles.categoryHistory} data-category-history="">{history?.status === "AVAILABLE" ? <><span>Historique personnel · {history.count} mois comparables</span><div className={styles.historyValues}>{([["Mois bas", history.min], ["Médiane", history.median], ["Mois haut", history.max]] as const).map(([label, value]) => <button type="button" key={label} disabled={blocked || category.capabilities.adjustability !== "ADJUSTABLE" || Number(value) < Number(category.irreversibleFloor) || Number(value) === Number(amount)} title={`Tester ${money(value)}`} aria-label={`Tester ${label.toLowerCase()} historique : ${money(value)}`} onClick={() => value !== null && commit(value)}><strong>{money(value)}</strong>{label}</button>)}</div><div className={styles.historyRail} aria-label="Position du prévu et du test dans l’historique">{[["Prévu", category.forecast], ...(op ? [["Test", tested?.forecast ?? amount]] : [])].map(([label, value]) => <span key={label} title={`${label} : ${money(value)}`} style={{ left: `${Math.max(0, Math.min(100, (Number(value) - Number(history.min)) / (Number(history.max) - Number(history.min) || 1) * 100))}%` }} data-marker={label} />)}</div><small>● Prévu {money(category.forecast)}{op && ` · ▲ Test ${money(tested?.forecast ?? amount)}`}</small></> : <p>Historique en construction · {history?.count ?? 0}/3 mois comparables</p>}</div>
  </LocalChoiceScreen>;
}
