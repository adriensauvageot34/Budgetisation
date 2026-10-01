"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import type { MonthDecisionProjection } from "@/server/phase2/month-decision-projection";
import { preserveMonthForecast, simulateMonthBehavior, updateMonthInputs } from "./actions";

const money = (value: string | number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
const button = "rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50";
const field = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

export function MonthAssumptionEditor({ categoryKey, label, targetMonth, settings }: {
  categoryKey: string; label: string; targetMonth: string; settings: MonthDecisionSettings }) {
  if (categoryKey === "manon-work-mobility") return null;
  const assumption = settings.assumptions[categoryKey as keyof typeof settings.assumptions];
  return <details className="mt-3 border-t border-slate-100 pt-3 text-xs"><summary className="cursor-pointer font-semibold text-emerald-900">{label} · {assumption ? "hypothèse personnelle" : "comme d’habitude"}</summary>
    <p className="mt-2 text-slate-600">{assumption ? "Hypothèse personnelle active pour ce mois." : "Comme d’habitude : références historiques."} Moins / Plus ajuste de 20 %. Le montant personnel vise le total du mois ; les achats déjà faits et les projets explicites restent comptés.</p>
    <form action={updateMonthInputs} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-month-assumption" /><input type="hidden" name="categoryKey" value={categoryKey} />
      <label><span className="sr-only">Hypothèse pour {label}</span><select className={field} name="assumptionMode" defaultValue={assumption?.mode ?? "LOWER"}><option value="LOWER">Moins ce mois</option><option value="HIGHER">Plus ce mois</option><option value="CUSTOM">Montant personnel</option></select></label>
      <label><span className="sr-only">Montant personnel pour {label}</span><input className={`${field} w-32`} name="assumptionAmount" type="number" min="0" step="0.01" placeholder="Total en €" defaultValue={assumption?.amount ?? ""} /></label>
      <button className={button}>Appliquer ce mois</button></form>
    {assumption && <form action={updateMonthInputs} className="mt-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="clear-month-assumption" /><input type="hidden" name="categoryKey" value={categoryKey} /><button className="font-bold underline">Revenir aux habitudes historiques</button></form>}
  </details>;
}

export function MonthDecisionTools({ targetMonth, settings, decision }: { targetMonth: string; settings: MonthDecisionSettings; decision: MonthDecisionProjection }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [trial, setTrial] = useState<Awaited<ReturnType<typeof simulateMonthBehavior>> | null>(null);
  const simulate = (preset: string) => startTransition(async () => {
    try { setTrial(await simulateMonthBehavior(targetMonth, preset)); setMessage(null); }
    catch { setMessage("La simulation n’a pas abouti. Votre mois est inchangé ; réessayez."); }
  });
  return <section id="decision-tools" className="scroll-mt-24 rounded-2xl bg-slate-50 p-6" aria-labelledby="decision-title">
    <h2 id="decision-title" className="text-2xl font-black">Explorer nos choix</h2>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={button} disabled={pending} onClick={() => simulate("restaurant-zero")}>Pas de restaurant supplémentaire</button>
      <button className={button} disabled={pending} onClick={() => simulate("groceries-minus-100")}>Courses : 100 € de moins</button>
      <button className={button} disabled={pending} onClick={() => simulate("tobacco-minus-20")}>Tabac & vape : 20 % de moins</button></div>
    {trial && <div role="status" className="mt-4 rounded-xl bg-white p-4 text-sm">{trial.ok ? <><p>Scénario temporaire : projection centrale <strong>{money(trial.projection.central)}</strong> ({Number(trial.delta) >= 0 ? "+" : ""}{money(trial.delta)}).</p>
      <p className="mt-1 text-xs text-slate-600">Les projets explicites et les achats déjà observés sont conservés. Aucun enregistrement effectué.</p>
      <form action={updateMonthInputs} className="mt-3"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-month-assumption" /><input type="hidden" name="categoryKey" value={trial.categoryKey} /><input type="hidden" name="assumptionMode" value="CUSTOM" /><input type="hidden" name="assumptionAmount" value={trial.amount} /><button className={button}>Garder comme hypothèse de ce mois</button></form></> : <p>{trial.message}</p>}
      <button className="mt-2 text-xs font-bold underline" onClick={() => setTrial(null)}>Fermer la simulation</button></div>}
    <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer font-bold">Notre objectif de fin de mois{settings.goal !== null ? ` · ${money(settings.goal)}` : ""}</summary><p className="mt-2 text-xs text-slate-600">Un repère personnel, sans déduction de la projection ni création de dépense. Il ne se transmet pas au mois suivant.</p>
      <form action={updateMonthInputs} className="mt-3 flex items-end gap-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="save-month-goal" /><label className="text-sm">Garder au moins<input className={`${field} ml-2 w-32`} type="number" min="0" step="0.01" name="monthGoal" required defaultValue={settings.goal ?? ""} /> €</label><button className={button}>Enregistrer l’objectif</button></form>
      {decision.goal && <><dl className="mt-3 grid grid-cols-3 gap-3 text-sm">{([ ["Mois calme", decision.goal.lowConsumption], ["Habituel", decision.goal.central], ["Plus coûteux", decision.goal.highConsumption] ] as const).map(([label, delta]) => <div key={label}><dt>{label} · écart à l’objectif</dt><dd className="font-bold">{Number(delta) >= 0 ? "+" : ""}{money(delta)}</dd></div>)}</dl>
        <details className="mt-2 text-xs"><summary className="cursor-pointer">Calcul exact</summary><p>Chaque projection économique moins l’objectif de {settings.goal} € : {decision.goal.lowConsumption} € / {decision.goal.central} € / {decision.goal.highConsumption} €.</p></details>
        <form action={updateMonthInputs} className="mt-2"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="clear-month-goal" /><button className="text-xs font-bold underline">Retirer l’objectif</button></form></>}
    </details>
    <div className="mt-5 border-t border-slate-200 pt-4"><button className={button} disabled={pending} onClick={() => startTransition(async () => {
      try { const result = await preserveMonthForecast(targetMonth); setMessage(result.message); if (result.ok) router.refresh(); }
      catch { setMessage("L’estimation n’a pas été conservée. Réessayez ; la projection affichée reste disponible."); }
    })}>{pending ? "Calcul en cours…" : "Conserver cette estimation"}</button><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">À propos des estimations conservées</summary><p className="mt-2">Conservez des repères au début, au milieu et à la fin du mois. Ils sont immuables ; une consultation seule n’en crée aucun.</p></details></div>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
