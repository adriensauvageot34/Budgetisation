import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dedupeActivityOccurrences,
  dedupeEconomicComponents,
  dedupePersonDays,
  dedupePlaceVisits,
  dedupePurchaseEvents,
  parseCanonicalHouseholdScope,
  projectActivityOccurrenceFact,
  projectEconomicComponentFact,
  projectPersonDayFact,
  projectPlaceVisitFact,
  projectPurchaseEventFact,
  type ActivityOccurrenceFact,
  type CanonicalHouseholdContext,
  type EconomicComponentFact,
  type PersonDayFact,
  type PlaceVisitFact,
  type PurchaseEventFact,
} from "@/analytics/facts";
import type {
  HouseholdId,
  OperationId,
  PersonId,
} from "@/core/identity";
import { addDays, parseLocalDate, yearMonthOf, type LocalDate, type YearMonth } from "@/core/time";
import type { AuthorizedRuntimeContext } from "./context";
import {
  type CanonicalSourceHealth,
  type CanonicalSourceHealthStatus,
} from "./source-health";
import {
  CanonicalMissingMigrationError,
  CanonicalReadError,
  type CanonicalHealthSourceName,
  type CanonicalSourceName,
} from "./errors";
import {
  canonicalRecord,
  canonicalRecords,
  canonicalString,
  type CanonicalRecord,
} from "./record";
import { safeRuntimeEnvironment } from "@/server/runtime-environment";

type CanonicalQueryError = {
  readonly code?: string;
  readonly message?: string;
};

type CanonicalQueryResult = {
  readonly data: unknown;
  readonly error: CanonicalQueryError | null;
};

const canonicalLogUuidPattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const canonicalLogJwtPattern =
  /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

function safeCanonicalErrorMessage(message: string | undefined): string {
  const normalized = message?.replace(/\s+/g, " ").trim();
  if (!normalized) return "Supabase canonical read failed.";
  return normalized
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(canonicalLogJwtPattern, "[redacted-token]")
    .replace(/\b(?:sb_secret_|sk-)[A-Za-z0-9._-]+\b/gi, "[redacted-key]")
    .replace(/(https?:\/\/[^\s?]+)\?\S+/gi, "$1?[redacted]")
    .replace(canonicalLogUuidPattern, "[redacted-id]")
    .slice(0, 300);
}

function logCanonicalReadError(
  source: CanonicalSourceName,
  error: CanonicalQueryError,
): void {
  const build = safeRuntimeEnvironment();
  console.error({
    event: "canonical_read_error",
    source,
    ...(error.code === undefined ? {} : { errorCode: error.code }),
    message: safeCanonicalErrorMessage(error.message),
    environment: build.environment,
    commitSha: build.commitSha,
  });
}

function isMissingPurchaseRelationError(error: CanonicalQueryError): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /\brelation\b.{0,180}\bdoes not exist\b/i.test(message) ||
    /\bcould not find the table\b.{0,180}\bin the schema cache\b/i.test(message)
  );
}

export type CanonicalDateRange = {
  readonly start: LocalDate;
  readonly endExclusive: LocalDate;
};

export type CanonicalOperationBundle = {
  readonly operations: readonly CanonicalRecord[];
  readonly economicFacts: readonly EconomicComponentFact[];
  readonly allocations: readonly CanonicalRecord[];
  readonly items: readonly CanonicalRecord[];
  readonly paymentComponents: readonly CanonicalRecord[];
  readonly cashUses: readonly CanonicalRecord[];
};

type CompositionTable =
  | "operation_allocations"
  | "operation_items"
  | "payment_components"
  | "cash_economic_uses";

const compositionMappings = {
  operation_allocations: {
    foreignOperationKey: "operation_id",
    operationIdSelection: null,
    stableId: "allocation_id",
    moneyColumn: "montant",
  },
  operation_items: {
    foreignOperationKey: "operation_id",
    operationIdSelection: null,
    stableId: "item_id",
    moneyColumn: "montant_economique",
  },
  payment_components: {
    foreignOperationKey: "operation_id",
    operationIdSelection: null,
    stableId: "payment_component_id",
    moneyColumn: "montant",
  },
  cash_economic_uses: {
    foreignOperationKey: "withdrawal_operation_id",
    operationIdSelection: "operation_id:withdrawal_operation_id",
    stableId: "cash_use_id",
    moneyColumn: "montant_economique",
  },
} as const satisfies Record<
  CompositionTable,
  {
    readonly foreignOperationKey: string;
    readonly operationIdSelection: string | null;
    readonly stableId: string;
    readonly moneyColumn: string;
  }
>;

type EntityTable = "places" | "merchants" | "moments";
type TaxonomyTable = "categories" | "subcategories";

