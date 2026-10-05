import { canonicalPlannerJson, parsePlannerJsonObject, plannerDigestString, plannerInteger, plannerKeys,
  plannerMonth, plannerRecord, plannerString, plannerUuid, type PlannerJsonObject } from "./json";
import { parsePlanSemanticState, semanticStateDigest, type PlanSemanticStateV1 } from "./semantic-state";

export type Plan = Readonly<{ planId: string; householdId: string; targetMonth: string; activeRevisionId: string | null;
  activeRevisionNumber: number; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string }>;
/** Evidence envelopes are JSON only; their domain schemas belong to C1/C2. */
export type PlanRevision = Readonly<{ planRevisionId: string; planId: string; householdId: string; targetMonth: string;
  revisionNumber: number; parentRevisionId: string | null; applyRequestId: string;
  baselineDigest: string; baselineSnapshot: PlannerJsonObject; semanticState: PlanSemanticStateV1;
  semanticStateDigest: string; changeSet: readonly PlannerJsonObject[]; compiledManifest: PlannerJsonObject;
  compiledManifestDigest: string; projectionEvidence: PlannerJsonObject; previewDigest: string;
  compilerVersion: string; modelVersions: Readonly<Record<string, string>>; createdBy: string; createdAt: string }>;
export type StoredPlan = Readonly<{ plan: Plan; activeRevision: PlanRevision | null }>;

const dateMonth = (value: unknown): string => {
  if (typeof value !== "string" || !value.endsWith("-01")) throw new TypeError("PLANNER_PERSISTED_MONTH_INVALID");
  return plannerMonth(value.slice(0, -3));
};
const timestamp = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/u.test(value) || !Number.isFinite(Date.parse(value)))
    throw new TypeError("PLANNER_TIMESTAMP_INVALID");
  return value;
};
const optionalUuid = (value: unknown): string | null => value === null ? null : plannerUuid(value);

export function parsePlanRow(raw: unknown): Plan {
  const row = plannerRecord(raw);
  plannerKeys(row, ["plan_id", "household_id", "target_month", "active_revision_id", "active_revision_number",
    "created_by", "updated_by", "created_at", "updated_at"]);
  const activeRevisionId = optionalUuid(row.active_revision_id), activeRevisionNumber = plannerInteger(row.active_revision_number);
  if ((activeRevisionId === null) !== (activeRevisionNumber === 0)) throw new TypeError("PLANNER_ACTIVE_REVISION_INVALID");
  return { planId: plannerUuid(row.plan_id), householdId: plannerUuid(row.household_id), targetMonth: dateMonth(row.target_month),
    activeRevisionId, activeRevisionNumber, createdBy: plannerUuid(row.created_by), updatedBy: plannerUuid(row.updated_by),
    createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) };
}

export function parsePlanRevisionRow(raw: unknown): PlanRevision {
  const row = plannerRecord(raw);
  plannerKeys(row, ["plan_revision_id", "plan_id", "household_id", "target_month", "revision_number", "parent_revision_id",
    "apply_request_id", "baseline_digest", "baseline_snapshot", "semantic_state", "semantic_state_digest", "change_set",
    "compiled_manifest", "compiled_manifest_digest", "projection_evidence", "preview_digest", "compiler_version",
    "model_versions", "created_by", "created_at"]);
  const semanticState = parsePlanSemanticState(row.semantic_state), targetMonth = dateMonth(row.target_month);
  const stateDigest = plannerDigestString(row.semantic_state_digest);
  if (semanticState.targetMonth !== targetMonth || semanticStateDigest(semanticState) !== stateDigest
    || canonicalPlannerJson(semanticState) !== canonicalPlannerJson(row.semantic_state)) throw new TypeError("PLANNER_REVISION_STATE_INVALID");
  const revisionNumber = plannerInteger(row.revision_number, 1), parentRevisionId = optionalUuid(row.parent_revision_id);
  if ((revisionNumber === 1) !== (parentRevisionId === null)) throw new TypeError("PLANNER_REVISION_PARENT_INVALID");
  if (!Array.isArray(row.change_set) || row.change_set.length > 500) throw new TypeError("PLANNER_CHANGE_SET_INVALID");
  const modelVersions = Object.fromEntries(Object.entries(plannerRecord(row.model_versions)).map(([key, version]) => [plannerString(key), plannerString(version)]));
  return { planRevisionId: plannerUuid(row.plan_revision_id), planId: plannerUuid(row.plan_id), householdId: plannerUuid(row.household_id),
    targetMonth, revisionNumber, parentRevisionId, applyRequestId: plannerUuid(row.apply_request_id),
    baselineDigest: plannerDigestString(row.baseline_digest), baselineSnapshot: parsePlannerJsonObject(row.baseline_snapshot),
    semanticState, semanticStateDigest: stateDigest, changeSet: row.change_set.map(parsePlannerJsonObject),
    compiledManifest: parsePlannerJsonObject(row.compiled_manifest), compiledManifestDigest: plannerDigestString(row.compiled_manifest_digest),
    projectionEvidence: parsePlannerJsonObject(row.projection_evidence), previewDigest: plannerDigestString(row.preview_digest),
    compilerVersion: plannerString(row.compiler_version), modelVersions, createdBy: plannerUuid(row.created_by), createdAt: timestamp(row.created_at) };
}
