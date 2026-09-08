import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseInstant, parseLocalDate, type Instant, type LocalDate } from "../../core/time";
import { hasOwn, parseStrictRecord, parseStringLiteral, requireProperty } from "../../core/validation";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";
import type { HistoricalMinimalRuleFamily } from "./historical-minimal";

export const HISTORICAL_AUTHORITY_METHOD_VERSION: MethodVersion =
  parseMethodVersion("minimal_historical_authority@v1");
export const HISTORICAL_RECURRENCE_STATE_METHOD_VERSION: MethodVersion =
  parseMethodVersion("minimal_recurrence_state@v1");

export type HistoricalAuthorityType =
  | "OBSERVED_ECONOMIC_EVIDENCE"
  | "RETROSPECTIVE_DECLARATION"
  | "DECLARED"
  | "CONTRACTUAL"
  | "ANALYTICS_DERIVED";

export type HistoricalMinimalRuleVersion = {
  readonly ruleVersionId: string;
  readonly baselineRuleId: string;
  readonly masterRuleFamily: HistoricalMinimalRuleFamily;
  readonly conditionCode?: string;
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
  readonly declaredAt: Instant;
  readonly sourceRevision: number;
  readonly authorityType: HistoricalAuthorityType;
  readonly declaredByRef: string;
  readonly validationRef: string;
  readonly methodVersion: MethodVersion;
  readonly evidenceRefs: readonly string[];
  readonly supersedesVersionId?: string;
};

export type HistoricalRecurrenceStateVersion = {
  readonly stateVersionId: string;
  readonly recurrenceSeriesId: string;
  readonly historicalState: "ACTIVE_FOR_MINIMAL" | "INACTIVE_FOR_MINIMAL";
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
  readonly declaredAt: Instant;
  readonly sourceRevision: number;
  readonly authorityType: HistoricalAuthorityType;
  readonly declaredByRef: string;
  readonly validationRef: string;
  readonly methodVersion: MethodVersion;
  readonly evidenceRefs: readonly string[];
  readonly supersedesVersionId?: string;
};

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${name} doit être une chaîne non vide.`);
  }
  return value;
}

function positiveRevision(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${name} doit être un entier strictement positif.`);
  }
  return value as number;
}

function evidenceRefs(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const parsed = value.map((entry) => nonEmptyString(entry, `${name}[]`));
  if (new Set(parsed).size !== parsed.length) throw new TypeError(`${name} contient un doublon.`);
  return [...parsed].sort();
}

function optionalLocalDate(record: Readonly<Record<string, unknown>>, key: string, typeName: string): LocalDate | undefined {
  return hasOwn(record, key) ? parseLocalDate(requireProperty(record, key, typeName)) : undefined;
}

function optionalString(record: Readonly<Record<string, unknown>>, key: string, typeName: string): string | undefined {
  return hasOwn(record, key) ? nonEmptyString(requireProperty(record, key, typeName), `${typeName}.${key}`) : undefined;
}

function commonVersion(record: Readonly<Record<string, unknown>>, typeName: string) {
  const effectiveFrom = parseLocalDate(requireProperty(record, "effectiveFrom", typeName));
  const effectiveTo = optionalLocalDate(record, "effectiveTo", typeName);
  if (effectiveTo !== undefined && effectiveTo <= effectiveFrom) {
    throw new TypeError(`${typeName} doit utiliser un intervalle [effectiveFrom,effectiveTo) non vide.`);
  }
  return {
    effectiveFrom,
    ...(effectiveTo === undefined ? {} : { effectiveTo }),
    declaredAt: parseInstant(requireProperty(record, "declaredAt", typeName)),
    sourceRevision: positiveRevision(requireProperty(record, "sourceRevision", typeName), `${typeName}.sourceRevision`),
    authorityType: parseStringLiteral<HistoricalAuthorityType>(
      requireProperty(record, "authorityType", typeName),
      new Set(["OBSERVED_ECONOMIC_EVIDENCE", "RETROSPECTIVE_DECLARATION", "DECLARED", "CONTRACTUAL", "ANALYTICS_DERIVED"]),
      `${typeName}.authorityType`,
    ),
    declaredByRef: nonEmptyString(requireProperty(record, "declaredByRef", typeName), `${typeName}.declaredByRef`),
    validationRef: nonEmptyString(requireProperty(record, "validationRef", typeName), `${typeName}.validationRef`),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", typeName)),
    evidenceRefs: evidenceRefs(requireProperty(record, "evidenceRefs", typeName), `${typeName}.evidenceRefs`),
    ...(optionalString(record, "supersedesVersionId", typeName) === undefined
      ? {}
      : { supersedesVersionId: optionalString(record, "supersedesVersionId", typeName)! }),
  };
}

