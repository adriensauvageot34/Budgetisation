import "server-only";

import { CURRENT_CONTRACT_VERSION } from "@/core/api";
import type { HouseholdId, PersonId } from "@/core/identity";
import type { HouseholdTimeZone, Instant } from "@/core/time";
import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
} from "@/core/versions";
import type {
  BootstrapAnalysisPeriod,
  BootstrapPerson,
} from "@/server/bootstrap/types";
import { QueryTemporaryUnavailableError } from "@/query-api/server";

export type AuthorizedRuntimeContext = {
  readonly userId: string;
  readonly householdId: HouseholdId;
  readonly persons: readonly BootstrapPerson[];
  readonly personIds: readonly PersonId[];
  readonly timezone: HouseholdTimeZone;
  readonly periods: readonly BootstrapAnalysisPeriod[];
  readonly dataRevision: DataRevision;
  readonly analyticsRevision: AnalyticsRevision;
  readonly contractVersion: ContractVersion;
  readonly asOf: Instant;
};

type BootstrapContextInput = {
  readonly user: { readonly id: string };
  readonly household: {
    readonly householdId: HouseholdId;
    readonly timezone: HouseholdTimeZone;
  } | null;
  readonly persons: readonly BootstrapPerson[];
  readonly periods: readonly BootstrapAnalysisPeriod[];
  readonly revision: {
    readonly dataRevision: DataRevision;
    readonly analyticsRevision: AnalyticsRevision;
  } | null;
};

export function createAuthorizedRuntimeContext(
  bootstrap: BootstrapContextInput,
  asOf: Instant,
): AuthorizedRuntimeContext {
  if (bootstrap.household === null || bootstrap.revision === null) {
    throw new QueryTemporaryUnavailableError(
      "Le Household autorisé ou ses revisions sont indisponibles.",
    );
  }
  if (
    bootstrap.persons.some(
      (person) => person.householdId !== bootstrap.household?.householdId,
    )
  ) {
    throw new QueryTemporaryUnavailableError(
      "Les Persons du contexte autorisé sont incohérentes.",
    );
  }
  return {
    userId: bootstrap.user.id,
    householdId: bootstrap.household.householdId,
    persons: bootstrap.persons,
    personIds: bootstrap.persons.map(({ personId }) => personId),
    timezone: bootstrap.household.timezone,
    periods: bootstrap.periods,
    dataRevision: bootstrap.revision.dataRevision,
    analyticsRevision: bootstrap.revision.analyticsRevision,
    contractVersion: CURRENT_CONTRACT_VERSION,
    asOf,
  };
}
