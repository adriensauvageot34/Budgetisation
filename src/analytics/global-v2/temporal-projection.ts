import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseYearMonth } from "../../core/time";
import { parseMoney } from "../../core/money";
import type { GlobalTemporalPoint } from "./temporal-descriptive";

/** Normalized monthly observations; this never creates or changes a Fact grain. */
export function projectGlobalTemporalRate(input: {
  readonly month: string;
  readonly numerator: string;
  readonly denominator: string;
  readonly sourceGrain: "ACTIVITY_OCCURRENCE" | "PERSON_DAY" | "PLACE_VISIT" | "PURCHASE_EVENT";
  readonly exposureUnit: "OBSERVABLE_MONTH" | "OBSERVABLE_DAY" | "PURCHASE_EVENT";
  readonly sourceRefs: readonly string[];
  readonly exposureRefs: readonly string[];
  readonly complete: boolean;
  readonly corpus: GlobalTemporalPoint["corpus"];
}): GlobalTemporalPoint {
  const month = parseYearMonth(input.month);
  const numerator = parseMoney(input.numerator), denominator = parseMoney(input.denominator);
  if (new Big(numerator).lt(0) || new Big(denominator).lt(0) || !input.sourceRefs.length || !input.exposureRefs.length ||
    !["ACTIVITY_OCCURRENCE", "PERSON_DAY", "PLACE_VISIT", "PURCHASE_EVENT"].includes(input.sourceGrain) ||
    !["OBSERVABLE_MONTH", "OBSERVABLE_DAY", "PURCHASE_EVENT"].includes(input.exposureUnit) ||
    input.sourceGrain === "PERSON_DAY" && input.exposureUnit !== "OBSERVABLE_DAY") throw new TypeError("Unproven monthly rate grain/exposure.");
  const canonical = { ...input, month, numerator, denominator, sourceRefs: [...new Set(input.sourceRefs)].sort(), exposureRefs: [...new Set(input.exposureRefs)].sort() };
  const inputHash = bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(canonical))));
  const known = new Big(denominator).gt(0);
  return {
    month, corpus: input.corpus, status: !known ? "UNKNOWN" : input.complete ? "KNOWN" : "PARTIAL",
    ...(known ? { value: new Big(numerator).div(denominator).toFixed() } : {}),
    eligible: known, complete: input.complete,
    dependencyRefs: [...new Set([...canonical.sourceRefs, ...canonical.exposureRefs, `monthly-projection:${inputHash}`, "policy:global-monthly-rate@v1"])].sort(),
  };
}
