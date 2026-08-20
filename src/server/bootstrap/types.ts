/** Types strictement provisoires utilisés par la page de validation technique. */
export type BootstrapHousehold = {
  householdId: string;
  name: string;
  timezone: string;
};

export type BootstrapPerson = {
  personId: string;
  householdId: string;
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
  householdId: string;
  month: string;
  financeStatus: BootstrapAnalysisStatus;
  lifeStatus: BootstrapAnalysisStatus;
  locationStatus: BootstrapAnalysisStatus;
  calendarStatus: BootstrapAnalysisStatus;
  isClosed: boolean;
  sourceRevision: number | null;
};

export type BootstrapHouseholdRevision = {
  householdId: string;
  dataRevision: number;
  analyticsRevision: number;
  updatedAt: string;
};
