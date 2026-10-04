"use client";
import { useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import { useMonthLocalFocus } from "./month-control-focus";
import { ControlFormFields } from "./currency-stepper";
import { updateMonthInputs } from "./actions";
import { controlMoney as money } from "@/domain/phase2/month-control-display";
import { choicePage, rankChoiceCategories } from "@/domain/phase2/month-choice-ui-draft";
import { LocalChoiceScreen, ChoiceTile, ChoicePages, TargetGauge, secondary } from "./month-choice-controls";
import { TargetFocus, GoalFocus, AdjustmentFocus, SavingsFocus } from "./month-choice-editors";
import styles from "./month-control-center.module.css";

export function MonthChoicesHub({ model, draftCount, gain }: { model: MonthControlModel; draftCount: number; gain?: string }) {
  const { openEntity } = useMonthLocalFocus();
  const active = model.categoryControls.filter(row => model.settings.assumptions[row.key]);
  const top = rankChoiceCategories(model.categoryControls).filter(row => row.capabilities.adjustability === "ADJUSTABLE").slice(0, 2);
  const hubs = [
    { icon: "🎯", title: "Mes repères", focus: "goals", summary: model.goalCount ? `${model.goalCount} repère${model.goalCount > 1 ? "s" : ""} défini${model.goalCount > 1 ? "s" : ""}` : "Aucun repère défini", detail: model.goalCount ? `${model.tensions.length} dépassé${model.tensions.length > 1 ? "s" : ""}` : top.map(row => `${row.label} ≈ ${money(row.forecast)}`).join(" · "), cta: "Gérer" },
    { icon: "✨", title: "Tester un scénario", focus: "simulator", summary: draftCount ? `${draftCount} choix en cours` : "Aucune simulation en cours", detail: draftCount && gain ? `+${money(gain)} estimés en fin de mois` : "Voir l’impact d’un mois différent", cta: draftCount ? "Continuer" : "Tester" },
    { icon: "✓", title: "Mes ajustements", focus: "adjustments", summary: active.length ? `${active.length} ajustement${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""}` : "Aucun ajustement actif", detail: active.length ? active.slice(0, 2).map(row => row.label).join(" · ") : "Vos habitudes habituelles restent utilisées.", cta: "Gérer" },
    { icon: "🔒", title: "Mes cagnottes", focus: "savings", summary: model.savings.length ? `${model.savings.length} cagnotte${model.savings.length > 1 ? "s" : ""}` : "Aucune cagnotte pour ce mois", detail: model.savings.length === 1 ? `${model.savings[0]!.label} · ${money(model.savings[0]!.amount, true)}` : model.savings.length ? `${money(model.projectionSummary.totalSavings, true)} mis de côté` : "Mettre de l’argent de côté pour un projet", cta: "Gérer" },
  ];
  return <div className={styles.hubGrid} data-choices-root="">{hubs.map(hub => <button type="button" key={hub.focus} className={styles.hubCard} data-control-hub={hub.focus} onClick={() => openEntity(hub.focus)}><span className={styles.hubIcon} aria-hidden="true">{hub.icon}</span><h3>{hub.title}</h3><p className={styles.hubSummary}>{hub.summary}</p><p className={styles.hubDetail}>{hub.detail}</p><span className={styles.hubCta}>{hub.cta} →</span></button>)}</div>;
}
export function MonthControlLimits({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus(), [page, setPage] = useState(0), [tracking, setTracking] = useState(false);
  const all = rankChoiceCategories(model.categoryControls.filter(row => row.capabilities.targetAllowed));
  const rows = all.filter(row => (row.capabilities.adjustability === "FIXED") === tracking);
  return <LocalChoiceScreen title={tracking ? "Les postes à suivre" : "Mes repères"} back={() => tracking ? (setTracking(false), setPage(0)) : openEntity(null)} subtitle="Des repères pour ce mois, sans modifier les dépenses prévues." footer={<><button type="button" className={secondary} onClick={() => openEntity("global-goal")}>Objectif de fin de mois{model.settings.goal !== null && ` · ${money(model.settings.goal, true)}`}</button>{all.some(row => row.capabilities.adjustability === "FIXED") && !tracking && <button type="button" className={styles.textAction} onClick={() => { setTracking(true); setPage(0); }}>À suivre →</button>}</>}>
    <div className={styles.tileGrid}>{choicePage(rows, page).map(row => <ChoiceTile key={row.key} title={row.label} active={row.target !== null} onClick={() => openEntity(`category:${row.key}`)}><span>Prévu {money(row.forecast)}</span>{row.target !== null ? <><span>Votre repère {money(row.target, true)}</span><span>{Number(row.varianceToTarget) > 0 ? `${money(row.varianceToTarget)} au-dessus` : "Dans votre repère"}</span><TargetGauge forecast={row.forecast} realized={row.realized} target={row.target} /></> : <span>Définir un repère →</span>}</ChoiceTile>)}</div><ChoicePages count={rows.length} page={page} setPage={setPage} />
  </LocalChoiceScreen>;
}
export function MonthControlActiveChoices({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus(), [page, setPage] = useState(0), [adding, setAdding] = useState(false);
  const active = model.categoryControls.filter(row => model.settings.assumptions[row.key]);
  const candidates = rankChoiceCategories(model.categoryControls.filter(row => row.capabilities.adjustability === "ADJUSTABLE" && !model.settings.assumptions[row.key]));
  return <LocalChoiceScreen kind="persisted" title={adding ? "Quelle habitude ajuster ?" : "Mes ajustements"} back={() => adding ? (setAdding(false), setPage(0)) : openEntity(null)} footer={!adding ? <button type="button" className={secondary} onClick={() => { setAdding(true); setPage(0); }}>Ajouter un ajustement</button> : undefined}>
    {adding ? <><div className={styles.tileGrid}>{choicePage(candidates, page).map(row => <ChoiceTile key={row.key} title={row.label} onClick={() => openEntity(`choice:${row.key}`)} />)}</div><ChoicePages count={candidates.length} page={page} setPage={setPage} /></> : active.length ? <><div className={styles.adjustmentList}>{choicePage(active, page, 4).map(row => { const setting = model.settings.assumptions[row.key]!; return <article key={row.key} className={styles.activeAdjustment}><div><h3>{row.label}</h3><p>{setting.mode === "CUSTOM" ? Number(setting.amount) === 0 ? "Aucune autre dépense habituelle prévue ce mois" : `Reste prévu fixé à ${money(setting.amount, true)}` : setting.mode === "LOWER" ? "20 % de moins que d’habitude" : "20 % de plus que d’habitude"}</p></div><button type="button" className={secondary} onClick={() => openEntity(`choice:${row.key}`)}>Modifier</button><form action={updateMonthInputs}><ControlFormFields month={model.targetMonth} intent="clear-month-assumption" values={{ categoryKey: row.key }} /><button className={styles.textAction}>Annuler</button></form></article>; })}</div><ChoicePages size={4} count={active.length} page={page} setPage={setPage} /></> : <div className={styles.emptyChoice}><span aria-hidden="true">✓</span><h3>Aucun ajustement actif</h3><p>Vos habitudes habituelles servent actuellement de référence.</p></div>}
  </LocalChoiceScreen>;
}
export function MonthControlSavings({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus(), [page, setPage] = useState(0);
  return <LocalChoiceScreen title="Mes cagnottes" back={() => openEntity(null)} footer={<button type="button" className={secondary} onClick={() => openEntity("savings:new")}>Ajouter une cagnotte</button>}>
    {model.savings.length ? <><div className={styles.optionGrid}>{choicePage(model.savings, page, 4).map(row => <ChoiceTile key={row.id} title={`${row.adjustability === "PROTECTED" ? "🔒 " : ""}${row.label}`} onClick={() => openEntity(`savings:${row.id}`)}><strong className={styles.savingAmount}>{money(row.amount, true)}</strong><span>{row.adjustability === "PROTECTED" ? "Protégée" : "Ajustable"}</span><span>Modifier →</span></ChoiceTile>)}</div><ChoicePages size={4} count={model.savings.length} page={page} setPage={setPage} /></> : <div className={styles.emptyChoice}><span aria-hidden="true">🔒</span><h3>Votre prochain projet commence ici</h3><p>Aucune cagnotte affectée à ce mois.</p></div>}
  </LocalChoiceScreen>;
}
export function MonthChoiceFocus({ model }: { model: MonthControlModel }) {
  const { entity, openEntity } = useMonthLocalFocus();
  const category = model.categoryControls.find(row => row.capabilities.targetAllowed && entity === `category:${row.key}`), choice = model.categoryControls.find(row => row.capabilities.adjustability === "ADJUSTABLE" && entity === `choice:${row.key}`);
  const saving = model.savings.find((row, index) => entity === `savings:${row.id}` || entity === `reserve-${index + 1}`);
  return <div className={styles.localChoiceContainer} data-local-focus={entity}>{category ? <TargetFocus key={`${category.key}:${category.target}`} model={model} category={category} /> : entity === "global-goal" ? <GoalFocus key={model.settings.goal} model={model} /> : choice ? <AdjustmentFocus key={`${choice.key}:${JSON.stringify(model.settings.assumptions[choice.key])}`} model={model} category={choice} /> : saving || entity === "savings:new" ? <SavingsFocus key={`${saving?.id}:${saving?.amount}:${saving?.adjustability}`} model={model} saving={saving} /> : <LocalChoiceScreen title="Ce choix n’est plus disponible" back={() => openEntity(null)}><p>Revenez aux actions du mois.</p></LocalChoiceScreen>}</div>;
}
