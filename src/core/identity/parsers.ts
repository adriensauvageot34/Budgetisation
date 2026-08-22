import type {
  ActivityId,
  CategoryId,
  HouseholdId,
  LifeEventId,
  MerchantId,
  MetricId,
  MomentId,
  OperationId,
  PersonId,
  PlaceId,
  SubcategoryId,
} from "./ids";

const canonicalUuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function parseUuidId<Id extends string>(value: unknown, typeName: string): Id {
  if (typeof value !== "string" || !canonicalUuidPattern.test(value)) {
    throw new TypeError(`${typeName} doit être un UUID canonique.`);
  }
  return value as Id;
}

function parseOpaqueId<Id extends string>(value: unknown, typeName: string): Id {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${typeName} doit être une chaîne non vide.`);
  }
  return value as Id;
}

export function parseHouseholdId(value: unknown): HouseholdId {
  return parseUuidId<HouseholdId>(value, "HouseholdId");
}

export function parsePersonId(value: unknown): PersonId {
  return parseUuidId<PersonId>(value, "PersonId");
}

export function parseOperationId(value: unknown): OperationId {
  return parseUuidId<OperationId>(value, "OperationId");
}

export function parseMomentId(value: unknown): MomentId {
  return parseUuidId<MomentId>(value, "MomentId");
}

export function parsePlaceId(value: unknown): PlaceId {
  return parseUuidId<PlaceId>(value, "PlaceId");
}

export function parseMerchantId(value: unknown): MerchantId {
  return parseUuidId<MerchantId>(value, "MerchantId");
}

export function parseCategoryId(value: unknown): CategoryId {
  return parseUuidId<CategoryId>(value, "CategoryId");
}

export function parseSubcategoryId(value: unknown): SubcategoryId {
  return parseUuidId<SubcategoryId>(value, "SubcategoryId");
}

export function parseLifeEventId(value: unknown): LifeEventId {
  return parseUuidId<LifeEventId>(value, "LifeEventId");
}

export function parseActivityId(value: unknown): ActivityId {
  return parseOpaqueId<ActivityId>(value, "ActivityId");
}

export function parseMetricId(value: unknown): MetricId {
  return parseOpaqueId<MetricId>(value, "MetricId");
}
