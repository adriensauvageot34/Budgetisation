import {
  parseLifeEventId,
  parseMerchantId,
  parseMetricId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
} from "../../../core/identity";
import { parseCoverage } from "../../../core/metrics";
import {
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import type { QueryResourceKey } from "../../request";
import { parseQueryCapabilities } from "../../capabilities";
import type {
  ApplicabilitySection,
  EntityIdentity,
  EntityPreview,
  PersonaRef,
  SemanticEntityRef,
} from "./types";

export function parseDisplayText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) {
    throw new TypeError(`${name} doit être un texte non vide et borné.`);
  }
  return value;
}

export function parseEntityIdentity(value: unknown): EntityIdentity {
  const record = parseStrictRecord(
    value,
    ["title", "subtitle", "status"],
    "EntityIdentity",
  );
  const subtitle = hasOwn(record, "subtitle")
    ? parseDisplayText(record.subtitle, "EntityIdentity.subtitle")
    : undefined;
  const status = hasOwn(record, "status")
    ? parseDisplayText(record.status, "EntityIdentity.status")
    : undefined;
  return {
    title: parseDisplayText(requireProperty(record, "title", "EntityIdentity"), "EntityIdentity.title"),
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(status === undefined ? {} : { status }),
  };
}

export function parseEntityPreview<T>(
  value: unknown,
  parseItem: (candidate: unknown) => T,
  name = "EntityPreview",
): EntityPreview<T> {
  const record = parseStrictRecord(value, ["items", "hasMore", "totalCount"], name);
  const rawItems = requireProperty(record, "items", name);
  if (!Array.isArray(rawItems)) throw new TypeError(`${name}.items doit être un tableau.`);
  const hasMore = requireProperty(record, "hasMore", name);
  if (typeof hasMore !== "boolean") throw new TypeError(`${name}.hasMore est invalide.`);
  const totalCount = hasOwn(record, "totalCount") ? record.totalCount : undefined;
  if (
    totalCount !== undefined &&
    (typeof totalCount !== "number" || !Number.isSafeInteger(totalCount) || totalCount < rawItems.length)
  ) {
    throw new TypeError(`${name}.totalCount est invalide.`);
  }
  if (hasMore && totalCount !== undefined && totalCount <= rawItems.length) {
    throw new TypeError(`${name} ne peut pas annoncer hasMore sans éléments restants.`);
  }
  return {
    items: rawItems.map(parseItem),
    hasMore,
    ...(totalCount === undefined ? {} : { totalCount }),
  };
}

export function parseApplicabilitySection<T>(
  value: unknown,
  parseValue: (candidate: unknown) => T,
  name = "ApplicabilitySection",
): ApplicabilitySection<T> {
  const record = parseStrictRecord(value, ["state", "value", "coverage"], name);
  const state = requireProperty(record, "state", name);
  if (state === "available") {
    const coverage = hasOwn(record, "coverage") ? parseCoverage(record.coverage) : undefined;
    return {
      state,
      value: parseValue(requireProperty(record, "value", name)),
      ...(coverage === undefined ? {} : { coverage }),
    };
  }
  if (!(state === "not_applicable" || state === "unknown" || state === "conflict")) {
    throw new TypeError(`${name}.state est invalide.`);
  }
  if (requireProperty(record, "value", name) !== null || hasOwn(record, "coverage")) {
    throw new TypeError(`${name} indisponible exige value:null sans Coverage.`);
  }
  return { state, value: null };
}

function parseOptionalRefLabel(record: Readonly<Record<string, unknown>>): string | undefined {
  return hasOwn(record, "label") ? parseDisplayText(record.label, "SemanticEntityRef.label") : undefined;
}

export function parsePersonaRef(value: unknown): PersonaRef {
  const record = parseStrictRecord(value, ["kind", "id", "label"], "PersonaRef");
  const kind = requireProperty(record, "kind", "PersonaRef");
  const label = parseOptionalRefLabel(record);
  if (kind === "ensemble") {
    if (hasOwn(record, "id")) throw new TypeError("Persona ensemble ne porte pas d'ID.");
    return { kind, ...(label === undefined ? {} : { label }) };
  }
  if (kind !== "person") throw new TypeError("PersonaRef.kind est invalide.");
  return {
    kind,
    id: parsePersonId(requireProperty(record, "id", "PersonaRef")),
    ...(label === undefined ? {} : { label }),
  };
}

export function parseSemanticEntityRef(value: unknown): SemanticEntityRef {
  const record = parseStrictRecord(value, ["kind", "id", "label"], "SemanticEntityRef");
  const kind = requireProperty(record, "kind", "SemanticEntityRef");
  if (kind === "person" || kind === "ensemble") return parsePersonaRef(value);
  const id = requireProperty(record, "id", "SemanticEntityRef");
  const label = parseOptionalRefLabel(record);
  const base = label === undefined ? {} : { label };
  switch (kind) {
    case "moment": return { kind, id: parseMomentId(id), ...base };
    case "place": return { kind, id: parsePlaceId(id), ...base };
    case "merchant": return { kind, id: parseMerchantId(id), ...base };
    case "life_event": return { kind, id: parseLifeEventId(id), ...base };
    case "operation": return { kind, id: parseOperationId(id), ...base };
    case "methodology": return { kind, id: parseMetricId(id), ...base };
    default: throw new TypeError("SemanticEntityRef.kind est invalide.");
  }
}

export function parseEntityCapabilities(
  value: unknown,
  resource: QueryResourceKey,
) {
  return parseQueryCapabilities(value, resource);
}
