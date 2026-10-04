"use client";
import { useState } from "react";
import { controlMoney } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";

/** Direct manipulation of an input draft only, never a forecast or funding calculation. */
export function stepCurrencyDraft(value: string, delta: number, min = 0, max = 999999999.99) {
  const cents = Math.round((Number(value) || 0) * 100) + Math.round(delta * 100);
  return (Math.min(Math.round(max * 100), Math.max(Math.round(min * 100), cents)) / 100).toFixed(2);
}
export function CurrencyStepper({ value, onChange, label, name, step = 25, min = 0, max = 999999999.99, percent = false }: {
  value: string; onChange: (value: string) => void; label: string; name: string; step?: number; min?: number; max?: number; percent?: boolean;
}) {
  const [precise, setPrecise] = useState(false);
  return <div className="space-y-4"><input type="hidden" name={name} value={value} />
    <div className="flex items-center gap-5"><button type="button" className={`${material.clayButton} px-4 py-3 font-bold`} aria-label={`Réduire ${label} de ${step} €`} onClick={() => onChange(stepCurrencyDraft(value, -step, min, max))}>−{step}</button>
      <output aria-label={label} className="min-w-36 text-center text-3xl font-black">{controlMoney(value, true)}</output>
      <button type="button" className={`${material.clayButton} px-4 py-3 font-bold`} aria-label={`Augmenter ${label} de ${step} €`} onClick={() => onChange(stepCurrencyDraft(value, step, min, max))}>+{step}</button>
      {percent && <button type="button" className={`${material.clayChip} px-4 py-3 font-bold`} aria-label={`Réduire ${label} de 10 %`} onClick={() => onChange(stepCurrencyDraft(value, -(Number(value) || 0) * .1, min, max))}>−10 %</button>}</div>
    <button type="button" className="text-sm font-bold text-violet-900 underline" onClick={() => setPrecise(!precise)}>{precise ? "Masquer la saisie" : "Saisir précisément"}</button>
    {precise && <label className="block text-sm font-semibold">{label} (€)<input autoFocus className={`${material.field} ml-3 w-40 px-3 py-2`} aria-label={`Saisir précisément ${label}`} type="number" min={min} max={max} step="0.01" required value={value} onChange={event => onChange(event.target.value)} /></label>}
    <p className="text-sm text-slate-600">Ce montant sera enregistré uniquement après confirmation.</p>
  </div>;
}
export function ControlFormFields({ month, intent, values = {} }: { month: string; intent: string; values?: Record<string, string> }) {
  return <><input type="hidden" name="targetMonth" value={month} /><input type="hidden" name="intent" value={intent} />{Object.entries(values).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}</>;
}
export function HumanDateField({ name, label = "Date", today, initial, optional = false, min, max }: {
  name: string; label?: string; today: string; initial?: string | null; optional?: boolean; min?: string; max?: string;
}) {
  const [mode, setMode] = useState<"TODAY" | "NONE" | "CUSTOM">(optional ? initial ? "CUSTOM" : "NONE" : initial && initial !== today ? "CUSTOM" : "TODAY");
  const [date, setDate] = useState(initial ?? today);
  return <fieldset className="mt-5"><legend className="text-sm font-bold">{label}</legend><div className="mt-2 flex gap-2">
    {optional && <button type="button" aria-pressed={mode === "NONE"} className={`${material.clayChip} px-4 py-2`} onClick={() => setMode("NONE")}>Non précisée</button>}
    {!optional && <button type="button" aria-pressed={mode === "TODAY"} className={`${material.clayChip} px-4 py-2`} onClick={() => setMode("TODAY")}>Aujourd’hui</button>}
    <button type="button" aria-pressed={mode === "CUSTOM"} className={`${material.clayChip} px-4 py-2`} onClick={() => setMode("CUSTOM")}>Choisir une date</button></div>
    {mode === "CUSTOM" ? <label className="mt-3 block text-sm">{label}<input autoFocus className={`${material.field} ml-3 px-3 py-2`} name={name} type="date" required={!optional} value={date} min={min} max={max} onChange={event => setDate(event.target.value)} /></label>
      : <input type="hidden" name={name} value={mode === "NONE" ? "" : today} />}</fieldset>;
}
