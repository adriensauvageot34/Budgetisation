import type { ActivityId, LifeEventId, PersonId } from "../../../core/identity";
import { parseActivityId, parseLifeEventId, parsePersonId } from "../../../core/identity";
import { parseLocalDate, type LocalDate } from "../../../core/time";
import { createRuntimeSchema, parseStrictRecord, requireProperty } from "../../../core/validation";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import type { EntityIdentity, EntityPreview, SemanticEntityRef } from "../shared";
import {
  parseDisplayText,
  parseEntityCapabilities,
  parseEntityIdentity,
  parseEntityPreview,
  parseSemanticEntityRef,
} from "../shared";

export type LifeEventValidationStatus = "Confirmé" | "Déduit" | "À valider";
export type LifeEventParticipant = {
  readonly personId: PersonId;
  readonly label: string;
};
export type EntityLifeEventReadModel = {
  readonly id: LifeEventId;
  readonly identity: EntityIdentity;
  readonly type: string;
  readonly activityId?: ActivityId;
  readonly startsOn: LocalDate;
  readonly endsOn: LocalDate;
  readonly validationStatus: LifeEventValidationStatus;
  readonly participants: readonly LifeEventParticipant[];
  readonly places: EntityPreview<SemanticEntityRef>;
  readonly relatedMoments: EntityPreview<SemanticEntityRef>;
  readonly headline: Record<string, never>;
  readonly capabilities: QueryCapabilities;
};

function parseStatus(value: unknown): LifeEventValidationStatus {
  if (value === "Confirmé" || value === "Déduit" || value === "À valider") return value;
  throw new TypeError("LifeEvent validationStatus est invalide.");
}

function parseRefKind(value: unknown, expected: "place" | "moment") {
  const ref = parseSemanticEntityRef(value);
  if (ref.kind !== expected) throw new TypeError(`Une ref ${expected} était attendue.`);
  return ref;
}

function parseParticipant(value: unknown): LifeEventParticipant {
  const record = parseStrictRecord(value, ["personId", "label"], "LifeEventParticipant");
  return {
    personId: parsePersonId(requireProperty(record, "personId", "LifeEventParticipant")),
    label: parseDisplayText(requireProperty(record, "label", "LifeEventParticipant"), "participant label"),
  };
}

export function parseEntityLifeEventReadModel(value: unknown): EntityLifeEventReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "type", "activityId", "startsOn", "endsOn", "validationStatus", "participants", "places", "relatedMoments", "headline", "capabilities"],
    "EntityLifeEventReadModel",
  );
  const startsOn = parseLocalDate(requireProperty(record, "startsOn", "EntityLifeEventReadModel"));
  const endsOn = parseLocalDate(requireProperty(record, "endsOn", "EntityLifeEventReadModel"));
  if (endsOn < startsOn) throw new TypeError("Life Event endsOn précède startsOn.");
  const participants = requireProperty(record, "participants", "EntityLifeEventReadModel");
  if (!Array.isArray(participants)) throw new TypeError("participants doit être un tableau.");
  const parsedParticipants = participants.map(parseParticipant);
  if (new Set(parsedParticipants.map(({ personId }) => personId)).size !== parsedParticipants.length) {
    throw new TypeError("participants contient un doublon.");
  }
  parseStrictRecord(requireProperty(record, "headline", "EntityLifeEventReadModel"), [], "LifeEventHeadline");
  return {
    id: parseLifeEventId(requireProperty(record, "id", "EntityLifeEventReadModel")),
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityLifeEventReadModel")),
    type: parseDisplayText(requireProperty(record, "type", "EntityLifeEventReadModel"), "life event type"),
    ...(Object.prototype.hasOwnProperty.call(record, "activityId") ? { activityId: parseActivityId(record.activityId) } : {}),
    startsOn,
    endsOn,
    validationStatus: parseStatus(requireProperty(record, "validationStatus", "EntityLifeEventReadModel")),
    participants: parsedParticipants,
    places: parseEntityPreview(requireProperty(record, "places", "EntityLifeEventReadModel"), (item) => parseRefKind(item, "place")),
    relatedMoments: parseEntityPreview(requireProperty(record, "relatedMoments", "EntityLifeEventReadModel"), (item) => parseRefKind(item, "moment")),
    headline: {},
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityLifeEventReadModel"), queryResourceKeys.entityLifeEvent),
  };
}

export const entityLifeEventReadModelSchema = createRuntimeSchema(parseEntityLifeEventReadModel);
