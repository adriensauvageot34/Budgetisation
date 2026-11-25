import "server-only";
import { parseYearMonth } from "@/core/time";
import { isArchivedRealizedMonth, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { createMonthSourceCache } from "../month-source-cache";
import { readRealizedMonth } from "./realized-month";
import { archivedComposerBoard } from "./realized-snapshots";

export async function readComposerRealizedBoard(month: string) {
  const { context, session } = await getBootstrapSession();
  const household = context.household;
  if (!household) return null;
  const target = parseYearMonth(month);
  const cache = createMonthSourceCache(session.supabase, context, target);
  if (isArchivedRealizedMonth(target)) return (await archivedComposerBoard(context, target, cache)).value;
  if (target !== JULY_COMPOSER_MONTH) return readRealizedMonth(context, target, cache);

  const canonical = createCanonicalReadClient();
  return cache.read("realized-july-board", () => readRealizedMonth(context, target), async () => {
    const { data, error } = await canonical.rpc("composer_july_projection_revision_v1", { p_household: household.householdId });
    return !error && typeof data === "string" && /^[a-f0-9]{64}$/u.test(data) ? data : null;
  });
}
