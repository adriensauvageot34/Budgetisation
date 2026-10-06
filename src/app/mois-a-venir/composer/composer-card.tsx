import { LockKeyhole, SlidersHorizontal, Pin, Link2 } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import type { ComposerObjectPresentation } from "@/domain/phase2/planner/composer-ui-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { money, knowledgeLabel, quantityLabel } from "./display";
import styles from "./composer.module.css";
export function ComposerCard({ card, presentation, busy, preserved, edit, preserve, mutate, hover }: { card: ComposerCardView; presentation: ComposerObjectPresentation; busy: boolean; preserved: boolean;
  edit: () => void; preserve: () => void; mutate: (mutation: SemanticMutation) => void; hover: (mutation: SemanticMutation | null) => void }) {
  const locked = !card.capability?.actions.length || card.capability.flexibility === "LOCKED";
  const count = card.value.count;
  const range = card.historicalReferences?.range as PlannerJsonObject | undefined;
  const reference = card.historicalReferences?.basis === "OCCURRENCE_COUNT" ? quantityLabel : money;
  const gauge = presentation.reservationGauge ?? presentation.choiceGauge;
  return <article className={styles.card} data-control={card.targetRef} data-variant={presentation.variant} data-protected={presentation.protectedSavings} data-state={card.value.owned ? "chosen" : card.knowledge === "UNKNOWN" ? "unresolved" : "derived"}>
    <div className={styles.cardTop}><span className={styles.cardState} title={card.value.owned ? "Votre choix" : knowledgeLabel(card.knowledge)} aria-label={card.value.owned ? "Votre choix" : knowledgeLabel(card.knowledge)}>{card.knowledge === "UNKNOWN" && !card.value.owned ? <i /> : !card.value.owned ? <Link2 size={11} /> : null}</span>{locked && !preserved ? <LockKeyhole size={15} aria-label="Réservation ou contrainte protégée" /> : <button disabled={busy} className={styles.iconButton} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={preserve}>{preserved ? <LockKeyhole size={14} /> : <Pin size={14} />}</button>}</div>
    <PlannerIcon iconKey={presentation.iconKey} className={styles.objectIcon} />
    <h3>{card.label}</h3><strong className={styles.cardValue}>{count !== null && count !== undefined ? `${quantityLabel(count)} occurrence${count === "1.00" || count === "1" ? "" : "s"}` : money(card.value.amount)}</strong>
    {presentation.variant === "HABIT" && (presentation.baselineCount !== null || presentation.baselineAmount !== null) && <p className={styles.habitReference}>Habituel : {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</p>}
    {presentation.variant === "SAVINGS" && <p className={styles.savingsNote}>{presentation.protectedSavings ? "Préservée" : "Allocation ajustable"} · réservation du mois</p>}
    {gauge && <div className={styles.reservationGauge}>
      {gauge.percent !== null && <div className={styles.gaugeTrack} role="progressbar" aria-label={`${card.label}, comparé au repère initial du mois`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gauge.percent} aria-valuetext={`${money(gauge.referenceAmount)} → ${money(card.value.amount)}`}><span style={{ width: `${gauge.percent}%` }} /></div>}
      <small>{money(gauge.referenceAmount)} → {money(card.value.amount)}</small></div>}
    {presentation.occurrenceStack && <div className={styles.occurrenceStack} data-occurrence-stack aria-label={`${quantityLabel(count)} occurrences · ${presentation.occurrenceStack.links.length ? "des occurrences sont reliées à des moments explicites" : "enveloppe du mois"}`}>
      {presentation.occurrenceStack.bubbles.map((state, index) => <span key={index} data-occurrence-state={state} title={state === "LINKED" ? "Occurrence consommée par un moment explicite" : "Occurrence disponible"}>{state === "LINKED" && <Link2 size={11} />}</span>)}
      {presentation.occurrenceStack.overflow !== null && <small>+{presentation.occurrenceStack.overflow}</small>}</div>}
    {count !== null && count !== undefined && <p className={styles.cardNote}>{money(card.value.unitAmount)} / occurrence</p>}
    {card.historicalReferences && <details className={styles.references}><summary>Repères historiques</summary><p>Bas : {reference(range?.low)} · médian : {reference(range?.central)} · haut : {reference(range?.high)}</p><p>Mois clos comparables · ces repères restent fixes quand vous composez.</p></details>}
    {card.value.conditionalAccepted === false && <p className={styles.cardNote}>Besoin conditionnel · à confirmer</p>}
    {locked ? <p className={styles.cardNote}>{preserved ? "Préservé dans ce brouillon" : "Socle protégé / suivi structurel"}</p> : <div className={styles.cardActions}><button data-card-edit disabled={busy} onClick={edit}><SlidersHorizontal size={13} /> Ajuster</button>
      {card.capability?.naturalPresets.slice(0, 2).map(p => <button disabled={busy} key={p.label} data-preset={p.label} onMouseEnter={() => hover(p.semanticMutation)} onFocus={() => hover(p.semanticMutation)} onMouseLeave={() => hover(null)} onBlur={() => hover(null)} onClick={() => mutate(p.semanticMutation)}>{p.label}</button>)}</div>}
  </article>;
}
