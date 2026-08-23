import { getMetricRegistryEntry, isActiveMetricId } from "../../analytics/production";
import {
  createMetricEnvelopeParser,
  parseMoneyMetricEnvelope,
} from "../../core/metrics";
import { parseAnalysisSubject } from "../../core/scope";
import {
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type {
  CountMetricEnvelope,
  PeriodCompleteness,
  ReadModelSubject,
  ScopedMetricReadModel,
  ScopedCountMetricReadModel,
  ScopedMoneyMetricReadModel,
} from "./types";

const periodCompletenessValues: ReadonlySet<string> = new Set<PeriodCompleteness>([
  "complete",
  "partial",
  "unknown",
  "not_applicable",
]);
const scopeHashPattern = /^[0-9a-f]{64}$/;

const parseCountMetricEnvelope = createMetricEnvelopeParser<
  number,
  "count" | "count/month"
>({
  parseValue(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new TypeError("Une métrique count exige un entier positif ou nul.");
    }
    return value;
  },
  allowedUnits: ["count", "count/month"],
});

export function parsePeriodCompleteness(value: unknown): PeriodCompleteness {
  return parseStringLiteral<PeriodCompleteness>(
    value,
    periodCompletenessValues,
    "PeriodCompleteness",
  );
}

export function parseReadModelSubject(value: unknown): ReadModelSubject {
  return parseAnalysisSubject(value);
}

export function parseMoneyEnvelope(value: unknown) {
  return parseMoneyMetricEnvelope(value);
}

export function parseCountEnvelope(value: unknown): CountMetricEnvelope {
  return parseCountMetricEnvelope(value);
}

export function parseScopedMetricReadModel(
  value: unknown,
): ScopedMetricReadModel {
  const record = parseStrictRecord(
    value,
    ["metricId", "scopeHash", "envelope"],
    "ScopedMetricReadModel",
  );
  const metricId = requireProperty(record, "metricId", "ScopedMetricReadModel");
  if (!isActiveMetricId(metricId)) {
    throw new TypeError("ScopedMetricReadModel.metricId doit être actif.");
  }
  const definition = getMetricRegistryEntry(metricId);
  const scopeHash = requireProperty(
    record,
    "scopeHash",
    "ScopedMetricReadModel",
  );
  if (typeof scopeHash !== "string" || !scopeHashPattern.test(scopeHash)) {
    throw new TypeError("ScopedMetricReadModel.scopeHash est invalide.");
  }
  const envelope =
    definition.outputKind === "money"
      ? parseMoneyMetricEnvelope(
          requireProperty(record, "envelope", "ScopedMetricReadModel"),
        )
      : parseCountMetricEnvelope(
          requireProperty(record, "envelope", "ScopedMetricReadModel"),
        );
  if (envelope.unit !== definition.unit) {
    throw new TypeError("ScopedMetricReadModel.unit est incohérente.");
  }
  if (envelope.provenance !== definition.provenanceRule) {
    throw new TypeError("ScopedMetricReadModel.provenance est incohérente.");
  }
  if (
    envelope.methodVersion === undefined ||
    envelope.methodVersion !== definition.methodVersion
  ) {
    throw new TypeError("ScopedMetricReadModel.methodVersion est incohérente.");
  }
  if (
    envelope.support !== undefined &&
    envelope.support.unit !== definition.supportPolicy.unit
  ) {
    throw new TypeError("ScopedMetricReadModel.SupportUnit est incohérente.");
  }
  if (
    (definition.referenceMethod !== undefined &&
      envelope.reference === undefined) ||
    (definition.referenceMethod === undefined &&
      envelope.reference !== undefined)
  ) {
    throw new TypeError("ScopedMetricReadModel.ReferenceMeta est incohérente.");
  }
  if (
    envelope.availability === "known" &&
    definition.supportPolicy.kind !== "optional" &&
    envelope.support === undefined
  ) {
    throw new TypeError("Une métrique connue exige son Support qualifié.");
  }
  return { metricId: definition.metricId, scopeHash, envelope } as ScopedMetricReadModel;
}

export function parseScopedMoneyMetricReadModel(
  value: unknown,
): ScopedMoneyMetricReadModel {
  const metric = parseScopedMetricReadModel(value);
  if (getMetricRegistryEntry(metric.metricId).outputKind !== "money") {
    throw new TypeError("Une métrique monétaire était attendue.");
  }
  return metric as ScopedMoneyMetricReadModel;
}

export function parseScopedCountMetricReadModel(
  value: unknown,
): ScopedCountMetricReadModel {
  const metric = parseScopedMetricReadModel(value);
  if (getMetricRegistryEntry(metric.metricId).outputKind !== "count") {
    throw new TypeError("Une métrique de comptage était attendue.");
  }
  return metric as ScopedCountMetricReadModel;
}
