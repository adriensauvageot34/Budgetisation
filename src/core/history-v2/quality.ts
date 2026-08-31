import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
  type RuntimeSchema,
  type UnknownRecord,
} from "../validation";
import {
  parseHistoryV2ReasonCode,
  type HistoryV2ReasonCode,
} from "./reason-codes";

export type DataStatus =
  | "KNOWN"
  | "PARTIAL"
  | "UNKNOWN"
  | "NOT_APPLICABLE"
  | "CONFLICT";

export type PartialMeaning = "LOWER_BOUND" | "OBSERVED_ONLY";
export type CoverageLevel = "low" | "medium" | "high";
export type SupportLevel = "insufficient" | "limited" | "sufficient";
export type ProvenanceKind =
  | "OBSERVED_CANONICAL"
  | "ASSERTED_CANONICAL"
  | "DERIVED"
  | "IMPORTED"
  | "MANUAL";

export type Coverage = {
  readonly ratio?: number;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly unit?: string;
  readonly basis: string;
  readonly level?: CoverageLevel;
};

export type Support = {
  readonly n?: number;
  readonly level: SupportLevel;
  readonly basis: string;
  readonly requiredByPolicy?: string;
};

export type Provenance = {
  readonly kind: ProvenanceKind;
  readonly sourceRefs?: readonly string[];
  readonly authority?: string;
  readonly methodId?: string;
  readonly methodVersion?: string;
  readonly evidenceRefs?: readonly string[];
};

export type QualityBadge = string;

export type QualityEnvelope = {
  readonly coverage?: Coverage;
  readonly support?: Support;
  readonly provenance?: Provenance;
  readonly reasonCode?: HistoryV2ReasonCode;
  readonly badges?: readonly QualityBadge[];
};

export type MetricValue<T> =
  | {
      readonly status: "KNOWN";
      readonly value: T;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly status: "PARTIAL";
      readonly value: T;
      readonly partialMeaning: PartialMeaning;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
      readonly quality?: QualityEnvelope;
    };

export type CollectionValue<T> =
  | {
      readonly status: "KNOWN";
      readonly items: readonly T[];
      readonly totalCount: number;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly status: "PARTIAL";
      readonly items: readonly T[];
      readonly partialMeaning: "OBSERVED_ONLY";
      readonly knownCount: number;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly status: "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
      readonly quality?: QualityEnvelope;
    };

export type HistoryV2Result<T> = MetricValue<T> | CollectionValue<T>;

const dataStatuses: ReadonlySet<string> = new Set<DataStatus>([
  "KNOWN",
  "PARTIAL",
  "UNKNOWN",
  "NOT_APPLICABLE",
  "CONFLICT",
]);
const partialMeanings: ReadonlySet<string> = new Set<PartialMeaning>([
  "LOWER_BOUND",
  "OBSERVED_ONLY",
]);
const coverageLevels: ReadonlySet<string> = new Set<CoverageLevel>([
  "low",
  "medium",
  "high",
]);
const supportLevels: ReadonlySet<string> = new Set<SupportLevel>([
  "insufficient",
  "limited",
  "sufficient",
]);
const provenanceKinds: ReadonlySet<string> = new Set<ProvenanceKind>([
  "OBSERVED_CANONICAL",
  "ASSERTED_CANONICAL",
  "DERIVED",
  "IMPORTED",
  "MANUAL",
]);
const badgePattern = /^[A-Z][A-Z0-9_]*$/;

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} doit être une chaîne non vide.`);
  }
  return value;
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new TypeError(`${fieldName} doit être un entier positif ou nul.`);
  }
  return value;
}

function parseNonNegativeNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${fieldName} doit être un nombre fini positif ou nul.`);
  }
  return value;
}

function parseOptionalString(
  record: UnknownRecord,
  key: string,
  typeName: string,
): string | undefined {
  return hasOwn(record, key)
    ? parseNonEmptyString(record[key], `${typeName}.${key}`)
    : undefined;
}

