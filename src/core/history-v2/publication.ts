import type { Brand } from "../identity";
import { parseInstant, type Instant } from "../time";
import {
  createRuntimeSchema,
  parseStrictRecord,
  requireProperty,
  withValidationPath,
} from "../validation";
import {
  parseContractVersion,
  type ContractVersion,
} from "../versions";
import {
  parsePolicyVersions,
  policyVersionsEqual,
  type PolicyVersions,
} from "./policy-versions";
import type { HistoryV2ReasonCode } from "./reason-codes";

export type FactsHash = Brand<string, "HistoryV2FactsHash">;

export type PublicationMeta = {
  readonly publicationId: string;
  readonly revision: number;
  readonly contractVersion: ContractVersion;
  readonly factsHash: FactsHash;
  readonly policyVersions: PolicyVersions;
  readonly generatedAt: Instant;
};

export type SidecarPublicationSource = {
  readonly sourcePublicationId: string;
  readonly sourceRevision: number;
  readonly sourceContractVersion: ContractVersion;
  readonly sourceFactsHash: FactsHash;
  readonly sourcePolicyVersions: PolicyVersions;
};

export type PublicationFreshness =
  | { readonly status: "CURRENT" }
  | {
      readonly status: "STALE";
      readonly reasonCodes: readonly HistoryV2ReasonCode[];
    };

const factsHashPattern = /^[0-9a-f]{64}$/;

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} doit être une chaîne non vide.`);
  }
  return value;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${fieldName} doit être un entier strictement positif.`);
  }
  return value as number;
}

function parseHistoryV2ContractVersion(value: unknown): ContractVersion {
  const contractVersion = parseContractVersion(value);
  if (contractVersion !== "v2") {
    throw new TypeError("PublicationMeta History V2 exige contractVersion v2.");
  }
  return contractVersion;
}

function requireCorePublicationPolicies(
  policyVersions: PolicyVersions,
): PolicyVersions {
  if (
    policyVersions.quality_visibility === undefined
    || policyVersions.facts_hash === undefined
  ) {
    throw new TypeError(
      "PublicationMeta exige quality_visibility et facts_hash dans policyVersions.",
    );
  }
  return policyVersions;
}

export function parseFactsHash(value: unknown): FactsHash {
  if (typeof value !== "string" || !factsHashPattern.test(value)) {
    throw new TypeError("factsHash doit être un SHA-256 lowercase hex.");
  }
  return value as FactsHash;
}

export function parsePublicationMeta(value: unknown): PublicationMeta {
  const record = parseStrictRecord(
    value,
    [
      "publicationId",
      "revision",
      "contractVersion",
      "factsHash",
      "policyVersions",
      "generatedAt",
    ],
    "PublicationMetaV2",
  );
  return {
    publicationId: parseNonEmptyString(
      requireProperty(record, "publicationId", "PublicationMetaV2"),
      "PublicationMetaV2.publicationId",
    ),
    revision: parsePositiveInteger(
      requireProperty(record, "revision", "PublicationMetaV2"),
      "PublicationMetaV2.revision",
    ),
    contractVersion: withValidationPath("contractVersion", () =>
      parseHistoryV2ContractVersion(
        requireProperty(record, "contractVersion", "PublicationMetaV2"),
      )),
    factsHash: withValidationPath("factsHash", () =>
      parseFactsHash(requireProperty(record, "factsHash", "PublicationMetaV2"))),
    policyVersions: withValidationPath("policyVersions", () =>
      requireCorePublicationPolicies(parsePolicyVersions(
        requireProperty(record, "policyVersions", "PublicationMetaV2"),
      ))),
    generatedAt: withValidationPath("generatedAt", () =>
      parseInstant(requireProperty(record, "generatedAt", "PublicationMetaV2"))),
  };
}

export function parseSidecarPublicationSource(
  value: unknown,
): SidecarPublicationSource {
  const record = parseStrictRecord(
    value,
    [
      "sourcePublicationId",
      "sourceRevision",
      "sourceContractVersion",
      "sourceFactsHash",
      "sourcePolicyVersions",
    ],
    "SidecarPublicationSource",
  );
  return {
    sourcePublicationId: parseNonEmptyString(
      requireProperty(record, "sourcePublicationId", "SidecarPublicationSource"),
      "SidecarPublicationSource.sourcePublicationId",
    ),
    sourceRevision: parsePositiveInteger(
      requireProperty(record, "sourceRevision", "SidecarPublicationSource"),
      "SidecarPublicationSource.sourceRevision",
    ),
    sourceContractVersion: withValidationPath("sourceContractVersion", () =>
      parseHistoryV2ContractVersion(requireProperty(
        record,
        "sourceContractVersion",
        "SidecarPublicationSource",
      ))),
    sourceFactsHash: withValidationPath("sourceFactsHash", () =>
      parseFactsHash(requireProperty(
        record,
        "sourceFactsHash",
        "SidecarPublicationSource",
      ))),
    sourcePolicyVersions: withValidationPath("sourcePolicyVersions", () =>
      requireCorePublicationPolicies(parsePolicyVersions(requireProperty(
        record,
        "sourcePolicyVersions",
        "SidecarPublicationSource",
      )))),
  };
}

export function publicationFreshness(input: {
  readonly current: PublicationMeta;
  readonly source: SidecarPublicationSource;
}): PublicationFreshness {
  const reasons: HistoryV2ReasonCode[] = [];
  if (
    input.source.sourcePublicationId !== input.current.publicationId
    || input.source.sourceRevision !== input.current.revision
  ) {
    reasons.push("PUBLICATION_STALE");
  }
  if (input.source.sourceContractVersion !== input.current.contractVersion) {
    reasons.push("PUBLICATION_CONTRACT_MISMATCH");
  }
  if (input.source.sourceFactsHash !== input.current.factsHash) {
    reasons.push("PUBLICATION_FACTS_MISMATCH");
  }
  if (!policyVersionsEqual(
    input.source.sourcePolicyVersions,
    input.current.policyVersions,
  )) {
    reasons.push("PUBLICATION_POLICY_MISMATCH");
  }
  return reasons.length === 0
    ? { status: "CURRENT" }
    : { status: "STALE", reasonCodes: reasons };
}

export const factsHashSchema = createRuntimeSchema(parseFactsHash);
export const publicationMetaSchema = createRuntimeSchema(parsePublicationMeta);
export const sidecarPublicationSourceSchema = createRuntimeSchema(
  parseSidecarPublicationSource,
);
