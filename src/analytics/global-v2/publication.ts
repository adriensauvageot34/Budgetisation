export const GLOBAL_PUBLICATION_METHOD_VERSION = "global_publication_engine@v1" as const;
export const GLOBAL_PUBLICATION_POLICY_VERSION = "global-publication-policy@v1" as const;

export type GlobalPublicationVisibility = "VISIBLE" | "PLACEHOLDER" | "HIDDEN";
export type GlobalPublicationSurface = "AUTO_GLOBAL" | "MODULE_DETAIL" | "EXPLICIT_EXPLORATION";
export type GlobalSectionClass = "CORE_STRUCTURAL" | "CONDITIONAL_ANALYTIC" | "OPPORTUNISTIC_INSIGHT";
export type GlobalPublicationQualification = "NONE" | "PARTIAL_COVERAGE" | "PARTIAL_SUPPORT" | "RECENT_ONLY" | "ESTIMATED" | "HYBRID" | "OBSERVED_SUBSET" | "LOWER_BOUND";
export type GlobalPublicationReasonCode =
  | "NOT_APPLICABLE" | "NO_ELIGIBLE_UNIVERSE" | "CAPABILITY_NOT_AVAILABLE" | "CAPABILITY_DISABLED_BY_POLICY"
  | "SEMANTICALLY_INVALID" | "UNKNOWN_REQUIRED_VALUE" | "BLOCKING_CONFLICT" | "MISSING_REQUIRED_LINKAGE"
  | "INSUFFICIENT_CERTIFIED_HISTORY" | "UNCERTIFIED_REQUIRED_PERIOD"
  | "INSUFFICIENT_SUPPORT" | "PARTIAL_SUPPORT_ONLY" | "INSUFFICIENT_COMPARABLE_PEERS" | "INSUFFICIENT_MATCHED_PAIRS" | "INSUFFICIENT_CYCLES" | "INSUFFICIENT_REPETITIONS"
  | "INSUFFICIENT_COVERAGE" | "PARTIAL_COVERAGE_ONLY"
  | "BELOW_MATERIALITY" | "STATISTICAL_GATE_FAILED" | "MULTIPLICITY_GATE_FAILED" | "TEMPORAL_ROBUSTNESS_FAILED" | "HYPOTHESIS_ONLY"
  | "REDUNDANT_WITH_HIGHER_PRIORITY" | "NOT_SELECTED_FOR_SURFACE" | "SURFACE_LIMIT_REACHED";

export type GlobalPublicationPolicy = {
  readonly policyId: string;
  readonly sectionClass: GlobalSectionClass;
  readonly allowedSurfaces: readonly GlobalPublicationSurface[];
  readonly requireCertifiedHistory: boolean;
  readonly requireMateriality: boolean;
  readonly requireStatistics: boolean;
  readonly requireTemporalRobustness: boolean;
  readonly allowPartialQualifiedDetail: boolean;
  readonly placeholderPolicy: "NEVER" | "CORE_WHEN_RECOVERABLE" | "WHEN_PARTIAL_SUPPORT";
  readonly methodVersion: string;
};

export type GlobalPublicationGateInput = {
  readonly capability: boolean;
  readonly applicable: boolean;
  readonly semantic: boolean;
  readonly knowledge: "KNOWN" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE" | "CONFLICT";
  readonly certification?: boolean;
  readonly support?: "INSUFFICIENT" | "PARTIAL_SUPPORT" | "SUFFICIENT" | "STRONG";
  readonly coverage?: number;
  readonly materiality?: boolean;
  readonly statistics?: boolean;
  readonly temporalRobustness?: boolean;
  readonly editorialSelection?: boolean;
  readonly recoverableReason?: GlobalPublicationReasonCode;
  readonly qualification?: GlobalPublicationQualification;
  readonly progress?: { readonly current: number; readonly required: number; readonly unit: string };
  readonly explicitNeutralResultAllowed?: boolean;
};

