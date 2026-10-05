import { plannerModule } from "../lib/planner-fixture-modules.mjs";

export const householdId = "10000000-0000-4000-8000-000000000001";
export const otherHouseholdId = "10000000-0000-4000-8000-000000000002";
export const userId = "20000000-0000-4000-8000-000000000001";
export const otherUserId = "20000000-0000-4000-8000-000000000002";
export const contextId = "30000000-0000-4000-8000-000000000001";
export const decisionId = "40000000-0000-4000-8000-000000000001";
export const { parsePlanSemanticState, semanticStateDigest, emptyPlanSemanticState } = plannerModule("semantic-state");
export const state = parsePlanSemanticState({ ...emptyPlanSemanticState("2026-11"),
  controls: [{ decisionId, decisionSlotKey: "amount/fixture/household", kind: "SET_STATE",
    value: { amount: "123.45" }, provenance: "EXPLICIT_USER_DECISION" }],
  contexts: [{ contextOccurrenceId: contextId, templateKey: "fixture-context", status: "ACTIVE", fields: { label: "Synthetic fixture" },
    slotSelections: {}, provenance: "EXPLICIT_USER_DECISION" }],
});
export const evidence = {
  baseline_digest: "a".repeat(64), baseline_snapshot: { version: "fixture-baseline@v1", knowledge: "UNKNOWN" },
  semantic_state: state, semantic_state_digest: semanticStateDigest(state), change_set: [],
  compiled_manifest: { version: "fixture-manifest@v1", componentIds: [] }, compiled_manifest_digest: "b".repeat(64),
  projection_evidence: { version: "fixture-evidence@v1", knowledge: "UNKNOWN" }, preview_digest: "c".repeat(64),
  compiler_version: "fixture-only@v1", model_versions: { fixture: "v1" },
};
