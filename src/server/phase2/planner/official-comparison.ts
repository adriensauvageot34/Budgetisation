import "server-only";
import type { OfficialPlanComparisonV1, OfficialDecisionImpact, ActivePlanPointer } from "@/domain/phase2/planner/official-comparison-contract";
import type { PlanScenarioPreview, PlanningWorldFacts } from "@/domain/phase2/planner/compiler-contract";
import type { PlanRevision } from "@/domain/phase2/planner/plan-contract";
import { jsonEnvelope } from "./compiler";
import { slotReferenceKeys } from "./plan-slot-resolver";

/** No reader, compilation or financial evaluation here: explain the admitted V2 result.
 * Keep the persisted projection/digests intact, including revisions made before this view existed. */
export function officialPlanComparison(revision: PlanRevision, preview: PlanScenarioPreview, world: PlanningWorldFacts,
  authorities: "EXACT" | "CHANGED_AUTHORITIES", pointer: ActivePlanPointer | null,
  pointerAvailable: boolean): OfficialPlanComparisonV1 {
  const compiled = preview.compiled;
  const slotsById = new Map(compiled.planSlots.map(slot => [slot.baseline.planSlotId, slot]));
  const effects = new Map(compiled.contextualEffects.map(effect => [effect.componentId, effect]));
  const contextIds = (id: string, found = new Set<string>()): Set<string> => {
    if (found.has(id)) return found;
    found.add(id);
    for (const context of compiled.contexts) if (context.parentContextOccurrenceId === id) contextIds(context.contextOccurrenceId, found);
    return found;
  };
  const rows = [
    ...revision.semanticState.controls.map(control => ({ decisionId: control.decisionId, kind: "CONTROL" as const,
      targetRef: control.decisionSlotKey, parentContextOccurrenceId: null,
      componentIds: [] as string[], slots: compiled.planSlots.filter(slot => slot.decisionId === control.decisionId) })),
    ...revision.semanticState.contexts.map(context => {
      const ids = contextIds(context.contextOccurrenceId);
      const components = compiled.components.filter(component => component.contextOccurrenceId !== null && ids.has(component.contextOccurrenceId));
      const slotIds = new Set(components.flatMap(component => {
        const id = effects.get(component.componentId)?.baselinePlanSlotId;
        return id ? [id] : [];
      }));
      return { decisionId: context.contextOccurrenceId, kind: "CONTEXT" as const, targetRef: context.contextOccurrenceId,
        parentContextOccurrenceId: compiled.contexts.find(item => item.contextOccurrenceId === context.contextOccurrenceId)?.parentContextOccurrenceId ?? null,
        componentIds: components.map(component => component.componentId), slots: compiled.planSlots.filter(slot => slotIds.has(slot.baseline.planSlotId)) };
    }),
  ];
  // Shared capacities/ownership groups, nested components and shared physical journeys
  // identify potential interactions. This is deliberately not an additivity certificate.
  const footprints = rows.map(row => new Set([
    ...row.slots.flatMap(slot => [`slot:${slot.baseline.planSlotId}`,
      ...(slot.baseline.simpleAuthority ? [`group:${slot.baseline.simpleAuthority.ownershipGroup}`] : []),
      ...slotReferenceKeys(slot).map(key => `reference:${key}`)]),
    ...row.componentIds.map(id => `component:${id}`),
    ...compiled.journeys.filter(journey => {
      const ids = row.kind === "CONTEXT" ? contextIds(row.decisionId) : new Set<string>();
      return ids.has(journey.ownerContextOccurrenceId) || compiled.mobilityIntents.some(intent =>
        ids.has(intent.contextOccurrenceId) && journey.participatingIntentIds.includes(intent.mobilityIntentId));
    }).map(journey => `journey:${journey.physicalJourneyRequirementId}`),
  ]));
  const decisions: OfficialDecisionImpact[] = rows.map((row, index) => {
    const marginal = preview.projection.impacts.find(impact => impact.targetRef === row.decisionId && "rationaleCode" in impact);
    const amount = typeof marginal?.marginalImpactOnMonthEnd === "string" ? marginal.marginalImpactOnMonthEnd : null;
    return { decisionId: row.decisionId, kind: row.kind, targetRef: row.targetRef,
      parentContextOccurrenceId: row.parentContextOccurrenceId, componentIds: row.componentIds,
      planSlotIds: row.slots.map(slot => slot.baseline.planSlotId), marginalImpactOnMonthEnd: amount,
      rationaleCode: typeof marginal?.rationaleCode === "string" ? marginal.rationaleCode : "MARGINAL_EVIDENCE_UNAVAILABLE",
      comparisonSemanticStateDigest: typeof marginal?.comparisonSemanticStateDigest === "string" ? marginal.comparisonSemanticStateDigest : null,
      attribution: amount === null ? "UNRESOLVED" : "CONDITIONAL_MARGINAL_NOT_ADDITIVE",
      interactingDecisionIds: rows.filter((_, other) => other !== index && [...footprints[index]].some(key => footprints[other].has(key))).map(other => other.decisionId) };
  });
  return { version: "official-plan-comparison@v1", householdId: revision.householdId, targetMonth: revision.targetMonth,
    revision: { planId: revision.planId, planRevisionId: revision.planRevisionId, revisionNumber: revision.revisionNumber,
      semanticStateDigest: revision.semanticStateDigest, storedBaselineDigest: revision.baselineDigest,
      storedCompiledManifestDigest: revision.compiledManifestDigest, storedProjectionDigest: String(revision.projectionEvidence.projectionDigest) },
    freshness: { activeRevision: !pointerAvailable ? "UNAVAILABLE"
      : pointer?.planId === revision.planId && pointer.activeRevisionId === revision.planRevisionId && pointer.activeRevisionNumber === revision.revisionNumber
        ? "CURRENT_AT_CHECK" : "SUPERSEDED", checkedPointer: pointer ? { planId: pointer.planId,
          activeRevisionId: pointer.activeRevisionId, activeRevisionNumber: pointer.activeRevisionNumber } : null, authorities },
    authorities: { baselineDigest: preview.baselineDigest, compiledManifestDigest: preview.compiledManifestDigest,
      projectionDigest: preview.projectionDigest, knowledgeCutoff: world.baseline.knowledgeCutoff, asOfDate: world.asOfDate,
      modelVersions: jsonEnvelope(compiled.manifest.modelVersions), forecastPublicationId: world.forecast.publicationMeta.publicationId,
      forecastRevision: world.forecast.publicationMeta.revision, forecastResourceInputHash: world.forecast.resourceMeta.resourceInputHash },
    projection: preview.projection, decomposition: "NON_ADDITIVE_MARGINALS_AND_COMPONENT_LENSES", decisions,
    slots: [...slotsById.values()].filter(slot => slot.owned).map(slot => ({ planSlotId: slot.baseline.planSlotId,
      slotIdentityKey: slot.baseline.slotIdentityKey, decisionId: slot.decisionId, role: slot.role,
      baselineValue: slot.baseline.baselineValue, effectiveAmount: slot.effectiveAmount, effectiveCount: slot.effectiveCount,
      effectiveUnitAmount: slot.effectiveUnitAmount, remainingEconomicAmount: slot.remainingEconomicAmount,
      referenceKeys: slotReferenceKeys(slot), sourceRefs: slot.baseline.sourceRefs })),
    components: compiled.contextualEffects.map(effect => {
      const component = compiled.components.find(item => item.componentId === effect.componentId)!;
      return { effect, contextOccurrenceId: component.contextOccurrenceId, externalEntryId: component.externalEntryId,
        physicalJourneyRequirementId: component.physicalJourneyRequirementId ?? null, plannedDate: component.plannedDate,
        costBasis: component.evaluation.basis, fundingAllocations: component.fundingAllocations };
    }) };
}
