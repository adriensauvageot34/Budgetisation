import "server-only";

import { createHash } from "node:crypto";

import {
  EVENT_MOBILITY_COST_METRIC_ID,
  EVENT_MOBILITY_COST_METRIC_VERSION,
  GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION,
  GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION,
  type GlobalM7EventMobilityAuthority,
} from "@/analytics/global-v2/event-mobility";
import { canonicalSerializeGlobal, type NormalizedGlobalAnalysisScopeV2 } from "@/core/global-v2";
import type { GlobalV2ResolvedDependency, GlobalV2ResourceVersion } from "@/server/analytics/materialization/global-v2";

export const GLOBAL_EVENT_MOBILITY_ARTIFACT_CONTRACT_VERSION = "global-event-mobility@v1" as const;
export const GLOBAL_EVENT_MOBILITY_ARTIFACT_FAMILY = "global_event_mobility" as const;

const digest = (value: unknown) => createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
const HASH = /^[0-9a-f]{64}$/u;
const SUMMARY_KEYS = new Set([
  "eventRef", "targetKind", "relationTypes", "validationStatus", "mobilityCostMetric", "monetaryNature",
  "additivity", "methodVersion", "policyVersion", "evidenceRefs", "inputHash", "status", "coverage",
  "physicalLegCount", "tripCount", "distanceKm", "estimatedFuelLiters", "estimatedFuelCost",
]);

/** A projection of the certified Owner; no canonical rows or attribution logic enter this adapter. */
export function validateGlobalEventMobilityOwner(owner: GlobalM7EventMobilityAuthority): GlobalM7EventMobilityAuthority {
  if (owner.methodVersion !== GLOBAL_M7_EVENT_MOBILITY_METHOD_VERSION
    || owner.policyVersion !== GLOBAL_M7_EVENT_MOBILITY_POLICY_VERSION
    || owner.costMetricId !== EVENT_MOBILITY_COST_METRIC_VERSION
    || owner.liveWrites !== "NONE"
    || !HASH.test(owner.inputHash) || !HASH.test(owner.outputHash)
    || !Array.isArray(owner.summaries)
    || Object.keys(owner).sort().join(",") !== ["costMetricId", "inputHash", "liveWrites", "methodVersion", "outputHash", "physicalUnionTotals", "policyVersion", "summaries"].join(",")) {
    throw new TypeError("GLOBAL_EVENT_MOBILITY_OWNER_INVALID");
  }
  for (const summary of owner.summaries) {
    if (Object.keys(summary).some((key) => !SUMMARY_KEYS.has(key))
      || summary.methodVersion !== owner.methodVersion
      || summary.policyVersion !== owner.policyVersion
      || summary.mobilityCostMetric.methodVersion !== owner.costMetricId
      || summary.mobilityCostMetric.metricId !== EVENT_MOBILITY_COST_METRIC_ID
      || summary.mobilityCostMetric.provenance !== "estimated"
      || summary.mobilityCostMetric.monetaryBasis !== "estimated_cost"
      || summary.monetaryNature !== "ESTIMATED_MOBILITY_USAGE"
      || summary.coverage.policyRef !== owner.policyVersion
      || summary.additivity.withinSummary !== "UNION_UNIQUE_MOBILITY_LEGS"
      || summary.additivity.acrossSummaries !== "NON_ADDITIVE_RECOMPUTE_ON_TARGET_GROUP"
      || !HASH.test(summary.inputHash)
      || Object.keys(summary.mobilityCostMetric).sort().join(",") !== "methodVersion,metricId,monetaryBasis,provenance"
      || Object.keys(summary.coverage).sort().join(",") !== "basis,policyRef,state"
      || Object.keys(summary.additivity).sort().join(",") !== "acrossSummaries,withinSummary"
      || !Array.isArray(summary.relationTypes) || !summary.relationTypes.every((item: string) => typeof item === "string")
      || !Array.isArray(summary.evidenceRefs) || !summary.evidenceRefs.every((item: string) => typeof item === "string")) {
      throw new TypeError("GLOBAL_EVENT_MOBILITY_SUMMARY_INVALID");
    }
  }
  if (Object.keys(owner.physicalUnionTotals).sort().join(",") !== "distanceKm,estimatedFuelCost,estimatedFuelLiters,physicalLegCount") {
    throw new TypeError("GLOBAL_EVENT_MOBILITY_TOTALS_INVALID");
  }
  const { outputHash, ...body } = owner;
  if (digest(body) !== outputHash) throw new TypeError("GLOBAL_EVENT_MOBILITY_OWNER_HASH_MISMATCH");
  return owner;
}

/** Version inputs are explicit so a future algorithm or policy release invalidates without a source revision change. */
export function globalEventMobilityArtifactVersion(input: {
  readonly key: string;
  readonly scope: NormalizedGlobalAnalysisScopeV2;
  readonly ownerInputHash: string;
  readonly ownerOutputHash: string;
  readonly methodVersion: string;
  readonly policyVersion: string;
  readonly costMetricId: string;
}): GlobalV2ResourceVersion {
  return {
    key: input.key,
    family: GLOBAL_EVENT_MOBILITY_ARTIFACT_FAMILY,
    contractVersion: GLOBAL_EVENT_MOBILITY_ARTIFACT_CONTRACT_VERSION,
    methodSignature: digest({ methodVersion: input.methodVersion }),
    policyVersions: { physicalAttribution: input.policyVersion, costMetric: input.costMetricId },
    resourceInputHash: digest({ scope: input.scope, contractVersion: GLOBAL_EVENT_MOBILITY_ARTIFACT_CONTRACT_VERSION,
      methodVersion: input.methodVersion, policyVersion: input.policyVersion, costMetricId: input.costMetricId,
      ownerInputHash: input.ownerInputHash, ownerOutputHash: input.ownerOutputHash }),
  };
}

export function buildGlobalEventMobilityArtifactDefinition(input: {
  readonly scope: NormalizedGlobalAnalysisScopeV2;
  readonly scopeHash: string;
  readonly owner: GlobalM7EventMobilityAuthority;
}): {
  readonly key: string;
  readonly semanticBody: GlobalM7EventMobilityAuthority;
  readonly version: GlobalV2ResourceVersion;
  readonly dependencies: readonly GlobalV2ResolvedDependency[];
} {
  const owner = validateGlobalEventMobilityOwner(input.owner);
  const key = `global-artifact:event-mobility:${input.scopeHash}`;
  return {
    key,
    semanticBody: owner,
    version: globalEventMobilityArtifactVersion({ key, scope: input.scope, ownerInputHash: owner.inputHash,
      ownerOutputHash: owner.outputHash, methodVersion: owner.methodVersion, policyVersion: owner.policyVersion,
      costMetricId: owner.costMetricId }),
    dependencies: [{ authority: "METRIC", family: "global_event_mobility_owner_output",
      identity: "GlobalM7EventMobilityAuthority:EVENT_MOBILITY", digest: owner.outputHash, required: true }],
  };
}
