import "server-only";

import {
  buildCalendarSemanticMonthArtifact,
  type CalendarLifeEventSource,
  type CalendarMomentSource,
  type MomentLifeEventRelationSource,
} from "@/analytics/history-v2/calendar";
import {
  buildDailyEconomicLedgerMonthArtifact,
  type DailyEconomicComponentSource,
  type DailyTimingEvidence,
} from "@/analytics/history-v2/daily-finance";
import {
  attachCalendarEconomicProjection,
  buildCalendarEconomicProjection,
  type CalendarEconomicComponentQualification,
} from "@/analytics/history-v2/calendar-economic";
import { selectEconomicComponentsForScope, sumEconomicNetForScope } from "@/analytics/context";
import type { EconomicComponentFact, LifeEventContinuityFact } from "@/analytics/facts";
import { addMoney, parseMoney, type Money } from "@/core/money";
import { addMonths, parseLocalDate, yearMonthOf, type LocalDate, type YearMonth } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import type { CanonicalRecord } from "@/server/canonical/record";

function requiredString(row: CanonicalRecord, key: string, source: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${source}.${key} doit être une chaîne non vide.`);
  }
  return value;
}

function optionalString(row: CanonicalRecord, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${key} invalide.`);
  return value;
}

function sourceKind(componentKey: string): DailyEconomicComponentSource["sourceKind"] {
  if (componentKey.startsWith("allocation:")) return "allocation";
  if (componentKey.startsWith("item:")) return "item";
  if (componentKey.startsWith("payment_component:")) return "payment_component";
  if (componentKey.startsWith("cash_use:")) return "cash_use";
  return "operation";
}

function continuityMetric(fact: LifeEventContinuityFact | undefined) {
  if (fact === undefined || fact.status === "UNKNOWN") {
    return { status: "UNKNOWN" as const, quality: { reasonCode: "DATA_NO_CONTINUITY_ASSERTION" as const } };
  }
  if (fact.status === "CONFLICT") {
    return { status: "CONFLICT" as const, quality: { reasonCode: "DATA_CONFLICTING_AUTHORITIES" as const } };
  }
  return { status: "KNOWN" as const, value: fact.continuityQualifier! };
}

function calendarRange(month: YearMonth) {
  return {
    start: parseLocalDate(`${month}-01`),
    endExclusive: parseLocalDate(`${addMonths(month, 1)}-01`),
  };
}

/** Read-only canonical adapter. It does not write analytics_artifacts or snapshots. */
export async function buildCalendarSemanticMonthFromCanonical(
  repository: CanonicalRepository,
  month: YearMonth,
) {
  const range = calendarRange(month);
  const [occurrences, continuity, moments] = await Promise.all([
    repository.loadActivityOccurrences(range),
    repository.loadLifeEventContinuity(range),
    repository.loadEntityRows("moments", "moment_id"),
  ]);
  const lifeEventIds = occurrences.map(({ lifeEventId }) => String(lifeEventId));
  const [records, relations] = await Promise.all([
    repository.loadLifeEventRecords(lifeEventIds),
    repository.loadMomentLifeEventRowsByLifeEventIds(lifeEventIds),
  ]);
  const recordById = new Map(records.map((row) => [requiredString(row, "life_event_id", "life_events"), row]));
  const continuityById = new Map(continuity.map((fact) => [String(fact.lifeEventId), fact]));
  const lifeEvents: CalendarLifeEventSource[] = occurrences.map((occurrence) => {
    const id = String(occurrence.lifeEventId);
    const record = recordById.get(id);
    if (record === undefined) throw new TypeError(`Life Event ${id} absent de la lecture canonique.`);
    return {
      lifeEventId: id,
      typeKey: String(occurrence.activityId),
      ...(optionalString(record, "title") === undefined ? {} : { title: optionalString(record, "title") }),
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
      validationStatus: occurrence.validationStatus,
      participantIds: occurrence.participantIds.map(String),
      ...(occurrence.lifeEventSeriesId === null ? {} : { seriesId: String(occurrence.lifeEventSeriesId) }),
      ...(occurrence.parentLifeEventId === null ? {} : { parentLifeEventId: String(occurrence.parentLifeEventId) }),
      continuityQualifier: continuityMetric(continuityById.get(id)),
      ...(record.calendar_mode_override === "Month" || record.calendar_role_override === "Marker"
        ? { explicitMonthVisibility: true }
        : {}),
      authority: {
        kind: "OBSERVED_CANONICAL",
        authority: "life_events",
        sourceRefs: [`life_event:${id}`],
      },
    };
  });
  const relevantMoments = moments.filter((row) => {
    const rawStart = optionalString(row, "start_date");
    const rawEnd = optionalString(row, "end_date");
    if (rawStart === undefined || rawEnd === undefined) return false;
    const start = parseLocalDate(rawStart);
    const end = parseLocalDate(rawEnd);
    return start < range.endExclusive && end >= range.start;
  });
  const momentSources: CalendarMomentSource[] = relevantMoments.map((row) => {
    const id = requiredString(row, "moment_id", "moments");
    return {
      momentId: id,
      type: requiredString(row, "type", "moments"),
      ...(optionalString(row, "name") === undefined ? {} : { title: optionalString(row, "name") }),
      startDate: parseLocalDate(requiredString(row, "start_date", "moments")),
      endDate: parseLocalDate(requiredString(row, "end_date", "moments")),
      authority: {
        kind: "OBSERVED_CANONICAL",
        authority: "moments",
        sourceRefs: [`moment:${id}`],
      },
    };
  });
  const relevantMomentIds = new Set(momentSources.map(({ momentId }) => momentId));
  const relationSources: MomentLifeEventRelationSource[] = relations.flatMap((row) => {
    const momentId = requiredString(row, "moment_id", "moment_life_events");
    if (!relevantMomentIds.has(momentId)) return [];
    const relationType = requiredString(row, "relation_type", "moment_life_events");
    const validationStatus = requiredString(row, "validation_status", "moment_life_events");
    if (![
      "Événement principal", "Composant", "Préparation",
    ].includes(relationType) || !["Confirmé", "Déduit"].includes(validationStatus)) {
      throw new TypeError("Relation Moment/Life Event hors contrat Calendar V2.");
    }
    return [{
      momentId,
      lifeEventId: requiredString(row, "life_event_id", "moment_life_events"),
      relationType: relationType as MomentLifeEventRelationSource["relationType"],
      validationStatus: validationStatus as MomentLifeEventRelationSource["validationStatus"],
    }];
  });
  return buildCalendarSemanticMonthArtifact({
    householdId: repository.householdId(),
    month,
    lifeEvents,
    moments: momentSources,
    contexts: [],
    momentLifeEvents: relationSources,
    sourceCompleteness: "KNOWN",
  });
}

