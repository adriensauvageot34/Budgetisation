import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
  type GlobalWindow,
  type LocalDate,
  type YearMonth,
} from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import {
  navigationCheckpointSchema,
  type NavigationCheckpoint,
} from "./checkpoint";
import {
  explorationNodeSchema,
  type ExplorationNode,
} from "./exploration";
import {
  operationsNavigationFiltersSchema,
  type OperationsNavigationFilters,
} from "./operations";
import {
  historyRootContextSchema,
  rootNavigationContextSchema,
  type CalendarRouteContext,
} from "./routes";
import type { CalendarMonthRootContext } from "./day-drawer";

export type NavigationContextMemory = {
  readonly lastAnalysedMonth?: YearMonth;
  readonly lastGlobalWindow?: GlobalWindow;
  readonly lastCalendarContext?: CalendarRouteContext;
};

export type AnalysisTransferCompatibility = {
  readonly categoryIds: boolean;
  readonly activityIds: boolean;
};

export type TransferDecision = "preserve" | "remember" | "transform" | "drop";

export type ReturnDestination =
  | {
      readonly kind: "root";
      readonly checkpoint: NavigationCheckpoint;
    }
  | {
      readonly kind: "exploration";
      readonly checkpoint: NavigationCheckpoint;
      readonly node: ExplorationNode;
    };

export type ExplorationReturnDestination = Extract<
  ReturnDestination,
  { readonly kind: "exploration" }
>;

export type PlaceReturnDestination = {
  readonly kind: "exploration";
  readonly checkpoint: NavigationCheckpoint;
  readonly node: Extract<ExplorationNode, { readonly kind: "place" }>;
};

export type OperationsNavigationIntent = {
  readonly filters: OperationsNavigationFilters;
  readonly returnDestination: ReturnDestination;
};

export type ResolvedOperationsPeriod = {
  readonly startDate: LocalDate;
  readonly endExclusive: LocalDate;
};

export type ShowDayNavigationIntent = {
  readonly targetRoot: CalendarMonthRootContext;
  readonly returnDestination: PlaceReturnDestination;
};

export function parseNavigationContextMemory(
  value: unknown,
): NavigationContextMemory {
  const record = parseStrictRecord(
    value,
    ["lastAnalysedMonth", "lastGlobalWindow", "lastCalendarContext"],
    "NavigationContextMemory",
  );
  const lastAnalysedMonth = hasOwn(record, "lastAnalysedMonth")
    ? withValidationPath("lastAnalysedMonth", () =>
        parseYearMonth(record.lastAnalysedMonth),
      )
    : undefined;
  const lastGlobalWindow = hasOwn(record, "lastGlobalWindow")
    ? withValidationPath("lastGlobalWindow", () =>
        parseGlobalWindow(record.lastGlobalWindow),
      )
    : undefined;
  const lastCalendarContext = hasOwn(record, "lastCalendarContext")
    ? withValidationPath("lastCalendarContext", () => {
        const parsed = historyRootContextSchema.parse({
          area: "calendar",
          context: record.lastCalendarContext,
        });
        if (parsed.area !== "calendar") {
          validationFailure({
            path: [],
            code: "invalid_calendar_context",
            message: "lastCalendarContext doit être un contexte Calendrier.",
          });
        }
        return parsed.context;
      })
    : undefined;

  return {
    ...(lastAnalysedMonth === undefined ? {} : { lastAnalysedMonth }),
    ...(lastGlobalWindow === undefined ? {} : { lastGlobalWindow }),
    ...(lastCalendarContext === undefined ? {} : { lastCalendarContext }),
  };
}

export function parseAnalysisTransferCompatibility(
  value: unknown,
): AnalysisTransferCompatibility {
  const record = parseStrictRecord(
    value,
    ["categoryIds", "activityIds"],
    "AnalysisTransferCompatibility",
  );
  const categoryIds = requireProperty(
    record,
    "categoryIds",
    "AnalysisTransferCompatibility",
  );
  const activityIds = requireProperty(
    record,
    "activityIds",
    "AnalysisTransferCompatibility",
  );
  if (typeof categoryIds !== "boolean" || typeof activityIds !== "boolean") {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: "Les compatibilités categoryIds/activityIds doivent être booléennes.",
    });
  }
  return { categoryIds, activityIds };
}

