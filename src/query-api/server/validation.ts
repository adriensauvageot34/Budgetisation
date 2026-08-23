import "server-only";

import { parseContract } from "../../core/api";
import type { QueryCapabilities } from "../capabilities";
import type { RuntimeSchema } from "../../core/validation";
import {
  queryDataSchemaByResource,
  type QueryDataByResource,
} from "../read-model-registry";
import {
  canonicalSerializeQueryParams,
  type NormalizedQueryRequest,
  type QueryResourceName,
} from "../request";

function outputCapabilities(
  resource: QueryResourceName,
  data: QueryDataByResource[QueryResourceName],
): QueryCapabilities {
  switch (resource) {
    case "analysis_month_breakdown":
    case "analysis_global_breakdown":
      return (data as QueryDataByResource[typeof resource]).breakdown.capabilities;
    case "analysis_month_contexts":
    case "analysis_global_contexts":
      return (data as QueryDataByResource[typeof resource]).contexts.capabilities;
    default:
      return (data as { readonly capabilities: QueryCapabilities }).capabilities;
  }
}

function assertSame(actual: unknown, expected: unknown, name: string): void {
  if (
    canonicalSerializeQueryParams({ value: actual }) !==
    canonicalSerializeQueryParams({ value: expected })
  ) {
    throw new TypeError(`${name} ne correspond pas à la Query normalisée.`);
  }
}

