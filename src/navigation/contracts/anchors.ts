import {
  parseActivityId,
  parseCategoryId,
  parseLifeEventId,
  parseMerchantId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
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

export type NavigationAnchorItem =
  | { readonly kind: "moment"; readonly id: MomentId }
  | { readonly kind: "place"; readonly id: PlaceId }
  | { readonly kind: "merchant"; readonly id: MerchantId }
  | { readonly kind: "person"; readonly id: PersonId }
  | { readonly kind: "life_event"; readonly id: LifeEventId }
  | { readonly kind: "operation"; readonly id: OperationId }
  | { readonly kind: "category"; readonly id: CategoryId }
  | { readonly kind: "activity"; readonly id: ActivityId };

export type SemanticAnchor = {
  readonly moduleId: NavigationModuleId;
  readonly item?: NavigationAnchorItem;
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

const anchorItemKinds = new Set<NavigationAnchorItem["kind"]>([
  "moment",
  "place",
  "merchant",
  "person",
  "life_event",
  "operation",
  "category",
  "activity",
]);

export function parseNavigationAnchorItem(value: unknown): NavigationAnchorItem {
  const record = parseStrictRecord(value, ["kind", "id"], "NavigationAnchorItem");
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<NavigationAnchorItem["kind"]>(
      requireProperty(record, "kind", "NavigationAnchorItem"),
      anchorItemKinds,
      "NavigationAnchorItem.kind",
    ),
  );
  const id = requireProperty(record, "id", "NavigationAnchorItem");
  switch (kind) {
    case "moment": return { kind, id: withValidationPath("id", () => parseMomentId(id)) };
    case "place": return { kind, id: withValidationPath("id", () => parsePlaceId(id)) };
    case "merchant": return { kind, id: withValidationPath("id", () => parseMerchantId(id)) };
    case "person": return { kind, id: withValidationPath("id", () => parsePersonId(id)) };
    case "life_event": return { kind, id: withValidationPath("id", () => parseLifeEventId(id)) };
    case "operation": return { kind, id: withValidationPath("id", () => parseOperationId(id)) };
    case "category": return { kind, id: withValidationPath("id", () => parseCategoryId(id)) };
    case "activity": return { kind, id: withValidationPath("id", () => parseActivityId(id)) };
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
    ["moduleId", "item", "itemKey"],
    "SemanticAnchor",
  );
  const moduleId = withValidationPath("moduleId", () =>
    parseNavigationModuleId(
      requireProperty(record, "moduleId", "SemanticAnchor"),
    ),
  );
  const item = hasOwn(record, "item")
    ? withValidationPath("item", () =>
        parseNavigationAnchorItem(record.item),
      )
    : undefined;
  const itemKey = hasOwn(record, "itemKey")
    ? withValidationPath("itemKey", () => parseItemKey(record.itemKey))
    : undefined;

  return {
    moduleId,
    ...(item === undefined ? {} : { item }),
    ...(itemKey === undefined ? {} : { itemKey }),
  };
}

export const navigationModuleIdSchema = createRuntimeSchema(
  parseNavigationModuleId,
);
export const navigationAnchorItemSchema = createRuntimeSchema(parseNavigationAnchorItem);
export const semanticAnchorSchema = createRuntimeSchema(parseSemanticAnchor);
