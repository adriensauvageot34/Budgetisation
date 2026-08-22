import type { MomentId, PersonId } from "../../../core/identity";
import { parseMomentId, parsePersonId } from "../../../core/identity";
import { parseLocalDate, type LocalDate } from "../../../core/time";
import { createRuntimeSchema, hasOwn, parseStrictRecord, requireProperty } from "../../../core/validation";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import type { ScopedMoneyMetricReadModel } from "../../read-models";
import { parseScopedMetricReadModel } from "../../read-models";
import type { EntityIdentity, EntityPreview, SemanticEntityRef } from "../shared";
import {
  parseDisplayText,
  parseEntityCapabilities,
  parseEntityIdentity,
  parseEntityPreview,
  parseSemanticEntityRef,
} from "../shared";

export type MomentParticipant = { readonly personId: PersonId; readonly label?: string };
export type MomentTimeline = { readonly startsOn?: LocalDate; readonly endsOn?: LocalDate };
export type MomentHeadlineReadModel = {
  readonly causalCost?: ScopedMoneyMetricReadModel;
  readonly duringCost?: ScopedMoneyMetricReadModel;
};
export type EntityMomentReadModel = {
  readonly id: MomentId;
  readonly identity: EntityIdentity;
  readonly narrative?: string;
  readonly participants: readonly MomentParticipant[];
  readonly timeline: MomentTimeline;
  readonly headline: MomentHeadlineReadModel;
  readonly evidencePreview: EntityPreview<SemanticEntityRef>;
  readonly capabilities: QueryCapabilities;
};

function parseParticipant(value: unknown): MomentParticipant {
  const record = parseStrictRecord(value, ["personId", "label"], "MomentParticipant");
  const label = hasOwn(record, "label") ? parseDisplayText(record.label, "participant label") : undefined;
  return {
    personId: parsePersonId(requireProperty(record, "personId", "MomentParticipant")),
    ...(label === undefined ? {} : { label }),
  };
}

function parseTimeline(value: unknown): MomentTimeline {
  const record = parseStrictRecord(value, ["startsOn", "endsOn"], "MomentTimeline");
  const startsOn = hasOwn(record, "startsOn") ? parseLocalDate(record.startsOn) : undefined;
  const endsOn = hasOwn(record, "endsOn") ? parseLocalDate(record.endsOn) : undefined;
  if (startsOn !== undefined && endsOn !== undefined && endsOn < startsOn) {
    throw new TypeError("MomentTimeline.endsOn précède startsOn.");
  }
  return { ...(startsOn === undefined ? {} : { startsOn }), ...(endsOn === undefined ? {} : { endsOn }) };
}

function parseUnavailableMomentMetric(value: unknown, expectedMetricId: string): ScopedMoneyMetricReadModel {
  const metric = parseScopedMetricReadModel(value);
  if (metric.metricId !== expectedMetricId) {
    throw new TypeError(`La métrique Analytics ${expectedMetricId} n'est pas active.`);
  }
  return metric as ScopedMoneyMetricReadModel;
}

function parseHeadline(value: unknown): MomentHeadlineReadModel {
  const record = parseStrictRecord(value, ["causalCost", "duringCost"], "MomentHeadlineReadModel");
  return {
    ...(hasOwn(record, "causalCost")
      ? { causalCost: parseUnavailableMomentMetric(record.causalCost, "moment_causal_cost") }
      : {}),
    ...(hasOwn(record, "duringCost")
      ? { duringCost: parseUnavailableMomentMetric(record.duringCost, "moment_during_cost") }
      : {}),
  };
}

export function parseEntityMomentReadModel(value: unknown): EntityMomentReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "narrative", "participants", "timeline", "headline", "evidencePreview", "capabilities"],
    "EntityMomentReadModel",
  );
  const participants = requireProperty(record, "participants", "EntityMomentReadModel");
  if (!Array.isArray(participants)) throw new TypeError("Moment participants doit être un tableau.");
  const narrative = hasOwn(record, "narrative") ? parseDisplayText(record.narrative, "moment narrative") : undefined;
  return {
    id: parseMomentId(requireProperty(record, "id", "EntityMomentReadModel")),
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityMomentReadModel")),
    ...(narrative === undefined ? {} : { narrative }),
    participants: participants.map(parseParticipant),
    timeline: parseTimeline(requireProperty(record, "timeline", "EntityMomentReadModel")),
    headline: parseHeadline(requireProperty(record, "headline", "EntityMomentReadModel")),
    evidencePreview: parseEntityPreview(requireProperty(record, "evidencePreview", "EntityMomentReadModel"), parseSemanticEntityRef),
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityMomentReadModel"), queryResourceKeys.entityMoment),
  };
}

export const entityMomentReadModelSchema = createRuntimeSchema(parseEntityMomentReadModel);
