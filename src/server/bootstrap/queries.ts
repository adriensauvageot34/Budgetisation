import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseHouseholdId,
  parsePersonId,
  type HouseholdId,
} from "@/core/identity";
import {
  parseHouseholdTimeZone,
  parseInstant,
  parseLocalDate,
} from "@/core/time";
import {
  parseAnalyticsRevision,
  parseDataRevision,
  type DataRevision,
} from "@/core/versions";
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

function nullableDataRevision(value: unknown): DataRevision | null {
  return value === null ? null : parseDataRevision(value);
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
    throw new BootstrapDataError("Lecture de households impossible.", {
      cause: error,
    });
  }
  if (!data?.length) return null;
  if (data.length > 1) throw new AmbiguousHouseholdError();

  const row = data[0];
  return {
    householdId: parseHouseholdId(row.household_id),
    name: requireString(row.name, "households.name"),
    timezone: parseHouseholdTimeZone(row.timezone),
  };
}

export async function getHouseholdPersons(
  supabase: SupabaseClient,
  householdId: HouseholdId,
): Promise<BootstrapPerson[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("person_id,household_id,display_name,status")
    .eq("household_id", householdId)
    .order("display_name", { ascending: true })
    .order("person_id", { ascending: true });

  if (error) {
    throw new BootstrapDataError("Lecture de persons impossible.", {
      cause: error,
    });
  }

  return (data ?? []).map((row) => ({
    personId: parsePersonId(row.person_id),
    householdId: parseHouseholdId(row.household_id),
    displayName: requireString(row.display_name, "persons.display_name"),
    status: nullableString(row.status, "persons.status"),
  }));
}

export async function getAnalysisPeriods(
  supabase: SupabaseClient,
  householdId: HouseholdId,
): Promise<BootstrapAnalysisPeriod[]> {
  const { data, error } = await supabase
    .from("analysis_periods")
    .select(
      "analysis_period_id,household_id,month,finance_status,life_status,location_status,calendar_status,is_closed,source_revision::text",
    )
    .eq("household_id", householdId)
    .order("month", { ascending: true });

  if (error) {
    throw new BootstrapDataError("Lecture de analysis_periods impossible.", {
      cause: error,
    });
  }

  return (data ?? []).map((row) => ({
    analysisPeriodId: requireString(
      row.analysis_period_id,
      "analysis_periods.analysis_period_id",
    ),
    householdId: parseHouseholdId(row.household_id),
    month: parseLocalDate(row.month),
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
    sourceRevision: nullableDataRevision(row.source_revision),
  }));
}

export async function getHouseholdRevision(
  supabase: SupabaseClient,
  householdId: HouseholdId,
): Promise<BootstrapHouseholdRevision | null> {
  const { data, error } = await supabase
    .from("household_revisions")
    .select(
      "household_id,data_revision::text,analytics_revision::text,updated_at",
    )
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) {
    throw new BootstrapDataError(
      "Lecture de household_revisions impossible.",
      { cause: error },
    );
  }
  if (!data) return null;

  return {
    householdId: parseHouseholdId(data.household_id),
    dataRevision: parseDataRevision(data.data_revision),
    analyticsRevision: parseAnalyticsRevision(data.analytics_revision),
    updatedAt: parseInstant(data.updated_at),
  };
}
