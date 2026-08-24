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
  loadOperationReferenceLabels,
  operationEconomicTruth,
} from "./operations";
import {
  canonicalHumanLabel,
  canonicalLabelMap,
  loadMomentParticipantsByMomentId,
} from "./canonical-relations";
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
      "nom_canonique",
      "display_name",
      "title",
      "name",
      "label",
      "nom",
      "titre",
    ]) ?? fallbackId
  );
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
  const amount: Money | undefined = row.composition_amount_exact === undefined ||
    row.composition_amount_exact === null
    ? undefined
    : canonicalMoney(row, ["composition_amount_exact"], "operations");
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
  const labels = await loadOperationReferenceLabels(
    input.dependencies.repository,
    [operation],
    facts,
  );
  const row = buildOperationRow(operation, facts, labels);
  const relations = relationsFromFacts(facts);
  const financialLinks = await input.dependencies.repository.loadFinancialLinkRowsByOperationIds([
    input.operationId,
  ]);
  const lifeEventIds = [...new Set(financialLinks.map((link) =>
    canonicalString(link, ["life_event_id"], "financial_links"),
  ))];
  const lifeEvents = await input.dependencies.repository.loadLifeEventRecords(lifeEventIds);
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
      ...(row.necessity === undefined ? {} : { necessity: row.necessity }),
      ...(operation.fixedVariable === undefined ? {} : { behavior: operation.fixedVariable }),
      ...(operation.lifeScope === undefined ? {} : { lifeScope: operation.lifeScope }),
    },
    links: {
      merchant: relations.merchant,
      place: relations.place,
      lifeEvents: lifeEvents.map((event) => {
        const id = canonicalString(event, ["life_event_id"], "life_events") as import("@/core/identity").LifeEventId;
        return { id, label: canonicalHumanLabel(event, id) };
      }),
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
  const coordinate = (value: unknown): number | undefined => {
    const parsed = typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const latitude = coordinate(row.latitude_canonique);
  const longitude = coordinate(row.longitude_canonique);
  return latitude !== undefined && longitude !== undefined
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
  const merchantLabels = canonicalLabelMap(
    await input.dependencies.repository.loadEntityRows(
      "merchants",
      "merchant_id",
      merchantIds,
    ),
    ["merchant_id", "id"],
  );
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
      merchantIds.map((merchantId) => ({ merchantId, label: merchantLabels.get(merchantId) ?? merchantId })),
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
  const placeLabels = canonicalLabelMap(
    await input.dependencies.repository.loadEntityRows("places", "place_id", placeIds),
    ["place_id", "id"],
  );
  const spatialMode = optionalCanonicalString(merchant, ["location_behavior"]);
  const parsedSpatialMode = [
    "physical_single",
    "physical_multi",
    "non_spatial",
    "intermediary",
    "mixed",
    "unknown",
  ].includes(spatialMode ?? "")
    ? (spatialMode as EntityMerchantReadModel["spatialMode"])
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
              placeIds.map((placeId) => ({ placeId, label: placeLabels.get(placeId) ?? placeId })),
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
  const merchantLabels = canonicalLabelMap(
    await input.dependencies.repository.loadEntityRows("merchants", "merchant_id", merchantIds),
    ["merchant_id", "id"],
  );
  const activityLabels = canonicalLabelMap(
    await input.dependencies.repository.loadLifeEventTypeRowsByTypeKeys(activityIds),
    ["type_key"],
  );
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
      activityIds.map((activityId) => ({ activityId, label: activityLabels.get(activityId) ?? activityId })),
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
      const participants = (await loadMomentParticipantsByMomentId({
        repository: dependencies.repository,
        context: dependencies.context,
        momentIds: [request.params.momentId],
      })).get(request.params.momentId) ?? [];
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
      const typeId = canonicalString(event, ["life_event_type_id"], "life_events");
      const primaryPlaceId = optionalCanonicalString(event, ["primary_place_id"]);
      const [typeRows, participationRows, momentLinks, placeRows] = await Promise.all([
        dependencies.repository.loadLifeEventTypeRowsByIds([typeId]),
        dependencies.repository.loadLifeEventParticipationRows([request.params.lifeEventId]),
        dependencies.repository.loadMomentLifeEventRowsByLifeEventIds([request.params.lifeEventId]),
        primaryPlaceId === undefined
          ? Promise.resolve([])
          : dependencies.repository.loadEntityRows("places", "place_id", [primaryPlaceId]),
      ]);
      const typeRow = typeRows[0];
      if (typeRow === undefined) {
        throw new QueryTemporaryUnavailableError("Le type canonique du Life Event est absent.");
      }
      const typeKey = canonicalString(typeRow, ["type_key"], "life_events");
      const participantIds = [...new Set(participationRows
        .map((row) => canonicalString(row, ["person_id"], "life_events") as PersonId)
        .filter((personId) => dependencies.context.personIds.includes(personId)))].sort();
      const momentIds = [...new Set(momentLinks.map((row) =>
        canonicalString(row, ["moment_id"], "life_events") as MomentId,
      ))].sort();
      return {
        id: request.params.lifeEventId,
        identity: { title: entityLabel(event, request.params.lifeEventId) },
        type: canonicalHumanLabel(typeRow, typeKey),
        activityId: (activity?.activityId ?? typeKey) as import("@/core/identity").ActivityId,
        startsOn,
        endsOn,
        validationStatus: validationStatus as "Confirmé" | "Déduit" | "À valider",
        participantIds,
        places: preview(
          placeRows.map((row) => ({
            kind: "place" as const,
            id: canonicalString(row, ["place_id"], "entities") as PlaceId,
          })),
        ),
        relatedMoments: preview(
          momentIds.map((id) => ({
            kind: "moment" as const,
            id,
          })),
        ),
        headline: {},
        capabilities: context.capabilities,
      };
    },
  };
}
