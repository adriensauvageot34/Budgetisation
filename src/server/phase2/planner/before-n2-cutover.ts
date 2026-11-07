import "server-only";
import { BEFORE_N2_DISABLED, hasBeforeDraft } from "@/domain/phase2/planner/before-draft-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";

/** A server setting. A client capability or an available database URL cannot enable N2. */
export function beforeN2Enabled(): boolean {
  return process.env.COMPOSER_BEFORE_N2_ENABLED === "true";
}

export function assertBeforeN2InputEnabled(state: PlanSemanticStateV1): void {
  if (!beforeN2Enabled() && hasBeforeDraft(state)) throw new TypeError(BEFORE_N2_DISABLED);
}
