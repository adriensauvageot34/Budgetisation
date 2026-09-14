import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { relationshipAccessPolicy } from "./relationship-access";
import { classifyRelationshipTemporalWindows, closeRelationshipFdrUniverse, type RelationshipTemporalWindowEvidence } from "./relationship-evidence";
import { buildRelationshipInsights } from "./relationship-insight";
import { buildGlobalM5ProductTransformationFeed, validateGlobalM5TransformationFeed } from "./relationship-m3";
import { buildGlobalDailyRelationships, qualifyGlobalDailyRelationshipEvidence, type GlobalDailyRelationshipInput } from "./relationships";

export const GLOBAL_M5_PR03_PRODUCT_UNIVERSE = Object.freeze({
  universeId: "m5-v1-pr03-person",
  familyId: "PR03_PERSON",
  version: "m5-product-fdr-pr03-person@v1",
  technicalDefinitionId: "onsite-restaurant",
  exposure: "ONSITE",
  comparator: "REMOTE",
  outcome: "RESTAURANT",
  grain: "PERSON_DAY",
  causalityMode: "ASSOCIATION_ONLY",
  canonicalDirection: "ONSITE_MINUS_REMOTE",
} as const);

export const GLOBAL_M5_PR03_GATE_ORDER = Object.freeze([
  "G0_PRODUCT_MEMBERSHIP",
  "G1_AUTHORIZED_PERSON",
  "G2_CURRENT_REGIME_D2",
  "G3_WORK_CONTEXT_AUTHORITY",
  "G4_RESTAURANT_OUTCOME_AUTHORITY_AND_COVERAGE",
  "G5_CALENDAR_AUTHORITY",
  "G6_E1_EXCEPTION_AND_SEASON_POLICY",
  "G7_MATCHING",
  "G8_SUPPORT_15_MATCHED_PAIRS",
  "G9_RAW_STATISTIC_RAW_P",
  "G10_BH",
] as const);

export type GlobalM5Pr03Provider =
  | {
      readonly evaluationStatus: "AUTHORITY_GATED";
      readonly scope: { readonly personId: string };
      readonly reasonCodes: readonly string[];
    }
  | {
      readonly evaluationStatus: "READY_FOR_PRODUCT";
      readonly scope: { readonly personId: string };
      readonly reasonCodes: readonly string[];
      readonly analysis: GlobalDailyRelationshipInput;
      readonly missingPersonDayDates: readonly string[];
      readonly exceptionPolicy: "NOT_USED_V1";
      readonly seasonPolicy: "NOT_REQUIRED";
    };

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const hypothesisId = (personId: string) => `${GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId}:person:${personId}`;
const windowRoles = ["CURRENT", "RECENT_6", "PREVIOUS_6"] as const;

export function buildGlobalM5Pr03ProductPlan(input: {
  readonly authorizedPersonIds: readonly string[];
  readonly displayNamesByPersonId?: Readonly<Record<string, string>>;
}) {
  const personIds = [...new Set(input.authorizedPersonIds)].sort();
  if (!personIds.length || personIds.some((personId) => !personId) || personIds.length !== input.authorizedPersonIds.length) {
    throw new TypeError("M5_PR03_INVALID_AUTHORIZED_PERSON_SET");
  }
  const hypotheses = personIds.map((personId) => ({
    id: hypothesisId(personId),
    personId,
  }));
  const value = {
    universeId: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.universeId,
    familyId: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.familyId,
    version: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.version,
    definitionIds: [GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId],
    personScopes: hypotheses.map(({ id, personId }) => ({
      hypothesisId: id,
      personId,
      ...(input.displayNamesByPersonId?.[personId] === undefined ? {} : { displayName: input.displayNamesByPersonId[personId] }),
    })),
    canonicalDirection: {
      technicalDefinitionId: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId,
      exposure: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.exposure,
      comparator: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.comparator,
      outcome: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.outcome,
      grain: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.grain,
      causalityMode: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.causalityMode,
    },
    preStatisticalGates: GLOBAL_M5_PR03_GATE_ORDER,
    fdrRule: {
      familyId: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.familyId,
      policy: "relationship-bh-all-eligible-scope-revision@v1",
      expectedHypothesisCount: hypotheses.length,
      denominator: "count only hypotheses that passed every pre-statistical gate and have a raw p-value",
      excludedHypothesesCountInM: false,
      materialityPreselection: false,
      duplicateReverseQuestionAllowed: false,
    },
    methodVersion: "global_relationship_daily@v1",
    policyVersions: {
      technicalCatalog: "relationship-catalog-explicit-families@v2",
      canonicalComparator: "relationship-onsite-remote@v1",
      statistics: "relationship-statistics@v1",
      dailySupport: "relationship-day-post-match-15@v1",
      materiality: "global-materiality-relationship-probability@v1",
      fdr: "relationship-bh-all-eligible-scope-revision@v1",
    },
  };
  return { ...value, hypotheses, windowRoles, planDigest: digest(value) };
}