const entityMappings = {
  places: { physicalTable: "referentiel_lieu", idColumn: "place_id" },
  merchants: { physicalTable: "merchants", idColumn: "merchant_id" },
  moments: { physicalTable: "moments", idColumn: "moment_id" },
} as const satisfies Record<
  EntityTable,
  { readonly physicalTable: string; readonly idColumn: string }
>;

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function groupBy(
  values: readonly CanonicalRecord[],
  key: string,
): ReadonlyMap<string, readonly CanonicalRecord[]> {
  const groups = new Map<string, CanonicalRecord[]>();
  for (const value of values) {
    const groupKey = canonicalString(value, [key], "operations");
    const group = groups.get(groupKey) ?? [];
    group.push(value);
    groups.set(groupKey, group);
  }
  return groups;
}

function byUniqueKey(
  values: readonly CanonicalRecord[],
  key: string,
  source: CanonicalSourceName,
): ReadonlyMap<string, CanonicalRecord> {
  const result = new Map<string, CanonicalRecord>();
  for (const value of values) {
    const id = canonicalString(value, [key], source);
    if (result.has(id)) {
      throw new CanonicalReadError(source, `${source}.${key} n'est pas unique.`);
    }
    result.set(id, value);
  }
  return result;
}

function mergeRows(
  left: readonly CanonicalRecord[],
  right: readonly CanonicalRecord[],
  key: string,
  source: CanonicalSourceName,
): readonly CanonicalRecord[] {
  const merged = new Map<string, CanonicalRecord>();
  for (const row of [...left, ...right]) {
    const id = canonicalString(row, [key], source);
    const existing = merged.get(id);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(row)) {
      throw new CanonicalReadError(source, `${source}.${key} porte deux versions.`);
    }
    merged.set(id, row);
  }
  return [...merged.values()];
}

export class CanonicalRepository {
  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly household: CanonicalHouseholdContext;

  constructor(
    private readonly client: SupabaseClient,
    readonly context: AuthorizedRuntimeContext,
  ) {
    this.household = {
      householdId: context.householdId,
      householdTimeZone: context.timezone,
    };
  }

  private cached<Value>(key: string, load: () => Promise<Value>): Promise<Value> {
    const existing = this.cache.get(key);
    if (existing !== undefined) return existing as Promise<Value>;
    const promise = load();
    this.cache.set(key, promise);
    return promise;
  }

  private readRows(
    key: string,
    source: CanonicalSourceName,
    query: () => PromiseLike<CanonicalQueryResult>,
  ): Promise<readonly CanonicalRecord[]> {
    return this.cached(key, async () => {
      const { data, error } = await query();
      if (error !== null) {
        logCanonicalReadError(source, error);
        if (source === "purchase_events" && isMissingPurchaseRelationError(error)) {
          throw new CanonicalMissingMigrationError("purchase_events");
        }
        throw new CanonicalReadError(
          source,
          `Lecture canonique ${source} indisponible.`,
          { cause: error },
        );
      }
      return canonicalRecords(data ?? [], source);
    });
  }

  private assertAuthorizedCanonicalHouseholdScope(): Promise<void> {
    return this.cached("authorization:canonical-household-scope", async () => {
      const rows = await this.readRows(
        "scope:canonical-household-control",
        "household_scope",
        () =>
          this.client
            .from("canonical_household_scope_control")
            .select("household_count,household_id,status")
            .limit(2),
      );
      if (rows.length !== 1) {
        throw new CanonicalReadError(
          "household_scope",
          "Le scope canonique Household doit produire exactement une ligne.",
        );
      }
      let scopeHouseholdId: HouseholdId;
      try {
        scopeHouseholdId = parseCanonicalHouseholdScope(rows[0]);
      } catch (error) {
        throw new CanonicalReadError(
          "household_scope",
          "Le scope canonique Household n'est pas READY et univoque.",
          { cause: error },
        );
      }
      if (scopeHouseholdId !== this.context.householdId) {
        throw new CanonicalReadError(
          "household_scope",
          "Le scope canonique Household ne correspond pas au contexte autorisé.",
        );
      }
    });
  }

  async loadOperationsByBankRange(
    range: CanonicalDateRange,
  ): Promise<readonly CanonicalRecord[]> {
    await this.assertAuthorizedCanonicalHouseholdScope();
    return this.readRows(
      `operations:bank:${range.start}:${range.endExclusive}`,
      "operations",
      () =>
        this.client
          .from("operations")
          .select("*,montant_bancaire_exact:montant::text")
          .gte("date_bancaire", range.start)
          .lt("date_bancaire", range.endExclusive)
          .order("date_bancaire", { ascending: true })
          .order("operation_id", { ascending: true }),
    );
  }

  async loadLatestBankOperationMonth(): Promise<YearMonth | null> {
    await this.assertAuthorizedCanonicalHouseholdScope();
    const rows = await this.readRows("operations:latest-bank-month", "operations", () =>
      this.client
        .from("operations")
        .select("operation_id,date_bancaire")
        .order("date_bancaire", { ascending: false })
        .order("operation_id", { ascending: false })
        .limit(1),
    );
    const row = rows[0];
    return row === undefined
      ? null
      : yearMonthOf(parseLocalDate(canonicalString(row, ["date_bancaire"], "operations")));
  }

