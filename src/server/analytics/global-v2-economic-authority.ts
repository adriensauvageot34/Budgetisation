import "server-only";

import {
  adaptGlobalActual,
  adaptGlobalMinimal,
  buildGlobalEconomicStructure,
  buildGlobalTypicalPair,
  buildGlobalM1Temporal,
  createGlobalM1DependencyDeclaration,
  projectGlobalEconomicStructureMonth,
} from "@/analytics/global-v2";
import { produceMetric, type MetricProductionSource } from "@/analytics/production";
import { parseYearMonth, type YearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { FactSourceResolver } from "./fact-source-resolver";

type KnownMinimalSource = Extract<
  MetricProductionSource,
  { readonly kind: "minimal_month"; readonly availability: "known" }
>;

/**
 * Server-side wiring for M1. It invokes only Canonical Facts and registered
 * Analytics producers; History snapshots and compare-only certificates are
 * deliberately absent from this path.
 */
export async function resolveGlobalM1HouseholdAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly resolver?: FactSourceResolver;
  readonly targetMonth: YearMonth;
}) {
  const targetMonth = parseYearMonth(input.targetMonth);
  const resolver = input.resolver ?? new FactSourceResolver(input.repository);
  const scope = {
    subject: { kind: "household" as const },
    time: { kind: "month" as const, month: targetMonth },
  };
  const [actualSource, minimalSource, facts, classifications] = await Promise.all([
    resolver.resolveCanonical("economic_consumption_net_attributable", scope),
    resolver.resolveCanonical("minimal_month_cost", scope),
    resolver.loadEconomicFacts(scope),
    resolver.loadEconomicComponentClassifications(scope),
  ]);
  const actualMetric = produceMetric({
    metricId: "economic_consumption_net_attributable",
    scope,
    source: actualSource,
  });
  const minimalMetric = produceMetric({
    metricId: "minimal_month_cost",
    scope,
    source: minimalSource,
  });
  if (actualMetric.unit !== "EUR" || minimalMetric.unit !== "EUR") {
    throw new TypeError("M1 exige des autorités monétaires EUR.");
  }

  const eligiblePeriods = input.repository.context.periods
    .filter(({ month }) => month.slice(0, 7) <= targetMonth)
    .sort((a, b) => a.month.localeCompare(b.month));
  const monthlyAuthorities = await Promise.all(eligiblePeriods.map(async (period) => {
    const month = parseYearMonth(period.month.slice(0, 7));
    const monthScope = {
      subject: { kind: "household" as const },
      time: { kind: "month" as const, month },
    };
    const source = await resolver.resolveCanonical(
      "economic_consumption_net_attributable",
      monthScope,
    );
    const metric = produceMetric({
      metricId: "economic_consumption_net_attributable",
      scope: monthScope,
      source,
    });
    if (metric.unit !== "EUR") throw new TypeError("Actual mensuel officiel doit être monétaire.");
    return {
      month,
      actual: metric,
      isComplete: period.financeStatus === "complete" && period.isClosed,
      isComparable: true,
      isMethodExcluded: false,
      dependencyRefs: [`analysis-period:${month}`, `metric:actual:${month}`],
    };
  }));
  if (minimalSource.kind !== "minimal_month") {
    throw new TypeError("Le resolver Minimal a renvoyé une source incompatible.");
  }
  const knownMinimal = minimalSource.availability === "known"
    ? minimalSource as KnownMinimalSource
    : undefined;
  const minimal = adaptGlobalMinimal({
    metric: minimalMetric,
    neutralVariableComponents: knownMinimal?.neutralVariableComponents ?? [],
    mandatoryMonthlyObligationsAndProvisions:
      knownMinimal?.mandatoryMonthlyObligationsAndProvisions ?? [],
  });
  const structureComponents = projectGlobalEconomicStructureMonth({ month: targetMonth, facts });
  return {
    targetMonth,
    actual: adaptGlobalActual(actualMetric),
    typical: buildGlobalTypicalPair({
      householdId: input.repository.context.householdId,
      householdTimeZone: input.repository.context.timezone,
      targetMonth,
      months: monthlyAuthorities,
    }),
    minimal,
    temporal: buildGlobalM1Temporal({ certifiedThroughMonth: targetMonth, months: monthlyAuthorities }),
    structure: buildGlobalEconomicStructure(structureComponents),
    facts,
    classifications,
    dependencyDeclaration: createGlobalM1DependencyDeclaration({
      personScope: { kind: "HOUSEHOLD" },
      authorizedPersonIds: input.repository.context.personIds,
    }),
  };
}
