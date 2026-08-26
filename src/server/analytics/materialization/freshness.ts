import "server-only";

import type { MaterializationPeriodIdentity } from "./identity";

export function isScopedMaterializationFresh(input: {
  readonly rowSourceRevision: bigint;
  readonly currentDataRevision: bigint;
  readonly period: MaterializationPeriodIdentity;
  readonly latestImpactRevision: bigint;
}): boolean {
  if (input.period.kind === "global" || !input.period.isClosed) {
    return input.rowSourceRevision === input.currentDataRevision;
  }
  return input.rowSourceRevision >= BigInt(input.period.sourceRevision)
    && input.rowSourceRevision >= input.latestImpactRevision;
}

export function areMaterializationVersionsCompatible(input: {
  readonly rowMethodVersion: string;
  readonly currentMethodVersion: string;
  readonly rowContractVersion: string;
  readonly currentContractVersion: string;
}): boolean {
  return input.rowMethodVersion === input.currentMethodVersion
    && input.rowContractVersion === input.currentContractVersion;
}
