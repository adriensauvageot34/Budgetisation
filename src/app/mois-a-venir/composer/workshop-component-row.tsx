"use client";
import { useState } from "react";
import type { Row } from "./night-out-components";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { useWorkshopQuestion } from "./workshop-choices";
import styles from "./composer.module.css";

type Page = "quantity" | "price" | "funding" | "binding" | "name";
/** A short value editor; choices live in the existing horizontal workshop dock. */
export function WorkshopComponentRow({ title, row, onChange, onSave, onRemove, participantCount = 0,
  reference, back, bindingChoices = false, fixedQuantity = false, initialPage = "price", priceLabel, busy = false }: {
  title: string; row: Row; onChange: (row: Row) => void; onSave?: () => void; onRemove?: () => void;
  reference?: {value:string;caption:string;period:string}; back?: {label:string; action:()=>void}; participantCount?: number; bindingChoices?: boolean; fixedQuantity?: boolean;
  initialPage?: Page; priceLabel?: string; busy?: boolean;
}) {
  const confirm = useWorkshopConfirmation();
  const [page, setPage] = useState<Page>(initialPage);
  const update = <K extends keyof Row>(key: K, value: Row[K]) => onChange({ ...row, [key]: value, edited: true });
  const choice = (key: string, label: string, choose: () => void, selected = false, hint?: string) => ({ key, label, choose, selected, hint, iconKey: "activity" });
  const priceChoices = [
    ...(!fixedQuantity ? [choice("quantity", "Quantité · " + row.quantity, () => setPage("quantity"), false, row.unitBasis === "SHARED" ? "Pour tout le groupe" : row.unitBasis === "PERSON" ? "Par personne tarifée" : "Unités au total")] : []),
    ...(reference?[choice("reference","Prix observé · "+reference.value+" €",()=>onChange({...row,amount:reference.value,costMode:"MANUAL",edited:true}),false,reference.caption+" · "+reference.period+" · à confirmer")]:[]),
    choice("unknown", "Prix à préciser", () => update("costMode", "UNKNOWN"), row.costMode === "UNKNOWN", "Aucun zéro inventé"),
    ...(row.existing?.cost.kind === "QUOTE" ? [choice("quote", "Garder le devis", () => update("costMode", "QUOTE"), row.costMode === "QUOTE")] : []),
    choice("funding", "Financement", () => setPage("funding")), choice("name", "Nom du poste", () => setPage("name")),
    ...(onSave ? [choice("save", "Conserver ce poste", onSave)] : []),...(back?[choice("back",back.label,back.action)]:[])];
  const choices = page === "quantity" ? [
    ...([["ITEM", "Unités au total"], ["PERSON", "Par personne"], ["SHARED", "Lot partagé"]] as const).map(([basis,label]) => choice(basis,label,() => onChange({ ...row, edited: true, unitBasis: basis,
      personCount: basis === "PERSON" && !row.personCount && participantCount ? String(participantCount) : row.personCount }),row.unitBasis === basis)),
    choice("price","Retour au prix",() => setPage("price"))]
    : page === "funding" ? [choice("unknown","À préciser",() => update("fundingMode","UNDECIDED"),row.fundingMode === "UNDECIDED"),
      choice("bank","Banque déclarée",() => update("fundingMode","BANK"),row.fundingMode === "BANK"),
      ...(row.existing?.fundingAllocations?.some(p=>p.source!=="BANK") ? [choice("existing","Garder le financement",() => update("fundingMode","EXISTING"),row.fundingMode === "EXISTING")] : []),
      ...(bindingChoices ? [choice("binding","Enveloppe liée",() => setPage("binding"))] : []), choice("price","Retour au prix",() => setPage("price"))]
    : page === "binding" ? [
      ...([["AUTO","Selon l’habitude admissible"],["CONFIRMED_CONSUMPTION","Compris dans l’enveloppe"],["EXTRA_TO_SLOT","En plus de l’enveloppe"],["NO_RELATED_SLOT","Sans enveloppe"]] as const)
        .map(([mode,label])=>choice(mode,label,()=>update("binding",mode),row.binding===mode)),choice("price","Retour au prix",()=>setPage("price"))]
    : page === "name" ? [choice("price","Retour au prix",()=>setPage("price"))] : priceChoices;
  const inDock = useWorkshopQuestion({ title: page === "quantity" ? "Comment compter « " + row.label + " » ?" : page === "funding" ? "Comment financer ce poste ?" : page === "binding" ? "Quelle relation à l’enveloppe ?" : "Composer · " + row.label, choices });
  const adjustQuantity = (delta: number) => { const value = Number(row.quantity); if (Number.isFinite(value) && value + delta >= 1) update("quantity", String(value + delta)); };
  return <section className={styles.workshopComponent} data-workshop-component={title} data-workshop-page={page}>
    <h3>{row.label || title}</h3>
    {row.existing?.provenance === "PERSONAL_SUGGESTION" && <p className={styles.helper}>Repère exploratoire, pas encore une décision retenue.</p>}
    {!inDock && <nav className={styles.workshopTabs} aria-label={"Configurer " + title}>{choices.map(c=><button type="button" key={c.key} aria-pressed={c.selected} onClick={c.choose}>{c.label}</button>)}</nav>}
    {page === "price" && <>
      <label>{priceLabel ?? (row.unitBasis === "SHARED" ? "Coût prévu par lot (€)" : "Prix unitaire prévu (€)")}
        <input autoFocus inputMode="decimal" placeholder="Encore inconnu" value={row.costMode === "MANUAL" ? row.amount : ""}
          onChange={event => onChange({ ...row, amount: event.target.value, costMode: event.target.value.trim() ? "MANUAL" : "UNKNOWN", edited: true })} /></label>
      <p className={styles.helper}>{row.costMode === "QUOTE" ? "Le devis enregistré est conservé." : row.costMode === "UNKNOWN" ? "Coût à préciser · vous pouvez continuer." : "Coût prévu, pas un plafond ni un paiement."} {row.quantity} {row.unitBasis === "SHARED" ? "lot(s) pour le groupe" : row.unitBasis === "PERSON" ? "unité(s) par personne tarifée" : "unité(s) au total"}.</p>
    </>}
    {page === "quantity" && <>
      <label>{row.unitBasis === "PERSON" ? "Unités par personne" : row.unitBasis === "SHARED" ? "Lots partagés" : "Quantité totale"}
        <span className={styles.workshopStepper}><button type="button" aria-label="Réduire la quantité" disabled={Number(row.quantity)<=1} onClick={()=>adjustQuantity(-1)}>−</button>
          <input type="number" min="0.01" max="9999" step="0.01" value={row.quantity} onChange={event=>update("quantity",event.target.value)} />
          <button type="button" aria-label="Augmenter la quantité" onClick={()=>adjustQuantity(1)}>+</button></span></label>
      {row.unitBasis === "PERSON" && <label>Personnes explicitement tarifées<input type="number" min="1" max="50" step="1" value={row.personCount} onChange={event=>update("personCount",event.target.value)} /></label>}
      <p className={styles.helper}>{row.unitBasis === "SHARED" ? "Un lot partagé n’est pas multiplié par les invités." : "Seule la quantité indiquée sera prise en compte."}</p>
    </>}
    {page === "name" && <label>Nom du poste<input value={row.label} maxLength={120} onChange={event=>update("label",event.target.value)} /></label>}
    {page === "funding" && <>{row.fundingMode === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount} onChange={event=>update("fundingAmount",event.target.value)} /></label>}<p>Le financement ne change pas le coût économique. L’impact officiel vient de Finance V2.</p></>}
    {page === "binding" && <p>Seuls les coûts déjà compris dans cette enveloppe sont remplacés. Ce choix ne crée pas de plafond.</p>}
    <footer>{onSave && <button type="button" className={styles.nightAction} disabled={busy} onClick={onSave}>Conserver ce poste</button>}
      {onRemove && <button type="button" className={styles.nightLink} disabled={busy} onClick={() => confirm({message:"Retirer ce poste ? Les autres décisions sont conservées. Undo permet de revenir en arrière.", acceptLabel:"Retirer ce poste", accept:onRemove})}>Retirer ce poste</button>}</footer>
  </section>;
}
