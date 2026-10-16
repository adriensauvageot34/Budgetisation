"use client";
import type { PlannedAsset, PlannedAssetRef } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import styles from "./composer.module.css";
type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
export type Row = { id: string; existing?: Component; edited: boolean; label: string; quantity: string; unitBasis: "ITEM" | "PERSON" | "SHARED" | "LEGACY_PERSON";
  personCount: string; costMode: "MANUAL" | "UNKNOWN" | "QUOTE"; amount: string; fundingMode: "UNDECIDED" | "BANK" | "EXISTING";
  fundingAmount: string; binding: "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" | "NO_RELATED_SLOT"; assetRef?: PlannedAssetRef };
export const fresh = (label = ""): Row => ({ id: crypto.randomUUID(), edited: true, label, quantity: "1", unitBasis: "ITEM", personCount: "",
  costMode: "UNKNOWN", amount: "", fundingMode: "UNDECIDED", fundingAmount: "", binding: "AUTO" });
export const fromSelection = (selection: Component): Row => ({ id: selection.selectionId, existing: selection, edited: false, label: selection.label,
  quantity: selection.quantityPerPerson ?? selection.quantity, unitBasis: selection.unitBasis === "PERSON" && !selection.quantityPerPerson ? "LEGACY_PERSON" : selection.unitBasis ?? "ITEM",
  personCount: selection.pricedParticipantCount?.toString() ?? "", costMode: selection.cost.kind,
  amount: selection.cost.kind === "MANUAL" ? selection.cost.unitAmount : "",
  fundingMode: selection.fundingAllocations?.some(part => part.source !== "BANK") ? "EXISTING"
    : selection.fundingAllocations?.length ? "BANK" : "UNDECIDED",
  fundingAmount: selection.fundingAllocations?.find(part => part.source === "BANK")?.amount ?? "",
  binding: selection.binding?.mode ?? "AUTO", assetRef: selection.productAssetRef });
export function ComponentRow({ title, row, participantCount, onChange, onRemove, removable = true, bindingChoices = false, productAssets = [], fixedQuantity = false, priceLabel }: {
  title: string; row: Row; participantCount: number; onChange: (row: Row) => void; onRemove: () => void; removable?: boolean; bindingChoices?: boolean;
  productAssets?: readonly PlannedAsset[]; fixedQuantity?: boolean; priceLabel?: string;
}) {
  const update = <K extends keyof Row>(key: K, value: Row[K]) => onChange({ ...row, edited: true, [key]: value });
  return <fieldset className={styles.nightComponent} data-night-component={title}>
    <legend>{title}</legend>
    {row.existing?.provenance === "PERSONAL_SUGGESTION" && <p className={styles.helper}>Suggestion exploratoire : elle ne devient une décision que si vous modifiez et validez ce composant.</p>}
    <div className={styles.nightComponentGrid}>
      {productAssets.length > 0 && <label>Type du catalogue Budgetisation<select value={row.assetRef?.assetKey ?? ""} onChange={event => {
        const asset = productAssets.find(candidate => candidate.assetKey === event.target.value);
        onChange({ ...row, edited: true, assetRef: asset ? { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey: asset.assetKey,
          labelAtSelection: asset.label, provenance: "EXPLICIT_USER_DECISION" } : undefined,
          label: asset && (!row.label.trim() || ["Bouteille", "Diluant", "Boisson", "Entrée ou activité"].includes(row.label)) ? asset.label : row.label });
      }}><option value="">Libellé libre, sans type lié</option>
        {row.assetRef && !productAssets.some(asset => asset.assetKey === row.assetRef?.assetKey) && <option value={row.assetRef.assetKey}>Référence indisponible · {row.assetRef.labelAtSelection}</option>}
        {productAssets.map(asset => <option key={asset.assetKey} value={asset.assetKey}>{asset.label} · {asset.module === "bar" ? "bar" : asset.module === "club" ? "club" : "before"}</option>)}</select></label>}
      <label>Produit ou activité<input value={row.label} maxLength={120} onChange={event => update("label", event.target.value)} /></label>
      {!fixedQuantity && <><label>Mode de quantité<select value={row.unitBasis} onChange={event => onChange({ ...row, edited: true, unitBasis: event.target.value as Row["unitBasis"],
        personCount: event.target.value === "PERSON" && !row.personCount && participantCount ? String(participantCount) : row.personCount })}>
        <option value="ITEM">Unités au total</option><option value="PERSON">Unités par personne</option><option value="SHARED">Prix partagé / budget global</option>
        {row.existing?.unitBasis === "PERSON" && !row.existing.quantityPerPerson && <option value="LEGACY_PERSON">Quantité totale antérieure · prix individuel</option>}</select></label>
      <label>{row.unitBasis === "PERSON" ? "Unités par personne" : row.unitBasis === "SHARED" ? "Lots partagés (1 pour un budget global)" : "Quantité totale"}
        <input type="number" min="0.01" max="9999" step="0.01" value={row.quantity} onChange={event => update("quantity", event.target.value)} /></label>
      {row.unitBasis === "PERSON" && <label>Personnes concernées<input type="number" min="1" max="50" step="1"
        value={row.personCount} placeholder={participantCount ? String(participantCount) : "À indiquer"}
        onChange={event => update("personCount", event.target.value)} /></label>}
      </>}
      <label>Prix<select value={row.costMode} onChange={event => update("costMode", event.target.value as Row["costMode"])}>
        <option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Déclaré par moi</option>
        {row.existing?.cost.kind === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
      {row.costMode === "MANUAL" && <label>{priceLabel ?? (row.unitBasis === "SHARED" ? "Montant par lot partagé (€)" : "Prix par unité (€)")}
        <input inputMode="decimal" value={row.amount} onChange={event => update("amount", event.target.value)} /></label>}
      <label>Financement<select value={row.fundingMode} onChange={event => update("fundingMode", event.target.value as Row["fundingMode"])}>
        <option value="UNDECIDED">À préciser</option><option value="BANK">Banque déclarée</option>
        {row.existing?.fundingAllocations?.some(part => part.source !== "BANK") && <option value="EXISTING">Conserver le financement antérieur</option>}</select></label>
      {row.fundingMode === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount}
        onChange={event => update("fundingAmount", event.target.value)} /></label>}
      {bindingChoices && <label>Relation avec l’habitude du mois<select value={row.binding}
        onChange={event => update("binding", event.target.value as Row["binding"])}>
        <option value="AUTO">Selon l’habitude compatible publiée</option><option value="CONFIRMED_CONSUMPTION">Remplace une occurrence habituelle</option>
        <option value="EXTRA_TO_SLOT">Repas supplémentaire à l’habitude</option><option value="NO_RELATED_SLOT">Sans relation avec l’habitude</option></select></label>}
    </div>
    {productAssets.length > 0 && <p className={styles.helper}>Le type choisi conserve sa référence. Le catalogue ne décide aucun prix, quantité ou financement pour vous.</p>}
    {row.unitBasis === "PERSON" && <p className={styles.helper}>La quantité totale est enregistrée explicitement avec le nombre de personnes retenu ; changer les participants ne multiplie pas silencieusement le prix.</p>}
    {row.unitBasis === "LEGACY_PERSON" && <p className={styles.helper}>Cette ancienne décision contient une quantité totale. Elle est conservée sans multiplication ; choisissez « unités par personne » pour préciser un nouveau nombre de personnes.</p>}
    {removable && <button type="button" className={styles.secondary} onClick={onRemove}>Retirer ce composant</button>}
  </fieldset>;
}

