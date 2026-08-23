import "server-only";

import type { EconomicComponentFact } from "@/analytics/facts";
import { MetricProductionContractError } from "@/analytics/production";
import type {
  MerchantId,
  MomentId,
  OperationId,
  PersonId,
  PlaceId,
} from "@/core/identity";
import { parseMoney, type Money } from "@/core/money";
import { parseLocalDate, yearMonthOf } from "@/core/time";
import type {
  EntityMerchantReadModel,
  EntityOperationReadModel,
  EntityPersonaReadModel,
  EntityPlaceReadModel,
  PersonaTarget,
  ScopedCountMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "@/query-api";
import {
  QueryNotFoundError,
  QueryTemporaryUnavailableError,
  type QueryReadModelSources,
} from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import {
  canonicalMoney,
  canonicalString,
  optionalCanonicalString,
  type CanonicalRecord,
} from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";
import {
  buildOperationRow,
  operationEconomicTruth,
} from "./operations";
import {
  monthRange,
  operationFromCanonicalRow,
  scopeRange,
} from "./shared";

type EntityDependencies = {
  readonly context: AuthorizedRuntimeContext;
  readonly repository: CanonicalRepository;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
};

function entityLabel(row: CanonicalRecord, fallbackId: string): string {
  return (
    optionalCanonicalString(row, [
      "display_name",
      "title",
      "name",
      "label",
      "nom",
      "titre",
    ]) ?? fallbackId
  );
}

function stringArray(record: CanonicalRecord, keys: readonly string[]): readonly string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return [...new Set(value)].sort() as string[];
    }
  }
  return [];
}

function preview<T>(items: readonly T[], limit = 6) {
  return {
    items: items.slice(0, limit),
    hasMore: items.length > limit,
    totalCount: items.length,
  };
}

function factsForOperation(
  facts: readonly EconomicComponentFact[],
  operationId: OperationId,
): readonly EconomicComponentFact[] {
  return facts.filter(
    ({ sourceOperation }) =>
      sourceOperation.kind === "resolved" && sourceOperation.id === operationId,
  );
}

function compositionEntry(
  row: CanonicalRecord,
  idKeys: readonly string[],
): EntityOperationReadModel["composition"]["allocations"][number] {
  const id = canonicalString(row, idKeys, "operations");
  const label = optionalCanonicalString(row, ["label", "libelle", "name", "nom"]);
  let amount: Money | undefined;
  for (const key of ["amount", "montant", "economic_amount", "allocated_amount"]) {
    if (row[key] === undefined || row[key] === null) continue;
    try {
      amount = canonicalMoney(row, [key], "operations");
    } catch {
      amount = undefined;
    }
    break;
  }
  return {
    id,
    ...(label === undefined ? {} : { label }),
    ...(amount === undefined ? {} : { amount }),
  };
}

function relationsFromFacts(facts: readonly EconomicComponentFact[]) {
  const merchantIds = [
    ...new Set(
      facts.flatMap(({ merchant }) =>
        merchant.kind === "resolved" ? [merchant.id] : [],
      ),
    ),
  ];
  const placeIds = [
    ...new Set(
      facts.flatMap(({ canonicalPlace }) =>
        canonicalPlace.kind === "resolved" ? [canonicalPlace.placeId] : [],
      ),
    ),
  ];
  const momentIds = [
    ...new Set(
      facts.flatMap(({ moment }) =>
        moment.kind === "resolved" ? [moment.id] : [],
      ),
    ),
  ];
  return {
    merchant:
      merchantIds.length === 1
        ? ({ state: "resolved", id: merchantIds[0] } as const)
        : merchantIds.length > 1
          ? ({ state: "conflict" } as const)
          : ({ state: "unknown" } as const),
    place:
      placeIds.length === 1
        ? ({ state: "resolved", id: placeIds[0] } as const)
        : placeIds.length > 1
          ? ({ state: "conflict" } as const)
          : ({ state: "unknown" } as const),
    moments: momentIds,
  };
}

