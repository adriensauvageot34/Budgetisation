import styles from "./background-rhythms.module.css";

export function BackgroundRhythmsSkeleton() {
  return <div className={styles.backgroundSkeleton} role="status" aria-label="Chargement de nos rythmes de fond" aria-busy="true"><span /><span /><span /><span /></div>;
}