export type GlobalPublicationDecision = {
  readonly sectionKey: string;
  readonly sectionClass: GlobalSectionClass;
  readonly surface: GlobalPublicationSurface;
  readonly visibility: GlobalPublicationVisibility;
  readonly qualification?: GlobalPublicationQualification;
  readonly reasonCode?: GlobalPublicationReasonCode;
  readonly placeholder?: { readonly messageKey: string; readonly progress?: { readonly current: number; readonly required: number; readonly unit: string } };
  readonly gateResults: Readonly<Record<string, boolean>>;
  readonly analyticsRevision: string;
  readonly publicationPolicyVersion: typeof GLOBAL_PUBLICATION_POLICY_VERSION;
};

function hidden(input: { sectionKey: string; policy: GlobalPublicationPolicy; surface: GlobalPublicationSurface; analyticsRevision: string; gates: GlobalPublicationGateInput }, reasonCode: GlobalPublicationReasonCode): GlobalPublicationDecision {
  return { sectionKey: input.sectionKey, sectionClass: input.policy.sectionClass, surface: input.surface, visibility: "HIDDEN", reasonCode, gateResults: gateMap(input.gates), analyticsRevision: input.analyticsRevision, publicationPolicyVersion: GLOBAL_PUBLICATION_POLICY_VERSION };
}

function gateMap(gates: GlobalPublicationGateInput): Readonly<Record<string, boolean>> {
  return {
    capability: gates.capability, applicable: gates.applicable, semantic: gates.semantic,
    knowledge: gates.knowledge === "KNOWN" || gates.knowledge === "PARTIAL",
    certification: gates.certification !== false,
    support: gates.support === undefined || gates.support === "SUFFICIENT" || gates.support === "STRONG",
    coverage: gates.coverage === undefined || gates.coverage >= 0.85,
    materiality: gates.materiality !== false, statistics: gates.statistics !== false,
    temporalRobustness: gates.temporalRobustness !== false, editorialSelection: gates.editorialSelection !== false,
  };
}

