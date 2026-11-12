import { useEffect, useRef } from "react";
import { ArrowUpRight, LockKeyhole, X } from "lucide-react";
import type { ComposerUiModel, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { useInlineEditRegistry } from "./inline-edit-registry";
import { ComposerProjectionDetails } from "./composer-cockpit";
import { knowledgeLabel } from "./display";
import { controlValuePresentation, controlValueSummary } from "./control-value-presentation";
import styles from "./composer.module.css";
import { controlAccessLabel } from "@/domain/phase2/planner/control-input";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import { ComposerMonthRead, monthReadTargets, monthControlReading } from "./month-read";

/** Non-modal, local presentation of the already admitted model. No transport. */
export function ComposerFinancialInspector({ model, mode, stale, focused, focus, close, busy = false, decide }: {
  model: ComposerUiModel; mode: "FINANCE" | "UNRESOLVED"; stale: boolean; focused: string | null;
  focus: (ref: string) => void; close: () => void;
  busy?: boolean; decide?: (operation: ComposerOperation) => boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const inlineEdits = useInlineEditRegistry();
  const closePanel = () => {
    const targets = new Set(Object.entries(model.monthRead?.controlDomains ?? {}).filter(([, domain]) => domain === "groceries").map(([ref]) => ref));
    if (!inlineEdits || inlineEdits.guard(close, targets)) close();
  };
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>("h2")?.focus();
    return () => { if (invoker?.isConnected && (!document.activeElement || document.activeElement === document.body || node?.contains(document.activeElement))) invoker.focus(); };
  }, []);
  const controls = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings];
  const rows = [...controls.map(card => {
    const reading = stale ? monthControlReading(model, card, true) : null;
    return { ref: card.targetRef, label: card.label,
      caption: reading?.value ?? controlValueSummary(card), valueStatus: controlValuePresentation(card).kind,
      locked: card.capability?.flexibility === "LOCKED", access: `${reading ? reading.origin === "UNKNOWN" ? "Projection à recalculer" : "Dernière référence · actualisation en attente" : controlValuePresentation(card).label} · ${controlAccessLabel(card)}`,
      hint: card.knowledge === "UNKNOWN" ? "Valeur à préciser" : "Information à compléter" };
  }),
    ...model.board.contexts.map(card => ({ ref: card.contextOccurrenceId, label: card.label,
      caption: stale ? "Évaluation à actualiser" : knowledgeLabel(card.knowledge), valueStatus: undefined, locked: card.readOnly, access: card.readOnly ? "Source externe · lecture seule" : "Voir la carte",
      hint: card.sockets.filter(socket => socket.visualState === "UNRESOLVED").map(socket => socket.label).filter(Boolean).join(" · ") || "Choix ou coût à préciser" }))];
  const monthlyTargets = monthReadTargets(model);
  const shown = mode === "UNRESOLVED" ? rows.filter(row => model.presentation.unresolvedRefs.includes(row.ref)) : rows.filter(row => !monthlyTargets.has(row.ref));
  const decisions = <section className={styles.financeDecisions} aria-label={mode === "FINANCE" ? "Retrouver une décision sur le Board" : "Décisions à préciser"}>
    {mode === "UNRESOLVED" && <h3>{shown.length} élément(s) à regarder</h3>}
    {mode === "FINANCE" && <p>Chaque ligne rejoint sa carte par son identité. Les montants ne sont pas additionnés ici.</p>}
    {shown.map(row => <button key={row.ref} data-inspector-target={row.ref} data-value-status={row.valueStatus} aria-current={focused === row.ref ? "true" : undefined} onClick={() => focus(row.ref)}>
      <span><strong>{row.label}</strong><small>{mode === "UNRESOLVED" && !row.locked ? row.hint : row.access}</small></span>
      {row.locked && <LockKeyhole size={12} aria-label="Lecture seule" />}<b>{row.caption}</b><ArrowUpRight size={14} /></button>)}
    {!shown.length && <p>Aucun élément à préciser dans cet état du scénario.</p>}
  </section>;
  return <aside ref={panel} className={styles.financialInspector} data-financial-inspector data-mode={mode} aria-labelledby="composer-finances-title"
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePanel(); } }}>
    <header><div><small>VOTRE MOIS EN CLAIR</small><h2 id="composer-finances-title" tabIndex={-1}>{mode === "FINANCE" ? "Les finances du mois" : "Les éléments à préciser"}</h2></div>
      <button className={styles.iconButton} aria-label="Fermer le panneau financier" onClick={closePanel}><X size={18} /></button></header>
    <div className={styles.inspectorScroll}>
      {mode === "FINANCE" ? <><ComposerMonthRead model={model} stale={stale} focused={focused} focus={focus} busy={busy} decide={decide} />
        <details className={styles.cockpitDetails}><summary>Projection et financement du mois</summary>
          <ComposerProjectionDetails projection={model.board.cockpit} stale={stale} budgetReading={model.budgetReading} /></details></> : <p className={styles.financeExplanation}>Une information à préciser peut rester dans un brouillon sauvegardé. Elle n’est pas forcément bloquante. Le contrôle de transformation en Plan vérifie les contraintes réelles.</p>}
      {focused && model.cardKnowledge[`control:${focused}`] && <details className={styles.cockpitDetails} data-card-inspector>
        <summary>{controls.find(c => c.targetRef === focused)?.label} · repères et provenance</summary>
        <CardKnowledgePanel knowledge={model.cardKnowledge[`control:${focused}`]} />
      </details>}
      {mode === "FINANCE" ? <details className={styles.cockpitDetails} data-other-month-cards><summary>Autres cartes du mois ({shown.length})</summary>{decisions}</details> : decisions}
    </div>
  </aside>;
}
