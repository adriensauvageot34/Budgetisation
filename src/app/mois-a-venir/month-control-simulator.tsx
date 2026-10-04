"use client";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation, CategoryChoiceStrategy } from "@/domain/phase2/month-choice-contract";
import { monthChoiceTarget, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import { controlMonth, controlMoney as money } from "@/domain/phase2/month-control-display";
import { CategoryTargetEditor, MonthGoalEditor } from "./month-decision-tools";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";
type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;
const button = `${material.clayButton} px-4 py-2 text-sm font-bold disabled:opacity-50`;

export function MonthControlObjectives({ model, choosePurpose }: { model: MonthControlModel; choosePurpose: (purpose: MonthControlPurpose) => void }) {
  const active = model.categoryControls.filter(row => row.target !== null), available = model.categoryControls.filter(row => row.target === null);
  const category = (row: MonthControlModel["categoryControls"][number]) => <article data-control-focus={row.key} key={row.key} className={styles.objectiveRow}>
    <h4 className="font-bold">{row.label}</h4><CategoryTargetEditor control={row} targetMonth={model.targetMonth} />
    {row.capabilities.adjustability === "FIXED" && <p className="mt-2 text-sm text-slate-600"><strong>Suivi uniquement.</strong> Vous pouvez définir un repère, mais ce poste n’est pas utilisé comme levier automatique.</p>}
    {model.categoryTensions.some(tension => tension.categoryKey === row.key) && <div className="mt-2 flex gap-3 text-sm">{row.capabilities.adjustability === "ADJUSTABLE" && <button className={styles.textAction} onClick={() => choosePurpose({ kind: "CATEGORY_CORRECTION", categoryKey: row.key })}>Corriger ce poste</button>}
      <button className={styles.textAction} onClick={() => choosePurpose({ kind: "CATEGORY_OVERAGE_OFFSET", categoryKey: row.key })}>Compenser ailleurs</button></div>}
  </article>;
  return <section data-control-focus="goals" className={styles.objectives} aria-labelledby="objectives-title"><header className="flex items-center justify-between gap-3"><h3 id="objectives-title" className="text-xl font-black">Mes objectifs</h3><span className="text-sm text-slate-600">Enregistrés pour {controlMonth(model.targetMonth)}</span></header>
    {model.goalState === "NO_GOALS_DEFINED" && <p className="mt-3 text-sm text-slate-600">Aucun repère défini pour l’instant.</p>}
    {active.length > 0 && <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">{active.map(category)}</div>}
    {available.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Ajouter un objectif</summary><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">{available.map(category)}</div></details>}
    <div data-control-focus="global-goal" className="mt-3">{model.settings.goal !== null ? <MonthGoalEditor targetMonth={model.targetMonth} settings={model.settings} goal={model.projectionSummary} />
      : <details className="text-sm"><summary className="cursor-pointer font-bold text-violet-900">Définir un objectif de fin de mois</summary><MonthGoalEditor targetMonth={model.targetMonth} settings={model.settings} goal={model.projectionSummary} /></details>}</div>
  </section>;
}

export function MonthControlSimulator({ model, trial, purpose, operations, pending, replaceDraft, recalculate, apply }: {
  model: MonthControlModel; trial: Workbench | null; purpose: MonthControlPurpose; operations: readonly MonthChoiceOperation[]; pending: boolean;
  replaceDraft: (operation: MonthChoiceOperation) => void; recalculate: (ops: readonly MonthChoiceOperation[], purpose: MonthControlPurpose) => void; apply: () => void;
}) {
  const [customKey, setCustomKey] = useState(""), [customStrategy, setCustomStrategy] = useState<CategoryChoiceStrategy>("REDUCE_AMOUNT");
  const selectable = model.categoryControls.filter(row => row.capabilities.adjustability === "ADJUSTABLE" && row.capabilities.strategies.length
    && !operations.some(op => monthChoiceTarget(op) === `category:${row.key}`) && (purpose.kind !== "CATEGORY_CORRECTION" || row.key === purpose.categoryKey));
  const custom = selectable.find(row => row.key === customKey) ?? selectable[0];
  const strategy = custom?.capabilities.strategies.includes(customStrategy) ? customStrategy : custom?.capabilities.strategies[0];
  const mainKeys = ["household-restaurants", "tobacco-vape", "groceries"];
  const groups = trial ? [...new Set(trial.shortcuts.map(row => row.categoryKey))].sort((a, b) => {
    const order = (key: string) => mainKeys.includes(key) ? mainKeys.indexOf(key) : 10; return order(a) - order(b);
  }) : [];
  const savings = trial?.offers.filter(row => row.operation.kind === "SAVINGS") ?? [];
  const goalOffers = trial?.offers.filter(row => row.operation.kind === "CATEGORY" && row.operation.strategy === "REDUCE_AMOUNT") ?? [];
  return <section data-control-focus="simulator" className={`${material.glassPremium} ${styles.simulator}`} aria-labelledby="workbench-title">
    <header><p className="text-sm font-bold text-violet-800">Simulation temporaire</p><h3 id="workbench-title" className="mt-1 text-2xl font-black">{operations.length ? `Votre scénario · ${operations.length} choix sur 2` : "Tester un scénario"}</h3>
      <p className={`${styles.reading} mt-3 text-sm text-slate-600`}>Modifiez virtuellement une ou deux habitudes pour voir l’impact sur votre fin de mois. Rien n’est enregistré tant que vous ne validez pas.</p>
      {!operations.length && <p className="mt-2 text-sm">Vous pouvez combiner jusqu’à 2 choix.</p>}
      {purpose.kind !== "FREE_EXPLORATION" && purpose.kind !== "NONE" && <div className="mt-3 flex items-center gap-3 text-sm"><p>{trial?.offerContext}</p><button className={styles.textAction} onClick={() => recalculate(operations, { kind: "FREE_EXPLORATION" })}>Explorer librement</button></div>}
    </header>
    {!model.projectionSummary.economic && <p className="mt-4 text-sm">Complétez les ressources avant de simuler des ajustements.</p>}
    {trial?.resolved && <p role="status" className="mt-4 font-bold text-emerald-900"><Check className="mr-1 inline" size={18} aria-hidden="true" />{purpose.kind === "GLOBAL_GOAL" ? "Objectif de fin de mois atteint dans ce scénario" : purpose.kind === "CATEGORY_CORRECTION" ? "Objectif de catégorie atteint dans ce scénario" : "Marge recherchée compensée ; le repère de catégorie reste distinct"}</p>}
    {operations.length > 0 && <ul className="mt-4 space-y-3">{operations.map(op => {
      const row = trial?.selected.find(row => row.target === monthChoiceTarget(op));
      const editableAmount = op.kind === "SAVINGS" || model.categoryControls.find(control => control.key === op.categoryKey)?.capabilities.strategies.includes("REDUCE_AMOUNT");
      return <li key={monthChoiceTarget(op)} className={`${material.dataCard} p-4`}><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{row?.label ?? "Choix sélectionné"}</p>{row && <p className="mt-1 text-sm">≈ {money(row.before)} → ≈ {money(row.after)} {op.kind === "CATEGORY" ? "restant ajustable" : "réservés"}</p>}</div>
        <button className={styles.textAction} disabled={pending} onClick={() => recalculate(operations.filter(other => monthChoiceTarget(other) !== monthChoiceTarget(op)), purpose)}>Retirer</button></div>
        {editableAmount && <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">Modifier cette réduction</summary><form className="mt-3 flex items-end gap-2" onSubmit={event => {
          event.preventDefault(); const amount = String(new FormData(event.currentTarget).get("reduction"));
          replaceDraft(op.kind === "CATEGORY" ? { kind: "CATEGORY", categoryKey: op.categoryKey, strategy: "REDUCE_AMOUNT", amount } : { ...op, amount });
        }}><label>Réduire de<input className={`${material.field} ml-2 w-28 px-2 py-1`} name="reduction" type="number" min="0" step="0.01" required /> €</label><button className={button} disabled={pending}>Modifier</button></form><p className="mt-2 text-sm text-slate-600">Depuis l’état enregistré ; les dépenses réalisées et projets explicites restent comptés.</p></details>}
      </li>;
    })}</ul>}
    {trial?.preview && <div className={styles.result}>
      <p className="text-2xl font-black text-violet-900">+ ≈ {money(trial.budgetMarginGain)} de marge</p>
      <table className={`${styles.compare} mt-4`} aria-label="Comparaison actuel et votre scénario"><thead><tr><th>Repère</th><th>Actuel</th><th>Votre scénario</th></tr></thead><tbody>
        <tr><th>Reste prévu en fin de mois</th><td>≈ {money(trial.model.projectionSummary.economic?.central)}</td><td>≈ {money(trial.scenario.projectionSummary.economic?.central)}</td></tr>
        <tr><th>Quotidien restant prévu</th><td>≈ {money(trial.model.projectionSummary.remainingDailyLife)}</td><td>≈ {money(trial.scenario.projectionSummary.remainingDailyLife)}</td></tr>
        {model.settings.goal !== null && <tr><th>Écart à l’objectif global</th><td>{money(trial.model.projectionSummary.globalDelta)}</td><td>{money(trial.scenario.projectionSummary.globalDelta)}</td></tr>}
        {Object.keys(model.settings.categoryTargets).length > 0 && <tr><th>Dépassements des catégories suivies</th><td>{money(trial.model.projectionSummary.categoryGap)}</td><td>{money(trial.scenario.projectionSummary.categoryGap)}</td></tr>}
        {model.savings.length > 0 && <tr><th>Cagnottes protégées</th><td>{money(trial.model.projectionSummary.protectedSavings, true)}</td><td>{money(trial.scenario.projectionSummary.protectedSavings, true)}</td></tr>}
      </tbody></table>
      <p className="mt-3 text-sm">≈ {money(trial.spendingReduction)} de dépenses prévues en moins.{operations.some(op => op.kind === "SAVINGS") && <> {money(trial.reservationRelease, true)} de réservation libérée.</>}</p>
      {purpose.kind !== "FREE_EXPLORATION" && purpose.kind !== "NONE" && <p className="mt-2 text-sm">Reste ≈ {money(trial.remainingNeed)} {purpose.kind === "CATEGORY_CORRECTION" ? "au-dessus de ce repère de catégorie" : "à couvrir pour ce scénario"}.</p>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Voir les limites</summary><ul className={`${styles.reading} mt-2 space-y-1 text-slate-600`}>{trial.preview.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
    </div>}
    {!trial && operations.length > 0 && <button className={`${button} mt-4`} disabled={pending} onClick={() => recalculate(operations, purpose)}>Recalculer le scénario</button>}
    {operations.length === 2 && <p className="mt-4 text-sm">Retirez ou remplacez un choix pour en tester un autre.</p>}
    {operations.length === 1 && !trial?.resolved && <h4 className="mt-5 font-bold">Ajouter un deuxième choix</h4>}
    {goalOffers.length > 0 && purpose.kind !== "FREE_EXPLORATION" && <div className="mt-4 space-y-2">{goalOffers.map(offer => <button key={offer.id} className={`${material.clayChip} block w-full p-3 text-left text-sm`} disabled={pending} onClick={() => replaceDraft(offer.operation)}><strong>{offer.label}</strong> · ≈ {money(offer.preview.delta)} de marge · reste ≈ {money(offer.remainingNeedAfter)}</button>)}</div>}
    <div className="mt-4 grid grid-cols-3 gap-3">{groups.filter(key => mainKeys.includes(key)).map(key => <div key={key} className={styles.shortcutGroup}><h4 className="font-bold">{trial!.shortcuts.find(row => row.categoryKey === key)!.categoryLabel}</h4><div className="mt-2 space-y-2">{trial!.shortcuts.filter(row => row.categoryKey === key).map(row => <button className={styles.shortcut} disabled={pending} key={row.label} onClick={() => replaceDraft(row.operation)}><span>{row.label}</span><span className="block text-sm text-violet-700">≈ {money(row.preview.delta)} de marge</span></button>)}</div></div>)}</div>
    {groups.some(key => !mainKeys.includes(key)) && <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Tester une autre habitude</summary><div className="mt-3 grid grid-cols-2 gap-3">{trial!.shortcuts.filter(row => !mainKeys.includes(row.categoryKey)).map(row => <button key={row.label} className={styles.shortcut} disabled={pending} onClick={() => replaceDraft(row.operation)}>{row.label} · ≈ {money(row.preview.delta)} de marge</button>)}</div></details>}
    {savings.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Tester une réservation ajustable</summary><p className="mt-2 text-slate-600">Une réservation libérée augmente la marge du mois ; ce n’est pas une dépense évitée.</p><div className="mt-3 space-y-2">{savings.map(row => <button key={row.id} className={styles.shortcut} disabled={pending} onClick={() => replaceDraft(row.operation)}>{row.label} · {money(row.preview.reservationRelease, true)} libérés</button>)}</div></details>}
    {operations.length < 2 && selectable.length > 0 && !trial?.resolved && <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Créer mon scénario</summary><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault(); if (!custom || !strategy) return; const value = String(new FormData(event.currentTarget).get("reduction"));
      replaceDraft({ kind: "CATEGORY", categoryKey: custom.key, ...(strategy === "REDUCE_PERCENT" ? { strategy, percent: value } : strategy === "REDUCE_AMOUNT" ? { strategy, amount: value } : { strategy }) });
    }}><label>Habitude<select className={`${material.field} mt-1 block px-3 py-2`} value={custom?.key ?? ""} onChange={event => setCustomKey(event.target.value)}>{selectable.map(row => <option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
      <label>Type de réduction<select className={`${material.field} mt-1 block px-3 py-2`} value={strategy ?? ""} onChange={event => setCustomStrategy(event.target.value as CategoryChoiceStrategy)}>{custom?.capabilities.strategies.map(value => <option key={value} value={value}>{value === "REDUCE_AMOUNT" ? "Montant" : value === "REDUCE_PERCENT" ? "Pourcentage" : "Une occurrence en moins"}</option>)}</select></label>
      {strategy !== "REDUCE_ONE_OCCURRENCE" && <label>Réduire de<input className={`${material.field} ml-2 w-28 px-2 py-2`} name="reduction" type="number" min={strategy === "REDUCE_PERCENT" ? "0.01" : "0"} max={strategy === "REDUCE_PERCENT" ? "100" : undefined} step="0.01" required /> {strategy === "REDUCE_PERCENT" ? "%" : "€"}</label>}
      <button className={button} disabled={pending}>Voir l’impact</button></form><p className="mt-2 text-slate-600">Uniquement sur ce qui reste ajustable, sans effacer les dépenses réalisées.</p></details>}
    {operations.length > 0 && <footer className={styles.applyFooter}><div><p className="text-sm font-bold">Simulation — rien n’est encore enregistré</p><p className="mt-1 text-sm text-slate-600">{operations.length} choix sur 2{trial?.preview && ` · + ≈ ${money(trial.budgetMarginGain)} de marge`}</p></div>
      <div className="flex shrink-0 items-center gap-4"><button className={`${material.clayPrimary} px-4 py-3 text-sm font-bold disabled:opacity-50`} disabled={pending || !trial?.applicable} onClick={apply}>Appliquer ce scénario au mois</button>
        <button className={styles.textAction} disabled={pending} onClick={() => recalculate([], model.defaultPurpose)}><RotateCcw className="mr-1 inline" size={14} aria-hidden="true" />Réinitialiser</button></div>
    </footer>}
  </section>;
}
