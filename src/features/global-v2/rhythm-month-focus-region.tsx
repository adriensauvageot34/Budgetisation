import type { ReactNode } from "react";
import { OverlayFrame } from "@/ui";
import styles from "./background-rhythms.module.css";

export function RhythmMonthFocusRegion({ domain, labelledBy, onClose, children }: {
  readonly domain: "food" | "car";
  readonly labelledBy: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  return <OverlayFrame kind="exploration" title={domain === "food" ? "Alimentation du mois" : "Déplacements du mois"} closeAction={{ kind: "callback", onAction: onClose }} closeOnBackdrop>
    <section className={styles.monthFocusRegion} data-domain={domain} aria-labelledby={labelledBy}>{children}</section>
  </OverlayFrame>;
}
