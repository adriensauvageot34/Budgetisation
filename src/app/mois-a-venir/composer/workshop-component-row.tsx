"use client";

import { useState } from "react";
import type { Row } from "./night-out-components";
import styles from "./composer.module.css";

type Page = "quantity" | "price" | "funding";

/** A presentation buffer. Only the owning editor may publish the resulting row. */
export function WorkshopComponentRow({ title, row, onChange, onSave, onRemove, participantCount = 0,
  bindingChoices = false, fixedQuantity = false, initialPage = "price", priceLabel, busy = false }: {
  title: string; row: Row; onChange: (row: Row) => void; onSave?: () => void; onRemove?: () => void;
  participantCount?: number; bindingChoices?: boolean; fixedQuantity?: boolean;
  initialPage?: Page; priceLabel?: string; busy?: boolean;
}) {
  const [page, setPage] = useState<Page>(initialPage);
  const update = <K extends keyof Row>(key: K, value: Row[K]) => onChange({ ...row, [key]: value, edited: true });
  return <section className={styles.workshopComponent} data-workshop-component={title} data-workshop-page={page}>
    {row.existing?.provenance === "PERSONAL_SUGGESTION" && <p className={styles.helper}>Proposition exploratoire conservée · ce poste n’est pas encore une décision applicable.</p>}
    <div className={styles.workshopTabs} aria-label={`Configurer ${title}`}>
      {!fixedQuantity && <button type="button" aria-pressed={page === "quantity"} onClick={() => setPage("quantity")}>Quantité</button>}
      <button type="button" aria-pressed={page === "price"} onClick={() => setPage("price")}>Prix</button>
      <button type="button" aria-pressed={page === "funding"} onClick={() => setPage("funding")}>Financement</button>
    </div>
    {page === "quantity" && <>
      <label>Nom du poste<input value={row.label} maxLength={120} onChange={event => update("label", event.target.value)} /></label>
      <label>Base de quantité<select value={row.unitBasis} onChange={event => onChange({ ...row, unitBasis: event.target.value as Row["unitBasis"],
        personCount: event.target.value === "PERSON" && !row.personCount && participantCount ? String(participantCount) : row.personCount, edited: true })}>
        <option value="ITEM">Unités au total</option><option value="PERSON">Unités par personne</option><option value="SHARED">Lot partagé ou montant global</option>
        {row.unitBasis === "LEGACY_PERSON" && <option value="LEGACY_PERSON">Ancienne quantité conservée</option>}</select></label>
      <label>{row.unitBasis === "PERSON" ? "Unités par personne" : row.unitBasis === "SHARED" ? "Lots partagés" : "Quantité totale"}
        <input type="number" min="0.01" max="9999" step="0.01" value={row.quantity} onChange={event => update("quantity", event.target.value)} /></label>
      {row.unitBasis === "PERSON" && <label>Personnes explicitement tarifées<input type="number" min="1" max="50" step="1" value={row.personCount}
        onChange={event => update("personCount", event.target.value)} /></label>}
      <button type="button" className={styles.nightAction} onClick={() => setPage("price")}>Continuer vers le prix</button>
    </>}
    {page === "price" && <>
      <label>Nom du poste<input value={row.label} maxLength={120} onChange={event => update("label", event.target.value)} /></label>
      <div className={styles.nightBasis}><button type="button" aria-pressed={row.costMode === "MANUAL"} onClick={() => update("costMode", "MANUAL")}>Prix connu</button>
        <button type="button" aria-pressed={row.costMode === "UNKNOWN"} onClick={() => update("costMode", "UNKNOWN")}>Inconnu</button>
        {row.existing?.cost.kind === "QUOTE" && <button type="button" aria-pressed={row.costMode === "QUOTE"} onClick={() => update("costMode", "QUOTE")}>Devis conservé</button>}</div>
      {row.costMode === "MANUAL" && <label>{priceLabel ?? (row.unitBasis === "SHARED" ? "Coût prévu par lot (€)" : "Prix unitaire prévu (€)")}
        <input inputMode="decimal" value={row.amount} onChange={event => update("amount", event.target.value)} /></label>}
      {!fixedQuantity && <button type="button" className={styles.nightLink} onClick={() => setPage("quantity")}>Modifier la base et la quantité</button>}
      {onSave && <button type="button" className={styles.nightAction} disabled={busy} onClick={onSave}>Confirmer ce poste</button>}
    </>}
    {page === "funding" && <>
      <label>Financement déclaré<select value={row.fundingMode} onChange={event => update("fundingMode", event.target.value as Row["fundingMode"])}>
        <option value="UNDECIDED">À préciser</option><option value="BANK">Banque déclarée</option>
        {row.existing?.fundingAllocations?.some(part => part.source !== "BANK") && <option value="EXISTING">Conserver le financement antérieur</option>}</select></label>
      {row.fundingMode === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount} onChange={event => update("fundingAmount", event.target.value)} /></label>}
      {bindingChoices && <label>Relation à l’enveloppe<select value={row.binding} onChange={event => update("binding", event.target.value as Row["binding"])}>
        <option value="AUTO">Selon l’habitude admissible</option><option value="CONFIRMED_CONSUMPTION">Remplace une occurrence</option>
        <option value="EXTRA_TO_SLOT">Dépense supplémentaire</option><option value="NO_RELATED_SLOT">Sans relation</option></select></label>}
      <p>Le financement ne change pas le coût économique. L’impact officiel vient de Finance V2.</p>
      {onSave && <button type="button" className={styles.nightAction} disabled={busy} onClick={onSave}>Confirmer ce poste</button>}
    </>}
    {onRemove && <button type="button" className={styles.nightLink} disabled={busy} onClick={onRemove}>Retirer ce poste</button>}
  </section>;
}
