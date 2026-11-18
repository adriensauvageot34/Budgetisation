import { createContext, useContext } from "react";
import type { RealizedCard } from "@/server/phase2/planner/realized-month";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

export const ReconstructedCards = createContext<ReadonlyMap<string, RealizedCard> | undefined>(undefined);

export function useReconstructedCard(id: string) {
  return useContext(ReconstructedCards)?.get(id);
}

export function ObservedMerchantBadges({ card }: { card: RealizedCard | undefined }) {
  if (!card) return null;
  const badges = [...new Map(card.payments.flatMap(payment => payment.badge
    ? [[payment.badge.label, payment.badge] as const] : [])).values()];
  return badges.length ? <span className={styles.observedBadges} role="group" aria-label="Marchands des opérations observées">
    {badges.slice(0, 3).map(badge => <RealizedBadge {...badge} key={badge.label} named />)}
    {badges.length > 3 && <small title={badges.slice(3).map(badge => badge.label).join(", ")}>+${badges.length - 3}</small>}
  </span> : null;
}
