import Big from "big.js";
import type {
  GlobalMaterialityCandidate,
  GlobalSupportStatus,
  PolicyRef,
} from "../../core/global-v2";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parsePolicyVersion } from "../../core/versions";

const V1 = parsePolicyVersion("v1");

export const GLOBAL_MATERIALITY_METHOD_VERSION = "global_materiality@v1" as const;

export type GlobalMaterialityPolicyId =
  | "HOUSEHOLD_TOTAL"
  | "CATEGORY_NEED"
  | "RECURRENCE"
  | "COST_PER_OCCURRENCE"
  | "ACTIVITY_FREQUENCY"
  | "PERSONA_MONEY"
  | "PERSONA_FREQUENCY"
  | "RELATIONSHIP_PROBABILITY"
  | "MOMENT_SHORT"
  | "MOMENT_TRAVEL"
  | "MOMENT_PROJECT"
  | "MERCHANT";

export type GlobalMaterialityPolicy = {
  readonly id: GlobalMaterialityPolicyId;
  readonly ref: PolicyRef;
  readonly minimumAbsolute: string;
  readonly minimumRelative?: string;
  readonly minimumShareDeltaPoints?: string;
  readonly relativeOrShare: boolean;
  readonly appearanceDisappearanceAllowed: boolean;
  readonly absoluteOnlyAlternative?: string;
  readonly zeroBaselineUsesAbsolute?: boolean;
};

/** The only V1 threshold registry. Later modules consume it instead of copying numbers. */
export const globalMaterialityPolicies: Readonly<Record<GlobalMaterialityPolicyId, GlobalMaterialityPolicy>> = Object.freeze({
  HOUSEHOLD_TOTAL: { id: "HOUSEHOLD_TOTAL", ref: { id: "global-materiality-household-total", version: V1 }, minimumAbsolute: "50", minimumRelative: "0.03", relativeOrShare: true, appearanceDisappearanceAllowed: false },
  CATEGORY_NEED: { id: "CATEGORY_NEED", ref: { id: "global-materiality-category-need", version: V1 }, minimumAbsolute: "15", minimumRelative: "0.10", minimumShareDeltaPoints: "2", relativeOrShare: true, appearanceDisappearanceAllowed: false },
  RECURRENCE: { id: "RECURRENCE", ref: { id: "global-materiality-recurrence", version: V1 }, minimumAbsolute: "3", minimumRelative: "0.05", relativeOrShare: false, appearanceDisappearanceAllowed: true },
  COST_PER_OCCURRENCE: { id: "COST_PER_OCCURRENCE", ref: { id: "global-materiality-cost-per-occurrence", version: V1 }, minimumAbsolute: "5", minimumRelative: "0.10", relativeOrShare: false, appearanceDisappearanceAllowed: false },
  ACTIVITY_FREQUENCY: { id: "ACTIVITY_FREQUENCY", ref: { id: "global-materiality-activity-frequency", version: V1 }, minimumAbsolute: "1", minimumRelative: "0.20", relativeOrShare: false, appearanceDisappearanceAllowed: false },
  PERSONA_MONEY: { id: "PERSONA_MONEY", ref: { id: "global-materiality-persona-money", version: V1 }, minimumAbsolute: "10", minimumRelative: "0.15", relativeOrShare: false, appearanceDisappearanceAllowed: false },
  PERSONA_FREQUENCY: { id: "PERSONA_FREQUENCY", ref: { id: "global-materiality-persona-frequency", version: V1 }, minimumAbsolute: "1", relativeOrShare: false, appearanceDisappearanceAllowed: true },
  MERCHANT: { id: "MERCHANT", ref: { id: "global-materiality-merchant", version: V1 }, minimumAbsolute: "15", minimumRelative: "0.15", relativeOrShare: false, appearanceDisappearanceAllowed: false },
  // Master M5 P3983–P3991: (10 percentage points AND 20%) OR 15 points.
  RELATIONSHIP_PROBABILITY: { id: "RELATIONSHIP_PROBABILITY", ref: { id: "global-materiality-relationship-probability", version: V1 }, minimumAbsolute: "0.10", minimumRelative: "0.20", absoluteOnlyAlternative: "0.15", relativeOrShare: false, appearanceDisappearanceAllowed: false },
  MOMENT_SHORT: { id: "MOMENT_SHORT", ref: { id: "global-materiality-moment-short", version: V1 }, minimumAbsolute: "15", minimumRelative: "0.15", relativeOrShare: false, appearanceDisappearanceAllowed: false, zeroBaselineUsesAbsolute: true },
  MOMENT_TRAVEL: { id: "MOMENT_TRAVEL", ref: { id: "global-materiality-moment-travel", version: V1 }, minimumAbsolute: "50", minimumRelative: "0.10", relativeOrShare: false, appearanceDisappearanceAllowed: false, zeroBaselineUsesAbsolute: true },
  MOMENT_PROJECT: { id: "MOMENT_PROJECT", ref: { id: "global-materiality-moment-project", version: V1 }, minimumAbsolute: "50", minimumRelative: "0.15", relativeOrShare: false, appearanceDisappearanceAllowed: false, zeroBaselineUsesAbsolute: true },
});

