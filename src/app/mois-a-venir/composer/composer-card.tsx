import { useEffect, useState } from "react";
import { LockKeyhole, SlidersHorizontal, Pin, Link2, MoreHorizontal, Check } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import type { ComposerObjectPresentation } from "@/domain/phase2/planner/composer-ui-contract";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { AtomicPopover } from "./atomic-popover";
import { money, knowledgeLabel, quantityLabel } from "./display";
import styles from "./composer.module.css";
import { useComposerInteractions, useDragHandle, leftSurface } from "./interactions";
import { presentationLabel } from "./presentation-label";

export function ComposerCard({ card, presentation, busy, preserved, focused = false, focus = () => {}, edit, preserve, mutate, hover }: {
  card: ComposerCardView; presentation: ComposerObjectPresentation; busy: boolean; preserved: boolean; focused?: boolean; focus?: () => void;
  edit: () => void; preserve: () => void; mutate: (mutation: SemanticMutation) => void; hover: (mutation: SemanticMutation | null) => void }) {
  const locked = !card.capability?.actions.length || card.capability.flexibility === "LOCKED", count = card.value.count;
  const range = card.historicalReferences?.range as PlannerJsonObject | undefined;
  const reference = card.historicalReferences?.basis === "OCCURRENCE_COUNT" ? quantityLabel : money;
  const gauge = presentation.reservationGauge ?? presentation.choiceGauge;
  const interaction = useComposerInteractions(), handle = useDragHandle(presentation.protectedSavings || preserved ? `control:${card.targetRef}` : undefined);
  const assistantTarget = interaction?.canTarget(card.targetRef);
  const label = presentationLabel(card.label), hasAmount = typeof card.value.amount === "string";
  const inlineAmount = !locked && !!card.capability?.actions.some(action => action === "SET_SLOT_AMOUNT" || action === "SET_SAVINGS_ALLOCATION");
  const [allocation, setAllocation] = useState(typeof card.value.amount === "string" ? card.value.amount : "");
  useEffect(() => setAllocation(typeof card.value.amount === "string" ? card.value.amount : ""), [card.value.amount]);
  const allocationMutation = (amount: string): SemanticMutation => ({ kind: "SET_STATE", targetRef: card.targetRef, value: { amount } });
  return <article className={styles.card} data-control={card.targetRef} data-variant={presentation.variant} data-focused={focused} data-protected={presentation.protectedSavings}
    data-state={card.value.owned ? "chosen" : card.knowledge === "UNKNOWN" ? "unresolved" : "derived"} {...handle}
    data-compatible={assistantTarget} data-unresolved={interaction?.unresolvedRefs.includes(card.targetRef)} data-snap={interaction?.motionTarget === card.targetRef ? interaction.motion : undefined}
    data-recoil={interaction?.motion === "recoil" && interaction.motionTarget === `control:${card.targetRef}`}
    onClick={e => { if (e.target instanceof Element && !e.target.closest("button,input,select,a,[popover]")) focus(); }}
    onDragOver={e => { e.stopPropagation(); if (assistantTarget && !busy) { e.preventDefault(); interaction?.overAssistant(card.targetRef); } else interaction?.over(null); }}
    onDragLeave={e => { e.stopPropagation(); if (leftSurface(e)) interaction?.overAssistant(null); }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (assistantTarget && !busy) interaction?.placeAssistant(card.targetRef); }}>
    <div className={styles.cardTop}><span className={styles.cardState} title={card.value.owned ? "Votre choix" : knowledgeLabel(card.knowledge)} aria-label={card.value.owned ? "Votre choix" : knowledgeLabel(card.knowledge)}>
      {card.knowledge === "UNKNOWN" && !card.value.owned ? <i /> : !card.value.owned ? <Link2 size={11} /> : null}</span>
      <div className={styles.cardUtility}>{locked && !preserved ? <LockKeyhole size={14} aria-label="Réservation ou contrainte protégée" />
        : <button disabled={busy} className={styles.iconButton} aria-label={`${preserved ? "Libérer" : "Préserver"} ${card.label}`} aria-pressed={preserved} onClick={preserve}>{preserved ? <LockKeyhole size={14} /> : <Pin size={14} />}</button>}
        <AtomicPopover utility label={`Détails de ${card.label}`} state="DETAILS" focus={focus} icon={<MoreHorizontal size={15} />}>{close => <>
          <p className={styles.popoverAmount}>{count != null ? `${quantityLabel(count)} occurrence(s) · ${money(card.value.unitAmount)} / occurrence` : money(card.value.amount)}</p>
          {presentation.variant === "HABIT" && <p className={styles.popoverNote}>Habituel : {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</p>}
          {gauge && <p className={styles.popoverNote}>Repère initial : {money(gauge.referenceAmount)} → choix du mois : {money(card.value.amount)}</p>}
          {card.historicalReferences && <details className={styles.references}><summary>Repères historiques</summary><p>Bas : {reference(range?.low)} · médian : {reference(range?.central)} · haut : {reference(range?.high)}</p><p>Mois clos comparables · les repères restent fixes.</p></details>}
          {locked && <p className={styles.popoverNote}>{preserved ? "Préservé dans ce brouillon" : "Socle protégé / suivi structurel"}</p>}
          {card.value.conditionalAccepted === false && <p className={styles.popoverNote}>Besoin conditionnel · à confirmer</p>}
          {!locked && <div className={styles.popoverActions}><button data-card-edit disabled={busy} onClick={() => { close(); edit(); }}>Ajuster</button>{card.capability?.naturalPresets.map(p => <button disabled={busy} key={p.label} data-preset={p.label} onMouseEnter={() => hover(p.semanticMutation)} onFocus={() => hover(p.semanticMutation)} onMouseLeave={() => hover(null)} onBlur={() => hover(null)} onClick={() => { close(); mutate(p.semanticMutation); }}>{p.label}</button>)}</div>}
        </>}</AtomicPopover>
      </div></div>
    <div className={styles.objectIdentity}><PlannerIcon iconKey={presentation.iconKey} identityRef={card.targetRef} className={styles.objectIcon} />
      <div><h3>{label.title}</h3>{label.person && <span className={styles.personChip}>{label.person}</span>}</div></div>
    {count != null || hasAmount ? <button className={styles.valueButton} data-value-edit disabled={locked || busy} onClick={inlineAmount ? focus : edit}>
      <strong key={`${card.value.amount}:${count}`} className={styles.cardValue}>{count != null ? `${quantityLabel(count)} occurrence${count === "1.00" || count === "1" ? "" : "s"}` : money(card.value.amount)}</strong>
    </button> : <button className={styles.unknownBudget} data-budget-unknown disabled={locked || busy} onClick={inlineAmount ? focus : edit}><i /> Budget à préciser</button>}
    {presentation.variant === "HABIT" && (presentation.baselineAmount !== null || presentation.baselineCount !== null) && <small className={styles.habitReference}>Habituel {presentation.baselineCount !== null ? `${quantityLabel(presentation.baselineCount)} occurrence(s)` : money(presentation.baselineAmount)}</small>}
    {presentation.occurrenceStack && <div className={styles.occurrenceStack} data-occurrence-stack aria-label={`${quantityLabel(count)} occurrences · ${presentation.occurrenceStack.links.length ? "reliées à des moments explicites" : "enveloppe du mois"}`}>
      {presentation.occurrenceStack.bubbles.map((state, index) => <span key={index} data-occurrence-state={state} title={state === "LINKED" ? presentation.occurrenceStack!.links.map(l => l.label).join(" · ") : "Occurrence disponible"}>{state === "LINKED" && <Link2 size={11} />}</span>)}
      {presentation.occurrenceStack.overflow !== null && <small>+{presentation.occurrenceStack.overflow}</small>}</div>}
    {presentation.variant === "SAVINGS" && gauge?.percent !== null && gauge && <div className={styles.reservationGauge}><div className={styles.gaugeTrack} role="progressbar" aria-label={`${card.label}, repère initial du mois`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gauge.percent} aria-valuetext={`${money(gauge.referenceAmount)} → ${money(card.value.amount)}`}><span style={{ width: `${gauge.percent}%` }} /></div></div>}
    {inlineAmount ? <form className={styles.savingsInline} data-savings-inline={presentation.variant === "SAVINGS" || undefined} data-amount-inline onSubmit={e => { e.preventDefault(); if (!busy && allocation.trim()) mutate(allocationMutation(allocation)); }}>
      <input aria-label={`Montant mensuel de ${card.label}`} inputMode="decimal" value={allocation} disabled={busy} onFocus={focus}
        onChange={e => { setAllocation(e.target.value); hover(e.target.value.trim() ? allocationMutation(e.target.value) : null); }} onBlur={() => hover(null)} />
      <span>€</span><button aria-label={`Prévisualiser le montant de ${card.label}`} disabled={busy || !allocation.trim()}><Check size={14} /></button>
    </form> : !locked ? <button className={styles.compactEdit} disabled={busy} onClick={edit}><SlidersHorizontal size={12} /> Ajuster</button> : null}
    {presentation.variant === "SAVINGS" && locked && <small className={styles.reservationLabel}>Réservation {preserved ? "préservée" : "protégée"}</small>}
  </article>;
}
