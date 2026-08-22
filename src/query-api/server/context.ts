import "server-only";

import { parseSupportedContractVersion } from "../../core/api";
import { parseHouseholdId } from "../../core/identity";
import { parseInstant } from "../../core/time";
import { parseAnalyticsRevision, parseDataRevision } from "../../core/versions";
import type {
  QueryDependencyRevision,
  QueryServerContext,
} from "./types";

function parseNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} doit être une chaîne non vide.`);
  }
  return value;
}

function validateDependency(
  dependency: QueryDependencyRevision,
): QueryDependencyRevision {
  if (!(dependency.status === "fresh" || dependency.status === "stale")) {
    throw new TypeError("QueryDependencyRevision.status est invalide.");
  }
  return {
    dependencyId: parseNonEmptyString(dependency.dependencyId, "dependencyId"),
    status: dependency.status,
    dataRevision: parseDataRevision(dependency.dataRevision),
    analyticsRevision: parseAnalyticsRevision(dependency.analyticsRevision),
  };
}

export function validateQueryServerContext(
  context: QueryServerContext,
): QueryServerContext {
  if (!Array.isArray(context.revisions.dependencies)) {
    throw new TypeError("QueryRevisionSnapshot.dependencies doit être un tableau.");
  }
  return {
    actor: {
      actorId: parseNonEmptyString(context.actor.actorId, "actor.actorId"),
    },
    household: {
      householdId: parseHouseholdId(context.household.householdId),
    },
    revisions: {
      dataRevision: parseDataRevision(context.revisions.dataRevision),
      analyticsRevision: parseAnalyticsRevision(context.revisions.analyticsRevision),
      dependencies: context.revisions.dependencies.map(validateDependency),
    },
    contractVersion: parseSupportedContractVersion(context.contractVersion),
    now: parseInstant(context.now),
  };
}