export type GlobalMaterialityStatus =
  | "MATERIAL"
  | "NOT_MATERIAL"
  | "QUALIFIED_PARTIAL"
  | "INELIGIBLE";

export type GlobalMaterialityEvaluation = {
  readonly candidateId: string;
  readonly phenomenonId: string;
  readonly naturalGrain: GlobalMaterialityCandidate["support"]["naturalGrain"];
  readonly status: GlobalMaterialityStatus;
  readonly gates: {
    readonly authority: "PASS" | "FAIL";
    readonly support: "PASS" | "PARTIAL" | "FAIL";
    readonly coverage: "PASS" | "PARTIAL" | "FAIL";
    readonly absolute: "PASS" | "FAIL";
    readonly relative: "PASS" | "FAIL" | "NOT_APPLICABLE";
    readonly share: "PASS" | "FAIL" | "NOT_APPLICABLE";
    readonly persistence: "PASS" | "FAIL" | "NOT_APPLICABLE";
  };
  readonly reasonCodes: readonly string[];
  readonly policy: PolicyRef;
};

export type GlobalMaterialityEvaluationInput = {
  readonly candidate: GlobalMaterialityCandidate;
  readonly policyId: GlobalMaterialityPolicyId;
  readonly shareDeltaPoints?: string;
  readonly notableContribution?: boolean;
  readonly persistenceUnits?: number;
  readonly lifecycle?: "CONTINUING" | "APPEARED" | "DISAPPEARED";
  readonly structuralEquivalent?: boolean;
  readonly materialFrequencyChange?: boolean;
  readonly zeroBaseline?: boolean;
};

function absAtLeast(value: string | undefined, threshold: string): boolean {
  return value !== undefined && new Big(value).abs().gte(threshold);
}

function supportGate(status: GlobalSupportStatus): "PASS" | "PARTIAL" | "FAIL" {
  if (status === "STRONG" || status === "SUFFICIENT") return "PASS";
  if (status === "PARTIAL_SUPPORT") return "PARTIAL";
  return "FAIL";
}

function coverageGate(candidate: GlobalMaterialityCandidate): "PASS" | "PARTIAL" | "FAIL" {
  if (candidate.coverage.effective === undefined || candidate.coverage.effective <= 0) return "FAIL";
  const required = candidate.coverage.requiredDimensions.map((dimension) =>
    candidate.coverage.dimensions.find((measure) => measure.dimension === dimension));
  if (required.some((measure) => measure === undefined || measure.status === "UNKNOWN" || measure.status === "CONFLICT" || measure.status === "NOT_APPLICABLE")) return "FAIL";
  return candidate.coverage.effective === 1 && required.every((measure) => measure?.status === "KNOWN")
    ? "PASS"
    : "PARTIAL";
}

function samePolicy(left: PolicyRef, right: PolicyRef): boolean {
  return left.id === right.id && left.version === right.version;
}

/**
 * Analytical materiality only. It never ranks cards or performs narrative/UI selection.
 * Missing authority, support or coverage remains explicit and is never coerced to zero.
 */
