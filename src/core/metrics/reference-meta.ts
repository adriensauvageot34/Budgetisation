import {
  addDays,
  addMonths,
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  type GlobalWindow,
  type LocalDate,
  type YearMonth,
} from "../time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  type UnknownRecord,
} from "../validation";

export type ReferenceFamily = "comparison" | "current";

export type ReferenceTarget =
  | {
      readonly kind: "month";
      readonly month: YearMonth;
    }
  | {
      readonly kind: "day";
      readonly date: LocalDate;
    };

export type ReferenceWindowMeta = {
  readonly start: LocalDate;
  readonly endExclusive: LocalDate;
};

export type ReferenceMeta =
  | {
      readonly family: "comparison";
      readonly asOf: YearMonth;
      readonly target: ReferenceTarget;
      readonly requestedObservationWindow?: GlobalWindow;
      readonly effectiveWindow?: ReferenceWindowMeta;
    }
  | {
      readonly family: "current";
      readonly asOf: YearMonth;
      readonly requestedObservationWindow?: GlobalWindow;
      readonly effectiveWindow?: ReferenceWindowMeta;
    };

const referenceFamilies: ReadonlySet<string> = new Set<ReferenceFamily>([
  "comparison",
  "current",
]);
const targetKinds: ReadonlySet<string> = new Set<ReferenceTarget["kind"]>([
  "month",
  "day",
]);

function parseReferenceTarget(value: unknown): ReferenceTarget {
  const candidate = parseStrictRecord(
    value,
    ["kind", "month", "date"],
    "ReferenceTarget",
  );
  const kind = parseStringLiteral<ReferenceTarget["kind"]>(
    requireProperty(candidate, "kind", "ReferenceTarget"),
    targetKinds,
    "ReferenceTarget.kind",
  );

  if (kind === "month") {
    const record = parseStrictRecord(value, ["kind", "month"], "ReferenceTarget");
    return {
      kind,
      month: parseYearMonth(requireProperty(record, "month", "ReferenceTarget")),
    };
  }

  const record = parseStrictRecord(value, ["kind", "date"], "ReferenceTarget");
  return {
    kind,
    date: parseLocalDate(requireProperty(record, "date", "ReferenceTarget")),
  };
}

function parseReferenceWindow(value: unknown): ReferenceWindowMeta {
  const record = parseStrictRecord(
    value,
    ["start", "endExclusive"],
    "ReferenceWindowMeta",
  );
  const start = parseLocalDate(
    requireProperty(record, "start", "ReferenceWindowMeta"),
  );
  const endExclusive = parseLocalDate(
    requireProperty(record, "endExclusive", "ReferenceWindowMeta"),
  );
  if (start >= endExclusive) {
    throw new TypeError(
      "ReferenceWindowMeta doit respecter [start, endExclusive).",
    );
  }
  return { start, endExclusive };
}

function parseOptionalWindow(
  record: UnknownRecord,
): ReferenceWindowMeta | undefined {
  return hasOwn(record, "effectiveWindow")
    ? parseReferenceWindow(record.effectiveWindow)
    : undefined;
}

function parseOptionalObservationWindow(
  record: UnknownRecord,
): GlobalWindow | undefined {
  return hasOwn(record, "requestedObservationWindow")
    ? parseGlobalWindow(record.requestedObservationWindow)
    : undefined;
}

function targetBounds(target: ReferenceTarget): ReferenceWindowMeta {
  if (target.kind === "day") {
    return { start: target.date, endExclusive: addDays(target.date, 1) };
  }
  return {
    start: parseLocalDate(`${target.month}-01`),
    endExclusive: parseLocalDate(`${addMonths(target.month, 1)}-01`),
  };
}

function assertTargetExcluded(
  target: ReferenceTarget,
  effectiveWindow: ReferenceWindowMeta,
): void {
  const targetWindow = targetBounds(target);
  const overlaps =
    effectiveWindow.start < targetWindow.endExclusive &&
    targetWindow.start < effectiveWindow.endExclusive;
  if (overlaps) {
    throw new TypeError(
      "ReferenceMeta.effectiveWindow doit exclure la période cible.",
    );
  }
}

export function parseReferenceMeta(value: unknown): ReferenceMeta {
  const candidate = parseStrictRecord(
    value,
    [
      "family",
      "asOf",
      "target",
      "requestedObservationWindow",
      "effectiveWindow",
    ],
    "ReferenceMeta",
  );
  const family = parseStringLiteral<ReferenceFamily>(
    requireProperty(candidate, "family", "ReferenceMeta"),
    referenceFamilies,
    "ReferenceMeta.family",
  );

  if (family === "comparison") {
    const record = parseStrictRecord(
      value,
      [
        "family",
        "asOf",
        "target",
        "requestedObservationWindow",
        "effectiveWindow",
      ],
      "ReferenceMeta",
    );
    const asOf = parseYearMonth(requireProperty(record, "asOf", "ReferenceMeta"));
    const target = parseReferenceTarget(
      requireProperty(record, "target", "ReferenceMeta"),
    );
    const requestedObservationWindow = parseOptionalObservationWindow(record);
    const effectiveWindow = parseOptionalWindow(record);
    if (effectiveWindow) assertTargetExcluded(target, effectiveWindow);

    return {
      family,
      asOf,
      target,
      ...(requestedObservationWindow === undefined
        ? {}
        : { requestedObservationWindow }),
      ...(effectiveWindow === undefined ? {} : { effectiveWindow }),
    };
  }

  const record = parseStrictRecord(
    value,
    ["family", "asOf", "requestedObservationWindow", "effectiveWindow"],
    "ReferenceMeta",
  );
  const asOf = parseYearMonth(requireProperty(record, "asOf", "ReferenceMeta"));
  const requestedObservationWindow = parseOptionalObservationWindow(record);
  const effectiveWindow = parseOptionalWindow(record);
  return {
    family,
    asOf,
    ...(requestedObservationWindow === undefined
      ? {}
      : { requestedObservationWindow }),
    ...(effectiveWindow === undefined ? {} : { effectiveWindow }),
  };
}
