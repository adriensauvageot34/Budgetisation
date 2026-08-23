import { validationFailure } from "../../core/validation";
import { buildOpenDayRoot } from "../day/day-navigation";
import {
  navigationCheckpointSchema,
  type NavigationCheckpoint,
} from "../contracts/checkpoint";
import {
  navigationContextMemorySchema,
  showDayNavigationIntentSchema,
  type NavigationContextMemory,
  type ShowDayNavigationIntent,
} from "../contracts/context-transfer";
import {
  explorationNodeSchema,
  type ExplorationNode,
} from "../contracts/exploration";
import {
  historyRootContextSchema,
  type AnalysisRouteContext,
  type CalendarRouteContext,
  type HistoryRootContext,
} from "../contracts/routes";

export type CalendarToAnalysisResult =
  | {
      readonly kind: "success";
      readonly targetRoot: HistoryRootContext;
      readonly memory: NavigationContextMemory;
    }
  | {
      readonly kind: "missing_calendar_month";
      readonly memory: NavigationContextMemory;
    };

export type AnalysisToCalendarResult =
  | {
      readonly kind: "success";
      readonly targetRoot: HistoryRootContext;
      readonly memory: NavigationContextMemory;
    }
  | {
      readonly kind: "missing_last_calendar_context";
      readonly memory: NavigationContextMemory;
    };

function parseCalendarContext(value: unknown): CalendarRouteContext {
  const root = historyRootContextSchema.parse({
    area: "calendar",
    context: value,
  });
  if (root.area !== "calendar") {
    validationFailure({
      path: [],
      code: "invalid_calendar_context",
      message: "Le contexte source doit être Calendrier.",
    });
  }
  return root.context;
}

function parseAnalysisContext(value: unknown): AnalysisRouteContext {
  const root = historyRootContextSchema.parse({
    area: "analysis",
    context: value,
  });
  if (root.area !== "analysis") {
    validationFailure({
      path: [],
      code: "invalid_analysis_context",
      message: "Le contexte source doit être Analyse.",
    });
  }
  return root.context;
}

export function transferCalendarToAnalysis(
  sourceInput: CalendarRouteContext,
  memoryInput: NavigationContextMemory,
): CalendarToAnalysisResult {
  const source = parseCalendarContext(sourceInput);
  const memory = navigationContextMemorySchema.parse({
    ...navigationContextMemorySchema.parse(memoryInput),
    lastCalendarContext: source,
  });
  if (source.kind === "calendar_overview") {
    return { kind: "missing_calendar_month", memory };
  }
  return {
    kind: "success",
    targetRoot: {
      area: "analysis",
      context: {
        kind: "analysis_month",
        month: source.month,
        ...(source.personId === undefined ? {} : { personId: source.personId }),
      },
    },
    memory,
  };
}

export function transferAnalysisToCalendar(
  sourceInput: AnalysisRouteContext,
  memoryInput: NavigationContextMemory,
): AnalysisToCalendarResult {
  const source = parseAnalysisContext(sourceInput);
  const memory = navigationContextMemorySchema.parse(memoryInput);
  if (source.kind === "analysis_global") {
    return memory.lastCalendarContext === undefined
      ? { kind: "missing_last_calendar_context", memory }
      : {
          kind: "success",
          targetRoot: {
            area: "calendar",
            context: memory.lastCalendarContext,
          },
          memory,
        };
  }

  const calendarContext: CalendarRouteContext = {
    kind: "calendar_month",
    month: source.month,
    ...(source.personId === undefined ? {} : { personId: source.personId }),
  };
  return {
    kind: "success",
    targetRoot: { area: "calendar", context: calendarContext },
    memory: navigationContextMemorySchema.parse({
      ...memory,
      lastCalendarContext: calendarContext,
    }),
  };
}

export function buildShowDayIntent(
  day: unknown,
  checkpointInput: NavigationCheckpoint,
  stackInput: readonly ExplorationNode[],
): ShowDayNavigationIntent {
  const checkpoint = navigationCheckpointSchema.parse(checkpointInput);
  const stack = stackInput.map((node) => explorationNodeSchema.parse(node));
  const node = stack.at(-1);
  if (node === undefined || node.kind !== "place") {
    validationFailure({
      path: ["placeNode"],
      code: "invalid_exploration_node",
      message: "Voir cette journée depuis un Lieu exige un nœud place.",
    });
  }
  const targetRoot = buildOpenDayRoot(day);
  const personId = checkpoint.scope?.subject.kind === "person"
    ? checkpoint.scope.subject.personId
    : undefined;
  return showDayNavigationIntentSchema.parse({
    targetRoot: {
      ...targetRoot,
      context: { ...targetRoot.context, ...(personId ? { personId } : {}) },
    },
    returnDestination: { kind: "exploration", checkpoint, stack },
  });
}
