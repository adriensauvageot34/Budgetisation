import { LockKeyhole, PiggyBank } from "lucide-react";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "./actions";
import { AnimatedMoney } from "./animated-money";
import material from "./month-material.module.css";

const money = (amount: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount));

/** Display only: all totals and policies arrive from the monthly plan. */
export function MonthSavingsSection({ savings, targetMonth }: {
  savings: MonthEconomicPlan["savingsAllocations"]; targetMonth: string;
}) {
  return <section aria-labelledby="savings-title" className={`${material.glassSecondary} p-6`}>
    <div className="flex items-center justify-between gap-4">
      <h2 id="savings-title" className="flex items-center gap-3 text-2xl font-black"><PiggyBank aria-hidden="true" size={24} />Ce qu’on met de côté</h2>
      <strong className={`${material.data} text-2xl`}><AnimatedMoney value={money(savings.total)} /></strong>
    </div>
    <p className="mt-2 text-sm text-slate-600">Cet argent appartient toujours au foyer, mais il est réservé et indisponible pour vivre ce mois.</p>
    {savings.items.length === 0 ? <p className="mt-4 text-sm text-slate-600">Aucune cagnotte affectée à ce mois.</p> :
      <ul className="mt-4 space-y-3">{savings.items.map(item => <li key={item.id} data-month-motion-item className={`${material.dataCard} flex items-center gap-4 p-4`}>
        <div className="flex-1"><h3 className="font-bold">{item.label}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">{item.adjustability === "PROTECTED" ? <><LockKeyhole size={14} aria-hidden="true" />Protégée · non négociable</> : "Ajustable · réservée pour ce mois"}</p>
          {item.dueDate && <p className="mt-1 text-xs text-slate-600">Mise de côté le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(`${item.dueDate}T12:00:00Z`))}</p>}
        </div>
        <strong className={`${material.data} text-lg`}><AnimatedMoney value={money(item.amount)} /></strong>
        <form action={updateMonthInputs}>
          <input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="remove-declared-outflow" /><input type="hidden" name="outflowId" value={item.id} />
          <button className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white/60" aria-label={`Supprimer la cagnotte ${item.label}`}>Supprimer</button>
        </form>
      </li>)}</ul>}
    <details className={`${material.disclosure} mt-4`}>
      <summary className="cursor-pointer text-sm font-bold">Ajouter une cagnotte</summary>
      <form action={updateMonthInputs} className="mt-4 grid grid-cols-4 items-end gap-3">
        <input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="add-declared-savings" />
        <label className="text-xs font-semibold">Pour quoi ?<input className={`${material.field} field mt-1 w-full`} name="outflowLabel" required maxLength={120} placeholder="Vacances, Noël…" /></label>
        <label className="text-xs font-semibold">Montant (€)<input className={`${material.field} field mt-1 w-full`} name="outflowAmount" type="number" required min="0" max="999999999.99" step="0.01" /></label>
        <label className="text-xs font-semibold">Date (facultative)<input className={`${material.field} field mt-1 w-full`} name="outflowDate" type="date" min={`${targetMonth}-01`} max={new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5)), 0)).toISOString().slice(0, 10)} /></label>
        <label className="text-xs font-semibold">Protection<select className={`${material.field} field mt-1 w-full`} name="outflowAdjustability" defaultValue="PROTECTED"><option value="PROTECTED">Protégée · non négociable</option><option value="ADJUSTABLE">Ajustable</option></select></label>
        <button className={`${material.clayPrimary} justify-self-start px-4 py-2 text-sm font-bold`}>Mettre de côté</button>
      </form>
    </details>
  </section>;
}