/** Product execution for the single locked PR-03 question.
 *
 * Each person is evaluated independently through the existing matching/effect/
 * statistic/materiality engine. FDR is deliberately closed only after all
 * authorized person hypotheses are present, and independently per window.
 */
export function buildGlobalM5Pr03Product(input: {
  readonly authorizedPersonIds: readonly string[];
  readonly displayNamesByPersonId?: Readonly<Record<string, string>>;
  readonly providers: readonly GlobalM5Pr03Provider[];
}) {
  const plan = buildGlobalM5Pr03ProductPlan({ authorizedPersonIds: input.authorizedPersonIds, ...(input.displayNamesByPersonId === undefined ? {} : { displayNamesByPersonId: input.displayNamesByPersonId }) });
  const providers = new Map<string, GlobalM5Pr03Provider>();
  for (const provider of input.providers) {
    const personId = provider.scope.personId;
    if (!plan.hypotheses.some((hypothesis) => hypothesis.personId === personId)) throw new TypeError("M5_PR03_UNAUTHORIZED_PERSON_PROVIDER");
    if (providers.has(personId)) throw new TypeError("M5_PR03_DUPLICATE_PERSON_PROVIDER");
    if (provider.evaluationStatus === "READY_FOR_PRODUCT" && provider.analysis.personId !== personId) throw new TypeError("M5_PR03_CROSS_PERSON_ANALYSIS");
    providers.set(personId, provider);
  }
  if (providers.size !== plan.hypotheses.length) throw new TypeError("M5_PR03_INCOMPLETE_PERSON_CLOSURE");

  const windows = windowRoles.map((windowRole) => {
    const prepared = plan.hypotheses.map((hypothesis) => {
      const provider = providers.get(hypothesis.personId)!;
      if (provider.evaluationStatus === "AUTHORITY_GATED") {
        return {
          ...hypothesis,
          windowRole,
          selectedMonths: [] as const,
          eligible: false as const,
          exclusionReason: provider.reasonCodes.join("|") || "AUTHORITY_GATED_CURRENT_REGIME",
          executedTechnicalDefinitionIds: [] as const,
        };
      }
      const months = [...new Set(provider.analysis.days.map((day) => day.date.slice(0, 7)))].sort();
      const selectedMonths = windowRole === "CURRENT" ? months : windowRole === "RECENT_6" ? months.slice(-6) : months.slice(-12, -6);
      const selectedMonthSet = new Set(selectedMonths);
      const days = provider.analysis.days.filter((day) => selectedMonthSet.has(day.date.slice(0, 7)));
      if (!days.some((day) => day.context !== "UNKNOWN" && day.contextEvidenceRefs.length > 0)) {
        return { ...hypothesis, windowRole, selectedMonths, eligible: false as const, exclusionReason: "AUTHORITY_GATED_DAY_CONTEXT", executedTechnicalDefinitionIds: [] as const };
      }
      if (provider.missingPersonDayDates.some((date) => selectedMonths.includes(date.slice(0, 7)))) {
        return { ...hypothesis, windowRole, selectedMonths, eligible: false as const, exclusionReason: "SOURCE_EXPOSURE_GAPS", executedTechnicalDefinitionIds: [] as const };
      }
      const dayIds = new Set(days.map((day) => day.id));
      if (!provider.analysis.outcomes.some((outcome) => dayIds.has(outcome.dayId)
        && outcome.outcome === GLOBAL_M5_PR03_PRODUCT_UNIVERSE.outcome
        && outcome.authority === "ACTIVITY_OCCURRENCE"
        && outcome.status === "KNOWN"
        && outcome.coverage.effective === 1)) {
        return { ...hypothesis, windowRole, selectedMonths, eligible: false as const, exclusionReason: "DATA_GATED_OUTCOME_PROVIDER", executedTechnicalDefinitionIds: [] as const };
      }
      if (!days.some((day) => day.calendarClass !== "UNKNOWN" && day.calendarEvidenceRefs.length > 0)) {
        return { ...hypothesis, windowRole, selectedMonths, eligible: false as const, exclusionReason: "AUTHORITY_GATED_CALENDAR", executedTechnicalDefinitionIds: [] as const };
      }
      if (provider.exceptionPolicy !== "NOT_USED_V1" || provider.seasonPolicy !== "NOT_REQUIRED") {
        return { ...hypothesis, windowRole, selectedMonths, eligible: false as const, exclusionReason: "E1_POLICY_GATE_FAILED", executedTechnicalDefinitionIds: [] as const };
      }
      const { weeklyInputs: _weeklyInputs, ...dailyAnalysis } = provider.analysis;
      const evaluation = buildGlobalDailyRelationships({
        ...dailyAnalysis,
        days,
        outcomes: provider.analysis.outcomes.filter((outcome) => dayIds.has(outcome.dayId)),
        definitionIds: [GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId],
        definitionMonths: { [GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId]: selectedMonths },
        windowRole,
        deferFdr: true,
      });
      const result = evaluation.results[0];
      if (!result || result.relationshipId !== GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId || evaluation.results.length !== 1) {
        throw new TypeError("M5_PR03_PRODUCT_DEFINITION_DRIFT");
      }
      const executedTechnicalDefinitionIds = evaluation.executionPlan.map(({ id }) => id);
      if (!("statistic" in result) || result.statistic === undefined) {
        return {
          ...hypothesis,
          windowRole,
          selectedMonths,
          eligible: false as const,
          exclusionReason: result.reasonCodes.join("|") || "RAW_STATISTIC_UNAVAILABLE",
          evaluation,
          executedTechnicalDefinitionIds,
        };
      }
      return {
        ...hypothesis,
        windowRole,
        selectedMonths,
        eligible: true as const,
        rawPValue: result.statistic.pValue,
        effect: result.effect,
        uncertainty: result.uncertainty,
        materiality: result.materiality,
        evaluation,
        executedTechnicalDefinitionIds,
      };
    });
    const scopeRevisionIdentity = digest({
      planDigest: plan.planDigest,
      windowRole,
      hypotheses: prepared.map((entry) => ({ id: entry.id, personId: entry.personId, eligible: entry.eligible, ...(entry.eligible ? { inputHash: entry.evaluation.inputHash, rawPValue: entry.rawPValue } : { exclusionReason: entry.exclusionReason }) })),
    });
    const fdr = closeRelationshipFdrUniverse({
      scopeRevisionIdentity,
      expectedDefinitionIds: plan.hypotheses.map(({ id }) => id),
      tests: prepared.map((entry) => entry.eligible
        ? { id: entry.id, eligible: true, pValue: entry.rawPValue }
        : { id: entry.id, eligible: false, exclusionReason: entry.exclusionReason }),
    });
    const hypotheses = prepared.map((entry) => {
      if (!entry.eligible) return entry;
      const corrected = fdr.tests.find(({ id }) => id === entry.id);
      if (!corrected) throw new TypeError("M5_PR03_FDR_RESULT_MISSING");
      return { ...entry, qValue: corrected.qValue };
    });
    return {
      windowRole,
      scopeRevisionIdentity,
      expectedHypothesisCount: plan.hypotheses.length,
      eligibleHypothesisCount: fdr.eligibleTestCount,
      hypotheses,
      fdr,
      executedTechnicalDefinitionIds: [...new Set(prepared.flatMap((entry) => entry.executedTechnicalDefinitionIds))].sort(),
    };
  });
  const finalizedEvaluation = (entry: (typeof windows)[number]["hypotheses"][number]) => {
    if (!("evaluation" in entry) || entry.evaluation === undefined || !entry.eligible || !("qValue" in entry)) return undefined;
    return {
      ...entry.evaluation,
      results: entry.evaluation.results.map((result) => {
        if (result.relationshipId !== GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId
          || !("materiality" in result) || result.materiality === undefined
          || !("temporal" in result) || result.temporal === undefined) return result;
        const qualification = qualifyGlobalDailyRelationshipEvidence({
          materialityStatus: result.materiality.status,
          temporalRobust: result.temporal.robust,
          qValue: entry.qValue,
        });
        return { ...result, qValue: entry.qValue, ...qualification };
      }),
    };
  };
  const windowEvidence = (entry: (typeof windows)[number]["hypotheses"][number]): RelationshipTemporalWindowEvidence => {
    const evaluation = finalizedEvaluation(entry);
    const result = evaluation?.results.find(({ relationshipId }) => relationshipId === GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId);
    const effect = result && "effect" in result ? result.effect : undefined;
    const uncertainty = result && "uncertainty" in result ? result.uncertainty : undefined;
    return {
      eligibleMonths: entry.selectedMonths,
      supportPassed: result?.support.supportStatus === "SUFFICIENT",
      material: result !== undefined && "materiality" in result && result.materiality?.status === "MATERIAL",
      statisticalPassed: entry.eligible && "qValue" in entry && entry.qValue <= 0.05,
      robust: result !== undefined && "temporal" in result && result.temporal?.robust === true,
      direction: Math.sign(effect?.absoluteEffect ?? 0) as -1 | 0 | 1,
      confirmedNoDifference: result?.coverage.status === "KNOWN"
        && effect?.absoluteEffect === 0
        && uncertainty?.interval95.every((value) => value === 0) === true,
    };
  };
  const ownerResults = plan.hypotheses.map((hypothesis) => {
    const provider = providers.get(hypothesis.personId)!;
    const productMetadata = {
      productUniverseId: plan.universeId,
      productDefinitionIds: plan.definitionIds,
      productHypothesisId: hypothesis.id,
    };
    if (provider.evaluationStatus === "AUTHORITY_GATED") return {
      ...provider,
      ...productMetadata,
      relationships: [] as const,
      insights: [] as const,
    };
    const { analysis: _analysis, ...providerOwner } = provider;
    const currentEntry = windows.find(({ windowRole }) => windowRole === "CURRENT")!.hypotheses.find(({ personId }) => personId === hypothesis.personId)!;
    const recentEntry = windows.find(({ windowRole }) => windowRole === "RECENT_6")!.hypotheses.find(({ personId }) => personId === hypothesis.personId)!;
    const previousEntry = windows.find(({ windowRole }) => windowRole === "PREVIOUS_6")!.hypotheses.find(({ personId }) => personId === hypothesis.personId)!;
    const temporalWindows = {
      current: windowEvidence(currentEntry),
      recent: windowEvidence(recentEntry),
      previous: windowEvidence(previousEntry),
    };
    const state = classifyRelationshipTemporalWindows(temporalWindows);
    const current = finalizedEvaluation(currentEntry);
    const recent = finalizedEvaluation(recentEntry);
    const displayed = state === "RECENT_ONLY" ? recent : current;
    const displayedResult = displayed?.results.find(({ relationshipId }) => relationshipId === GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId);
    const access = relationshipAccessPolicy({
      evidenceStatus: displayedResult?.evidenceStatus ?? "REJECTED",
      hasComparison: displayedResult !== undefined && "effect" in displayedResult,
      temporalState: state,
    });
    const relationships = [{ relationshipId: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.technicalDefinitionId, state, windows: temporalWindows, access }];
    const insights = current === undefined || recent === undefined
      ? []
      : buildRelationshipInsights({ personId: hypothesis.personId, current, recent, classifications: relationships });
    return {
      ...providerOwner,
      ...productMetadata,
      evaluationStatus: "EVALUATED" as const,
      reasonCodes: [] as const,
      relationships,
      insights,
    };
  });
  const relationshipEvolution = validateGlobalM5TransformationFeed(ownerResults.flatMap((result) => {
    if (result.evaluationStatus !== "EVALUATED") return [];
    const provider = providers.get(result.scope.personId)!;
    if (provider.evaluationStatus !== "READY_FOR_PRODUCT") return [];
    return buildGlobalM5ProductTransformationFeed({
      scope: {
        personId: result.scope.personId,
        householdId: provider.analysis.householdId,
        regimeId: provider.analysis.regimeId,
        certifiedThrough: provider.analysis.certifiedThrough,
      },
      inputHash: digest({ planDigest: plan.planDigest, productHypothesisId: result.productHypothesisId, relationships: result.relationships, windows: windows.map(({ windowRole, scopeRevisionIdentity }) => ({ windowRole, scopeRevisionIdentity })) }),
      relationships: result.relationships,
    });
  }));
  return {
    methodVersion: GLOBAL_M5_PR03_PRODUCT_UNIVERSE.version,
    plan,
    windows,
    current: windows.find(({ windowRole }) => windowRole === "CURRENT")!,
    recent6: windows.find(({ windowRole }) => windowRole === "RECENT_6")!,
    previous6: windows.find(({ windowRole }) => windowRole === "PREVIOUS_6")!,
    ownerResults,
    relationshipEvolution,
    insights: ownerResults.flatMap((result) => result.insights),
    publicationEligible: false as const,
    causalityMode: "ASSOCIATION_ONLY" as const,
    liveWrites: "NONE" as const,
  };
}