function parseStringArray(value: unknown, fieldName: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} doit être un tableau.`);
  }
  const parsed = value.map((entry, index) =>
    parseNonEmptyString(entry, `${fieldName}[${index}]`));
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError(`${fieldName} contient un doublon.`);
  }
  return parsed;
}

export function parseDataStatus(value: unknown): DataStatus {
  return parseStringLiteral<DataStatus>(
    value,
    dataStatuses,
    "DataStatus",
  );
}

export function parsePartialMeaning(value: unknown): PartialMeaning {
  return parseStringLiteral<PartialMeaning>(
    value,
    partialMeanings,
    "PartialMeaning",
  );
}

export function parseCoverage(value: unknown): Coverage {
  const record = parseStrictRecord(
    value,
    ["ratio", "numerator", "denominator", "unit", "basis", "level"],
    "HistoryV2Coverage",
  );
  const ratio = hasOwn(record, "ratio")
    ? parseNonNegativeNumber(record.ratio, "HistoryV2Coverage.ratio")
    : undefined;
  if (ratio !== undefined && ratio > 1) {
    throw new TypeError("HistoryV2Coverage.ratio doit être compris entre 0 et 1.");
  }
  const numerator = hasOwn(record, "numerator")
    ? parseNonNegativeNumber(record.numerator, "HistoryV2Coverage.numerator")
    : undefined;
  const denominator = hasOwn(record, "denominator")
    ? parseNonNegativeNumber(record.denominator, "HistoryV2Coverage.denominator")
    : undefined;
  if ((numerator === undefined) !== (denominator === undefined)) {
    throw new TypeError(
      "HistoryV2Coverage.numerator et denominator doivent être présents ensemble.",
    );
  }
  if (denominator !== undefined && denominator === 0) {
    throw new TypeError("HistoryV2Coverage.denominator doit être strictement positif.");
  }
  if (
    numerator !== undefined
    && denominator !== undefined
    && numerator > denominator
  ) {
    throw new TypeError("HistoryV2Coverage doit respecter numerator <= denominator.");
  }
  if (
    ratio !== undefined
    && numerator !== undefined
    && denominator !== undefined
    && Math.abs(ratio - numerator / denominator) > Number.EPSILON * 8
  ) {
    throw new TypeError("HistoryV2Coverage.ratio ne correspond pas au quotient déclaré.");
  }
  const basis = parseNonEmptyString(
    requireProperty(record, "basis", "HistoryV2Coverage"),
    "HistoryV2Coverage.basis",
  );
  const unit = parseOptionalString(record, "unit", "HistoryV2Coverage");
  const level = hasOwn(record, "level")
    ? parseStringLiteral<CoverageLevel>(
        record.level,
        coverageLevels,
        "HistoryV2Coverage.level",
      )
    : undefined;
  return {
    basis,
    ...(ratio === undefined ? {} : { ratio }),
    ...(numerator === undefined ? {} : { numerator }),
    ...(denominator === undefined ? {} : { denominator }),
    ...(unit === undefined ? {} : { unit }),
    ...(level === undefined ? {} : { level }),
  };
}

export function parseSupport(value: unknown): Support {
  const record = parseStrictRecord(
    value,
    ["n", "level", "basis", "requiredByPolicy"],
    "HistoryV2Support",
  );
  const n = hasOwn(record, "n")
    ? parseNonNegativeInteger(record.n, "HistoryV2Support.n")
    : undefined;
  const level = parseStringLiteral<SupportLevel>(
    requireProperty(record, "level", "HistoryV2Support"),
    supportLevels,
    "HistoryV2Support.level",
  );
  const basis = parseNonEmptyString(
    requireProperty(record, "basis", "HistoryV2Support"),
    "HistoryV2Support.basis",
  );
  const requiredByPolicy = parseOptionalString(
    record,
    "requiredByPolicy",
    "HistoryV2Support",
  );
  return {
    level,
    basis,
    ...(n === undefined ? {} : { n }),
    ...(requiredByPolicy === undefined ? {} : { requiredByPolicy }),
  };
}

export function parseProvenance(value: unknown): Provenance {
  const record = parseStrictRecord(
    value,
    [
      "kind",
      "sourceRefs",
      "authority",
      "methodId",
      "methodVersion",
      "evidenceRefs",
    ],
    "HistoryV2Provenance",
  );
  const kind = parseStringLiteral<ProvenanceKind>(
    requireProperty(record, "kind", "HistoryV2Provenance"),
    provenanceKinds,
    "HistoryV2Provenance.kind",
  );
  const sourceRefs = hasOwn(record, "sourceRefs")
    ? parseStringArray(record.sourceRefs, "HistoryV2Provenance.sourceRefs")
    : undefined;
  const evidenceRefs = hasOwn(record, "evidenceRefs")
    ? parseStringArray(record.evidenceRefs, "HistoryV2Provenance.evidenceRefs")
    : undefined;
  const authority = parseOptionalString(record, "authority", "HistoryV2Provenance");
  const methodId = parseOptionalString(record, "methodId", "HistoryV2Provenance");
  const methodVersion = parseOptionalString(
    record,
    "methodVersion",
    "HistoryV2Provenance",
  );
  return {
    kind,
    ...(sourceRefs === undefined ? {} : { sourceRefs }),
    ...(authority === undefined ? {} : { authority }),
    ...(methodId === undefined ? {} : { methodId }),
    ...(methodVersion === undefined ? {} : { methodVersion }),
    ...(evidenceRefs === undefined ? {} : { evidenceRefs }),
  };
}

function parseQualityBadge(value: unknown): QualityBadge {
  if (typeof value !== "string" || !badgePattern.test(value)) {
    throw new TypeError("QualityBadge doit être un code machine UPPER_SNAKE_CASE.");
  }
  return value;
}

export function parseQualityEnvelope(value: unknown): QualityEnvelope {
  const record = parseStrictRecord(
    value,
    ["coverage", "support", "provenance", "reasonCode", "badges"],
    "QualityEnvelopeV2",
  );
  const coverage = hasOwn(record, "coverage")
    ? withValidationPath("coverage", () => parseCoverage(record.coverage))
    : undefined;
  const support = hasOwn(record, "support")
    ? withValidationPath("support", () => parseSupport(record.support))
    : undefined;
  const provenance = hasOwn(record, "provenance")
    ? withValidationPath("provenance", () => parseProvenance(record.provenance))
    : undefined;
  const reasonCode = hasOwn(record, "reasonCode")
    ? withValidationPath("reasonCode", () =>
        parseHistoryV2ReasonCode(record.reasonCode))
    : undefined;
  const badges = hasOwn(record, "badges")
    ? (() => {
        if (!Array.isArray(record.badges)) {
          throw new TypeError("QualityEnvelopeV2.badges doit être un tableau.");
        }
        const values = record.badges.map((badge, index) =>
          withValidationPath(index, () => parseQualityBadge(badge)));
        if (new Set(values).size !== values.length) {
          throw new TypeError("QualityEnvelopeV2.badges contient un doublon.");
        }
        return values;
      })()
    : undefined;
  return {
    ...(coverage === undefined ? {} : { coverage }),
    ...(support === undefined ? {} : { support }),
    ...(provenance === undefined ? {} : { provenance }),
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(badges === undefined ? {} : { badges }),
  };
}

function parseOptionalQuality(
  record: UnknownRecord,
  typeName: string,
): QualityEnvelope | undefined {
  return hasOwn(record, "quality")
    ? withValidationPath("quality", () => parseQualityEnvelope(record.quality))
    : undefined;
}

export function createMetricValueSchema<T>(
  valueSchema: RuntimeSchema<T>,
): RuntimeSchema<MetricValue<T>> {
  return createRuntimeSchema((value: unknown) => {
    const record = parseStrictRecord(
      value,
      ["status", "value", "partialMeaning", "quality"],
      "MetricValueV2",
    );
    const status = parseDataStatus(
      requireProperty(record, "status", "MetricValueV2"),
    );
    const quality = parseOptionalQuality(record, "MetricValueV2");
    if (status === "KNOWN") {
      if (hasOwn(record, "partialMeaning")) {
        throw new TypeError("MetricValueV2 KNOWN ne porte pas partialMeaning.");
      }
      return {
        status,
        value: withValidationPath("value", () =>
          valueSchema.parse(requireProperty(record, "value", "MetricValueV2"))),
        ...(quality === undefined ? {} : { quality }),
      };
    }
    if (status === "PARTIAL") {
      return {
        status,
        value: withValidationPath("value", () =>
          valueSchema.parse(requireProperty(record, "value", "MetricValueV2"))),
        partialMeaning: parsePartialMeaning(
          requireProperty(record, "partialMeaning", "MetricValueV2"),
        ),
        ...(quality === undefined ? {} : { quality }),
      };
    }
    if (hasOwn(record, "value") || hasOwn(record, "partialMeaning")) {
      throw new TypeError(
        "MetricValueV2 UNKNOWN/NOT_APPLICABLE/CONFLICT ne porte ni value ni partialMeaning.",
      );
    }
    return { status, ...(quality === undefined ? {} : { quality }) };
  });
}

export function createCollectionValueSchema<T>(
  itemSchema: RuntimeSchema<T>,
): RuntimeSchema<CollectionValue<T>> {
  return createRuntimeSchema((value: unknown) => {
    const record = parseStrictRecord(
      value,
      ["status", "items", "partialMeaning", "knownCount", "totalCount", "quality"],
      "CollectionValueV2",
    );
    const status = parseDataStatus(
      requireProperty(record, "status", "CollectionValueV2"),
    );
    const quality = parseOptionalQuality(record, "CollectionValueV2");
    if (status === "KNOWN" || status === "PARTIAL") {
      const rawItems = requireProperty(record, "items", "CollectionValueV2");
      if (!Array.isArray(rawItems)) {
        throw new TypeError("CollectionValueV2.items doit être un tableau.");
      }
      const items = rawItems.map((item, index) =>
        withValidationPath(index, () => itemSchema.parse(item)));
      if (status === "KNOWN") {
        if (hasOwn(record, "knownCount") || hasOwn(record, "partialMeaning")) {
          throw new TypeError(
            "CollectionValueV2 KNOWN ne porte ni knownCount ni partialMeaning.",
          );
        }
        const totalCount = parseNonNegativeInteger(
          requireProperty(record, "totalCount", "CollectionValueV2"),
          "CollectionValueV2.totalCount",
        );
        if (totalCount !== items.length) {
          throw new TypeError(
            "CollectionValueV2 KNOWN exige totalCount égal au nombre d'items.",
          );
        }
        return {
          status,
          items,
          totalCount,
          ...(quality === undefined ? {} : { quality }),
        };
      }
      if (hasOwn(record, "totalCount")) {
        throw new TypeError(
          "CollectionValueV2 PARTIAL ne peut pas publier totalCount.",
        );
      }
      const partialMeaning = parsePartialMeaning(
        requireProperty(record, "partialMeaning", "CollectionValueV2"),
      );
      if (partialMeaning !== "OBSERVED_ONLY") {
        throw new TypeError(
          "CollectionValueV2 PARTIAL exige OBSERVED_ONLY.",
        );
      }
      const knownCount = parseNonNegativeInteger(
        requireProperty(record, "knownCount", "CollectionValueV2"),
        "CollectionValueV2.knownCount",
      );
      if (knownCount !== items.length) {
        throw new TypeError(
          "CollectionValueV2 PARTIAL exige knownCount égal au nombre d'items.",
        );
      }
      return {
        status,
        items,
        partialMeaning,
        knownCount,
        ...(quality === undefined ? {} : { quality }),
      };
    }
    if (
      hasOwn(record, "items")
      || hasOwn(record, "partialMeaning")
      || hasOwn(record, "knownCount")
      || hasOwn(record, "totalCount")
    ) {
      throw new TypeError(
        "CollectionValueV2 non résolue ne porte ni items ni compteurs.",
      );
    }
    return { status, ...(quality === undefined ? {} : { quality }) };
  });
}

export const dataStatusSchema = createRuntimeSchema(parseDataStatus);
export const partialMeaningSchema = createRuntimeSchema(parsePartialMeaning);
export const coverageSchema = createRuntimeSchema(parseCoverage);
export const supportSchema = createRuntimeSchema(parseSupport);
export const provenanceSchema = createRuntimeSchema(parseProvenance);
export const qualityEnvelopeSchema = createRuntimeSchema(parseQualityEnvelope);