function dimensionId(value: EconomicComponentFact["category"] | EconomicComponentFact["subcategory"]): string | undefined {
  return value.kind === "resolved" ? String(value.id) : undefined;
}

function behaviorQualification(value: EconomicComponentFact["behavior"]): CalendarEconomicComponentQualification["behavior"] {
  if (value.kind === "conflict") return "CONFLICT";
  if (value.kind !== "resolved") return "UNKNOWN";
  if (value.value === "Fixe") return "FIXED";
  if (value.value === "Variable") return "NON_FIXED";
  return "UNKNOWN";
}

/**
 * Canonical closure used by CalendarEconomicProjection. The projection never
 * reads operations, labels or recurrence tables itself.
 */
export async function loadCalendarEconomicQualificationsFromCanonical(
  repository: CanonicalRepository,
  range: { readonly start: LocalDate; readonly endExclusive: LocalDate },
): Promise<readonly CalendarEconomicComponentQualification[]> {
  const facts = await repository.loadEconomicFacts(range);
  const operationIds = [...new Set(facts.flatMap(({ sourceOperation }) =>
    sourceOperation.kind === "resolved" ? [String(sourceOperation.id)] : []))];
  const [operations, taxonomy] = await Promise.all([
    repository.loadOperationsByIds(operationIds),
    repository.loadCalendarEconomicTaxonomy(),
  ]);
  const { categories, subcategories, recurrenceSeries: recurrenceRows } = taxonomy;
  const operationById = new Map(operations.map((row) => [requiredString(row, "operation_id", "operations"), row]));
  const categoryById = new Map(categories.map((row) => [requiredString(row, "category_id", "categories"), row]));
  const subcategoryById = new Map(subcategories.map((row) => [requiredString(row, "subcategory_id", "subcategories"), row]));
  const recurrenceById = new Map(recurrenceRows.map((row) => [requiredString(row, "recurrence_series_id", "recurrence_series"), row]));
  return facts.map((fact) => {
    const componentKey = String(fact.canonicalComponentKey);
    const operation = fact.sourceOperation.kind === "resolved"
      ? operationById.get(String(fact.sourceOperation.id))
      : undefined;
    const recurrenceId = operation === undefined ? undefined : optionalString(operation, "recurrence_series_id");
    const recurrence = recurrenceId === undefined ? "NONE" as const : recurrenceById.get(recurrenceId);
    const recurrenceQualification: CalendarEconomicComponentQualification["recurrence"] = recurrence === "NONE"
      ? "NONE"
      : recurrence === undefined
        ? "UNKNOWN"
        : optionalString(recurrence, "statut_serie") === "Active" && optionalString(recurrence, "cadence_estimee") !== undefined
          ? "CONFIRMED"
          : optionalString(recurrence, "statut_serie") === "Inactive"
            ? "NONE"
            : "CONFLICT";
    const category = dimensionId(fact.category);
    const subcategory = dimensionId(fact.subcategory);
    const categoryRow = category === undefined ? undefined : categoryById.get(category);
    const subcategoryRow = subcategory === undefined ? undefined : subcategoryById.get(subcategory);
    return {
      componentKey,
      ...(categoryRow === undefined ? {} : { categoryKey: requiredString(categoryRow, "category_key", "categories") }),
      ...(subcategoryRow === undefined ? {} : {
        subcategoryKey: requiredString(subcategoryRow, "subcategory_key", "subcategories"),
        subcategoryLabel: requiredString(subcategoryRow, "nom_canonique", "subcategories"),
      }),
      behavior: behaviorQualification(fact.behavior),
      recurrence: recurrenceQualification,
      sourceRefs: [
        `economic_component:${componentKey}`,
        ...(recurrenceId === undefined ? [] : [`recurrence_series:${recurrenceId}`]),
      ],
    };
  });
}

