import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthInputs } from "../month-scenario";
import type { CompiledPlanSlot } from "@/domain/phase2/planner/compiler-contract";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { createPlanApplyRepository, type PlanRepository } from "./repository";
import { slotReferenceKeys } from "./plan-slot-resolver";
import { assertRevisionEvidence } from "./revision-evidence";

/** Rollback hides the new entry point, never ignores an already applied Plan. */
export const plannerComposerEnabled = () => process.env.PLANNER_COMPOSER_ENABLED !== "false";
export async function legacyPlanOwnership(repository: PlanRepository, household: string, month: string) {
  const stored = await repository.readActivePlan(household, month);
  if (!stored?.activeRevision) return { categoryKeys: [] as string[], savingsIds: [] as string[] };
  assertRevisionEvidence(stored.activeRevision);
  const slots = stored.activeRevision.compiledManifest.planSlots as unknown as readonly CompiledPlanSlot[];
  const owned = slots.filter(s => s.owned);
  return { categoryKeys: [...new Set(owned.flatMap(slotReferenceKeys))],
    savingsIds: owned.filter(s => s.role === "SAVINGS").map(s => s.baseline.slotIdentityKey.slice(8)) };
}
export async function assertLegacyMonthWrite(repository: PlanRepository, household: string, month: string, before: MonthInputs, after: MonthInputs) {
  const ownership = await legacyPlanOwnership(repository, household, month);
  for (const key of ownership.categoryKeys) for (const group of ["assumptions", "categoryTargets"] as const)
    if (plannerDigest(before.decision?.[group][key] ?? null) !== plannerDigest(after.decision?.[group][key] ?? null))
      throw new TypeError("PLAN_V3_ACTIVE_READ_ONLY");
  for (const id of ownership.savingsIds) if (plannerDigest(before.declaredOutflows.find(r => r.id === id) ?? null) !== plannerDigest(after.declaredOutflows.find(r => r.id === id) ?? null))
    throw new TypeError("PLAN_V3_ACTIVE_READ_ONLY");
}
export async function assertLegacyMonthInputsWrite(client: SupabaseClient, household: string, month: string, before: MonthInputs, after: MonthInputs) {
  return assertLegacyMonthWrite(createPlanApplyRepository(client), household, month, before, after);
}