export function parseReturnDestination(value: unknown): ReturnDestination {
  const candidate = parseStrictRecord(
    value,
    ["kind", "checkpoint", "node"],
    "ReturnDestination",
  );
  const kind = parseStringLiteral<ReturnDestination["kind"]>(
    requireProperty(candidate, "kind", "ReturnDestination"),
    new Set(["root", "exploration"]),
    "ReturnDestination.kind",
  );
  const checkpoint = withValidationPath("checkpoint", () =>
    navigationCheckpointSchema.parse(
      requireProperty(candidate, "checkpoint", "ReturnDestination"),
    ),
  );
  if (kind === "root") {
    parseStrictRecord(value, ["kind", "checkpoint"], "ReturnDestination");
    return { kind, checkpoint };
  }
  return {
    kind,
    checkpoint,
    node: withValidationPath("node", () =>
      explorationNodeSchema.parse(
        requireProperty(candidate, "node", "ReturnDestination"),
      ),
    ),
  };
}

export function parseOperationsNavigationIntent(
  value: unknown,
): OperationsNavigationIntent {
  const record = parseStrictRecord(
    value,
    ["filters", "returnDestination"],
    "OperationsNavigationIntent",
  );
  return {
    filters: withValidationPath("filters", () =>
      operationsNavigationFiltersSchema.parse(
        requireProperty(record, "filters", "OperationsNavigationIntent"),
      ),
    ),
    returnDestination: withValidationPath("returnDestination", () =>
      parseReturnDestination(
        requireProperty(
          record,
          "returnDestination",
          "OperationsNavigationIntent",
        ),
      ),
    ),
  };
}

export function parseResolvedOperationsPeriod(
  value: unknown,
): ResolvedOperationsPeriod {
  const record = parseStrictRecord(
    value,
    ["startDate", "endExclusive"],
    "ResolvedOperationsPeriod",
  );
  const filters = operationsNavigationFiltersSchema.parse({
    startDate: parseLocalDate(
      requireProperty(record, "startDate", "ResolvedOperationsPeriod"),
    ),
    endExclusive: parseLocalDate(
      requireProperty(record, "endExclusive", "ResolvedOperationsPeriod"),
    ),
  });
  if (filters.startDate === undefined || filters.endExclusive === undefined) {
    validationFailure({
      path: [],
      code: "invalid_date_range",
      message: "ResolvedOperationsPeriod doit contenir une période valide.",
    });
  }
  return { startDate: filters.startDate, endExclusive: filters.endExclusive };
}

export function parseShowDayNavigationIntent(
  value: unknown,
): ShowDayNavigationIntent {
  const record = parseStrictRecord(
    value,
    ["targetRoot", "returnDestination"],
    "ShowDayNavigationIntent",
  );
  const targetRoot = rootNavigationContextSchema.parse(
    requireProperty(record, "targetRoot", "ShowDayNavigationIntent"),
  );
  if (
    !("area" in targetRoot) ||
    targetRoot.area !== "calendar" ||
    targetRoot.context.kind !== "calendar_month" ||
    targetRoot.context.day === undefined
  ) {
    validationFailure({
      path: ["targetRoot"],
      code: "invalid_day_target",
      message: "ShowDayNavigationIntent exige Calendar Month avec day.",
    });
  }
  const returnDestination = parseReturnDestination(
    requireProperty(record, "returnDestination", "ShowDayNavigationIntent"),
  );
  if (returnDestination.kind !== "exploration") {
    validationFailure({
      path: ["returnDestination"],
      code: "invalid_return_destination",
      message: "ShowDayNavigationIntent exige un retour Exploration.",
    });
  }
  if (returnDestination.node.kind !== "place") {
    validationFailure({
      path: ["returnDestination", "node"],
      code: "invalid_exploration_node",
      message: "ShowDayNavigationIntent exige un retour vers un Lieu.",
    });
  }
  return {
    targetRoot: {
      area: "calendar",
      context: {
        kind: "calendar_month",
        month: targetRoot.context.month,
        day: targetRoot.context.day,
      },
    },
    returnDestination: {
      kind: "exploration",
      checkpoint: returnDestination.checkpoint,
      node: returnDestination.node,
    },
  };
}

export const navigationContextMemorySchema = createRuntimeSchema(
  parseNavigationContextMemory,
);
export const analysisTransferCompatibilitySchema = createRuntimeSchema(
  parseAnalysisTransferCompatibility,
);
export const returnDestinationSchema = createRuntimeSchema(
  parseReturnDestination,
);
export const operationsNavigationIntentSchema = createRuntimeSchema(
  parseOperationsNavigationIntent,
);
export const resolvedOperationsPeriodSchema = createRuntimeSchema(
  parseResolvedOperationsPeriod,
);
export const showDayNavigationIntentSchema = createRuntimeSchema(
  parseShowDayNavigationIntent,
);
