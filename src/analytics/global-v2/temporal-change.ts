import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate, type GlobalMaterialityCandidate } from "../../core/global-v2";
import { parseMoney } from "../../core/money";
import type { YearMonth } from "../../core/time";
import { medianMoney } from "../references";
import { GlobalMaterialityEngine, globalMaterialityPolicies, type GlobalMaterialityPolicyId } from "./materiality";
import { normalizeGlobalTemporalPoints, temporalMonthIndex, type GlobalTemporalPoint } from "./temporal-descriptive";

/** Master P2659–2740; categorical dispersion is deliberately not inferred. */
export const globalTemporalChangePolicy = Object.freeze({
  version: "global-temporal-change@v1",
  before: 6,
  after: 6,
  ongoingAfter: 4,
  maximumSixMonthSpan: 7,
  persistenceFull: 5,
  persistenceOngoing: 3,
  plateauQualification: "EXACT_CONSTANT_PROOF_OTHERWISE_UNCONFIRMED",
  arbitration: "P04-human-stability-dispersion-arbitration@v1",
});

type KnownPoint = GlobalTemporalPoint & { readonly value: string };
const center = (points: readonly KnownPoint[]) => medianMoney(points.map((p) => parseMoney(p.value)));
const span = (points: readonly KnownPoint[]) => temporalMonthIndex(points.at(-1)!.month) - temporalMonthIndex(points[0].month) + 1;
const exactConstant = (points: readonly KnownPoint[]) => points.every((p) => new Big(p.value).eq(points[0].value));

export type GlobalTemporalChangeInput = {
  readonly certifiedThroughMonth: YearMonth;
  readonly points: readonly GlobalTemporalPoint[];
  /** Coverage and authority are supplied by the official signal producer, never inferred from amounts. */
  readonly evidence: Omit<GlobalMaterialityCandidate, "effect" | "candidateId">;
  readonly policyId: GlobalMaterialityPolicyId;
};

/** Window diagnostics, not editorial selection or a claim of a semantic transformation. */
export function buildGlobalTemporalChangeCandidates(input: GlobalTemporalChangeInput) {
  const ordered = normalizeGlobalTemporalPoints(input);
  const points = ordered.filter((p): p is KnownPoint => p.status === "KNOWN" && p.eligible && p.complete && p.value !== undefined);
  const evidence = parseGlobalMaterialityCandidate({ ...input.evidence, candidateId: "temporal:validation", effect: { absolute: "0" } });
  const materiality = new GlobalMaterialityEngine();
  const candidates = [];
  for (let boundary = 6; boundary < points.length; boundary += 1) {
    const before = points.slice(boundary - 6, boundary);
    const availableAfter = points.length - boundary;
    if (availableAfter < 4) continue;
    const after = points.slice(boundary, boundary + (availableAfter >= 6 ? 6 : 4));
    const beforeLevel = center(before);
    const afterLevel = center(after);
    const delta = new Big(afterLevel).minus(beforeLevel).toFixed();
    const robustDispersion = medianMoney([
      ...before.map((p) => parseMoney(new Big(p.value).minus(beforeLevel).abs().toFixed())),
      ...after.map((p) => parseMoney(new Big(p.value).minus(afterLevel).abs().toFixed())),
    ]);
    const full = after.length === 6;
    const requiredPersistence = full ? 5 : 3;
    const persistence = after.filter((p) => new Big(p.value).minus(afterLevel).abs().lt(new Big(p.value).minus(beforeLevel).abs())).length;
    // A six-observation block may span seven calendar months. The two blocks
    // must also touch; otherwise an unobserved interval invents a boundary.
    const calendarCompatible = span(before) <= 7 && (full ? span(after) <= 7 : span(after) === 4) &&
      temporalMonthIndex(after[0].month) - temporalMonthIndex(before.at(-1)!.month) === 1;
    const id = `${evidence.phenomenonId}:${after[0].month}:${full ? "6+6" : "6+4"}`;
    const evaluation = materiality.evaluate({
      policyId: input.policyId,
      candidate: {
        ...evidence,
        candidateId: id,
        effect: {
          absolute: delta,
          ...(new Big(beforeLevel).eq(0) ? {} : { relative: new Big(delta).div(new Big(beforeLevel).abs()).toFixed() }),
        },
      },
    });
    const plateauProven = exactConstant(before) && exactConstant(after);
    const reasonCodes = [
      ...(!calendarCompatible ? ["CALENDAR_GAP"] : []),
      ...(!full && span(after) !== 4 ? ["ONGOING_GAP_QUALIFICATION_UNPROVEN"] : []),
      ...(evaluation.status !== "MATERIAL" ? [`MATERIALITY_${evaluation.status}`] : []),
      ...(persistence < requiredPersistence ? ["INSUFFICIENT_PERSISTENCE"] : []),
      ...(!plateauProven ? ["PLATEAU_NOT_PROVEN"] : []),
    ];
    candidates.push({
      id,
      boundaryMonth: after[0].month,
      precision: "MONTH" as const,
      window: full ? "6+6" as const : "6+4" as const,
      beforeMonths: before.map((p) => p.month),
      afterMonths: after.map((p) => p.month),
      beforeLevel, afterLevel, delta,
      robustDispersion,
      robustShift: new Big(robustDispersion).eq(0)
        ? { status: "UNKNOWN" as const, reasonCode: "ZERO_DISPERSION_DENOMINATOR" }
        : { status: "KNOWN" as const, value: new Big(delta).abs().div(robustDispersion).toFixed() },
      persistence, requiredPersistence,
      materiality: evaluation,
      plateau: plateauProven
        ? { status: "KNOWN" as const, proof: "EXACT_CONSTANT_VALUES" }
        : { status: "UNKNOWN" as const, reasonCode: "DISPERSION_CRITERION_NOT_DEFINED" },
      shape: plateauProven
        ? { status: "KNOWN" as const, value: "STEP_CHANGE" as const }
        : { status: "UNKNOWN" as const, reasonCode: "GRADUAL_OR_NOISY_SHAPE_NOT_PROVEN" },
      status: reasonCodes.length === 0 ? "CONFIRMED_LEVEL_CHANGE" as const : "UNCONFIRMED" as const,
      internalStatus: reasonCodes.length === 0 ? "CONFIRMED_ONGOING" as const
        : !calendarCompatible || evaluation.status === "INELIGIBLE" || evaluation.status === "NOT_MATERIAL"
          ? "REJECTED" as const : "CANDIDATE" as const,
      reasonCodes,
      dependencyRefs: [...new Set([...before, ...after].flatMap((p) => p.dependencyRefs))].sort(),
    });
  }
  return {
    candidates,
    methodVersion: "global_temporal_change@v1",
    dependencyRefs: [...new Set(ordered.flatMap((p) => p.dependencyRefs))].sort(),
    inputHash: bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({
      boundary: input.certifiedThroughMonth, points: ordered, evidence,
      policy: globalTemporalChangePolicy, materiality: globalMaterialityPolicies[input.policyId],
    })))),
  };
}
