import {
  navigationCheckpointSchema,
  type NavigationCheckpoint,
} from "../contracts/checkpoint";
import {
  explorationNodeSchema,
  type ExplorationNode,
} from "../contracts/exploration";
import type {
  ActiveExplorationState,
  ExplorationStack,
} from "../contracts/exploration-state";

export type ExplorationTransition =
  | {
      readonly kind: "active";
      readonly state: ActiveExplorationState;
    }
  | {
      readonly kind: "closed";
      readonly checkpoint: NavigationCheckpoint;
    };

export function openExploration(
  rootCheckpoint: NavigationCheckpoint,
  node: ExplorationNode,
): ActiveExplorationState {
  return {
    rootCheckpoint: navigationCheckpointSchema.parse(rootCheckpoint),
    stack: [explorationNodeSchema.parse(node)],
  };
}

export function getRootNode(state: ActiveExplorationState): ExplorationNode {
  return state.stack[0];
}

export function getCurrentNode(
  state: ActiveExplorationState,
): ExplorationNode {
  return state.stack[state.stack.length - 1];
}

export function getParentNode(
  state: ActiveExplorationState,
): ExplorationNode | null {
  return state.stack.length > 1 ? state.stack[state.stack.length - 2] : null;
}

export function getExplorationDepth(state: ActiveExplorationState): number {
  return state.stack.length;
}

export function canPopExploration(state: ActiveExplorationState): boolean {
  return state.stack.length > 1;
}

export function getExplorationOrigin(
  state: ActiveExplorationState,
): NavigationCheckpoint {
  return state.rootCheckpoint;
}

export function pushExplorationNode(
  state: ActiveExplorationState,
  node: ExplorationNode,
): ActiveExplorationState {
  const [rootNode, ...descendants] = state.stack;
  return {
    rootCheckpoint: state.rootCheckpoint,
    stack: [
      rootNode,
      ...descendants,
      explorationNodeSchema.parse(node),
    ],
  };
}

export function popExplorationNode(
  state: ActiveExplorationState,
): ExplorationTransition {
  if (!canPopExploration(state)) {
    return { kind: "closed", checkpoint: state.rootCheckpoint };
  }

  const [rootNode, ...descendants] = state.stack;
  const remainingDescendants = descendants.slice(0, -1);
  const stack: ExplorationStack = [rootNode, ...remainingDescendants];
  return {
    kind: "active",
    state: { rootCheckpoint: state.rootCheckpoint, stack },
  };
}

export function closeExploration(
  state: ActiveExplorationState,
): ExplorationTransition {
  return { kind: "closed", checkpoint: state.rootCheckpoint };
}
