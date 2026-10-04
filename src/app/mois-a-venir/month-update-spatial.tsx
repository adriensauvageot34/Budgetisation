"use client";
import type { MonthControlModel } from "./month-control-center";
import { MONTH_UPDATE_STATUSES, nextMonthUpdateItem, type MonthUpdateItem, type MonthUpdateStatus } from "@/domain/phase2/month-update-status";
import { controlMoney as money, controlMonth, controlDate } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, primary, secondary } from "./month-choice-controls";
import { MonthUpdateControls } from "./month-control-update";
import { ControlFormFields } from "./currency-stepper";
import { updateMonthInputs } from "./actions";
import styles from "./month-control-center.module.css";
const statusCopy: Record<MonthUpdateStatus, { icon: string; label: string; empty: string }> = {
  NEEDS_UPDATE: { icon: "⚠", label: "À actualiser", empty: "Toutes vos informations sont à jour" },
  MODIFIED: { icon: "✎", label: "Modifiés", empty: "Aucune exception pour ce mois" },
  DISABLED: { icon: "⏸", label: "Désactivés", empty: "Aucun élément désactivé" },
  CONFIRMED: { icon: "✓", label: "Confirmés", empty: "Aucune confirmation explicite" },
};
function summary(row: MonthUpdateItem, month: string) { return row.status === "DISABLED" ? `Désactivé pour ${controlMonth(month)}` : row.summary; }
export function MonthUpdateSpatial({ model, refreshing }: { model: MonthControlModel; refreshing: boolean }) {
  const { entity, openEntity } = useMonthLocalFocus();
  const focus = entity && !entity.startsWith("update") ? `update:item:${entity}` : entity ?? "update", update = model.update;
  const statusKey = focus.startsWith("update:status:") ? focus.slice(14) as MonthUpdateStatus : null;
  const reference = focus === "update:references";
  const itemKey = focus.startsWith("update:item:") ? focus.slice(12) : focus.startsWith("update:triage:") ? focus.slice(14) : null;
  const item = update.items.find(row => row.id === itemKey || row.focus === itemKey);
  const nextKey = focus.startsWith("update:next:") ? focus.slice(12) : null;
  if (nextKey !== null) { const progress = nextMonthUpdateItem(update.items, nextKey); return <LocalChoiceScreen title={refreshing ? "Mise à jour du mois…" : progress.remaining ? "Information enregistrée" : "Tout est à jour"} backLabel="Retour à Mettre à jour" back={() => openEntity("update")} footer={!refreshing && progress.next ? <button type="button" className={primary} onClick={() => openEntity(`update:triage:${progress.next!.id}`)}>Continuer avec {progress.next.label}</button> : <button type="button" className={secondary} onClick={() => openEntity("update")}>Retour à Mettre à jour</button>}><div className={styles.emptyChoice}><span aria-hidden="true">✓</span><h3>{refreshing ? "Recalcul en cours" : progress.remaining ? `${progress.remaining} information${progress.remaining > 1 ? "s" : ""} à actualiser` : "Toutes vos informations sont à jour"}</h3>{!refreshing && progress.next && <p>Prochaine information : {progress.next.label}</p>}</div></LocalChoiceScreen>; }
  if (item) return <div className={styles.updateEditor} data-update-item={item.id} data-update-triage={focus.startsWith("update:triage:") ? "true" : "false"}><MonthUpdateControls model={model} data={update.data} focus={item.focus} back={() => openEntity(item.status === "NEEDS_UPDATE" ? "update:status:NEEDS_UPDATE" : item.status ? `update:status:${item.status}` : "update:references")} triage={focus.startsWith("update:triage:")} /></div>;
  if (reference || statusKey && MONTH_UPDATE_STATUSES.includes(statusKey)) {
    const rows = reference ? update.references : update.groups[statusKey!];
    const selected = rows.find(row => focus.endsWith(`:${row.id}`)) ?? rows[0];
    return <LocalChoiceScreen title={reference ? "Prévisions habituelles" : statusCopy[statusKey!].label} subtitle={reference ? "Des références accessibles, sans confirmation enregistrée." : `${rows.length} élément${rows.length > 1 ? "s" : ""}`} backLabel="Retour à Mettre à jour" back={() => openEntity("update")}>
      {rows.length ? <StatusMasterDetail key={focus} rows={rows} model={model} triage={statusKey === "NEEDS_UPDATE"} initial={selected!.id} /> : <div className={styles.emptyChoice}><span aria-hidden="true">{reference ? "≈" : statusCopy[statusKey!].icon}</span><h3>{reference ? "Aucune référence supplémentaire" : statusCopy[statusKey!].empty}</h3></div>}
    </LocalChoiceScreen>;
  }
  return <LocalChoiceScreen title="Mettre à jour" subtitle="Ce qui demande votre attention et ce qui a changé." back={() => openEntity(null)} footer={update.references.length > 0 ? <button type="button" className={styles.textAction} onClick={() => openEntity("update:references")}>Prévisions habituelles · {update.references.length} références</button> : undefined}>
    <div className={styles.spatialMap} data-update-spatial="">{MONTH_UPDATE_STATUSES.map(status => { const rows = update.groups[status], copy = statusCopy[status]; return <button type="button" key={status} data-update-status={status} className={styles.statusZone} onClick={() => openEntity(`update:status:${status}`)}><header><span aria-hidden="true">{copy.icon}</span><h3>{copy.label}</h3><span>{rows.length}</span></header>{rows.length ? <ul>{rows.slice(0, 3).map(row => <li key={row.id}><span>{row.label}</span>{row.amount !== null && status !== "NEEDS_UPDATE" && <strong>{money(row.amount, true)}</strong>}</li>)}{rows.length > 3 && <li className={styles.moreItems}>+ {rows.length - 3} autres</li>}</ul> : <p>{copy.empty}</p>}</button>; })}</div>
  </LocalChoiceScreen>;
}
import { useState } from "react";
function StatusMasterDetail({ rows, initial, model, triage }: { rows: readonly MonthUpdateItem[]; initial: string; model: MonthControlModel; triage: boolean }) {
  const [id, setId] = useState(initial), { openEntity } = useMonthLocalFocus();
  const row = rows.find(item => item.id === id) ?? rows[0]!;
  return <div className={styles.statusDetail}><nav className={styles.itemRail} aria-label="Informations du mois">{rows.map(item => <button key={item.id} type="button" className={styles.smallChoice} aria-pressed={row.id === item.id} onClick={() => setId(item.id)}>{item.label}</button>)}</nav><article data-update-selected={row.id} data-status={row.status}><span className={styles.detailIcon} aria-hidden="true">{row.status ? statusCopy[row.status].icon : "≈"}</span><h3>{row.label}</h3><p>{summary(row, model.targetMonth)}</p>{row.amount !== null && <strong className={styles.detailAmount}>{money(row.amount, true)}</strong>}{row.date && <p>{controlDate(row.date)}</p>}<div className={styles.detailActions}>{row.status === "DISABLED" ? <form action={updateMonthInputs} data-after-save={`update:item:${row.id}`}><ControlFormFields month={model.targetMonth} intent={row.sourceKind === "CONDITIONAL" ? "unknown-conditional" : "restore-fixed"} values={{ componentKey: row.id }} /><button className={secondary}>Réactiver</button></form> : null}<button type="button" className={row.status === "NEEDS_UPDATE" ? primary : secondary} onClick={() => openEntity(`update:${triage ? "triage" : "item"}:${row.id}`)}>{row.status === "NEEDS_UPDATE" ? "Renseigner cette information" : row.status === "DISABLED" ? "Modifier" : row.status === "CONFIRMED" ? "Corriger" : "Modifier pour ce mois"}</button></div></article></div>;
}
