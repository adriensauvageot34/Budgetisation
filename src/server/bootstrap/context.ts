import "server-only";

import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import type { BootstrapHousehold } from "@/server/bootstrap/types";
import {
  getAnalysisPeriods,
  getCurrentHousehold,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";

export async function getBootstrapContext() {
  const session = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(session.supabase);
  return getBootstrapContextFromHousehold(session, household);
}

export async function getBootstrapContextFromHousehold(
  { supabase, user }: Awaited<ReturnType<typeof getAuthenticatedBootstrapClient>>,
  household: BootstrapHousehold | null,
) {
  if (!household) {
    return { user, household: null, persons: [], periods: [], revision: null };
  }

  const [persons, periods, revision] = await Promise.all([
    getHouseholdPersons(supabase, household.householdId),
    getAnalysisPeriods(supabase, household.householdId),
    getHouseholdRevision(supabase, household.householdId),
  ]);

  return { user, household, persons, periods, revision };
}
