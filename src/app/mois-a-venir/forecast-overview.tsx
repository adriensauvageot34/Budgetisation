import Link from "next/link";
import { CalendarClock, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./forecast-overview.module.css";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

type Deadline = { label: string; date: string; amount: string | null; estimated?: boolean };

export function ForecastOverview({ amount, basis, deadline, calendarHref, decisions, decisionAction }: {
  amount: string | null;
  basis: string;
  deadline?: Deadline;
  calendarHref: string;
  decisions: string;
  decisionAction?: ReactNode;
}) {
  return <section className={styles.overview} aria-label="Repères des prévisions">
    <div className={styles.lead}>
      <h2>Marge prévue en fin de mois</h2>
      <strong data-budget-amount="lead">{amount === null ? "À confirmer" : euros.format(Number(amount))}</strong>
      <span>{basis}</span>
    </div>
    <div className={styles.signal}>
      <h2><CalendarClock size={16} aria-hidden /> Prochaine échéance</h2>
      {deadline ? <>
        <strong data-budget-amount="comparison">{deadline.amount === null ? "À chiffrer" : euros.format(Number(deadline.amount))}</strong>
        <span>{deadline.label} · <time dateTime={deadline.date}>{dateLabel.format(new Date(deadline.date))}</time>{deadline.estimated && " · Date estimée"}</span>
        <Link href={`${calendarHref}&jour=${encodeURIComponent(deadline.date)}`} prefetch={false}>Voir dans le calendrier <ChevronRight size={13} aria-hidden /></Link>
      </> : <span>Aucune échéance à venir datée</span>}
    </div>
    <div className={styles.signal}>
      <h2><SlidersHorizontal size={16} aria-hidden /> À arbitrer</h2>
      <strong>{decisions}</strong>
      {decisionAction}
    </div>
  </section>;
}

export function ForecastGroup({ label, summary, children }: { label: string; summary?: string; children: ReactNode }) {
  return <details name="forecast-reading" className={styles.group}>
    <summary><span>{label}</span>{summary && <strong data-budget-amount>{summary}</strong>}<ChevronRight size={15} aria-hidden /></summary>
    <div className={styles.groupBody}>{children}</div>
  </details>;
}