export class GlobalMaterialityEngine {
  evaluate(input: GlobalMaterialityEvaluationInput): GlobalMaterialityEvaluation {
    const { candidate } = input;
    const policy = globalMaterialityPolicies[input.policyId];
    if (!samePolicy(candidate.materialityPolicy, policy.ref)) {
      throw new TypeError(`La policy du candidat ${candidate.candidateId} ne correspond pas à ${input.policyId}.`);
    }
    const authority = candidate.knowledgeState === "KNOWN" || candidate.knowledgeState === "PARTIAL" ? "PASS" : "FAIL";
    const support = supportGate(candidate.support.supportStatus);
    const coverage = coverageGate(candidate);
    const absolute = absAtLeast(candidate.effect.absolute, policy.minimumAbsolute) ? "PASS" : "FAIL";
    const relative = policy.minimumRelative === undefined
      ? "NOT_APPLICABLE"
      : absAtLeast(candidate.effect.relative, policy.minimumRelative) ? "PASS" : "FAIL";
    const shareSatisfied = input.notableContribution === true ||
      (policy.minimumShareDeltaPoints !== undefined && absAtLeast(input.shareDeltaPoints, policy.minimumShareDeltaPoints));
    const share = policy.relativeOrShare ? shareSatisfied ? "PASS" : "FAIL" : "NOT_APPLICABLE";
    const lifecycle = input.lifecycle ?? "CONTINUING";
    const lifecycleException = lifecycle !== "CONTINUING" && policy.appearanceDisappearanceAllowed;
    const persistence = lifecycleException
      ? (input.persistenceUnits ?? 0) > 0 || input.structuralEquivalent === true ? "PASS" : "FAIL"
      : "NOT_APPLICABLE";
    const relativeGate = policy.minimumRelative === undefined
      ? true
      : relative === "PASS" || lifecycleException && persistence === "PASS";
    const effectGate = absolute === "PASS" && (
      policy.relativeOrShare ? relativeGate || share === "PASS" : relativeGate
    );
    const frequencyAlternative = input.policyId === "MERCHANT" && input.materialFrequencyChange === true;
    const personaFrequencyAlternative = input.policyId === "PERSONA_FREQUENCY" && input.structuralEquivalent === true;
    const absoluteOnlyAlternative = policy.absoluteOnlyAlternative !== undefined && absAtLeast(candidate.effect.absolute, policy.absoluteOnlyAlternative)
      || policy.zeroBaselineUsesAbsolute === true && input.zeroBaseline === true && absolute === "PASS";
    const effectPass = effectGate || frequencyAlternative || personaFrequencyAlternative || absoluteOnlyAlternative;
    const reasonCodes = [
      ...(authority === "FAIL" ? ["MISSING_AUTHORITY"] : []),
      ...(support === "FAIL" ? ["INSUFFICIENT_SUPPORT"] : support === "PARTIAL" ? ["PARTIAL_SUPPORT"] : []),
      ...(coverage === "FAIL" ? ["UNRESOLVED_COVERAGE"] : coverage === "PARTIAL" ? ["PARTIAL_COVERAGE"] : []),
      ...(absolute === "FAIL" && !frequencyAlternative && !personaFrequencyAlternative ? ["BELOW_ABSOLUTE_THRESHOLD"] : []),
      ...(!effectPass && absolute === "PASS" ? ["RELATIVE_OR_SHARE_GATE_FAILED"] : []),
      ...(lifecycleException && persistence === "FAIL" ? ["UNPROVEN_PERSISTENCE"] : []),
    ].sort();
    const status: GlobalMaterialityStatus = authority === "FAIL" || support === "FAIL" || coverage === "FAIL"
      ? "INELIGIBLE"
      : candidate.knowledgeState === "PARTIAL" || support === "PARTIAL" || coverage === "PARTIAL"
        ? "QUALIFIED_PARTIAL"
        : !effectPass
          ? "NOT_MATERIAL"
          : "MATERIAL";
    return {
      candidateId: candidate.candidateId,
      phenomenonId: candidate.phenomenonId,
      naturalGrain: candidate.support.naturalGrain,
      status,
      gates: { authority, support, coverage, absolute, relative, share, persistence },
      reasonCodes,
      policy: policy.ref,
    };
  }

  evaluateAll(inputs: readonly GlobalMaterialityEvaluationInput[]): readonly GlobalMaterialityEvaluation[] {
    const byIdentity = new Map<string, GlobalMaterialityEvaluationInput>();
    for (const input of inputs) {
      const { candidate } = input;
      const identity = canonicalSerializeGlobal({
        phenomenonId: candidate.phenomenonId,
        metricRef: candidate.metricRef,
        naturalGrain: candidate.support.naturalGrain,
        evidenceRefs: candidate.evidenceRefs,
      });
      const previous = byIdentity.get(identity);
      if (previous === undefined) {
        byIdentity.set(identity, input);
        continue;
      }
      const withoutId = ({ candidateId: _candidateId, ...value }: GlobalMaterialityCandidate) => value;
      if (canonicalSerializeGlobal({ ...previous, candidate: withoutId(previous.candidate) }) !== canonicalSerializeGlobal({ ...input, candidate: withoutId(candidate) })) {
        throw new TypeError(`Deux candidats matérialité contradictoires partagent le phénomène ${candidate.phenomenonId}.`);
      }
      if (candidate.candidateId.localeCompare(previous.candidate.candidateId) < 0) byIdentity.set(identity, input);
    }
    return [...byIdentity.values()]
      .sort((a, b) => a.candidate.phenomenonId.localeCompare(b.candidate.phenomenonId) ||
        a.candidate.support.naturalGrain.localeCompare(b.candidate.support.naturalGrain) ||
        a.candidate.candidateId.localeCompare(b.candidate.candidateId))
      .map((input) => this.evaluate(input));
  }
}
