"use client";

import { useEffect, useMemo, useState } from "react";
import { createApiError, type ApiResponse } from "@/core/api";
import type { AnalysisScope } from "@/core/scope";
import type { YearMonth } from "@/core/time";
import { ExplorationPanel, type ExplorationNodeTransport } from "@/features/exploration";
import type { ExplorationNode, RootNavigationContext } from "@/navigation";
import {
  queryResourceKeys,
  type EntityLifeEventReadModel,
  type EntityMerchantReadModel,
  type EntityMomentReadModel,
  type EntityOperationReadModel,
  type EntityPersonaReadModel,
  type EntityPlaceReadModel,
  type GalleryMerchantsReadModel,
  type GalleryMomentsReadModel,
  type GalleryPlacesReadModel,
  type MetricMethodologyReadModel,
} from "@/query-api";
import type { UiTransportState } from "@/ui";
import {
  cachedClientQueryResponse,
  createClientQueryIdentity,
  executeCachedClientQuery,
} from "./query-client";
import { useProductRuntime } from "./product-runtime-provider";

function scopeForRoot(root: RootNavigationContext): AnalysisScope | null {
  if ("kind" in root) {
    if (root.filters.month === undefined) return null;
    return {
      subject: root.filters.personId
        ? { kind: "person", personId: root.filters.personId }
        : { kind: "household" },
      time: { kind: "month", month: root.filters.month },
    };
  }
  if (root.area === "calendar") {
    if (root.context.kind === "calendar_overview") return null;
    return {
      subject: root.context.personId
        ? { kind: "person", personId: root.context.personId }
        : { kind: "household" },
      time: { kind: "month", month: root.context.month },
    };
  }
  const subject = root.context.personId
    ? { kind: "person" as const, personId: root.context.personId }
    : { kind: "household" as const };
  return root.context.kind === "analysis_month"
    ? { subject, time: { kind: "month", month: root.context.month } }
    : root.context.asOf
      ? {
          subject,
          time: {
            kind: "global",
            observationWindow: root.context.observationWindow,
            asOf: root.context.asOf,
          },
        }
      : null;
}

function asOfForScope(scope: AnalysisScope): YearMonth {
  return scope.time.kind === "month" ? scope.time.month : scope.time.asOf;
}

function requestForNode(node: ExplorationNode, scope: AnalysisScope): unknown | null {
  switch (node.kind) {
    case "analysis":
      return null;
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
      if (node.gallery === "moments" && node.filters.sort === "recent") {
        return { resource: queryResourceKeys.galleryMoments, scope, params: {} };
      }
      if (node.gallery === "places" && (node.filters.sort === "frequent" || node.filters.sort === "recent")) {
        return { resource: queryResourceKeys.galleryPlaces, scope, params: { sort: { key: node.filters.sort, direction: "desc" } } };
      }
      if (node.gallery === "merchants" && (node.filters.sort === "frequent" || node.filters.sort === "recent")) {
        return { resource: queryResourceKeys.galleryMerchants, scope, params: { sort: { key: node.filters.sort, direction: "desc" } } };
      }
      return undefined;
    }
  }
}

function nodeTransport(
  node: ExplorationNode,
  transport: UiTransportState<unknown>,
): ExplorationNodeTransport {
  switch (node.kind) {
    case "analysis": return { kind: "analysis", node };
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
  const scope = useMemo(
    () => runtime.snapshot ? scopeForRoot(runtime.snapshot.history.root) : null,
    [runtime.snapshot],
  );
  const request = useMemo(
    () => currentNode && scope ? requestForNode(currentNode, scope) : null,
    [currentNode, scope],
  );
  const requestKey = request === null || request === undefined
    ? null
    : createClientQueryIdentity(request);
  const [transport, setTransport] = useState<UiTransportState<unknown>>({ status: "idle" });

  useEffect(() => {
    if (currentNode?.kind === "analysis") return;
    if (request === undefined || scope === null) {
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
    if (request === null) return;
    let active = true;
    const cached = cachedClientQueryResponse(request);
    setTransport(cached === undefined
      ? { status: "loading" }
      : { status: "success", response: cached, refreshing: true });
    void executeCachedClientQuery(request as never)
      .then((result) => {
        if (!active) return;
        setTransport(result.ok
          ? { status: "success", response: result.response as ApiResponse<unknown>, refreshing: false }
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
  }, [currentNode?.kind, requestKey, scope]);

  if (exploration === null || currentNode === undefined) return null;
  return (
    <ExplorationPanel
      state={{ exploration, current: nodeTransport(currentNode, transport) }}
      navigation={{
        push: (node) => runtime.run((controller) => controller.push(node)) as ReturnType<NonNullable<typeof runtime.controller>["push"]>,
        pop: () => runtime.run((controller) => controller.pop()) as ReturnType<NonNullable<typeof runtime.controller>["pop"]>,
        close: () => runtime.run((controller) => controller.close()) as ReturnType<NonNullable<typeof runtime.controller>["close"]>,
      }}
    />
  );
}
