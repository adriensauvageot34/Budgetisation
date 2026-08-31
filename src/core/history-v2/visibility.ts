import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
  type RuntimeSchema,
} from "../validation";
import {
  parseQualityEnvelope,
  type QualityEnvelope,
} from "./quality";
import {
  parseHistoryV2ReasonCode,
  type HistoryV2ReasonCode,
} from "./reason-codes";

export type Visibility = "VISIBLE" | "PLACEHOLDER" | "HIDDEN";
export type DisplayRole = "CORE" | "CONDITIONAL" | "DETAIL";

export type DisplayNode<T> =
  | {
      readonly visibility: "VISIBLE";
      readonly data: T;
      readonly reasonCode?: HistoryV2ReasonCode;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly visibility: "PLACEHOLDER";
      readonly reasonCode: HistoryV2ReasonCode;
      readonly quality?: QualityEnvelope;
    }
  | {
      readonly visibility: "HIDDEN";
      readonly reasonCode?: HistoryV2ReasonCode;
      readonly quality?: QualityEnvelope;
    };

const visibilityValues: ReadonlySet<string> = new Set<Visibility>([
  "VISIBLE",
  "PLACEHOLDER",
  "HIDDEN",
]);
const displayRoles: ReadonlySet<string> = new Set<DisplayRole>([
  "CORE",
  "CONDITIONAL",
  "DETAIL",
]);

export function parseVisibility(value: unknown): Visibility {
  return parseStringLiteral<Visibility>(
    value,
    visibilityValues,
    "Visibility",
  );
}

export function parseDisplayRole(value: unknown): DisplayRole {
  return parseStringLiteral<DisplayRole>(
    value,
    displayRoles,
    "DisplayRole",
  );
}

export function createDisplayNodeSchema<T>(
  dataSchema: RuntimeSchema<T>,
): RuntimeSchema<DisplayNode<T>> {
  return createRuntimeSchema((value: unknown) => {
    const record = parseStrictRecord(
      value,
      ["visibility", "data", "reasonCode", "quality"],
      "DisplayNodeV2",
    );
    const visibility = parseVisibility(
      requireProperty(record, "visibility", "DisplayNodeV2"),
    );
    const quality = hasOwn(record, "quality")
      ? withValidationPath("quality", () => parseQualityEnvelope(record.quality))
      : undefined;
    const reasonCode = hasOwn(record, "reasonCode")
      ? withValidationPath("reasonCode", () =>
          parseHistoryV2ReasonCode(record.reasonCode))
      : undefined;
    if (visibility === "VISIBLE") {
      return {
        visibility,
        data: withValidationPath("data", () =>
          dataSchema.parse(requireProperty(record, "data", "DisplayNodeV2"))),
        ...(reasonCode === undefined ? {} : { reasonCode }),
        ...(quality === undefined ? {} : { quality }),
      };
    }
    if (hasOwn(record, "data")) {
      throw new TypeError(
        "DisplayNodeV2 PLACEHOLDER/HIDDEN ne peut pas porter data.",
      );
    }
    if (visibility === "PLACEHOLDER" && reasonCode === undefined) {
      throw new TypeError("DisplayNodeV2 PLACEHOLDER exige reasonCode.");
    }
    return visibility === "PLACEHOLDER"
      ? {
          visibility,
          reasonCode: reasonCode!,
          ...(quality === undefined ? {} : { quality }),
        }
      : {
          visibility,
          ...(reasonCode === undefined ? {} : { reasonCode }),
          ...(quality === undefined ? {} : { quality }),
        };
  });
}

export const visibilitySchema = createRuntimeSchema(parseVisibility);
export const displayRoleSchema = createRuntimeSchema(parseDisplayRole);
