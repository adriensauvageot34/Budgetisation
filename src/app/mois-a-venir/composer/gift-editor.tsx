"use client";

import { useState } from "react";
import type { ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import { assetsForModule, PLANNED_ASSET_CATALOG_VERSION, type PlannedAssetRef } from "@/domain/phase2/planned-assets";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { PlannedContactField } from "../planned-people-fields";
import { ChoiceTiles, builderInput } from "../planned-builder-primitives";
import styles from "./composer.module.css";
import { CardKnowledgePanel } from "./card-knowledge-panel";

const occasionChoices = ["Sans occasion particulière", "Anniversaire", "Noël", "Fête ou célébration"];
const giftAssets = assetsForModule("gift").filter(asset => !/(?:delivery_fee|service_fee)$/u.test(asset.assetKey));
const string = (value: unknown): string => typeof value === "string" ? value : "";

export function GiftEditor({ context, householdPersons, knowledge, busy, onSave, onCancel }: {
  context: PlannedContextState; householdPersons: readonly { personId: string; displayName: string }[];
  knowledge?: CardKnowledgeRead;
  busy: boolean; onSave: (operation: ComposerOperation) => void; onCancel: () => void;
}) {
  const existing = (Array.isArray(context.slotSelections.item?.items) ? context.slotSelections.item.items : [])
    .find((entry): entry is ComponentSelectionV1 => !!entry && typeof entry === "object" && !Array.isArray(entry)
      && entry.kind === "COMPONENT" && entry.optionKey === "gift") as Extract<ComponentSelectionV1, { kind: "COMPONENT" }> | undefined;
  const [recipient, setRecipient] = useState<ProspectivePersonRef | undefined>(
    context.fields.recipientRef && typeof context.fields.recipientRef === "object" && !Array.isArray(context.fields.recipientRef)
      ? context.fields.recipientRef as ProspectivePersonRef : undefined);
  const [occasion, setOccasion] = useState(string(context.fields.occasion));
  const rawAssetRef = context.fields.objectAssetRef;
  const existingAssetRef = rawAssetRef && typeof rawAssetRef === "object" && !Array.isArray(rawAssetRef)
    ? rawAssetRef as PlannedAssetRef : undefined;
  const [assetKey, setAssetKey] = useState(existingAssetRef?.assetKey ?? "");
  const [objectLabel, setObjectLabel] = useState(string(context.fields.objectLabel) || existing?.label || "");
  const [date, setDate] = useState(string(context.fields.plannedDate));
  const [quantity, setQuantity] = useState(existing?.quantity ?? "1");
  const [unitBasis, setUnitBasis] = useState<"ITEM" | "PERSON" | "SHARED">(existing?.unitBasis ?? "ITEM");
  const [costKind, setCostKind] = useState<"MANUAL" | "UNKNOWN" | "QUOTE">(existing?.cost.kind ?? "UNKNOWN");
  const [amount, setAmount] = useState(existing?.cost.kind === "MANUAL" ? existing.cost.unitAmount : "");
  const existingFunding = existing?.fundingAllocations ?? [];
  const [fundingMode, setFundingMode] = useState(existingFunding.some(part => part.source !== "BANK") ? "EXISTING" : existingFunding.length ? "BANK" : "UNDECIDED");
  const [fundingAmount, setFundingAmount] = useState(existingFunding.find(part => part.source === "BANK")?.amount ?? "");
  const [error, setError] = useState("");
  const selectedAsset = giftAssets.find(asset => asset.assetKey === assetKey);
  return <form data-gift-editor onSubmit={event => {
    event.preventDefault();
    if (recipient?.kind === "TEXT" && !recipient.label.trim()) { setError("Indiquez le nom du destinataire ou retirez cette sélection."); return; }
    if (!objectLabel.trim()) { setError("Précisez le cadeau ou choisissez un objet proposé."); return; }
    if (costKind === "MANUAL" && !amount.trim()) { setError("Indiquez le prix unitaire ou choisissez « Prix inconnu »."); return; }
    if (fundingMode === "BANK" && !fundingAmount.trim()) { setError("Indiquez le montant financé par la banque."); return; }
    const cost = costKind === "QUOTE" && existing?.cost.kind === "QUOTE" ? existing.cost
      : costKind === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: amount.trim() } : { kind: "UNKNOWN" as const };
    const item: ComponentSelectionV1 = { ...existing,
      selectionId: existing?.selectionId ?? crypto.randomUUID(), optionKey: "gift", kind: "COMPONENT",
      provenance: "EXPLICIT_USER_DECISION", label: objectLabel.trim(), quantity: quantity.trim(), unitBasis, cost,
      fundingAllocations: fundingMode === "EXISTING" ? existingFunding : fundingMode === "BANK" ? [{ source: "BANK", amount: fundingAmount.trim() }] : [] };
    onSave({ kind: "EDIT_GIFT", contextOccurrenceId: context.contextOccurrenceId,
      values: { recipientRef: recipient ?? "", occasion: occasion.trim(), objectLabel: objectLabel.trim(), plannedDate: date || "",
        ...(assetKey === (existingAssetRef?.assetKey ?? "") ? {} : { objectAssetRef: assetKey
          ? { catalogVersion: PLANNED_ASSET_CATALOG_VERSION, assetKey, labelAtSelection: selectedAsset?.label ?? "",
            provenance: "EXPLICIT_USER_DECISION" } : "" }) }, item });
  }}>
    <CardKnowledgePanel knowledge={knowledge} />
    <p className={styles.helper}>Le cadeau est une intention du Plan. Son coût provient uniquement de l’objet et de ses éventuels compléments.</p>
    <div className={styles.formFields}>
      <PlannedContactField label="Pour qui est ce cadeau ?" value={recipient} householdPersons={householdPersons} onChange={setRecipient} />
      <div className={styles.giftOccasion}><ChoiceTiles label="Quelle occasion ?" choices={[...occasionChoices.map((label, index) => ({ key: String(index), label })), { key: "OTHER", label: "Autre" }]}
        value={occasionChoices.includes(occasion) ? String(occasionChoices.indexOf(occasion)) : "OTHER"}
        onChange={key => setOccasion(key === "OTHER" ? "" : occasionChoices[Number(key)] ?? "")} />
        {!occasionChoices.includes(occasion) && <label>Précisez l’occasion<input className={builderInput} value={occasion} onChange={event => setOccasion(event.target.value)} maxLength={120} /></label>}</div>
      <label>Type d’objet · catalogue Budgetisation<select value={assetKey} onChange={event => {
        const asset = giftAssets.find(candidate => candidate.assetKey === event.target.value);
        setAssetKey(event.target.value);
        if (asset && !objectLabel.trim()) setObjectLabel(asset.label);
      }}><option value="">Sans classification choisie</option>
        {assetKey && !selectedAsset && <option value={assetKey}>Référence indisponible · {existingAssetRef?.labelAtSelection ?? assetKey} ({assetKey})</option>}
        {giftAssets.map(asset => <option key={asset.assetKey} value={asset.assetKey}>{asset.label}</option>)}</select></label>
      {assetKey && !selectedAsset && <p role="status" className={styles.helper}>Cette référence de catalogue n’est plus disponible. Elle reste conservée tant que vous ne choisissez pas un autre type.</p>}
      <label>Quel objet ou produit ?<input value={objectLabel} onChange={event => setObjectLabel(event.target.value)} maxLength={120} /></label>
      <label>Date prévue (facultative)<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Quantité<input type="number" min="0.001" max="9999" step="0.001" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
      <label>Unité du prix<select value={unitBasis} onChange={event => setUnitBasis(event.target.value as typeof unitBasis)}>
        <option value="ITEM">Par objet</option><option value="PERSON">Par personne</option><option value="SHARED">Montant commun</option></select></label>
      <label>Connaissance du prix<select value={costKind} onChange={event => setCostKind(event.target.value as typeof costKind)}>
        <option value="UNKNOWN">Prix encore inconnu</option><option value="MANUAL">Prix renseigné par vous</option>
        {existing?.cost.kind === "QUOTE" && <option value="QUOTE">Conserver le devis existant</option>}</select></label>
      {costKind === "MANUAL" && <label>Prix unitaire prévu (€)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required /></label>}
      <label>Financement déclaré<select value={fundingMode} onChange={event => setFundingMode(event.target.value)}>
        <option value="UNDECIDED">À préciser</option><option value="BANK">Banque</option>
        {existingFunding.some(part => part.source !== "BANK") && <option value="EXISTING">Conserver le financement déjà enregistré</option>}</select></label>
      {fundingMode === "BANK" && <label>Montant financé par la banque (€)<input inputMode="decimal" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} required /></label>}
      {fundingMode === "BANK" && <p className={styles.helper}>Si vous modifiez le prix ou la quantité, vérifiez aussi ce montant. Le Planner refusera une répartition incohérente.</p>}
      <p className={styles.helper}>Swile et Edenred ne sont pas proposés ici tant que leur admissibilité Kernel n’est pas certifiée. Aucun financement bancaire n’est inventé.</p>
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Retour au mois</button>
      <button data-submit className={styles.primary} disabled={busy}>Prévisualiser ce cadeau</button></footer>
  </form>;
}
