"use client";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Utensils } from "lucide-react";
import { commitBuilderCost, removeBuilderCost, type BuilderState } from "@/domain/phase2/planned-builder";
import { plannedAsset, suggestedAssetQuantity } from "@/domain/phase2/planned-assets";
import type { CostItem, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import { plannedParticipantCount, isRootCost } from "@/domain/phase2/planned-product";
import { RESTAURANT_BILL_ASSETS } from "@/domain/phase2/planned-restaurant";
import { builderMoney } from "./planned-builder-primitives";
import { localCostGross, walletAllocation } from "@/domain/phase2/planned-ux";
import { WizardChoice, WIZARD_SCENES, type WizardScene } from "./planned-wizard-visuals";
import styles from "./planned-wizard.module.css";

function BillLineEditor({ item, assetKey, participants, baseline, wallets, onConfirm, onRemove, onCancel, onPending }: {
  item?: CostItem; assetKey: string; participants: number; baseline: CostItem["baselineKey"];
  wallets: readonly PlannedWalletOption[]; onConfirm: (item: CostItem) => void; onRemove: () => void;
  onCancel: () => void; onPending: (pending: boolean) => void;
}) {
  const asset = plannedAsset(assetKey);
  const [label, setLabel] = useState(item?.label ?? asset?.label ?? "");
  const [price, setPrice] = useState(item?.unitAmount ?? ""), [quantity, setQuantity] = useState(item?.quantity ?? (asset ? suggestedAssetQuantity(asset, participants) : "1"));
  const oldWallet = item?.fundingAllocations?.find((part) => part.source !== "BANK");
  const [wallet, setWallet] = useState<"SWILE" | "EDENRED" | "">((oldWallet?.source as "SWILE" | "EDENRED") ?? "");
  const [partial, setPartial] = useState(!!oldWallet && oldWallet.amount !== localCostGross(item!.quantity, item!.unitAmount));
  const [walletAmount, setWalletAmount] = useState(oldWallet?.amount ?? "");
  const gross = localCostGross(quantity, price), allocations = walletAllocation(gross, wallet, partial ? walletAmount : gross ?? "");
  const dirty = !item || item.label !== label || item.unitAmount !== price || item.quantity !== quantity
    || JSON.stringify(item.fundingAllocations ?? []) !== JSON.stringify(allocations ?? []);
  useEffect(() => { onPending(dirty); return () => onPending(false); }, [dirty, onPending]);
  return <section className={styles.editor} aria-label={"Éditer " + (asset?.label ?? "l’élément")}>
    <div className="flex items-center justify-between"><h5 className="text-lg font-bold">{asset?.label ?? "Autre élément"}</h5><button type="button" className="text-xs underline" onClick={onCancel}>Fermer</button></div>
    {!asset && <label className={styles.field}>Nom de l’élément<input className={styles.input} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} /></label>}
    <div className="grid grid-cols-2 gap-3"><label className={styles.field}>Quantité<input aria-label="Quantité de l’élément" className={styles.input} type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      <label className={styles.field}>Prix unitaire (€)<input autoFocus aria-label="Prix unitaire de l’élément" className={styles.input} type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label></div>
    <div><p className="mb-2 text-xs font-semibold">Paiement</p><div className={styles.wallets}><button type="button" aria-pressed={!wallet} className={styles.wallet} onClick={() => setWallet("")}>Banque</button>
      {asset?.fundingEligibility === "MEAL" && wallets.map(({ source }) => <button type="button" key={source} aria-pressed={wallet === source} className={styles.wallet} onClick={() => { setWallet(wallet === source ? "" : source); setPartial(false); }}>{source === "SWILE" ? "Swile" : "Edenred"}</button>)}</div>
      {asset?.fundingEligibility === "BANK" && <p className="mt-2 text-xs text-slate-500">Cet élément est payé par banque.</p>}
      {wallet && <div className="mt-2">{!partial ? <button type="button" className="text-xs underline" onClick={() => { setPartial(true); setWalletAmount(gross ?? ""); }}>Payer seulement une partie en {wallet === "SWILE" ? "Swile" : "Edenred"}</button>
        : <label className={styles.field}>Dont {wallet === "SWILE" ? "Swile" : "Edenred"} (€)<input className={styles.input} type="number" min="0.01" step="0.01" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} /></label>}</div>}
    </div>
    <div className="flex items-center justify-between border-t border-slate-200 pt-3"><strong>{gross ? builderMoney(gross) : "Montant à préciser"}</strong>
      <button type="button" className={styles.next} disabled={!gross || !label.trim() || allocations === null} onClick={() => onConfirm({ id: item?.id ?? crypto.randomUUID(), assetKey: asset?.assetKey ?? item?.assetKey ?? null, label: label.trim(), quantity, unitAmount: price,
        modulePath: ["restaurant"], baselineKey: item?.baselineKey ?? baseline, priceSource: "MANUAL", ...(allocations ? { fundingAllocations: allocations } : {}) })}><Check size={14} className="mr-2 inline" />Valider l’élément</button></div>
    {item && <button type="button" className="text-left text-xs text-red-700 underline" onClick={onRemove}>Retirer cet élément</button>}
  </section>;
}
export function RestaurantBillEditor({ builder, setBuilder, wallets, onPending }: {
  builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; wallets: readonly PlannedWalletOption[]; onPending: (pending: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [switchRequest, setSwitchRequest] = useState<{ key: string | null } | null>(null);
  const reportPending = useCallback((value: boolean) => { setPending(value); onPending(value); }, [onPending]);
  const select = (key: string | null) => {
    if (key === selected) return;
    if (pending) setSwitchRequest({ key }); else setSelected(key);
  };
  const items = builder.draft.costItems.filter(isRootCost);
  const selectedItem = selected?.startsWith("item:") ? items.find((item) => item.id === selected.slice(5)) : items.find((item) => item.assetKey === selected);
  const selectedKey = selectedItem?.assetKey ?? (selected?.startsWith("item:") ? "CUSTOM" : selected);
  const keys = [...RESTAURANT_BILL_ASSETS, ...items.flatMap((item) => item.assetKey && !RESTAURANT_BILL_ASSETS.includes(item.assetKey as typeof RESTAURANT_BILL_ASSETS[number]) ? [item.assetKey] : [])];
  return <div><div className={styles.bill}><div><div className={styles.billGrid}>{[...new Set(keys)].map((key) => {
    const asset = plannedAsset(key), active = key === "CUSTOM" ? undefined : items.find((item) => item.assetKey === key);
    const rawScene = key === "CUSTOM" ? "custom" : key.split(":")[1]!;
    const scene: WizardScene = rawScene in WIZARD_SCENES ? rawScene as WizardScene : key === "restaurant:alcohol_total" ? "wine_glass" : "menu";
    return <WizardChoice key={key} compact label={asset?.label ?? "Autre élément"} scene={scene} illustrationKey={asset ? `asset:${asset.assetKey}` : "custom:cost"}
      selected={!!active || selected === key || selectedItem?.assetKey === key} value={active ? builderMoney(localCostGross(active.quantity, active.unitAmount)!) : undefined} onClick={() => select(key)} />;
  })}</div>{items.some((item) => !item.assetKey) && <div className="mt-3 flex flex-wrap gap-2">{items.filter((item) => !item.assetKey).map((item) => <button type="button" key={item.id} className={styles.wallet} onClick={() => select("item:" + item.id)}>{item.label} · {builderMoney(localCostGross(item.quantity, item.unitAmount)!)}</button>)}</div>}</div>
    {selected && selectedKey ? <BillLineEditor key={selectedItem?.id ?? selected} item={selectedItem} assetKey={selectedKey} participants={plannedParticipantCount(builder.draft.context)} baseline={builder.quickBaseline ?? null} wallets={wallets} onPending={reportPending}
      onConfirm={(item) => { setBuilder((state) => commitBuilderCost(state, item)); setSwitchRequest(null); setSelected("item:" + item.id); }} onRemove={() => { if (selectedItem) setBuilder((state) => removeBuilderCost(state, selectedItem.id)); setSelected(null); }} onCancel={() => select(null)} />
      : <div className={styles.editor + " place-content-center text-center"}><Utensils size={32} className="mx-auto text-slate-400" /><p className="text-sm text-slate-600">Choisissez un élément de la note.</p><p className="text-xs text-slate-500">Quantité, prix et paiement s’affichent ici.</p></div>}
  </div>{switchRequest && <div role="alert" className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-amber-50 p-3 text-xs"><p>Validez cet élément pour garder vos saisies, ou abandonnez-les avant de changer d’élément.</p><button type="button" className={styles.wallet} onClick={() => { setSelected(switchRequest.key); setSwitchRequest(null); }}>Abandonner ces saisies</button><button type="button" className="underline" onClick={() => setSwitchRequest(null)}>Continuer l’édition</button></div>}</div>;
}
