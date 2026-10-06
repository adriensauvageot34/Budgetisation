import { LockKeyhole, SlidersHorizontal, Pin } from "lucide-react";
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
  return <article className={styles.card} data-control={card.targetRef} data-variant={presentation.variant} data-protected={presentation.protectedSavings} data-state={card.value.owned ? "chosen" : card.knowledge === "UNKNOWN" ? "unresolved" : "derived"}>
    <div className={styles.cardTop}><span className={styles.badge}>{card.value.owned ? "Choisi" : knowledgeLabel(card.knowledge)}</span>{locked && !preserved ? <LockKeyhole size={15} aria-label="Réservation ou contrainte protégée" /> : <button disabled={busy} className={styles.iconButton} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={preserve}><Pin size={14} /></button>}</div>
    <PlannerIcon iconKey={presentation.iconKey} className={styles.objectIcon} />
    <h3>{card.label}</h3><strong className={styles.cardValue}>{count !== null && count !== undefined ? `${quantityLabel(count)} occurrence${count === "1.00" || count === "1" ? "" : "s"}` : money(card.value.amount)}</strong>
    {presentation.variant === "HABIT" && (presentation.baselineCount !== null || presentation.baselineAmount !== null) && <p className={styles.habitReference}>Habituel : {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</p>}
    {presentation.variant === "SAVINGS" && <p className={styles.savingsNote}>{presentation.protectedSavings ? "Préservée" : "Allocation ajustable"} · réservation du mois</p>}
    {presentation.reservationGauge && <div className={styles.reservationGauge}>
      {presentation.reservationGauge.percent !== null && <div className={styles.gaugeTrack} role="progressbar" aria-label={`Allocation mensuelle de ${card.label}, comparée à sa réservation initiale`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={presentation.reservationGauge.percent} aria-valuetext={`${money(card.value.amount)} réservés · repère initial ${money(presentation.reservationGauge.referenceAmount)}`}><span style={{ width: `${presentation.reservationGauge.percent}%` }} /></div>}
      <small>Repère initial : {money(presentation.reservationGauge.referenceAmount)}</small></div>}
    {count !== null && count !== undefined && <p className={styles.cardNote}>{money(card.value.unitAmount)} / occurrence</p>}
    {card.historicalReferences && <details className={styles.references}><summary>Repères historiques</summary><p>Bas : {reference(range?.low)} · médian : {reference(range?.central)} · haut : {reference(range?.high)}</p><p>Mois clos comparables · ces repères restent fixes quand vous composez.</p></details>}
    {card.value.conditionalAccepted === false && <p className={styles.cardNote}>Besoin conditionnel · à confirmer</p>}
    {locked ? <p className={styles.cardNote}>{preserved ? "Préservé dans ce brouillon" : "Socle protégé / suivi structurel"}</p> : <div className={styles.cardActions}><button data-card-edit disabled={busy} onClick={edit}><SlidersHorizontal size={13} /> Ajuster</button>
      {card.capability?.naturalPresets.slice(0, 2).map(p => <button disabled={busy} key={p.label} data-preset={p.label} onMouseEnter={() => hover(p.semanticMutation)} onFocus={() => hover(p.semanticMutation)} onMouseLeave={() => hover(null)} onBlur={() => hover(null)} onClick={() => mutate(p.semanticMutation)}>{p.label}</button>)}</div>}
  </article>;
}
