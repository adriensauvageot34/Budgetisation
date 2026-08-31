import type {
  AnalyticsRevision,
  ContractVersion,
  DataRevision,
  MethodVersion,
  PolicyVersion,
} from "./types";

const revisionPattern = /^(0|[1-9]\d*)$/;
const methodVersionPattern = /^[a-z][a-z0-9_]*@v[1-9]\d*$/;
const contractVersionPattern = /^v[1-9]\d*$/;
const policyVersionPattern = /^v[1-9]\d*$/;

export function parseDataRevision(value: unknown): DataRevision {
  if (typeof value !== "string" || !revisionPattern.test(value)) {
    throw new TypeError("DataRevision doit être un entier décimal canonique.");
  }
  return value as DataRevision;
}

export function parseAnalyticsRevision(value: unknown): AnalyticsRevision {
  if (typeof value !== "string" || !revisionPattern.test(value)) {
    throw new TypeError(
      "AnalyticsRevision doit être un entier décimal canonique.",
    );
  }
  return value as AnalyticsRevision;
}

export function parseMethodVersion(value: unknown): MethodVersion {
  if (typeof value !== "string" || !methodVersionPattern.test(value)) {
    throw new TypeError("MethodVersion doit respecter <method-key>@vN.");
  }
  return value as MethodVersion;
}

export function parseContractVersion(value: unknown): ContractVersion {
  if (typeof value !== "string" || !contractVersionPattern.test(value)) {
    throw new TypeError("ContractVersion doit respecter vN.");
  }
  return value as ContractVersion;
}

export function parsePolicyVersion(value: unknown): PolicyVersion {
  if (typeof value !== "string" || !policyVersionPattern.test(value)) {
    throw new TypeError("PolicyVersion doit respecter vN.");
  }
  return value as PolicyVersion;
}
