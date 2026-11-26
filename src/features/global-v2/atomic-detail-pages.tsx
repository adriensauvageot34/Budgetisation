import type { ReactNode } from "react";
import styles from "./global-atomic.module.css";

export function AtomicDetailPages({ children, inline }: { readonly children: ReactNode; readonly inline?: boolean }) {
  return <div className={styles.detailViewport} data-fit-detail={inline ? undefined : ""}>
    <div className={styles.detailColumns}>{children}</div>
  </div>;
}