export function parseHistoricalMinimalRuleVersion(value: unknown): HistoricalMinimalRuleVersion {
  const typeName = "HistoricalMinimalRuleVersion";
  const record = parseStrictRecord(value, [
    "ruleVersionId", "baselineRuleId", "masterRuleFamily", "conditionCode", "effectiveFrom", "effectiveTo",
    "declaredAt", "sourceRevision", "authorityType", "declaredByRef", "validationRef", "methodVersion",
    "evidenceRefs", "supersedesVersionId",
  ], typeName);
  const conditionCode = optionalString(record, "conditionCode", typeName);
  return {
    ruleVersionId: nonEmptyString(requireProperty(record, "ruleVersionId", typeName), `${typeName}.ruleVersionId`),
    baselineRuleId: nonEmptyString(requireProperty(record, "baselineRuleId", typeName), `${typeName}.baselineRuleId`),
    masterRuleFamily: parseStringLiteral<HistoricalMinimalRuleFamily>(
      requireProperty(record, "masterRuleFamily", typeName),
      new Set(["FIXED_REQUIRED", "PERIODIC_REQUIRED", "VARIABLE_ESSENTIAL", "DECLARED_MINIMUM", "EXCLUDED_FROM_MINIMAL"]),
      `${typeName}.masterRuleFamily`,
    ),
    ...(conditionCode === undefined ? {} : { conditionCode }),
    ...commonVersion(record, typeName),
  };
}

export function parseHistoricalRecurrenceStateVersion(value: unknown): HistoricalRecurrenceStateVersion {
  const typeName = "HistoricalRecurrenceStateVersion";
  const record = parseStrictRecord(value, [
    "stateVersionId", "recurrenceSeriesId", "historicalState", "effectiveFrom", "effectiveTo", "declaredAt",
    "sourceRevision", "authorityType", "declaredByRef", "validationRef", "methodVersion", "evidenceRefs",
    "supersedesVersionId",
  ], typeName);
  return {
    stateVersionId: nonEmptyString(requireProperty(record, "stateVersionId", typeName), `${typeName}.stateVersionId`),
    recurrenceSeriesId: nonEmptyString(requireProperty(record, "recurrenceSeriesId", typeName), `${typeName}.recurrenceSeriesId`),
    historicalState: parseStringLiteral(
      requireProperty(record, "historicalState", typeName),
      new Set(["ACTIVE_FOR_MINIMAL", "INACTIVE_FOR_MINIMAL"]),
      `${typeName}.historicalState`,
    ),
    ...commonVersion(record, typeName),
  };
}

type VersionWindow = {
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
  readonly declaredAt: Instant;
  readonly sourceRevision: number;
};

function effectiveAndKnown(version: VersionWindow, effectiveOn: LocalDate, knownAt: Instant): boolean {
  return version.effectiveFrom <= effectiveOn &&
    (version.effectiveTo === undefined || effectiveOn < version.effectiveTo) &&
    version.declaredAt <= knownAt;
}

function overlaps(left: VersionWindow, right: VersionWindow): boolean {
  const leftEnd = left.effectiveTo ?? "9999-12-31";
  const rightEnd = right.effectiveTo ?? "9999-12-31";
  return left.effectiveFrom < rightEnd && right.effectiveFrom < leftEnd;
}

