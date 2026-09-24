import type { CSSProperties, ReactNode } from "react";
import styles from "./background-rhythms.module.css";

export function RhythmMonthFocusRegion({ domain, labelledBy, connectorPosition, children }: {
  readonly domain: "food" | "car";
  readonly labelledBy: string;
  readonly connectorPosition: number;
  readonly children: ReactNode;
}) {
  return <section className={styles.monthFocusRegion} data-domain={domain} aria-labelledby={labelledBy} aria-live="polite" style={{ "--focus-connector-position": `${connectorPosition}%` } as CSSProperties}>
    <span className={styles.focusConnector} aria-hidden />
    {children}
  </section>;
}
