import type { ScopeHash } from "../../core/scope";
import {
  parseStrictRecord,
  requireProperty,
} from "../../core/validation";
import { canonicalSerializeQueryParams } from "../request/cache-key";
import {
  parseQueryResourceKeySyntax,
  type QueryResourceKey,
} from "../request/resource-key";
import type {
  CursorToken,
  KeysetAnchor,
  KeysetSortValue,
  SortDefinition,
  SortSpec,
} from "./types";

const cursorPrefix = "budgetisation_cursor_v1.";
const base64UrlAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const encodedCursorPattern =
  /^budgetisation_cursor_v1\.[A-Za-z0-9_-]+$/;
const scopeHashPattern = /^[0-9a-f]{64}$/;

export type CursorQueryBinding<
  SortKey extends string = string,
  Filters extends object = object,
> = {
  readonly resource: QueryResourceKey;
  readonly scopeHash: ScopeHash;
  readonly search: string | null;
  readonly sort: SortSpec<SortKey>;
  readonly sortDefinition: SortDefinition<SortKey>;
  readonly filters: Filters;
  readonly limit: number;
  readonly policyVersion: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const bits = (first << 16) | (second << 8) | third;
    encoded += base64UrlAlphabet[(bits >>> 18) & 63];
    encoded += base64UrlAlphabet[(bits >>> 12) & 63];
    if (index + 1 < bytes.length) {
      encoded += base64UrlAlphabet[(bits >>> 6) & 63];
    }
    if (index + 2 < bytes.length) {
      encoded += base64UrlAlphabet[bits & 63];
    }
  }
  return encoded;
}

function decodeBase64Url(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) {
    throw new TypeError("CursorToken contient un encodage invalide.");
  }
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 4) {
    const values = [0, 0, 0, 0];
    const count = Math.min(4, encoded.length - index);
    for (let chunkIndex = 0; chunkIndex < count; chunkIndex += 1) {
      const value = base64UrlAlphabet.indexOf(encoded[index + chunkIndex]);
      if (value < 0) throw new TypeError("CursorToken invalide.");
      values[chunkIndex] = value;
    }
    const bits =
      (values[0] << 18) |
      (values[1] << 12) |
      (values[2] << 6) |
      values[3];
    bytes.push((bits >>> 16) & 255);
    if (count >= 3) bytes.push((bits >>> 8) & 255);
    if (count === 4) bytes.push(bits & 255);
  }
  return Uint8Array.from(bytes);
}

function parseCursorSearch(value: unknown): string | null {
  if (value === null || typeof value === "string") return value;
  throw new TypeError("CursorToken.search est invalide.");
}

function parseCursorInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new TypeError(`${name} est invalide.`);
  }
  return value;
}

function parseCursorSortValue(value: unknown): KeysetSortValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  throw new TypeError("CursorToken.anchor.sortValue est invalide.");
}

function parseCursorAnchor(
  value: unknown,
  definition: SortDefinition<string>,
): KeysetAnchor {
  const record = parseStrictRecord(
    value,
    ["sortValue", "stableId"],
    "CursorAnchor",
  );
  const stableId = requireProperty(record, "stableId", "CursorAnchor");
  if (
    typeof stableId !== definition.stableIdKind ||
    (typeof stableId === "number" && !Number.isFinite(stableId)) ||
    (typeof stableId === "string" && stableId.length === 0)
  ) {
    throw new TypeError("CursorToken.anchor.stableId est invalide.");
  }
  return {
    sortValue: parseCursorSortValue(
      requireProperty(record, "sortValue", "CursorAnchor"),
    ),
    stableId,
  } as KeysetAnchor;
}

function assertBinding(binding: CursorQueryBinding): void {
  parseQueryResourceKeySyntax(binding.resource);
  if (!scopeHashPattern.test(binding.scopeHash)) {
    throw new TypeError("Le ScopeHash du cursor est invalide.");
  }
  if (
    binding.sort.key !== binding.sortDefinition.key ||
    !["asc", "desc"].includes(binding.sort.direction)
  ) {
    throw new TypeError("La définition de tri du cursor est incohérente.");
  }
  if (!Number.isInteger(binding.limit) || binding.limit < 1) {
    throw new TypeError("La limite du cursor est invalide.");
  }
  if (binding.policyVersion.trim().length === 0) {
    throw new TypeError("La version de policy du cursor est requise.");
  }
  canonicalSerializeQueryParams(binding.filters);
}

