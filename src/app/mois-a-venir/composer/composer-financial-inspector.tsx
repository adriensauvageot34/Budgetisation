import { useEffect, useRef } from "react";
import { ArrowUpRight, LockKeyhole, X } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { ComposerProjectionDetails } from "./composer-cockpit";
import { knowledgeLabel, money } from "./display";
import styles from "./composer.module.css";

/** Non-modal, local presentation of the already admitted model. No transport. */
export function ComposerFinancialInspector({ model, mode, stale, focused, focus, close }: {
  model: ComposerUiModel; mode: "FINANCE" | "UNRESOLVED"; stale: boolean; focused: string | null;
  focus: (ref: string) => void; close: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>("h2")?.focus();
    return () => { if (invoker?.isConnected && (!document.activeElement || document.activeElement === document.body || node?.contains(document.activeElement))) invoker.focus(); };
  }, []);
  const controls = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings];
  const rows = [...controls.map(card => ({ ref: card.targetRef, label: card.label,
    caption: typeof card.value.amount === "string" ? money(card.value.amount) : knowledgeLabel(card.knowledge),
    locked: !card.capability?.actions.length || card.capability.flexibility === "LOCKED",
    hint: card.knowledge === "UNKNOWN" ? "Valeur à préciser" : "Information à compléter" })),
    ...model.board.contexts.map(card => ({ ref: card.contextOccurrenceId, label: card.label,
      caption: knowledgeLabel(card.knowledge), locked: card.readOnly,
      hint: card.sockets.filter(socket => socket.visualState === "UNRESOLVED").map(socket => socket.label).filter(Boolean).join(" · ") || "Choix ou coût à préciser" }))];
  const shown = mode === "UNRESOLVED" ? rows.filter(row => model.presentation.unresolvedRefs.includes(row.ref)) : rows;
  return <aside ref={panel} className={styles.financialInspector} data-financial-inspector data-mode={mode} aria-labelledby="composer-finances-title"
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <header><div><small>VOTRE MOIS EN CLAIR</small><h2 id="composer-finances-title" tabIndex={-1}>{mode === "FINANCE" ? "Les finances du mois" : "Les éléments à préciser"}</h2></div>
      <button className={styles.iconButton} aria-label="Fermer le panneau financier" onClick={close}><X size={18} /></button></header>
    <div className={styles.inspectorScroll}>
      {mode === "FINANCE" ? <ComposerProjectionDetails projection={model.board.cockpit} stale={stale} /> : <p className={styles.financeExplanation}>Une information à préciser peut rester dans un brouillon sauvegardé. Elle n’est pas forcément bloquante. Le contrôle de transformation en Plan vérifie les contraintes réelles.</p>}
      <section className={styles.financeDecisions} aria-label={mode === "FINANCE" ? "Retrouver une décision sur le Board" : "Décisions à préciser"}>
        <h3>{mode === "FINANCE" ? "Retrouver mes décisions" : `${shown.length} élément(s) à regarder`}</h3>
        {mode === "FINANCE" && <p>Chaque ligne rejoint sa carte par son identité. Les montants ne sont pas additionnés ici.</p>}
        {shown.map(row => <button key={row.ref} data-inspector-target={row.ref} aria-current={focused === row.ref ? "true" : undefined} onClick={() => focus(row.ref)}>
          <span><strong>{row.label}</strong><small>{row.locked ? "Consultation · source protégée" : mode === "UNRESOLVED" ? row.hint : "Voir la carte"}</small></span>
          {row.locked && <LockKeyhole size={12} aria-label="Lecture seule" />}<b>{stale ? "En attente" : row.caption}</b><ArrowUpRight size={14} /></button>)}
        {!shown.length && <p>Aucun élément à préciser dans cet état du scénario.</p>}
      </section>
    </div>
  </aside>;
}
