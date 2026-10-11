import "server-only";
import type { CardKnowledgeDimension, CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { PlanningPlanSlot, PlanningBaselineV1 } from "@/domain/phase2/planner/baseline-contract";
import type { PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";

export const CARD_KNOWLEDGE_VERSION = "composer-card-knowledge@v1" as const;
const unavailable = (reason: string, authority: string): CardKnowledgeDimension => ({
  key: "UNIT_PRICE", value: null, unit: "EUR_PER_PRODUCT", p25: null, p50: null, p75: null,
  evidenceState: "UNKNOWN", sourceAuthority: authority, sourceRefs: [], sourceDigests: [], nOccurrences: null,
  nCoveredMonths: null, coverageFrom: null, coverageTo: null, observedAt: null,
  suggestionPolicy: "UNAVAILABLE", reasonCodes: [reason],
});
const sourceDetails = (baseline: PlanningBaselineV1, keys: readonly string[]) => ({
  sourceRefs: keys, sourceDigests: keys.flatMap(key => {
    const source = baseline.sourceRefs.find(ref => ref.sourceKey === key);
    return source ? [`${source.owner}:${source.digest}`] : [];
  }),
});
function slotDimensions(baseline: PlanningBaselineV1, slot: PlanningPlanSlot): CardKnowledgeDimension[] {
  const history = slot.historicalReferences, sources = sourceDetails(baseline, slot.sourceRefs);
  const owner = baseline.sourceRefs.find(ref => slot.sourceRefs.includes(ref.sourceKey))?.owner ?? "PLANNING_BASELINE";
  const knownSamples = history?.samples.filter(sample => sample.value !== null) ?? [];
  const months = history?.comparableMonths ?? [];
  const key = slot.kind === "AMOUNT" ? "MONTH_AMOUNT" : "OCCURRENCE_COUNT";
  const declaration = !history && slot.provenance.includes("USER_VALIDATED_HABIT");
  const declaredValue = key === "MONTH_AMOUNT" ? slot.baselineValue.amount : slot.baselineValue.count;
  const historical: CardKnowledgeDimension = {
    key, value: history?.range.central ?? (declaration ? declaredValue : null),
    unit: key === "MONTH_AMOUNT" ? "EUR_PER_MONTH" : "OCCURRENCES_PER_MONTH",
    p25: history?.range.low ?? null, p50: history?.range.central ?? null, p75: history?.range.high ?? null,
    evidenceState: declaration ? "DECLARED" : history?.range.central !== null && history?.range.central !== undefined
      ? knownSamples.length === history.samples.length ? "ESTIMATED" : "PARTIAL" : "UNKNOWN",
    sourceAuthority: owner,
    ...sources, nOccurrences: null, nCoveredMonths: history ? months.length : null, coverageFrom: months[0] ?? null,
    coverageTo: months.at(-1) ?? null, observedAt: null,
    suggestionPolicy: declaration ? "REFERENCE_ONLY" : !history ? "UNAVAILABLE" : history.range.central !== null && months.length >= 3
      && slot.inclusion === "CENTRAL" && slot.simpleAuthority?.gate !== "NEEDS_NEW_INPUT" ? "OFFER_PREFILL" : "REFERENCE_ONLY",
    reasonCodes: declaration ? ["USER_VALIDATED_DECLARATION"] : !history ? ["NO_COMPARABLE_HISTORY"] : [
      months.length < 3 ? "INSUFFICIENT_COMPARABLE_MONTHS" : knownSamples.length < history.samples.length
        ? "PARTIAL_COVERAGE" : "COVERED_COMPARABLE_MONTHS",
      ...(slot.simpleAuthority?.gate === "NEEDS_NEW_INPUT" ? ["OWNER_NEEDS_NEW_INPUT"] : []),
    ],
  };
  const dimensions = [historical];
  if (slot.baselineValue.unitAmount !== null) {
    dimensions.push({ key: "UNIT_PRICE", value: slot.baselineValue.unitAmount,
      unit: slot.renewalAuthority ? "EUR_PER_PRODUCT" : "EUR_PER_OCCURRENCE",
      p25: null, p50: null, p75: null,
      evidenceState: slot.knowledge === "DECLARED" ? "DECLARED" : "PARTIAL",
      sourceAuthority: owner,
      ...sources, nOccurrences: null, nCoveredMonths: null, coverageFrom: null,
      coverageTo: null, observedAt: null,
      suggestionPolicy: "REFERENCE_ONLY", reasonCodes: ["PRICE_AND_FREQUENCY_SEPARATE", "PRICE_COVERAGE_UNPUBLISHED"] });
  }
  return dimensions;
}
const knownCard = (cardKey: string, scope: CardKnowledgeRead["subjectScope"], subjectRef: string | null,
  dimensions: readonly CardKnowledgeDimension[]): CardKnowledgeRead => ({ cardKey, subjectScope: scope,
  subjectRef, dimensions, knowledgeVersion: CARD_KNOWLEDGE_VERSION });

/** Uses only authorities already admitted for this Preview. No query, quantile, clock, cache or write. */
export function projectCardKnowledge(world: PlanningWorldFacts, assets: readonly ComposerAssetView[]): Readonly<Record<string, CardKnowledgeRead>> {
  const baseline = world.baseline;
  if (world.forecast.meta.targetMonth !== baseline.targetMonth) throw new TypeError("CARD_KNOWLEDGE_MONTH_MISMATCH");
  const slots = new Map(baseline.slots.map(slot => [slot.slotIdentityKey, slot]));
  const bySemantic = new Map(baseline.slots.map(slot => [slot.semanticKey, slot]));
  const cards: Record<string, CardKnowledgeRead> = {};
  const dining: Readonly<Record<string, string>> = { restaurant: "restaurants", "fast-food": "fast-food", delivery: "delivery" };
  for (const asset of assets) {
    // Dynamic socket options have no stable subject until configured. Publishing
    // one empty record per catalogue option bloats every READ without knowledge.
    if (asset.kind === "SLOT_OPTION_ASSET") continue;
    if (asset.kind === "PLAN_CONTROL" || asset.kind === "RESERVATION_CONTROL") {
      const slot = slots.get(asset.capabilityRef);
      const forecast = slot && world.forecast.components.find(component => component.key === slot.semanticKey);
      const forecastDimension: CardKnowledgeDimension[] = forecast && forecast.central !== null
        && forecast.knowledgeState === "PROBABLE" ? [{
        key: "FORECAST_MONTH", value: forecast.central, unit: "EUR_PER_MONTH", p25: forecast.low, p50: null, p75: forecast.high,
        evidenceState: forecast.knowledgeState === "PROBABLE" ? "ESTIMATED" : "UNKNOWN",
        sourceAuthority: forecast.ownerAuthority, sourceRefs: forecast.provenance,
        sourceDigests: [`${world.forecast.meta.sourcePublicationId}:${world.forecast.meta.sourceRevision}`],
        nOccurrences: null, nCoveredMonths: null, coverageFrom: world.forecast.meta.targetMonth,
        coverageTo: world.forecast.meta.targetMonth,
        observedAt: forecast.freshnessDate, suggestionPolicy: "REFERENCE_ONLY", reasonCodes: ["FORECAST_NOT_DECISION"],
      }] : [];
      cards[asset.assetKey] = slot ? knownCard(asset.assetKey, slot.scope.kind, slot.scope.personId ?? null,
        [...slotDimensions(baseline, slot), ...forecastDimension])
        : knownCard(asset.assetKey, "HOUSEHOLD", null, [unavailable("SLOT_NOT_PUBLISHED", "PLANNING_BASELINE")]);
      continue;
    }
    const semantic = asset.templateKey ? dining[asset.templateKey] : undefined;
    const related = semantic ? bySemantic.get(semantic) : undefined;
    if (related && asset.kind === "CONTEXT_ASSET") {
      // Dining evidence is a household occurrence/price reference, never a proven
      // participant count or a context-specific planned expense.
      cards[asset.assetKey] = knownCard(asset.assetKey, "HOUSEHOLD", null,
        slotDimensions(baseline, related).map(dimension => ({ ...dimension, suggestionPolicy: "REFERENCE_ONLY" as const,
          reasonCodes: [...dimension.reasonCodes, "CONTEXT_IDENTITY_NOT_PROVEN"] })));
      continue;
    }
    const reason = asset.templateKey === "gift" ? "GIFT_PRODUCT_IDENTITY_NOT_LINKED"
      : asset.templateKey === "family-visit" ? "ROUTE_DOES_NOT_PROVE_VISIT"
      : asset.templateKey === "beauty-restock" ? "PRODUCT_IDENTITY_REQUIRED"
      : asset.templateKey === "night-out" || asset.templateKey === "short-stay" ? "COMPONENT_PRICES_REQUIRED"
      : "NO_CARD_SPECIFIC_OWNER_REFERENCE";
    cards[asset.assetKey] = knownCard(asset.assetKey, "EVENT", null, [unavailable(reason, asset.templateKey ?? "PLANNING_BASELINE")]);
  }
  return cards;
}
