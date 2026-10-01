"use client";
import { useId, useState, type ReactNode } from "react";
import { Utensils, Sandwich, BriefcaseBusiness, ShoppingBasket, PartyPopper, UsersRound, Ticket, ShoppingBag, Luggage, Check, Plus, X } from "lucide-react";
import type { CostItem, PlannedPriceSuggestion, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import type { PlannedAsset } from "@/domain/phase2/planned-assets";
import { localCostGross, walletAllocation, type BUILDER_INTENTS } from "@/domain/phase2/planned-ux";
import type { BuilderIssue } from "@/domain/phase2/planned-builder";
import { WizardChoice } from "./planned-wizard-visuals";

export const builderInput = "min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600";
export const builderButton = "min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600";
export const builderPrimary = "min-h-11 rounded-xl bg-indigo-700 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50";
export const builderMoney = (amount: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount));
const icons = { Utensils, Sandwich, BriefcaseBusiness, ShoppingBasket, PartyPopper, UsersRound, Ticket, ShoppingBag, Luggage };
export function IntentTile({ intent, onClick }: { intent: typeof BUILDER_INTENTS[number]; onClick: () => void }) {
  const Icon = icons[intent.icon as keyof typeof icons];
  return <WizardChoice label={intent.label} scene={intent.key} icon={<Icon size={23} strokeWidth={1.7} aria-hidden="true" />} onClick={onClick} />;
}
export function ChoiceTiles({ label, choices, value, onChange }: { label: string; choices: readonly { key: string; label: string }[]; value?: string; onChange: (key: string) => void }) {
  return <fieldset className="grid gap-3"><legend className="mb-3 text-base font-bold">{label}</legend><div className="flex flex-wrap gap-3">{choices.map((choice) => <button key={choice.key} type="button" aria-pressed={choice.key === value} className={`min-h-16 min-w-32 rounded-xl border px-5 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600 ${choice.key === value ? "border-indigo-500 bg-indigo-50 text-indigo-950" : "border-slate-200 bg-white hover:border-indigo-300"}`} onClick={() => onChange(choice.key)}>{choice.label}</button>)}</div></fieldset>;
}
export function OptionalAction({ label, children, active = false }: { label: string; children: ReactNode; active?: boolean }) {
  const [expanded, setExpanded] = useState(active);
  return <div className="min-w-0">{!expanded ? <button type="button" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600" onClick={() => setExpanded(true)}><Plus size={14} aria-hidden="true" />{label}</button>
    : <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">{label}</strong><button type="button" aria-label={`Replier ${label}`} className="rounded-lg p-1" onClick={() => setExpanded(false)}><X size={16} /></button></div>{children}</div>}</div>;
}
export function ContextualBlockerCTA({ label, issues, busy, purpose = "PREVIEW", onClick, onRepair }: { label: string; issues: readonly BuilderIssue[]; busy: boolean; purpose?: "PREVIEW" | "SAVE"; onClick: () => void; onRepair: (issue: BuilderIssue) => void }) {
  const helpId = useId();
  const blockers = issues.filter((issue) => issue.severity === "BLOCK_PREVIEW" || purpose === "SAVE" && issue.severity === "BLOCK_SAVE");
  return <div className="group relative w-fit"><button type="button" aria-disabled={busy || blockers.length > 0} aria-describedby={blockers.length ? helpId : undefined} className={`${builderPrimary} ${blockers.length || busy ? "opacity-60" : ""}`} onClick={() => { if (busy) return; if (blockers[0]) onRepair(blockers[0]); else onClick(); }}>{busy ? purpose === "SAVE" ? "Enregistrement…" : "Calcul en cours…" : label}</button>
    {blockers.length > 0 && <div id={helpId} role="tooltip" className="absolute bottom-full z-30 mb-2 hidden w-80 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl group-hover:block group-focus-within:block"><strong>Pour continuer</strong><ul className="mt-2 space-y-1">{blockers.map((issue) => <li key={`${issue.code}-${issue.scope}`}><button className="text-left text-slate-600 underline" onClick={() => onRepair(issue)}>{issue.message}</button></li>)}</ul></div>}
  </div>;
}
export function LocalAssetEditor({ asset, item, suggestion, wallets, categoryAmount = false, initiallyEditing = false, onConfirm, onRemove }: {
  asset?: PlannedAsset; item?: CostItem; suggestion?: PlannedPriceSuggestion; wallets: readonly PlannedWalletOption[];
  categoryAmount?: boolean; initiallyEditing?: boolean; onConfirm: (item: CostItem) => void; onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(initiallyEditing || !asset && !item);
  const [label, setLabel] = useState(item?.label ?? asset?.label ?? "");
  const [price, setPrice] = useState(item?.unitAmount ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "1");
  const [quantityOpen, setQuantityOpen] = useState(!!item && item.quantity !== "1");
  const initialWallet = item?.fundingAllocations?.find((part) => part.source !== "BANK");
  const [wallet, setWallet] = useState<"SWILE" | "EDENRED" | "">(initialWallet?.source as "SWILE" | "EDENRED" ?? "");
  const [walletOpen, setWalletOpen] = useState(!!initialWallet);
  const [walletAmount, setWalletAmount] = useState(initialWallet?.amount ?? "");
  const [priceSource, setPriceSource] = useState(item?.priceSource ?? "MANUAL");
  const [localError, setLocalError] = useState("");
  const gross = localCostGross(categoryAmount ? "1" : quantity, price);
  const allocations = walletAllocation(gross, wallet, walletAmount);
  const eligible = asset?.fundingEligibility === "MEAL";
  return <div className={`min-w-0 rounded-xl border p-3 ${item ? "border-emerald-300 bg-emerald-50/50" : editing ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200 bg-white"}`}>
    <button type="button" className="flex w-full items-start justify-between gap-2 text-left text-sm" aria-expanded={editing} onClick={() => setEditing(!editing)}><span><span aria-hidden="true" className="mr-2">{asset?.icon ?? "＋"}</span><strong>{item?.label || asset?.label || "Autre élément"}</strong>{item && <span className="mt-1 block text-xs text-emerald-800">{builderMoney(localCostGross(item.quantity, item.unitAmount) ?? "0")}{item.fundingAllocations?.some((part) => part.source !== "BANK") && ` · ${item.fundingAllocations.filter((part) => part.source !== "BANK").map((part) => `${part.source} ${builderMoney(part.amount)}`).join(" / ")}`}</span>}</span>{item && <Check size={17} className="text-emerald-700" aria-label="Ajouté" />}</button>
    {!editing && suggestion && !item && <p className="mt-2 text-xs text-slate-500">Dernier prix observé : {builderMoney(suggestion.unitAmount)}<button type="button" className="ml-2 font-semibold text-indigo-700 underline" onClick={() => { setPrice(suggestion.unitAmount); setPriceSource("LAST_KNOWN"); setEditing(true); }}>Racheter</button></p>}
    {editing && <div className="mt-3 grid gap-3">
      {!asset && <label className="grid gap-1 text-xs font-semibold">Qu’avez-vous prévu ?<input className={builderInput} maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} /></label>}
      <label className="grid gap-1 text-xs font-semibold">{categoryAmount ? "Montant de cette catégorie (€)" : "Prix prévu (€)"}<input autoFocus className={builderInput} type="number" min="0.01" step="0.01" value={price} onChange={(event) => { setPrice(event.target.value); setPriceSource("MANUAL"); }} /></label>
      {!categoryAmount && <div>{!quantityOpen ? <button type="button" className="text-xs text-slate-500 underline" onClick={() => setQuantityOpen(true)}>× {quantity} · modifier</button> : <label className="grid gap-1 text-xs">Quantité<input className={builderInput} type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>}</div>}
      {(suggestion || asset?.defaultUnitAmount) && <button type="button" className="text-left text-xs font-semibold text-indigo-700 underline" onClick={() => { setPrice(suggestion?.unitAmount ?? asset!.defaultUnitAmount!); setPriceSource(suggestion ? "LAST_KNOWN" : "SYSTEM_DEFAULT"); }}>Utiliser {suggestion ? "le dernier prix observé" : "le prix proposé"} · {builderMoney(suggestion?.unitAmount ?? asset!.defaultUnitAmount!)}</button>}
      {eligible && wallets.length > 0 && (!walletOpen ? <button type="button" className="text-left text-xs font-semibold text-indigo-700" onClick={() => setWalletOpen(true)}>+ Utiliser un titre-resto</button>
        : <div className="grid gap-2"><label className="grid gap-1 text-xs">Titre-resto<select className={builderInput} value={wallet} onChange={(event) => setWallet(event.target.value as typeof wallet)}><option value="">Sans titre-resto</option>{wallets.map((part) => <option key={part.source} value={part.source}>{part.source === "SWILE" ? "Swile" : "Edenred"}</option>)}</select></label>{wallet && <label className="grid gap-1 text-xs">Montant en {wallet === "SWILE" ? "Swile" : "Edenred"} (€)<input className={builderInput} type="number" min="0.01" step="0.01" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} /></label>}<p className="text-xs text-slate-500">Le reste sera prévu en banque.</p></div>)}
      {localError && <p role="alert" className="text-xs text-red-700">{localError}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!gross || !label.trim() || allocations === null} className={builderPrimary} onClick={() => { try { onConfirm({ id: item?.id ?? crypto.randomUUID(), assetKey: asset?.assetKey ?? item?.assetKey ?? null, label: label.trim(), quantity: categoryAmount ? "1" : quantity, unitAmount: price, baselineKey: item?.baselineKey ?? null, priceSource,
        ...(suggestion && priceSource === "LAST_KNOWN" ? { priceSourceLabel: suggestion.sourceLabel } : {}), ...(allocations ? { fundingAllocations: allocations } : {}) }); setLocalError(""); setEditing(false); } catch (error) { setLocalError(error instanceof Error && error.message === "BUILDER_FEE_EXCEEDS_TOTAL" ? "Les frais doivent rester inférieurs au total de la commande." : "Vérifiez le montant et son financement."); } }}>{item ? "Confirmer" : "Ajouter"}</button><button type="button" className="text-xs underline" onClick={() => { setPrice(item?.unitAmount ?? ""); setQuantity(item?.quantity ?? "1"); setEditing(false); }}>Annuler</button>{item && onRemove && <button className="text-xs text-red-700 underline" onClick={onRemove}>Retirer</button>}</div>
    </div>}
  </div>;
}
