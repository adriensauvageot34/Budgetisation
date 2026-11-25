import "server-only";
import { parseYearMonth } from "@/core/time";
import { isArchivedRealizedMonth } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createMonthSourceCache } from "../month-source-cache";
import { readRealizedMonth } from "./realized-month";
import { archivedComposerBoard } from "./realized-snapshots";

export async function readComposerRealizedBoard(month: string) {
  const { context, session } = await getBootstrapSession();
  if (!context.household) return null;
  const target = parseYearMonth(month);
  const cache = createMonthSourceCache(session.supabase, context, target);
  return isArchivedRealizedMonth(target) ? (await archivedComposerBoard(context, target, cache)).value
    : readRealizedMonth(context, target, cache);
}
