import { useEffect, useRef, useState } from "react";
import { monthReuseProposals } from "@/domain/phase2/planner/month-reuse";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { money, quantityLabel } from "./display";
import styles from "./composer.module.css";

export function MonthReuse({ model, adopt }: { model: ComposerUiModel; adopt: (mutations: readonly SemanticMutation[]) => void }) {
  const proposals = monthReuseProposals(model), dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const close = () => { setOpen(false); dialog.current?.close(); opener.current?.focus(); };
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  if (!proposals.length) return null;
  return <><button type="button" data-month-reuse onClick={() => { opener.current = document.activeElement as HTMLElement; setSelected(new Set(proposals.map(p => p.targetRef))); setOpen(true); }}>Reprendre mon mois habituel</button>
    <dialog ref={dialog} className={styles.reuseDialog} aria-label="Proposition de références pour ce mois" onCancel={event => { event.preventDefault(); close(); }}>
      <h2>Choisir les repères de ce mois</h2><p>Références historiques proposées, jamais appliquées automatiquement. Vos choix existants et les cagnottes sont conservés.</p>
      {proposals.map(item => <label key={item.targetRef}><input type="checkbox" checked={selected.has(item.targetRef)} onChange={() => setSelected(prior => { const next = new Set(prior); if (next.has(item.targetRef)) next.delete(item.targetRef); else next.add(item.targetRef); return next; })} />
        <span><b>{item.label} · {item.reference.key === "MONTH_AMOUNT" ? money(item.reference.value) : `${quantityLabel(item.mutation.value.count)} occurrences`}</b>
          <small>{item.reference.sourceAuthority} · {item.reference.coverageFrom} à {item.reference.coverageTo} · {item.reference.nCoveredMonths} mois comparables</small></span></label>)}
      <p>Les prix inconnus restent à préciser. Budget du mois entier, distinct du reste réel à dépenser. Aucun Plan n’est appliqué.</p>
      <footer><button type="button" onClick={close}>Ne pas reprendre</button><button type="button" disabled={!selected.size} onClick={() => { adopt(proposals.filter(p => selected.has(p.targetRef)).map(p => p.mutation)); close(); }}>Retenir ces repères dans le brouillon</button></footer>
    </dialog></>;
}
