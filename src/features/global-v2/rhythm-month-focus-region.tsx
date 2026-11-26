"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./background-rhythms.module.css";

export function RhythmMonthFocusRegion({ domain, labelledBy, onClose, children }: {
  readonly domain: "food" | "car";
  readonly labelledBy: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  return <section className={styles.monthFocusRegion} data-rhythm-month={domain} aria-labelledby={labelledBy}
    onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }}>
    <button type="button" className={styles.monthClose} aria-label="Fermer le mois" onClick={onClose}><X aria-hidden size={15} /></button>
    {children}
  </section>;
}