function assertNoContradictoryOverlap<T extends VersionWindow>(
  versions: readonly T[],
  identity: (version: T) => string,
  semantics: (version: T) => unknown,
): void {
  for (let leftIndex = 0; leftIndex < versions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < versions.length; rightIndex += 1) {
      const left = versions[leftIndex]!;
      const right = versions[rightIndex]!;
      if (identity(left) !== identity(right) || left.sourceRevision !== right.sourceRevision || !overlaps(left, right)) continue;
      if (canonicalSerializeGlobal(semantics(left)) !== canonicalSerializeGlobal(semantics(right))) {
        throw new TypeError("Deux autorités historiques contradictoires se chevauchent à la même sourceRevision.");
      }
    }
  }
}

export function assertHistoricalAuthorityVersionSet(input: {
  readonly ruleVersions: readonly HistoricalMinimalRuleVersion[];
  readonly recurrenceStateVersions: readonly HistoricalRecurrenceStateVersion[];
}): void {
  const rules = input.ruleVersions.map(parseHistoricalMinimalRuleVersion);
  const recurrences = input.recurrenceStateVersions.map(parseHistoricalRecurrenceStateVersion);
  if (new Set(rules.map(({ ruleVersionId }) => ruleVersionId)).size !== rules.length) {
    throw new TypeError("ruleVersionId dupliqué.");
  }
  if (new Set(recurrences.map(({ stateVersionId }) => stateVersionId)).size !== recurrences.length) {
    throw new TypeError("stateVersionId dupliqué.");
  }
  assertNoContradictoryOverlap(rules, ({ baselineRuleId }) => baselineRuleId, ({ masterRuleFamily, conditionCode }) => ({ masterRuleFamily, ...(conditionCode === undefined ? {} : { conditionCode }) }));
  assertNoContradictoryOverlap(recurrences, ({ recurrenceSeriesId }) => recurrenceSeriesId, ({ historicalState }) => historicalState);
}

function selectLatest<T extends VersionWindow>(versions: readonly T[]): T | undefined {
  return [...versions].sort((left, right) =>
    right.sourceRevision - left.sourceRevision ||
    right.declaredAt.localeCompare(left.declaredAt) ||
    canonicalSerializeGlobal(left).localeCompare(canonicalSerializeGlobal(right)))[0];
}

export function selectHistoricalMinimalRuleVersion(input: {
  readonly baselineRuleId: string;
  readonly effectiveOn: LocalDate;
  readonly knownAt: Instant;
  readonly versions: readonly HistoricalMinimalRuleVersion[];
}): HistoricalMinimalRuleVersion | undefined {
  const versions = input.versions.map(parseHistoricalMinimalRuleVersion);
  assertHistoricalAuthorityVersionSet({ ruleVersions: versions, recurrenceStateVersions: [] });
  return selectLatest(versions.filter((version) =>
    version.baselineRuleId === input.baselineRuleId && effectiveAndKnown(version, input.effectiveOn, input.knownAt)));
}

export function selectHistoricalRecurrenceStateVersion(input: {
  readonly recurrenceSeriesId: string;
  readonly effectiveOn: LocalDate;
  readonly knownAt: Instant;
  readonly versions: readonly HistoricalRecurrenceStateVersion[];
}): HistoricalRecurrenceStateVersion | undefined {
  const versions = input.versions.map(parseHistoricalRecurrenceStateVersion);
  assertHistoricalAuthorityVersionSet({ ruleVersions: [], recurrenceStateVersions: versions });
  return selectLatest(versions.filter((version) =>
    version.recurrenceSeriesId === input.recurrenceSeriesId && effectiveAndKnown(version, input.effectiveOn, input.knownAt)));
}

export function historicalAuthorityVersionSetHash(input: {
  readonly ruleVersions: readonly HistoricalMinimalRuleVersion[];
  readonly recurrenceStateVersions: readonly HistoricalRecurrenceStateVersion[];
}): string {
  assertHistoricalAuthorityVersionSet(input);
  return bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({
    ruleVersions: [...input.ruleVersions].sort((left, right) => left.ruleVersionId.localeCompare(right.ruleVersionId)),
    recurrenceStateVersions: [...input.recurrenceStateVersions].sort((left, right) => left.stateVersionId.localeCompare(right.stateVersionId)),
  }))));
}
