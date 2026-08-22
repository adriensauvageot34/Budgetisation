import {
  navigationCheckpointSchema,
  type NavigationCheckpoint,
} from "./checkpoint";
import {
  explorationNodeSchema,
  type ExplorationNode,
} from "./exploration";
import {
  createRuntimeSchema,
  parseStrictRecord,
  requireProperty,
  validationFailure,
  withValidationPath,
} from "../../core/validation";

export type ExplorationState = {
  readonly rootCheckpoint: NavigationCheckpoint;
  readonly stack: readonly ExplorationNode[];
};

export type ExplorationStack = readonly [
  ExplorationNode,
  ...ExplorationNode[],
];

export type ActiveExplorationState = {
  readonly rootCheckpoint: NavigationCheckpoint;
  readonly stack: ExplorationStack;
};

export function parseActiveExplorationState(
  value: unknown,
): ActiveExplorationState {
  const record = parseStrictRecord(
    value,
    ["rootCheckpoint", "stack"],
    "ActiveExplorationState",
  );
  const rootCheckpoint = withValidationPath("rootCheckpoint", () =>
    navigationCheckpointSchema.parse(
      requireProperty(record, "rootCheckpoint", "ActiveExplorationState"),
    ),
  );
  const rawStack = requireProperty(record, "stack", "ActiveExplorationState");
  if (!Array.isArray(rawStack) || rawStack.length === 0) {
    validationFailure({
      path: ["stack"],
      code: "empty_exploration_stack",
      message: "Une Exploration active exige une pile non vide.",
    });
  }

  const nodes = rawStack.map((node, index) =>
    withValidationPath("stack", () =>
      withValidationPath(index, () => explorationNodeSchema.parse(node)),
    ),
  );
  const [rootNode, ...descendants] = nodes;
  if (rootNode === undefined) {
    validationFailure({
      path: ["stack"],
      code: "empty_exploration_stack",
      message: "Une Exploration active exige une pile non vide.",
    });
  }

  return {
    rootCheckpoint,
    stack: [rootNode, ...descendants],
  };
}

export const activeExplorationStateSchema = createRuntimeSchema(
  parseActiveExplorationState,
);
