import type { PlanBalanceSuggestions } from "@/domain/phase2/planner/adjustment-contract";
import { money } from "./display";
import styles from "./composer.module.css";
export function BalanceLayer({ suggestions, busy, accept }: { suggestions: PlanBalanceSuggestions; busy: boolean; accept: (candidateId: string) => void }) {
  return <div className={styles.balanceList}><p>Chaque proposition a été resimulée avec votre mois. Vous décidez de l’accepter.</p>
    {suggestions.candidates.length ? suggestions.candidates.map(c => <article key={c.candidateId} data-candidate={c.candidateId}><div><strong>{c.label}</strong><p>Impact sur le reste : {money(c.impactOnMonthEnd)}</p><small>Reste projeté : {money(c.projection.plan.economicMonthEndRemainder)}</small></div><button className={styles.secondary} disabled={busy} onClick={() => accept(c.candidateId)}>Essayer</button></article>) : <p>Aucun ajustement disponible avec vos protections actuelles.</p>}
    {suggestions.resolutionSuggestions.length > 0 && <p>Des informations manquantes doivent être précisées avant certains arbitrages.</p>}
  </div>;
}
