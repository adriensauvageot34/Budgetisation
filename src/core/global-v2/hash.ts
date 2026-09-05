import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type {
  GlobalAnalysisScopeHash,
  GlobalDependencyDeclaration,
  GlobalDependencyDigest,
  GlobalEngineIdentity,
  GlobalMethodSignature,
  NormalizedGlobalAnalysisScopeV2,
} from "./types";

const globalScopeHashPrefix = "global-analysis-scope:v2\n";
const globalEngineSignaturePrefix = "global-engine-signature:v1\n";
const globalDependencyPrefix = "global-dependency-declaration:v1\n";

function assertCanonicalValue(value: unknown, path: string): void {
  if (value === undefined) throw new TypeError(`${path} contient undefined.`);
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`${path} contient un nombre non fini.`);
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new TypeError(`${path} contient un objet non JSON.`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertCanonicalValue(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError(`${path} contient une clé non textuelle.`);
      assertCanonicalValue((value as Readonly<Record<string, unknown>>)[key], `${path}.${key}`);
    }
  }
}

export function canonicalSerializeGlobal(value: unknown): string {
  assertCanonicalValue(value, "GlobalCanonicalValue");
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalSerializeGlobal).join(",")}]`;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalSerializeGlobal(record[key])}`).join(",")}}`;
}

function digest(prefix: string, value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(prefix + canonicalSerializeGlobal(value))));
}

export function canonicalSerializeGlobalAnalysisScopeV2(
  scope: NormalizedGlobalAnalysisScopeV2,
): string {
  return canonicalSerializeGlobal(scope);
}

export function computeGlobalAnalysisScopeV2Hash(
  scope: NormalizedGlobalAnalysisScopeV2,
): GlobalAnalysisScopeHash {
  return digest(globalScopeHashPrefix, scope) as GlobalAnalysisScopeHash;
}

export function computeGlobalEngineSignature(
  identity: GlobalEngineIdentity,
  contractVersion: string,
): GlobalMethodSignature {
  return digest(globalEngineSignaturePrefix, {
    contractVersion,
    engineId: identity.engineId,
    methodVersion: identity.methodVersion,
    naturalGrain: identity.naturalGrain,
    ...(identity.statisticalPolicy === undefined
      ? {}
      : { statisticalPolicy: identity.statisticalPolicy }),
    timeWindowPolicy: identity.timeWindowPolicy,
    supportPolicy: identity.supportPolicy,
    coveragePolicy: identity.coveragePolicy,
    ...(identity.materialityPolicy === undefined
      ? {}
      : { materialityPolicy: identity.materialityPolicy }),
  }) as GlobalMethodSignature;
}

export function computeGlobalDependencyDeclarationDigest(
  declaration: GlobalDependencyDeclaration,
): GlobalDependencyDigest {
  return digest(globalDependencyPrefix, declaration) as GlobalDependencyDigest;
}
