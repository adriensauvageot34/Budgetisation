import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate } from "../../core/global-v2";
import { GlobalMaterialityEngine } from "./materiality";
import { buildGlobalTemporalDescriptive } from "./temporal-descriptive";
import { buildGlobalTemporalChangeCandidates, type GlobalTemporalChangeInput } from "./temporal-change";

/** Material drift and descriptive dispersion are different, separately qualified outputs. */
export function buildGlobalTemporalAnalysis(input: GlobalTemporalChangeInput) {
  const descriptive = buildGlobalTemporalDescriptive(input);
  const changes = buildGlobalTemporalChangeCandidates(input);
  const engine = new GlobalMaterialityEngine();
  const evaluate = (id: string, before: string, after: string) => {
    const absolute = new Big(after).minus(before).toFixed();
    return engine.evaluate({
      policyId: input.policyId,
      ...(input.materialFrequencyChange === undefined ? {} : { materialFrequencyChange: input.materialFrequencyChange }),
      candidate: parseGlobalMaterialityCandidate({
        ...input.evidence,
        candidateId: `${input.evidence.phenomenonId}:${id}`,
        effect: { absolute, ...(new Big(before).eq(0) ? {} : { relative: new Big(absolute).div(new Big(before).abs()).toFixed() }) },
      }),
    });
  };
  const trend = descriptive.trend.status === "KNOWN" ? {
    ...descriptive.trend,
    classification: { status: "UNKNOWN" as const, reasonCode: "STABILITY_CLASS_NOT_INFERRED_FROM_MATERIALITY" },
    materiality: evaluate("trend", descriptive.trend.startLevel, descriptive.trend.endLevel),
    driftMateriality: evaluate("trend", descriptive.trend.startLevel, descriptive.trend.endLevel),
  } : descriptive.trend;
  const recentChange = descriptive.recentChange.status === "KNOWN" ? {
    ...descriptive.recentChange,
    materiality: evaluate("recent-change", descriptive.recentChange.previousLevel, descriptive.recentChange.recentLevel),
  } : descriptive.recentChange;
  return {
    ...descriptive,
    trend,
    recentChange,
    changes,
    methodVersion: "global_temporal_analysis@v2",
    inputHash: bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({
      methodVersion: "global_temporal_analysis@v2", descriptive: descriptive.inputHash, changes: changes.inputHash,
    })))),
  };
}
