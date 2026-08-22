import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type {
  AnalysisSubject,
  AnalysisTime,
  NormalizedAnalysisFilters,
  NormalizedAnalysisScope,
  ScopeHash,
} from "./types";

const scopeHashPrefix = "analysis-scope:v1\n";

function serializeString(value: string): string {
  return JSON.stringify(value);
}

function serializeCollection(values: readonly string[]): string {
  return `[${values.map(serializeString).join(",")}]`;
}

function serializeSubject(subject: AnalysisSubject): string {
  return subject.kind === "household"
    ? '{"kind":"household"}'
    : `{"kind":"person","personId":${serializeString(subject.personId)}}`;
}

function serializeTime(time: AnalysisTime): string {
  return time.kind === "month"
    ? `{"kind":"month","month":${serializeString(time.month)}}`
    : `{"kind":"global","observationWindow":${serializeString(
        time.observationWindow,
      )},"asOf":${serializeString(time.asOf)}}`;
}

function serializeFilters(filters: NormalizedAnalysisFilters): string {
  return (
    `{"categoryIds":${serializeCollection(filters.categoryIds)}` +
    `,"activityIds":${serializeCollection(filters.activityIds)}` +
    `,"merchantIds":${serializeCollection(filters.merchantIds)}` +
    `,"placeIds":${serializeCollection(filters.placeIds)}` +
    `,"lifeScopeContext":${serializeCollection(filters.lifeScopeContext)}` +
    `,"dayContext":${serializeCollection(filters.dayContext)}}`
  );
}

export function canonicalSerializeScope(
  scope: NormalizedAnalysisScope,
): string {
  return (
    `{"subject":${serializeSubject(scope.subject)}` +
    `,"time":${serializeTime(scope.time)}` +
    `,"filters":${serializeFilters(scope.filters)}}`
  );
}

export function computeScopeHash(scope: NormalizedAnalysisScope): ScopeHash {
  const payload = scopeHashPrefix + canonicalSerializeScope(scope);
  return bytesToHex(sha256(utf8ToBytes(payload))) as ScopeHash;
}
