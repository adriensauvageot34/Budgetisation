import "server-only";

import { activeMetricIds } from "../../analytics/production";
import {
  createCursorPage,
  decodeCursor,
  encodeCursor,
  getSortDefinition,
  isKeysetTupleAfter,
} from "../collections";
import {
  projectMetricCatalogCard,
  projectMetricMethodology,
} from "../exploration";
import {
  metricCatalogCollectionPolicy,
} from "../request";
import type { QueryReadModelSources } from "./types";

type RegistrySources = Pick<
  QueryReadModelSources,
  | "readMetricMethodology"
  | "readMetricCatalogPreview"
  | "readMetricCatalogCollection"
>;

export const metricRegistryQuerySources: RegistrySources = Object.freeze({
  readMetricMethodology({ request, context }) {
    return projectMetricMethodology({
      metricId: request.params.metricId,
      asOf: request.params.asOf,
      capabilities: context.capabilities,
    });
  },

  readMetricCatalogPreview({ context }) {
    return {
      items: activeMetricIds
        .map(projectMetricCatalogCard)
        .sort((a, b) => a.userName.localeCompare(b.userName, "fr"))
        .slice(0, 6),
      capabilities: context.capabilities,
    };
  },

  readMetricCatalogCollection({ request, context }) {
    const { params } = request;
    const outputKindFilter = new Set(params.filters.outputKinds);
    const search = params.search?.toLocaleLowerCase("fr") ?? null;
    const definition = getSortDefinition(
      metricCatalogCollectionPolicy.allowedSorts,
      params.sort.key,
    );
    const binding = {
      resource: request.resource,
      scopeHash: request.scopeHash,
      search: params.search,
      sort: params.sort,
      sortDefinition: definition,
      filters: params.filters,
      limit: params.limit,
      policyVersion: metricCatalogCollectionPolicy.cursorPolicyVersion,
    };
    const anchor = params.cursor === null ? null : decodeCursor(params.cursor, binding);
    const sortValue = (card: ReturnType<typeof projectMetricCatalogCard>) =>
      params.sort.key === "metric_id" ? card.metricId : card.userName;
    const direction = params.sort.direction === "asc" ? 1 : -1;
    const eligible = activeMetricIds
      .map(projectMetricCatalogCard)
      .filter((card) => outputKindFilter.size === 0 || outputKindFilter.has(card.outputKind))
      .filter((card) => search === null || card.userName.toLocaleLowerCase("fr").includes(search))
      .sort((a, b) => {
        const left = sortValue(a);
        const right = sortValue(b);
        const primary = (left === right ? 0 : left < right ? -1 : 1) * direction;
        const stable = (a.metricId === b.metricId ? 0 : a.metricId < b.metricId ? -1 : 1) * direction;
        return primary !== 0 ? primary : stable;
      });
    const cards = eligible
      .filter((card) =>
        anchor === null ||
        isKeysetTupleAfter(
          { sortValue: sortValue(card), stableId: card.metricId },
          anchor,
          definition,
          params.sort.direction,
        ),
      );
    const items = cards.slice(0, params.limit);
    const hasMore = cards.length > items.length;
    const last = items.at(-1);
    const nextCursor = hasMore && last !== undefined
      ? encodeCursor(binding, { sortValue: sortValue(last), stableId: last.metricId })
      : null;
    return {
      page: createCursorPage({
        items,
        nextCursor,
        isFirstPage: params.cursor === null,
        restrictions: {
          searchActive: params.search !== null,
          localFiltersActive: params.filters.outputKinds.length > 0,
          restrictiveScopeFilters: [],
        },
        totalCount: eligible.length,
      }),
      capabilities: context.capabilities,
    };
  },
});
