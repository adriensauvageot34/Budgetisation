"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createApiError, type ApiResponse } from "@/core/api";
import type { AnalysisScope } from "@/core/scope";
import type { YearMonth } from "@/core/time";
import { ExplorationPanel, type ExplorationNodeTransport } from "@/features/exploration";
import { prepareExplorationScope, type ExplorationNode } from "@/navigation";
import {
  queryResourceKeys,
  type EntityLifeEventReadModel,
  type EntityMerchantReadModel,
  type EntityMomentReadModel,
  type EntityOperationReadModel,
  type EntityPersonaReadModel,
  type EntityPlaceReadModel,
  type AnalysisTargetReadModel,
  type GalleryMerchantsReadModel,
  type GalleryMomentsReadModel,
  type GalleryPlacesReadModel,
  type MerchantsGalleryFilters,
  type MomentsGalleryFilters,
  type PlacesGalleryFilters,
  type MetricMethodologyReadModel,
} from "@/query-api";
import type { UiTransportState } from "@/ui";
import {
  cachedClientQueryResponse,
  createClientQueryIdentity,
  executeCachedClientQuery,
} from "./query-client";
import { useProductRuntime } from "./product-runtime-provider";
import type { GalleryRuntime } from "@/features/exploration";

type GallerySession = {
  readonly key: string;
  readonly gallery: "moments" | "places" | "merchants";
  readonly search: string;
  readonly sort: "recent" | "frequent" | "spent";
  readonly filters: MomentsGalleryFilters | PlacesGalleryFilters | MerchantsGalleryFilters;
  readonly cursor: string | null;
};

function initialGallerySession(node: Extract<ExplorationNode, { readonly kind: "gallery" }>, key: string): GallerySession {
  return node.gallery === "moments"
    ? { key, gallery: node.gallery, search: "", sort: "recent", filters: { activityIds: [], placeIds: [] }, cursor: null }
    : node.gallery === "places"
      ? { key, gallery: node.gallery, search: "", sort: node.filters.sort, filters: { activityIds: [] }, cursor: null }
      : { key, gallery: node.gallery, search: "", sort: node.filters.sort, filters: { activityIds: [], placeIds: [] }, cursor: null };
}

function asOfForScope(scope: AnalysisScope): YearMonth {
  return scope.time.kind === "month" ? scope.time.month : scope.time.asOf;
}

function requestForNode(node: ExplorationNode, scope: AnalysisScope, gallerySession: GallerySession | null): unknown | null {
  switch (node.kind) {
    case "analysis":
      return { resource: queryResourceKeys.analysisTarget, scope: node.scope, params: { target: node.target } };
    case "moment":
      return { resource: queryResourceKeys.entityMoment, scope, params: { momentId: node.id } };
    case "place":
      return { resource: queryResourceKeys.entityPlace, scope, params: { placeId: node.id } };
    case "merchant":
      return { resource: queryResourceKeys.entityMerchant, scope, params: { merchantId: node.id } };
    case "persona":
      return { resource: queryResourceKeys.entityPersona, scope, params: { target: node.id === "ensemble" ? { kind: "ensemble" } : { kind: "person", personId: node.id } } };
    case "life_event":
      return { resource: queryResourceKeys.entityLifeEvent, scope, params: { lifeEventId: node.id } };
    case "operation":
      return { resource: queryResourceKeys.entityOperation, scope, params: { operationId: node.id } };
    case "methodology":
      return { resource: queryResourceKeys.metricMethodology, scope, params: { metricId: node.metricId, asOf: asOfForScope(scope) } };
    case "gallery": {
      if (gallerySession === null || gallerySession.gallery !== node.gallery) return undefined;
      const params = {
        search: gallerySession.search,
        sort: { key: gallerySession.sort, direction: "desc" as const },
        filters: gallerySession.filters,
        cursor: gallerySession.cursor,
        limit: 24,
      };
      return {
        resource: node.gallery === "moments"
          ? queryResourceKeys.galleryMoments
          : node.gallery === "places"
            ? queryResourceKeys.galleryPlaces
            : queryResourceKeys.galleryMerchants,
        scope,
        params,
      };
    }
  }
}