  async loadOperationsByIds(
    operationIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(operationIds);
    if (ids.length === 0) return [];
    await this.assertAuthorizedCanonicalHouseholdScope();
    return this.readRows(
      `operations:ids:${ids.join(",")}`,
      "operations",
      () =>
        this.client
          .from("operations")
          .select("*,montant_bancaire_exact:montant::text")
          .in("operation_id", ids)
          .order("operation_id", { ascending: true }),
    );
  }

  loadOperation(operationId: OperationId): Promise<CanonicalRecord | null> {
    return this.cached(`operation:${operationId}`, async () => {
      const rows = await this.loadOperationsByIds([operationId]);
      if (rows.length > 1) {
        throw new CanonicalReadError("operations", "OperationId n'est pas unique.");
      }
      return rows[0] ?? null;
    });
  }

  private loadEconomicComponentRowsByOperations(
    operationIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(operationIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(
      `economic:operations:${ids.join(",")}`,
      "economic",
      () =>
        this.client
          .from("financial_economic_cost_canonical")
          .select(
            "operation_id,cash_use_id,source_layer,component_id,canonical_economic_gross::text,refund_applied::text,canonical_economic_net::text,category_id,subcategory_id,moment_id,canonical_economic_amount::text,canonical_component_key,source_kind",
          )
          .in("operation_id", ids)
          .order("canonical_component_key", { ascending: true }),
    );
  }

  private loadEconomicComponentRowsByKeys(
    componentKeys: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const keys = unique(componentKeys);
    if (keys.length === 0) return Promise.resolve([]);
    return this.readRows(
      `economic:keys:${keys.join(",")}`,
      "economic",
      () =>
        this.client
          .from("financial_economic_cost_canonical")
          .select(
            "operation_id,cash_use_id,source_layer,component_id,canonical_economic_gross::text,refund_applied::text,canonical_economic_net::text,category_id,subcategory_id,moment_id,canonical_economic_amount::text,canonical_component_key,source_kind",
          )
          .in("canonical_component_key", keys)
          .order("canonical_component_key", { ascending: true }),
    );
  }

  private loadTimingRowsForRange(
    range: CanonicalDateRange,
  ): Promise<readonly CanonicalRecord[]> {
    return this.readRows(
      `timing:range:${range.start}:${range.endExclusive}`,
      "timing",
      () =>
        this.client
          .from("financial_economic_timing_canonical")
          .select(
            "household_id,canonical_component_key,economic_segment_id,timing_state,period_start,period_end,economic_month,economic_amount::text,attribution_method,method_version",
          )
          .eq("household_id", this.context.householdId)
          .gte("economic_month", range.start)
          .lt("economic_month", range.endExclusive)
          .order("canonical_component_key", { ascending: true })
          .order("economic_segment_id", { ascending: true }),
    );
  }

  private loadTimingRowsByKeys(
    componentKeys: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const keys = unique(componentKeys);
    if (keys.length === 0) return Promise.resolve([]);
    return this.readRows(
      `timing:keys:${keys.join(",")}`,
      "timing",
      () =>
        this.client
          .from("financial_economic_timing_canonical")
          .select(
            "household_id,canonical_component_key,economic_segment_id,timing_state,period_start,period_end,economic_month,economic_amount::text,attribution_method,method_version",
          )
          .eq("household_id", this.context.householdId)
          .in("canonical_component_key", keys)
          .order("canonical_component_key", { ascending: true })
          .order("economic_segment_id", { ascending: true }),
    );
  }

  private async projectEconomicComponentRows(
    components: readonly CanonicalRecord[],
  ): Promise<readonly EconomicComponentFact[]> {
    const componentKeys = components.map((row) =>
      canonicalString(row, ["canonical_component_key"], "economic"),
    );
    const operationIds = unique(
      components.map((row) => canonicalString(row, ["operation_id"], "economic")),
    );
    if (componentKeys.length === 0) return [];

    const [operations, places, timingRows, timingControls, reconciliations] =
      await Promise.all([
        this.loadOperationsByIds(operationIds),
        this.readRows(`places:keys:${componentKeys.join(",")}`, "places", () =>
          this.client
            .from("operation_place_canonical")
            .select("canonical_component_key,operation_id,place_id,resolution_state")
            .in("canonical_component_key", componentKeys)
            .order("canonical_component_key", { ascending: true })),
        this.loadTimingRowsByKeys(componentKeys),
        this.readRows(`timing-controls:${componentKeys.join(",")}`, "timing", () =>
          this.client
            .from("financial_economic_timing_control")
            .select("canonical_component_key,canonical_economic_net::text,segment_count,known_count,partial_count,unknown_count,household_count,household_mismatch_count,segment_amount_sum::text,amount_delta::text,status")
            .in("canonical_component_key", componentKeys)
            .order("canonical_component_key", { ascending: true })),
        this.readRows(`reconciliation:${operationIds.join(",")}`, "economic", () =>
          this.client
            .from("financial_canonical_reconciliation_control")
            .select("operation_id,economic_gross_delta::text,economic_refund_resolution,economic_status")
            .in("operation_id", operationIds)
            .order("operation_id", { ascending: true })),
      ]);

    const operationById = byUniqueKey(operations, "operation_id", "operations");
    const placeByKey = byUniqueKey(places, "canonical_component_key", "places");
    const timingByKey = groupBy(timingRows, "canonical_component_key");
    const timingControlByKey = byUniqueKey(timingControls, "canonical_component_key", "timing");
    const reconciliationByOperation = byUniqueKey(reconciliations, "operation_id", "economic");

    return dedupeEconomicComponents(components.map((component) => {
      const componentKey = canonicalString(component, ["canonical_component_key"], "economic");
      const operationId = canonicalString(component, ["operation_id"], "economic");
      const operation = operationById.get(operationId);
      const place = placeByKey.get(componentKey);
      const timingControl = timingControlByKey.get(componentKey);
      const reconciliation = reconciliationByOperation.get(operationId);
      if (operation === undefined || place === undefined || timingControl === undefined || reconciliation === undefined) {
        throw new CanonicalReadError("economic", "Une dépendance canonique du composant économique est absente.");
      }
      return projectEconomicComponentFact({
        household: this.household,
        economicComponent: component,
        operation: {
          operation_id: operation.operation_id,
          date_bancaire: operation.date_bancaire,
          merchant_id: operation.merchant_id,
          importance: operation.importance,
          nature_fixe_variable: operation.nature_fixe_variable,
          contexte_vie: operation.contexte_vie,
        },
        place,
        timingRows: timingByKey.get(componentKey) ?? [],
        timingControl,
        reconciliationControl: reconciliation,
      });
    }));
  }

  loadEconomicFactsByComponentKeys(
    componentKeys: readonly string[],
  ): Promise<readonly EconomicComponentFact[]> {
    const keys = unique(componentKeys);
    if (keys.length === 0) return Promise.resolve([]);
    return this.cached(`facts:economic:keys:${keys.join(",")}`, async () =>
      this.projectEconomicComponentRows(await this.loadEconomicComponentRowsByKeys(keys)));
  }

  async loadEconomicFacts(
    range: CanonicalDateRange,
  ): Promise<readonly EconomicComponentFact[]> {
    return this.cached(`facts:economic:${range.start}:${range.endExclusive}`, async () => {
      const [bankOperations, rangeTiming] = await Promise.all([
        this.loadOperationsByBankRange(range),
        this.loadTimingRowsForRange(range),
      ]);
      const bankOperationIds = bankOperations.map((row) =>
        canonicalString(row, ["operation_id"], "operations"),
      );
      const rangeComponentKeys = rangeTiming.map((row) =>
        canonicalString(row, ["canonical_component_key"], "timing"),
      );
      const [byOperation, byTiming] = await Promise.all([
        this.loadEconomicComponentRowsByOperations(bankOperationIds),
        this.loadEconomicComponentRowsByKeys(rangeComponentKeys),
      ]);
      const components = mergeRows(
        byOperation,
        byTiming,
        "canonical_component_key",
        "economic",
      );
      return this.projectEconomicComponentRows(components);
    });
  }

  loadActivityCausalFinancialLinkRows(
    lifeEventIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(lifeEventIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(`financial-links:events:${ids.join(",")}`, "financial_links", () =>
      this.client
        .from("life_event_financial_links")
        .select("financial_link_id,life_event_id,source_kind,operation_id,allocation_id,item_id,cash_use_id,relation_type,economic_amount_linked::text,validation_status")
        .in("life_event_id", ids)
        .eq("validation_status", "Confirmé")
        .in("relation_type", ["Paiement_activite", "Cause_par_evenement", "Preparation"])
        .order("life_event_id", { ascending: true })
        .order("financial_link_id", { ascending: true }));
  }

  async loadPersonDays(
    range: CanonicalDateRange,
  ): Promise<readonly PersonDayFact[]> {
    return this.cached(`facts:person-days:${range.start}:${range.endExclusive}`, async () => {
      if (this.context.personIds.length === 0) return [];
      const rows = await this.readRows(
        `person-days:${range.start}:${range.endExclusive}`,
        "person_days",
        () =>
          this.client
            .from("person_days")
            .select("person_day_id,person_id,date,couverture_localisation")
            .in("person_id", this.context.personIds)
            .gte("date", range.start)
            .lt("date", range.endExclusive)
            .order("date", { ascending: true })
            .order("person_id", { ascending: true }),
      );
      const personById = new Map(
        this.context.persons.map((person) => [
          person.personId,
          { person_id: person.personId, household_id: person.householdId },
        ]),
      );
      return dedupePersonDays(
        rows.map((personDay) => {
          const personId = canonicalString(personDay, ["person_id"], "person_days") as PersonId;
          const person = personById.get(personId);
          if (person === undefined) {
            throw new CanonicalReadError(
              "person_days",
              "Person_day vise une personne hors du Household autorisé.",
            );
          }
          return projectPersonDayFact({
            household: this.household,
            personDay,
            person,
          });
        }),
      );
    });
  }

  async loadPlaceVisits(
    range: CanonicalDateRange,
  ): Promise<readonly PlaceVisitFact[]> {
    return this.cached(`facts:place-visits:${range.start}:${range.endExclusive}`, async () => {
      const personDays = await this.loadPersonDays(range);
      if (personDays.length === 0) return [];
      const personDayIds = personDays.map(({ personDayId }) => personDayId);
      const occurrences = await this.readRows(
        `location-occurrences:${personDayIds.join(",")}`,
        "places",
        () =>
          this.client
            .from("location_occurrences")
            .select(
              "localization_id,person_day_id,person_id,place_id,start_at,end_at,time_precision,sequence_index,occurrence_type",
            )
            .in("person_day_id", personDayIds)
            .eq("occurrence_type", "Présence")
            .order("person_day_id", { ascending: true })
            .order("sequence_index", { ascending: true }),
      );
      const dayById = new Map(personDays.map((day) => [day.personDayId, day]));
      const personById = new Map(
        this.context.persons.map((person) => [
          person.personId,
          { person_id: person.personId, household_id: person.householdId },
        ]),
      );
      return dedupePlaceVisits(
        occurrences.map((occurrence) => {
          const personDayId = canonicalString(
            occurrence,
            ["person_day_id"],
            "places",
          );
          const personId = canonicalString(occurrence, ["person_id"], "places") as PersonId;
          const day = dayById.get(personDayId as PersonDayFact["personDayId"]);
          const person = personById.get(personId);
          if (day === undefined || person === undefined) {
            throw new CanonicalReadError(
              "places",
              "Location_occurrence vise un Person_day hors scope autorisé.",
            );
          }
          return projectPlaceVisitFact({
            household: this.household,
            locationOccurrence: occurrence,
            personDay: {
              person_day_id: day.personDayId,
              person_id: day.personId,
              date: day.localDate,
              couverture_localisation:
                day.locationObservability === "observable"
                  ? "Complète"
                  : day.locationObservability === "partial"
                    ? "Partielle"
                    : "Absente",
            },
            person,
          });
        }),
      );
    });
  }

  async loadActivityOccurrences(
    range: CanonicalDateRange,
  ): Promise<readonly ActivityOccurrenceFact[]> {
    return this.cached(`facts:activities:${range.start}:${range.endExclusive}`, async () => {
      await this.assertAuthorizedCanonicalHouseholdScope();
      const lifeEvents = await this.readRows(
        `life-events:${range.start}:${range.endExclusive}`,
        "life_events",
        () =>
          this.client
            .from("life_events")
            .select(
              "life_event_id,life_event_type_id,life_event_series_id,parent_life_event_id,start_date,end_date,validation_status",
            )
            .lte("start_date", addDays(range.endExclusive, -1))
            .gte("end_date", range.start)
            .order("start_date", { ascending: true })
            .order("life_event_id", { ascending: true }),
      );
      if (lifeEvents.length === 0) return [];
      const eventIds = lifeEvents.map((row) =>
        canonicalString(row, ["life_event_id"], "life_events"),
      );
      const typeIds = unique(
        lifeEvents.map((row) =>
          canonicalString(row, ["life_event_type_id"], "life_events"),
        ),
      );
      const [eventTypes, participations] = await Promise.all([
        this.readRows(`life-event-types:${typeIds.join(",")}`, "life_events", () =>
          this.client
            .from("life_event_types")
            .select("life_event_type_id,type_key,label,can_span_days,active")
            .in("life_event_type_id", typeIds)
            .order("life_event_type_id", { ascending: true }),
        ),
        this.readRows(`life-event-participations:${eventIds.join(",")}`, "life_events", () =>
          this.client
            .from("life_event_participations")
            .select("life_event_id,person_day_id,person_id,participation_status")
            .in("life_event_id", eventIds)
            .order("life_event_id", { ascending: true })
            .order("person_id", { ascending: true }),
        ),
      ]);
      const typeById = byUniqueKey(eventTypes, "life_event_type_id", "life_events");
      const participationsByEvent = groupBy(participations, "life_event_id");
      return dedupeActivityOccurrences(
        lifeEvents.flatMap((lifeEvent) => {
          const typeId = canonicalString(
            lifeEvent,
            ["life_event_type_id"],
            "life_events",
          );
          const eventId = canonicalString(lifeEvent, ["life_event_id"], "life_events");
          const lifeEventType = typeById.get(typeId);
          if (lifeEventType === undefined) {
            throw new CanonicalReadError("life_events", "Life_event_type est absent.");
          }
          const fact = projectActivityOccurrenceFact({
            household: this.household,
            lifeEvent,
            lifeEventType,
            participations: participationsByEvent.get(eventId) ?? [],
          });
          return fact === null ? [] : [fact];
        }),
      );
    });
  }

  async loadPurchaseEvents(): Promise<readonly PurchaseEventFact[]> {
    return this.cached("facts:purchase-events", async () => {
      const events = await this.readRows("purchase-events", "purchase_events", () =>
        this.client
          .from("purchase_events")
          .select("purchase_event_id,household_id")
          .eq("household_id", this.context.householdId)
          .order("purchase_event_id", { ascending: true }),
      );
      if (events.length === 0) return [];
      const ids = events.map((row) =>
        canonicalString(row, ["purchase_event_id"], "purchase_events"),
      );
      const sources = await this.readRows(
        `purchase-event-sources:${ids.join(",")}`,
        "purchase_events",
        () =>
          this.client
            .from("purchase_event_sources")
            .select("purchase_event_id,operation_id,cash_use_id")
            .in("purchase_event_id", ids)
            .order("purchase_event_id", { ascending: true }),
      );
      const sourcesByEvent = groupBy(sources, "purchase_event_id");
      return dedupePurchaseEvents(
        events.map((event) => {
          const id = canonicalString(event, ["purchase_event_id"], "purchase_events");
          return projectPurchaseEventFact({
            household: this.household,
            purchaseEvent: event,
            sources: sourcesByEvent.get(id) ?? [],
          });
        }),
      );
    });
  }

  private async probeCanonicalSource(
    source: CanonicalHealthSourceName,
    probe: () => Promise<void>,
  ): Promise<CanonicalSourceHealthStatus> {
    try {
      await probe();
      return "AVAILABLE";
    } catch (error) {
      if (
        source === "purchase_events" &&
        error instanceof CanonicalMissingMigrationError
      ) {
        return "MISSING_MIGRATION";
      }
      if (error instanceof CanonicalReadError) {
        return "UNAVAILABLE";
      }
      throw error;
    }
  }

  purchaseEventSourceHealth(): Promise<CanonicalSourceHealthStatus> {
    return this.cached("health-status:purchase-events", () =>
      this.probeCanonicalSource("purchase_events", async () => {
        await this.readRows("health:purchase-events", "purchase_events", () =>
          this.client
            .from("purchase_events")
            .select("purchase_event_id")
            .eq("household_id", this.context.householdId)
            .limit(1));
        await this.readRows(
          "health:purchase-event-sources",
          "purchase_events",
          () =>
            this.client
              .from("purchase_event_sources")
              .select("purchase_event_id")
              .limit(1),
        );
      }),
    );
  }

  sourceHealth(): Promise<CanonicalSourceHealth> {
    return this.cached("health-status:all", async () => {
      const [
        operations,
        economic,
        timing,
        places,
        personDays,
        lifeEvents,
        financialLinks,
        entities,
        purchaseEvents,
      ] = await Promise.all([
        this.probeCanonicalSource("operations", async () => {
          await this.assertAuthorizedCanonicalHouseholdScope();
          await this.readRows("health:operations", "operations", () =>
            this.client
              .from("operations")
              .select("operation_id")
              .limit(1));
        }),
        this.probeCanonicalSource("economic", async () => {
          await Promise.all([
            this.readRows("health:economic-cost", "economic", () =>
              this.client
                .from("financial_economic_cost_canonical")
                .select("canonical_component_key")
                .limit(1)),
            this.readRows("health:economic-reconciliation", "economic", () =>
              this.client
                .from("financial_canonical_reconciliation_control")
                .select("operation_id")
                .limit(1)),
          ]);
        }),
        this.probeCanonicalSource("timing", async () => {
          await Promise.all([
            this.readRows("health:timing", "timing", () =>
              this.client
                .from("financial_economic_timing_canonical")
                .select("economic_segment_id")
                .eq("household_id", this.context.householdId)
                .limit(1)),
            this.readRows("health:timing-control", "timing", () =>
              this.client
                .from("financial_economic_timing_control")
                .select("canonical_component_key")
                .limit(1)),
          ]);
        }),
        this.probeCanonicalSource("places", async () => {
          await Promise.all([
            this.readRows("health:operation-places", "places", () =>
              this.client
                .from("operation_place_canonical")
                .select("canonical_component_key")
                .limit(1)),
            this.readRows("health:location-occurrences", "places", () =>
              this.client
                .from("location_occurrences")
                .select("localization_id")
                .limit(1)),
          ]);
        }),
        this.probeCanonicalSource("person_days", async () => {
          await this.readRows("health:person-days", "person_days", () => {
            const query = this.client
              .from("person_days")
              .select("person_day_id");
            return this.context.personIds.length === 0
              ? query.limit(1)
              : query.in("person_id", this.context.personIds).limit(1);
          });
        }),
        this.probeCanonicalSource("life_events", async () => {
          await this.assertAuthorizedCanonicalHouseholdScope();
          await Promise.all([
            this.readRows("health:life-events", "life_events", () =>
              this.client
                .from("life_events")
                .select("life_event_id")
                .limit(1)),
            this.readRows("health:life-event-types", "life_events", () =>
              this.client
                .from("life_event_types")
                .select("life_event_type_id")
                .limit(1)),
            this.readRows("health:life-event-participations", "life_events", () =>
              this.client
                .from("life_event_participations")
                .select("life_event_id")
                .limit(1)),
          ]);
        }),
        this.probeCanonicalSource("financial_links", async () => {
          await this.readRows("health:financial-links", "financial_links", () =>
            this.client
              .from("life_event_financial_links")
              .select("financial_link_id")
              .limit(1));
        }),
        this.probeCanonicalSource("entities", async () => {
          await this.assertAuthorizedCanonicalHouseholdScope();
          await Promise.all([
            this.readRows("health:entities:places", "entities", () =>
              this.client
                .from("referentiel_lieu")
                .select("place_id")
                .limit(1)),
            this.readRows("health:entities:merchants", "entities", () =>
              this.client
                .from("merchants")
                .select("merchant_id")
                .limit(1)),
            this.readRows("health:entities:moments", "entities", () =>
              this.client
                .from("moments")
                .select("moment_id")
                .eq("household_id", this.context.householdId)
                .limit(1)),
          ]);
        }),
        this.purchaseEventSourceHealth(),
      ]);
      return {
        economic,
        timing,
        places,
        person_days: personDays,
        life_events: lifeEvents,
        purchase_events: purchaseEvents,
        financial_links: financialLinks,
        operations,
        entities,
      };
    });
  }

  async loadOperationBundle(
    range: CanonicalDateRange,
  ): Promise<CanonicalOperationBundle> {
    return this.cached(`operation-bundle:${range.start}:${range.endExclusive}`, async () => {
      const operations = await this.loadOperationsByBankRange(range);
      const operationIds = operations.map((row) =>
        canonicalString(row, ["operation_id"], "operations"),
      );
      const [economicFacts, allocations, items, paymentComponents, cashUses] =
        await Promise.all([
          this.loadEconomicFacts(range),
          this.loadComposition("operation_allocations", operationIds),
          this.loadComposition("operation_items", operationIds),
          this.loadComposition("payment_components", operationIds),
          this.loadComposition("cash_economic_uses", operationIds),
        ]);
      return {
        operations,
        economicFacts,
        allocations,
        items,
        paymentComponents,
        cashUses,
      };
    });
  }

  private loadComposition(
    table: CompositionTable,
    operationIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(operationIds);
    if (ids.length === 0) return Promise.resolve([]);
    const mapping = compositionMappings[table];
    const operationIdSelection = mapping.operationIdSelection === null
      ? ""
      : `,${mapping.operationIdSelection}`;
    return this.readRows(`composition:${table}:${ids.join(",")}`, "operations", () =>
      this.client
        .from(table)
        .select(
          `*${operationIdSelection},composition_amount_exact:${mapping.moneyColumn}::text`,
        )
        .in(mapping.foreignOperationKey, ids)
        .order(mapping.foreignOperationKey, { ascending: true })
        .order(mapping.stableId, { ascending: true }),
    );
  }

  async loadEntityRows(
    table: EntityTable,
    idColumn: "place_id" | "merchant_id" | "moment_id",
    ids?: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const normalizedIds = ids === undefined ? undefined : unique(ids);
    if (normalizedIds?.length === 0) return [];
    const mapping = entityMappings[table];
    if (idColumn !== mapping.idColumn) {
      throw new CanonicalReadError(
        "entities",
        `Le mapping logique ${table}.${idColumn} est invalide.`,
      );
    }
    if (table !== "moments") {
      await this.assertAuthorizedCanonicalHouseholdScope();
    }
    return this.readRows(
      `entities:${table}:${normalizedIds?.join(",") ?? "all"}`,
      "entities",
      () => {
        let query = this.client
          .from(mapping.physicalTable)
          .select("*");
        if (table === "moments") {
          query = query.eq("household_id", this.context.householdId);
        }
        if (normalizedIds !== undefined) query = query.in(idColumn, normalizedIds);
        return query.order(idColumn, { ascending: true });
      },
    );
  }

  async loadTaxonomyRows(
    table: TaxonomyTable,
    ids: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const normalizedIds = unique(ids);
    if (normalizedIds.length === 0) return [];
    await this.assertAuthorizedCanonicalHouseholdScope();
    return this.readRows(`taxonomy:${table}:${normalizedIds.join(",")}`, "entities", () =>
      this.client
        .from(table)
        .select("*")
        .in("id", normalizedIds)
        .order("id", { ascending: true }));
  }

  loadLifeEventTypeRowsByIds(
    ids: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const normalizedIds = unique(ids);
    if (normalizedIds.length === 0) return Promise.resolve([]);
    return this.readRows(`life-event-types:ids:${normalizedIds.join(",")}`, "life_events", () =>
      this.client
        .from("life_event_types")
        .select("life_event_type_id,type_key,label,can_span_days,active")
        .in("life_event_type_id", normalizedIds)
        .order("life_event_type_id", { ascending: true }));
  }

  loadLifeEventTypeRowsByTypeKeys(
    typeKeys: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const keys = unique(typeKeys);
    if (keys.length === 0) return Promise.resolve([]);
    return this.readRows(`life-event-types:keys:${keys.join(",")}`, "life_events", () =>
      this.client
        .from("life_event_types")
        .select("life_event_type_id,type_key,label,can_span_days,active")
        .in("type_key", keys)
        .order("type_key", { ascending: true }));
  }

  loadLifeEventParticipationRows(
    lifeEventIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(lifeEventIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(`life-event-participations:entities:${ids.join(",")}`, "life_events", () =>
      this.client
        .from("life_event_participations")
        .select("life_event_id,person_day_id,person_id,participation_status")
        .in("life_event_id", ids)
        .order("life_event_id", { ascending: true })
        .order("person_id", { ascending: true }));
  }

  loadMomentLifeEventRowsByMomentIds(
    momentIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(momentIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(`moment-life-events:moments:${ids.join(",")}`, "life_events", () =>
      this.client
        .from("moment_life_events")
        .select("moment_id,life_event_id")
        .in("moment_id", ids)
        .order("moment_id", { ascending: true })
        .order("life_event_id", { ascending: true }));
  }

  loadMomentLifeEventRowsByLifeEventIds(
    lifeEventIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(lifeEventIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(`moment-life-events:events:${ids.join(",")}`, "life_events", () =>
      this.client
        .from("moment_life_events")
        .select("moment_id,life_event_id")
        .in("life_event_id", ids)
        .order("life_event_id", { ascending: true })
        .order("moment_id", { ascending: true }));
  }

  loadFinancialLinkRowsByOperationIds(
    operationIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(operationIds);
    if (ids.length === 0) return Promise.resolve([]);
    return this.readRows(`financial-links:operations:${ids.join(",")}`, "financial_links", () =>
      this.client
        .from("life_event_financial_links")
        .select("financial_link_id,life_event_id,operation_id,relation_type,validation_status")
        .in("operation_id", ids)
        .in("validation_status", ["Confirmé", "Déduit"])
        .order("operation_id", { ascending: true })
        .order("financial_link_id", { ascending: true }));
  }

  async loadLifeEventRecords(
    lifeEventIds: readonly string[],
  ): Promise<readonly CanonicalRecord[]> {
    const ids = unique(lifeEventIds);
    if (ids.length === 0) return [];
    await this.assertAuthorizedCanonicalHouseholdScope();
    return this.readRows(`life-event-records:${ids.join(",")}`, "life_events", () =>
      this.client
        .from("life_events")
        .select("*")
        .in("life_event_id", ids)
        .order("life_event_id", { ascending: true }));
  }

  async loadLifeEventRecord(lifeEventId: string): Promise<CanonicalRecord | null> {
    await this.assertAuthorizedCanonicalHouseholdScope();
    const rows = await this.readRows(`life-event-record:${lifeEventId}`, "life_events", () =>
      this.client
        .from("life_events")
        .select("*")
        .eq("life_event_id", lifeEventId)
        .limit(2),
    );
    if (rows.length > 1) {
      throw new CanonicalReadError("life_events", "LifeEventId n'est pas unique.");
    }
    return rows[0] ?? null;
  }

  async loadEntityRow(
    table: EntityTable,
    idColumn: "place_id" | "merchant_id" | "moment_id",
    id: string,
  ): Promise<CanonicalRecord | null> {
    const rows = await this.loadEntityRows(table, idColumn, [id]);
    if (rows.length > 1) {
      throw new CanonicalReadError("entities", `${idColumn} n'est pas unique.`);
    }
    return rows[0] ?? null;
  }

  authorizedPerson(personId: PersonId): CanonicalRecord | null {
    const person = this.context.persons.find((candidate) => candidate.personId === personId);
    return person === undefined
      ? null
      : canonicalRecord(
          {
            person_id: person.personId,
            household_id: person.householdId,
            display_name: person.displayName,
            status: person.status,
          },
          "entities",
        );
  }

  householdId(): HouseholdId {
    return this.context.householdId;
  }
}
