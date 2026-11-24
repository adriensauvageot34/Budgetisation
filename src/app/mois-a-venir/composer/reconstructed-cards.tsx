import { createContext, useContext } from "react";
import { julyPilotLabels, type JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import { JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import type { RealizedCard } from "@/server/phase2/planner/realized-month";
import { RealizedBadge } from "./realized-badge";
import styles from "./realized-month.module.css";

export const ReconstructedCards = createContext<ReadonlyMap<string, RealizedCard> | undefined>(undefined);
export const JulyPilotCardStatuses = createContext<ReadonlyMap<string, JulyPilotStatus[]> | undefined>(undefined);

export function JulyPilotChip({ status }: { status: JulyPilotStatus }) {
  return <span className={styles.pilotChip} data-pilot-chip={status}>{julyPilotLabels[status]}</span>;
}

export function DraftJulyStatus({ id, date }: { id: string; date: unknown }) {
  const pilot = useContext(JulyPilotCardStatuses);
  if (!pilot) return null;
  const inferred = typeof date !== "string" ? "undated" : date > JULY_PILOT_DATE ? "planned" : "pending";
  const recorded = pilot.get(id);
  const statuses = recorded?.includes("confirmed") || typeof date !== "string" && recorded?.length ? recorded : [inferred] as const;
  return <span className={styles.pilotChips}>{statuses.map(status => <JulyPilotChip key={status} status={status} />)}</span>;
}

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
