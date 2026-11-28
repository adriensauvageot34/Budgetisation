import { Suspense } from "react";
import { MonthLoadingNavigation, type MonthLoadingView } from "./month-loading-navigation";
import styles from "./month-loading.module.css";

const messages = {
  cards: "Chargement des cartes…",
  calendar: "Chargement du calendrier…",
  forecast: "Chargement des prévisions…",
  balance: "Chargement du bilan…",
} satisfies Record<MonthLoadingView, string>;
const days = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

export function MonthLoading({ view, pilot }: { view: MonthLoadingView; pilot?: boolean }) {
  return <div className={styles.root} data-month-loading={view}>
    <Suspense fallback={null}><MonthLoadingNavigation view={view} pilot={pilot} /></Suspense>
    <p className={styles.status} role="status">{messages[view]}</p>
    {view === "calendar" ? <CalendarPreview /> : view === "cards" ? <CardsPreview /> : view === "balance" ? <BalancePreview /> : <FinancePreview />}
  </div>;
}

function CalendarPreview() {
  return <div className={styles.calendar} aria-hidden="true">
    {days.map(day => <div className={styles.weekday} key={day}>{day}</div>)}
    {Array.from({ length: 42 }, (_, day) => <div className={styles.day} key={day}>
      <span className={styles.date} />
      {day % 5 === 2 && <span className={styles.line} />}
    </div>)}
  </div>;
}

function CardsPreview() {
  return <div className={styles.board} aria-hidden="true">
    <div className={styles.filters}><span className={styles.line} /><span className={styles.line} /></div>
    <div className={styles.cards}>
      {Array.from({ length: 12 }, (_, card) => <div className={styles.card} key={card}>
        <span className={styles.illustration} />
        <div><span className={styles.line} /><span className={styles.line} /></div>
      </div>)}
    </div>
  </div>;
}

function FinancePreview() {
  return <div className={styles.forecast} aria-hidden="true">
    <div className={styles.panel}>
      <span className={styles.title} />
      <div className={styles.metrics}>
        {[0, 1, 2].map(metric => <div key={metric}><span className={styles.line} /><span className={styles.line} /></div>)}
      </div>
    </div>
    <div className={styles.panel}>
      <span className={styles.title} />
      {[0, 1, 2].map(row => <span className={styles.forecastRow} key={row} />)}
    </div>
  </div>;
}

function BalancePreview() {
  return <div className={styles.balance} aria-hidden="true">
    {[[3, 4], [5, 3]].map((column, index) => <div key={index}>
      {column.map((rows, panel) => <section className={styles.balancePanel} key={panel}>
        <span className={styles.title} />
        {Array.from({ length: rows }, (_, row) => <span className={styles.forecastRow} key={row} />)}
      </section>)}
    </div>)}
  </div>;
}
