import { useEffect, useRef, useState } from "react";
import Big from "big.js";
import { Minus, Plus, Check, X } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ControlDimension, SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { controlInputValue, normalizeControlInput } from "@/domain/phase2/planner/control-input";
import { money, quantityLabel } from "./display";
import styles from "./composer.module.css";

export function InlineControlValue({ card, dimension, busy, focus, mutate }: {
  card: ComposerCardView; dimension: ControlDimension; busy: boolean; focus: () => void; mutate: (mutation: SemanticMutation) => void;
}) {
  const rule = card.capability?.fields?.[dimension], admitted = rule?.status === "EDITABLE";
  const raw = card.value[dimension], value = typeof raw === "string" ? raw : null;
  const optional = dimension === "amount" && !card.value.decisionValue && card.value.inclusion === "SUGGESTION_ONLY";
  const title = dimension === "count" ? "Nombre d’occurrences" : dimension === "unitAmount" ? "Prix par occurrence" : "Montant du mois";
  const [editing, setEditing] = useState(false), [text, setText] = useState(""), [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null), latest = useRef({ card, mutate, busy });
  latest.current = { card, mutate, busy };
  const button = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    const next = pendingRef.current; if (next === null) return;
    pendingRef.current = null; setPending(null);
    try {
      if (latest.current.busy) throw new TypeError("Validation en cours. Réessayez ce réglage.");
      latest.current.mutate({ kind: "SET_STATE", targetRef: card.targetRef, value: controlInputValue(latest.current.card, dimension, next) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Réglage non admis."); }
  };
  const commit = () => {
    try {
      if (!rule || busy) return;
      const next = normalizeControlInput(text, rule.integer), amount = new Big(next);
      if (amount.lt(rule.minimum) || amount.gt(rule.maximum)) throw new TypeError(`Valeur admise : ${rule.minimum} à ${rule.maximum}.`);
      const decision = controlInputValue(card, dimension, next);
      mutate({ kind: "SET_STATE", targetRef: card.targetRef, value: decision }); setEditing(false); setError("");
      requestAnimationFrame(() => button.current?.focus());
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez la valeur."); }
  };
  const adjust = (direction: -1 | 1) => {
    if (!rule || busy) return;
    try {
      const current = pendingRef.current ?? value;
      if (current === null) { setText(""); setEditing(true); return; }
      const amount = new Big(current).plus(new Big(rule.step).times(direction));
      if (amount.lt(rule.minimum) || amount.gt(rule.maximum)) return;
      const next = amount.toFixed(rule.integer ? 0 : 2);
      pendingRef.current = next; setPending(next); setError(""); focus();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 350);
    } catch { setError("Précisez une valeur avant de l’ajuster."); }
  };
  const displayed = pending ?? value;
  const caption = displayed === null || optional && pending === null ? dimension === "count" ? "Occurrences à définir" : dimension === "unitAmount" ? "Prix à préciser" : "À définir"
    : dimension === "count" ? `${quantityLabel(displayed)} occurrence${new Big(displayed).eq(1) ? "" : "s"}` : money(displayed);
  return <div className={styles.directValue} data-control-dimension={dimension} data-inline-dirty={editing || pending !== null || undefined} data-value-pending={pending !== null || undefined}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) flush(); }}>
    {editing ? <form className={styles.directValueForm} onSubmit={event => { event.preventDefault(); commit(); }}>
      <label><span className={styles.visuallyHidden}>{title} de {card.label}</span><input ref={input} aria-label={`${title} de ${card.label}`} inputMode={rule?.integer ? "numeric" : "decimal"} value={text} disabled={busy}
        onChange={event => { setText(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditing(false); setError(""); requestAnimationFrame(() => button.current?.focus()); } }} /></label>
      <button type="submit" disabled={busy} aria-label={`Valider ${title} de ${card.label}`}><Check size={15} /></button>
      <button type="button" aria-label={`Annuler la saisie de ${card.label}`} onClick={() => { setEditing(false); setError(""); }}><X size={14} /></button>
      <small>Entrée valide · Échap annule · Tab conserve la saisie</small>
    </form> : <div className={styles.valueAdjuster}>
      {admitted && <button type="button" className={styles.valueStep} aria-label={`Diminuer ${title} de ${card.label}`} disabled={busy || displayed !== null && new Big(displayed).lte(rule.minimum)} onClick={() => adjust(-1)}><Minus size={13} /></button>}
      <button ref={button} type="button" className={dimension === "unitAmount" ? styles.unitValueButton : styles.valueButton} data-value-edit data-budget-unknown={displayed === null || optional || undefined}
        aria-label={`${title} de ${card.label} : ${caption}`} disabled={!admitted || busy} onClick={() => { const next = pendingRef.current ?? value; flush(); focus(); setText(optional ? "" : next ?? ""); setError(""); setEditing(true); }}>
        <strong className={dimension === "unitAmount" ? styles.unitValue : styles.cardValue}>{caption}</strong>{dimension === "unitAmount" && <small> / occurrence</small>}
      </button>
      {admitted && <button type="button" className={styles.valueStep} aria-label={`Augmenter ${title} de ${card.label}`} disabled={busy || displayed !== null && new Big(displayed).gte(rule.maximum)} onClick={() => adjust(1)}><Plus size={13} /></button>}
    </div>}
    {pending !== null && <small role="status">Réglage en attente…</small>}
    {error && <small role="alert" className={styles.formError}>{error}</small>}
  </div>;
}
