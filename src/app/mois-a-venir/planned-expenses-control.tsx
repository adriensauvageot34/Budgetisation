"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Big from "big.js";
import { CalendarDays, Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PLANNED_FAMILIES, PLANNED_SUBTYPE_LABELS, assetsForModule, rootAssetModule, suggestedAssetQuantity,
  type AssetModule, type PlannedAsset, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { placesForPlannedContext, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { CostItem, PlannedBaselineKey, PlannedExpenseContext, PlannedPriceSuggestion, PlannedVehicleEstimate } from "@/domain/phase2/planned-contract";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { changePlannedExpenseStatus, estimatePlannedRoute, previewPlannedExpense, removePlannedExpense,
  savePlannedExpense } from "./planned-expenses-actions";

type Person = { personId: string; displayName: string };
type Draft = Pick<PlannedExpenseCard, "familyKey" | "subtypeKey" | "title" | "plannedDate" | "costItems" | "context">;
type Preview = Awaited<ReturnType<typeof previewPlannedExpense>>;
type Funding = NonNullable<Preview["funding"]>;
type Props = { targetMonth: string; expenses: readonly PlannedExpenseCard[]; persons: readonly Person[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly PlannedPriceSuggestion[]; funding: Funding };

const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${value}T12:00Z`));
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const inputClass = "min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700";
const secondary = "min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const primary = "min-h-11 rounded-xl bg-emerald-800 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const visitedFamily = ["Père de Manon", "Mère de Manon", "Grands-parents de Manon", "Père d’Adrien", "Mère d’Adrien", "Grand-mère d’Adrien"];
const visitedFriends = ["Cédric", "Lucas", "Greg", "Juliette", "Florentine"];
const friendDestinations: Record<string, string> = { Cédric: "Fabrègues", Lucas: "Saint-Jean-de-Védas",
  Greg: "Saint-Jean-de-Védas", Juliette: "Nizas" };

const emptyDraft = (): Draft => ({ familyKey: "outing", subtypeKey: null, title: "", plannedDate: null,
  costItems: [], context: {} });
const familyLabel = (family: PlannedExpenseFamily) => PLANNED_FAMILIES.find((part) => part.key === family)?.label ?? "Projet";
const subtypeLabel = (family: PlannedExpenseFamily, subtype: string | null) =>
  PLANNED_SUBTYPE_LABELS[family].find((part) => part.key === subtype)?.label ?? "";
const itemTotal = (item: CostItem) => /^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u.test(item.quantity)
  && /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(item.unitAmount)
  && new Big(item.quantity).gt(0) && new Big(item.unitAmount).gt(0)
  && new Big(plannedLineGross(item)).gte("0.01") ? plannedLineGross(item) : null;
const fundingMode = (item: CostItem): "BANK" | "SWILE" | "EDENRED" | "MIXED" =>
  !item.fundingAllocations?.length ? "BANK" : item.fundingAllocations.length === 1
    ? item.fundingAllocations[0]!.source : "MIXED";
const validItem = (item: CostItem) => {
  const total = itemTotal(item);
  if (!item.label.trim() || !total) return false;
  const parts = item.fundingAllocations;
  return !parts || (parts.length > 0 && parts.every((part) => /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(part.amount)
    && new Big(part.amount).gt(0)) && parts.reduce((sum, part) => sum.plus(part.amount), new Big(0)).eq(total));
};
const baselineFor = (module: AssetModule, personIds: readonly string[], people: readonly Person[]): PlannedBaselineKey | null => {
  if (module === "groceries") return "groceries";
  if (module === "restaurant" || module === "fast_food") return "household-restaurants";
  if (module === "work_meal") {
    const name = people.find((person) => person.personId === personIds[0])?.displayName;
    return name === "Adrien" ? "adrien-work-meals" : name === "Manon" ? "manon-work-meals" : null;
  }
  return null;
};

export function PlannedExpensesControl({ targetMonth, expenses, persons, places, vehicle, prices, funding }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [modulePath, setModulePath] = useState<AssetModule[]>([]);
  const [search, setSearch] = useState("");
  const [editedId, setEditedId] = useState<string | undefined>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const path = modulePath.length ? modulePath : [root];
  const module = path.at(-1)!;
  const planned = expenses.filter((item) => item.status === "PLANNED");
  const realized = expenses.filter((item) => item.status === "DECLARED_REALIZED");
  const isWorkMeal = draft.familyKey === "food" && draft.subtypeKey === "work_meal";
  const visited = draft.context.personVisited?.kind === "TEXT" ? draft.context.personVisited.label : undefined;
  const contextPersonLabel = isWorkMeal ? persons.find((person) => person.personId === draft.context.participantPersonIds?.[0])?.displayName : visited;
  const relevantPlaces = placesForPlannedContext(places, draft.familyKey, draft.subtypeKey, contextPersonLabel);
  const supportsParticipants = draft.familyKey === "outing" || draft.familyKey === "food" || draft.familyKey === "visit_trip" || draft.familyKey === "activity";
  const isVisit = draft.familyKey === "visit_trip" && ["family_visit", "friend_visit"].includes(draft.subtypeKey ?? "");
  const contextValid = draft.title.trim().length > 0 && (!isWorkMeal || draft.context.participantPersonIds?.length === 1)
    && (!isVisit || draft.context.personVisited?.kind === "TEXT" && !!draft.context.personVisited.label.trim())
    && (!(["fast_food", "clothing"].includes(draft.subtypeKey ?? "")) || !!draft.context.purchaseMode)
    && (draft.context.purchaseMode !== "DELIVERY" || !!draft.context.deliveryProvider?.trim())
    && (draft.context.purchaseMode !== "ONLINE" || !!draft.context.seller?.trim())
    && (draft.subtypeKey !== "gift" || !!draft.context.gift?.recipient.trim());
  const canPreview = draft.costItems.length > 0 && draft.costItems.every(validItem)
    && (!draft.context.gift || !!draft.context.gift.recipient.trim())
    && (!draft.context.route || draft.context.route.mode !== "CAR" || !!draft.context.route.fuelEstimate);

  const resetPreview = () => { setPreview(null); setError(""); };
  const start = (item?: PlannedExpenseCard) => {
    const next = item ? { familyKey: item.familyKey, subtypeKey: item.subtypeKey, title: item.title,
      plannedDate: item.plannedDate, costItems: item.costItems.map((cost) => ({ ...cost })), context: { ...item.context } } : emptyDraft();
    setDraft(next);
    setModulePath([rootAssetModule(next.familyKey, next.subtypeKey)]);
    setEditedId(item?.id); setPreview(null); setError(""); setSearch(""); setStep(item ? 3 : 1); setOpen(true);
    window.setTimeout(() => document.getElementById("planned-expense-builder")?.scrollIntoView({ behavior: "smooth" }), 0);
  };
  const updateItem = (id: string, change: Partial<CostItem>) => {
    setDraft((current) => ({ ...current, costItems: current.costItems.map((item) => item.id !== id ? item : (() => {
      const next = { ...item, ...change };
      if ((change.quantity !== undefined || change.unitAmount !== undefined) && item.fundingAllocations?.length === 1) {
        const total = itemTotal(next);
        if (total) next.fundingAllocations = [{ source: item.fundingAllocations[0]!.source, amount: total }];
      }
      return next;
    })()) }));
    resetPreview();
  };
  const addAsset = (asset?: PlannedAsset) => {
    if (asset?.nestedModule) { setModulePath([...path, asset.nestedModule]); setSearch(""); return; }
    const knownPrice = asset ? prices.find((price) => price.assetKey === asset.assetKey) : undefined;
    const quantity = asset ? suggestedAssetQuantity(asset, draft.context.participantPersonIds?.length ?? 0,
      draft.context.additionalGuestCount ?? 0) : "1";
    const itemPath = asset && asset.module !== module ? [...path, asset.module] : path;
    const item: CostItem = { id: crypto.randomUUID(), assetKey: asset?.assetKey ?? null, label: asset?.label ?? "",
      quantity, unitAmount: knownPrice?.unitAmount ?? asset?.defaultUnitAmount ?? "", baselineKey: null, modulePath: itemPath,
      priceSource: knownPrice ? "LAST_KNOWN" : asset?.defaultUnitAmount ? "SYSTEM_DEFAULT" : "MANUAL",
      ...(knownPrice || asset?.defaultUnitAmount ? { priceSourceLabel: knownPrice?.sourceLabel ?? "Prix proposé, modifiable" } : {}) };
    setDraft((current) => ({ ...current, costItems: [...current.costItems, item] }));
    resetPreview();
  };
  const setFunding = (item: CostItem, mode: "BANK" | "SWILE" | "EDENRED" | "MIXED") => {
    const total = itemTotal(item);
    if (mode === "BANK") return updateItem(item.id, { fundingAllocations: undefined });
    if (!total) return;
    if (mode === "MIXED") {
      const swile = new Big(total).div(2).round(2).toFixed(2);
      const bank = new Big(total).minus(swile).toFixed(2);
      return updateItem(item.id, { fundingAllocations: [{ source: "BANK", amount: bank }, { source: "SWILE", amount: swile }] });
    }
    updateItem(item.id, { fundingAllocations: [{ source: mode, amount: total }] });
  };
  const editAllocation = (item: CostItem, source: "BANK" | "SWILE" | "EDENRED", amount: string) => {
    const next = [...(item.fundingAllocations ?? [])];
    const index = next.findIndex((part) => part.source === source);
    if (index >= 0) next[index] = { source, amount };
    else if (amount !== "") next.push({ source, amount });
    updateItem(item.id, { fundingAllocations: next });
  };
  const setPerson = (person: Person) => {
    const current = draft.context.participantPersonIds ?? [];
    const ids = isWorkMeal ? [person.personId] : current.includes(person.personId)
      ? current.filter((id) => id !== person.personId) : [...current, person.personId];
    setDraft({ ...draft, context: { ...draft.context, participantPersonIds: ids,
      ...(isWorkMeal ? { place: undefined } : {}) },
      costItems: draft.costItems.map((item) => item.baselineKey?.endsWith("-work-meals")
        ? { ...item, baselineKey: baselineFor("work_meal", ids, persons) } : item) });
    resetPreview();
  };
  const selectSubtype = (family: PlannedExpenseFamily, subtype: string | null) => {
    const label = subtypeLabel(family, subtype) || familyLabel(family);
    setDraft({ familyKey: family, subtypeKey: subtype, title: label, plannedDate: null, costItems: [], context: {} });
    setModulePath([rootAssetModule(family, subtype)]); setStep(3); resetPreview();
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); router.refresh(); }
    catch { setError("Impossible d’enregistrer. Vérifiez les détails et réessayez."); }
    finally { setBusy(false); }
  };
  const simulate = async () => {
    if (!canPreview) return;
    setBusy(true); setError("");
    try { setPreview(await previewPlannedExpense(targetMonth, draft, editedId)); setStep(5); }
    catch { setError("La simulation n’a pas abouti. Vérifiez les prix, le financement, les personnes et le trajet."); }
    finally { setBusy(false); }
  };
  const save = () => run(async () => {
    await savePlannedExpense(targetMonth, draft, editedId);
    setOpen(false); setPreview(null); setEditedId(undefined);
  });
  const route = draft.context.route;
  const changeStops = (stops: NonNullable<PlannedExpenseContext["route"]>["stops"]) => {
    setDraft((current) => ({ ...current, context: { ...current.context,
      route: { mode: "CAR", stops } }, costItems: current.costItems.filter((item) => item.assetKey !== "transport:fuel_usage") }));
    resetPreview();
  };
  const estimateRoute = async () => {
    if (!route || route.mode !== "CAR") return;
    setBusy(true); setError("");
    try {
      const fuelEstimate = await estimatePlannedRoute(targetMonth, route.stops);
      const fuelItem: CostItem = { id: crypto.randomUUID(), assetKey: "transport:fuel_usage", label: "Coût carburant estimé",
        quantity: "1", unitAmount: fuelEstimate.cost, baselineKey: null,
        modulePath: [...path.filter((part) => part !== "transport"), "transport"],
        priceSource: "CALCULATED", priceSourceLabel: fuelEstimate.fuelPriceSource };
      setDraft((current) => ({ ...current, context: { ...current.context,
        route: { mode: "CAR", stops: route.stops, fuelEstimate } },
      costItems: [...current.costItems.filter((item) => item.assetKey !== "transport:fuel_usage"), fuelItem] }));
      setPreview(null);
    } catch { setError("Renseignez les kilomètres de chaque segment du trajet."); }
    finally { setBusy(false); }
  };
  const visibleAssets = [...assetsForModule(module), ...(module === "fishing" ? assetsForModule("activity") : [])]
    .filter((asset) => asset.assetKey !== "transport:fuel_usage"
      && (!search || asset.label.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))));

  const card = (item: PlannedExpenseCard) => <li key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-emerald-900">{familyLabel(item.familyKey)} · {subtypeLabel(item.familyKey, item.subtypeKey)}</p><h4 className="break-words text-base font-black">{item.title}</h4><p className="mt-1 text-xs text-slate-600"><CalendarDays size={13} className="mr-1 inline" aria-hidden="true" />{item.plannedDate ? dateLabel(item.plannedDate) : "Ce mois-ci · sans date précise"}</p></div><strong className="text-lg tabular-nums">{money(item.grossCost)}</strong></div>
    <p className="mt-2 break-words text-xs text-slate-600">{item.costItems.map((cost) => `${cost.variantLabel || cost.label} · ${cost.quantity} × ${money(cost.unitAmount)}`).join(" · ")}</p>
    <p className="mt-2 text-xs font-semibold text-slate-700">{item.status === "PLANNED" ? "Prévue" : "Réalisée déclarée · sans transaction observée"}</p>
    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{item.status === "PLANNED" ? <>
      <button type="button" className={secondary} disabled={busy} onClick={() => start(item)}><Pencil size={14} className="mr-1 inline" />Modifier</button>
      <button type="button" className={secondary} disabled={busy} onClick={() => run(() => changePlannedExpenseStatus(targetMonth, item.id, "DECLARED_REALIZED"))}><Check size={14} className="mr-1 inline" />Réalisée</button>
      {deleteId === item.id ? <><span className="self-center text-xs">Supprimer cette prévision ?</span><button type="button" className={secondary} disabled={busy} onClick={() => run(async () => { await removePlannedExpense(targetMonth, item.id); setDeleteId(null); })}>Confirmer</button><button type="button" className={secondary} onClick={() => setDeleteId(null)}>Annuler</button></>
        : <button type="button" className={secondary} disabled={busy} onClick={() => setDeleteId(item.id)}><Trash2 size={14} className="mr-1 inline" />Supprimer</button>}
    </> : <button type="button" className={secondary} disabled={busy} onClick={() => run(() => changePlannedExpenseStatus(targetMonth, item.id, "PLANNED"))}><RotateCcw size={14} className="mr-1 inline" />Repasser en prévue</button>}</div>
  </li>;

  return <section id="planned-expense-builder" className="scroll-mt-6 rounded-[1.7rem] bg-sky-50/70 p-5 sm:p-6" aria-labelledby="planned-expense-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Nos projets</p><h2 id="planned-expense-title" className="text-2xl font-black">Ajouter quelque chose à notre mois</h2><p className="mt-1 text-sm text-slate-600">Un projet, ses éléments, puis son effet sur le mois.</p></div>
      {!open && <button type="button" className={primary} onClick={() => start()}><Plus size={16} className="mr-1 inline" />Prévoir une dépense</button>}</div>
    {error && !open && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {open && <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{editedId ? "Modifier" : "Nouvelle prévision"} · étape {step} sur 5</p><h3 className="mt-1 text-lg font-black">{["Qu’avez-vous prévu ?", "Quel genre ?", "Quelques détails utiles", "Qu’est-ce qui coûte ?", "Voici l’effet sur notre mois"][step - 1]}</h3></div><button type="button" className={secondary} onClick={() => { setOpen(false); setPreview(null); }}>Fermer</button></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {step === 1 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PLANNED_FAMILIES.map((family) => <button key={family.key} type="button" className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-700" onClick={() => {
        setDraft({ ...emptyDraft(), familyKey: family.key }); setStep(PLANNED_SUBTYPE_LABELS[family.key].length ? 2 : 3);
        setModulePath([rootAssetModule(family.key, null)]); resetPreview(); }}><span aria-hidden="true" className="text-2xl">{family.icon}</span><strong className="mt-2 block">{family.label}</strong><span className="text-xs text-slate-600">{family.hint}</span></button>)}</div>}
      {step === 2 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PLANNED_SUBTYPE_LABELS[draft.familyKey].map((part) => <button key={part.key} type="button" className="rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:border-emerald-700" onClick={() => selectSubtype(draft.familyKey, part.key)}>{part.label}</button>)}<button type="button" className={secondary} onClick={() => setStep(1)}>Retour</button></div>}
      {step === 3 && <div className="mt-4 grid gap-4"><p className="text-sm font-semibold text-emerald-900">{familyLabel(draft.familyKey)}{draft.subtypeKey ? ` · ${subtypeLabel(draft.familyKey, draft.subtypeKey)}` : ""}</p>
        <label className="grid gap-1 text-sm font-semibold">Comment l’appeler ?<input className={inputClass} value={draft.title} maxLength={120} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); resetPreview(); }} /></label>
        <label className="grid gap-1 text-sm font-semibold">Date prévue, si vous la connaissez<input className={inputClass} type="date" min={`${targetMonth}-01`} max={monthEnd(targetMonth)} value={draft.plannedDate ?? ""} onChange={(event) => { setDraft({ ...draft, plannedDate: event.target.value || null }); resetPreview(); }} /></label>
        {isWorkMeal && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Pour qui ?</legend><div className="flex flex-wrap gap-4">{persons.filter((person) => ["Adrien", "Manon"].includes(person.displayName)).map((person) => <label key={person.personId} className="flex gap-2"><input type="radio" name="work-meal-person" checked={draft.context.participantPersonIds?.includes(person.personId) ?? false} onChange={() => setPerson(person)} />{person.displayName}</label>)}</div></fieldset>}
        {isVisit && <label className="grid gap-1 text-sm font-semibold">Qui allons-nous voir ?<select className={inputClass} value={visited && (draft.subtypeKey === "family_visit" ? visitedFamily : visitedFriends).includes(visited) ? visited : visited ? "OTHER" : ""} onChange={(event) => {
          const value = event.target.value; const personVisited = value ? { kind: "TEXT" as const, label: value === "OTHER" ? "Autre personne" : value } : undefined;
          const suggestion = draft.subtypeKey === "friend_visit" ? friendDestinations[value] : undefined;
          setDraft({ ...draft, context: { ...draft.context, personVisited, place: suggestion ? { kind: "TEXT", label: suggestion } : undefined } }); resetPreview(); }}><option value="">Choisir une personne</option>{(draft.subtypeKey === "family_visit" ? visitedFamily : visitedFriends).map((name) => <option key={name} value={name}>{name}</option>)}<option value="OTHER">Autre personne</option></select></label>}
        {isVisit && visited && ![...visitedFamily, ...visitedFriends].includes(visited) && <label className="grid gap-1 text-sm font-semibold">Son nom<input className={inputClass} value={visited === "Autre personne" ? "" : visited} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, personVisited: { kind: "TEXT", label: event.target.value } } }); resetPreview(); }} /></label>}
        {(draft.subtypeKey === "fast_food" || draft.subtypeKey === "clothing") && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">{draft.subtypeKey === "fast_food" ? "Comment manger ?" : "Mode d’achat"}</legend><div className="flex flex-wrap gap-4">{(draft.subtypeKey === "fast_food" ? [["TAKEAWAY", "Sur place / à emporter"], ["DELIVERY", "En livraison"]] : [["IN_STORE", "Magasin physique"], ["ONLINE", "En ligne / livraison"]]).map(([value, label]) => <label key={value} className="flex gap-2"><input type="radio" name="purchase-mode" checked={draft.context.purchaseMode === value} onChange={() => { setDraft({ ...draft, context: { ...draft.context, purchaseMode: value as PlannedExpenseContext["purchaseMode"] } }); resetPreview(); }} />{label}</label>)}</div></fieldset>}
        {draft.context.purchaseMode === "DELIVERY" && <label className="grid gap-1 text-sm font-semibold">Qui livre ?<input className={inputClass} list="planned-delivery-services" value={draft.context.deliveryProvider ?? ""} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, deliveryProvider: event.target.value } }); resetPreview(); }} /><datalist id="planned-delivery-services"><option value="Uber Eats" /><option value="Lady Sushi" /><option value="Domino’s" /></datalist></label>}
        {draft.context.purchaseMode === "ONLINE" && <label className="grid gap-1 text-sm font-semibold">Quelle boutique ?<input className={inputClass} list="planned-online-stores" value={draft.context.seller ?? ""} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, seller: event.target.value } }); resetPreview(); }} /><datalist id="planned-online-stores"><option value="Shein" /><option value="Amazon" /></datalist></label>}
        {draft.subtypeKey === "gift" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Pour qui ?<input className={inputClass} value={draft.context.gift?.recipient ?? ""} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, gift: { recipient: event.target.value, occasion: draft.context.gift?.occasion ?? "Sans occasion particulière" } } })} /></label><label className="grid gap-1 text-sm font-semibold">Pour quelle occasion ?<select className={inputClass} value={draft.context.gift?.occasion ?? "Sans occasion particulière"} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, gift: { recipient: draft.context.gift?.recipient ?? "", occasion: event.target.value } } })}>{["Anniversaire", "Noël", "Fête", "Sans occasion particulière", "Autre"].map((part) => <option key={part}>{part}</option>)}</select></label></div>}
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Personnaliser · personnes et lieu</summary><div className="mt-3 grid gap-3">
          {supportsParticipants && !isWorkMeal && <fieldset><legend className="text-sm font-bold">Avec qui ?</legend><div className="flex flex-wrap gap-4">{persons.map((person) => <label key={person.personId} className="flex gap-2 text-sm"><input type="checkbox" checked={draft.context.participantPersonIds?.includes(person.personId) ?? false} onChange={() => setPerson(person)} />{person.displayName}</label>)}</div><label className="mt-2 grid max-w-xs gap-1 text-sm">Invités non nommés<input className={inputClass} type="number" min="0" max="99" value={draft.context.additionalGuestCount ?? 0} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, additionalGuestCount: Number(event.target.value) } }); resetPreview(); }} /></label></fieldset>}
          <label className="grid gap-1 text-sm font-semibold">{isVisit ? "Destination" : "Lieu"} (facultatif)<select className={inputClass} value={draft.context.place?.kind === "KNOWN" ? draft.context.place.placeId : draft.context.place?.kind === "TEXT" ? "TEXT" : ""} onChange={(event) => {
            const value = event.target.value; const place = value === "TEXT" ? { kind: "TEXT" as const, label: "" } : value ? { kind: "KNOWN" as const, placeId: value } : undefined;
            setDraft({ ...draft, context: { ...draft.context, place } }); resetPreview(); }}><option value="">Sans lieu précis</option>{relevantPlaces.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Saisir un autre lieu</option></select></label>
          {draft.context.place?.kind === "TEXT" && <label className="grid gap-1 text-sm font-semibold">Nom du lieu<input className={inputClass} value={draft.context.place.label} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, place: { kind: "TEXT", label: event.target.value } } }); resetPreview(); }} /></label>}
          {isVisit && relevantPlaces.length === 0 && <p className="text-xs text-slate-600">Aucun lieu lié à cette personne n’est confirmé dans les données. Vous pouvez saisir une destination prévue.</p>}
        </div></details>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setStep(PLANNED_SUBTYPE_LABELS[draft.familyKey].length ? 2 : 1)}>Retour</button><button type="button" className={primary} disabled={!contextValid || draft.context.place?.kind === "TEXT" && !draft.context.place.label.trim()} onClick={() => setStep(4)}>Continuer</button></div>
      </div>}
      {step === 4 && <div className="mt-4 grid gap-5"><div><p className="text-sm text-slate-600">Choisissez des éléments ou ajoutez les vôtres. Aucun prix suggéré n’est ajouté sans votre choix.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><strong className="text-sm">{path.join(" › ").replaceAll("_", " ")}</strong>{path.length > 1 && <button type="button" className={secondary} onClick={() => { setModulePath(path.slice(0, -1)); setSearch(""); }}>Revenir au module parent</button>}</div>
        {path.includes("gift") && draft.subtypeKey !== "gift" && <label className="mt-3 grid max-w-md gap-1 text-sm font-semibold">Pour qui est le cadeau ?<input className={inputClass} value={draft.context.gift?.recipient ?? ""} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, gift: { recipient: event.target.value, occasion: draft.context.gift?.occasion ?? "Sans occasion particulière" } } }); resetPreview(); }} /></label>}
        {module === "house_party" && <button type="button" className={`${secondary} mt-3`} onClick={() => { addAsset(assetsForModule("house_party")[0]); addAsset(assetsForModule("house_party")[1]); }}>Ajouter le panier suggéré · Vodka 1 × 16 € et Crazy Tiger 2 × 3 €</button>}
        <label className="mt-3 grid gap-1 text-sm font-semibold">Rechercher un élément<input className={inputClass} type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{visibleAssets.map((asset) => { const knownPrice = prices.find((price) => price.assetKey === asset.assetKey); return <button key={asset.assetKey} type="button" className="rounded-xl border border-slate-200 p-3 text-left text-sm hover:border-emerald-700" onClick={() => addAsset(asset)}><span aria-hidden="true">{asset.icon} </span>{asset.label}{asset.nestedModule && <span className="block text-xs text-emerald-800">Ouvrir le module</span>}{knownPrice ? <span className="block text-xs text-slate-600">Prix récent : {money(knownPrice.unitAmount)} · {knownPrice.sourceLabel}</span> : asset.defaultUnitAmount && <span className="block text-xs text-slate-600">Suggestion : {asset.defaultQuantity} × {money(asset.defaultUnitAmount)}</span>}</button>; })}</div>
        <button type="button" className={`${secondary} mt-3`} disabled={draft.costItems.length >= 50} onClick={() => addAsset()}><Plus size={14} className="mr-1 inline" />Ajouter un élément personnalisé</button></div>
        {(draft.familyKey === "visit_trip" || draft.familyKey === "activity" || draft.familyKey === "outing" || draft.familyKey === "food") && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Transport · prévoir un trajet en voiture</summary>
          <div className="mt-3 grid gap-3"><p className="text-xs text-slate-600">Saisissez les kilomètres de chaque segment dans l’ordre. La distance n’est pas calculée automatiquement.</p>
            <fieldset><legend className="text-sm font-bold">Qui effectue le trajet ?</legend><div className="flex flex-wrap gap-4">{persons.map((person) => <label key={person.personId} className="flex gap-2 text-sm"><input type="checkbox" checked={draft.context.travellingParticipantPersonIds?.includes(person.personId) ?? false} onChange={() => { const current = draft.context.travellingParticipantPersonIds ?? []; const travellingParticipantPersonIds = current.includes(person.personId) ? current.filter((id) => id !== person.personId) : [...current, person.personId]; setDraft({ ...draft, context: { ...draft.context, travellingParticipantPersonIds } }); resetPreview(); }} />{person.displayName}</label>)}</div></fieldset>
            {!route && <button type="button" className={secondary} onClick={() => changeStops([{ label: "Maison", distanceToNextKm: "" }, { label: draft.context.place?.kind === "TEXT" ? draft.context.place.label : draft.context.place?.kind === "KNOWN" ? relevantPlaces.find((place) => place.placeId === (draft.context.place as { kind: "KNOWN"; placeId: string }).placeId)?.name ?? "Destination" : "Destination", distanceToNextKm: "" }, { label: "Maison", distanceToNextKm: null }])}>Prévoir un trajet voiture</button>}
            {route?.mode === "CAR" && <>{route.stops.map((stop, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"><label className="grid gap-1 text-sm font-semibold">Étape {index + 1}<input className={inputClass} value={stop.label} onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, label: event.target.value } : part))} /></label>{index < route.stops.length - 1 ? <label className="grid gap-1 text-sm font-semibold">Km vers l’étape suivante<input className={inputClass} type="number" min="0.01" step="0.01" value={stop.distanceToNextKm ?? ""} onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, distanceToNextKm: event.target.value } : part))} /></label> : <span className="self-center text-xs">Arrivée</span>}<div className="flex items-end gap-1"><button type="button" className={secondary} disabled={index <= 1 || index >= route.stops.length - 1} onClick={() => { const next = [...route.stops]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; changeStops(next); }} aria-label={`Monter l’étape ${index + 1}`}>↑</button><button type="button" className={secondary} disabled={index === 0 || index >= route.stops.length - 1} onClick={() => changeStops(route.stops.filter((_, i) => i !== index))} aria-label={`Retirer l’étape ${index + 1}`}>×</button></div></div>)}
              <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => changeStops([...route.stops.slice(0, -1), { label: "Nouvelle étape", distanceToNextKm: "" }, route.stops.at(-1)!])}>Ajouter une étape</button><button type="button" className={primary} disabled={busy || !vehicle} onClick={estimateRoute}>Estimer le carburant</button></div>
              {!vehicle && <p className="text-xs text-amber-900">Véhicule ou prix carburant indisponible : estimation impossible pour le moment.</p>}
              {route.fuelEstimate && <details className="rounded-xl bg-emerald-50 p-3 text-sm"><summary className="cursor-pointer font-bold">Pourquoi ce montant ? · {money(route.fuelEstimate.cost)}</summary><p className="mt-2">{route.fuelEstimate.vehicleLabel} · {route.fuelEstimate.distanceKm} km × {route.fuelEstimate.consumptionL100Km} L/100 km = {route.fuelEstimate.liters} L × {route.fuelEstimate.fuelPricePerLiter} €/L.</p><p className="mt-1">{route.fuelEstimate.fuelPriceSource}. Coût d’usage estimé, pas un plein payé.</p></details>}</>}
          </div></details>}
        <div className="grid gap-3">{draft.costItems.map((item, index) => {
          const itemModule = item.modulePath?.at(-1) ?? root;
          const habitual = baselineFor(itemModule, draft.context.participantPersonIds ?? [], persons);
          const asset = item.assetKey ? assetsForModule(itemModule).find((part) => part.assetKey === item.assetKey) : undefined;
          return <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><strong className="text-sm">Élément {index + 1} · {item.modulePath?.join(" › ").replaceAll("_", " ")}</strong><button type="button" className={secondary} aria-label={`Supprimer l’élément ${index + 1}`} onClick={() => { setDraft({ ...draft, costItems: draft.costItems.filter((part) => part.id !== item.id) }); resetPreview(); }}><Trash2 size={14} /></button></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem]"><label className="grid gap-1 text-sm font-semibold">Élément<input className={inputClass} value={item.label} maxLength={120} onChange={(event) => updateItem(item.id, { label: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Quantité<input className={inputClass} type="number" min="0.001" step="0.001" value={item.quantity} disabled={item.assetKey === "transport:fuel_usage"} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Prix unitaire (€)<input className={inputClass} type="number" min="0.01" step="0.01" value={item.unitAmount} disabled={item.assetKey === "transport:fuel_usage"} onChange={(event) => updateItem(item.id, { unitAmount: event.target.value, priceSource: "MANUAL" })} /></label></div>
            {(item.assetKey?.endsWith(":cocktail") || item.assetKey?.endsWith(":mixer")) && <label className="mt-3 grid gap-1 text-sm font-semibold">Quel parfum ou cocktail ?<input className={inputClass} value={item.variantLabel ?? ""} onChange={(event) => updateItem(item.id, { variantLabel: event.target.value || null })} placeholder="Ex. Mojito" /></label>}
            <p className="mt-2 text-xs text-slate-600">{item.priceSource === "SYSTEM_DEFAULT" ? "Prix proposé · modifiable" : item.priceSource === "CALCULATED" ? "Estimation calculée" : item.priceSource === "LAST_KNOWN" ? "Prix récent" : "Prix à confirmer"}{itemTotal(item) ? ` · total ${money(itemTotal(item)!)}` : ""}</p>
            {habitual && <fieldset className="mt-3 flex flex-wrap gap-4 text-sm"><legend className="font-semibold">Cette dépense est-elle déjà dans vos habitudes ?</legend><label className="flex gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey === null} onChange={() => updateItem(item.id, { baselineKey: null })} />En plus</label><label className="flex gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey === habitual} onChange={() => updateItem(item.id, { baselineKey: habitual })} />Habituel</label></fieldset>}
            {asset?.fundingEligibility === "MEAL" && <div className="mt-3 grid gap-2"><label className="grid gap-1 text-sm font-semibold">Comment financer cet élément ?<select className={inputClass} value={fundingMode(item)} onChange={(event) => setFunding(item, event.target.value as "BANK" | "SWILE" | "EDENRED" | "MIXED")}><option value="BANK">Banque</option><option value="SWILE">Swile</option><option value="EDENRED">Edenred</option><option value="MIXED" disabled={!itemTotal(item) || new Big(itemTotal(item)!).lt("0.02")}>Mixte</option></select></label>{fundingMode(item) === "MIXED" && <div className="grid gap-2 sm:grid-cols-3">{(["BANK", "SWILE", "EDENRED"] as const).map((source) => <label key={source} className="grid gap-1 text-sm">{source === "BANK" ? "Banque" : source} (€)<input className={inputClass} type="number" min="0" step="0.01" value={item.fundingAllocations?.find((part) => part.source === source)?.amount ?? ""} onChange={(event) => editAllocation(item, source, event.target.value)} /></label>)}</div>}</div>}
          </div>;
        })}</div>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setStep(3)}>Retour</button><button type="button" className={primary} disabled={!canPreview || busy} onClick={simulate}>{busy ? "Simulation…" : "Voir l’effet sur notre mois"}</button></div>
      </div>}
      {step === 5 && preview && <div className="mt-4 grid gap-4"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm">Coût économique brut</p><p className="text-3xl font-black tabular-nums">{money(preview.grossCost)}</p><p className="mt-2 text-sm">Absorbé par les habitudes : {money(preview.absorbedByBaseline.central)} · Impact supplémentaire central : {money(preview.netAdditionalImpact.central)}</p><details className="mt-2 text-xs"><summary className="cursor-pointer font-bold">Pourquoi ?</summary><p className="mt-1">{preview.explanation}</p></details></div>
        <div className="grid gap-2 sm:grid-cols-3">{([ ["Si on dépense peu", "lowConsumption"], ["Le plus probable", "central"], ["Si le mois coûte plus", "highConsumption"] ] as const).map(([label, key]) => <div key={key} className={`rounded-xl p-3 ${key === "central" ? "bg-white ring-2 ring-emerald-700" : "bg-slate-50"}`}><p className="text-xs font-bold">{label}</p><p className="text-xs text-slate-600">Avant : {money(preview.before[key])}</p><p className="text-lg font-black">Après : {money(preview.after[key])}</p></div>)}</div>
        <div className="grid gap-2 rounded-xl border border-slate-200 p-4 text-sm"><h4 className="font-bold">Financement prévu</h4><p>Banque : {money(preview.funding.bankAllocated)} · besoin avec dépassement : {money(preview.funding.bankNeedWithShortfall)}</p>{([ ["Swile", preview.funding.swile], ["Edenred", preview.funding.edenred] ] as const).map(([label, pocket]) => <p key={label}>{label} · ressource prévue {money(pocket.resource)} · réservée par vos plans {money(pocket.reserved)} · disponible ensuite {money(pocket.availableAfter)}{new Big(pocket.shortfall).gt(0) && <strong className="block text-amber-900">Dépassement de {money(pocket.shortfall)} à financer autrement.</strong>}</p>)}<details><summary className="cursor-pointer font-semibold">Pourquoi ?</summary><p className="mt-1 text-xs">Ces réservations sont des projets. Elles ne modifient pas le solde réel de vos cagnottes. Le coût économique reste le même quel que soit le moyen de paiement.</p></details></div>
        <p className="text-xs text-slate-600">La simulation n’enregistre rien.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setPreview(null); setStep(4); }}>Modifier</button><button type="button" className={primary} disabled={busy} onClick={save}>{busy ? "Enregistrement…" : editedId ? "Enregistrer la modification" : "Ajouter au mois"}</button></div></div>}
    </div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h3 className="text-base font-black">À venir / prévues ({planned.length})</h3>{planned.length ? <ul className="mt-3 grid gap-3">{planned.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune dépense ajoutée pour l’instant.</p>}</div><div><h3 className="text-base font-black">Réalisées ce mois-ci ({realized.length})</h3>{realized.length ? <ul className="mt-3 grid gap-3">{realized.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune prévision marquée comme réalisée.</p>}</div></div>
    {(new Big(funding.swile.reserved).gt(0) || new Big(funding.edenred.reserved).gt(0)) && <p className="mt-4 text-xs text-slate-600">Plans enregistrés : Swile {money(funding.swile.reserved)} réservés, Edenred {money(funding.edenred.reserved)} réservés. Aucun solde réel n’est débité.</p>}
  </section>;
}
