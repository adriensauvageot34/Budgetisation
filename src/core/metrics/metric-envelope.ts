import {
  parseMetricUnit,
  parseMoney,
  type MetricUnit,
  type MonetaryMetricUnit,
  type Money,
} from "../money";
import { hasOwn, parseStrictRecord, requireProperty } from "../validation";
import { parseMethodVersion, type MethodVersion } from "../versions";
import { parseAvailability, type Availability } from "./availability";
import { parseCoverage, type Coverage } from "./coverage";
import { parseProvenance, type Provenance } from "./provenance";
import { parseReferenceMeta, type ReferenceMeta } from "./reference-meta";
import { parseSupport, type Support } from "./support";

export type MetricEnvelopeBase<U extends MetricUnit = MetricUnit> = {
  readonly unit: U;
  readonly coverage?: Coverage;
  readonly support?: Support;
  readonly provenance: Provenance;
  readonly reference?: ReferenceMeta;
  readonly methodVersion?: MethodVersion;
};

export type MetricEnvelope<T, U extends MetricUnit = MetricUnit> =
  | (MetricEnvelopeBase<U> & {
      readonly availability: "known";
      readonly value: T;
    })
  | (MetricEnvelopeBase<U> & {
      readonly availability: "unknown" | "not_applicable" | "conflict";
      readonly value: null;
    });

export type MetricValueParser<T> = (value: unknown) => T;

export type MetricEnvelopeParserConfig<T, U extends MetricUnit> = {
  readonly parseValue: MetricValueParser<T>;
  readonly allowedUnits: readonly U[];
};

function parseOptionalCoverage(
  record: Readonly<Record<string, unknown>>,
): Coverage | undefined {
  return hasOwn(record, "coverage")
    ? parseCoverage(record.coverage)
    : undefined;
}

function parseOptionalSupport(
  record: Readonly<Record<string, unknown>>,
): Support | undefined {
  return hasOwn(record, "support") ? parseSupport(record.support) : undefined;
}

function parseOptionalReference(
  record: Readonly<Record<string, unknown>>,
): ReferenceMeta | undefined {
  return hasOwn(record, "reference")
    ? parseReferenceMeta(record.reference)
    : undefined;
}

function parseOptionalMethodVersion(
  record: Readonly<Record<string, unknown>>,
): MethodVersion | undefined {
  return hasOwn(record, "methodVersion")
    ? parseMethodVersion(record.methodVersion)
    : undefined;
}

export function createMetricEnvelopeParser<T, U extends MetricUnit>(
  config: MetricEnvelopeParserConfig<T, U>,
): (value: unknown) => MetricEnvelope<T, U> {
  const allowedUnits: ReadonlySet<string> = new Set(config.allowedUnits);

  return (value: unknown): MetricEnvelope<T, U> => {
    const record = parseStrictRecord(
      value,
      [
        "availability",
        "value",
        "unit",
        "coverage",
        "support",
        "provenance",
        "reference",
        "methodVersion",
      ],
      "MetricEnvelope",
    );
    const availability: Availability = parseAvailability(
      requireProperty(record, "availability", "MetricEnvelope"),
    );
    const parsedUnit = parseMetricUnit(
      requireProperty(record, "unit", "MetricEnvelope"),
    );
    if (!allowedUnits.has(parsedUnit)) {
      throw new TypeError("MetricEnvelope.unit n'est pas autorisée pour cette valeur.");
    }
    const unit = parsedUnit as U;
    const provenance = parseProvenance(
      requireProperty(record, "provenance", "MetricEnvelope"),
    );
    const coverage = parseOptionalCoverage(record);
    const support = parseOptionalSupport(record);
    const reference = parseOptionalReference(record);
    const methodVersion = parseOptionalMethodVersion(record);
    const base: MetricEnvelopeBase<U> = {
      unit,
      provenance,
      ...(coverage === undefined ? {} : { coverage }),
      ...(support === undefined ? {} : { support }),
      ...(reference === undefined ? {} : { reference }),
      ...(methodVersion === undefined ? {} : { methodVersion }),
    };
    const rawValue = requireProperty(record, "value", "MetricEnvelope");

    if (availability === "known") {
      if (rawValue === null) {
        throw new TypeError("MetricEnvelope known exige une valeur non nulle.");
      }
      return {
        ...base,
        availability,
        value: config.parseValue(rawValue),
      };
    }

    if (rawValue !== null) {
      throw new TypeError(
        "MetricEnvelope non disponible exige exactement value: null.",
      );
    }
    return { ...base, availability, value: null };
  };
}

const monetaryMetricUnits = [
  "EUR",
  "EUR/day",
  "EUR/week",
  "EUR/month",
  "EUR/occurrence",
] as const satisfies readonly MonetaryMetricUnit[];

export const parseMoneyMetricEnvelope = createMetricEnvelopeParser<
  Money,
  MonetaryMetricUnit
>({
  parseValue: parseMoney,
  allowedUnits: monetaryMetricUnits,
});
