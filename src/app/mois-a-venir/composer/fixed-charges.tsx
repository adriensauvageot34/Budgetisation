import { useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";
import type { BaselineStructuralFact } from "@/domain/phase2/planner/baseline-contract";
import { money, knowledgeLabel } from "./display";
import styles from "./composer.module.css";

export function FixedChargeCard({ facts, detached, open, reattach }: { facts: readonly BaselineStructuralFact[]; detached?: boolean; open: () => void; reattach: () => void }) {
  const known = facts.filter(f => f.value.central !== null).length;
  return <article className={styles.fixedChargeCard} data-fixed-charges={detached ? facts[0]?.factKey : "group"}>
    <FileText size={24} /><h3>{detached ? facts[0]?.label : "Charges fixes"}</h3>
    {detached ? <strong>{money(facts[0]?.value.central)}</strong> : <p>{known} montant(s) connu(s) · {facts.length - known} à préciser</p>}
    <small>Socle du mois · lecture seule dans Composer</small>
    <button type="button" onClick={open}>{detached ? "Voir la charge" : `Voir les charges (${facts.length})`}</button>
    {detached && <button type="button" onClick={reattach}>Remettre dans Charges fixes</button>}
  </article>;
}
export function FixedChargesDetails({ facts, detached, toggle, close }: { facts: readonly BaselineStructuralFact[]; detached: ReadonlySet<string>; toggle: (key: string) => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const opener = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); opener?.focus(); }; }, []);
  return <dialog ref={dialog} className={styles.reuseDialog} aria-label="Charges fixes du mois" onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2>Charges fixes du mois</h2><button type="button" aria-label="Fermer les charges fixes" onClick={close}><X size={18} /></button></header>
    <p>Faits publiés par les propriétaires du mois. Aucun nouveau coût ni total n’est ajouté. Une charge peut être résiliable auprès de sa source.</p>
    <small>Afficher séparément change seulement la disposition dans ce navigateur.</small>
    {facts.map(fact => <section key={fact.factKey} data-fixed-fact={fact.factKey}><h3>{fact.label} · {money(fact.value.central)}</h3>
      <p>{knowledgeLabel(fact.knowledge)} · {fact.dueDate ? `Échéance : ${fact.dueDate}` : "Échéance à préciser"}</p>
      <small>Source : {String(fact.metadata.ownerAuthority ?? fact.sourceRefs.join(", "))}</small>
      <details><summary>Provenance et portée</summary><p>{fact.sourceRefs.join(" · ")}</p><p>Fourchette publiée : {money(fact.value.low)} à {money(fact.value.high)}</p></details>
      <button type="button" onClick={() => toggle(fact.factKey)}>{detached.has(fact.factKey) ? "Remettre dans Charges fixes" : "Afficher séparément sur le Board"}</button></section>)}
  </dialog>;
}
