import "server-only";

import { cache } from "react";
import { getAuthenticatedBootstrapClient, type BootstrapSession } from "@/server/bootstrap/auth";
import type { BootstrapHousehold } from "@/server/bootstrap/types";
import {
  getAnalysisPeriods,
  getCurrentHousehold,
  getHouseholdPersons,
  getHouseholdRevision,
} from "@/server/bootstrap/queries";

export async function getBootstrapContext() {
  return (await getBootstrapSession()).context;
}

export const getBootstrapSession = cache(async () => {
  const session = await getAuthenticatedBootstrapClient();
  return { session, context: await getBootstrapContextForSession(session) };
});

export const getBootstrapHousehold = cache((session: BootstrapSession) =>
  getCurrentHousehold(session.supabase));

export async function getBootstrapContextForSession(session: BootstrapSession) {
  const household = await getBootstrapHousehold(session);
  return getBootstrapContextFromHousehold(session, household);
}

export const getBootstrapContextFromHousehold = cache(async (
  { supabase, user }: BootstrapSession,
  household: BootstrapHousehold | null,
) => {
  if (!household) {
    return { user, household: null, persons: [], periods: [], revision: null };
  }

  const [persons, periods, revision] = await Promise.all([
    getHouseholdPersons(supabase, household.householdId),
    getAnalysisPeriods(supabase, household.householdId),
    getHouseholdRevision(supabase, household.householdId),
  ]);

  return { user, household, persons, periods, revision };
});
