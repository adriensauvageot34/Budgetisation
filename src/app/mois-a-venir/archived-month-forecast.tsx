import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import { MonthDataStatus } from "./month-data-status";
import { monthPlanningHref, type MonthEntry } from "./month-entry";
import { MonthNavigation } from "./month-navigation";
import { MonthStory } from "./month-story";
import material from "./month-material.module.css";

export function ArchivedMonthForecast({ entry, forecast, scenario, cutoff }: {
  entry: MonthEntry; forecast: MonthForecastSnapshot; scenario: MonthScenario; cutoff: string;
}) {
  return <main data-planned-page className={`${material.page} mx-auto max-w-[1280px] space-y-7 pb-20`}>
    <MonthNavigation targetMonth={entry.targetMonth} />
    <section className={`${material.glassSecondary} flex flex-wrap items-center justify-between gap-3 p-5`} aria-labelledby="archive-forecast-title">
      <div>
        <h2 id="archive-forecast-title" className="text-2xl font-black">Prévisions de référence</h2>
        <p className="mt-1 text-sm text-slate-600">Estimations recalculées à partir des références disponibles et des réglages conservés pour ce mois.</p>
      </div>
      <a href={monthPlanningHref(entry.targetMonth, "bilan")} className={`${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`}>Voir le bilan du mois</a>
    </section>
    <MonthDataStatus entry={entry} />
    <MonthStory readOnly scenario={scenario} reference={forecast.referencePlan} targetMonth={entry.targetMonth}
      plannedExpenses={[]} persons={[]} places={[]} vehicle={null} prices={[]} wallets={[]} today={cutoff}
      settings={scenario.inputs.decision}
      references={Object.fromEntries(forecast.components.map(part => [part.key, { freshnessDate: part.freshnessDate, confidence: part.confidence }]))} />
  </main>;
}
