import type { ReactNode } from "react";
import styles from "./global-atomic.module.css";

export function AtomicDetailPages({ children }: { readonly children: ReactNode }) {
  return <div className={styles.detailViewport}>
    <div className={styles.detailColumns}>{children}</div>
  </div>;
}
