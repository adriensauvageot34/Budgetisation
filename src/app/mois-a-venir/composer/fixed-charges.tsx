import { useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";
import type { BaselineStructuralFact } from "@/domain/phase2/planner/baseline-contract";
import { money, knowledgeLabel, monthLabel, plannedDayLabel } from "./display";
import { MonthlySourceLink } from "./month-financial-sources";
import styles from "./composer.module.css";

export function FixedChargeCard({ facts, detached, open, reattach }: { facts: readonly BaselineStructuralFact[]; detached?: boolean; open: () => void; reattach: () => void }) {
  const known = facts.filter(f => f.value.central !== null).length;
  return <article className={styles.fixedChargeCard} data-compact-card data-fixed-charges={detached ? facts[0]?.factKey : "group"}>
    <header><FileText size={18} aria-hidden="true" /><h3>{detached ? facts[0]?.label : "Charges fixes"}</h3></header>
    {detached ? <strong>{money(facts[0]?.value.central)}</strong> : <p>{known} montant(s) connu(s) · {facts.length - known} à préciser</p>}
    <small>Prévision du mois · paiement non attesté</small>
    <div className={styles.fixedChargeActions}>
      <button type="button" onClick={open}>{detached ? "Voir la charge" : `Voir les charges (${facts.length})`}</button>
      {detached && <button type="button" onClick={reattach}>Remettre dans Charges fixes</button>}
    </div>
  </article>;
}
export function FixedChargesDetails({ month, facts, editableKeys, detached, toggle, close }: { month?: string; facts: readonly BaselineStructuralFact[];
  editableKeys?: readonly string[]; detached: ReadonlySet<string>; toggle: (key: string) => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const opener = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); opener?.focus(); }; }, []);
  return <dialog ref={dialog} className={styles.reuseDialog} aria-label="Charges fixes du mois" onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2>{month ? `Charges fixes · ${monthLabel(month)}` : "Charges fixes du mois"}</h2><button type="button" aria-label="Fermer les charges fixes" onClick={close}><X size={18} /></button></header>
    <p>Les exceptions s’appliquent à la prévision de ce mois. Le contrat et le statut du paiement se gèrent auprès de leur source.</p>
    <small>Afficher séparément change seulement la disposition dans ce navigateur.</small>
    {facts.map(fact => <section key={fact.factKey} data-fixed-fact={fact.factKey}><h3>{fact.label} · {money(fact.value.central)}</h3>
      <p>{knowledgeLabel(fact.knowledge)} · {fact.dueDate ? <>Échéance prévue · <time dateTime={fact.dueDate}>{plannedDayLabel(fact.dueDate) ?? fact.dueDate}</time></> : "Échéance à préciser"}</p>
      <small>{fact.knowledge === "DECLARED" ? "Déclaration de ce mois" : "Source : prévision mensuelle"}</small>
      <details><summary>Provenance et portée</summary>
        <p>{String(fact.metadata.ownerAuthority ?? fact.sourceRefs.join(" · "))}</p>
        {fact.value.low !== null && fact.value.high !== null && fact.value.low !== fact.value.high &&
          <p>Fourchette publiée · {money(fact.value.low)} à {money(fact.value.high)}</p>}
      </details>
      {month && editableKeys?.includes(fact.factKey) && <p><MonthlySourceLink month={month} focus={fact.factKey}>Ajuster la prévision de cette charge</MonthlySourceLink></p>}
      <button type="button" onClick={() => toggle(fact.factKey)}>{detached.has(fact.factKey) ? "Remettre dans Charges fixes" : "Afficher séparément sur le Board"}</button></section>)}
  </dialog>;
}
