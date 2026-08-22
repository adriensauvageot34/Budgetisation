import { validationFailure } from "../../core/validation";
import { serializeRootNavigation } from "../codecs/history-root-navigation";
import {
  getRootNavigationDay,
  navigationHistoryStateSchema,
  parseNavigationHistoryEntryId,
  type NavigationHistoryEntryId,
  type NavigationHistoryState,
} from "../contracts/history";
import type { NavigationCheckpoint } from "../contracts/checkpoint";
import type { ExplorationNode } from "../contracts/exploration";
import {
  canPopExploration,
  openExploration,
  pushExplorationNode,
} from "../exploration/stack";
import type { BrowserHistoryAdapter } from "./browser-history-adapter";
import {
  closeGeneration,
  isGenerationClosed,
  type ClosedExplorationGenerations,
  type ExplorationGeneration,
} from "./generation";
import type { RootNavigationContext } from "../contracts/routes";

export type OpenExplorationHistoryInput = {
  readonly current: NavigationHistoryState;
  readonly entryId: NavigationHistoryEntryId;
  readonly generation: ExplorationGeneration;
  readonly rootCheckpoint: NavigationCheckpoint;
  readonly node: ExplorationNode;
};

export function createOpenExplorationHistoryState(
  input: OpenExplorationHistoryInput,
): NavigationHistoryState {
  if (input.current.exploration !== null) {
    validationFailure({
      path: ["current", "exploration"],
      code: "exploration_already_active",
      message: "Une nouvelle Exploration exige un état racine sans Exploration.",
    });
  }

  return navigationHistoryStateSchema.parse({
    version: input.current.version,
    entryId: parseNavigationHistoryEntryId(input.entryId),
    root: input.current.root,
    exploration: openExploration(input.rootCheckpoint, input.node),
    day: input.current.day,
    ...(input.current.checkpoint === undefined
      ? {}
      : { checkpoint: input.current.checkpoint }),
    generation: input.generation,
  });
}

export function createPushedExplorationHistoryState(
  current: NavigationHistoryState,
  entryId: NavigationHistoryEntryId,
  node: ExplorationNode,
): NavigationHistoryState {
  if (current.exploration === null || current.generation === undefined) {
    validationFailure({
      path: ["exploration"],
      code: "exploration_not_active",
      message: "Un push exige une Exploration active.",
    });
  }

  return {
    version: current.version,
    entryId: parseNavigationHistoryEntryId(entryId),
    root: current.root,
    exploration: pushExplorationNode(current.exploration, node),
    day: current.day,
    ...(current.checkpoint === undefined
      ? {}
      : { checkpoint: current.checkpoint }),
    generation: current.generation,
  };
}

export type ExplorationClosePlan = {
  readonly state: NavigationHistoryState;
  readonly checkpoint: NavigationCheckpoint;
  readonly url: string;
  readonly closedGenerations: ClosedExplorationGenerations;
};

export function prepareExplorationClose(
  current: NavigationHistoryState,
  closedGenerations: ClosedExplorationGenerations,
): ExplorationClosePlan {
  if (current.exploration === null || current.generation === undefined) {
    validationFailure({
      path: ["exploration"],
      code: "exploration_not_active",
      message: "La fermeture exige une Exploration active.",
    });
  }

  const checkpoint = current.exploration.rootCheckpoint;
  const root = checkpoint.route;
  const state = navigationHistoryStateSchema.parse({
    version: current.version,
    entryId: current.entryId,
    root,
    exploration: null,
    day: getRootNavigationDay(root),
  });

  return {
    state,
    checkpoint,
    url: serializeRootNavigation(root),
    closedGenerations: closeGeneration(
      closedGenerations,
      current.generation,
    ),
  };
}

export function applyExplorationClose(
  adapter: BrowserHistoryAdapter,
  plan: ExplorationClosePlan,
): void {
  adapter.replace(plan.state, plan.url);
}

export function pushNavigationHistoryEntry(
  adapter: BrowserHistoryAdapter,
  state: NavigationHistoryState,
  url?: string,
): void {
  adapter.push(navigationHistoryStateSchema.parse(state), url);
}

export function replaceNavigationHistoryEntry(
  adapter: BrowserHistoryAdapter,
  state: NavigationHistoryState,
  url?: string,
): void {
  adapter.replace(navigationHistoryStateSchema.parse(state), url);
}

export function requestExplorationParentBack(
  adapter: BrowserHistoryAdapter,
  state: NavigationHistoryState,
): boolean {
  if (
    state.exploration === null ||
    !canPopExploration(state.exploration)
  ) {
    return false;
  }
  adapter.back();
  return true;
}

export type NavigationHistoryResolution =
  | {
      readonly kind: "restore";
      readonly state: NavigationHistoryState;
    }
  | {
      readonly kind: "fallback";
      readonly reason: "invalid-state";
    }
  | {
      readonly kind: "fallback";
      readonly reason: "closed-generation";
      readonly root: RootNavigationContext;
      readonly checkpoint: NavigationCheckpoint;
    };

export function isNavigationHistoryStateCompatibleWithRoot(
  state: NavigationHistoryState,
  expectedRoot: RootNavigationContext,
): boolean {
  return (
    serializeRootNavigation(state.root) ===
    serializeRootNavigation(expectedRoot)
  );
}

export function resolveNavigationHistoryState(
  rawState: unknown,
  closedGenerations: ClosedExplorationGenerations,
  expectedRoot?: RootNavigationContext,
): NavigationHistoryResolution {
  const parsed = navigationHistoryStateSchema.safeParse(rawState);
  if (!parsed.success) return { kind: "fallback", reason: "invalid-state" };

  const state = parsed.data;
  if (
    expectedRoot !== undefined &&
    !isNavigationHistoryStateCompatibleWithRoot(state, expectedRoot)
  ) {
    return { kind: "fallback", reason: "invalid-state" };
  }
  if (
    state.exploration !== null &&
    state.generation !== undefined &&
    isGenerationClosed(closedGenerations, state.generation)
  ) {
    return {
      kind: "fallback",
      reason: "closed-generation",
      root: state.exploration.rootCheckpoint.route,
      checkpoint: state.exploration.rootCheckpoint,
    };
  }

  return { kind: "restore", state };
}
