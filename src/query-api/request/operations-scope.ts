import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { parseAnalysisSubject, type AnalysisSubject, type ScopeHash } from "../../core/scope";
import { parseStrictRecord, requireProperty } from "../../core/validation";
import { canonicalSerializeQueryParams } from "./cache-key";
import { parseOperationsBrowseParams, type OperationsTimeFilter } from "./operations-params";

export type OperationsExecutionScope = {
  readonly kind: "operations";
  readonly subject: AnalysisSubject;
  readonly time: OperationsTimeFilter;
};

export type NormalizedOperationsExecutionScope = OperationsExecutionScope & {
  readonly filters: {
    readonly categoryIds: readonly [];
    readonly activityIds: readonly [];
    readonly merchantIds: readonly [];
    readonly placeIds: readonly [];
    readonly lifeScopeContext: readonly [];
    readonly dayContext: readonly [];
  };
};

export function normalizeOperationsExecutionScope(value: unknown): NormalizedOperationsExecutionScope {
  const record = parseStrictRecord(value, ["kind", "subject", "time"], "OperationsExecutionScope");
  if (requireProperty(record, "kind", "OperationsExecutionScope") !== "operations") {
    throw new TypeError("OperationsExecutionScope.kind doit valoir operations.");
  }
  return {
    kind: "operations",
    subject: parseAnalysisSubject(requireProperty(record, "subject", "OperationsExecutionScope")),
    time: parseOperationsBrowseParams({
      time: requireProperty(record, "time", "OperationsExecutionScope"),
    }).time,
    filters: {
      categoryIds: [],
      activityIds: [],
      merchantIds: [],
      placeIds: [],
      lifeScopeContext: [],
      dayContext: [],
    },
  };
}

export function computeOperationsScopeHash(scope: NormalizedOperationsExecutionScope): ScopeHash {
  const payload = `operations-scope:v1\n${canonicalSerializeQueryParams(scope)}`;
  return bytesToHex(sha256(utf8ToBytes(payload))) as ScopeHash;
}
