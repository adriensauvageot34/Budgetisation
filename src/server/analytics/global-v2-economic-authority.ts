import "server-only";

import { createHash } from "node:crypto";
import Big from "big.js";

import {
  adaptGlobalActual,
  adaptGlobalMinimal,
  buildGlobalM1OwnerV2,
  buildGlobalEconomicStructure,
  buildGlobalTypicalPair,
  buildGlobalM1Temporal,
  createGlobalM1DependencyDeclaration,
  projectGlobalEconomicStructureMonth,
} from "@/analytics/global-v2";
import { canonicalSerializeGlobal } from "@/core/global-v2";
import { parseMoney } from "@/core/money";
import { produceMetric, type MetricProductionSource } from "@/analytics/production";
import { addDays, addMonths, parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString } from "@/server/canonical/record";
import { FactSourceResolver } from "./fact-source-resolver";

type KnownMinimalSource = Extract<
  MetricProductionSource,
  { readonly kind: "minimal_month"; readonly availability: "known" }
>;

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
}

function occurrenceDate(start: LocalDate | null, month: YearMonth): LocalDate {
  return start ?? parseLocalDate(`${month}-01`);
}

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
  const [actualSource, monthlyMinimalSource, periodMinimalSource, facts, classifications] = await Promise.all([
    resolver.resolveCanonical("economic_consumption_net_attributable", scope),
    resolver.resolveCanonical("minimal_month_cost", scope),
    resolver.resolveGlobalRetrospectiveMinimal(scope),
    resolver.loadEconomicFacts(scope),
    resolver.loadEconomicComponentClassifications(scope),
  ]);
  const actualMetric = produceMetric({
    metricId: "economic_consumption_net_attributable",
    scope,
    source: actualSource,
  });
  const monthlyMinimalMetric = produceMetric({
    metricId: "minimal_month_cost",
    scope,
    source: monthlyMinimalSource,
  });
  const periodMinimalMetric = produceMetric({
    metricId: "minimal_month_cost",
    scope,
    source: periodMinimalSource,
  });
  if (actualMetric.unit !== "EUR/month" || monthlyMinimalMetric.unit !== "EUR/month" || periodMinimalMetric.unit !== "EUR/month") {
    throw new TypeError("M1 exige des autorités monétaires mensuelles EUR/month.");
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
    if (metric.unit !== "EUR/month") throw new TypeError("Actual mensuel officiel doit être en EUR/month.");
    return {
      month,
      actual: metric,
      isComplete: period.financeStatus === "complete" && period.isClosed,
      isComparable: true,
      isMethodExcluded: false,
      dependencyRefs: [`analysis-period:${month}`, `metric:actual:${month}`],
    };
  }));
  if (monthlyMinimalSource.kind !== "minimal_month" || periodMinimalSource.kind !== "minimal_month") {
    throw new TypeError("Le resolver Minimal a renvoyé une source incompatible.");
  }
  const knownMonthlyMinimal = monthlyMinimalSource.availability === "known"
    ? monthlyMinimalSource as KnownMinimalSource
    : undefined;
  const monthlyMinimal = adaptGlobalMinimal({
    metric: monthlyMinimalMetric,
    neutralVariableComponents: knownMonthlyMinimal?.neutralVariableComponents ?? [],
    mandatoryMonthlyObligationsAndProvisions:
      knownMonthlyMinimal?.mandatoryMonthlyObligationsAndProvisions ?? [],
  });
  const knownPeriodMinimal = periodMinimalSource.availability === "known"
    ? periodMinimalSource as KnownMinimalSource
    : undefined;
  const periodMinimal = adaptGlobalMinimal({
    metric: periodMinimalMetric,
    neutralVariableComponents: knownPeriodMinimal?.neutralVariableComponents ?? [],
    mandatoryMonthlyObligationsAndProvisions:
      knownPeriodMinimal?.mandatoryMonthlyObligationsAndProvisions ?? [],
  });
  const structureComponents = projectGlobalEconomicStructureMonth({ month: targetMonth, facts });
  const targetActual = adaptGlobalActual(actualMetric);
  const targetTypical = buildGlobalTypicalPair({
      householdId: input.repository.context.householdId,
      householdTimeZone: input.repository.context.timezone,
      targetMonth,
      months: monthlyAuthorities,
    });
  const history = await Promise.all(monthlyAuthorities.slice(-12).map(async (authority) => {
    const monthScope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month: authority.month } };
    const source = authority.month === targetMonth
      ? monthlyMinimalSource
      : await resolver.resolveCanonical("minimal_month_cost", monthScope);
    if (source.kind !== "minimal_month") throw new TypeError("Le resolver Minimal a renvoyé une source incompatible.");
    const metric = authority.month === targetMonth
      ? monthlyMinimalMetric
      : produceMetric({ metricId: "minimal_month_cost", scope: monthScope, source });
    if (metric.unit !== "EUR/month") throw new TypeError("Minimal mensuel officiel doit être en EUR/month.");
    const known = source.availability === "known" ? source as KnownMinimalSource : undefined;
    return {
      month: authority.month,
      actual: authority.month === targetMonth ? targetActual : adaptGlobalActual(authority.actual),
      typical: authority.month === targetMonth ? targetTypical : buildGlobalTypicalPair({
        householdId: input.repository.context.householdId,
        householdTimeZone: input.repository.context.timezone,
        targetMonth: authority.month,
        months: monthlyAuthorities.filter(({ month }) => month <= authority.month),
      }),
      minimal: authority.month === targetMonth ? monthlyMinimal : adaptGlobalMinimal({
        metric,
        neutralVariableComponents: known?.neutralVariableComponents ?? [],
        mandatoryMonthlyObligationsAndProvisions: known?.mandatoryMonthlyObligationsAndProvisions ?? [],
      }),
      dependencyRefs: authority.dependencyRefs,
    };
  }));
  const firstMonth = history[0]?.month ?? targetMonth;
  const bundle = await input.repository.loadMinimalPlanningBundle({
    start: parseLocalDate(`${firstMonth}-01`),
    endExclusive: parseLocalDate(`${addMonths(targetMonth, 1)}-01`),
  });
  const recurrenceByOperation = new Map(bundle.operations.flatMap((row) => {
    const operationId = optionalCanonicalString(row, ["operation_id"]);
    const recurrenceId = optionalCanonicalString(row, ["recurrence_series_id"]);
    return operationId === undefined || recurrenceId === undefined ? [] : [[operationId, recurrenceId] as const];
  }));
  const occurrenceAmounts = new Map<string, {
    recurrenceId: string;
    occurrenceId: string;
    economicDate: LocalDate;
    amount: Big;
    evidenceRefs: Set<string>;
  }>();
  for (const fact of bundle.economicFacts) {
    if (fact.sourceOperation.kind !== "resolved" || (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial")) continue;
    const operationId = String(fact.sourceOperation.id);
    const recurrenceId = recurrenceByOperation.get(operationId);
    if (recurrenceId === undefined) continue;
    for (const segment of fact.economicTiming.segments) {
      if (segment.economicMonth === null || segment.economicMonth > targetMonth || segment.economicMonth < firstMonth) continue;
      const date = occurrenceDate(segment.periodStart, segment.economicMonth);
      const occurrenceId = `operation:${operationId}:${date}`;
      const key = `${recurrenceId}:${occurrenceId}`;
      const current = occurrenceAmounts.get(key) ?? { recurrenceId, occurrenceId, economicDate: date, amount: new Big(0), evidenceRefs: new Set<string>() };
      current.amount = current.amount.plus(segment.amount);
      current.evidenceRefs.add(`fact:${fact.canonicalComponentKey}`);
      current.evidenceRefs.add(`operation:${operationId}`);
      occurrenceAmounts.set(key, current);
    }
  }
  const dependencyDeclaration = createGlobalM1DependencyDeclaration({
      personScope: { kind: "HOUSEHOLD" },
      authorizedPersonIds: input.repository.context.personIds,
    });
  const certifiedThrough = addDays(parseLocalDate(`${addMonths(targetMonth, 1)}-01`), -1);
  return buildGlobalM1OwnerV2({
    targetMonth,
    certifiedThrough,
    asOf: input.repository.context.asOf,
    dataRevision: input.repository.context.dataRevision,
    analyticsRevision: input.repository.context.analyticsRevision,
    history,
    periodMinimal,
    structure: buildGlobalEconomicStructure(structureComponents),
    temporal: buildGlobalM1Temporal({ certifiedThroughMonth: targetMonth, months: monthlyAuthorities }),
    recurrenceObservations: [...occurrenceAmounts.values()].map((value) => ({
      recurrenceId: value.recurrenceId,
      occurrenceId: value.occurrenceId,
      economicDate: value.economicDate,
      amount: parseMoney(value.amount.toFixed()),
      evidenceRefs: [...value.evidenceRefs].sort(),
    })),
    dependencyDeclaration,
    factsDigest: digest(bundle.economicFacts),
    classificationsDigest: digest(classifications),
  });
}
