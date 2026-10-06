import type { PlanBalanceSuggestions } from "@/domain/phase2/planner/adjustment-contract";
import { money } from "./display";
import styles from "./composer.module.css";
import { useComposerInteractions } from "./interactions";
export function BalanceLayer({ suggestions, busy, accept }: { suggestions: PlanBalanceSuggestions; busy: boolean; accept: (candidateId: string) => void }) {
  const interaction = useComposerInteractions();
  return <div className={styles.balanceList} data-candidate-set={suggestions.candidateSetDigest}>
    {suggestions.candidates.length ? suggestions.candidates.map(c => <button key={c.candidateId} data-candidate={c.candidateId} data-candidate-target={c.targetRef} className={styles.suggestionCard} disabled={busy}
      draggable={!busy} data-grabbed={interaction?.grabbed?.sourceKey === `assistant:${c.candidateId}`} onDragStart={e => interaction?.start(`assistant:${c.candidateId}`, e)} onDragEnd={() => interaction?.end()} onClick={() => accept(c.candidateId)}>
      <strong>{c.label}</strong><span>Impact sur le reste : {money(c.impactOnMonthEnd)}</span><small>Reste projeté : {money(c.projection.plan.economicMonthEndRemainder)}</small></button>) : <p>Aucun ajustement disponible avec vos protections actuelles.</p>}
    {suggestions.resolutionSuggestions.length > 0 && <p>Des informations manquantes doivent être précisées avant certains arbitrages.</p>}
  </div>;
}
