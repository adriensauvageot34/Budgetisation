import "server-only";

import {
  getMetricRegistryEntry,
  MetricProductionContractError,
  type ActiveMetricId,
  type MetricProductionSource,
} from "@/analytics/production";
import {
  financialReferenceCandidateFromAnalysisPeriod,
  selectComparisonReferenceWindow,
  TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
} from "@/analytics/references";
import {
  selectEconomicComponentsForScope,
  sumEconomicNetForScope,
} from "@/analytics/context";
import type {
  ActivityOccurrenceFact,
  EconomicComponentFact,
  PersonDayFact,
  PlaceVisitFact,
} from "@/analytics/facts";
import {
  computeScopeHash,
  normalizeAnalysisScope,
  type AnalysisScope,
  type NormalizedAnalysisScope,
} from "@/core/scope";
import type { Availability, Coverage } from "@/core/metrics";
import {
  addMonths,
  parseLocalDate,
  resolveGlobalWindowMonths,
  type YearMonth,
} from "@/core/time";
import type {
  CanonicalDateRange,
  CanonicalRepository,
} from "@/server/canonical/repository";

function monthsForScope(scope: NormalizedAnalysisScope): readonly YearMonth[] {
  return scope.time.kind === "month"
    ? [scope.time.month]
    : resolveGlobalWindowMonths(
        scope.time.observationWindow,
        scope.time.asOf,
      );
}

export function canonicalRangeForScope(
  scope: AnalysisScope,
): CanonicalDateRange {
  const months = monthsForScope(normalizeAnalysisScope(scope));
  if (months.length === 0) {
    throw new MetricProductionContractError(
      "Le scope temporel ne contient aucun mois canonique.",
    );
  }
  return {
    start: parseLocalDate(`${months[0]}-01`),
    endExclusive: parseLocalDate(`${addMonths(months[months.length - 1], 1)}-01`),
  };
}

function selectedPersonDays(
  facts: readonly PersonDayFact[],
  scope: NormalizedAnalysisScope,
): readonly PersonDayFact[] {
  if (scope.subject.kind === "household") return facts;
  const personId = scope.subject.personId;
  return facts.filter((fact) => fact.personId === personId);
}

function selectedPlaceVisits(
  facts: readonly PlaceVisitFact[],
  scope: NormalizedAnalysisScope,
): readonly PlaceVisitFact[] {
  return facts.filter(
    (fact) =>
      (scope.subject.kind === "household" ||
        fact.personId === scope.subject.personId) &&
      (scope.filters.placeIds.length === 0 ||
        scope.filters.placeIds.includes(fact.placeId)),
  );
}

function selectedActivities(
  facts: readonly ActivityOccurrenceFact[],
  scope: NormalizedAnalysisScope,
): readonly ActivityOccurrenceFact[] {
  return facts.filter(
    (fact) =>
      (scope.subject.kind === "household" ||
        fact.participantIds.includes(scope.subject.personId)) &&
      (scope.filters.activityIds.length === 0 ||
        scope.filters.activityIds.includes(fact.activityId)),
  );
}

function economicSourceAvailability(input: {
  readonly facts: readonly EconomicComponentFact[];
  readonly scope: NormalizedAnalysisScope;
}): { readonly availability: Availability; readonly coverage?: Coverage } {
  if (input.scope.subject.kind === "person") {
    return { availability: "unknown" };
  }
  if (input.scope.filters.activityIds.length > 0) {
    return { availability: "unknown" };
  }
  const selected = selectEconomicComponentsForScope(input.facts, input.scope);
  if (selected.some(({ economicTiming }) => economicTiming.kind === "conflict")) {
    return { availability: "conflict" };
  }
  const uncertain = selected.filter(
    ({ economicTiming }) =>
      economicTiming.kind === "unknown" || economicTiming.kind === "partial",
  );
  const hasKnown = selected.some(
    ({ economicTiming }) =>
      economicTiming.kind === "known" || economicTiming.kind === "partial",
  );
  if (!hasKnown && uncertain.length > 0) return { availability: "unknown" };
  return {
    availability: "known",
    coverage:
      uncertain.length === 0
        ? { level: "complete" }
        : { level: "partial" },
  };
}

export class FactSourceResolver {
  constructor(private readonly repository: CanonicalRepository) {}

