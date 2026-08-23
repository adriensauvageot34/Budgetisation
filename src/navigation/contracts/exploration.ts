import {
  parseLifeEventId,
  parseMerchantId,
  parseMetricId,
  parseMomentId,
  parseOperationId,
  parsePersonId,
  parsePlaceId,
  type LifeEventId,
  type MerchantId,
  type MetricId,
  type MomentId,
  type OperationId,
  type PersonId,
  type PlaceId,
} from "../../core/identity";
import {
  parseAnalysisScope,
  parseAnalysisTargetSubject,
  type AnalysisScope,
  type AnalysisTargetSubject,
} from "../../core/scope";
import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";
import {
  galleryNavigationFiltersSchema,
  type GalleryNavigationFilters,
} from "./gallery";

export type NonGalleryExplorationNode =
  | {
      readonly kind: "analysis";
      readonly target: AnalysisTargetSubject;
      readonly scope: AnalysisScope;
    }
  | {
      readonly kind: "moment";
      readonly id: MomentId;
    }
  | {
      readonly kind: "place";
      readonly id: PlaceId;
    }
  | {
      readonly kind: "merchant";
      readonly id: MerchantId;
    }
  | {
      readonly kind: "persona";
      readonly id: PersonId | "ensemble";
    }
  | {
      readonly kind: "life_event";
      readonly id: LifeEventId;
    }
  | {
      readonly kind: "operation";
      readonly id: OperationId;
    }
  | {
      readonly kind: "methodology";
      readonly metricId: MetricId;
    };

export type GalleryExplorationNode = {
  readonly kind: "gallery";
} & GalleryNavigationFilters;

export type ExplorationNode = NonGalleryExplorationNode | GalleryExplorationNode;

type NonGalleryKind = NonGalleryExplorationNode["kind"];

const nonGalleryKinds = new Set<NonGalleryKind>([
  "analysis",
  "moment",
  "place",
  "merchant",
  "persona",
  "life_event",
  "operation",
  "methodology",
]);
const explorationKinds = new Set<ExplorationNode["kind"]>([
  ...nonGalleryKinds,
  "gallery",
]);

function parseNonGalleryByKind(
  value: unknown,
  kind: NonGalleryKind,
): NonGalleryExplorationNode {
  if (kind === "analysis") {
    const record = parseStrictRecord(
      value,
      ["kind", "target", "scope"],
      "AnalysisExplorationNode",
    );
    return {
      kind,
      target: withValidationPath("target", () =>
        parseAnalysisTargetSubject(
          requireProperty(record, "target", "AnalysisExplorationNode"),
        ),
      ),
      scope: withValidationPath("scope", () =>
        parseAnalysisScope(
          requireProperty(record, "scope", "AnalysisExplorationNode"),
        ),
      ),
    };
  }

  if (kind === "methodology") {
    const record = parseStrictRecord(
      value,
      ["kind", "metricId"],
      "MethodologyExplorationNode",
    );
    return {
      kind,
      metricId: withValidationPath("metricId", () =>
        parseMetricId(
          requireProperty(record, "metricId", "MethodologyExplorationNode"),
        ),
      ),
    };
  }

  const record = parseStrictRecord(value, ["kind", "id"], "ExplorationNode");
  const id = requireProperty(record, "id", "ExplorationNode");

  switch (kind) {
    case "moment":
      return { kind, id: withValidationPath("id", () => parseMomentId(id)) };
    case "place":
      return { kind, id: withValidationPath("id", () => parsePlaceId(id)) };
    case "merchant":
      return { kind, id: withValidationPath("id", () => parseMerchantId(id)) };
    case "persona":
      return {
        kind,
        id:
          id === "ensemble"
            ? "ensemble"
            : withValidationPath("id", () => parsePersonId(id)),
      };
    case "life_event":
      return { kind, id: withValidationPath("id", () => parseLifeEventId(id)) };
    case "operation":
      return { kind, id: withValidationPath("id", () => parseOperationId(id)) };
  }
}

export function parseNonGalleryExplorationNode(
  value: unknown,
): NonGalleryExplorationNode {
  const candidate = parseStrictRecord(
    value,
    ["kind", "target", "scope", "id", "metricId"],
    "NonGalleryExplorationNode",
  );
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<NonGalleryKind>(
      requireProperty(candidate, "kind", "NonGalleryExplorationNode"),
      nonGalleryKinds,
      "NonGalleryExplorationNode.kind",
    ),
  );
  return parseNonGalleryByKind(value, kind);
}

export const nonGalleryExplorationNodeSchema = createRuntimeSchema(
  parseNonGalleryExplorationNode,
);

export function parseExplorationNode(value: unknown): ExplorationNode {
  const candidate = parseStrictRecord(
    value,
    ["kind", "target", "scope", "id", "gallery", "filters", "metricId"],
    "ExplorationNode",
  );
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<ExplorationNode["kind"]>(
      requireProperty(candidate, "kind", "ExplorationNode"),
      explorationKinds,
      "ExplorationNode.kind",
    ),
  );

  if (kind !== "gallery") return parseNonGalleryByKind(value, kind);

  const record = parseStrictRecord(
    value,
    ["kind", "gallery", "filters"],
    "GalleryExplorationNode",
  );
  const galleryNavigationFilters = withValidationPath("gallery", () =>
    galleryNavigationFiltersSchema.parse({
      gallery: requireProperty(record, "gallery", "GalleryExplorationNode"),
      filters: requireProperty(record, "filters", "GalleryExplorationNode"),
    }),
  );
  return { kind, ...galleryNavigationFilters };
}

export const explorationNodeSchema = createRuntimeSchema(parseExplorationNode);
