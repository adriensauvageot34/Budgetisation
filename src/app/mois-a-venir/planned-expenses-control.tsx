"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Big from "big.js";
import { CalendarDays, Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { changePlannedExpenseStatus, previewPlannedExpense, removePlannedExpense, savePlannedExpense } from "./planned-expenses-actions";

type CostItem = PlannedExpenseCard["costItems"][number];
type PlannedBaselineKey = NonNullable<CostItem["baselineKey"]>;
type PlannedExpenseFamily = PlannedExpenseCard["familyKey"];
type PlannedExpenseDraft = Pick<PlannedExpenseCard, "familyKey" | "subtypeKey" | "title" | "plannedDate" | "costItems" | "context">;
type Person = { personId: string; displayName: string };
type Place = { placeId: string; name: string };
type Preview = Awaited<ReturnType<typeof previewPlannedExpense>>;
type Props = { targetMonth: string; expenses: readonly PlannedExpenseCard[]; persons: readonly Person[]; places: readonly Place[] };

const families: readonly { key: PlannedExpenseFamily; label: string; icon: string; hint: string }[] = [
  { key: "outing", label: "Sortie / soirée", icon: "✦", hint: "Bar, fête ou autre sortie" },
  { key: "food", label: "Alimentation / repas", icon: "◒", hint: "Courses ou repas" },
  { key: "visit_trip", label: "Déplacement / visite", icon: "↗", hint: "Visite ou séjour" },
  { key: "activity", label: "Activité / événement", icon: "☆", hint: "Loisir ou concert" },
  { key: "purchase", label: "Achat", icon: "▣", hint: "Objet, maison, équipement…" },
  { key: "other", label: "Autre", icon: "＋", hint: "Tout autre projet du mois" },
];
const subtypes: Record<PlannedExpenseFamily, readonly { key: string; label: string }[]> = {
  outing: [{ key: "bar_club", label: "Bar ou club" }, { key: "private_party", label: "Soirée privée" }, { key: "other_outing", label: "Autre sortie" }],
  food: [{ key: "groceries", label: "Courses" }, { key: "restaurant", label: "Restaurant" },
    { key: "fast_food", label: "Restauration rapide" }, { key: "delivery", label: "Livraison" }, { key: "work_meal", label: "Repas au travail" }],
  visit_trip: [{ key: "family_visit", label: "Visite à la famille" }, { key: "friend_visit", label: "Visite à des amis" },
    { key: "trip_stay", label: "Voyage ou séjour" }, { key: "other_trip", label: "Autre déplacement" }],
  activity: [{ key: "leisure", label: "Loisir" }, { key: "concert_festival", label: "Concert ou festival" }],
  purchase: [], other: [],
};
const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${value}T12:00:00Z`));
const emptyItem = (): CostItem => ({ id: crypto.randomUUID(), label: "", amount: "", baselineKey: null });
const emptyDraft = (): PlannedExpenseDraft => ({ familyKey: "outing", subtypeKey: null, title: "", plannedDate: null,
  context: {}, costItems: [emptyItem()] });
const familyLabel = (key: PlannedExpenseFamily) => families.find((item) => item.key === key)?.label ?? "Projet";
const subtypeLabel = (family: PlannedExpenseFamily, key: string | null) => subtypes[family].find((item) => item.key === key)?.label;
const dayEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const inputClass = "min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700";
const secondary = "min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const primary = "min-h-11 rounded-xl bg-emerald-800 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-700";

function habitualBaseline(draft: PlannedExpenseDraft, persons: readonly Person[]): PlannedBaselineKey | null {
  if (draft.familyKey !== "food") return null;
  if (draft.subtypeKey === "groceries") return "groceries";
  if (["restaurant", "fast_food", "delivery"].includes(draft.subtypeKey ?? "")) return "household-restaurants";
  if (draft.subtypeKey === "work_meal") {
    const name = persons.find((person) => person.personId === draft.context.participantPersonIds?.[0])?.displayName;
    return name === "Adrien" ? "adrien-work-meals" : name === "Manon" ? "manon-work-meals" : null;
  }
  return null;
}
function contextRules(draft: PlannedExpenseDraft) {
  const subtype = draft.subtypeKey;
  return { participants: draft.familyKey === "outing" || draft.familyKey === "activity"
    || (draft.familyKey === "food" && ["restaurant", "fast_food", "work_meal"].includes(subtype ?? ""))
    || (draft.familyKey === "visit_trip"),
  place: draft.familyKey === "outing" || draft.familyKey === "activity"
    || (draft.familyKey === "food" && ["groceries", "restaurant", "fast_food"].includes(subtype ?? ""))
    || draft.familyKey === "visit_trip", workMeal: draft.familyKey === "food" && subtype === "work_meal" };
}

export function PlannedExpensesControl({ targetMonth, expenses, persons, places }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<PlannedExpenseDraft>(emptyDraft);
  const [editedId, setEditedId] = useState<string | undefined>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const planned = expenses.filter((item) => item.status === "PLANNED");
  const realized = expenses.filter((item) => item.status === "DECLARED_REALIZED");
  const rules = contextRules(draft);
  const habitual = habitualBaseline(draft, persons);
  const gross = draft.costItems.reduce((sum, item) => item.amount && /^\d+(?:\.\d{1,2})?$/u.test(item.amount)
    ? sum.plus(item.amount) : sum, new Big(0)).toFixed(2);
  const itemValid = draft.costItems.length > 0 && draft.costItems.every((item) => item.label.trim().length > 0
    && /^\d+(?:\.\d{1,2})?$/u.test(item.amount) && new Big(item.amount).gt(0));
  const contextValid = draft.title.trim().length > 0 && (!rules.workMeal || draft.context.participantPersonIds?.length === 1);

  const start = (item?: PlannedExpenseCard) => {
    setTouched({});
    setEditedId(item?.id);
    setDraft(item ? { familyKey: item.familyKey, subtypeKey: item.subtypeKey, title: item.title,
      plannedDate: item.plannedDate, costItems: item.costItems.map((cost) => ({ ...cost })), context: { ...item.context } } : emptyDraft());
    setPreview(null); setError(""); setStep(item ? 3 : 1); setOpen(true);
    window.setTimeout(() => document.getElementById("planned-expense-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const setItem = (id: string, change: Partial<CostItem>) => {
    setDraft((current) => ({ ...current, costItems: current.costItems.map((item) => item.id === id ? { ...item, ...change } : item) }));
    setPreview(null);
  };
  const setPerson = (person: Person, single: boolean) => {
    setDraft((current) => {
      const selected = current.context.participantPersonIds ?? [];
      const ids = single ? [person.personId] : selected.includes(person.personId)
        ? selected.filter((id) => id !== person.personId) : [...selected, person.personId];
      const selectedNames = new Set(persons.filter((candidate) => ids.includes(candidate.personId)).map((candidate) => candidate.displayName));
      const costItems = current.costItems.map((item) => {
        if (single && (item.baselineKey === "adrien-work-meals" || item.baselineKey === "manon-work-meals"))
          return { ...item, baselineKey: person.displayName === "Adrien" ? "adrien-work-meals" as const : "manon-work-meals" as const };
        if ((item.baselineKey === "adrien-work-meals" && !selectedNames.has("Adrien"))
          || (item.baselineKey === "manon-work-meals" && !selectedNames.has("Manon"))) return { ...item, baselineKey: null };
        return item;
      });
      return { ...current, context: { ...current.context, participantPersonIds: ids }, costItems };
    });
    setPreview(null);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); router.refresh(); }
    catch { setError("Impossible d’enregistrer cette modification. Vérifiez les informations et réessayez."); }
    finally { setBusy(false); }
  };
  const simulate = async () => {
    if (!itemValid) return;
    setBusy(true); setError("");
    try { setPreview(await previewPlannedExpense(targetMonth, draft, editedId)); setStep(5); }
    catch { setError("La simulation n’a pas abouti. Vérifiez les montants, le lieu et les personnes."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    await run(async () => { await savePlannedExpense(targetMonth, draft, editedId); setOpen(false); setPreview(null); setEditedId(undefined); });
  };
  const renderCard = (item: PlannedExpenseCard) => {
    const namedPeople = (item.context.participantPersonIds ?? []).map((id) => persons.find((person) => person.personId === id)?.displayName).filter(Boolean);
    const place = item.context.place?.kind === "KNOWN" ? places.find((known) => known.placeId === (item.context.place as { placeId: string }).placeId)?.name
      : item.context.place?.kind === "TEXT" ? item.context.place.label : undefined;
    return <li key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-emerald-900"><span aria-hidden="true" className="mr-1 text-base">{families.find((family) => family.key === item.familyKey)?.icon}</span>{familyLabel(item.familyKey)}{subtypeLabel(item.familyKey, item.subtypeKey) ? ` · ${subtypeLabel(item.familyKey, item.subtypeKey)}` : ""}</p><h4 className="break-words text-base font-black">{item.title}</h4><p className="mt-1 text-xs text-slate-600"><CalendarDays size={13} className="mr-1 inline" aria-hidden="true" />{item.plannedDate ? dateLabel(item.plannedDate) : "Ce mois-ci · sans date précise"}</p></div><strong className="shrink-0 text-lg tabular-nums">{money(item.grossCost)}</strong></div>
      <p className="mt-2 break-words text-xs text-slate-600">{item.costItems.map((cost) => `${cost.label} ${money(cost.amount)}`).join(" · ")}</p>
      {(namedPeople.length > 0 || place) && <p className="mt-1 break-words text-xs text-slate-600">{[namedPeople.join(", "), place].filter(Boolean).join(" · ")}</p>}
      <p className="mt-2 text-xs font-semibold text-slate-700">{item.status === "PLANNED" ? "Prévue" : `Marquée comme réalisée · Montant prévu : ${money(item.grossCost)}`}</p>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{item.status === "PLANNED" ? <>
        <button type="button" onClick={() => start(item)} className={secondary} disabled={busy}><Pencil size={14} className="mr-1 inline" aria-hidden="true" />Modifier</button>
        <button type="button" onClick={() => run(() => changePlannedExpenseStatus(targetMonth, item.id, "DECLARED_REALIZED"))} className={secondary} disabled={busy}><Check size={14} className="mr-1 inline" aria-hidden="true" />Réalisée</button>
        {confirmDelete === item.id ? <><span className="self-center text-xs text-slate-600">Supprimer cette prévision ?</span><button type="button" onClick={() => run(async () => { await removePlannedExpense(targetMonth, item.id); setConfirmDelete(null); })} className={secondary} disabled={busy}>Confirmer</button><button type="button" onClick={() => setConfirmDelete(null)} className={secondary}>Annuler</button></>
          : <button type="button" onClick={() => setConfirmDelete(item.id)} className={secondary} disabled={busy}><Trash2 size={14} className="mr-1 inline" aria-hidden="true" />Supprimer</button>}
      </> : <button type="button" onClick={() => run(() => changePlannedExpenseStatus(targetMonth, item.id, "PLANNED"))} className={secondary} disabled={busy}><RotateCcw size={14} className="mr-1 inline" aria-hidden="true" />Repasser en prévue</button>}</div>
    </li>;
  };

  return <section id="planned-expense-builder" className="scroll-mt-6 rounded-[1.7rem] bg-sky-50/70 p-5 sm:p-6" aria-labelledby="planned-expenses-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="planned-expenses-title" className="text-xl font-black">Ce qu’on a prévu pour le mois</h2><p className="mt-1 text-sm text-slate-600">Sorties, repas, visites, activités et achats : chacun apparaît dans le mois une seule fois.</p></div><button type="button" onClick={() => start()} className={primary}><Plus size={16} className="mr-1 inline" aria-hidden="true" />Ajouter quelque chose à notre mois</button></div>
    {error && !open && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
    {open && <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{editedId ? "Modifier une prévision" : "Nouvelle prévision"} · étape {step} sur 5</p><h3 className="mt-1 text-lg font-black">{["Qu’avez-vous prévu ?", "Précisez", "Quelques détails utiles", "Combien prévoyez-vous ?", "Voici l’effet sur notre mois"][step - 1]}</h3></div><button type="button" className={secondary} onClick={() => { setOpen(false); setPreview(null); }}>Fermer</button></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      {step === 1 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{families.map((family) => <button key={family.key} type="button" onClick={() => { setDraft({ ...emptyDraft(), familyKey: family.key }); setStep(subtypes[family.key].length ? 2 : 3); setPreview(null); }} className="min-w-0 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700"><span aria-hidden="true" className="text-2xl text-emerald-800">{family.icon}</span><strong className="mt-2 block">{family.label}</strong><span className="block text-xs text-slate-600">{family.hint}</span></button>)}</div>}
      {step === 2 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{subtypes[draft.familyKey].map((subtype) => <button key={subtype.key} type="button" onClick={() => { setDraft((current) => ({ ...current, subtypeKey: subtype.key,
        costItems: subtype.key === current.subtypeKey ? current.costItems : current.costItems.map((item) => ({ ...item, baselineKey: null })) })); setStep(3); }} className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:border-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700">{subtype.label}</button>)}</div>}
      {step === 3 && <div className="mt-4 grid gap-4"><p className="text-sm text-slate-600">{familyLabel(draft.familyKey)}{subtypeLabel(draft.familyKey, draft.subtypeKey) ? ` · ${subtypeLabel(draft.familyKey, draft.subtypeKey)}` : ""} {editedId && <button type="button" className="ml-2 font-bold text-emerald-900 underline" onClick={() => setStep(1)}>Changer de catégorie</button>}</p><label className="grid gap-1 text-sm font-semibold">Comment l’appeler ?<input className={inputClass} value={draft.title} maxLength={120} aria-invalid={touched.title && !draft.title.trim()} aria-describedby={touched.title && !draft.title.trim() ? "planned-title-error" : undefined} onBlur={() => setTouched((current) => ({ ...current, title: true }))} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex. Soirée entre amis" />{touched.title && !draft.title.trim() && <span id="planned-title-error" className="text-xs text-red-800">Donnez un nom à cette prévision.</span>}</label>
        <label className="grid gap-1 text-sm font-semibold">Date prévue, si vous la connaissez<input className={inputClass} type="date" min={`${targetMonth}-01`} max={dayEnd(targetMonth)} value={draft.plannedDate ?? ""} onChange={(event) => setDraft({ ...draft, plannedDate: event.target.value || null })} /></label>
        {rules.participants && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">{rules.workMeal ? "Pour qui est ce repas ?" : "Avec qui ? (facultatif)"}</legend><div className="flex flex-wrap gap-3">{persons.filter((person) => !rules.workMeal || ["Adrien", "Manon"].includes(person.displayName)).map((person) => <label key={person.personId} className="flex min-h-11 items-center gap-2 text-sm"><input type={rules.workMeal ? "radio" : "checkbox"} name={rules.workMeal ? "work-meal-person" : undefined} checked={draft.context.participantPersonIds?.includes(person.personId) ?? false} onChange={() => setPerson(person, rules.workMeal)} />{person.displayName}</label>)}</div></fieldset>}
        {rules.place && <div className="grid gap-2"><label className="text-sm font-bold">{draft.familyKey === "visit_trip" ? "Destination" : "Lieu"} (facultatif)<select className={`${inputClass} mt-1`} value={draft.context.place?.kind ?? "NONE"} onChange={(event) => { const value = event.target.value; setDraft({ ...draft, context: { ...draft.context, place: value === "KNOWN" ? { kind: "KNOWN", placeId: "" } : value === "TEXT" ? { kind: "TEXT", label: "" } : undefined } }); }}><option value="NONE">Je ne précise pas</option><option value="KNOWN">Choisir un lieu connu</option><option value="TEXT">Saisir un lieu</option></select></label>
          {draft.context.place?.kind === "KNOWN" && <label className="text-sm font-semibold">Lieu connu<select className={`${inputClass} mt-1`} value={draft.context.place.placeId} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, place: { kind: "KNOWN", placeId: event.target.value } } })}><option value="">Choisir…</option>{places.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}</select></label>}
          {draft.context.place?.kind === "TEXT" && <label className="text-sm font-semibold">Nom du lieu<input className={`${inputClass} mt-1`} value={draft.context.place.label} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, place: { kind: "TEXT", label: event.target.value } } })} /></label>}</div>}
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setStep(subtypes[draft.familyKey].length ? 2 : 1)}>Retour</button><button type="button" className={primary} disabled={!contextValid || draft.context.place?.kind === "KNOWN" && !draft.context.place.placeId || draft.context.place?.kind === "TEXT" && !draft.context.place.label.trim()} onClick={() => setStep(4)}>Continuer</button></div>
      </div>}
      {step === 4 && <div className="mt-4 space-y-3"><p className="text-sm text-slate-600">Ajoutez chaque partie du coût. Le montant total se met à jour automatiquement.</p>{draft.costItems.map((item, index) => <div key={item.id} className="min-w-0 rounded-xl border border-slate-200 p-3"><div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_auto]"><label className="grid min-w-0 gap-1 text-sm font-semibold">Dépense {index + 1}<input className={inputClass} value={item.label} maxLength={120} aria-invalid={touched[`${item.id}-label`] && !item.label.trim()} aria-describedby={touched[`${item.id}-label`] && !item.label.trim() ? `${item.id}-label-error` : undefined} onBlur={() => setTouched((current) => ({ ...current, [`${item.id}-label`]: true }))} onChange={(event) => setItem(item.id, { label: event.target.value })} placeholder="Ex. Entrée" />{touched[`${item.id}-label`] && !item.label.trim() && <span id={`${item.id}-label-error`} className="text-xs text-red-800">Nommez cette dépense.</span>}</label><label className="grid min-w-0 gap-1 text-sm font-semibold">Montant (€)<input className={inputClass} type="number" inputMode="decimal" min="0.01" step="0.01" value={item.amount} aria-invalid={touched[`${item.id}-amount`] && (!/^\d+(?:\.\d{1,2})?$/u.test(item.amount) || new Big(item.amount || 0).lte(0))} aria-describedby={touched[`${item.id}-amount`] && (!/^\d+(?:\.\d{1,2})?$/u.test(item.amount) || new Big(item.amount || 0).lte(0)) ? `${item.id}-amount-error` : undefined} onBlur={() => setTouched((current) => ({ ...current, [`${item.id}-amount`]: true }))} onChange={(event) => setItem(item.id, { amount: event.target.value })} />{touched[`${item.id}-amount`] && (!/^\d+(?:\.\d{1,2})?$/u.test(item.amount) || new Big(item.amount || 0).lte(0)) && <span id={`${item.id}-amount-error`} className="text-xs text-red-800">Saisissez un montant supérieur à 0 €.</span>}</label><button type="button" className={`${secondary} self-end`} aria-label={`Supprimer la dépense ${index + 1}`} disabled={draft.costItems.length === 1} onClick={() => setDraft({ ...draft, costItems: draft.costItems.filter((cost) => cost.id !== item.id) })}><Trash2 size={16} aria-hidden="true" /></button></div>
          {draft.familyKey === "food" ? <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><legend className="mb-1 font-semibold">Est-ce dans vos dépenses habituelles ?</legend><label className="flex min-h-9 items-center gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey === null} onChange={() => setItem(item.id, { baselineKey: null })} />En plus</label><label className="flex min-h-9 items-center gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey !== null} disabled={habitual === null} onChange={() => setItem(item.id, { baselineKey: habitual })} />Habituel</label></fieldset>
            : <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-emerald-900">Une partie correspond à une dépense habituelle ?</summary><label className="mt-2 grid gap-1 font-semibold">Pour cette ligne seulement<select className={inputClass} value={item.baselineKey ?? ""} onChange={(event) => setItem(item.id, { baselineKey: (event.target.value || null) as PlannedBaselineKey | null })}><option value="">En plus</option><option value="groceries">Courses habituelles</option><option value="household-restaurants">Restaurants habituels</option>{draft.context.participantPersonIds?.some((id) => persons.find((person) => person.personId === id)?.displayName === "Adrien") && <option value="adrien-work-meals">Repas travail · Adrien</option>}{draft.context.participantPersonIds?.some((id) => persons.find((person) => person.personId === id)?.displayName === "Manon") && <option value="manon-work-meals">Repas travail · Manon</option>}</select></label></details>}</div>)}
        <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className={secondary} disabled={draft.costItems.length >= 50} onClick={() => setDraft({ ...draft, costItems: [...draft.costItems, emptyItem()] })}><Plus size={14} className="mr-1 inline" aria-hidden="true" />Ajouter une dépense</button><p className="text-sm font-semibold">Total brut prévu : <strong className="text-lg tabular-nums">{money(gross)}</strong></p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setStep(3)}>Retour</button><button type="button" className={primary} disabled={!itemValid || busy} onClick={simulate}>{busy ? "Simulation…" : "Voir l’effet sur notre mois"}</button></div></div>}
      {step === 5 && preview && <div className="mt-4 space-y-4"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-slate-700">Coût brut prévu</p><p className="text-3xl font-black tabular-nums">{money(preview.grossCost)}</p><p className="mt-2 text-sm text-slate-700">Part absorbée par les dépenses habituelles : {money(preview.absorbedByBaseline.central)} au scénario central.</p><p className="text-sm text-slate-700">Impact supplémentaire selon le scénario : {money(preview.netAdditionalImpact.low)} / <strong>{money(preview.netAdditionalImpact.central)}</strong> / {money(preview.netAdditionalImpact.high)}.</p></div>
        <div className="grid gap-2 sm:grid-cols-3">{([ ["Si on dépense peu", "lowConsumption"], ["Le plus probable", "central"], ["Si le mois coûte plus", "highConsumption"] ] as const).map(([label, key]) => <div key={key} className={`rounded-xl p-3 ${key === "central" ? "bg-white ring-2 ring-emerald-700" : "bg-slate-50"}`}><p className="text-xs font-bold">{label}</p><p className="mt-1 text-sm tabular-nums text-slate-600">Avant : {money(preview.before[key])}</p><p className="text-lg font-black tabular-nums">Après : {money(preview.after[key])}</p></div>)}</div>
        <p className="text-sm text-slate-600">{preview.explanation} La simulation n’enregistre rien.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setPreview(null); setStep(4); }}>Modifier les dépenses</button><button type="button" className={primary} disabled={busy} onClick={save}>{busy ? "Enregistrement…" : editedId ? "Enregistrer la modification" : "Ajouter au mois"}</button></div></div>}
    </div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h3 className="text-base font-black">À venir / prévues <span className="text-sm font-medium text-slate-600">({planned.length})</span></h3>{planned.length ? <ul className="mt-3 grid gap-3">{planned.map(renderCard)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune dépense ajoutée pour l’instant.</p>}</div><div><h3 className="text-base font-black">Réalisées ce mois-ci <span className="text-sm font-medium text-slate-600">({realized.length})</span></h3>{realized.length ? <ul className="mt-3 grid gap-3">{realized.map(renderCard)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune prévision marquée comme réalisée.</p>}</div></div>
  </section>;
}
