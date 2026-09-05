import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseMoney } from "../../core/money";
import { parseYearMonth, type YearMonth } from "../../core/time";
import { medianMoney } from "../references";

/** P04 descriptive primitives only: no unapproved classification thresholds. */
export const globalTemporalDescriptivePolicy = Object.freeze({
  version: "global-temporal-descriptive@v1",
  trendWindow: 12,
  trendMinimum: 6,
  recentWindow: 3,
  quantileMethod: "LINEAR_TYPE_7",
});

export type GlobalTemporalPoint = {
  readonly month: YearMonth;
  readonly corpus: "CERTIFIED_HISTORY" | "LIVE_TAIL";
  readonly status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT" | "NOT_APPLICABLE";
  readonly value?: string;
  readonly eligible: boolean;
  readonly complete: boolean;
  readonly dependencyRefs: readonly string[];
  readonly ordinaryAuthority?: {
    readonly classification: "ORDINARY" | "EXCEPTIONAL";
    readonly evidenceRef: string;
  };
};

function median(values: readonly string[]): string {
  return medianMoney(values.map(parseMoney));
}

export function temporalMonthIndex(month: YearMonth): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export function normalizeGlobalTemporalPoints(input: {
  /** Last fully certified natural month, already resolved against asOf by P02. */
  readonly certifiedThroughMonth: YearMonth;
  readonly points: readonly GlobalTemporalPoint[];
}) {
  const boundary = parseYearMonth(input.certifiedThroughMonth);
  const points = new Map<YearMonth, GlobalTemporalPoint>();
  for (const raw of input.points) {
    const month = parseYearMonth(raw.month);
    if (raw.corpus !== "CERTIFIED_HISTORY" && raw.corpus !== "LIVE_TAIL") throw new TypeError("Corpus temporel invalide.");
    if (raw.corpus !== "CERTIFIED_HISTORY" || month > boundary) continue;
    if (Object.values(raw).some((value) => value === undefined)) {
      throw new TypeError("Une propriété optionnelle absente ne doit pas porter undefined.");
    }
    if ((raw.status === "KNOWN" || raw.status === "PARTIAL") !== (raw.value !== undefined)) {
      throw new TypeError("État et valeur temporelle incohérents.");
    }
    if (!["KNOWN", "PARTIAL", "UNKNOWN", "CONFLICT", "NOT_APPLICABLE"].includes(raw.status) ||
        typeof raw.eligible !== "boolean" || typeof raw.complete !== "boolean" ||
        !Array.isArray(raw.dependencyRefs) || raw.dependencyRefs.some((ref) => typeof ref !== "string" || ref.trim().length === 0)) {
      throw new TypeError("Qualification temporelle invalide.");
    }
    if (raw.ordinaryAuthority !== undefined &&
      (!["ORDINARY", "EXCEPTIONAL"].includes(raw.ordinaryAuthority.classification) || !raw.ordinaryAuthority.evidenceRef?.trim())) {
      throw new TypeError("Ordinary/exceptional classification requires explicit authority.");
    }
    const point = {
      ...raw,
      month,
      ...(raw.value === undefined ? {} : { value: parseMoney(raw.value) }),
      dependencyRefs: [...new Set([...raw.dependencyRefs, ...(raw.ordinaryAuthority === undefined ? [] : [raw.ordinaryAuthority.evidenceRef])])].sort(),
    };
    const existing = points.get(month);
    if (existing !== undefined && canonicalSerializeGlobal(existing) !== canonicalSerializeGlobal(point)) {
      throw new TypeError("Autorités mensuelles contradictoires.");
    }
    points.set(month, point);
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

const monthIndex = temporalMonthIndex;

export function buildGlobalTemporalDescriptive(input: {
  readonly certifiedThroughMonth: YearMonth;
  readonly points: readonly GlobalTemporalPoint[];
}) {
  const boundary = parseYearMonth(input.certifiedThroughMonth);
  const ordered = normalizeGlobalTemporalPoints(input);
  const selected = ordered.filter((p) => p.eligible && p.complete && p.status === "KNOWN").slice(-12);
  const values = selected.map((p) => p.value!);
  const support = {
    includedMonths: selected.map((p) => p.month),
    count: selected.length,
    minimumRequired: 6,
    calendarSpan: selected.length === 0 ? 0 : monthIndex(selected.at(-1)!.month) - monthIndex(selected[0].month) + 1,
  };
  const unknown = { status: "UNKNOWN" as const, reasonCode: "INSUFFICIENT_CERTIFIED_MONTHS" as const };
  const trend = (() => {
    if (selected.length < 6) return unknown;
    const slopes: string[] = [];
    for (let i = 0; i < selected.length; i += 1) {
      for (let j = i + 1; j < selected.length; j += 1) {
        slopes.push(new Big(values[j]).minus(values[i]).div(monthIndex(selected[j].month) - monthIndex(selected[i].month)).toFixed());
      }
    }
    const slope = median(slopes);
    const startIndex = monthIndex(selected[0].month);
    const intercept = median(selected.map((p) => new Big(p.value!).minus(new Big(slope).times(monthIndex(p.month) - startIndex)).toFixed()));
    return {
      status: "KNOWN" as const,
      slopePerMonth: slope,
      startLevel: intercept,
      endLevel: new Big(intercept).plus(new Big(slope).times(monthIndex(selected.at(-1)!.month) - startIndex)).toFixed(),
      classification: { status: "UNKNOWN" as const, reasonCode: "MATERIALITY_INTEGRATION_PENDING" },
    };
  })();
  const recentChange = selected.length < 6 ? unknown : (() => {
    const last = values.slice(-6);
    const previousLevel = median(last.slice(0, 3));
    const recentLevel = median(last.slice(3));
    return { status: "KNOWN" as const, previousLevel, recentLevel, delta: new Big(recentLevel).minus(previousLevel).toFixed() };
  })();
  const describe = (values: readonly string[]) => values.length === 0 ? unknown : (() => {
    const center = median(values);
    const sorted = [...values].sort((a, b) => new Big(a).cmp(b));
    const quantile = (probability: number) => {
      const position = (sorted.length - 1) * probability;
      const index = Math.floor(position);
      return new Big(sorted[index]).plus(new Big(sorted[Math.ceil(position)]).minus(sorted[index]).times(position - index)).toFixed();
    };
    const q1 = quantile(0.25), q3 = quantile(0.75);
    return {
      status: "KNOWN" as const,
      median: center,
      mad: median(values.map((value) => new Big(value).minus(center).abs().toFixed())),
      q1, q3, iqr: new Big(q3).minus(q1).toFixed(),
      classification: { status: "UNKNOWN" as const, reasonCode: "STABILITY_POLICY_AUTHORITY_REQUIRED" },
      relativeMad: { status: "UNKNOWN" as const, reasonCode: "NEAR_ZERO_POLICY_AUTHORITY_REQUIRED" },
    };
  })();
  const dispersion = describe(values);
  const ordinary = selected.filter((p) => p.ordinaryAuthority?.classification === "ORDINARY");
  const ordinaryDispersion = selected.length > 0 && selected.every((p) => p.ordinaryAuthority !== undefined)
    ? { ...describe(ordinary.map((p) => p.value!)), includedMonths: ordinary.map((p) => p.month), excludedMonths: selected.filter((p) => p.ordinaryAuthority?.classification === "EXCEPTIONAL").map((p) => p.month) }
    : { status: "UNKNOWN" as const, reasonCode: "ORDINARY_EXCLUSION_AUTHORITY_MISSING" };
  return {
    trend,
    recentChange,
    dispersion,
    ordinaryDispersion,
    support,
    dependencyRefs: [...new Set(ordered.flatMap((point) => point.dependencyRefs))].sort(),
    methodVersion: "global_temporal_descriptive@v1",
    inputHash: bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({ boundary, points: ordered, policy: globalTemporalDescriptivePolicy })))),
  };
}
