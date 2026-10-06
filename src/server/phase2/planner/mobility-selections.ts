import "server-only";
import { plannerInteger, plannerKeys, plannerRecord, plannerString, plannerUuid } from "@/domain/phase2/planner/json";
import type { JourneyDeclaration, MobilityPricingDecision } from "@/domain/phase2/planner/mobility-contract";
import { parseKernelCost, parseKernelFunding } from "./cost-resolver";

export function parseJourneyDeclaration(raw: unknown): JourneyDeclaration | undefined {
  if (raw === undefined) return undefined;
  const value = plannerRecord(raw);
  plannerKeys(value, ["relation", "certainty", "targetIntentId", "externalExpenseId", "externalCostLineIds", "choice", "stopIndex", "accessLegIndex"], ["relation", "certainty"]);
  if (!["OWNS_JOURNEY", "SHARES_JOURNEY", "ADDS_STOP", "USES_ACCESS_LEG", "NO_ADDITIONAL_MOBILITY"].includes(String(value.relation))
    || !["CERTAIN", "POSSIBLE", "SIMILAR_ONLY"].includes(String(value.certainty))) throw new TypeError("JOURNEY_DECLARATION_INVALID");
  const relation = value.relation as JourneyDeclaration["relation"], certainty = value.certainty as JourneyDeclaration["certainty"];
  const targetIntentId = value.targetIntentId == null ? null : plannerString(value.targetIntentId);
  const externalExpenseId = value.externalExpenseId == null ? null : plannerUuid(value.externalExpenseId);
  const rawLines = value.externalCostLineIds ?? [];
  if (!Array.isArray(rawLines) || rawLines.length > 100 || new Set(rawLines).size !== rawLines.length) throw new TypeError("JOURNEY_EXTERNAL_LINES_INVALID");
  const externalCostLineIds = rawLines.map(plannerString).sort();
  const choice = value.choice == null ? null : value.choice;
  if (choice !== null && choice !== "MERGE" && choice !== "SEPARATE") throw new TypeError("JOURNEY_CHOICE_INVALID");
  const stopIndex = value.stopIndex == null ? null : plannerInteger(value.stopIndex);
  const accessLegIndex = value.accessLegIndex == null ? null : plannerInteger(value.accessLegIndex);
  if (["OWNS_JOURNEY", "NO_ADDITIONAL_MOBILITY"].includes(relation)
    ? targetIntentId !== null || externalExpenseId !== null || externalCostLineIds.length > 0 || choice !== null || certainty !== "CERTAIN"
    : Number(targetIntentId !== null) + Number(externalExpenseId !== null) !== 1) throw new TypeError("JOURNEY_TARGET_INVALID");
  if (!!externalExpenseId !== !!externalCostLineIds.length || stopIndex !== null && relation !== "ADDS_STOP"
    || accessLegIndex !== null && relation !== "USES_ACCESS_LEG" || choice !== null && certainty !== "POSSIBLE") throw new TypeError("JOURNEY_DECLARATION_INVALID");
  if (relation === "ADDS_STOP" && (stopIndex === null || stopIndex === 0) || relation === "USES_ACCESS_LEG" && accessLegIndex === null)
    throw new TypeError("JOURNEY_LEG_OR_STOP_REQUIRED");
  return { relation, certainty, targetIntentId, externalExpenseId, externalCostLineIds, choice, stopIndex, accessLegIndex };
}
export function parseMobilityPricing(raw: unknown): MobilityPricingDecision | undefined {
  if (raw === undefined) return undefined;
  const value = plannerRecord(raw); plannerKeys(value, ["fare", "parking", "fundingAllocations", "preference"], []);
  if (value.preference !== undefined && !["FASTEST", "AVOID_TOLLS"].includes(String(value.preference))) throw new TypeError("JOURNEY_PREFERENCE_INVALID");
  return { fare: parseKernelCost(value.fare ?? { kind: "UNKNOWN" }), parking: parseKernelCost(value.parking ?? { kind: "MANUAL", unitAmount: "0" }),
    fundingAllocations: parseKernelFunding(value.fundingAllocations ?? []), preference: value.preference === "AVOID_TOLLS" ? "AVOID_TOLLS" : "FASTEST" };
}
export function mobilityTime(raw: unknown): string | null {
  if (raw == null) return null;
  const time = plannerString(raw);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time)) throw new TypeError("JOURNEY_TIME_INVALID");
  return time;
}
