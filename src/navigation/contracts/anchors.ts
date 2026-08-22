import {
  parseActivityId,
  parseOperationId,
  type ActivityId,
  type CategoryId,
  type LifeEventId,
  type MerchantId,
  type MomentId,
  type OperationId,
  type PersonId,
  type PlaceId,
} from "../../core/identity";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";

export type NavigationModuleId =
  | "calendar"
  | "calendar-month"
  | "calendar-week"
  | "day-drawer"
  | "analysis-month"
  | "analysis-global"
  | "operations"
  | "exploration";

export type NavigationEntityId =
  | MomentId
  | PlaceId
  | MerchantId
  | PersonId
  | LifeEventId
  | OperationId
  | CategoryId
  | ActivityId;

export type SemanticAnchor = {
  readonly moduleId: NavigationModuleId;
  readonly entityId?: NavigationEntityId;
  readonly itemKey?: string;
};

const navigationModuleIds = new Set<NavigationModuleId>([
  "calendar",
  "calendar-month",
  "calendar-week",
  "day-drawer",
  "analysis-month",
  "analysis-global",
  "operations",
  "exploration",
]);

export function parseNavigationModuleId(value: unknown): NavigationModuleId {
  return parseStringLiteral<NavigationModuleId>(
    value,
    navigationModuleIds,
    "NavigationModuleId",
  );
}

export function parseNavigationEntityId(value: unknown): NavigationEntityId {
  try {
    return parseOperationId(value);
  } catch {
    return parseActivityId(value);
  }
}

function parseItemKey(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    validationFailure({
      path: [],
      code: "invalid_string",
      message: "SemanticAnchor.itemKey doit être une chaîne non vide.",
    });
  }
  return value;
}

export function parseSemanticAnchor(value: unknown): SemanticAnchor {
  const record = parseStrictRecord(
    value,
    ["moduleId", "entityId", "itemKey"],
    "SemanticAnchor",
  );
  const moduleId = withValidationPath("moduleId", () =>
    parseNavigationModuleId(
      requireProperty(record, "moduleId", "SemanticAnchor"),
    ),
  );
  const entityId = hasOwn(record, "entityId")
    ? withValidationPath("entityId", () =>
        parseNavigationEntityId(record.entityId),
      )
    : undefined;
  const itemKey = hasOwn(record, "itemKey")
    ? withValidationPath("itemKey", () => parseItemKey(record.itemKey))
    : undefined;

  return {
    moduleId,
    ...(entityId === undefined ? {} : { entityId }),
    ...(itemKey === undefined ? {} : { itemKey }),
  };
}

export const navigationModuleIdSchema = createRuntimeSchema(
  parseNavigationModuleId,
);
export const navigationEntityIdSchema = createRuntimeSchema(
  parseNavigationEntityId,
);
export const semanticAnchorSchema = createRuntimeSchema(parseSemanticAnchor);
