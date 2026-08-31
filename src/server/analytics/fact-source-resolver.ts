import "server-only";

import {
  getMetricRegistryEntry,
  economicSourceAvailability,
  isFinanceScopeCompleteAndClosed,
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
  ActivityOccurrenceCostFact,
  EconomicComponentFact,
  EconomicComponentClassificationFact,
  LifeEventContinuityFact,
  PersonDayFact,
  PlaceVisitFact,
} from "@/analytics/facts";
import {
  buildActivityOccurrenceCostFacts,
  parseActivityCausalFinancialLinks,
} from "@/analytics/facts";
import {
  computeScopeHash,
  normalizeAnalysisScope,
  type AnalysisScope,
  type NormalizedAnalysisScope,
} from "@/core/scope";
import { parseSupport, type SupportUnit } from "@/core/metrics";
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
import {
  resolveMinimalPlanningSource,
  type MinimalPlanningResolution,
  type MinimalSourceHealth,
} from "./minimal-source-resolver";
import type { SupabaseAnalyticsMaterializationStore } from "./materialization";
import type { CertifiedHistoricalMinimalSource } from "./materialization/certified-historical-minimal";

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

function sourceSupport(n: number, unit: SupportUnit) {
  return parseSupport({ n, unit, level: n === 0 ? "insufficient" : "sufficient" });
}

export function economicTransactionIdentity(fact: EconomicComponentFact): string {
  const componentKey = String(fact.canonicalComponentKey);
  if (componentKey.startsWith("cash_use:")) return componentKey;
  return fact.sourceOperation.kind === "resolved"
    ? `operation:${fact.sourceOperation.id}`
    : componentKey;
}

export function distinctEconomicTransactionCount(
  facts: readonly EconomicComponentFact[],
): number {
  return new Set(facts.map(economicTransactionIdentity)).size;
}

function economicSupport(n: number) {
  return parseSupport({
    n,
    unit: "transaction",
    level: n === 0 ? "insufficient" : "sufficient",
  });
}

export class FactSourceResolver {
  constructor(
    private readonly repository: CanonicalRepository,
    private readonly materialization?: SupabaseAnalyticsMaterializationStore,
    private readonly certifiedHistoricalMinimal?: CertifiedHistoricalMinimalSource,
  ) {}

  loadEconomicFacts(scope: AnalysisScope): Promise<readonly EconomicComponentFact[]> {
    return this.repository.loadEconomicFacts(canonicalRangeForScope(scope));
  }

  loadEconomicComponentClassifications(
    scope: AnalysisScope,
  ): Promise<readonly EconomicComponentClassificationFact[]> {
    return this.repository.loadEconomicComponentClassifications(canonicalRangeForScope(scope));
  }

