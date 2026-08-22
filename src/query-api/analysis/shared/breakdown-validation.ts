import {
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../../analytics/production";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import {
  analysisMeasuresByDimension,
  type AnalysisBreakdownDimension,
  type QueryResourceKey,
} from "../../request";
import { parseScopedMetricReadModel } from "../../read-models";
import type {
  AnalysisBreakdownFlag,
  AnalysisBreakdownReadModel,
  AnalysisBreakdownRow,
  AnalysisReconciliation,
  AnalysisStructureAxis,
  AnalysisStructureReadModel,
  BreakdownBucketIdentity,
} from "./types";
import { parseMoneyComparisonResult } from "./validation";

const reconciliations: ReadonlySet<string> = new Set<AnalysisReconciliation>([
  "exact",
  "partial",
  "not_applicable",
]);
const structureAxes: readonly AnalysisStructureAxis[] = [
  "necessity",
  "fixed_variable",
  "life_scope",
];
const breakdownFlags: readonly AnalysisBreakdownFlag[] = [
  "partial_coverage",
  "conflict",
];

function parseLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} doit être un libellé non vide.`);
  }
  return value;
}

function parseReconciliation(value: unknown): AnalysisReconciliation {
  return parseStringLiteral<AnalysisReconciliation>(
    value,
    reconciliations,
    "AnalysisReconciliation",
  );
}

export function parseAnalysisStructureReadModel(
  value: unknown,
): AnalysisStructureReadModel {
  const record = parseStrictRecord(value, ["axes"], "AnalysisStructureReadModel");
  const rawAxes = requireProperty(record, "axes", "AnalysisStructureReadModel");
  if (!Array.isArray(rawAxes)) {
    throw new TypeError("AnalysisStructureReadModel.axes doit être un tableau.");
  }
  const axes = rawAxes.map((rawAxis) => {
    const axisRecord = parseStrictRecord(
      rawAxis,
      ["axis", "metric", "reconciliation"],
      "AnalysisStructureAxisReadModel",
    );
    const axis = parseStringLiteral<AnalysisStructureAxis>(
      requireProperty(axisRecord, "axis", "AnalysisStructureAxisReadModel"),
      new Set(structureAxes),
      "AnalysisStructureAxis",
    );
    const metric = parseScopedMetricReadModel(
      requireProperty(axisRecord, "metric", "AnalysisStructureAxisReadModel"),
    );
    if (axis !== "life_scope" || metric.metricId !== "life_scope_amount") {
      throw new TypeError(
        "Seule la structure life_scope possède actuellement une métrique active.",
      );
    }
    return {
      axis,
      metric,
      reconciliation: parseReconciliation(
        requireProperty(
          axisRecord,
          "reconciliation",
          "AnalysisStructureAxisReadModel",
        ),
      ),
    };
  });
  const axisNames = axes.map(({ axis }) => axis);
  if (
    new Set(axisNames).size !== axisNames.length ||
    axisNames.some((axis, index) => structureAxes.indexOf(axis) <= (index === 0 ? -1 : structureAxes.indexOf(axisNames[index - 1])))
  ) {
    throw new TypeError("Analysis structure axes doivent être uniques et ordonnés.");
  }
  return { axes };
}

function parseBucket(value: unknown): BreakdownBucketIdentity {
  const candidate = parseStrictRecord(
    value,
    ["kind", "entityId", "key"],
    "BreakdownBucketIdentity",
  );
  const kind = requireProperty(candidate, "kind", "BreakdownBucketIdentity");
  if (kind === "entity") {
    const record = parseStrictRecord(value, ["kind", "entityId"], "EntityBucket");
    return {
      kind,
      entityId: parseLabel(
        requireProperty(record, "entityId", "EntityBucket"),
        "EntityBucket.entityId",
      ),
    };
  }
  if (kind === "canonical") {
    const record = parseStrictRecord(value, ["kind", "key"], "CanonicalBucket");
    return {
      kind,
      key: parseLabel(
        requireProperty(record, "key", "CanonicalBucket"),
        "CanonicalBucket.key",
      ),
    };
  }
  if (kind === "undetermined" || kind === "remainder") {
    parseStrictRecord(value, ["kind"], "SpecialBreakdownBucket");
    return { kind };
  }
  throw new TypeError("BreakdownBucketIdentity.kind est invalide.");
}

function bucketKey(bucket: BreakdownBucketIdentity): string {
  if (bucket.kind === "entity") return `entity:${bucket.entityId}`;
  if (bucket.kind === "canonical") return `canonical:${bucket.key}`;
  return bucket.kind;
}

function parseBreakdownRow(
  value: unknown,
  measure: ActiveMetricId,
): AnalysisBreakdownRow {
  const record = parseStrictRecord(
    value,
    ["bucket", "label", "metric", "comparison", "rank", "flags"],
    "AnalysisBreakdownRow",
  );
  const bucket = parseBucket(
    requireProperty(record, "bucket", "AnalysisBreakdownRow"),
  );
  const label = parseLabel(
    requireProperty(record, "label", "AnalysisBreakdownRow"),
    "AnalysisBreakdownRow.label",
  );
  if (
    (bucket.kind === "undetermined" && label !== "À déterminer") ||
    (bucket.kind === "remainder" && label !== "Autres") ||
    (bucket.kind !== "undetermined" && label === "À déterminer") ||
    (bucket.kind !== "remainder" && label === "Autres")
  ) {
    throw new TypeError("À déterminer et Autres exigent leur bucket canonique.");
  }
  const metric = parseScopedMetricReadModel(
    requireProperty(record, "metric", "AnalysisBreakdownRow"),
  );
  if (metric.metricId !== measure) {
    throw new TypeError("Breakdown row MetricId est incohérente.");
  }
  const rank = hasOwn(record, "rank") ? record.rank : undefined;
  if (
    rank !== undefined &&
    (typeof rank !== "number" || !Number.isSafeInteger(rank) || rank < 1)
  ) {
    throw new TypeError("AnalysisBreakdownRow.rank est invalide.");
  }
  const rawFlags = requireProperty(record, "flags", "AnalysisBreakdownRow");
  if (!Array.isArray(rawFlags)) {
    throw new TypeError("AnalysisBreakdownRow.flags doit être un tableau.");
  }
  const flags = rawFlags.map((flag) =>
    parseStringLiteral<AnalysisBreakdownFlag>(
      flag,
      new Set(breakdownFlags),
      "AnalysisBreakdownFlag",
    ),
  );
  if (
    new Set(flags).size !== flags.length ||
    flags.some((flag, index) => breakdownFlags.indexOf(flag) <= (index === 0 ? -1 : breakdownFlags.indexOf(flags[index - 1])))
  ) {
    throw new TypeError("AnalysisBreakdownRow.flags sont invalides.");
  }
  return {
    bucket,
    label,
    metric,
    ...(hasOwn(record, "comparison")
      ? { comparison: parseMoneyComparisonResult(record.comparison) }
      : {}),
    ...(rank === undefined ? {} : { rank }),
    flags,
  };
}

export function parseAnalysisBreakdownReadModel(
  value: unknown,
  expectedResource: QueryResourceKey,
): AnalysisBreakdownReadModel {
  const record = parseStrictRecord(
    value,
    [
      "dimension",
      "measure",
      "rows",
      "remainder",
      "total",
      "reconciliation",
      "capabilities",
    ],
    "AnalysisBreakdownReadModel",
  );
  const dimension = requireProperty(
    record,
    "dimension",
    "AnalysisBreakdownReadModel",
  );
  if (
    typeof dimension !== "string" ||
    !Object.prototype.hasOwnProperty.call(analysisMeasuresByDimension, dimension)
  ) {
    throw new TypeError("Analysis breakdown dimension est invalide.");
  }
  const parsedDimension = dimension as AnalysisBreakdownDimension;
  const measure = requireProperty(
    record,
    "measure",
    "AnalysisBreakdownReadModel",
  );
  if (
    !isActiveMetricId(measure) ||
    !analysisMeasuresByDimension[parsedDimension].includes(measure as never)
  ) {
    throw new TypeError("Analysis breakdown measure est incompatible.");
  }
  const rawRows = requireProperty(record, "rows", "AnalysisBreakdownReadModel");
  if (!Array.isArray(rawRows)) {
    throw new TypeError("AnalysisBreakdownReadModel.rows doit être un tableau.");
  }
  const rows = rawRows.map((row) => parseBreakdownRow(row, measure));
  if (rows.some(({ bucket }) => bucket.kind === "remainder")) {
    throw new TypeError("Autres doit rester dans le champ remainder dédié.");
  }
  const rowKeys = rows.map(({ bucket }) => bucketKey(bucket));
  if (new Set(rowKeys).size !== rowKeys.length) {
    throw new TypeError("Analysis breakdown contient des buckets dupliqués.");
  }
  const rankedRows = rows.filter(
    (row): row is AnalysisBreakdownRow & { readonly rank: number } =>
      row.rank !== undefined,
  );
  if (
    rankedRows.some((row, index) => row.rank !== index + 1) ||
    (rankedRows.length > 0 && rankedRows.length !== rows.length)
  ) {
    throw new TypeError("Breakdown ranks doivent être complets et consécutifs.");
  }
  const remainder = hasOwn(record, "remainder")
    ? parseBreakdownRow(record.remainder, measure)
    : undefined;
  if (remainder !== undefined && remainder.bucket.kind !== "remainder") {
    throw new TypeError("Le remainder doit porter le bucket Autres.");
  }
  const total = hasOwn(record, "total")
    ? parseScopedMetricReadModel(record.total)
    : undefined;
  if (total !== undefined && total.metricId !== measure) {
    throw new TypeError("Breakdown total MetricId est incohérente.");
  }
  const reconciliation = parseReconciliation(
    requireProperty(record, "reconciliation", "AnalysisBreakdownReadModel"),
  );
  const definition = getMetricRegistryEntry(measure);
  const allMetrics = [
    ...rows.map(({ metric }) => metric),
    ...(remainder === undefined ? [] : [remainder.metric]),
    ...(total === undefined ? [] : [total]),
  ];
  const hasPartialCoverage = allMetrics.some(
    ({ envelope }) => envelope.coverage?.level === "partial",
  );
  if (
    reconciliation === "exact" &&
    (definition.additivity.kind !== "additive" || hasPartialCoverage)
  ) {
    throw new TypeError("La reconciliation exact exige additivité et coverage complète.");
  }
  if (
    definition.additivity.kind === "non_additive" &&
    reconciliation !== "not_applicable"
  ) {
    throw new TypeError("Une métrique non additive ne se réconcilie pas par somme.");
  }
  if (
    remainder !== undefined &&
    (definition.additivity.kind !== "additive" ||
      reconciliation !== "exact" ||
      hasPartialCoverage)
  ) {
    throw new TypeError("Autres exige un remainder additif exact.");
  }
  return {
    dimension: parsedDimension,
    measure,
    rows,
    ...(remainder === undefined ? {} : { remainder }),
    ...(total === undefined ? {} : { total }),
    reconciliation,
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "AnalysisBreakdownReadModel"),
      expectedResource,
    ),
  };
}

