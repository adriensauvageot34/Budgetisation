import { LockKeyhole, SlidersHorizontal, Pin, Link2, MoreHorizontal } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import type { ComposerObjectPresentation } from "@/domain/phase2/planner/composer-ui-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { AtomicPopover } from "./atomic-popover";
import { money, quantityLabel } from "./display";
import styles from "./composer.module.css";
import { useComposerInteractions, useDragHandle, leftSurface } from "./interactions";
import { InlineControlValue } from "./inline-control-value";
import { controlAccessLabel } from "@/domain/phase2/planner/control-input";
import { presentationLabel } from "./presentation-label";
import { controlMainDimension, controlValuePresentation, controlValueSummary } from "./control-value-presentation";

export function ComposerCard({ card, presentation, busy, preserved, focused = false, focus = () => {}, edit, preserve, mutate, hover, details }: {
  card: ComposerCardView; presentation: ComposerObjectPresentation; busy: boolean; preserved: boolean; focused?: boolean; focus?: () => void;
  details: () => void; edit: () => void; preserve: () => void; mutate: (mutation: SemanticMutation) => void; hover: (mutation: SemanticMutation | null) => void }) {
  const locked = card.capability?.flexibility === "LOCKED", editable = !!card.capability?.actions.length && !locked, count = card.value.count;
  const gauge = presentation.reservationGauge ?? presentation.choiceGauge;
  const interaction = useComposerInteractions(), handle = useDragHandle(presentation.protectedSavings || preserved ? `control:${card.targetRef}` : undefined);
  const assistantTarget = interaction?.canTarget(card.targetRef);
  const label = presentationLabel(card.label), valuePresentation = controlValuePresentation(card);
  return <article className={styles.card} data-control={card.targetRef} data-variant={presentation.variant} data-focused={focused} data-protected={presentation.protectedSavings} data-card-family={locked ? "PROTECTED" : card.kind === "SAVINGS" ? "RESERVATION" : "ADJUSTABLE"}
    data-state={valuePresentation.kind === "DECISION" ? "chosen" : valuePresentation.kind === "UNKNOWN" ? "unresolved" : "derived"} data-value-status={valuePresentation.kind} {...handle}
    data-compatible={assistantTarget} data-unresolved={interaction?.unresolvedRefs.includes(card.targetRef)} data-snap={interaction?.motionTarget === card.targetRef ? interaction.motion : undefined}
    data-recoil={interaction?.motion === "recoil" && interaction.motionTarget === `control:${card.targetRef}`}
    onClick={e => { if (e.target instanceof Element && !e.target.closest("button,input,select,a,[popover]")) focus(); }}
    onDragOver={e => { e.stopPropagation(); if (assistantTarget && !busy) { e.preventDefault(); interaction?.overAssistant(card.targetRef); } else interaction?.over(null); }}
    onDragLeave={e => { e.stopPropagation(); if (leftSurface(e)) interaction?.overAssistant(null); }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (assistantTarget && !busy) interaction?.placeAssistant(card.targetRef); }}>
    <div className={styles.cardTop}><span className={styles.cardState} title={valuePresentation.label} aria-label={valuePresentation.label}>
      {valuePresentation.kind === "UNKNOWN" ? <i /> : valuePresentation.kind === "REFERENCE" ? <Link2 size={11} /> : null}</span>
      <div className={styles.cardUtility}>{locked && !preserved ? <LockKeyhole size={14} aria-label="Réservation ou contrainte protégée" />
        : <button disabled={busy} className={styles.iconButton} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={preserve}>{preserved ? <LockKeyhole size={14} /> : <Pin size={14} />}</button>}
        <AtomicPopover utility label={`Détails de ${card.label}`} state="DETAILS" focus={focus} icon={<MoreHorizontal size={15} />}>{close => <>
          <p className={styles.popoverAmount}>{controlValueSummary(card)}</p>
          <p className={styles.popoverNote}>{valuePresentation.label}</p>
          {presentation.variant === "HABIT" && <p className={styles.popoverNote}>Habituel : {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</p>}
          {gauge && <p className={styles.popoverNote}>Repère initial : {money(gauge.referenceAmount)} → {card.value.decisionValue ? "choix du mois" : "réservation du mois"} : {money(card.value.amount)}</p>}
          {presentation.variant === "SAVINGS" && <p className={styles.popoverNote}>
            {card.value.reservationSource === "ANNUAL_PLAN" ? "Objectif annuel" : "Déclaration du mois"} ·
            {locked ? " réservation protégée, lecture seule" : " réservation ajustable pour ce scénario"}.
            Aucun mouvement bancaire n’est créé.
          </p>}
          <button type="button" onClick={() => { close(); focus(); details(); }}>Voir les détails</button>
          <p className={styles.popoverNote}>{controlAccessLabel(card)} · budget du mois entier</p>
          {card.value.conditionalAccepted === false && <p className={styles.popoverNote}>Besoin conditionnel · à confirmer</p>}
          {editable && <div className={styles.popoverActions}><button data-card-edit disabled={busy} onClick={() => { close(); edit(); }}>Ajuster</button>{card.capability?.naturalPresets.map(p => <button disabled={busy} key={p.label} data-preset={p.label} onClick={() => { close(); mutate(p.semanticMutation); }}>{p.label}</button>)}</div>}
        </>}</AtomicPopover>
      </div></div>
    <div className={styles.objectIdentity}><PlannerIcon iconKey={presentation.iconKey} identityRef={card.targetRef} className={styles.objectIcon} />
      <div><h3 title={card.label}>{label.title}</h3>{label.person && <span className={styles.personChip}>{label.person}</span>}</div></div>
    <InlineControlValue card={card} dimension={controlMainDimension(card)} busy={busy} focus={focus} mutate={mutate} />
    {card.capability?.fields?.count?.status === "EDITABLE" && <><InlineControlValue card={card} dimension="unitAmount" busy={busy} focus={focus} mutate={mutate} />
      <small className={styles.officialSlotCost}>{card.value.remainingCount !== card.value.count && !card.value.projectionPending ? "Coût restant du poste" : "Coût du mois"} : {card.value.projectionPending ? "simulation en cours" : money(card.value.economicAmount)}</small></>}
    {presentation.variant !== "SAVINGS" && <small className={styles.valueScope}>{valuePresentation.label}</small>}
    {presentation.variant === "HABIT" && card.value.inclusion !== "SUGGESTION_ONLY" && (presentation.baselineAmount !== null || presentation.baselineCount !== null) && <small className={styles.habitReference}>Habituel {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</small>}
    {presentation.occurrenceStack && !card.value.projectionPending && <div className={styles.occurrenceStack} data-occurrence-stack aria-label={`${quantityLabel(count)} occurrences · ${presentation.occurrenceStack.links.length ? "reliées à des moments explicites" : "enveloppe du mois"}`}>
      {presentation.occurrenceStack.bubbles.map((state, index) => <span key={index} data-occurrence-state={state} title={state === "LINKED" ? presentation.occurrenceStack!.links.map(l => l.label).join(" · ") : "Occurrence disponible"}>{state === "LINKED" && <Link2 size={11} />}</span>)}
      {presentation.occurrenceStack.overflow !== null && <small>+{presentation.occurrenceStack.overflow}</small>}</div>}
    {presentation.variant === "SAVINGS" && gauge?.percent !== null && gauge && <div className={styles.reservationGauge}><div className={styles.gaugeTrack} role="progressbar" aria-label={`${card.label}, réservation par rapport au repère initial, pas une progression d’objectif`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gauge.percent} aria-valuetext={`${money(gauge.referenceAmount)} → ${money(card.value.amount)}`}><span style={{ width: `${gauge.percent}%` }} /></div></div>}
    {presentation.variant === "SAVINGS" && <small className={styles.reservationLabel}>
      {locked ? "Réservation protégée · lecture seule" : `Ajustable · déclaré ${money(card.value.declaredAmount as string ?? null)}`}
      {gauge && " · réservation / repère initial"}
    </small>}
  </article>;
}