export const buildComponentRow = (row: Row, optionKey: string): Component => {
    if (row.existing && !row.edited && row.existing.optionKey === optionKey) return row.existing;
    if (!row.label.trim()) throw new Error("Indiquez le nom de chaque composant.");
    const count = row.unitBasis === "PERSON" ? Number(row.personCount) : 0;
    if (row.unitBasis === "PERSON" && (!Number.isInteger(count) || count < 1 || count > 50))
      throw new Error("Indiquez le nombre de personnes concernées par le prix individuel.");
    const declaredQuantity = declareComponentQuantity(row.unitBasis === "PERSON" ? "PER_PERSON" : "TOTAL_UNITS",
      row.quantity.trim().replace(",", "."), count);
    if (row.costMode === "MANUAL" && !row.amount.trim()) throw new Error("Indiquez un prix ou choisissez « encore inconnu ».");
    if (row.fundingMode === "BANK" && !row.fundingAmount.trim()) throw new Error("Indiquez le montant Banque déclaré.");
    const cost = row.costMode === "QUOTE" && row.existing?.cost.kind === "QUOTE" ? row.existing.cost
      : row.costMode === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: decisionAmount(row.amount.trim().replace(",", ".")) } : { kind: "UNKNOWN" as const };
    const { quantityEvidenceVersion: _oldVersion, quantityPerPerson: _oldUnits, pricedParticipantCount: _oldCount, productAssetRef: _oldAsset, ...preserved } = row.existing ?? {};
    return { ...preserved, selectionId: row.id, optionKey, kind: "COMPONENT", provenance: "EXPLICIT_USER_DECISION",
      label: row.label.trim(), ...declaredQuantity, unitBasis: row.unitBasis === "LEGACY_PERSON" ? "PERSON" : row.unitBasis, cost,
      ...(row.assetRef ? { productAssetRef: row.assetRef } : {}),
      fundingAllocations: row.fundingMode === "EXISTING" ? row.existing?.fundingAllocations ?? []
        : row.fundingMode === "BANK" ? [{ source: "BANK", amount: decisionAmount(row.fundingAmount.trim().replace(",", ".")) }] : [],
      binding: { mode: row.binding } };
  };




