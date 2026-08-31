import styles from "@/features/history-v2/history-v2.module.css";

export default function HistoryV2Loading() {
  return (
    <div className={styles.page} aria-label="Chargement de l’Historique V2" aria-busy="true">
      <div className={styles.loadingShell}>
        <div className={styles.loadingSegmented} />
        <div className={styles.loadingMonth} />
        <div />
      </div>
      <div className={styles.loadingCalendar}>
        {Array.from({ length: 7 }, (_, index) => <div key={`weekday-${index}`} />)}
        {Array.from({ length: 35 }, (_, index) => <div key={`day-${index}`} />)}
      </div>
    </div>
  );
}
