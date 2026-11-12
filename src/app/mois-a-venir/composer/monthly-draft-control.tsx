import { useRef, useState } from "react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { controlInputValue, normalizeControlInput, validateControlValue } from "@/domain/phase2/planner/control-input";
import { controlValuePresentation } from "./control-value-presentation";
import { useWorkshopRaw } from "./inline-edit-registry";
import { money, monthLabel } from "./display";
import styles from "./courses-month-target.module.css";

/** Edits a published amount or occurrence target through the existing Draft command. */
export function MonthlyDraftControl({ model, card, busy, decide, groceries }: {
  model: ComposerUiModel; card: ComposerCardView; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; groceries: boolean;
}) {
  const month = model.board.targetMonth;
  const dimension = card.capability?.actions.includes("SET_SLOT_OCCURRENCES") ? "count" : "amount";
  const rule = card.capability?.fields?.[dimension];
  const fieldPublished = model.controlEditors.some(editor =>
    editor.targetRef === card.targetRef && editor.fields.some(field => field.key === dimension));
  const admitted = model.semanticState.targetMonth === month && model.monthRead?.targetMonth === month
    && (!groceries || model.monthRead.controlDomains[card.targetRef] === "groceries" && card.kind === "BASELINE_CONTROL")
    && fieldPublished && card.capability?.targetRef === card.targetRef && card.capability.actions.length > 0
    && card.capability.flexibility !== "LOCKED" && rule?.status === "EDITABLE"
    && !model.semanticState.preferences.anchors.includes(card.targetRef)
    && model.semanticState.preferences.flexibility[card.targetRef] !== "PRESERVE";
  const presentation = controlValuePresentation(card);
  const rawReference = card.value.referenceValue;
  const reference = rawReference && typeof rawReference === "object" && !Array.isArray(rawReference) ? rawReference as PlannerJsonObject : null;
  const floor = typeof reference?.minimumAmount === "string" ? reference.minimumAmount : null;
  const [editing, setEditing] = useState(false), [text, setText] = useState(""), [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const original = useRef("");
  const authority = canonicalPlannerJson({ month, ref: card.targetRef, baseline: model.proof.expectedBaselineDigest,
    revisionId: model.proof.expectedActiveRevisionId, revision: model.proof.expectedActiveRevisionNumber,
    rule: rule ?? null, value: card.value[dimension] ?? null,
    choice: model.semanticState.controls.find(control => control.decisionSlotKey === card.targetRef) ?? null });
  const discard = () => { setEditing(false); setError(""); };
  useWorkshopRaw(card.targetRef, editing, discard, "month-control");
  const cancel = () => { discard(); requestAnimationFrame(() => trigger.current?.focus()); };
  const label = groceries ? "Nouvelle cible Courses (€)" : dimension === "count" ? "Occurrences restantes" : "Montant du mois (€)";
  return <section className={styles.target} aria-label={groceries ? "Cible Courses du mois" : `Réglage · ${card.label}`}
    data-month-control-target={card.targetRef} data-courses-target={groceries ? card.targetRef : undefined}>
    {groceries && <><p>{presentation.kind === "DECISION" ? "Cible choisie dans le brouillon" : "Montant publié · aucune nouvelle cible choisie"} : {money(presentation.value)} · {monthLabel(month)}</p>
      <p>{floor !== null ? `Plancher réel publié : ${money(floor)} · fondé sur la consommation constatée.` : "Plancher réel non publié dans cette lecture."} Les dépenses constatées ne sont pas modifiées par ce réglage.</p></>}
    {!editing ? <button ref={trigger} type="button" disabled={busy || !admitted} onClick={() => {
      original.current = authority;
      const value = card.value[dimension];
      setText(typeof value === "string" && presentation.kind !== "UNKNOWN" ? value : "");
      setAccepted(false); setError(""); setEditing(true);
    }}>{groceries ? "Ajuster la cible" : "Ajuster dans le brouillon"}</button> : <form onSubmit={event => {
      event.preventDefault(); setError("");
      try {
        if (busy || !admitted) throw new TypeError("Édition indisponible pour cette cible et ce mois. Votre saisie est conservée.");
        if (original.current !== authority) throw new TypeError("La référence ou le choix a changé. Votre saisie est conservée. Rouvrez le réglage avant de confirmer.");
        const value = controlInputValue(card, dimension, normalizeControlInput(text, dimension === "count"));
        validateControlValue(card, value);
        if (!decide({ kind: "MUTATE", mutation: { kind: "SET_STATE", targetRef: card.targetRef, value } }))
          throw new TypeError("Ce réglage n’a pas été admis. La cible précédente est conservée.");
        setAccepted(true); cancel();
      } catch (failure) {
        setError(failure instanceof Error && failure.message === "COMPOSER_CONTROL_FIELD_NOT_ADMITTED"
          ? "Valeur hors des limites publiées pour ce poste. Votre saisie est conservée."
          : failure instanceof Error ? failure.message : "Réglage refusé par la source.");
      }
    }}>
      <label>{label}<input autoFocus inputMode={dimension === "count" ? "numeric" : "decimal"} value={text} disabled={busy || !admitted}
        onChange={event => { setText(event.target.value); setError(""); }} onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
        }} /></label>
      <button type="submit" disabled={busy || !admitted}>{groceries ? "Conserver la cible dans le brouillon" : "Conserver le réglage dans le brouillon"}</button>
      <button type="button" onClick={cancel}>Annuler la saisie</button>
    </form>}
    {!admitted && <p>Consultation seulement · édition non publiée ou poste protégé.</p>}
    {error && <p role="alert">{error}</p>}
    {accepted && <p role="status">Choix retenu dans le brouillon. Le bandeau indique l’état de sa sauvegarde.</p>}
  </section>;
}