export function parseCursorToken(value: unknown): CursorToken {
  if (typeof value !== "string" || !encodedCursorPattern.test(value)) {
    throw new TypeError("CursorToken est invalide.");
  }
  return value as CursorToken;
}

export function encodeCursor(
  binding: CursorQueryBinding,
  anchor: KeysetAnchor,
): CursorToken {
  assertBinding(binding);
  const parsedAnchor = parseCursorAnchor(anchor, binding.sortDefinition);
  const payload = {
    version: 1,
    resource: binding.resource,
    scopeHash: binding.scopeHash,
    search: binding.search,
    sort: binding.sort,
    nulls: binding.sortDefinition.nulls,
    stableIdKind: binding.sortDefinition.stableIdKind,
    filters: canonicalSerializeQueryParams(binding.filters),
    limit: binding.limit,
    policyVersion: binding.policyVersion,
    anchor: parsedAnchor,
  };
  return `${cursorPrefix}${encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  )}` as CursorToken;
}

export function decodeCursor(
  token: CursorToken,
  expected: CursorQueryBinding,
): KeysetAnchor {
  assertBinding(expected);
  const parsedToken = parseCursorToken(token);
  let rawPayload: unknown;
  try {
    const encoded = parsedToken.slice(cursorPrefix.length);
    rawPayload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        decodeBase64Url(encoded),
      ),
    );
  } catch {
    throw new TypeError("CursorToken ne contient pas un payload valide.");
  }

  const payload = parseStrictRecord(
    rawPayload,
    [
      "version",
      "resource",
      "scopeHash",
      "search",
      "sort",
      "nulls",
      "stableIdKind",
      "filters",
      "limit",
      "policyVersion",
      "anchor",
    ],
    "CursorPayload",
  );
  const sort = parseStrictRecord(
    requireProperty(payload, "sort", "CursorPayload"),
    ["key", "direction"],
    "CursorPayload.sort",
  );
  const actualResource = parseQueryResourceKeySyntax(
    requireProperty(payload, "resource", "CursorPayload"),
  );
  const actualScopeHash = requireProperty(payload, "scopeHash", "CursorPayload");
  const actualFilters = requireProperty(payload, "filters", "CursorPayload");
  const actualPolicyVersion = requireProperty(
    payload,
    "policyVersion",
    "CursorPayload",
  );

  if (
    requireProperty(payload, "version", "CursorPayload") !== 1 ||
    actualResource !== expected.resource ||
    typeof actualScopeHash !== "string" ||
    !scopeHashPattern.test(actualScopeHash) ||
    actualScopeHash !== expected.scopeHash ||
    parseCursorSearch(requireProperty(payload, "search", "CursorPayload")) !==
      expected.search ||
    requireProperty(sort, "key", "CursorPayload.sort") !== expected.sort.key ||
    requireProperty(sort, "direction", "CursorPayload.sort") !==
      expected.sort.direction ||
    requireProperty(payload, "nulls", "CursorPayload") !==
      expected.sortDefinition.nulls ||
    requireProperty(payload, "stableIdKind", "CursorPayload") !==
      expected.sortDefinition.stableIdKind ||
    typeof actualFilters !== "string" ||
    actualFilters !== canonicalSerializeQueryParams(expected.filters) ||
    parseCursorInteger(
      requireProperty(payload, "limit", "CursorPayload"),
      "CursorPayload.limit",
    ) !== expected.limit ||
    typeof actualPolicyVersion !== "string" ||
    actualPolicyVersion !== expected.policyVersion
  ) {
    throw new TypeError("CursorToken ne correspond pas à cette query.");
  }

  return parseCursorAnchor(
    requireProperty(payload, "anchor", "CursorPayload"),
    expected.sortDefinition,
  );
}