export class GlobalPublicationEngine {
  decide(input: { readonly sectionKey: string; readonly policy: GlobalPublicationPolicy; readonly surface: GlobalPublicationSurface; readonly analyticsRevision: string; readonly gates: GlobalPublicationGateInput }): GlobalPublicationDecision {
    if (!input.sectionKey || !input.policy.policyId || !input.policy.methodVersion || !input.analyticsRevision) throw new TypeError("GLOBAL_PUBLICATION_INPUT_INVALID");
    if (input.gates.coverage !== undefined && (!Number.isFinite(input.gates.coverage) || input.gates.coverage < 0 || input.gates.coverage > 1)) throw new TypeError("GLOBAL_PUBLICATION_COVERAGE_INVALID");
    if (new Set(input.policy.allowedSurfaces).size !== input.policy.allowedSurfaces.length) throw new TypeError("GLOBAL_PUBLICATION_SURFACE_DUPLICATE");
    if (!input.policy.allowedSurfaces.includes(input.surface)) return hidden(input, "CAPABILITY_DISABLED_BY_POLICY");
    if (!input.gates.capability) return hidden(input, "CAPABILITY_NOT_AVAILABLE");
    if (!input.gates.applicable || input.gates.knowledge === "NOT_APPLICABLE") return hidden(input, "NOT_APPLICABLE");
    if (!input.gates.semantic) return hidden(input, "SEMANTICALLY_INVALID");
    if (input.gates.knowledge === "CONFLICT") return hidden(input, "BLOCKING_CONFLICT");

    const certificationMissing = input.policy.requireCertifiedHistory && input.gates.certification !== true;
    const supportMissing = input.gates.support === "INSUFFICIENT" || input.gates.support === "PARTIAL_SUPPORT";
    const coverageMissing = input.gates.coverage !== undefined && input.gates.coverage < 0.85;
    const knowledgeMissing = input.gates.knowledge === "UNKNOWN";
    const recoverable = certificationMissing || supportMissing || coverageMissing || knowledgeMissing;
    if (recoverable) {
      if (input.surface === "MODULE_DETAIL" && input.policy.allowPartialQualifiedDetail && input.gates.knowledge === "PARTIAL" && input.gates.coverage !== undefined && input.gates.coverage >= 0.6) {
        return { sectionKey: input.sectionKey, sectionClass: input.policy.sectionClass, surface: input.surface, visibility: "VISIBLE", qualification: input.gates.qualification ?? "PARTIAL_COVERAGE", gateResults: gateMap(input.gates), analyticsRevision: input.analyticsRevision, publicationPolicyVersion: GLOBAL_PUBLICATION_POLICY_VERSION };
      }
      const placeholderAllowed = input.policy.sectionClass === "CORE_STRUCTURAL" && input.policy.placeholderPolicy === "CORE_WHEN_RECOVERABLE"
        || input.policy.sectionClass === "CONDITIONAL_ANALYTIC" && input.policy.placeholderPolicy === "WHEN_PARTIAL_SUPPORT"
          && (input.gates.support === "PARTIAL_SUPPORT" || input.gates.coverage !== undefined && input.gates.coverage >= 0.6);
      if (placeholderAllowed) {
        const reasonCode = input.gates.recoverableReason ?? (certificationMissing ? "INSUFFICIENT_CERTIFIED_HISTORY" : coverageMissing ? input.gates.coverage !== undefined && input.gates.coverage >= 0.6 ? "PARTIAL_COVERAGE_ONLY" : "INSUFFICIENT_COVERAGE" : supportMissing ? "PARTIAL_SUPPORT_ONLY" : "UNKNOWN_REQUIRED_VALUE");
        return { sectionKey: input.sectionKey, sectionClass: input.policy.sectionClass, surface: input.surface, visibility: "PLACEHOLDER", reasonCode, placeholder: { messageKey: `global.placeholder.${reasonCode.toLowerCase()}`, ...(input.gates.progress === undefined ? {} : { progress: input.gates.progress }) }, gateResults: gateMap(input.gates), analyticsRevision: input.analyticsRevision, publicationPolicyVersion: GLOBAL_PUBLICATION_POLICY_VERSION };
      }
      return hidden(input, input.gates.recoverableReason ?? (coverageMissing ? "INSUFFICIENT_COVERAGE" : supportMissing ? "INSUFFICIENT_SUPPORT" : certificationMissing ? "INSUFFICIENT_CERTIFIED_HISTORY" : "UNKNOWN_REQUIRED_VALUE"));
    }
    if (input.policy.requireMateriality && input.gates.materiality !== true) return hidden(input, "BELOW_MATERIALITY");
    if (input.policy.requireStatistics && input.gates.statistics !== true && !(input.surface === "EXPLICIT_EXPLORATION" && input.gates.explicitNeutralResultAllowed)) return hidden(input, "STATISTICAL_GATE_FAILED");
    if (input.policy.requireTemporalRobustness && input.gates.temporalRobustness !== true) return hidden(input, "TEMPORAL_ROBUSTNESS_FAILED");
    if (input.gates.editorialSelection === false) return hidden(input, "NOT_SELECTED_FOR_SURFACE");
    return { sectionKey: input.sectionKey, sectionClass: input.policy.sectionClass, surface: input.surface, visibility: "VISIBLE", ...(input.gates.qualification === undefined || input.gates.qualification === "NONE" ? {} : { qualification: input.gates.qualification }), gateResults: gateMap(input.gates), analyticsRevision: input.analyticsRevision, publicationPolicyVersion: GLOBAL_PUBLICATION_POLICY_VERSION };
  }
}

export function aggregateGlobalModuleVisibility(decisions: readonly GlobalPublicationDecision[]): GlobalPublicationVisibility {
  if (decisions.some((decision) => decision.visibility === "VISIBLE")) return "VISIBLE";
  if (decisions.some((decision) => decision.visibility === "PLACEHOLDER" && decision.sectionClass !== "OPPORTUNISTIC_INSIGHT")) return "PLACEHOLDER";
  return "HIDDEN";
}
