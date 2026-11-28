"use server";

import { parseMoney } from "@/core/money";
import { ARCHIVED_REALIZED_MONTHS } from "@/domain/phase2/planner/realized-month-entry";
import { expandGlobalBackgroundFoodReadModel, type GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { createGlobalV2ProductionRuntime, readGlobalV2ProductionSnapshot } from "@/server/query/global-v2-production-loader";

export async function readBalanceMonthRhythm(month: string, domain: "food" | "car") {
  if (!ARCHIVED_REALIZED_MONTHS.some(value => value === month) || (domain !== "food" && domain !== "car")) return null;

  try {
    const runtime = await createGlobalV2ProductionRuntime();
    const result = await readGlobalV2ProductionSnapshot({ runtime, resource: "analysis_global_background_rhythms", params: {} });
    if (domain === "food") {
      const current = expandGlobalBackgroundFoodReadModel(result.data).months.find(value => value.month === month);
      if (!current) return null;
      const labels = { courses: "Courses", restaurants: "Restaurants", deliveries: "Livraisons" } as const;
      const rows = (Object.keys(labels) as (keyof typeof labels)[]).map(key => ({
        id: key, label: labels[key], amount: parseMoney(current.money[key].amount),
        partial: current.money[key].quality === "LOWER_BOUND",
      }));
      return { domain, rows };
    }

    const current = (result.data as GlobalBackgroundRhythmsReadModel).carMobility.months.find(value => value.month === month);
    if (!current) return null;
    const { modeledUsage, observedFuelPaid, quality, usageComposition } = current;
    return {
      domain,
      paid: parseMoney(observedFuelPaid.amount),
      count: observedFuelPaid.operationCount,
      estimated: quality.estimateKnowledge === "UNKNOWN" ? undefined : parseMoney(modeledUsage.estimatedFuelCost),
      partial: quality.estimateKnowledge === "PARTIAL",
      distance: Number(modeledUsage.distanceKm),
      usage: [
        { id: "work", label: "Autour du travail", amount: parseMoney(usageComposition.aroundWorkEstimatedFuelCost) },
        { id: "other", label: "Hors travail", amount: parseMoney(usageComposition.outsideWorkEstimatedFuelCost) },
        { id: "unknown", label: "Non classé", amount: parseMoney(usageComposition.unresolvedEstimatedFuelCost) },
      ],
    };
  } catch {
    return null;
  }
}
