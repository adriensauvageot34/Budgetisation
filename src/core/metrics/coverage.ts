import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../validation";

export type CoverageLevel = "complete" | "partial";

export type Coverage =
  | {
      readonly level: "complete";
    }
  | {
      readonly level: "partial";
      readonly coveredShare?: number;
    };

const coverageLevels: ReadonlySet<string> = new Set<CoverageLevel>([
  "complete",
  "partial",
]);

export function parseCoverage(value: unknown): Coverage {
  const record = parseStrictRecord(
    value,
    ["level", "coveredShare"],
    "Coverage",
  );
  const level = parseStringLiteral<CoverageLevel>(
    requireProperty(record, "level", "Coverage"),
    coverageLevels,
    "Coverage.level",
  );

  if (level === "complete") {
    if (hasOwn(record, "coveredShare")) {
      throw new TypeError("Coverage complete ne porte pas coveredShare.");
    }
    return { level };
  }

  if (!hasOwn(record, "coveredShare")) return { level };
  const coveredShare = record.coveredShare;
  if (
    typeof coveredShare !== "number" ||
    !Number.isFinite(coveredShare) ||
    coveredShare < 0 ||
    coveredShare > 1
  ) {
    throw new TypeError("Coverage.coveredShare doit être compris entre 0 et 1.");
  }
  return { level, coveredShare };
}