function nodeTransport(
  node: ExplorationNode,
  transport: UiTransportState<unknown>,
): ExplorationNodeTransport {
  switch (node.kind) {
    case "analysis": return { kind: "analysis", node, transport: transport as UiTransportState<AnalysisTargetReadModel> };
    case "moment": return { kind: "moment", node, transport: transport as UiTransportState<EntityMomentReadModel> };
    case "place": return { kind: "place", node, transport: transport as UiTransportState<EntityPlaceReadModel> };
    case "merchant": return { kind: "merchant", node, transport: transport as UiTransportState<EntityMerchantReadModel> };
    case "persona": return { kind: "persona", node, transport: transport as UiTransportState<EntityPersonaReadModel> };
    case "life_event": return { kind: "life_event", node, transport: transport as UiTransportState<EntityLifeEventReadModel> };
    case "operation": return { kind: "operation", node, transport: transport as UiTransportState<EntityOperationReadModel> };
    case "methodology": return { kind: "methodology", node, transport: transport as UiTransportState<MetricMethodologyReadModel> };
    case "gallery":
      return node.gallery === "moments"
        ? { kind: "gallery_moments", node, transport: transport as UiTransportState<GalleryMomentsReadModel> }
        : node.gallery === "places"
          ? { kind: "gallery_places", node, transport: transport as UiTransportState<GalleryPlacesReadModel> }
          : { kind: "gallery_merchants", node, transport: transport as UiTransportState<GalleryMerchantsReadModel> };
  }
}