async function operationEntity(input: {
  readonly operationId: OperationId;
  readonly capabilities: EntityOperationReadModel["capabilities"];
  readonly dependencies: EntityDependencies;
}): Promise<EntityOperationReadModel> {
  const raw = await input.dependencies.repository.loadOperation(input.operationId);
  if (raw === null) throw new QueryNotFoundError();
  const operation = operationFromCanonicalRow(raw);
  const range = monthRange(yearMonthOf(operation.bankDate));
  const bundle = await input.dependencies.repository.loadOperationBundle(range);
  const facts = factsForOperation(bundle.economicFacts, input.operationId);
  const row = buildOperationRow(operation, facts);
  const relations = relationsFromFacts(facts);
  const selectComposition = (values: readonly CanonicalRecord[]) =>
    values.filter(
      (value) =>
        optionalCanonicalString(value, ["operation_id"]) === input.operationId,
    );
  const allocations = selectComposition(bundle.allocations);
  const items = selectComposition(bundle.items);
  const paymentComponents = selectComposition(bundle.paymentComponents);
  const cashUses = selectComposition(bundle.cashUses);
  const evidence = [
    ...facts.map((fact) => ({
      sourceType: fact.canonicalComponentKey.split(":", 1)[0],
      sourceId: fact.canonicalComponentKey.split(":").slice(1).join(":"),
    })),
    ...allocations.map((item) => ({
      sourceType: "operation_allocation",
      sourceId: canonicalString(item, ["allocation_id"], "operations"),
    })),
    ...items.map((item) => ({
      sourceType: "operation_item",
      sourceId: canonicalString(item, ["item_id"], "operations"),
    })),
    ...paymentComponents.map((item) => ({
      sourceType: "payment_component",
      sourceId: canonicalString(item, ["payment_component_id"], "operations"),
    })),
    ...cashUses.map((item) => ({
      sourceType: "cash_economic_use",
      sourceId: canonicalString(item, ["cash_use_id"], "operations"),
    })),
  ];
  return {
    id: input.operationId,
    identity: { title: row.merchant?.label ?? operation.label, subtitle: operation.label },
    bankTruth: {
      bankDate: operation.bankDate,
      label: operation.label,
      amount: operation.bankAmount,
      ...(operation.accountId === undefined ? {} : { accountRef: operation.accountId }),
    },
    economicTruth: operationEconomicTruth(facts),
    classification: {
      category:
        row.category === undefined
          ? { state: "undetermined" }
          : {
              state: "resolved",
              categoryId: row.category.id,
              ...(row.subcategory === undefined
                ? {}
                : { subcategoryId: row.subcategory.id }),
            },
      ...(operation.necessity === undefined ? {} : { necessity: operation.necessity }),
      ...(operation.fixedVariable === undefined ? {} : { behavior: operation.fixedVariable }),
      ...(operation.lifeScope === undefined ? {} : { lifeScope: operation.lifeScope }),
    },
    links: {
      merchant: relations.merchant,
      place: relations.place,
      lifeEvents: [],
      moments: relations.moments,
    },
    composition: {
      allocations: allocations.map((item) => compositionEntry(item, ["allocation_id"])),
      items: items.map((item) => compositionEntry(item, ["item_id"])),
      paymentComponents: paymentComponents.map((item) =>
        compositionEntry(item, ["payment_component_id"]),
      ),
      cashUses: cashUses.map((item) => compositionEntry(item, ["cash_use_id"])),
    },
    traceability: {
      canonicalComponentKeys: facts.map(({ canonicalComponentKey }) =>
        canonicalComponentKey,
      ),
      dataState: row.quality === "complete" ? "known" : row.quality,
      evidence,
    },
    capabilities: input.capabilities,
  };
}

function coordinates(row: CanonicalRecord) {
  const latitude = row.latitude;
  const longitude = row.longitude;
  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : undefined;
}

