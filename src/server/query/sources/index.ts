import "server-only";

import type { QueryReadModelSources } from "@/query-api/server";
import { metricRegistryQuerySources } from "@/query-api/server";
import type { FactSourceResolver } from "@/server/analytics/fact-source-resolver";
import type { MetricQueryService } from "@/server/analytics/metric-query-service";
import type { AuthorizedRuntimeContext } from "@/server/canonical/context";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { createAnalysisQuerySources } from "./analysis";
import { createEntityQuerySources } from "./entities";
import { createGalleryQuerySources } from "./galleries";
import { createOperationsQuerySource } from "./operations";
import { createHistoryV2QuerySources } from "./history-v2";

export function createRealQuerySources(input: {
  readonly context: AuthorizedRuntimeContext;
  readonly repository: CanonicalRepository;
  readonly facts: FactSourceResolver;
  readonly metrics: MetricQueryService;
}): QueryReadModelSources {
  return {
    ...metricRegistryQuerySources,
    ...createHistoryV2QuerySources(),
    ...createAnalysisQuerySources(input),
    ...createEntityQuerySources(input),
    ...createGalleryQuerySources(input),
    ...createOperationsQuerySource(input),
  };
}
