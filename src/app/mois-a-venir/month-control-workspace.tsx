"use client";
import { useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { monthChoiceTarget, monthControlCategoryPresets } from "@/domain/phase2/month-control-contract";
import { controlMoney as money, controlDate } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, ChoiceTile, PercentStepper, primary, secondary } from "./month-choice-controls";
import { ControlFormFields } from "./currency-stepper";
import { updateMonthInputs } from "./actions";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";
type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;
type Category = MonthControlModel["categoryControls"][number];

export function MonthWorkspaceRoot({ model, draftCount }: { model: MonthControlModel; draftCount: number }) {
  const { openEntity } = useMonthLocalFocus();
  const needs = model.update.groups.NEEDS_UPDATE;
  return <div className={styles.workspaceRoot} data-workspace-root="">
    <button type="button" className={`${styles.hubCard} ${styles.pilotCard}`} data-control-hub="pilot" onClick={() => openEntity("pilot")}><span className={styles.hubIcon} aria-hidden="true">🎛</span><h3>Piloter mon mois</h3><p className={styles.hubSummary}>Tester, se fixer un repère et appliquer des ajustements.</p><p className={styles.hubDetail}>{draftCount ? `${draftCount} choix en cours · rien n’est enregistré` : `${model.categoryControls.length} postes · ${model.goalCount ? `${model.goalCount} repères définis` : "vos repères à portée de main"}`}</p></button>
    <button type="button" className={`${styles.hubCard} ${styles.savingsCard}`} data-control-hub="savings" onClick={() => openEntity("savings")}><span className={styles.hubIcon} aria-hidden="true">🔒</span><h3>Mes cagnottes</h3><p className={styles.hubSummary}>{model.savings.length ? `${model.savings.length} cagnotte${model.savings.length > 1 ? "s" : ""}` : "Votre prochain projet"}</p><p className={styles.hubDetail}>{model.savings.length === 1 ? `${model.savings[0]!.label} · ${money(model.savings[0]!.amount, true)}` : model.savings.length ? `${money(model.projectionSummary.totalSavings, true)} mis de côté` : "Mettre de l’argent de côté"}</p></button>
    <button type="button" className={`${styles.hubCard} ${styles.updateCard}`} data-control-hub="update" onClick={() => openEntity("update")}><span className={styles.hubIcon} aria-hidden="true">↻</span><h3>Mettre à jour</h3>{needs.length > 0 && <span className={styles.cardBadge} aria-label={`${needs.length} informations à actualiser`}>{needs.length}</span>}<p className={styles.hubSummary}>{needs.length ? `${needs.slice(0, 3).map(row => row.label).join(" · ")} à actualiser${needs.length > 3 ? ` · ${needs.length - 3} autres` : ""}` : "Toutes vos informations sont à jour"}</p></button>
  </div>;
}

export function MonthPilotIndex({ model, draftCount }: { model: MonthControlModel; draftCount: number }) {
  const { openEntity } = useMonthLocalFocus();
  return <LocalChoiceScreen title="Piloter mon mois" subtitle="Un poste, vos repères et les choix de ce mois." back={() => openEntity(null)} footer={<><button type="button" className={secondary} onClick={() => openEntity("global-goal")}>Objectif de fin de mois{model.settings.goal !== null && ` · ${money(model.settings.goal)}`}</button><button type="button" className={styles.textAction} onClick={() => openEntity("pilot:review")}>{draftCount ? `Votre scénario · ${draftCount}/2 choix` : "Inclure une cagnotte ajustable"}</button></>}>
    <div className={styles.pilotGrid} data-pilot-categories="">{model.categoryControls.map(row => <ChoiceTile key={row.key} title={row.label} active={row.target !== null || !!model.settings.assumptions[row.key]} onClick={() => openEntity(`pilot:category:${row.key}`)}><span>{money(row.forecast)} estimés</span><span>{row.target === null ? "Aucun repère" : `Repère ${money(row.target)}${Number(row.varianceToTarget) > 0 ? ` · ${money(row.varianceToTarget)} au-dessus` : ""}`}</span><span>{model.settings.assumptions[row.key] ? "Ajustement actif" : row.capabilities.adjustability === "FIXED" ? "Poste à suivre" : ""}</span></ChoiceTile>)}</div>
  </LocalChoiceScreen>;
}