async function placeEntity(input: {
  readonly placeId: PlaceId;
  readonly scope: Parameters<MetricQueryService["produce"]>[1];
  readonly capabilities: EntityPlaceReadModel["capabilities"];
  readonly dependencies: EntityDependencies;
}): Promise<EntityPlaceReadModel> {
  const place = await input.dependencies.repository.loadEntityRow(
    "places",
    "place_id",
    input.placeId,
  );
  if (place === null) throw new QueryNotFoundError();
  const scoped = {
    ...input.scope,
    filters: { ...input.scope.filters, placeIds: [input.placeId] },
  };
  const [visitCount, distinctVisitDays, localizedSpend, visits, economicFacts] =
    await Promise.all([
      input.dependencies.metrics.produce("place_visit_count", scoped),
      input.dependencies.metrics.produce("distinct_visit_days", scoped),
      input.dependencies.metrics.produce("localized_spend", scoped),
      input.dependencies.facts.loadPlaceVisits(scoped),
      input.dependencies.facts.loadEconomicFacts(scoped),
    ]);
  const placeVisits = visits.filter(({ placeId }) => placeId === input.placeId);
  const merchantIds = [
    ...new Set(
      economicFacts.flatMap((fact) =>
        fact.canonicalPlace.kind === "resolved" &&
        fact.canonicalPlace.placeId === input.placeId &&
        fact.merchant.kind === "resolved"
          ? [fact.merchant.id]
          : [],
      ),
    ),
  ];
  const geo = coordinates(place);
  return {
    id: input.placeId,
    identity: { title: entityLabel(place, input.placeId) },
    spatial: geo === undefined ? { state: "unknown" } : { state: "known", coordinates: geo },
    headline: {
      visitCount: visitCount as ScopedCountMetricReadModel,
      distinctVisitDays: distinctVisitDays as ScopedCountMetricReadModel,
      localizedSpend: localizedSpend as ScopedMoneyMetricReadModel,
    },
    activityPreview: preview([]),
    merchantPreview: preview(
      merchantIds.map((merchantId) => ({ merchantId, label: merchantId })),
    ),
    visitPreview: preview(
      placeVisits.map((visit) => ({
        visitKey: visit.visitKey,
        personId: visit.personId,
        localDate: visit.localDate,
        ...(visit.interval.kind === "known"
          ? { visitStart: visit.interval.startedAt, visitEnd: visit.interval.endedAt }
          : visit.interval.kind === "partial"
            ? {
                ...(visit.interval.startedAt === null
                  ? {}
                  : { visitStart: visit.interval.startedAt }),
                ...(visit.interval.endedAt === null
                  ? {}
                  : { visitEnd: visit.interval.endedAt }),
              }
            : {}),
        state: visit.interval.kind,
      })),
    ),
    capabilities: input.capabilities,
  };
}

async function merchantEntity(input: {
  readonly merchantId: MerchantId;
  readonly scope: Parameters<MetricQueryService["produce"]>[1];
  readonly capabilities: EntityMerchantReadModel["capabilities"];
  readonly dependencies: EntityDependencies;
}): Promise<EntityMerchantReadModel> {
  const merchant = await input.dependencies.repository.loadEntityRow(
    "merchants",
    "merchant_id",
    input.merchantId,
  );
  if (merchant === null) throw new QueryNotFoundError();
  const scoped = {
    ...input.scope,
    filters: { ...input.scope.filters, merchantIds: [input.merchantId] },
  };
  const [economicAmount, facts, operationRows] = await Promise.all([
    input.dependencies.metrics.produce("merchant_net_amount", scoped),
    input.dependencies.facts.loadEconomicFacts(scoped),
    input.dependencies.repository.loadOperationsByBankRange(scopeRange(input.scope)),
  ]);
  const merchantFacts = facts.filter(
    ({ merchant }) => merchant.kind === "resolved" && merchant.id === input.merchantId,
  );
  const placeIds = [
    ...new Set(
      merchantFacts.flatMap(({ canonicalPlace }) =>
        canonicalPlace.kind === "resolved" ? [canonicalPlace.placeId] : [],
      ),
    ),
  ];
  const operationIds = new Set(
    merchantFacts.flatMap(({ sourceOperation }) =>
      sourceOperation.kind === "resolved" ? [sourceOperation.id] : [],
    ),
  );
  const operations = operationRows
    .map(operationFromCanonicalRow)
    .filter(({ operationId }) => operationIds.has(operationId));
  const spatialMode = optionalCanonicalString(merchant, ["spatial_mode"]);
  const parsedSpatialMode = [
    "physical_single",
    "physical_multi",
    "online",
    "non_spatial",
    "unknown",
  ].includes(spatialMode ?? "")
    ? (spatialMode as EntityMerchantReadModel["spatialMode"])
    : placeIds.length > 1
      ? "physical_multi"
      : placeIds.length === 1
        ? "physical_single"
        : "unknown";
  return {
    id: input.merchantId,
    identity: { title: entityLabel(merchant, input.merchantId) },
    spatialMode: parsedSpatialMode,
    headline: { economicAmount: economicAmount as ScopedMoneyMetricReadModel },
    placePreview:
      parsedSpatialMode === "online" || parsedSpatialMode === "non_spatial"
        ? { state: "not_applicable", value: null }
        : {
            state: "available",
            value: preview(
              placeIds.map((placeId) => ({ placeId, label: placeId })),
            ),
            ...(merchantFacts.some(({ canonicalPlace }) =>
              canonicalPlace.kind !== "resolved")
              ? { coverage: { level: "partial" } as const }
              : {}),
          },
    operationPreview: preview(
      operations.map((operation) => ({
        operationId: operation.operationId,
        bankDate: operation.bankDate,
        label: operation.label,
      })),
    ),
    capabilities: input.capabilities,
  };
}

