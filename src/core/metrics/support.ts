import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type UnknownRecord,
} from "../validation";

export type SupportLevel = "sufficient" | "limited" | "insufficient";

export type SupportUnit =
  | "transaction"
  | "month"
  | "day"
  | "week"
  | "person_day"
  | "occurrence"
  | "purchase_event"
  | "place_visit"
  | "independent_28d_block"
  | "paired_observation"
  | "year";

export type Support = {
  readonly n: number;
  readonly unit: SupportUnit;
  readonly eligibleN?: number;
  readonly observableN?: number;
  readonly excludedN?: number;
  readonly level: SupportLevel;
};

const supportLevels: ReadonlySet<string> = new Set<SupportLevel>([
  "sufficient",
  "limited",
  "insufficient",
]);
const supportUnits: ReadonlySet<string> = new Set<SupportUnit>([
  "transaction",
  "month",
  "day",
  "week",
  "person_day",
  "occurrence",
  "purchase_event",
  "place_visit",
  "independent_28d_block",
  "paired_observation",
  "year",
]);

function parseCounter(value: unknown, fieldName: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new TypeError(`${fieldName} doit être un entier fini positif ou nul.`);
  }
  return value;
}

function parseOptionalCounter(
  record: UnknownRecord,
  key: "eligibleN" | "observableN" | "excludedN",
): number | undefined {
  return hasOwn(record, key)
    ? parseCounter(record[key], `Support.${key}`)
    : undefined;
}

export function parseSupport(value: unknown): Support {
  const record = parseStrictRecord(
    value,
    ["n", "unit", "eligibleN", "observableN", "excludedN", "level"],
    "Support",
  );
  const n = parseCounter(requireProperty(record, "n", "Support"), "Support.n");
  const unit = parseStringLiteral<SupportUnit>(
    requireProperty(record, "unit", "Support"),
    supportUnits,
    "Support.unit",
  );
  const level = parseStringLiteral<SupportLevel>(
    requireProperty(record, "level", "Support"),
    supportLevels,
    "Support.level",
  );
  const eligibleN = parseOptionalCounter(record, "eligibleN");
  const observableN = parseOptionalCounter(record, "observableN");
  const excludedN = parseOptionalCounter(record, "excludedN");

  if (eligibleN !== undefined && n > eligibleN) {
    throw new TypeError("Support doit respecter n <= eligibleN.");
  }
  if (observableN !== undefined && (eligibleN ?? n) > observableN) {
    throw new TypeError(
      "Support doit respecter n <= eligibleN <= observableN lorsque présents.",
    );
  }

  return {
    n,
    unit,
    level,
    ...(eligibleN === undefined ? {} : { eligibleN }),
    ...(observableN === undefined ? {} : { observableN }),
    ...(excludedN === undefined ? {} : { excludedN }),
  };
}
