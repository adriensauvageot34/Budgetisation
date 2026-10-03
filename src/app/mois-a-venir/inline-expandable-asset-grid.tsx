"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Plus } from "lucide-react";
import type { PlannedAsset } from "@/domain/phase2/planned-assets";
import { suggestedAssetQuantity } from "@/domain/phase2/planned-assets";
import { assetParticipantCount } from "@/domain/phase2/planned-product";
import { commitBuilderCost, removeBuilderCost, type BuilderState } from "@/domain/phase2/planned-builder";
import { localCostGross, walletAllocation } from "@/domain/phase2/planned-ux";
import type { CostItem, ModulePath, PlannedPriceSuggestion, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import styles from "./project-wizard.module.css";
import { BuilderIllustration } from "./builder-illustrations";

const money = (v: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v));
type Props = { builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; assets: readonly PlannedAsset[];
  path: ModulePath; wallets: readonly PlannedWalletOption[]; prices?: readonly PlannedPriceSuggestion[]; quantityDefaults?: Readonly<Record<string, string>>; customLabel?: string };

function InlineEditor({ asset, item, suggestion, quantityDefault, customLabel, wallets, baselineKey, path, onConfirm, onRemove, onClose }: {
  asset?: PlannedAsset; item?: CostItem; suggestion?: PlannedPriceSuggestion; quantityDefault: string; wallets: readonly PlannedWalletOption[];
  baselineKey: CostItem["baselineKey"]; path: ModulePath; customLabel?: string; onConfirm: (item: CostItem) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [label, setLabel] = useState(item?.label ?? asset?.label ?? customLabel ?? ""), [quantity, setQuantity] = useState(item?.quantity ?? quantityDefault);
  const [price, setPrice] = useState(item?.unitAmount ?? ""), [source, setSource] = useState<CostItem["priceSource"]>(item?.priceSource ?? "MANUAL");
  const initial = item?.fundingAllocations?.find(p => p.source !== "BANK");
  const [wallet, setWallet] = useState<"SWILE" | "EDENRED" | "">(initial?.source as "SWILE" | "EDENRED" ?? "");
  const [partial, setPartial] = useState(!!initial && initial.amount !== localCostGross(item!.quantity, item!.unitAmount)), [amount, setAmount] = useState(initial?.amount ?? "");
  const [error, setError] = useState("");
  const gross = localCostGross(quantity, price), allocations = walletAllocation(gross, wallet, partial ? amount : gross ?? "");
  return <section className={styles.inlineEditor} aria-label={`Modifier ${asset?.label ?? item?.label ?? "un élément"}`} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <div className={styles.editorFields}>{!asset && <label>Élément<input autoFocus className={styles.input} value={label} maxLength={120} onChange={e => setLabel(e.target.value)} /></label>}
      <label>Quantité<input className={styles.input} type="number" min="0.001" max="9999" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label>Prix unitaire (€)<input autoFocus={!!asset} className={styles.input} type="number" min="0.01" step="0.01" value={price} onChange={e => { setPrice(e.target.value); setSource("MANUAL"); }} /></label>
      <div><span className={styles.small}>Total</span><strong className={styles.editorTotal}>{gross ? money(gross) : "—"}</strong></div></div>
    {suggestion && <button className={styles.textButton} onClick={() => { setPrice(suggestion.unitAmount); setSource("LAST_KNOWN"); }}>Dernier prix observé : {money(suggestion.unitAmount)}</button>}
    {asset?.fundingEligibility === "MEAL" && wallets.length > 0 && <div className={styles.fundingRow}><span className={styles.small}>Titre-resto · reste en banque</span>{wallets.map(w => <button type="button" key={w.source} className={styles.walletCard} aria-pressed={wallet === w.source} onClick={() => setWallet(wallet === w.source ? "" : w.source)}><span aria-hidden="true">▰</span>{w.source === "SWILE" ? "Swile" : "Edenred"}</button>)}
      {wallet && <><button type="button" className={styles.pill} aria-pressed={!partial} onClick={() => setPartial(false)}>Entier</button><button type="button" className={styles.pill} aria-pressed={partial} onClick={() => setPartial(true)}>Partiel</button>{partial && <input aria-label={`Montant ${wallet}`} className={styles.shortInput} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />}</>}</div>}
    <div className={styles.editorActions}>{error && <span role="alert" className={styles.error}>{error}</span>}<button type="button" className={styles.primary} disabled={!gross || !label.trim() || allocations === null} onClick={() => {
      try { onConfirm({ id: item?.id ?? crypto.randomUUID(), assetKey: asset?.assetKey ?? item?.assetKey ?? null, label: label.trim(), quantity, unitAmount: price,
        baselineKey: item?.baselineKey ?? baselineKey, modulePath: path, priceSource: source,
        ...(source === "LAST_KNOWN" && suggestion ? { priceSourceLabel: suggestion.sourceLabel } : {}), ...(allocations ? { fundingAllocations: allocations } : {}) }); onClose(); }
      catch { setError("Vérifiez le prix et le financement."); }
    }}>Valider</button><button className={styles.textButton} onClick={onClose}>Annuler</button>{item && onRemove && <button className={styles.textButton} onClick={() => { onRemove(); onClose(); }}>Retirer</button>}</div>
  </section>;
}

/** Single local editor inside a paged grid. Opening/abandoning it never creates a CostItem. */
export function InlineExpandableAssetGrid({ builder, setBuilder, assets, path, wallets, prices = [], quantityDefaults = {}, customLabel }: Props) {
  const [editing, setEditing] = useState<string | null>(null), [query, setQuery] = useState(""), [page, setPage] = useState(0);
  const editor = useRef<HTMLDivElement>(null);
  const items = builder.draft.costItems.filter(c => JSON.stringify(c.modulePath ?? [path[0]]) === JSON.stringify(path));
  const custom = items.filter(c => c.assetKey === null);
  const choices = [...assets.map(asset => ({ key: asset.assetKey, asset, item: items.find(c => c.assetKey === asset.assetKey), label: asset.label })),
    ...custom.map(item => ({ key: item.id, asset: undefined, item, label: item.label })), { key: "CUSTOM", asset: undefined, item: undefined, label: "Autre élément" }]
    .filter(c => c.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  useEffect(() => {
    if (!editing) return;
    const outside = (event: PointerEvent) => { if (!editor.current?.contains(event.target as Node)) setEditing(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [editing]);
  const selected = choices.find(c => c.key === editing);
  return <div className={styles.assetModule}>
    <div className={styles.assetToolbar}><input aria-label="Rechercher un élément" className={styles.input} placeholder="Rechercher dans ce catalogue" value={query} onChange={e => { setQuery(e.target.value); setPage(0); setEditing(null); }} /><span className={styles.pagination}><button aria-label="Éléments précédents" disabled={!page} onClick={() => { setPage(page - 1); setEditing(null); }}>←</button><button aria-label="Autres éléments" disabled={choices.length <= (page + 1) * 6} onClick={() => { setPage(page + 1); setEditing(null); }}>→</button></span></div>
    <div className={styles.assetGrid}>{choices.slice(page * 6, page * 6 + 6).map(c => <button type="button" key={c.key} className={`${styles.assetTile} ${c.asset ? styles.illustratedAsset : ""}`} aria-expanded={editing === c.key} onClick={() => setEditing(editing === c.key ? null : c.key)}>
      {c.asset && <BuilderIllustration semanticKey={`asset:${c.asset.assetKey}`} />}<span aria-hidden="true" className={styles.assetIcon}>{c.asset?.icon ?? <Plus size={18} />}</span><strong>{c.label}</strong>{c.item && <><small>{money(localCostGross(c.item.quantity, c.item.unitAmount)!)}{c.item.fundingAllocations?.some(p => p.source !== "BANK") && " · titre-resto"}</small><Check size={15} className={styles.check} /></>}</button>)}
      {selected && <div ref={editor} className={styles.editorSlot}><InlineEditor key={editing} asset={selected.asset} item={selected.item} suggestion={prices.find(p => p.assetKey === selected.asset?.assetKey)}
        path={path} wallets={wallets} customLabel={customLabel} quantityDefault={quantityDefaults[selected.asset?.assetKey ?? "CUSTOM"] ?? (selected.asset ? suggestedAssetQuantity(selected.asset, assetParticipantCount(selected.asset, builder.draft.context)) : "1")}
        baselineKey={path.length === 2 ? null : builder.quickBaseline ?? null} onClose={() => setEditing(null)}
        onConfirm={item => setBuilder(state => commitBuilderCost(state, item, false))} onRemove={selected.item ? () => setBuilder(state => removeBuilderCost(state, selected.item!.id)) : undefined} /></div>}
    </div>
  </div>;
}
