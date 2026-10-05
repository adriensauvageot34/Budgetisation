"use client";
import { SlidersHorizontal, LockKeyhole, RefreshCw } from "lucide-react";
import type { MonthControlModel } from "./month-control-center";
import type { previewMonthControlCenter } from "./actions";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { controlMoney as money, controlDate } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, ChoiceTile, secondary } from "./month-choice-controls";
import styles from "./month-control-center.module.css";
import { MonthPilotSummary } from "./month-pilot-scenario";
type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;

export function MonthWorkspaceRoot({ model, draftCount }: { model: MonthControlModel; draftCount: number }) {
  const { openEntity } = useMonthLocalFocus();
  const needs = model.update.groups.NEEDS_UPDATE;
  return <div className={styles.workspaceRoot} data-workspace-root="">
    <button type="button" className={`${styles.hubCard} ${styles.pilotCard}`} data-control-hub="pilot" onClick={() => openEntity("pilot")}><span className={styles.hubIcon} aria-hidden="true"><SlidersHorizontal size={26} /></span><h3>Piloter mon mois</h3><p className={styles.hubSummary}>Tester, se fixer un budget cible et appliquer des ajustements.</p><p className={styles.hubDetail}>{draftCount ? `${draftCount} poste${draftCount > 1 ? "s" : ""} testé${draftCount > 1 ? "s" : ""}` : `${model.categoryControls.length} postes · ${model.goalCount ? `${model.goalCount} budgets cibles définis` : "vos budgets cibles à portée de main"}`}</p></button>
    <button type="button" className={`${styles.hubCard} ${styles.savingsCard}`} data-control-hub="savings" onClick={() => openEntity("savings")}><span className={styles.hubIcon} aria-hidden="true"><LockKeyhole size={26} /></span><h3>Mes cagnottes</h3><p className={styles.hubSummary}>{model.savings.length ? `${model.savings.length} cagnotte${model.savings.length > 1 ? "s" : ""}` : "Votre prochain projet"}</p><p className={styles.hubDetail}>{model.savings.length === 1 ? `${model.savings[0]!.label} · ${money(model.savings[0]!.amount, true)}` : model.savings.length ? `${money(model.projectionSummary.totalSavings, true)} mis de côté` : "Mettre de l’argent de côté"}</p></button>
    <button type="button" className={`${styles.hubCard} ${styles.updateCard}`} data-control-hub="update" onClick={() => openEntity("update")}><span className={styles.hubIcon} aria-hidden="true"><RefreshCw size={26} /></span><h3>Mettre à jour</h3>{needs.length > 0 && <span className={styles.cardBadge} aria-label={`${needs.length} informations à actualiser`}>{needs.length}</span>}<p className={styles.hubSummary}>{needs.length ? `${needs.slice(0, 3).map(row => row.label).join(" · ")} à actualiser${needs.length > 3 ? ` · ${needs.length - 3} autres` : ""}` : "Toutes vos informations sont à jour"}</p></button>
  </div>;
}

export function MonthPilotIndex({ model, draftCount, trial, operations = [], pending = false, apply = () => {}, remove = () => {} }: { model: MonthControlModel; draftCount: number; trial?: Workbench | null; operations?: readonly MonthChoiceOperation[]; pending?: boolean; apply?: () => void; remove?: (target: string | null) => void }) {
  const { openEntity } = useMonthLocalFocus();
  const sorted = [...model.categoryControls].sort((a, b) => Number(!!model.settings.assumptions[b.key]) - Number(!!model.settings.assumptions[a.key]) || Number(Number(b.varianceToTarget) > 0) - Number(Number(a.varianceToTarget) > 0) || Number(b.forecast) - Number(a.forecast));
  const active = Object.keys(model.settings.assumptions).length;
  return <LocalChoiceScreen title="Piloter mon mois" subtitle={<span className={styles.decisionState}>{active ? `${active} ajustement${active > 1 ? "s" : ""} appliqué${active > 1 ? "s" : ""}` : "Aucun ajustement appliqué"}{active > 0 && model.appliedMarginGain !== null && <span>{Number(model.appliedMarginGain) >= 0 ? "+" : ""}{money(model.appliedMarginGain)} de marge estimée</span>}</span>} back={() => openEntity(null)} footer={<><button type="button" className={secondary} onClick={() => openEntity("global-goal")}>Objectif de fin de mois{model.settings.goal !== null && ` · ${money(model.settings.goal)}`}</button></>}>
    <MonthPilotSummary model={model} operations={operations} trial={trial ?? null} pending={pending} apply={apply} remove={remove} />
    <div className={styles.pilotGrid} data-pilot-categories="">{sorted.map(row => <ChoiceTile key={row.key} focusKey={`pilot:category:${row.key}`} quiet={row.capabilities.adjustability === "FIXED"} title={row.label} active={row.target !== null || !!model.settings.assumptions[row.key]} onClick={() => openEntity(`pilot:category:${row.key}`)}><span>{money(row.forecast)}{operations.some(op => op.kind === "CATEGORY" && op.categoryKey === row.key) || trial?.selected.some(other => other.target === `category:${row.key}`) ? ` → ${money(trial?.scenario.categoryControls.find(other => other.key === row.key)?.forecast ?? (operations.find(op => op.kind === "CATEGORY" && op.categoryKey === row.key && op.strategy === "TEST_AMOUNT") as Extract<MonthChoiceOperation, { strategy: "TEST_AMOUNT" }> | undefined)?.amount)} · Dans le scénario` : " prévus"}</span>{row.target !== null && <span>Budget cible {money(row.target)}{Number(row.varianceToTarget) > 0 && ` · ${money(row.varianceToTarget)} au-dessus`}</span>}<span>{model.settings.assumptions[row.key] ? "Ajustement appliqué" : row.capabilities.adjustability === "FIXED" ? "Suivi uniquement" : ""}</span></ChoiceTile>)}</div>
  </LocalChoiceScreen>;
}

export function MonthInfoFacts({ model }: { model: MonthControlModel }) {
  return <div data-info-facts=""><h3>État des données</h3><dl><div><dt>Prévision</dt><dd>Calculée le {controlDate(model.reliability.computedAt, true)}</dd></div><div><dt>Imports récents</dt><dd>{model.reliability.importsMissing === null ? "À préciser" : model.reliability.importsMissing ? "Incomplets" : "Complets"}</dd></div><div><dt>Banque</dt><dd>Solde : {model.update.items.find(row => row.id === "BANK")?.amount === null ? "manquant" : money(model.update.items.find(row => row.id === "BANK")?.amount, true)}</dd></div>{(["SWILE", "EDENRED"] as const).map(key => { const wallet = model.resourceInputs.projections[key]; return <div key={key}><dt>{key === "SWILE" ? "Swile" : "Edenred"}</dt><dd>Solde : {wallet.currentBalanceKnowledge.amount === null ? "manquant" : money(wallet.currentBalanceKnowledge.amount, true)}<br />Chargement : {wallet.expectedLoading ? money(wallet.expectedLoading.amount, true) : "manquant"}<br />Date : {wallet.expectedLoading?.expectedDate ? controlDate(wallet.expectedLoading.expectedDate) : "manquante"}</dd></div>; })}<div><dt>Mode</dt><dd>{model.reliability.mode === "FULL_MONTH_SAFE" ? "Prudent" : "Au fil du mois"}</dd></div><div><dt>Historique</dt><dd>{model.reliability.exploitableMonths} mois exploitables</dd></div></dl></div>;
}
