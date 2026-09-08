import { hasOwn, parseStrictRecord, parseStringLiteral, requireProperty } from "../../core/validation";
import type { DataStatus } from "../../core/history-v2";
import type { GlobalPhenomenonQuality, GlobalTypedMeasure } from "./types";

const HASH = /^[0-9a-f]{64}$/u;
const DECIMAL = /^(?:0|-?[1-9]\d*)(?:\.\d+)?$/u;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9]\d*)$/u;
const knowledge = new Set<DataStatus>(["KNOWN", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE", "CONFLICT"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function optional<T>(record: Readonly<Record<string, unknown>>, key: string, parse: (value: unknown) => T): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  const result = value.map((entry) => text(entry, label));
  if (new Set(result).size !== result.length || result.some((entry, index) => index > 0 && result[index - 1].localeCompare(entry) >= 0)) throw new TypeError(`${label}_NON_CANONICAL`);
  return result;
}

export function parseGlobalTypedMeasure(value: unknown): GlobalTypedMeasure {
  const record = parseStrictRecord(value, ["kind", "value", "unit"], "GlobalTypedMeasure");
  const kind = parseStringLiteral<GlobalTypedMeasure["kind"]>(requireProperty(record, "kind", "GlobalTypedMeasure"), new Set(["MONEY", "DECIMAL", "RATIO", "COUNT"]), "GlobalTypedMeasure.kind");
  const parsedValue = text(requireProperty(record, "value", "GlobalTypedMeasure"), "GlobalTypedMeasure.value");
  if (!DECIMAL.test(parsedValue)) throw new TypeError("GLOBAL_TYPED_MEASURE_DECIMAL_INVALID");
  if ((kind === "COUNT" && !NON_NEGATIVE_INTEGER.test(parsedValue)) || (kind === "RATIO" && (Number(parsedValue) < 0 || Number(parsedValue) > 1))) throw new TypeError("GLOBAL_TYPED_MEASURE_DOMAIN_INVALID");
  return { kind, value: parsedValue, unit: text(requireProperty(record, "unit", "GlobalTypedMeasure"), "GlobalTypedMeasure.unit") };
}

export function parseGlobalPhenomenonQuality(value: unknown): GlobalPhenomenonQuality {
  const record = parseStrictRecord(value, ["knowledgeState", "supportStatus", "effectiveCoverage", "materialityStatus", "limitationCodes", "dataNature", "methodVersion", "inputHash"], "GlobalPhenomenonQuality");
  const supportStatus = optional<NonNullable<GlobalPhenomenonQuality["supportStatus"]>>(record, "supportStatus", (entry) => parseStringLiteral(entry, new Set(["INSUFFICIENT", "PARTIAL_SUPPORT", "SUFFICIENT", "STRONG"]), "GlobalPhenomenonQuality.supportStatus"));
  const effectiveCoverage = optional(record, "effectiveCoverage", (entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1) throw new TypeError("GLOBAL_PHENOMENON_COVERAGE_INVALID");
    return entry;
  });
  const materialityStatus = optional<NonNullable<GlobalPhenomenonQuality["materialityStatus"]>>(record, "materialityStatus", (entry) => parseStringLiteral(entry, new Set(["MATERIAL", "NOT_MATERIAL", "UNKNOWN"]), "GlobalPhenomenonQuality.materialityStatus"));
  const inputHash = text(requireProperty(record, "inputHash", "GlobalPhenomenonQuality"), "GlobalPhenomenonQuality.inputHash");
  if (!HASH.test(inputHash)) throw new TypeError("GLOBAL_PHENOMENON_INPUT_HASH_INVALID");
  return {
    knowledgeState: parseStringLiteral<DataStatus>(requireProperty(record, "knowledgeState", "GlobalPhenomenonQuality"), knowledge, "GlobalPhenomenonQuality.knowledgeState"),
    ...(supportStatus === undefined ? {} : { supportStatus }),
    ...(effectiveCoverage === undefined ? {} : { effectiveCoverage }),
    ...(materialityStatus === undefined ? {} : { materialityStatus }),
    limitationCodes: strings(requireProperty(record, "limitationCodes", "GlobalPhenomenonQuality"), "GlobalPhenomenonQuality.limitations"),
    dataNature: parseStringLiteral(requireProperty(record, "dataNature", "GlobalPhenomenonQuality"), new Set(["OBSERVED", "DECLARED", "ESTIMATED", "HYBRID"]), "GlobalPhenomenonQuality.dataNature"),
    methodVersion: text(requireProperty(record, "methodVersion", "GlobalPhenomenonQuality"), "GlobalPhenomenonQuality.methodVersion"),
    inputHash,
  };
}
