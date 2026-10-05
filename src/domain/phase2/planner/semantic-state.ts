import { parsePlannerJsonObject, plannerDigest, plannerKeys, plannerMonth, plannerRecord,
  plannerString, plannerUuid, type PlannerJsonObject } from "./json";

export const PLAN_SEMANTIC_STATE_VERSION = "month-plan-state@v1" as const;
/** C3/C6 validate each value through its target capability; the core has no category taxonomy. */
export type PlanControlValue = PlannerJsonObject;
/** C4 owns the template-specific selection grammar. C0 only validates the JSON boundary. */
export type ContextSlotSelection = PlannerJsonObject;
export type PlanControlDecision = Readonly<{ decisionId: string; decisionSlotKey: string; kind: "SET_STATE";
  value: PlanControlValue; provenance: "EXPLICIT_USER_DECISION" }>;
export type PlannedContextState = Readonly<{ contextOccurrenceId: string; templateKey: string; status: "ACTIVE";
  parentContextOccurrenceId?: string | null; fields: PlannerJsonObject;
  slotSelections: Readonly<Record<string, ContextSlotSelection>>; provenance: "EXPLICIT_USER_DECISION" }>;
export type PlanFlexibility = "PRESERVE" | "NORMAL" | "WILLING_TO_ADJUST";
export type PlanSemanticStateV1 = Readonly<{ version: typeof PLAN_SEMANTIC_STATE_VERSION; targetMonth: string;
  controls: readonly PlanControlDecision[]; contexts: readonly PlannedContextState[];
  preferences: Readonly<{ anchors: readonly string[]; flexibility: Readonly<Record<string, PlanFlexibility>> }> }>;

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length > 500) throw new TypeError("PLANNER_ARRAY_INVALID");
  return value;
}

export function parsePlanControlDecision(raw: unknown): PlanControlDecision {
  const value = plannerRecord(raw);
  plannerKeys(value, ["decisionId", "decisionSlotKey", "kind", "value", "provenance"]);
  if (value.kind !== "SET_STATE" || value.provenance !== "EXPLICIT_USER_DECISION") throw new TypeError("PLANNER_DECISION_INVALID");
  return { decisionId: plannerUuid(value.decisionId), decisionSlotKey: plannerString(value.decisionSlotKey),
    kind: "SET_STATE", value: parsePlannerJsonObject(value.value), provenance: "EXPLICIT_USER_DECISION" };
}

export function parsePlannedContextState(raw: unknown): PlannedContextState {
  const value = plannerRecord(raw);
  const required = ["contextOccurrenceId", "templateKey", "status", "fields", "slotSelections", "provenance"];
  plannerKeys(value, [...required, "parentContextOccurrenceId"], required);
  if (value.status !== "ACTIVE" || value.provenance !== "EXPLICIT_USER_DECISION") throw new TypeError("PLANNER_CONTEXT_INVALID");
  const selections = plannerRecord(value.slotSelections);
  return { contextOccurrenceId: plannerUuid(value.contextOccurrenceId), templateKey: plannerString(value.templateKey),
    status: "ACTIVE", parentContextOccurrenceId: value.parentContextOccurrenceId == null ? null : plannerUuid(value.parentContextOccurrenceId),
    fields: parsePlannerJsonObject(value.fields), slotSelections: Object.fromEntries(Object.entries(selections)
      .map(([key, selection]) => [plannerString(key), parsePlannerJsonObject(selection)])), provenance: "EXPLICIT_USER_DECISION" };
}

/** Last SET_STATE wins per slot; contexts remain additive and retain their explicit UUIDs. */
export function parsePlanSemanticState(raw: unknown): PlanSemanticStateV1 {
  const value = plannerRecord(raw);
  if (value.version !== PLAN_SEMANTIC_STATE_VERSION) throw new TypeError("PLANNER_SEMANTIC_VERSION_UNSUPPORTED");
  plannerKeys(value, ["version", "targetMonth", "controls", "contexts", "preferences"]);
  const bySlot = new Map<string, PlanControlDecision>();
  for (const item of array(value.controls)) { const decision = parsePlanControlDecision(item); bySlot.set(decision.decisionSlotKey, decision); }
  const controls = [...bySlot.values()].sort((a, b) => a.decisionSlotKey < b.decisionSlotKey ? -1 : a.decisionSlotKey > b.decisionSlotKey ? 1 : 0);
  if (new Set(controls.map(item => item.decisionId)).size !== controls.length) throw new TypeError("PLANNER_DECISION_ID_DUPLICATE");
  const contexts = array(value.contexts).map(parsePlannedContextState).sort((a, b) => a.contextOccurrenceId < b.contextOccurrenceId ? -1 : a.contextOccurrenceId > b.contextOccurrenceId ? 1 : 0);
  const byContext = new Map(contexts.map(item => [item.contextOccurrenceId, item]));
  if (byContext.size !== contexts.length) throw new TypeError("PLANNER_CONTEXT_ID_DUPLICATE");
  for (const context of contexts) {
    const ancestors = new Set([context.contextOccurrenceId]);
    let parent = context.parentContextOccurrenceId;
    while (parent) {
      if (!byContext.has(parent)) throw new TypeError("PLANNER_CONTEXT_PARENT_MISSING");
      if (ancestors.has(parent)) throw new TypeError("PLANNER_CONTEXT_CYCLE");
      ancestors.add(parent); parent = byContext.get(parent)!.parentContextOccurrenceId;
    }
  }
  const preferences = plannerRecord(value.preferences);
  plannerKeys(preferences, ["anchors", "flexibility"]);
  const flexibility = plannerRecord(preferences.flexibility);
  const parsedFlexibility = Object.fromEntries(Object.entries(flexibility).map(([key, choice]) => {
    if (!["PRESERVE", "NORMAL", "WILLING_TO_ADJUST"].includes(String(choice))) throw new TypeError("PLANNER_FLEXIBILITY_INVALID");
    return [plannerString(key), choice as PlanFlexibility];
  }));
  return { version: PLAN_SEMANTIC_STATE_VERSION, targetMonth: plannerMonth(value.targetMonth), controls, contexts,
    preferences: { anchors: [...new Set(array(preferences.anchors).map(plannerString))].sort(), flexibility: parsedFlexibility } };
}

export const semanticStateDigest = (state: unknown): string => plannerDigest(parsePlanSemanticState(state));
export const emptyPlanSemanticState = (targetMonth: string): PlanSemanticStateV1 => parsePlanSemanticState({
  version: PLAN_SEMANTIC_STATE_VERSION, targetMonth, controls: [], contexts: [], preferences: { anchors: [], flexibility: {} },
});
