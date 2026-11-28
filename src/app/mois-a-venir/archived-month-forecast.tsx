import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import { MonthDataStatus } from "./month-data-status";
import { monthPlanningHref, type MonthEntry } from "./month-entry";
import { MonthNavigation } from "./month-navigation";
import { MonthStory } from "./month-story";
import styles from "./forecast-dashboard.module.css";
import material from "./month-material.module.css";

export function ArchivedMonthForecast({ entry, forecast, scenario, cutoff }: {
  entry: MonthEntry; forecast: MonthForecastSnapshot; scenario: MonthScenario; cutoff: string;
}) {
  return <div data-planned-page className={`${material.page} ${styles.workspace}`}>
    <MonthNavigation targetMonth={entry.targetMonth} />
    <MonthStory readOnly scenario={scenario} reference={forecast.referencePlan} targetMonth={entry.targetMonth}
      plannedExpenses={[]} persons={[]} places={[]} vehicle={null} prices={[]} wallets={[]} today={cutoff}
      settings={scenario.inputs.decision} header={<div className={styles.controls}>
        <div className={styles.intro}>
          <h2>Prévisions de référence</h2>
          <MonthDataStatus entry={entry} compact />
        </div>
        <a href={monthPlanningHref(entry.targetMonth, "bilan")} className={styles.headerLink}>Voir le bilan du mois</a>
      </div>} />
  </div>;
}
