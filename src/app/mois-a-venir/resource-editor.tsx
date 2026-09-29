"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Pencil, RotateCcw, Ticket, X } from "lucide-react";
import { updateMonthInputs } from "./actions";

type Resource = Readonly<{ key: string; label: string; amount: string; sourceAmount: string | null;
  provenance: "SNAPSHOT" | "USER_DECLARED" | "MONTH_OVERRIDE"; pocket: "BANK_CASH" | "MEAL_BENEFIT" }>;

const money = (value: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value));

export function ResourceEditor({ resource, targetMonth }: { resource: Resource; targetMonth: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meal = resource.pocket === "MEAL_BENEFIT";
  const overridden = resource.provenance === "MONTH_OVERRIDE";
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(`${targetMonth}-01T12:00:00Z`));

  function send(intent: "set-resource-override" | "clear-resource-override", value?: string) {
    setError(null);
    if (intent === "set-resource-override" && (value === undefined || !/^\d+(?:[.,]\d{1,2})?$/.test(value) || Number(value.replace(",", ".")) < 0)) {
      setError("Saisissez un montant positif avec deux décimales au maximum.");
      inputRef.current?.focus();
      return;
    }
    const form = new FormData();
    form.set("targetMonth", targetMonth);
    form.set("intent", intent);
    form.set("resourceKey", resource.key);
    if (value !== undefined) form.set("resourceAmount", value.replace(",", "."));
    startTransition(async () => {
      try {
        await updateMonthInputs(form);
        setEditing(false);
        router.refresh();
      } catch {
        setError("Enregistrement impossible. Réessayez dans un instant.");
      }
    });
  }

  return <div className={`min-w-0 rounded-2xl p-4 sm:p-5 ${meal ? "bg-amber-50/80" : "bg-slate-50"}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${meal ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`} aria-hidden="true">
          {meal ? <Ticket size={19} /> : <BriefcaseBusiness size={19} />}
        </span>
        <div className="min-w-0"><p className="truncate text-sm font-bold">{resource.label}</p><p className="text-xs text-slate-600">{meal ? "Ressource repas prévue" : "Salaire prévu du mois"}</p></div>
      </div>
      {!editing && <button type="button" className="button-ghost !min-h-9 !p-2" aria-label={`Modifier ${resource.label}`} onClick={() => { setError(null); setEditing(true); }}><Pencil size={16} /></button>}
    </div>
    {editing ? <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); send("set-resource-override", inputRef.current?.value.trim()); }}>
      <label htmlFor={`resource-${resource.key}`} className="text-xs font-bold text-slate-700">Montant de {resource.label} pour ce mois (€)</label>
      <div className="flex flex-wrap items-center gap-2"><input ref={inputRef} id={`resource-${resource.key}`} className="field min-w-0 flex-1 text-base" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={resource.amount} required autoFocus disabled={pending} />
        <button className="button-primary !min-h-10 !px-3" type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Valider"}</button>
        <button className="button-ghost !min-h-10 !px-2" type="button" aria-label={`Annuler la modification de ${resource.label}`} disabled={pending} onClick={() => setEditing(false)}><X size={17} /></button></div>
    </form> : <p className="mt-4 break-words text-2xl font-black tracking-tight tabular-nums sm:text-[1.8rem]">{money(resource.amount)}</p>}
    <div className="mt-2 min-h-5 text-xs text-slate-600">{overridden ? `Modifié pour ${monthName}` : resource.provenance === "USER_DECLARED" ? `Déclaré pour ${monthName}` : `Prévu pour ${monthName}`}</div>
    {overridden && !editing && <button type="button" className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-emerald-900 underline underline-offset-2" disabled={pending} onClick={() => send("clear-resource-override")}><RotateCcw size={13} />{pending ? "Restauration…" : `Revenir à ${resource.sourceAmount === null ? "la prévision" : money(resource.sourceAmount)}`}</button>}
    {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-800">{error}</p>}
  </div>;
}