export async function buildCalendarCentricMonthFromCanonical(
  repository: CanonicalRepository,
  month: YearMonth,
  ledger: Awaited<ReturnType<typeof buildDailyEconomicLedgerMonthFromCanonical>>,
) {
  const range = calendarRange(month);
  const [calendarArtifact, facts, qualifications] = await Promise.all([
    buildCalendarSemanticMonthFromCanonical(repository, month),
    repository.loadEconomicFacts(range),
    loadCalendarEconomicQualificationsFromCanonical(repository, range),
  ]);
  return attachCalendarEconomicProjection(calendarArtifact, buildCalendarEconomicProjection({
    householdId: repository.householdId(),
    month,
    facts,
    ledger,
    qualifications,
  }));
}

function evidenceForFact(
  fact: EconomicComponentFact,
  month: YearMonth,
): readonly DailyTimingEvidence[] {
  if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") {
    return [{ kind: "ECONOMIC_MONTH", month, evidenceRef: `economic_month:${fact.canonicalComponentKey}` }];
  }
  return fact.economicTiming.segments.flatMap((segment): readonly DailyTimingEvidence[] => {
    if (segment.economicMonth !== month) return [];
    const segmentKey = String(segment.segmentKey);
    if (segmentKey.endsWith(":bank_date_fallback")) {
      return [{
        kind: "BANK_DATE_FALLBACK" as const,
        ...(segment.periodStart === null ? {} : { date: segment.periodStart }),
        month,
        evidenceRef: segmentKey,
      }];
    }
    if (segment.periodStart !== null && segment.periodStart === segment.periodEnd) {
      return [{
        kind: segmentKey.endsWith(":real_transaction_date") || segmentKey.endsWith(":forced_analytic_month")
          ? "TRUSTED_PURCHASE_SOURCE" as const
          : "EXPLICIT_CONSUMPTION_SOURCE" as const,
        date: segment.periodStart,
        month,
        evidenceRef: segmentKey,
      }];
    }
    return [{ kind: "ECONOMIC_MONTH" as const, month, evidenceRef: segmentKey }];
  });
}

function amountForMonth(fact: EconomicComponentFact, month: YearMonth): Money {
  if (fact.economicTiming.kind !== "known" && fact.economicTiming.kind !== "partial") return fact.net;
  const values = fact.economicTiming.segments
    .filter(({ economicMonth }) => economicMonth === month)
    .map(({ amount }) => amount);
  return values.length === 0 ? fact.net : values.reduce(addMoney, parseMoney("0"));
}

/**
 * Read-only Daily Ledger adapter. V1 timing may select the monthly population, but
 * a bank_date_fallback is explicitly labeled and rejected as a daily authority by
 * the V2 engine.
 */
export async function buildDailyEconomicLedgerMonthFromCanonical(
  repository: CanonicalRepository,
  month: YearMonth,
  currency = "EUR",
) {
  const range = calendarRange(month);
  const scope = { subject: { kind: "household" as const }, time: { kind: "month" as const, month } };
  const [facts, purchaseEvents] = await Promise.all([
    repository.loadEconomicFacts(range),
    repository.loadPurchaseEvents(),
  ]);
  const selected = selectEconomicComponentsForScope(facts, scope);
  const components: DailyEconomicComponentSource[] = selected.map((fact) => {
    const key = String(fact.canonicalComponentKey);
    return {
      canonicalComponentKey: key,
      amount: amountForMonth(fact, month),
      economicMonth: month,
      sourceRefs: [
        ...(fact.sourceOperation.kind === "resolved" ? [`operation:${fact.sourceOperation.id}`] : []),
        key,
      ],
      timingEvidence: evidenceForFact(fact, month),
      sourceKind: sourceKind(key),
      provenance: {
        kind: "OBSERVED_CANONICAL",
        authority: "fct_economic_component",
        sourceRefs: [key],
      },
    };
  });
  return buildDailyEconomicLedgerMonthArtifact({
    householdId: repository.householdId(),
    month,
    currency,
    actualMonthAmount: sumEconomicNetForScope(facts, scope),
    components,
    purchaseEvents,
  });
}
