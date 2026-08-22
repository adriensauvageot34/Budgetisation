import { parseYearMonth } from "../../core/time";
import { parseMethodVersion } from "../../core/versions";
import type {
  AnalyticsChange,
  AnalyticsImpact,
} from "./types";

function requireFactsHash(value: string): string {
  if (value.trim().length === 0) {
    throw new TypeError("factsHash doit être une chaîne non vide.");
  }
  return value;
}

export function determineAnalyticsImpacts(
  change: AnalyticsChange,
): readonly AnalyticsImpact[] {
  switch (change.kind) {
    case "technical_result_preserving":
      return [];
    case "entity":
      return [
        {
          kind: "entity",
          entity: change.entity,
          reason: change.reason,
        },
      ];
    case "month": {
      const monthImpact: AnalyticsImpact = {
        kind: "month",
        month: parseYearMonth(change.month),
        reason: change.reason,
      };
      if (!change.affectsCurrentReferences) return [monthImpact];
      if (change.asOf === undefined) {
        throw new TypeError("Un impact de référence exige asOf.");
      }
      return [
        monthImpact,
        {
          kind: "global-reference",
          asOf: parseYearMonth(change.asOf),
          referenceFamily: "current",
          reason: change.reason,
        },
      ];
    }
    case "new_complete_month":
      return [
        {
          kind: "month",
          month: parseYearMonth(change.month),
          reason: "new_complete_month",
        },
        {
          kind: "global-reference",
          asOf: parseYearMonth(change.asOf),
          referenceFamily: "current",
          reason: "new_complete_month",
        },
      ];
    case "method_version":
      parseMethodVersion(change.methodVersion);
      return [
        {
          kind: "global-reference",
          asOf: parseYearMonth(change.asOf),
          referenceFamily: "current",
          reason: "method_version_changed",
        },
      ];
    case "facts_hash":
      return [
        {
          kind: "narrative",
          factsHash: requireFactsHash(change.factsHash),
          reason: "facts_hash_changed",
        },
      ];
  }
}
