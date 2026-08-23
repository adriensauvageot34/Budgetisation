import "server-only";

import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import {
  getAnalysisPeriods,
  getCurrentHousehold,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";

export async function getBootstrapContext() {
  const { supabase, user } = await getAuthenticatedBootstrapClient();
  const household = await getCurrentHousehold(supabase);

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
