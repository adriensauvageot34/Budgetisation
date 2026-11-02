import { useRef, useState } from "react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import { controlInputValue, normalizeControlInput, validateControlValue } from "@/domain/phase2/planner/control-input";
import { controlValuePresentation } from "./control-value-presentation";
import { useWorkshopRaw } from "./inline-edit-registry";
import { money, monthLabel } from "./display";
import styles from "./courses-month-target.module.css";

/** Courses only; UI admission reuses the published monthly field and validator.
 * No amount, floor, financial consequence or durable write is derived here. */
export function CoursesMonthTarget({ model, card, busy, decide }: {
  model: ComposerUiModel; card: ComposerCardView; busy: boolean;
  decide: (operation: ComposerOperation) => boolean;
}) {
  const month = model.board.targetMonth, rule = card.capability?.fields?.amount;
  const admitted = model.semanticState.targetMonth === month && model.monthRead?.targetMonth === month
    && model.monthRead.controlDomains[card.targetRef] === "groceries" && card.kind === "BASELINE_CONTROL"
    && card.capability?.targetRef === card.targetRef && card.capability.actions.includes("SET_SLOT_AMOUNT")
    && card.capability.flexibility !== "LOCKED" && rule?.status === "EDITABLE";
  const presentation = controlValuePresentation(card);
  const rawReference = card.value.referenceValue;
  const reference = rawReference && typeof rawReference === "object" && !Array.isArray(rawReference) ? rawReference as PlannerJsonObject : null;
  const floor = typeof reference?.minimumAmount === "string" ? reference.minimumAmount : null;
  const [editing, setEditing] = useState(false), [text, setText] = useState(""), [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const discard = () => { setEditing(false); setError(""); };
  useWorkshopRaw(card.targetRef, editing, discard, "month-courses");
  const cancel = () => { discard(); requestAnimationFrame(() => trigger.current?.focus()); };
  return <section className={styles.target} aria-label="Cible Courses du mois" data-courses-target={card.targetRef}>
    <p>{presentation.kind === "DECISION" ? "Cible choisie dans le brouillon" : "Montant publié · aucune nouvelle cible choisie"} : {money(presentation.value)} · {monthLabel(month)}</p>
    <p>{floor !== null ? `Plancher réel publié : ${money(floor)} · fondé sur la consommation constatée.` : "Plancher réel non publié dans cette lecture."} Les dépenses constatées ne sont pas modifiées par ce réglage.</p>
    {!editing ? <button ref={trigger} type="button" disabled={busy || !admitted} onClick={() => {
      setText(presentation.value ?? ""); setError(""); setEditing(true);
    }}>Ajuster la cible</button> : <form onSubmit={event => {
      event.preventDefault(); setError("");
      try {
        if (busy || !admitted) throw new TypeError("Édition non publiée pour cette cible et ce mois.");
        const value = controlInputValue(card, "amount", normalizeControlInput(text));
        validateControlValue(card, value);
        if (!decide({ kind: "MUTATE", mutation: { kind: "SET_STATE", targetRef: card.targetRef, value } }))
          throw new TypeError("Ce réglage n’a pas été admis. La cible précédente est conservée.");
        cancel();
      } catch (failure) {
        setError(failure instanceof Error && failure.message === "COMPOSER_CONTROL_FIELD_NOT_ADMITTED"
          ? `Valeur refusée par les règles de cette cible. Minimum admis : ${money(rule?.minimum ?? null)}.`
          : failure instanceof Error ? failure.message : "Réglage refusé par la source.");
      }
    }}>
      <label>Nouvelle cible Courses (€)<input autoFocus inputMode="decimal" value={text} disabled={busy || !admitted}
        onChange={event => { setText(event.target.value); setError(""); }} onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
        }} /></label>
      <button type="submit" disabled={busy || !admitted}>Conserver la cible dans le brouillon</button>
      <button type="button" onClick={cancel}>Annuler la saisie</button>
    </form>}
    {!admitted && <p>Consultation seulement · édition non publiée pour cette cible et ce mois.</p>}
    {error && <p role="alert">{error}</p>}
    <p>Choix local du mois, sans paiement ni sauvegarde attestée. Undo permet d’annuler un choix admis.</p>
  </section>;
}
