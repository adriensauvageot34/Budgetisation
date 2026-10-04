import type { MonthControlCenterModel } from "@/server/phase2/month-control-center";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import { MonthUpdateSpatial } from "./month-update-spatial";
import { MonthInfoFacts } from "./month-control-workspace";
/** Compatibility for server callers; both consume the workspace read-model. */
export function MonthUpdatePanel({ model }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel; today?: string }) { return <MonthUpdateSpatial model={model} refreshing={false} />; }
export function MonthReliabilityPanel({ model }: { model: MonthControlCenterModel }) { return <MonthInfoFacts model={model} />; }