export function ExplorationRuntimeHost() {
  const runtime = useProductRuntime();
  const exploration = runtime.snapshot?.history.exploration ?? null;
  const currentNode = exploration?.stack.at(-1);
  const galleryNodeKey = currentNode?.kind === "gallery"
    ? `${runtime.snapshot?.history.generation ?? "none"}:${exploration?.stack.length ?? 0}:${JSON.stringify(currentNode)}`
    : null;
  const [storedGallery, setStoredGallery] = useState<GallerySession | null>(null);
  const gallerySession = currentNode?.kind === "gallery" && galleryNodeKey !== null
    ? storedGallery?.key === galleryNodeKey
      ? storedGallery
      : initialGallerySession(currentNode, galleryNodeKey)
    : null;
  const accumulatedGallery = useRef<ApiResponse<unknown> | null>(null);
  const [retryGeneration, setRetryGeneration] = useState(0);

  useEffect(() => {
    if (gallerySession !== null && storedGallery?.key !== gallerySession.key) {
      accumulatedGallery.current = null;
      setStoredGallery(gallerySession);
    }
  }, [gallerySession, storedGallery?.key]);
  const scopePreparation = useMemo(() => runtime.snapshot === null
    ? { kind: "inactive" as const }
    : prepareExplorationScope({
        root: runtime.snapshot.history.root,
        registeredScope: runtime.surfaceRegistry.readScope(),
        explorationRequested: currentNode !== undefined,
      }), [currentNode, runtime.snapshot, runtime.surfaceRegistry]);
  const scope = scopePreparation.kind === "ready"
    ? scopePreparation.scope
    : null;
  const request = useMemo(
    () => currentNode && scope ? requestForNode(currentNode, scope, gallerySession) : null,
    [currentNode, gallerySession, scope],
  );
  const requestKey = request === null || request === undefined
    ? null
    : createClientQueryIdentity(request);
  const [transport, setTransport] = useState<UiTransportState<unknown>>({ status: "idle" });

  useEffect(() => {
    if (currentNode === undefined) return;
    if (request === undefined || scopePreparation.kind === "invalid_scope") {
      setTransport({
        status: "error",
        error: createApiError({
          code: "INVALID_SCOPE",
          message: "Cette destination ne peut pas conserver exactement le scope courant.",
          retryable: false,
          requestId: "exploration-scope",
        }),
      });
      return;
    }
    if (request === null || scope === null) return;
    let active = true;
    const cached = cachedClientQueryResponse(request);
    setTransport(cached === undefined
      ? { status: "loading" }
      : { status: "success", response: cached, refreshing: true });
    void executeCachedClientQuery(request as never)
      .then((result) => {
        if (!active) return;
        const rawResponse = result.ok ? result.response as ApiResponse<unknown> : null;
        let response = rawResponse;
        if (rawResponse !== null && currentNode?.kind === "gallery") {
          const rawData = rawResponse.data as { readonly page: { readonly items: readonly unknown[] } };
          const previous = gallerySession?.cursor === null ? null : accumulatedGallery.current;
          if (previous !== null) {
            const previousData = previous.data as { readonly page: { readonly items: readonly unknown[] } };
            response = {
              ...rawResponse,
              data: {
                ...(rawResponse.data as object),
                page: {
                  ...rawData.page,
                  items: [...previousData.page.items, ...rawData.page.items],
                },
              },
            };
          }
          accumulatedGallery.current = response;
        }
        setTransport(result.ok
          ? { status: "success", response: response!, refreshing: false }
          : {
              status: "error",
              error: result.error,
              ...(cached === undefined ? {} : { previousData: cached }),
            });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTransport({
          status: "error",
          error: createApiError({
            code: "TEMPORARY_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Exploration indisponible.",
            retryable: true,
            requestId: "exploration-transport",
          }),
          ...(cached === undefined ? {} : { previousData: cached }),
        });
      });
    return () => { active = false; };
  }, [currentNode?.kind, requestKey, retryGeneration, scope, scopePreparation.kind]);

  useLayoutEffect(() => {
    const root = runtime.snapshot?.history.root;
    if (root === undefined || currentNode === undefined) return;
    if (transport.status === "success" || (transport.status === "error" && transport.previousData !== undefined)) {
      runtime.readinessRegistry.markReady(root);
    } else if (transport.status === "error") {
      runtime.readinessRegistry.markTerminalWithoutAnchor(root);
    } else {
      runtime.readinessRegistry.markPending(root);
    }
  }, [currentNode, runtime.readinessRegistry, runtime.snapshot, transport]);

  const galleryRuntime: GalleryRuntime | undefined = gallerySession === null ? undefined : {
    gallery: gallerySession.gallery,
    query: {
      search: gallerySession.search,
      sort: gallerySession.sort,
      filters: gallerySession.filters,
    },
    actions: {
      onSearch: (search: string) => {
        accumulatedGallery.current = null;
        setStoredGallery({ ...gallerySession, search, cursor: null });
      },
      onSort: (sort: "recent" | "frequent" | "spent") => {
        accumulatedGallery.current = null;
        setStoredGallery({ ...gallerySession, sort, cursor: null });
      },
      onRemoveFilter: (filter: "activityIds" | "placeIds") => {
        if (!(filter in gallerySession.filters)) return;
        accumulatedGallery.current = null;
        setStoredGallery({
          ...gallerySession,
          filters: { ...gallerySession.filters, [filter]: [] },
          cursor: null,
        });
      },
      onLoadMore: (cursor: string) => setStoredGallery({ ...gallerySession, cursor }),
      onRetry: () => setRetryGeneration((value) => value + 1),
    },
  } as GalleryRuntime;

  if (exploration === null || currentNode === undefined) return null;
  return (
    <ExplorationPanel
      state={{ exploration, current: nodeTransport(currentNode, transport) }}
      navigation={{
        push: (node, anchor) => runtime.run((controller) => controller.push(node, anchor)) as ReturnType<NonNullable<typeof runtime.controller>["push"]>,
        pop: () => runtime.run((controller) => controller.pop()) as ReturnType<NonNullable<typeof runtime.controller>["pop"]>,
        close: () => runtime.run((controller) => controller.close()) as ReturnType<NonNullable<typeof runtime.controller>["close"]>,
        openOperations: (filters) => runtime.run((controller) => controller.goToOperations(filters)) as ReturnType<NonNullable<typeof runtime.controller>["goToOperations"]>,
        showDay: (day) => runtime.run((controller) => controller.showDayFromExploration(day)) as ReturnType<NonNullable<typeof runtime.controller>["showDayFromExploration"]>,
      }}
      backgroundRootRef={runtime.backgroundRootRef}
      operationRoot={
        runtime.snapshot !== null && "kind" in runtime.snapshot.history.root &&
        exploration.stack.length === 1 &&
        currentNode.kind === "operation"
      }
      galleryRuntime={galleryRuntime}
      onRetry={() => setRetryGeneration((value) => value + 1)}
    />
  );
}
