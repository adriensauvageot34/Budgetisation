import { canonicalSerializeGlobal } from "../../core/global-v2";
import { dailyRelationshipCatalog } from "./relationship-catalog";
import { weeklyRelationshipCatalog } from "./relationship-weekly";
import type { buildGlobalRelationshipTemporalEvidence } from "./relationship-temporal";

/** Master M5 P4119–4137, P4344–4346, PD-OUT-03.
 * This is relationship evolution evidence, NOT a synthetic monthly economic
 * series, causal anchor, new regime, or an additional raw change-point signal.
 */
export type GlobalRelationshipEvolution = {
  readonly catalogKey: "M5_RELATIONSHIP_EVOLUTION";
  readonly relationshipId: string;
  readonly state: "CHANGED_RELATIONSHIP" | "HISTORICAL_ONLY";
  readonly personId: string;
  readonly householdId: string;
  readonly regimeId: string;
  readonly certifiedThrough: string;
  readonly previousMonths: readonly string[];
  readonly recentMonths: readonly string[];
  readonly previousDirection: number;
  readonly recentDirection: number;
  readonly sourceInputHash: string;
  readonly causalityMode: "ASSOCIATION_ONLY";
  readonly methodVersion: "global_m5_m3_evolution@v1";
};

export function buildGlobalM5TransformationFeed(result: ReturnType<typeof buildGlobalRelationshipTemporalEvidence>): readonly GlobalRelationshipEvolution[] {
  return result.relationships.flatMap((relationship) => {
    if (relationship.state !== "CHANGED_RELATIONSHIP" && relationship.state !== "HISTORICAL_ONLY") return [];
    const source = result;
    return [{ catalogKey: "M5_RELATIONSHIP_EVOLUTION" as const, relationshipId: relationship.relationshipId, state: relationship.state, personId: source.scope.personId, householdId: source.scope.householdId, regimeId: source.scope.regimeId, certifiedThrough: source.scope.certifiedThrough, previousMonths: relationship.windows.previous.eligibleMonths, recentMonths: relationship.windows.recent.eligibleMonths, previousDirection: relationship.windows.previous.direction, recentDirection: relationship.windows.recent.direction, sourceInputHash: result.inputHash, causalityMode: "ASSOCIATION_ONLY" as const, methodVersion: "global_m5_m3_evolution@v1" as const }];
  });
}

export function validateGlobalM5TransformationFeed(values: readonly GlobalRelationshipEvolution[]) {
  canonicalSerializeGlobal(values);
  const ids = new Set<string>();
  return [...values].map((value) => {
    const identity = `${value.householdId}:${value.personId}:${value.regimeId}:${value.relationshipId}`;
    if (ids.has(identity) || ![...dailyRelationshipCatalog, ...weeklyRelationshipCatalog].some((definition) => definition.id === value.relationshipId) || value.catalogKey !== "M5_RELATIONSHIP_EVOLUTION" || value.causalityMode !== "ASSOCIATION_ONLY" || !["CHANGED_RELATIONSHIP", "HISTORICAL_ONLY"].includes(value.state) || !/^[a-f0-9]{64}$/.test(value.sourceInputHash) || value.methodVersion !== "global_m5_m3_evolution@v1") throw new TypeError("M3_INVALID_M5_EVOLUTION");
    if (value.previousMonths.length !== 6 || value.recentMonths.length !== 6 || new Set([...value.previousMonths, ...value.recentMonths]).size !== 12 || [...value.previousMonths].sort().at(-1)! >= [...value.recentMonths].sort()[0] || [...value.recentMonths].sort().at(-1)! > value.certifiedThrough.slice(0, 7)) throw new TypeError("M3_M5_EVOLUTION_WINDOW_MISMATCH");
    ids.add(identity);
    return { ...value, previousMonths: [...value.previousMonths].sort(), recentMonths: [...value.recentMonths].sort() };
  }).sort((a, b) => `${a.personId}:${a.regimeId}:${a.relationshipId}`.localeCompare(`${b.personId}:${b.regimeId}:${b.relationshipId}`));
}