  loadLifeEventContinuity(
    scope: AnalysisScope,
  ): Promise<readonly LifeEventContinuityFact[]> {
    return this.repository.loadLifeEventContinuity(canonicalRangeForScope(scope));
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

  async loadActivityOccurrenceCosts(
    scope: AnalysisScope,
  ): Promise<readonly ActivityOccurrenceCostFact[]> {
    const normalized = normalizeAnalysisScope(scope);
    const occurrences = selectedActivities(
      await this.loadActivityOccurrences(normalized),
      normalized,
    );
    if (occurrences.length === 0) return [];
    const links = parseActivityCausalFinancialLinks(
      await this.repository.loadActivityCausalFinancialLinkRows(
        occurrences.map(({ lifeEventId }) => lifeEventId),
      ),
    );
    const components = await this.repository.loadEconomicFactsByComponentKeys(
      links.map(({ canonicalComponentKey }) => canonicalComponentKey),
    );
    return buildActivityOccurrenceCostFacts({ occurrences, components, links });
  }

  private async resolveMinimalMonth(
    scope: NormalizedAnalysisScope,
  ): Promise<MinimalPlanningResolution> {
    if (scope.time.kind !== "month" || scope.subject.kind !== "household") {
      return {
        availability: "unknown",
        neutralVariableComponents: [],
        mandatoryMonthlyObligationsAndProvisions: [],
        health: {
          neutralVariable: "MISSING_SOURCE",
          obligationsAndProvisions: "MISSING_SOURCE",
          unresolvedNeutralSourceCount: 0,
          unresolvedObligationSourceCount: 0,
        },
      };
    }
    const targetMonth = scope.time.month;
    const referenceMonths = this.repository.context.periods
      .filter(({ month, financeStatus, isClosed }) =>
        financeStatus === "complete" && isClosed && month.slice(0, 7) < targetMonth)
      .map(({ month }) => month.slice(0, 7) as YearMonth)
      .sort()
      .slice(-TYPICAL_MONTH_REQUESTED_PERIOD_COUNT);
    const firstMonth = referenceMonths[0];
    const lastMonth = referenceMonths.at(-1);
    if (firstMonth === undefined || lastMonth === undefined) {
      return resolveMinimalPlanningSource({
        bundle: {
          economicFacts: [],
          operations: [],
          allocations: [],
          items: [],
          paymentComponents: [],
          cashUses: [],
          baselineRules: [],
          needs: [],
          provisionPools: [],
          recurrenceSeries: [],
          annualEvents: [],
          worksiteActivityTypeIds: [],
          plannedActivityDays: [],
        },
        targetMonth,
        referenceMonths,
      });
    }
    const bundle = await this.repository.loadMinimalPlanningBundle({
      start: parseLocalDate(`${firstMonth}-01`),
      endExclusive: parseLocalDate(`${addMonths(lastMonth, 1)}-01`),
    });
    return resolveMinimalPlanningSource({
      bundle,
      targetMonth,
      referenceMonths,
    });
  }

  async minimalSourceHealth(rawScope: AnalysisScope): Promise<MinimalSourceHealth> {
    return (await this.resolveMinimalMonth(normalizeAnalysisScope(rawScope))).health;
  }

  async resolve(
    metricId: ActiveMetricId,
    rawScope: AnalysisScope,
  ): Promise<MetricProductionSource> {
    const definition = getMetricRegistryEntry(metricId);
    const scope = normalizeAnalysisScope(rawScope);
    const scopeHash = computeScopeHash(scope);
    const sourceFact = definition.sourceFact[0];

    if (definition.productionStrategy === "minimal_month") {
      if (scope.time.kind === "month" && scope.subject.kind === "household") {
        const certified = this.certifiedHistoricalMinimal?.resolve({
          month: scope.time.month,
          scopeHash,
        });
        if (certified !== undefined && certified !== null) return certified;
      }
      const resolution = await this.resolveMinimalMonth(scope);
      return resolution.availability === "known"
        ? {
            kind: "minimal_month",
            scopeHash,
            availability: "known",
            neutralVariableComponents: resolution.neutralVariableComponents,
            mandatoryMonthlyObligationsAndProvisions:
              resolution.mandatoryMonthlyObligationsAndProvisions,
            coverage:
              resolution.health.neutralVariable === "AVAILABLE" &&
              resolution.health.obligationsAndProvisions === "AVAILABLE"
                ? { level: "complete" }
                : { level: "partial" },
          }
        : {
            kind: "minimal_month",
            scopeHash,
            availability: "unknown",
            support: parseSupport({
              n: 0,
              unit: "month",
              level: "insufficient",
            }),
            coverage: { level: "partial" },
          };
    }

    if (definition.productionStrategy === "typical_month") {
      if (scope.time.kind !== "month") {
        throw new MetricProductionContractError(
          "Typical Month exige un target month.",
        );
      }
      const personFinanceUnavailable = scope.subject.kind === "person";
      const candidates = this.repository.context.periods.map((period) =>
        financialReferenceCandidateFromAnalysisPeriod({
          analysisPeriod: {
            householdId: period.householdId,
            month: period.month,
            financeStatus: period.financeStatus,
            isClosed: period.isClosed,
          },
          // Une fenêtre Person ne peut pas réutiliser les observations Finance
          // Household tant que l'attribution économique Person n'est pas
          // projetée. Une fenêtre vide produit l'enveloppe unknown attendue,
          // sans exception et sans transformer l'absence en zéro.
          isComparable: !personFinanceUnavailable,
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
      if (personFinanceUnavailable) {
        return {
          kind: "typical_month",
          scopeHash,
          window,
          monthlyObservations: [],
        };
      }
      const monthlyScopes = window.includedPeriods.map((period) => ({
        ...scope,
        time: { kind: "month" as const, month: period },
      }));
      let materializedByScope: ReadonlyMap<string, import("@/analytics/production").ProducedMetric> = new Map();
      if (this.materialization !== undefined) {
        try {
          materializedByScope = await this.materialization.readMonthlyMetrics(
            "economic_consumption_net_attributable",
            monthlyScopes,
          );
        } catch {
          // La référence brute reste le fallback strict.
        }
      }
      const monthlyObservations = await Promise.all(
        window.includedPeriods.map(async (period, index) => {
          const monthlyScope = monthlyScopes[index];
          const materialized = materializedByScope.get(
            computeScopeHash(normalizeAnalysisScope(monthlyScope)),
          );
          if (
            materialized?.availability === "known"
            && typeof materialized.value === "string"
          ) {
            return { period, value: materialized.value };
          }
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
        const selectedFacts = selectEconomicComponentsForScope(facts, scope);
        const state = economicSourceAvailability({
          facts,
          scope,
          emptyPeriodQualified: isFinanceScopeCompleteAndClosed(
            this.repository.context.periods,
            scope,
          ),
        });
        return state.availability === "known"
          ? {
              kind: "economic_components",
              scopeHash,
              availability: "known",
              facts,
              support: economicSupport(
                definition.supportPolicy.unit === "transaction"
                  ? distinctEconomicTransactionCount(selectedFacts)
                  : selectedFacts.length,
              ),
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
        const householdFacts = await this.loadPersonDays(scope);
        const facts = selectedPersonDays(householdFacts, scope);
        return {
          kind: "person_days",
          scopeHash,
          availability: "known",
          facts,
          support: sourceSupport(facts.length, "person_day"),
          coverage: householdFacts.some(({ locationObservability }) =>
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
          support: sourceSupport(facts.length, "place_visit"),
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
          support: sourceSupport(facts.length, "occurrence"),
        };
      }
      case "fct_activity_occurrence_cost": {
        const incompatible = scope.subject.kind === "person" ||
          scope.filters.categoryIds.length > 0 ||
          scope.filters.merchantIds.length > 0 ||
          scope.filters.placeIds.length > 0 ||
          scope.filters.lifeScopeContext.length > 0 ||
          scope.filters.dayContext.length > 0;
        if (incompatible) {
          return { kind: "activity_occurrence_costs", scopeHash, availability: "unknown" };
        }
        return {
          kind: "activity_occurrence_costs",
          scopeHash,
          availability: "known",
          facts: await this.loadActivityOccurrenceCosts(scope),
        };
      }
      case "fct_purchase_event": {
        const incompatible = scope.subject.kind === "person" ||
          scope.filters.categoryIds.length > 0 ||
          scope.filters.activityIds.length > 0 ||
          scope.filters.merchantIds.length > 0 ||
          scope.filters.placeIds.length > 0 ||
          scope.filters.lifeScopeContext.length > 0 ||
          scope.filters.dayContext.length > 0;
        if (incompatible) {
          return { kind: "purchase_events", scopeHash, availability: "unknown" };
        }
        const months = new Set(monthsForScope(scope));
        const allFacts = await this.repository.loadPurchaseEvents();
        const facts = allFacts.filter(({ timing }) =>
          timing.economicMonth !== null && months.has(timing.economicMonth));
        const hasUnscopedFacts = allFacts.some(({ timing }) => timing.economicMonth === null);
        return {
          kind: "purchase_events",
          scopeHash,
          availability: "known",
          facts,
          support: sourceSupport(facts.length, "purchase_event"),
          coverage: { level: hasUnscopedFacts ? "partial" : "complete" },
        };
      }
      case undefined:
        throw new MetricProductionContractError(
          `La stratégie ${definition.productionStrategy} n'expose aucune source Fact résoluble.`,
        );
    }
  }
}