  loadEconomicFacts(scope: AnalysisScope): Promise<readonly EconomicComponentFact[]> {
    return this.repository.loadEconomicFacts(canonicalRangeForScope(scope));
  }

  loadPersonDays(scope: AnalysisScope): Promise<readonly PersonDayFact[]> {
    return this.repository.loadPersonDays(canonicalRangeForScope(scope));
  }

  loadPlaceVisits(scope: AnalysisScope): Promise<readonly PlaceVisitFact[]> {
    return this.repository.loadPlaceVisits(canonicalRangeForScope(scope));
  }

  loadActivityOccurrences(
    scope: AnalysisScope,
  ): Promise<readonly ActivityOccurrenceFact[]> {
    return this.repository.loadActivityOccurrences(canonicalRangeForScope(scope));
  }

  async resolve(
    metricId: ActiveMetricId,
    rawScope: AnalysisScope,
  ): Promise<MetricProductionSource> {
    const definition = getMetricRegistryEntry(metricId);
    const scope = normalizeAnalysisScope(rawScope);
    const scopeHash = computeScopeHash(scope);
    const sourceFact = definition.sourceFact[0];

    if (definition.productionStrategy === "typical_month") {
      if (scope.time.kind !== "month") {
        throw new MetricProductionContractError(
          "Typical Month exige un target month.",
        );
      }
      if (scope.subject.kind === "person") {
        throw new MetricProductionContractError(
          "L'attribution économique Person n'est pas projetée par le canonique actuel.",
        );
      }
      const candidates = this.repository.context.periods.map((period) =>
        financialReferenceCandidateFromAnalysisPeriod({
          analysisPeriod: {
            householdId: period.householdId,
            month: period.month,
            financeStatus: period.financeStatus,
            isClosed: period.isClosed,
          },
          isComparable: true,
          isMethodExcluded: false,
        }),
      );
      const window = selectComparisonReferenceWindow({
        householdId: this.repository.context.householdId,
        householdTimeZone: this.repository.context.timezone,
        targetPeriod: scope.time.month,
        requestedPeriodCount: TYPICAL_MONTH_REQUESTED_PERIOD_COUNT,
        candidates,
      });
      const monthlyObservations = await Promise.all(
        window.includedPeriods.map(async (period) => {
          const monthlyScope: AnalysisScope = {
            ...scope,
            time: { kind: "month", month: period },
          };
          const facts = await this.loadEconomicFacts(monthlyScope);
          return {
            period,
            value: sumEconomicNetForScope(facts, monthlyScope),
          };
        }),
      );
      return {
        kind: "typical_month",
        scopeHash,
        window,
        monthlyObservations,
      };
    }

    switch (sourceFact) {
      case "fct_economic_component": {
        const facts = await this.loadEconomicFacts(scope);
        const state = economicSourceAvailability({ facts, scope });
        return state.availability === "known"
          ? {
              kind: "economic_components",
              scopeHash,
              availability: "known",
              facts,
              ...(state.coverage === undefined ? {} : { coverage: state.coverage }),
            }
          : {
              kind: "economic_components",
              scopeHash,
              availability: state.availability,
              ...(state.coverage === undefined ? {} : { coverage: state.coverage }),
            };
      }
      case "fct_person_day": {
        const facts = selectedPersonDays(await this.loadPersonDays(scope), scope);
        return {
          kind: "person_days",
          scopeHash,
          availability: "known",
          facts,
          coverage: facts.some(({ locationObservability }) =>
            locationObservability !== "observable")
            ? { level: "partial" }
            : { level: "complete" },
        };
      }
      case "fct_place_visit": {
        const facts = selectedPlaceVisits(await this.loadPlaceVisits(scope), scope);
        return {
          kind: "place_visits",
          scopeHash,
          availability: "known",
          facts,
        };
      }
      case "fct_activity_occurrence": {
        const facts = selectedActivities(
          await this.loadActivityOccurrences(scope),
          scope,
        );
        return {
          kind: "activity_occurrences",
          scopeHash,
          availability: "known",
          facts,
        };
      }
      case "fct_purchase_event":
        await this.repository.loadPurchaseEvents();
        throw new MetricProductionContractError(
          "PurchaseEventFact ne projette pas encore une date canonique permettant le scope temporel.",
        );
      case undefined:
        throw new MetricProductionContractError(
          `La stratégie ${definition.productionStrategy} n'expose aucune source Fact résoluble.`,
        );
    }
  }
}
