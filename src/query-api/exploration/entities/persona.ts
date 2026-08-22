import type { ActivityId, PersonId } from "../../../core/identity";
import { parseActivityId, parsePersonId } from "../../../core/identity";
import { createRuntimeSchema, hasOwn, parseStrictRecord, requireProperty } from "../../../core/validation";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys, parsePersonaTarget, type PersonaTarget } from "../../request";
import type { ScopedMetricReadModel, ScopedMoneyMetricReadModel } from "../../read-models";
import { parseScopedMetricReadModel } from "../../read-models";
import type { EntityIdentity, EntityPreview, SemanticEntityRef } from "../shared";
import {
  parseDisplayText,
  parseEntityCapabilities,
  parseEntityIdentity,
  parseEntityPreview,
  parseSemanticEntityRef,
} from "../shared";

export type PersonaActivityPreviewItem = {
  readonly activityId: ActivityId;
  readonly label: string;
};

export type EntityPersonaReadModel = {
  readonly id: PersonId | "ensemble";
  readonly identity: EntityIdentity;
  readonly target: PersonaTarget;
  readonly headlineMetrics: readonly ScopedMetricReadModel[];
  readonly typicalPreview?: ScopedMoneyMetricReadModel;
  readonly activityPreview: EntityPreview<PersonaActivityPreviewItem>;
  readonly placePreview: EntityPreview<SemanticEntityRef>;
  readonly merchantPreview: EntityPreview<SemanticEntityRef>;
  readonly capabilities: QueryCapabilities;
};

function parseMetricArray(value: unknown): readonly ScopedMetricReadModel[] {
  if (!Array.isArray(value)) throw new TypeError("Persona headlineMetrics doit être un tableau.");
  const metrics = value.map(parseScopedMetricReadModel);
  if (new Set(metrics.map(({ metricId }) => metricId)).size !== metrics.length) {
    throw new TypeError("Persona headlineMetrics contient un doublon.");
  }
  return metrics;
}

function parseRefKind(value: unknown, expected: SemanticEntityRef["kind"]): SemanticEntityRef {
  const ref = parseSemanticEntityRef(value);
  if (ref.kind !== expected) throw new TypeError(`Une ref ${expected} était attendue.`);
  return ref;
}

function parseActivityItem(value: unknown): PersonaActivityPreviewItem {
  const record = parseStrictRecord(value, ["activityId", "label"], "PersonaActivityPreviewItem");
  return {
    activityId: parseActivityId(requireProperty(record, "activityId", "PersonaActivityPreviewItem")),
    label: parseDisplayText(requireProperty(record, "label", "PersonaActivityPreviewItem"), "activity label"),
  };
}

export function parseEntityPersonaReadModel(value: unknown): EntityPersonaReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "target", "headlineMetrics", "typicalPreview", "activityPreview", "placePreview", "merchantPreview", "capabilities"],
    "EntityPersonaReadModel",
  );
  const target = parsePersonaTarget(requireProperty(record, "target", "EntityPersonaReadModel"));
  const rawId = requireProperty(record, "id", "EntityPersonaReadModel");
  const id = rawId === "ensemble" ? rawId : parsePersonId(rawId);
  if ((target.kind === "ensemble" && id !== "ensemble") || (target.kind === "person" && id !== target.personId)) {
    throw new TypeError("EntityPersonaReadModel.id et target sont incohérents.");
  }
  const typicalPreview = hasOwn(record, "typicalPreview")
    ? parseScopedMetricReadModel(record.typicalPreview)
    : undefined;
  if (typicalPreview !== undefined && typicalPreview.metricId !== "typical_month_cost") {
    throw new TypeError("Persona typicalPreview doit réutiliser Typical Month.");
  }
  return {
    id,
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityPersonaReadModel")),
    target,
    headlineMetrics: parseMetricArray(requireProperty(record, "headlineMetrics", "EntityPersonaReadModel")),
    ...(typicalPreview === undefined ? {} : { typicalPreview: typicalPreview as ScopedMoneyMetricReadModel }),
    activityPreview: parseEntityPreview(requireProperty(record, "activityPreview", "EntityPersonaReadModel"), parseActivityItem),
    placePreview: parseEntityPreview(requireProperty(record, "placePreview", "EntityPersonaReadModel"), (item) => parseRefKind(item, "place")),
    merchantPreview: parseEntityPreview(requireProperty(record, "merchantPreview", "EntityPersonaReadModel"), (item) => parseRefKind(item, "merchant")),
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityPersonaReadModel"), queryResourceKeys.entityPersona),
  };
}

export const entityPersonaReadModelSchema = createRuntimeSchema(parseEntityPersonaReadModel);
