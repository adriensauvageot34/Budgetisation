import { plannerDigest, plannerString, plannerUuid, plannerMonth } from "./json";

export const newPlannerId = (): string => globalThis.crypto.randomUUID();
const identity = (kind: string, parts: readonly (string | null)[]): string => `${kind}:${plannerDigest(["planner-id@v1", kind, ...parts])}`;
export const planSlotId = (slotIdentityKey: string): string => identity("plan-slot", [plannerString(slotIdentityKey)]);
export const componentId = (contextOccurrenceId: string, role: string, occurrenceKey: string): string =>
  identity("component", [plannerUuid(contextOccurrenceId), plannerString(role), plannerString(occurrenceKey)]);
export const mobilityIntentId = (contextOccurrenceId: string, role: string): string =>
  identity("mobility-intent", [plannerUuid(contextOccurrenceId), plannerString(role)]);
export const physicalJourneyRequirementId = (planId: string, owningContextId: string, journeySlot: string): string =>
  identity("journey", [plannerUuid(planId), plannerUuid(owningContextId), plannerString(journeySlot)]);
/** Logical Plan scope exists before its first persisted row: one active Plan per household/month. */
export const prospectiveJourneyId = (householdId: string, month: string, ownerIdentity: string): string =>
  identity("journey", [plannerUuid(householdId), plannerMonth(month), plannerString(ownerIdentity)]);
export const needOccurrenceId = (needId: string, sourceAcquisitionEpisodeId: string | null): string =>
  identity("need-occurrence", [plannerString(needId), sourceAcquisitionEpisodeId === null ? null : plannerString(sourceAcquisitionEpisodeId)]);
export const acquisitionEpisodeId = (needId: string, acquisitionDate: string): string =>
  identity("acquisition-episode", [plannerString(needId), plannerString(acquisitionDate)]);
