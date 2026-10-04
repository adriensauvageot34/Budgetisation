"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { preserveMonthForecast, previewMonthChoice, applyMonthChoice, updateMonthInputs, type simulateMonthBehavior } from "./actions";
import { categoryDecisionCapabilities, type CategoryDecisionCapabilities } from "@/domain/phase2/month-choice-contract";
import { AnimatedMoney } from "./animated-money";
import material from "./month-material.module.css";
import { LiquidSelectionGroup } from "./liquid-selection-group";
type MonthDecisionProjection = Extract<Awaited<ReturnType<typeof simulateMonthBehavior>>, { ok: true }>["decision"];
type MonthCategoryControl = MonthDecisionProjection["categoryControls"][number];
type MonthChoicePreview = Awaited<ReturnType<typeof previewMonthChoice>>;
type MonthChoiceOffer = { id: string; label: string; preview: MonthChoicePreview };

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

export function MonthDecisionTools({ targetMonth, settings, decision, offers = [] }: { targetMonth: string; settings: MonthDecisionSettings; decision: MonthDecisionProjection; offers?: readonly MonthChoiceOffer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [trial, setTrial] = useState<MonthChoicePreview | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const request = useRef(0);
  const simulate = (offer: MonthChoiceOffer) => {
    const sequence = ++request.current;
    setTrial(null); setSelectedPreset(offer.id);
    startTransition(async () => {
    try { const result = await previewMonthChoice(targetMonth, offer.preview.choice); if (sequence === request.current) { setTrial(result); setMessage(null); } }
    catch { setMessage("La simulation n’a pas abouti. Votre mois est inchangé ; réessayez."); }
  }); };
  return <section id="decision-tools" className={`${material.glassPremium} scroll-mt-24 p-6`} aria-labelledby="decision-title">
    <h2 id="decision-title" className="text-2xl font-black">Explorer nos choix</h2>
    <p className="mt-2 text-sm text-slate-600">Des choix hypothétiques pour ce mois. Les dépenses réalisées et les projets explicites restent comptés.</p>
    {decision.categoryControls.some(row => row.target !== null) && <div className={`${material.glassSoft} mt-4 p-4 text-sm`}>
      <h3 className="font-bold">Nos objectifs</h3><ul className="mt-2 space-y-1">{decision.categoryControls.filter(row => Number(row.varianceToTarget) > 0).map(row =>
        <li key={row.key}>{row.label} · {money(row.target!)} visés · {money(row.forecast)} prévus · <strong>+{money(row.varianceToTarget!)}</strong></li>)}</ul>
      <p className="mt-2 font-bold">{Number(decision.totalCategoryGap) > 0 ? `Comment compenser environ ${money(decision.totalCategoryGap)} ?` : "Les projections respectent vos objectifs de catégorie."}</p>
    </div>}
    {offers.length > 0 ? <LiquidSelectionGroup value={selectedPreset} ariaLabel="Scénarios à explorer" className="mt-4">
      {offers.map(offer => <button key={offer.id} data-liquid-key={offer.id} className={`${material.clayChip} px-4 py-3 text-left text-sm font-bold`} aria-pressed={selectedPreset === offer.id} disabled={pending} onClick={() => simulate(offer)}>
        {offer.label}<span className="mt-1 block text-xs font-normal">≈ {money(offer.preview.delta)} de marge en plus{Number(offer.preview.gapToCompensate) > 0 && ` · reste ≈ ${money(offer.preview.gapRemaining)}`}</span></button>)}
    </LiquidSelectionGroup> : <p className="mt-4 text-sm">Aucun levier chiffrable disponible avec les données actuelles. Les cagnottes protégées restent réservées.</p>}
    {trial && <div key={selectedPreset} role="status" className={`${material.dataCard} ${material.resultEnter} mt-4 space-y-2 p-4 text-sm`}>
      <p>Scénario temporaire : projection centrale <strong><AnimatedMoney value={money(trial.after.central)} /></strong> (≈ +<AnimatedMoney value={money(trial.delta)} />).</p>
      {Number(trial.spendingReduction) > 0 && <p>Consommation prévue réduite d’environ {money(trial.spendingReduction)}.</p>}
      {Number(trial.reservationRelease) > 0 && <p>{money(trial.reservationRelease)} de budget libéré par la cagnotte. La consommation économique ne diminue pas.</p>}
      {Number(trial.gapToCompensate) > 0 && <p>Environ {money(trial.gapCovered)} compensés · reste {money(trial.gapRemaining)} à compenser. Dépassements de catégories après ce choix : {money(trial.categoryGapAfter)}.</p>}
      <details className={material.disclosure}><summary className="cursor-pointer font-bold">Comprendre cette simulation</summary><ul className="mt-2 space-y-1">{trial.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
      <button className={button} disabled={pending || !trial.applicable} onClick={() => startTransition(async () => {
        try { const result = await applyMonthChoice(targetMonth, trial.choice, trial.baseDigest); setMessage(result.message); setTrial(null); setSelectedPreset(null); if (result.ok) router.refresh(); }
        catch { setMessage("Ce choix n’a pas été enregistré. Relancez la simulation et réessayez."); setTrial(null); }
      })}>Adopter ce choix pour ce mois</button>
      <button className="ml-3 text-xs font-bold underline focus-visible:outline-2" onClick={() => { ++request.current; setTrial(null); setSelectedPreset(null); }}>Fermer la simulation</button></div>}
    <details className={`${material.disclosure} mt-5 border-t border-slate-200 pt-4`}><summary className="cursor-pointer font-bold">Notre objectif de fin de mois{settings.goal !== null ? ` · ${money(settings.goal)}` : ""}</summary><p className="mt-2 text-xs text-slate-600">Un repère personnel, sans déduction de la projection ni création de dépense. Il ne se transmet pas au mois suivant.</p>
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
