import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { relationshipBenjaminiHochberg } from "./relationship-statistics";

export type RelationshipTestEvidence = {
  readonly id: string;
  readonly eligible: boolean;
  readonly pValue?: number;
  readonly exclusionReason?: string;
};

/** All definitions in a frozen execution plan must have a result or an explicit
 * exclusion. No materiality/selected flag is accepted by this boundary.
 */
export function closeRelationshipFdrUniverse(input: {
  readonly scopeRevisionIdentity: string;
  readonly expectedDefinitionIds: readonly string[];
  readonly tests: readonly RelationshipTestEvidence[];
}) {
  canonicalSerializeGlobal(input);
  if (!input.scopeRevisionIdentity) throw new TypeError("M5_FDR_SCOPE_REVISION_REQUIRED");
  const ids = [...input.expectedDefinitionIds].sort();
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) throw new TypeError("M5_FDR_PLAN_DUPLICATE");
  const tests = [...input.tests].sort((a, b) => a.id.localeCompare(b.id));
  if (canonicalSerializeGlobal(tests.map((test) => test.id)) !== canonicalSerializeGlobal(ids)) throw new TypeError("M5_FDR_INCOMPLETE_OR_EXTRA_DEFINITION");
  for (const test of tests) {
    if (test.eligible && (test.pValue === undefined || test.exclusionReason !== undefined)) throw new TypeError("M5_ELIGIBLE_TEST_REQUIRES_PVALUE");
    if (!test.eligible && (!test.exclusionReason || test.pValue !== undefined)) throw new TypeError("M5_INELIGIBLE_TEST_REQUIRES_EXCLUSION");
  }
  const eligible = tests.flatMap((test) => test.eligible ? [{ id: test.id, pValue: test.pValue! }] : []);
  const policy = "relationship-bh-all-eligible-scope-revision@v1";
  const universeId = bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal({ scope: input.scopeRevisionIdentity, ids, policy }))));
  return { universeId, policy, eligibleTestCount: eligible.length, tests: relationshipBenjaminiHochberg(eligible), exclusions: tests.filter((test) => !test.eligible) };
}

export type RelationshipTemporalWindowEvidence = {
  readonly eligibleMonths: readonly string[];
  readonly supportPassed: boolean;
  readonly material: boolean;
  readonly statisticalPassed: boolean;
  readonly robust: boolean;
  readonly direction: -1 | 0 | 1;
  readonly confirmedNoDifference?: boolean;
};

/** Classifies certified upstream window evidence, not raw data or significance
 * alone. The caller must recompute every window at its own support/grain.
 */
export function classifyRelationshipTemporalWindows(input: {
  readonly current: RelationshipTemporalWindowEvidence;
  readonly recent?: RelationshipTemporalWindowEvidence;
  readonly previous?: RelationshipTemporalWindowEvidence;
}) {
  canonicalSerializeGlobal(input);
  const pass = (window: RelationshipTemporalWindowEvidence) => window.supportPassed && window.material && window.statisticalPassed && window.robust && window.direction !== 0;
  const validate = (window: RelationshipTemporalWindowEvidence) => {
    if (new Set(window.eligibleMonths).size !== window.eligibleMonths.length || window.eligibleMonths.some((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new TypeError("M5_INVALID_WINDOW_MONTHS");
  };
  validate(input.current);
  if (input.recent) validate(input.recent);
  if (input.previous) validate(input.previous);
  const recent = input.recent, previous = input.previous;
  if (recent && previous && recent.eligibleMonths.length === 6 && previous.eligibleMonths.length === 6 && recent.supportPassed && previous.supportPassed) {
    if ([...previous.eligibleMonths].sort().at(-1)! >= [...recent.eligibleMonths].sort()[0]) throw new TypeError("M5_OVERLAPPING_TEMPORAL_WINDOWS");
    if (pass(previous) && pass(recent) && previous.direction !== recent.direction) return "CHANGED_RELATIONSHIP" as const;
    if (pass(previous) && !pass(recent)) return recent.confirmedNoDifference === true || recent.material && recent.direction !== 0 && recent.direction !== previous.direction ? "CHANGED_RELATIONSHIP" as const : "HISTORICAL_ONLY" as const;
    if (pass(recent) && !pass(previous)) return "RECENT_ONLY" as const;
  }
  return pass(input.current) && input.current.eligibleMonths.length >= 2 ? "STABLE_CURRENT_REGIME" as const : "INSUFFICIENT_TEMPORAL_SUPPORT" as const;
}
