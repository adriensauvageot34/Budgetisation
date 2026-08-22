import type { Brand } from "../../core/identity";
import { parseLocalDate, type LocalDate } from "../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import { serializeRootNavigation } from "../codecs/history-root-navigation";
import {
  activeExplorationStateSchema,
  type ActiveExplorationState,
} from "./exploration-state";
import {
  explorationGenerationSchema,
  type ExplorationGeneration,
} from "../history/generation";
import {
  navigationCheckpointSchema,
  type NavigationCheckpoint,
} from "./checkpoint";
import {
  rootNavigationContextSchema,
  type RootNavigationContext,
} from "./routes";

export const navigationHistoryVersion = "navigation-history:v1" as const;

export type NavigationHistoryEntryId = Brand<
  string,
  "NavigationHistoryEntryId"
>;

export type NavigationHistoryState = {
  readonly version: typeof navigationHistoryVersion;
  readonly entryId: NavigationHistoryEntryId;
  readonly root: RootNavigationContext;
  readonly exploration: ActiveExplorationState | null;
  readonly day: LocalDate | null;
  readonly checkpoint?: NavigationCheckpoint;
  readonly generation?: ExplorationGeneration;
};

export function parseNavigationHistoryEntryId(
  value: unknown,
): NavigationHistoryEntryId {
  if (typeof value !== "string" || value.trim().length === 0) {
    validationFailure({
      path: [],
      code: "invalid_entry_id",
      message: "NavigationHistoryEntryId doit être une chaîne non vide.",
    });
  }
  return value as NavigationHistoryEntryId;
}

export function getRootNavigationDay(
  root: RootNavigationContext,
): LocalDate | null {
  if (
    "area" in root &&
    root.area === "calendar" &&
    root.context.kind === "calendar_month"
  ) {
    return root.context.day ?? null;
  }
  return null;
}

export function parseNavigationHistoryState(
  value: unknown,
): NavigationHistoryState {
  const record = parseStrictRecord(
    value,
    [
      "version",
      "entryId",
      "root",
      "exploration",
      "day",
      "checkpoint",
      "generation",
    ],
    "NavigationHistoryState",
  );
  const version = withValidationPath("version", () =>
    parseStringLiteral<typeof navigationHistoryVersion>(
      requireProperty(record, "version", "NavigationHistoryState"),
      new Set([navigationHistoryVersion]),
      "NavigationHistoryState.version",
    ),
  );
  const entryId = withValidationPath("entryId", () =>
    parseNavigationHistoryEntryId(
      requireProperty(record, "entryId", "NavigationHistoryState"),
    ),
  );
  const root = withValidationPath("root", () =>
    rootNavigationContextSchema.parse(
      requireProperty(record, "root", "NavigationHistoryState"),
    ),
  );
  const rawExploration = requireProperty(
    record,
    "exploration",
    "NavigationHistoryState",
  );
  const exploration =
    rawExploration === null
      ? null
      : withValidationPath("exploration", () =>
          activeExplorationStateSchema.parse(rawExploration),
        );
  const rawDay = requireProperty(record, "day", "NavigationHistoryState");
  const day =
    rawDay === null
      ? null
      : withValidationPath("day", () => parseLocalDate(rawDay));
  const checkpoint = hasOwn(record, "checkpoint")
    ? withValidationPath("checkpoint", () =>
        navigationCheckpointSchema.parse(record.checkpoint),
      )
    : undefined;
  const generation = hasOwn(record, "generation")
    ? withValidationPath("generation", () =>
        explorationGenerationSchema.parse(record.generation),
      )
    : undefined;

  if ((exploration === null) !== (generation === undefined)) {
    validationFailure({
      path: ["generation"],
      code: "inconsistent_generation",
      message: "Une génération est requise uniquement pour une Exploration active.",
    });
  }
  if (day !== getRootNavigationDay(root)) {
    validationFailure({
      path: ["day"],
      code: "inconsistent_day",
      message: "NavigationHistoryState.day doit correspondre au contexte racine.",
    });
  }
  if (
    exploration !== null &&
    serializeRootNavigation(exploration.rootCheckpoint.route) !==
      serializeRootNavigation(root)
  ) {
    validationFailure({
      path: ["exploration", "rootCheckpoint", "route"],
      code: "inconsistent_root",
      message: "L'origine de l'Exploration doit correspondre au contexte racine.",
    });
  }

  return {
    version,
    entryId,
    root,
    exploration,
    day,
    ...(checkpoint === undefined ? {} : { checkpoint }),
    ...(generation === undefined ? {} : { generation }),
  };
}

export function serializeNavigationHistoryState(
  value: NavigationHistoryState,
): string {
  return JSON.stringify(parseNavigationHistoryState(value));
}

export function parseSerializedNavigationHistoryState(
  value: unknown,
): NavigationHistoryState {
  if (typeof value !== "string") {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: "NavigationHistoryState sérialisé doit être une chaîne JSON.",
    });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    validationFailure({
      path: [],
      code: "invalid_json",
      message: "NavigationHistoryState sérialisé doit être un JSON valide.",
    });
  }
  return parseNavigationHistoryState(decoded);
}

export const navigationHistoryEntryIdSchema = createRuntimeSchema(
  parseNavigationHistoryEntryId,
);
export const navigationHistoryStateSchema = createRuntimeSchema(
  parseNavigationHistoryState,
);