/** Inputs construct an existing operation. Only the server publishes consequences. */
export function MonthPilotCategory({ model, category, trial, operations, pending, replaceDraft, reset, apply }: {
  model: MonthControlModel; category: Category; trial: Workbench | null; operations: readonly MonthChoiceOperation[]; pending: boolean;
  replaceDraft: (operation: MonthChoiceOperation) => void; reset: () => void; apply: () => void;
}) {
  const { openEntity } = useMonthLocalFocus();
  const op = operations.find(row => monthChoiceTarget(row) === `category:${category.key}`);
  const [percent, setPercent] = useState(op?.kind === "CATEGORY" && op.strategy === "REDUCE_PERCENT" ? -Number(op.percent) : 0);
  const [exact, setExact] = useState(false), [amount, setAmount] = useState(op?.kind === "CATEGORY" && op.strategy === "REDUCE_AMOUNT" ? op.amount : "25.00");
  const [dirty, setDirty] = useState(false);
  const fresh = !!trial?.preview && !!op && !pending && !dirty;
  const scenarioCategory = fresh ? trial.scenario.categoryControls.find(row => row.key === category.key) : null;
  const blocked = !model.editable || operations.length >= 2 && !op;
  const presets = monthControlCategoryPresets(category.key, category.label, category.capabilities);
  const history = model.categoryHistory[category.key];
  const changePercent = (value: number) => { setDirty(false); setPercent(value); if (value === 0) reset(); else replaceDraft({ kind: "CATEGORY", categoryKey: category.key, strategy: "REDUCE_PERCENT", percent: String(Math.abs(value)) }); };
  const footer = <><button type="button" className={styles.textAction} disabled={pending || !op && !dirty} onClick={() => { reset(); setPercent(0); setDirty(false); setExact(false); setAmount("25.00"); }}>Réinitialiser</button><form action={updateMonthInputs} data-after-save={`pilot:category:${category.key}`}><ControlFormFields month={model.targetMonth} intent="save-category-target" values={{ categoryKey: category.key, categoryTarget: scenarioCategory?.forecast ?? category.forecast }} /><button className={secondary} disabled={!model.editable || pending || dirty || !!op && !fresh || !category.capabilities.targetAllowed}>En faire mon repère</button></form><button type="button" className={primary} disabled={pending || !fresh || !trial?.applicable} onClick={apply}>Appliquer à ce mois</button></>;
  return <LocalChoiceScreen kind="pilot-category" title={category.label} backLabel="Retour à Piloter mon mois" back={() => openEntity("pilot")} footer={footer}>
    <div className={styles.pilotWorkbench} data-pilot-category={category.key}>
      <div className={styles.pilotReference}><span>Prévision actuelle</span><strong>{money(category.forecast)}</strong><span>Déjà réalisé {money(category.realized, true)}</span><span>{category.target === null ? "Aucun repère" : `Votre repère ${money(category.target)}`}</span><button type="button" className={styles.textAction} onClick={() => openEntity(`pilot:target:${category.key}`)}>Personnaliser le repère</button><span>{model.settings.assumptions[category.key] ? "Ajustement actif pour ce mois" : "Vos habitudes restent utilisées"}</span>{category.capabilities.adjustability === "ADJUSTABLE" && <button type="button" className={styles.textAction} onClick={() => openEntity(`pilot:adjustment:${category.key}`)}>Modifier l’ajustement</button>}</div>
      <div className={styles.pilotInteraction}>{category.capabilities.adjustability === "ADJUSTABLE" ? <><h3>Comment voulez-vous tester ce mois ?</h3>{blocked ? <p>{model.editable ? "Deux choix sont déjà en cours. Retirez un choix pour tester ce poste." : "Ce mois est terminé."}</p> : <>{exact ? <div className={styles.exactPreview}><label>Réduire le reste prévu de (€)<input className={material.field} type="number" min="0.01" step="0.01" value={amount} onChange={event => { setAmount(event.target.value); setDirty(true); }} /></label><button type="button" className={secondary} disabled={pending || !(Number(amount) > 0)} onClick={() => { setDirty(false); replaceDraft({ kind: "CATEGORY", categoryKey: category.key, strategy: "REDUCE_AMOUNT", amount }); }}>Voir l’impact</button></div> : <PercentStepper min={-100} max={0} valuePercent={percent} label="la dépense restante" shortcuts={[-10, -20, -30]} onChange={changePercent} />}<div className={styles.quickChoices}><button type="button" className={styles.textAction} onClick={() => { setExact(!exact); setDirty(true); }}>{exact ? "Choisir un pourcentage" : "Montant précis"}</button>{presets.filter(row => row.operation.strategy === "REDUCE_ONE_OCCURRENCE" ? !!trial?.shortcuts.some(shortcut => shortcut.categoryKey === category.key && shortcut.operation.strategy === "REDUCE_ONE_OCCURRENCE") : row.operation.strategy === "REDUCE_AMOUNT" || row.operation.strategy === "REDUCE_PERCENT" && ["50", "100"].includes(row.operation.percent)).map(row => <button type="button" className={styles.smallChoice} key={row.label} disabled={pending} onClick={() => { setDirty(false); if (row.operation.strategy === "REDUCE_PERCENT") setPercent(-Number(row.operation.percent)); replaceDraft(row.operation); }}>{row.operation.strategy === "REDUCE_ONE_OCCURRENCE" ? "Une sortie en moins" : row.operation.strategy === "REDUCE_PERCENT" ? row.operation.percent === "50" ? "Deux fois moins" : "Plus aucune" : row.operation.strategy === "REDUCE_AMOUNT" ? `−${money(row.operation.amount)}` : row.label}</button>)}</div></>}</> : <p>Ce poste peut être suivi avec un repère. Il ne propose pas de réduction simulée.</p>}
        <div className={styles.pilotConsequence} aria-live="polite">{fresh && scenarioCategory ? <><div><span>Avec ce scénario</span><strong>{money(scenarioCategory.forecast)}</strong></div><div><span>En fin de mois</span><strong>+{money(trial.budgetMarginGain)}</strong></div><div><span>Fin de mois estimée</span><strong>{money(trial.scenario.projectionSummary.economic?.central)}</strong></div></> : <p>{pending ? "Calcul de votre scénario…" : op ? "Recalculez le scénario pour retrouver son impact." : "Votre mois reste inchangé. Testez un choix pour voir son impact."}</p>}</div>
      </div>
    </div>
    <div className={styles.categoryHistory} data-category-history="">{history?.status === "AVAILABLE" ? <><span>Vos mois précédents comparables · {history.count} mois</span><div><span><strong>{money(history.min)}</strong>Mois le plus bas</span><span><strong>{money(history.median)}</strong>Médiane</span><span><strong>{money(history.max)}</strong>Mois le plus haut</span></div><p>{money(category.forecast)} ce mois{scenarioCategory && ` · ${money(scenarioCategory.forecast)} dans le scénario`}</p></> : <p>Historique insuffisant</p>}</div>
  </LocalChoiceScreen>;
}

