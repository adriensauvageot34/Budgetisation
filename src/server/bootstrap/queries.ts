import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AmbiguousHouseholdError,
  BootstrapDataError,
} from "@/server/bootstrap/errors";
import type {
  BootstrapAnalysisPeriod,
  BootstrapAnalysisStatus,
  BootstrapHousehold,
  BootstrapHouseholdRevision,
  BootstrapPerson,
} from "@/server/bootstrap/types";

const analysisStatuses = new Set<BootstrapAnalysisStatus>([
  "complete",
  "partial",
  "unknown",
  "not_applicable",
]);

function requireString(value: unknown, column: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw new BootstrapDataError(`Valeur V2 invalide pour ${column}.`);
}

function nullableString(value: unknown, column: string): string | null {
  if (value === null) return null;
  return requireString(value, column);
}

function requireBoolean(value: unknown, column: string): boolean {
  if (typeof value === "boolean") return value;
  throw new BootstrapDataError(`Valeur V2 invalide pour ${column}.`);
}

function requireRevision(value: unknown, column: string): number {
  const revision = typeof value === "number" ? value : Number(value);
  if (Number.isSafeInteger(revision) && revision >= 0) return revision;
  throw new BootstrapDataError(`Valeur V2 invalide pour ${column}.`);
}

function nullableRevision(value: unknown, column: string): number | null {
  return value === null ? null : requireRevision(value, column);
}

function requireAnalysisStatus(
  value: unknown,
  column: string,
): BootstrapAnalysisStatus {
  if (typeof value === "string" && analysisStatuses.has(value as BootstrapAnalysisStatus)) {
    return value as BootstrapAnalysisStatus;
  }
  throw new BootstrapDataError(`Statut V2 invalide pour ${column}.`);
}

export async function getCurrentHousehold(
  supabase: SupabaseClient,
): Promise<BootstrapHousehold | null> {
  const { data, error } = await supabase
    .from("households")
    .select("household_id,name,timezone");

  if (error) {
    throw new BootstrapDataError(`Lecture de households impossible : ${error.message}`);
  }
  if (!data?.length) return null;
  if (data.length > 1) throw new AmbiguousHouseholdError();

  const row = data[0];
  return {
    householdId: requireString(row.household_id, "households.household_id"),
    name: requireString(row.name, "households.name"),
    timezone: requireString(row.timezone, "households.timezone"),
  };
}

export async function getHouseholdPersons(
  supabase: SupabaseClient,
  householdId: string,
): Promise<BootstrapPerson[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("person_id,household_id,display_name,status")
    .eq("household_id", householdId)
    .order("display_name", { ascending: true })
    .order("person_id", { ascending: true });

  if (error) {
    throw new BootstrapDataError(`Lecture de persons impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    personId: requireString(row.person_id, "persons.person_id"),
    householdId: requireString(row.household_id, "persons.household_id"),
    displayName: requireString(row.display_name, "persons.display_name"),
    status: nullableString(row.status, "persons.status"),
  }));
}

export async function getAnalysisPeriods(
  supabase: SupabaseClient,
  householdId: string,
): Promise<BootstrapAnalysisPeriod[]> {
  const { data, error } = await supabase
    .from("analysis_periods")
    .select(
      "analysis_period_id,household_id,month,finance_status,life_status,location_status,calendar_status,is_closed,source_revision",
    )
    .eq("household_id", householdId)
    .order("month", { ascending: true });

  if (error) {
    throw new BootstrapDataError(`Lecture de analysis_periods impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    analysisPeriodId: requireString(
      row.analysis_period_id,
      "analysis_periods.analysis_period_id",
    ),
    householdId: requireString(row.household_id, "analysis_periods.household_id"),
    month: requireString(row.month, "analysis_periods.month"),
    financeStatus: requireAnalysisStatus(
      row.finance_status,
      "analysis_periods.finance_status",
    ),
    lifeStatus: requireAnalysisStatus(row.life_status, "analysis_periods.life_status"),
    locationStatus: requireAnalysisStatus(
      row.location_status,
      "analysis_periods.location_status",
    ),
    calendarStatus: requireAnalysisStatus(
      row.calendar_status,
      "analysis_periods.calendar_status",
    ),
    isClosed: requireBoolean(row.is_closed, "analysis_periods.is_closed"),
    sourceRevision: nullableRevision(
      row.source_revision,
      "analysis_periods.source_revision",
    ),
  }));
}

export async function getHouseholdRevision(
  supabase: SupabaseClient,
  householdId: string,
): Promise<BootstrapHouseholdRevision | null> {
  const { data, error } = await supabase
    .from("household_revisions")
    .select("household_id,data_revision,analytics_revision,updated_at")
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) {
    throw new BootstrapDataError(
      `Lecture de household_revisions impossible : ${error.message}`,
    );
  }
  if (!data) return null;

  return {
    householdId: requireString(
      data.household_id,
      "household_revisions.household_id",
    ),
    dataRevision: requireRevision(
      data.data_revision,
      "household_revisions.data_revision",
    ),
    analyticsRevision: requireRevision(
      data.analytics_revision,
      "household_revisions.analytics_revision",
    ),
    updatedAt: requireString(data.updated_at, "household_revisions.updated_at"),
  };
}