async function personaEntity(input: {
  readonly target: PersonaTarget;
  readonly scope: Parameters<MetricQueryService["produce"]>[1];
  readonly capabilities: EntityPersonaReadModel["capabilities"];
  readonly dependencies: EntityDependencies;
}): Promise<EntityPersonaReadModel> {
  const person = input.target.kind === "person"
    ? input.dependencies.repository.authorizedPerson(input.target.personId)
    : null;
  if (input.target.kind === "person" && person === null) throw new QueryNotFoundError();
  const subject = input.target.kind === "person"
    ? { kind: "person" as const, personId: input.target.personId }
    : { kind: "household" as const };
  const scoped = { ...input.scope, subject };
  const [economic, personDays, placeVisits, activities, economicFacts] =
    await Promise.all([
      input.dependencies.metrics.produce(
        "economic_consumption_net_attributable",
        scoped,
      ),
      input.dependencies.metrics.produce("person_day_count", scoped),
      input.dependencies.facts.loadPlaceVisits(scoped),
      input.dependencies.facts.loadActivityOccurrences(scoped),
      input.dependencies.facts.loadEconomicFacts(scoped),
    ]);
  const selectedVisits = input.target.kind === "person"
    ? (() => {
        const personId = input.target.personId;
        return placeVisits.filter((visit) => visit.personId === personId);
      })()
    : placeVisits;
  const selectedActivities = input.target.kind === "person"
    ? (() => {
        const personId = input.target.personId;
        return activities.filter(({ participantIds }) =>
          participantIds.includes(personId));
      })()
    : activities;
  const placeIds = [...new Set(selectedVisits.map(({ placeId }) => placeId))];
  const merchantIds = [
    ...new Set(
      economicFacts.flatMap(({ merchant }) =>
        merchant.kind === "resolved" ? [merchant.id] : [],
      ),
    ),
  ];
  const activityIds = [
    ...new Set(selectedActivities.map(({ activityId }) => activityId)),
  ];
  return {
    id: input.target.kind === "person" ? input.target.personId : "ensemble",
    identity: {
      title:
        input.target.kind === "person" && person !== null
          ? entityLabel(person, input.target.personId)
          : "Ensemble du foyer",
    },
    target: input.target,
    headlineMetrics: [economic, personDays],
    activityPreview: preview(
      activityIds.map((activityId) => ({ activityId, label: activityId })),
    ),
    placePreview: preview(
      placeIds.map((placeId) => ({ kind: "place" as const, id: placeId })),
    ),
    merchantPreview: preview(
      merchantIds.map((merchantId) => ({ kind: "merchant" as const, id: merchantId })),
    ),
    capabilities: input.capabilities,
  };
}

export function createEntityQuerySources(
  dependencies: EntityDependencies,
): Pick<
  QueryReadModelSources,
  | "readEntityPlace"
  | "readEntityMerchant"
  | "readEntityMoment"
  | "readEntityPersona"
  | "readEntityLifeEvent"
  | "readEntityOperation"