export function assertQueryDataMatchesRequest<Name extends QueryResourceName>(
  request: NormalizedQueryRequest<Name>,
  data: QueryDataByResource[Name],
): void {
  const scope = request.scope;
  switch (request.resource as QueryResourceName) {
    case "history_calendar_month":
    case "history_calendar_month_summary":
      assertSame((data as QueryDataByResource["history_calendar_month"]).month, scope.time.kind === "month" ? scope.time.month : null, "Calendar month");
      break;
    case "history_day_detail":
      assertSame((data as QueryDataByResource["history_day_detail"]).date, (request.params as { readonly date: unknown }).date, "Day detail date");
      break;
    case "analysis_month_initial":
    case "analysis_month_contexts":
    case "analysis_month_lived":
    case "analysis_month_moments":
      assertSame((data as QueryDataByResource["analysis_month_initial"]).month, scope.time.kind === "month" ? scope.time.month : null, "Analysis month");
      break;
    case "analysis_month_breakdown": {
      const output = data as QueryDataByResource["analysis_month_breakdown"];
      const params = request.params as { readonly dimension: unknown; readonly measure: unknown };
      assertSame(output.month, scope.time.kind === "month" ? scope.time.month : null, "Analysis month");
      assertSame(output.breakdown.dimension, params.dimension, "Breakdown dimension");
      assertSame(output.breakdown.measure, params.measure, "Breakdown measure");
      break;
    }
    case "analysis_month_evolution": {
      const output = data as QueryDataByResource["analysis_month_evolution"];
      assertSame(output.month, scope.time.kind === "month" ? scope.time.month : null, "Analysis month");
      break;
    }
    case "analysis_month_structure": {
      const output = data as QueryDataByResource["analysis_month_structure"];
      const params = request.params as { readonly view: unknown; readonly dimension: unknown; readonly measure: unknown };
      assertSame(output.month, scope.time.kind === "month" ? scope.time.month : null, "Analysis month");
      assertSame(output.activeView, params.view, "Structure view");
      assertSame(output.activeDimension, params.dimension, "Structure dimension");
      assertSame(output.activeMeasure, params.measure, "Structure measure");
      break;
    }
    case "analysis_target": {
      const output = data as QueryDataByResource["analysis_target"];
      assertSame(output.month, scope.time.kind === "month" ? scope.time.month : null, "Analysis month");
      assertSame(output.target, (request.params as { readonly target: unknown }).target, "Analysis target");
      break;
    }
    case "analysis_global_initial":
    case "analysis_global_contexts": {
      const globalData = data as QueryDataByResource["analysis_global_initial"];
      assertSame(globalData.observationWindow, scope.time.kind === "global" ? scope.time.observationWindow : null, "GlobalWindow");
      assertSame(globalData.asOf, scope.time.kind === "global" ? scope.time.asOf : null, "Global asOf");
      break;
    }
    case "analysis_global_breakdown": {
      const output = data as QueryDataByResource["analysis_global_breakdown"];
      const params = request.params as { readonly dimension: unknown; readonly measure: unknown };
      assertSame(output.observationWindow, scope.time.kind === "global" ? scope.time.observationWindow : null, "GlobalWindow");
      assertSame(output.asOf, scope.time.kind === "global" ? scope.time.asOf : null, "Global asOf");
      assertSame(output.breakdown.dimension, params.dimension, "Breakdown dimension");
      assertSame(output.breakdown.measure, params.measure, "Breakdown measure");
      break;
    }
    case "analysis_global_evolution": {
      const output = data as QueryDataByResource["analysis_global_evolution"];
      assertSame(output.observationWindow, scope.time.kind === "global" ? scope.time.observationWindow : null, "GlobalWindow");
      assertSame(output.asOf, scope.time.kind === "global" ? scope.time.asOf : null, "Global asOf");
      assertSame(output.metricId, (request.params as { readonly metricId: unknown }).metricId, "Evolution MetricId");
      break;
    }
    case "entity_place":
      assertSame((data as QueryDataByResource["entity_place"]).id, (request.params as { readonly placeId: unknown }).placeId, "PlaceId");
      break;
    case "entity_merchant":
      assertSame((data as QueryDataByResource["entity_merchant"]).id, (request.params as { readonly merchantId: unknown }).merchantId, "MerchantId");
      break;
    case "entity_moment":
      assertSame((data as QueryDataByResource["entity_moment"]).id, (request.params as { readonly momentId: unknown }).momentId, "MomentId");
      break;
    case "entity_persona":
      assertSame((data as QueryDataByResource["entity_persona"]).target, (request.params as { readonly target: unknown }).target, "PersonaTarget");
      break;
    case "entity_life_event":
      assertSame((data as QueryDataByResource["entity_life_event"]).id, (request.params as { readonly lifeEventId: unknown }).lifeEventId, "LifeEventId");
      break;
    case "entity_operation":
      assertSame((data as QueryDataByResource["entity_operation"]).id, (request.params as { readonly operationId: unknown }).operationId, "OperationId");
      break;
    case "metric_methodology": {
      const params = request.params as { readonly metricId: unknown; readonly asOf: unknown };
      const methodology = data as QueryDataByResource["metric_methodology"];
      assertSame(methodology.metricId, params.metricId, "Methodology MetricId");
      assertSame(methodology.asOf, params.asOf, "Methodology asOf");
      break;
    }
    case "operations_browse":
      assertSame(
        (data as QueryDataByResource["operations_browse"]).appliedQuery,
        request.params,
        "Operations applied query",
      );
      break;
  }
  if (scope.subject !== undefined && "subject" in (data as object)) {
    assertSame((data as { readonly subject: unknown }).subject, scope.subject, "Read model subject");
  }
}

export function validateQueryData<Name extends QueryResourceName>(
  request: NormalizedQueryRequest<Name>,
  rawData: unknown,
  capabilities: QueryCapabilities,
  requestId: string,
): QueryDataByResource[Name] {
  const schema = queryDataSchemaByResource[
    request.resource as QueryResourceName
  ] as RuntimeSchema<QueryDataByResource[Name]>;
  const data = parseContract(schema, rawData, {
    contractName: `QueryData:${request.resource}`,
    requestId,
  }) as QueryDataByResource[Name];
  assertQueryDataMatchesRequest(request, data);
  assertSame(outputCapabilities(request.resource as QueryResourceName, data), capabilities, "QueryCapabilities");
  return data;
}
