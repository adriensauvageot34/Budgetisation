"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { preserveMonthForecast, updateMonthInputs, type simulateMonthBehavior } from "./actions";
import { categoryDecisionCapabilities, type CategoryDecisionCapabilities } from "@/domain/phase2/month-choice-contract";
import { AnimatedMoney } from "./animated-money";
import material from "./month-material.module.css";
type MonthDecisionProjection = Extract<Awaited<ReturnType<typeof simulateMonthBehavior>>, { ok: true }>["decision"];
type MonthCategoryControl = MonthDecisionProjection["categoryControls"][number];

const money = (value: string | number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
const button = `${material.clayButton} px-4 py-2 text-sm font-bold disabled:opacity-50`;
const field = `${material.field} px-3 py-2 text-sm`;

export function MonthAssumptionEditor({ categoryKey, label, targetMonth, settings, capabilities }: {
  categoryKey: string; label: string; targetMonth: string; settings: MonthDecisionSettings; capabilities?: CategoryDecisionCapabilities }) {
  if (categoryDecisionCapabilities(categoryKey, capabilities)?.adjustability !== "ADJUSTABLE") return null;
  const assumption = settings.assumptions[categoryKey as keyof typeof settings.assumptions];
  return <details className={`${material.disclosure} mt-3 border-t border-slate-100 pt-3 text-xs`}><summary className="cursor-pointer font-semibold text-emerald-900">{label} · {assumption ? "hypothèse personnelle" : "comme d’habitude"}</summary>
    <p className="mt-2 text-slate-600">{assumption ? "Hypothèse personnelle active pour ce mois." : "Comme d’habitude : références historiques."} Moins / Plus ajuste le reste de 20 %. Le montant personnel vise le reste à dépenser ; les achats déjà faits et les projets explicites restent comptés.</p>
    <form action={updateMonthInputs} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-month-assumption" /><input type="hidden" name="categoryKey" value={categoryKey} />
      <label><span className="sr-only">Hypothèse pour {label}</span><select className={field} name="assumptionMode" defaultValue={assumption?.mode ?? "LOWER"}><option value="LOWER">Moins ce mois</option><option value="HIGHER">Plus ce mois</option><option value="CUSTOM">Montant personnel</option></select></label>
      <label><span className="sr-only">Reste à dépenser pour {label}</span><input className={`${field} w-32`} name="assumptionAmount" type="number" min="0" step="0.01" placeholder="Reste en €" defaultValue={assumption?.amount ?? ""} /></label>
      <button className={button}>Appliquer ce mois</button></form>
    {assumption && <form action={updateMonthInputs} className="mt-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="clear-month-assumption" /><input type="hidden" name="categoryKey" value={categoryKey} /><button className="font-bold underline">Revenir aux habitudes historiques</button></form>}
  </details>;
}

export function CategoryTargetEditor({ control, targetMonth }: { control: MonthCategoryControl; targetMonth: string }) {
  if (!control.capabilities.targetAllowed) return null;
  return <div className="mt-4 border-t border-violet-100 pt-3 text-sm">
    {control.target !== null && <div className={`${material.glassSoft} rounded-2xl p-3`}>
      <dl className="space-y-1">{[["Objectif", control.target], ["Réel", control.realized], ["Prévu ce mois", control.forecast]].map(([label, amount]) =>
        <div className="flex justify-between gap-2" key={label}><dt>{label}</dt><dd className="font-bold">{money(amount!)}</dd></div>)}</dl>
      <p className={`mt-2 font-bold ${control.status === "UNDER_TARGET" || control.status === "ON_TARGET" ? "text-emerald-800" : "text-amber-900"}`}>
        {control.status === "ALREADY_OVER_TARGET" ? `Objectif déjà dépassé de ${money(control.realizedOverTarget)}`
          : control.status === "FORECAST_OVER_TARGET" ? `Dépassement prévu : +${money(control.varianceToTarget!)}`
          : control.status === "ON_TARGET" ? "Projection à l’objectif" : `Marge prévue : ${money(control.marginToTarget!)}`}</p>
      <p className="mt-1 text-xs text-slate-600">Réel = observé + déclaré réalisé, après rapprochement. Une déclaration n’est pas un débit bancaire.</p>
    </div>}
    <details className={`${material.disclosure} mt-2`}><summary className="cursor-pointer font-bold text-violet-900">{control.target === null ? "Définir un objectif" : "Modifier l’objectif"}</summary>
      <form action={updateMonthInputs} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-category-target" /><input type="hidden" name="categoryKey" value={control.key} />
        <label className="grid gap-1 text-xs">Objectif {control.label} (€)<input className={`${field} w-32`} type="number" name="categoryTarget" min="0" step="0.01" required defaultValue={control.target ?? ""} /></label>
        <button className={button}>Enregistrer</button></form>
      <p className="mt-2 text-xs text-slate-600">Un repère pour ce mois, sans création de dépense ni copie au mois suivant.</p>
    </details>
    {control.target !== null && <form action={updateMonthInputs} className="mt-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="clear-category-target" /><input type="hidden" name="categoryKey" value={control.key} /><button className="text-xs font-bold underline">Retirer l’objectif</button></form>}
  </div>;
}

export function MonthGoalEditor({ targetMonth, settings, goal }: { targetMonth: string; settings: MonthDecisionSettings;
  goal: { globalDelta: string | null; globalSatisfied: boolean } }) {
  return <section className={`${material.glassSoft} p-4`}><h3 className="font-bold">Notre objectif de fin de mois</h3>
    <p className="mt-2 text-xs text-slate-600">Un repère personnel, sans déduction ni création de dépense. Il ne se transmet pas au mois suivant.</p>
    <form action={updateMonthInputs} className="mt-3 flex items-end gap-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-month-goal" />
      <label className="text-sm">Garder au moins<input className={`${field} ml-2 w-32`} type="number" min="0" step="0.01" name="monthGoal" required defaultValue={settings.goal ?? ""} /> €</label><button className={button}>Enregistrer l’objectif</button></form>
    {settings.goal !== null && <><p className="mt-3 text-sm">{goal.globalSatisfied ? "Objectif respecté" : "Écart à l’objectif"} · {goal.globalDelta === null ? "Projection à compléter" : money(goal.globalDelta)}</p>
      <form action={updateMonthInputs} className="mt-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="clear-month-goal" /><button className="text-xs font-bold underline">Retirer l’objectif</button></form></>}
  </section>;
}

export function PreserveForecastButton({ targetMonth }: { targetMonth: string }) {
  const router = useRouter(), [pending, startTransition] = useTransition(), [message, setMessage] = useState<string | null>(null);
  return <div className="mt-5"><button className={button} disabled={pending} onClick={() => startTransition(async () => {
    try { const result = await preserveMonthForecast(targetMonth); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("L’estimation n’a pas été conservée. Réessayez."); }
  })}>{pending ? "Enregistrement…" : "Conserver cette estimation"}</button>
    <p className="mt-2 text-xs text-slate-600">Un repère immuable, créé uniquement sur votre action explicite. Une consultation n’enregistre rien.</p>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}
