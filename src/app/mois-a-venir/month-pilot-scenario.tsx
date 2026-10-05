"use client";
import { useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { monthChoiceTarget } from "@/domain/phase2/month-control-contract";
import { controlMoney as money } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, ChoicePages, primary } from "./month-choice-controls";
import { MonthPreviewStatus } from "./month-preview-status";
import styles from "./month-control-center.module.css";
import material from "./month-material.module.css";

type Trial = Awaited<ReturnType<typeof previewMonthControlCenter>> | null;
export type PilotCandidate = Readonly<{ target: string; label: string; focus: string }>;
/** Filters server-published possibilities only; no financial eligibility is invented here. */
export function pilotCandidates(model: MonthControlModel, operations: readonly MonthChoiceOperation[]): PilotCandidate[] {
  if (!model.editable || operations.length >= 2) return [];
  const selected = new Set(operations.map(monthChoiceTarget));
  return model.pilotCandidates.filter(row => !selected.has(row.target));
}
export function MonthPilotAdd({ model, operations }: { model: MonthControlModel; operations: readonly MonthChoiceOperation[] }) {
  const { openEntity } = useMonthLocalFocus();
  const candidates = pilotCandidates(model, operations);
  const [page, setPage] = useState(0);
  return <LocalChoiceScreen title="Ajouter un poste" backLabel="Piloter mon mois" back={() => openEntity("pilot")}>
    <div className={styles.pilotPicker}>{candidates.slice(page * 8, page * 8 + 8).map(row => <button type="button" className={styles.smallChoice} key={row.target} onClick={() => openEntity(row.focus)}>{row.label}</button>)}</div>
    <ChoicePages count={candidates.length} page={page} setPage={setPage} size={8} />
    {!candidates.length && <p>Aucun autre poste ajustable pour ce mois.</p>}
  </LocalChoiceScreen>;
}
export function MonthPilotSummary({ model, operations, trial, pending, apply, remove }: { model: MonthControlModel; operations: readonly MonthChoiceOperation[]; trial: Trial; pending: boolean; apply: () => void; remove: (target: string | null) => void }) {
  const { openEntity } = useMonthLocalFocus();
  if (!operations.length) return null;
  return <section className={styles.pilotSummary} data-pilot-summary="" aria-label="Changements testés">
    <strong>{operations.length} poste{operations.length > 1 ? "s" : ""} testé{operations.length > 1 ? "s" : ""}</strong>
    <div className={styles.pilotSummaryRows}>{operations.map(op => {
      const before = op.kind === "CATEGORY" ? model.categoryControls.find(row => row.key === op.categoryKey) : model.savings.find(row => row.id === op.savingsId);
      const value = op.kind === "CATEGORY" ? trial?.scenario.categoryControls.find(row => row.key === op.categoryKey)?.forecast : trial?.scenario.savings.find(row => row.id === op.savingsId)?.amount;
      return <button type="button" key={monthChoiceTarget(op)} onClick={() => openEntity(op.kind === "CATEGORY" ? `pilot:category:${op.categoryKey}` : `pilot:saving:${op.savingsId}`)}><span>{before?.label}</span><strong>{money(before && ("forecast" in before ? before.forecast : before.amount))} → {money(value ?? ("amount" in op ? op.amount : null))}</strong></button>;
    })}</div>
    {trial?.preview && <div className={styles.pilotSummaryImpact} style={{ opacity: pending ? .6 : 1 }}><span>Impact total fin de mois <strong>{Number(trial.budgetMarginGain) > 0 ? "+" : ""}{money(trial.budgetMarginGain)}</strong></span><span>Fin de mois <strong>{money(model.projectionSummary.economic?.central)} → {money(trial.scenario.projectionSummary.economic?.central)}</strong></span></div>}
    <MonthPreviewStatus active={pending || !trial?.preview} />
    <div className={styles.quickChoices}><button type="button" className={styles.textAction} onClick={() => remove(null)}>Abandonner le scénario</button>{pilotCandidates(model, operations).length > 0 && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot:add")}>+ Ajouter un poste</button>}<button type="button" className={primary} disabled={pending || !trial?.applicable || !trial.preview} onClick={apply}>Appliquer {operations.length === 1 ? "le changement" : `les ${operations.length} changements`}</button></div>
  </section>;
}
export function MonthPilotReview(props: Parameters<typeof MonthPilotSummary>[0]) {
  const { openEntity } = useMonthLocalFocus();
  return <LocalChoiceScreen title="Piloter mon mois" backLabel="Piloter mon mois" back={() => openEntity("pilot")}><MonthPilotSummary {...props} />{!props.operations.length && <button type="button" className={styles.textAction} onClick={() => openEntity("pilot")}>Choisir un poste</button>}</LocalChoiceScreen>;
}
export function MonthPilotSaving({ model, saving, operations, trial, pending, replaceDraft, remove, apply }: Parameters<typeof MonthPilotSummary>[0] & { saving: MonthControlModel["savings"][number]; replaceDraft: (op: MonthChoiceOperation) => void }) {
  const { openEntity } = useMonthLocalFocus();
  const op = operations.find(row => row.kind === "SAVINGS" && row.savingsId === saving.id);
  const [amount, setAmount] = useState(op?.kind === "SAVINGS" && op.strategy === "TEST_SAVINGS" ? op.amount : saving.amount);
  const valid = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount);
  const commit = () => { if (!valid) return; if (Number(amount) === Number(saving.amount)) remove(`savings:${saving.id}`); else replaceDraft({ kind: "SAVINGS", savingsId: saving.id, strategy: "TEST_SAVINGS", amount }); };
  return <LocalChoiceScreen title={saving.label} backLabel="Piloter mon mois" back={() => openEntity("pilot")}>
    <div className={styles.testAmount}><span>Réservé ce mois · {money(saving.amount)}</span><label>Montant testé (€)<input className={material.field} type="number" min="0" step=".01" value={amount} onChange={event => setAmount(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} /></label></div>
    {!valid && <p role="alert">Saisissez un montant positif ou nul, avec deux décimales au maximum.</p>}
    <p>Dépenses prévues inchangées</p>{op && <button type="button" className={styles.textAction} onClick={() => { remove(`savings:${saving.id}`); setAmount(saving.amount); }}>{operations.length > 1 ? `Retirer ${saving.label} du scénario` : "Annuler le test"}</button>}
    <MonthPilotSummary model={model} operations={operations} trial={trial} pending={pending || !valid || Number(amount) !== Number(op?.kind === "SAVINGS" && op.strategy === "TEST_SAVINGS" ? op.amount : saving.amount)} apply={apply} remove={remove} />
  </LocalChoiceScreen>;
}