> {
  return {
    async readEntityOperation({ request, context }) {
      return operationEntity({
        operationId: request.params.operationId,
        capabilities: context.capabilities,
        dependencies,
      });
    },

    async readEntityPlace({ request, context }) {
      return placeEntity({
        placeId: request.params.placeId,
        scope: request.scope,
        capabilities: context.capabilities,
        dependencies,
      });
    },

    async readEntityMerchant({ request, context }) {
      return merchantEntity({
        merchantId: request.params.merchantId,
        scope: request.scope,
        capabilities: context.capabilities,
        dependencies,
      });
    },

    async readEntityPersona({ request, context }) {
      return personaEntity({
        target: request.params.target,
        scope: request.scope,
        capabilities: context.capabilities,
        dependencies,
      });
    },

    async readEntityMoment({ request, context }) {
      const moment = await dependencies.repository.loadEntityRow(
        "moments",
        "moment_id",
        request.params.momentId,
      );
      if (moment === null) throw new QueryNotFoundError();
      const participants = stringArray(moment, ["participant_ids", "person_ids"])
        .filter((id) => dependencies.context.personIds.includes(id as PersonId))
        .map((personId) => ({ personId: personId as PersonId }));
      const rawStartsOn = optionalCanonicalString(moment, ["start_date", "starts_on"]);
      const rawEndsOn = optionalCanonicalString(moment, ["end_date", "ends_on"]);
      const startsOn = rawStartsOn === undefined ? undefined : parseLocalDate(rawStartsOn);
      const endsOn = rawEndsOn === undefined ? undefined : parseLocalDate(rawEndsOn);
      const evidenceFacts = (await dependencies.facts.loadEconomicFacts(request.scope))
        .filter(({ moment: factMoment }) =>
          factMoment.kind === "resolved" && factMoment.id === request.params.momentId);
      const operationIds = [
        ...new Set(
          evidenceFacts.flatMap(({ sourceOperation }) =>
            sourceOperation.kind === "resolved" ? [sourceOperation.id] : [],
          ),
        ),
      ];
      return {
        id: request.params.momentId,
        identity: { title: entityLabel(moment, request.params.momentId) },
        ...(optionalCanonicalString(moment, ["narrative", "description"]) === undefined
          ? {}
          : { narrative: optionalCanonicalString(moment, ["narrative", "description"]) }),
        participants,
        timeline: {
          ...(startsOn === undefined ? {} : { startsOn }),
          ...(endsOn === undefined ? {} : { endsOn }),
        },
        headline: {},
        evidencePreview: preview(
          operationIds.map((operationId) => ({
            kind: "operation" as const,
            id: operationId,
          })),
        ),
        capabilities: context.capabilities,
      };
    },

    async readEntityLifeEvent({ request, context }) {
      const event = await dependencies.repository.loadLifeEventRecord(
        request.params.lifeEventId,
      );
      if (event === null) throw new QueryNotFoundError();
      const startsOn = parseLocalDate(
        canonicalString(event, ["start_date"], "life_events"),
      );
      const endsOn = parseLocalDate(
        canonicalString(event, ["end_date"], "life_events"),
      );
      const validationStatus = canonicalString(
        event,
        ["validation_status"],
        "life_events",
      );
      if (!["Confirmé", "Déduit", "À valider"].includes(validationStatus)) {
        throw new MetricProductionContractError(
          "Life Event validation_status ne respecte pas le contrat.",
        );
      }
      const activity = (await dependencies.facts.loadActivityOccurrences(request.scope))
        .find(({ lifeEventId }) => lifeEventId === request.params.lifeEventId);
      const participantIds = activity?.participantIds ??
        stringArray(event, ["participant_ids"]).map((id) => id as PersonId);
      return {
        id: request.params.lifeEventId,
        identity: { title: entityLabel(event, request.params.lifeEventId) },
        type:
          optionalCanonicalString(event, ["type_label", "type", "life_event_type_id"]) ??
          "Life Event",
        ...(activity === undefined ? {} : { activityId: activity.activityId }),
        startsOn,
        endsOn,
        validationStatus: validationStatus as "Confirmé" | "Déduit" | "À valider",
        participantIds,
        places: preview(
          stringArray(event, ["place_ids"]).map((id) => ({
            kind: "place" as const,
            id: id as PlaceId,
          })),
        ),
        relatedMoments: preview(
          stringArray(event, ["moment_ids"]).map((id) => ({
            kind: "moment" as const,
            id: id as MomentId,
          })),
        ),
        headline: {},
        capabilities: context.capabilities,
      };
    },
  };
}
