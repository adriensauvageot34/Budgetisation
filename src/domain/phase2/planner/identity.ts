import { plannerDigest, plannerString, plannerUuid } from "./json";

export const newPlannerId = (): string => globalThis.crypto.randomUUID();
const identity = (kind: string, parts: readonly (string | null)[]): string => `${kind}:${plannerDigest(["planner-id@v1", kind, ...parts])}`;
export const planSlotId = (slotIdentityKey: string): string => identity("plan-slot", [plannerString(slotIdentityKey)]);
export const componentId = (contextOccurrenceId: string, role: string, occurrenceKey: string): string =>
  identity("component", [plannerUuid(contextOccurrenceId), plannerString(role), plannerString(occurrenceKey)]);
export const mobilityIntentId = (contextOccurrenceId: string, role: string): string =>
  identity("mobility-intent", [plannerUuid(contextOccurrenceId), plannerString(role)]);
export const physicalJourneyRequirementId = (planId: string, owningContextId: string, journeySlot: string): string =>
  identity("journey", [plannerUuid(planId), plannerUuid(owningContextId), plannerString(journeySlot)]);
export const needOccurrenceId = (needId: string, sourceAcquisitionEpisodeId: string | null): string =>
  identity("need-occurrence", [plannerString(needId), sourceAcquisitionEpisodeId === null ? null : plannerString(sourceAcquisitionEpisodeId)]);
