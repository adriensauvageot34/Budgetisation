import "server-only";
import type { RootRelationPlanState } from "@/domain/phase2/planner/root-relation-contract";

/** G-A option A explicitly approved by the finalisation mandate. This is only a Draft
 * organization policy; no Mobility completeness, price, FRESH or Apply is inferred. */
export function rootRelationDurablePolicy(_document: RootRelationPlanState) {
  return { admitted: true as const, version: "g-a-organizational-draft@1" as const,
    completeness: "NOT_EVALUATED" as const, applied: false as const };
}

/** Independent server gates. No credential/client/writer is constructed by an OFF request. */
export function rootRelationDurableEnabled() {
  return process.env.COMPOSER_ROOT_RELATIONS_ENABLED === "true"
    && process.env.COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED === "true";
}
