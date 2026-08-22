import type { HouseholdId, PersonId } from "@/core/identity";
import type { HouseholdTimeZone, Instant, LocalDate } from "@/core/time";
import type { AnalyticsRevision, DataRevision } from "@/core/versions";

/** Types strictement provisoires utilisés par la page de validation technique. */
export type BootstrapHousehold = {
  householdId: HouseholdId;
  name: string;
  timezone: HouseholdTimeZone;
};

export type BootstrapPerson = {
  personId: PersonId;
  householdId: HouseholdId;
  displayName: string;
  status: string | null;
};

export type BootstrapAnalysisStatus =
  | "complete"
  | "partial"
  | "unknown"
  | "not_applicable";

export type BootstrapAnalysisPeriod = {
  analysisPeriodId: string;
  householdId: HouseholdId;
  month: LocalDate;
  financeStatus: BootstrapAnalysisStatus;
  lifeStatus: BootstrapAnalysisStatus;
  locationStatus: BootstrapAnalysisStatus;
  calendarStatus: BootstrapAnalysisStatus;
  isClosed: boolean;
  sourceRevision: DataRevision | null;
};

export type BootstrapHouseholdRevision = {
  householdId: HouseholdId;
  dataRevision: DataRevision;
  analyticsRevision: AnalyticsRevision;
  updatedAt: Instant;
};
