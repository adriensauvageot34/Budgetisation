import "server-only";

import { MetricProductionContractError } from "@/analytics/production";
import { selectEconomicComponentsForScope } from "@/analytics/context";
import { compareMoney, type Money } from "@/core/money";
import type { ScopeHash } from "@/core/scope";
import type { NormalizedAnalysisScope } from "@/core/scope";
import { addMonths, resolveGlobalWindowMonths } from "@/core/time";
import {
  createCursorPage,
  decodeCursor,
  encodeCursor,
  galleryMerchantsPolicy,
  galleryMomentsPolicy,
  galleryPlacesPolicy,
  getSortDefinition,
  type CollectionPolicy,
  type CursorQueryBinding,
  type CursorToken,
  type GalleryMerchantsReadModel,
  type GalleryMomentsReadModel,
  type GalleryPlacesReadModel,
  type KeysetAnchor,
  type MerchantGalleryCard,
  type MomentGalleryCard,
  type PlaceGalleryCard,
  type ScopedCountMetricReadModel,
  type ScopedMoneyMetricReadModel,
  type SortSpec,
} from "@/query-api";
import type { QueryReadModelSources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import {
  optionalCanonicalString,
  type CanonicalRecord,
} from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { loadMomentParticipantsByMomentId } from "./canonical-relations";

type GalleryDependencies = {
  readonly repository: CanonicalRepository;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
};

type Sortable<Card> = {
  readonly card: Card;
  readonly stableId: string;
  readonly sortValue: string | number | null;
};

function label(row: CanonicalRecord, fallback: string): string {
  return optionalCanonicalString(
    row,
    ["nom_canonique", "title", "name", "label", "titre", "nom", "display_name"],
  ) ?? fallback;
}

function momentDateRange(scope: NormalizedAnalysisScope) {
  const months = scope.time.kind === "month"
    ? [scope.time.month]
    : resolveGlobalWindowMonths(scope.time.observationWindow, scope.time.asOf);
  return { start: `${months[0]}-01`, endExclusive: `${addMonths(months[months.length - 1], 1)}-01` };
}

async function scopedMomentRows(
  rows: readonly CanonicalRecord[],
  scope: NormalizedAnalysisScope,
  dependencies: GalleryDependencies,
  participantsByMoment: ReadonlyMap<string, readonly { readonly personId: string }[]>,
) {
  if (scope.filters.dayContext.length > 0) {
    throw new MetricProductionContractError("Le lien Moment/DayContext n'est pas projeté par le canonique actuel.");
  }
  const hasEconomicFilters = scope.filters.categoryIds.length > 0 || scope.filters.activityIds.length > 0 ||
    scope.filters.merchantIds.length > 0 || scope.filters.placeIds.length > 0 || scope.filters.lifeScopeContext.length > 0;
  const eligibleIds = hasEconomicFilters
    ? new Set(selectEconomicComponentsForScope(await dependencies.facts.loadEconomicFacts(scope), scope)
        .flatMap(({ moment }) => moment.kind === "resolved" ? [moment.id as string] : []))
    : null;
  const range = momentDateRange(scope);
  return rows.filter((row) => {
    const id = optionalCanonicalString(row, ["moment_id"]);
    const start = optionalCanonicalString(row, ["start_date", "starts_on"]);
    const end = optionalCanonicalString(row, ["end_date", "ends_on"]) ?? start;
    if (id === undefined || start === undefined || end === undefined || start >= range.endExclusive || end < range.start) return false;
    if (eligibleIds !== null && !eligibleIds.has(id)) return false;
    const participantIds = (participantsByMoment.get(id) ?? []).map(({ personId }) => personId);
    return scope.subject.kind === "household" || participantIds.includes(scope.subject.personId);
  });
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
  direction: "asc" | "desc",
  money: boolean,
): number {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  let comparison: number;
  if (money) {
    if (typeof left !== "string" || typeof right !== "string") {
      throw new TypeError("Un tri Money exige des chaînes décimales exactes.");
    }
    comparison = compareMoney(left as Money, right as Money);
  } else {
    if (typeof left !== typeof right) {
      throw new TypeError("Les valeurs de tri Gallery sont hétérogènes.");
    }
    comparison = left === right ? 0 : left < right ? -1 : 1;
  }
  return direction === "asc" ? comparison : -comparison;
}

function paginate<Card, SortKey extends string, Filters extends object>(input: {
  readonly candidates: readonly Sortable<Card>[];
  readonly candidateCountBeforeFilters: number;
  readonly scopeHash: ScopeHash;
  readonly search: string | null;
  readonly sort: SortSpec<SortKey>;
  readonly filters: Filters;
  readonly cursor: CursorToken | null;
  readonly limit: number;
  readonly policy: CollectionPolicy<never, SortKey, Filters>;
  readonly moneySort: boolean;
}) {
  const sortDefinition = getSortDefinition(input.policy.allowedSorts, input.sort.key);
  const binding: CursorQueryBinding<SortKey, Filters> = {
    resource: input.policy.resource,
    scopeHash: input.scopeHash,
    search: input.search,
    sort: input.sort,
    sortDefinition,
    filters: input.filters,
    limit: input.limit,
    policyVersion: input.policy.cursorPolicyVersion,
  };
  const sorted = [...input.candidates].sort((left, right) => {
    const primary = compareValues(
      left.sortValue,
      right.sortValue,
      input.sort.direction,
      input.moneySort,
    );
    if (primary !== 0) return primary;
    const stable = left.stableId.localeCompare(right.stableId);
    return input.sort.direction === "asc" ? stable : -stable;
  });
  const anchor: KeysetAnchor | null = input.cursor === null
    ? null
    : decodeCursor(input.cursor, binding);
  const afterCursor = anchor === null
    ? sorted
    : sorted.filter((candidate) => {
        if (typeof anchor.sortValue === "boolean") {
          throw new TypeError("Le cursor Gallery ne peut pas porter un booléen.");
        }
        const primary = compareValues(
          candidate.sortValue,
          anchor.sortValue,
          input.sort.direction,
          input.moneySort,
        );
        if (primary !== 0) return primary > 0;
        if (typeof anchor.stableId !== "string") return false;
        const stable = candidate.stableId.localeCompare(anchor.stableId);
        return input.sort.direction === "asc" ? stable > 0 : stable < 0;
      });
  const selected = afterCursor.slice(0, input.limit);
  const last = selected.at(-1);
  const nextCursor = afterCursor.length > input.limit && last !== undefined
    ? encodeCursor(binding, {
        sortValue: last.sortValue,
        stableId: last.stableId,
      })
    : null;
  const localFiltersActive = Object.values(input.filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null,
  );
  return createCursorPage({
    items: selected.map(({ card }) => card),
    nextCursor,
    isFirstPage: input.cursor === null,
    restrictions: {
      searchActive: input.search !== null,
      localFiltersActive,
      restrictiveScopeFilters: [],
    },
    totalCount: input.candidates.length,
    candidateCountBeforeFilters: input.candidateCountBeforeFilters,
  });
}

function knownMetricValue(
  metric: ScopedCountMetricReadModel | ScopedMoneyMetricReadModel,
): string | number | null {
  return metric.envelope.availability === "known" ? metric.envelope.value : null;
}

export function createGalleryQuerySources(
  dependencies: GalleryDependencies,
): Pick<
  QueryReadModelSources,
  "readGalleryMoments" | "readGalleryPlaces" | "readGalleryMerchants"
> {
  return {
    async readGalleryMoments({ request, context }): Promise<GalleryMomentsReadModel> {
      if (
        request.params.filters.activityIds.length > 0 ||
        request.params.filters.placeIds.length > 0
      ) {
        throw new MetricProductionContractError(
          "Les relations Activity/Place des Moments ne sont pas projetées par le canonique actuel.",
        );
      }
      const canonicalRows = await dependencies.repository.loadEntityRows(
        "moments",
        "moment_id",
      );
      const momentIds = canonicalRows.flatMap((row) => {
        const id = optionalCanonicalString(row, ["moment_id"]);
        return id === undefined ? [] : [id];
      });
      const participantsByMoment = await loadMomentParticipantsByMomentId({
        repository: dependencies.repository,
        context: dependencies.repository.context,
        momentIds,
      });
      const rows = await scopedMomentRows(
        canonicalRows,
        request.scope,
        dependencies,
        participantsByMoment,
      );
      const search = request.params.search?.toLocaleLowerCase("fr") ?? null;
      const candidates = rows.flatMap((row): readonly Sortable<MomentGalleryCard>[] => {
        const momentId = optionalCanonicalString(row, ["moment_id"]);
        if (momentId === undefined) return [];
        const title = label(row, momentId);
        if (search !== null && !title.toLocaleLowerCase("fr").includes(search)) return [];
        return [{
          card: { momentId: momentId as MomentGalleryCard["momentId"], title },
          stableId: momentId,
          sortValue: optionalCanonicalString(row, ["start_date", "starts_on", "created_at"]) ?? null,
        }];
      });
      return {
        page: paginate({
          candidates,
          candidateCountBeforeFilters: rows.length,
          scopeHash: request.scopeHash,
          search: request.params.search,
          sort: request.params.sort,
          filters: request.params.filters,
          cursor: request.params.cursor,
          limit: request.params.limit,
          policy: galleryMomentsPolicy as never,
          moneySort: false,
        }),
        capabilities: context.capabilities,
      };
    },

    async readGalleryPlaces({ request, context }): Promise<GalleryPlacesReadModel> {
      if (request.params.filters.activityIds.length > 0) {
        throw new MetricProductionContractError(
          "La relation Activity/Place n'est pas projetée par le canonique actuel.",
        );
      }
      const [rows, visits] = await Promise.all([
        dependencies.repository.loadEntityRows("places", "place_id"),
        dependencies.facts.loadPlaceVisits(request.scope),
      ]);
      const search = request.params.search?.toLocaleLowerCase("fr") ?? null;
      const candidates = await Promise.all(
        rows.flatMap((row) => {
          const placeId = optionalCanonicalString(row, ["place_id"]);
          if (placeId === undefined) return [];
          const placeLabel = label(row, placeId);
          if (
            search !== null &&
            !placeLabel.toLocaleLowerCase("fr").includes(search)
          ) return [];
          return [{ row, placeId, placeLabel }];
        }).map(async ({ placeId, placeLabel }) => {
          const scoped = {
            ...request.scope,
            filters: { ...request.scope.filters, placeIds: [placeId as PlaceGalleryCard["placeId"]] },
          };
          const [visitCount, localizedSpend] = await Promise.all([
            dependencies.metrics.produce("place_visit_count", scoped),
            dependencies.metrics.produce("localized_spend", scoped),
          ]);
          const placeVisits = visits.filter((visit) => visit.placeId === placeId);
          const recent = placeVisits
            .map(({ localDate }) => localDate)
            .sort()
            .at(-1) ?? null;
          const sortValue = request.params.sort.key === "frequent"
            ? knownMetricValue(visitCount as ScopedCountMetricReadModel)
            : request.params.sort.key === "spent"
              ? knownMetricValue(localizedSpend as ScopedMoneyMetricReadModel)
              : recent;
          return {
            card: {
              placeId: placeId as PlaceGalleryCard["placeId"],
              label: placeLabel,
              visitCount: visitCount as ScopedCountMetricReadModel,
              localizedSpend: localizedSpend as ScopedMoneyMetricReadModel,
            },
            stableId: placeId,
            sortValue,
          } satisfies Sortable<PlaceGalleryCard>;
        }),
      );
      return {
        page: paginate({
          candidates,
          candidateCountBeforeFilters: rows.length,
          scopeHash: request.scopeHash,
          search: request.params.search,
          sort: request.params.sort,
          filters: request.params.filters,
          cursor: request.params.cursor,
          limit: request.params.limit,
          policy: galleryPlacesPolicy as never,
          moneySort: request.params.sort.key === "spent",
        }),
        capabilities: context.capabilities,
      };
    },

    async readGalleryMerchants({ request, context }): Promise<GalleryMerchantsReadModel> {
      if (request.params.filters.activityIds.length > 0) {
        throw new MetricProductionContractError(
          "La relation Activity/Merchant n'est pas projetée par le canonique actuel.",
        );
      }
      if (request.params.sort.key === "frequent") {
        throw new MetricProductionContractError(
          "Le tri Merchant fréquent exige Purchase Events datés.",
        );
      }
      const [rows, economicFacts] = await Promise.all([
        dependencies.repository.loadEntityRows("merchants", "merchant_id"),
        dependencies.facts.loadEconomicFacts(request.scope),
      ]);
      const search = request.params.search?.toLocaleLowerCase("fr") ?? null;
      const candidates = await Promise.all(
        rows.flatMap((row) => {
          const merchantId = optionalCanonicalString(row, ["merchant_id"]);
          if (merchantId === undefined) return [];
          const merchantLabel = label(row, merchantId);
          if (
            search !== null &&
            !merchantLabel.toLocaleLowerCase("fr").includes(search)
          ) return [];
          const merchantFacts = economicFacts.filter(
            ({ merchant }) => merchant.kind === "resolved" && merchant.id === merchantId,
          );
          const placeIds = new Set(
            merchantFacts.flatMap(({ canonicalPlace }) =>
              canonicalPlace.kind === "resolved" ? [canonicalPlace.placeId] : [],
            ),
          );
          if (
            request.params.filters.placeIds.length > 0 &&
            !request.params.filters.placeIds.some((placeId) => placeIds.has(placeId))
          ) return [];
          return [{ merchantId, merchantLabel, merchantFacts }];
        }).map(async ({ merchantId, merchantLabel, merchantFacts }) => {
          const scoped = {
            ...request.scope,
            filters: {
              ...request.scope.filters,
              merchantIds: [merchantId as MerchantGalleryCard["merchantId"]],
            },
          };
          const economicAmount = await dependencies.metrics.produce(
            "merchant_net_amount",
            scoped,
          );
          const recent = merchantFacts.flatMap(({ bankDate }) =>
            bankDate.kind === "known" ? [bankDate.date] : [],
          ).sort().at(-1) ?? null;
          return {
            card: {
              merchantId: merchantId as MerchantGalleryCard["merchantId"],
              label: merchantLabel,
              economicAmount: economicAmount as ScopedMoneyMetricReadModel,
            },
            stableId: merchantId,
            sortValue:
              request.params.sort.key === "spent"
                ? knownMetricValue(economicAmount as ScopedMoneyMetricReadModel)
                : recent,
          } satisfies Sortable<MerchantGalleryCard>;
        }),
      );
      return {
        page: paginate({
          candidates,
          candidateCountBeforeFilters: rows.length,
          scopeHash: request.scopeHash,
          search: request.params.search,
          sort: request.params.sort,
          filters: request.params.filters,
          cursor: request.params.cursor,
          limit: request.params.limit,
          policy: galleryMerchantsPolicy as never,
          moneySort: request.params.sort.key === "spent",
        }),
        capabilities: context.capabilities,
      };
    },
  };
}
