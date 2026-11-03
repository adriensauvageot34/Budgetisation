import "server-only";
import type { RootRelationPlanState } from "@/domain/phase2/planner/root-relation-contract";

/** There is no received owner attesting the completeness of a ROOT GROUP journey.
 * An empty Mobility list, a financial FRESH result, or a client grant is not that evidence.
 * No production option A/B is chosen here. A future policy must be reviewed explicitly. */
export function rootRelationDurablePolicy(_document: RootRelationPlanState) {
  return { admitted: false as const, code: "N1_G_A_POLICY_UNDECIDED" as const,
    completeness: "NOT_ATTESTED" as const };
}

/** Independent server gates. No credential/client/writer is constructed by an OFF request. */
export function rootRelationDurableEnabled() {
  return process.env.COMPOSER_ROOT_RELATIONS_ENABLED === "true"
    && process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED === "true";
}