export function MonthInfoFacts({ model }: { model: MonthControlModel }) {
  return <div data-info-facts=""><h3>État des données</h3><dl><div><dt>Prévision</dt><dd>Calculée le {controlDate(model.reliability.computedAt, true)}</dd></div><div><dt>Imports récents</dt><dd>{model.reliability.importsMissing === null ? "À préciser" : model.reliability.importsMissing ? "Incomplets" : "Complets"}</dd></div><div><dt>Banque</dt><dd>Solde : {model.update.items.find(row => row.id === "BANK")?.amount === null ? "manquant" : money(model.update.items.find(row => row.id === "BANK")?.amount, true)}</dd></div>{(["SWILE", "EDENRED"] as const).map(key => { const wallet = model.resourceInputs.projections[key]; return <div key={key}><dt>{key === "SWILE" ? "Swile" : "Edenred"}</dt><dd>Solde : {wallet.currentBalanceKnowledge.amount === null ? "manquant" : money(wallet.currentBalanceKnowledge.amount, true)}<br />Chargement : {wallet.expectedLoading ? money(wallet.expectedLoading.amount, true) : "manquant"}<br />Date : {wallet.expectedLoading?.expectedDate ? controlDate(wallet.expectedLoading.expectedDate) : "manquante"}</dd></div>; })}<div><dt>Mode</dt><dd>{model.reliability.mode === "FULL_MONTH_SAFE" ? "Prudent" : "Au fil du mois"}</dd></div><div><dt>Historique</dt><dd>{model.reliability.exploitableMonths} mois exploitables</dd></div></dl></div>;
}
