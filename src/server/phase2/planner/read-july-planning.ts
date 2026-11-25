import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { JULY_COMPOSER_MONTH, JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { resolveRealBankBalance } from "../bank-cash-projection";
import { readMonthPredictionEvidence } from "../month-prediction-evidence";
import { createMonthSourceCache } from "../month-source-cache";
import { composerDraftAutosaveEnabledFor } from "./composer-draft-cutover";
import { readActiveComposerDraft } from "./composer-draft-service";
import { plannerComposerEnabled } from "./cutover";
import { readJulyBudget } from "./july-budget";
import { julyPilotForecast, projectJulyPilot } from "./july-pilot";
import { readJulyRealizedBoard } from "./read-composer-realized-board";
import { readMonthComposer } from "./read-model";
import type { RealizedBootstrap } from "./realized-month";
import { authorizedPlanner } from "./runtime";

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

async function savedJulyComposer() {
  const planner = await authorizedPlanner();
  const draft = await readActiveComposerDraft(planner, JULY_COMPOSER_MONTH);
  if (!draft) return null;
  const { deps, householdId } = planner;
  return readMonthComposer({ ...deps, readWorld: deps.readComposerWorld ?? deps.readWorld },
    householdId, JULY_COMPOSER_MONTH, draft.semanticState);
}

export function readJulyPlanning(context: RealizedBootstrap, supabase: SupabaseClient) {
  if (!context.household) throw new TypeError("COMPOSER_JULY_HOUSEHOLD_MISSING");
  const { householdId, timezone } = context.household;
  const useSavedDraft = plannerComposerEnabled() && composerDraftAutosaveEnabledFor(context.user.id);
  const canonical = createCanonicalReadClient();
  const cache = createMonthSourceCache(supabase, context, JULY_COMPOSER_MONTH);

  return cache.read(`july-planning:${JULY_PILOT_DATE}`, async () => {
    const [source, evidence, draft] = await Promise.all([
      readJulyRealizedBoard(context, cache),
      readMonthPredictionEvidence(canonical, householdId, JULY_COMPOSER_MONTH, true,
        { asOfDate: JULY_PILOT_DATE, timezone, cache }),
      useSavedDraft ? savedJulyComposer() : null,
    ]);
    const board = projectJulyPilot(source);
    const balance = resolveRealBankBalance({
      observation: evidence.manualBankBalanceObservation ?? null, today: JULY_PILOT_DATE,
      bank: evidence.bankObservations ?? [], intervals: evidence.bankCoverageIntervals,
    });
    return { board, budget: readJulyBudget(source, board, evidence, draft), pilot: julyPilotForecast(board, balance?.amount ?? null) };
  }, async () => {
    const [evidence, saved] = await Promise.all([
      canonical.rpc("composer_july_planning_revision_v1", { p_household: householdId }),
      useSavedDraft ? supabase.rpc("composer_july_saved_revision_v1", { p_household: householdId }) : null,
    ]);
    if (evidence.error || !validRevision(evidence.data) || saved && (saved.error || !validRevision(saved.data))) return null;
    // Some vehicle and place options in the existing Composer model roll over at midnight UTC.
    return plannerDigest({ evidence: evidence.data, saved: saved?.data ?? null,
      optionsDay: useSavedDraft ? new Date().toISOString().slice(0, 10) : null });
  });
}
