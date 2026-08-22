import type { Brand } from "../../core/identity";
import type { ScopeHash } from "../../core/scope";
import type { GlobalWindow, YearMonth } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import { semanticAnchorSchema, type SemanticAnchor } from "./anchors";
import type { NavigationCheckpoint } from "./checkpoint";

export type ScrollContainerRef =
  | { readonly kind: "root" }
  | { readonly kind: "day_drawer" };

export type RestorationReadiness =
  | { readonly kind: "ready" }
  | { readonly kind: "terminal_without_anchor" }
  | { readonly kind: "cancelled" };

export type NavigationRestorationCause =
  | { readonly kind: "voluntary_month_navigation" }
  | { readonly kind: "analysis_mode_switch" }
  | { readonly kind: "browser_history" }
  | { readonly kind: "checkpoint_restore" };

export type AnalysisScrollContext =
  | {
      readonly kind: "analysis_month";
      readonly month: YearMonth;
      readonly scopeHash?: ScopeHash;
    }
  | {
      readonly kind: "analysis_global";
      readonly window: GlobalWindow;
      readonly scopeHash?: ScopeHash;
    };

export type ScrollContextKey = Brand<string, "ScrollContextKey">;

export type ScrollMemory = {
  readonly anchor?: SemanticAnchor;
  readonly anchorOffset?: number;
  readonly scrollY: number;
};

export type RestorationIntent = {
  readonly checkpoint: NavigationCheckpoint;
  readonly container: ScrollContainerRef;
  readonly readiness: Promise<RestorationReadiness>;
};

export type RestorationOutcome =
  | { readonly kind: "anchor"; readonly scrollY: number }
  | { readonly kind: "fallback"; readonly scrollY: number }
  | { readonly kind: "top"; readonly scrollY: 0 }
  | { readonly kind: "cancelled" };

export type ScrollRestorationSelection =
  | { readonly kind: "memory"; readonly memory: ScrollMemory }
  | { readonly kind: "top" };

const scrollContainerKinds = new Set<ScrollContainerRef["kind"]>([
  "root",
  "day_drawer",
]);
const readinessKinds = new Set<RestorationReadiness["kind"]>([
  "ready",
  "terminal_without_anchor",
  "cancelled",
]);
const restorationCauses = new Set<NavigationRestorationCause["kind"]>([
  "voluntary_month_navigation",
  "analysis_mode_switch",
  "browser_history",
  "checkpoint_restore",
]);

function parseFiniteNumber(value: unknown, typeName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    validationFailure({
      path: [],
      code: "invalid_number",
      message: `${typeName} doit être un nombre fini.`,
    });
  }
  return value;
}

export function parseScrollContainerRef(value: unknown): ScrollContainerRef {
  const record = parseStrictRecord(value, ["kind"], "ScrollContainerRef");
  return {
    kind: parseStringLiteral<ScrollContainerRef["kind"]>(
      requireProperty(record, "kind", "ScrollContainerRef"),
      scrollContainerKinds,
      "ScrollContainerRef.kind",
    ),
  };
}

export function parseRestorationReadiness(
  value: unknown,
): RestorationReadiness {
  const record = parseStrictRecord(value, ["kind"], "RestorationReadiness");
  return {
    kind: parseStringLiteral<RestorationReadiness["kind"]>(
      requireProperty(record, "kind", "RestorationReadiness"),
      readinessKinds,
      "RestorationReadiness.kind",
    ),
  };
}

export function parseNavigationRestorationCause(
  value: unknown,
): NavigationRestorationCause {
  const record = parseStrictRecord(
    value,
    ["kind"],
    "NavigationRestorationCause",
  );
  return {
    kind: parseStringLiteral<NavigationRestorationCause["kind"]>(
      requireProperty(record, "kind", "NavigationRestorationCause"),
      restorationCauses,
      "NavigationRestorationCause.kind",
    ),
  };
}

export function parseScrollMemory(value: unknown): ScrollMemory {
  const record = parseStrictRecord(
    value,
    ["anchor", "anchorOffset", "scrollY"],
    "ScrollMemory",
  );
  const anchor = hasOwn(record, "anchor")
    ? withValidationPath("anchor", () => semanticAnchorSchema.parse(record.anchor))
    : undefined;
  if (hasOwn(record, "anchorOffset") && anchor === undefined) {
    validationFailure({
      path: ["anchorOffset"],
      code: "missing_anchor",
      message: "ScrollMemory.anchorOffset exige anchor.",
    });
  }
  const anchorOffset = hasOwn(record, "anchorOffset")
    ? withValidationPath("anchorOffset", () =>
        parseFiniteNumber(record.anchorOffset, "ScrollMemory.anchorOffset"),
      )
    : undefined;
  const scrollY = withValidationPath("scrollY", () =>
    parseFiniteNumber(
      requireProperty(record, "scrollY", "ScrollMemory"),
      "ScrollMemory.scrollY",
    ),
  );
  if (scrollY < 0) {
    validationFailure({
      path: ["scrollY"],
      code: "out_of_range",
      message: "ScrollMemory.scrollY doit être positif ou nul.",
    });
  }
  return {
    ...(anchor === undefined ? {} : { anchor }),
    ...(anchorOffset === undefined ? {} : { anchorOffset }),
    scrollY,
  };
}

export const scrollContainerRefSchema = createRuntimeSchema(
  parseScrollContainerRef,
);
export const restorationReadinessSchema = createRuntimeSchema(
  parseRestorationReadiness,
);
export const navigationRestorationCauseSchema = createRuntimeSchema(
  parseNavigationRestorationCause,
);
export const scrollMemorySchema = createRuntimeSchema(parseScrollMemory);
