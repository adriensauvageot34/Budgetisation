"use client";
import type { MonthControlModel } from "./month-control-center";
import type { MonthControlPurpose, MonthControlSection } from "@/domain/phase2/month-control-contract";
import { controlDate, controlMoney as money } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

type Destination = { section: MonthControlSection; focus?: string };
export function MonthControlOverview({ model, navigate, choosePurpose, showProject }: { model: MonthControlModel;
  navigate: (destination: Destination) => void; choosePurpose: (purpose: MonthControlPurpose) => void; showProject: (id: string) => void }) {
  const actions = model.rootCauses.filter(row => row.actionable), knowledge = model.rootCauses.filter(row => !row.actionable);
  const actionLabel = (key: string) => key === "bank-balance" ? "Renseigner le solde" : key === "wallet:SWILE" ? "Mettre à jour Swile" : key === "wallet:EDENRED" ? "Mettre à jour Edenred" : "Modifier";
  return <div className={styles.overview}>
    <header className={styles.reading}><h2 className="text-2xl font-black">{model.headline}</h2>
      <p className="mt-3 text-base">Reste prévu en fin de mois : <strong>≈ {money(model.projectionSummary.economic?.central)}</strong></p>
      {model.goalState === "NO_GOALS_DEFINED" && <button className={`${material.clayButton} mt-3 px-4 py-2 text-sm font-bold`} onClick={() => navigate({ section: "choices", focus: "goals" })}>Définir mes objectifs</button>}
      {model.projectionSummary.globalSatisfied && <p className="mt-2 text-sm text-emerald-900">Environ {money(model.projectionSummary.globalDelta)} de marge par rapport à votre objectif global.</p>}
    </header>
    {model.tensions.length > 0 && <section><h3 className="font-bold">Objectifs à regarder</h3><ul className="mt-2 divide-y divide-violet-100">{model.tensions.map(row => <li key={row.key} className={styles.causeRow}>
      <div><p className="font-bold">{row.label}</p><p className="mt-1 text-sm text-slate-600">{row.explanation}</p></div>
      <div className="flex shrink-0 items-center gap-3"><button className={styles.textAction} onClick={() => choosePurpose(row.kind === "GLOBAL_GOAL" ? { kind: "GLOBAL_GOAL" } : { kind: "CATEGORY_CORRECTION", categoryKey: row.categoryKey })}>{row.kind === "GLOBAL_GOAL" ? "Tester un ajustement" : row.alreadyOver ? "Limiter le reste" : "Corriger ce poste"}</button>
        {row.kind === "CATEGORY_TARGET" && <button className={styles.textAction} onClick={() => choosePurpose({ kind: "CATEGORY_OVERAGE_OFFSET", categoryKey: row.categoryKey })}>Compenser ailleurs</button>}</div>
    </li>)}</ul></section>}
    {actions.length > 0 && <section><h3 className="font-bold">À compléter</h3><ul className="mt-2 divide-y divide-violet-100">{actions.map(row => <li key={row.key} className={styles.causeRow}>
      <div><p className="font-semibold">{row.label}</p><details className="mt-1 text-sm text-slate-600"><summary className="cursor-pointer">Voir le détail</summary><p className={`${styles.reading} mt-2`}>{row.explanation}</p><ul className="mt-2">{row.symptoms.map(value => <li key={value}>{value}</li>)}</ul></details></div>
      <button className={`${material.clayButton} shrink-0 px-3 py-2 text-sm font-bold`} onClick={() => row.projectId ? showProject(row.projectId) : navigate(row.destination)}>{row.projectId ? "Voir le projet" : actionLabel(row.key)}</button>
    </li>)}</ul></section>}
    {knowledge.length > 0 && <div className={`${styles.knowledge} text-sm`}><strong>À savoir</strong><p className="mt-1 text-slate-600">{knowledge.map(row => row.label).join(" · ")}</p><button className={`${styles.textAction} mt-2`} onClick={() => navigate({ section: "reliability", focus: knowledge[0]!.destination.focus })}>Voir la fiabilité</button></div>}
    {model.observations.length > 0 && <section><h3 className="font-bold">Informations déclarées</h3><ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">{model.observations.map(row => <li key={row.key}>{row.label} : <strong>{money(row.amount, true)}</strong>{row.date && ` au ${controlDate(row.date)}`}</li>)}</ul></section>}
    <div className="grid grid-cols-2 gap-5">{([
      ["Intentions", model.activeIntentions], ["Décisions actives", model.activeDecisions], ["Réservations", model.reservations],
    ] as const).filter(([, rows]) => rows.length > 0).map(([title, rows]) => <section key={title}><h3 className="font-bold">{title}</h3>
      <ul className="mt-2 space-y-2">{rows.slice(0, 3).map(row => <li key={row.key} className="flex items-start justify-between gap-3 text-sm"><span>{row.label}<span className="block text-slate-600">{row.value}</span></span><button className={styles.textAction} onClick={() => navigate(row.destination)}>{row.actionLabel}</button></li>)}</ul>
      {rows.length > 3 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Voir les {rows.length - 3} autres</summary><ul className="mt-2 space-y-2">{rows.slice(3).map(row => <li key={row.key} className="flex items-start justify-between gap-3"><span>{row.label} · {row.value}</span><button className={styles.textAction} onClick={() => navigate(row.destination)}>{row.actionLabel}</button></li>)}</ul></details>}
    </section>)}</div>
  </div>;
}
