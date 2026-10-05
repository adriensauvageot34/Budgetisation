"use client";
import { LockKeyhole, Plus } from "lucide-react";
import type { MonthControlModel } from "./month-control-center";
import { useMonthLocalFocus } from "./month-control-focus";
import { controlMoney as money } from "@/domain/phase2/month-control-display";
import { LocalChoiceScreen, ChoiceTile, secondary } from "./month-choice-controls";
import { TargetFocus, GoalFocus, AdjustmentFocus, SavingsFocus } from "./month-choice-editors";
import styles from "./month-control-center.module.css";

export function MonthControlSavings({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus();
  return <LocalChoiceScreen title="Mes cagnottes" subtitle={`${money(model.projectionSummary.totalSavings, true)} mis de côté`} back={() => openEntity(null)}>
    {model.savings.length ? <div className={styles.horizontalCards}>{model.savings.map(row => <ChoiceTile key={row.id} title={row.label} onClick={() => openEntity(`savings:${row.id}`)}>{row.adjustability === "PROTECTED" && <LockKeyhole size={20} aria-label="Protégée" />}<strong className={styles.savingAmount}>{money(row.amount, true)}</strong><span>{row.adjustability === "PROTECTED" ? "Intouchable ce mois-ci" : "Ajustable si nécessaire"}</span><span>{money(row.amount, true)} retirés du disponible</span></ChoiceTile> )}<ChoiceTile title="Ajouter une cagnotte" onClick={() => openEntity("savings:new")}><Plus size={24} /></ChoiceTile></div> : <div className={styles.emptyChoice}><span aria-hidden="true"><LockKeyhole size={26} /></span><h3>Votre prochain projet commence ici</h3><p>Aucune cagnotte affectée à ce mois.</p></div>}
  </LocalChoiceScreen>;
}
export function MonthChoiceFocus({ model }: { model: MonthControlModel }) {
  const { entity, openEntity } = useMonthLocalFocus();
  const category = model.categoryControls.find(row => row.capabilities.targetAllowed && entity === `category:${row.key}`), choice = model.categoryControls.find(row => row.capabilities.adjustability === "ADJUSTABLE" && entity === `choice:${row.key}`);
  const saving = model.savings.find((row, index) => entity === `savings:${row.id}` || entity === `reserve-${index + 1}`);
  return <div className={styles.localChoiceContainer} data-local-focus={entity}>{category ? <TargetFocus key={`${category.key}:${category.target}`} model={model} category={category} /> : entity === "global-goal" ? <GoalFocus key={model.settings.goal} model={model} /> : choice ? <AdjustmentFocus key={`${choice.key}:${JSON.stringify(model.settings.assumptions[choice.key])}`} model={model} category={choice} /> : saving || entity === "savings:new" ? <SavingsFocus key={`${saving?.id}:${saving?.amount}:${saving?.adjustability}`} model={model} saving={saving} /> : <LocalChoiceScreen title="Ce choix n’est plus disponible" back={() => openEntity(null)}><p>Revenez aux actions du mois.</p></LocalChoiceScreen>}</div>;
}
