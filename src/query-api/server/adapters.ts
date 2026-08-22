import "server-only";

import type {
  QueryReadModelSource,
  QueryReadModelSources,
  QueryServerAdapter,
} from "./types";
import type { QueryResourceName } from "../request";

export function defineQueryServerAdapter<Name extends QueryResourceName>(
  resource: QueryServerAdapter<Name>["resource"],
  selectSource: (sources: QueryReadModelSources) => QueryReadModelSource<Name>,
): QueryServerAdapter<Name> {
  return Object.freeze({
    resource,
    async execute(request, context, sources) {
      const source = selectSource(sources);
      return await source({ request, context });
    },
  });
}
