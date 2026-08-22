import type { Brand } from "../../core/identity";
import {
  createRuntimeSchema,
  validationFailure,
  withValidationPath,
} from "../../core/validation";

export type ExplorationGeneration = Brand<number, "ExplorationGeneration">;
export type ClosedExplorationGenerations = readonly ExplorationGeneration[];

export function parseExplorationGeneration(
  value: unknown,
): ExplorationGeneration {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 0) {
    validationFailure({
      path: [],
      code: "invalid_generation",
      message: "ExplorationGeneration doit être un entier sûr positif ou nul.",
    });
  }
  return value as ExplorationGeneration;
}

export function parseClosedExplorationGenerations(
  value: unknown,
): ClosedExplorationGenerations {
  if (!Array.isArray(value)) {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: "ClosedExplorationGenerations doit être un tableau.",
    });
  }
  const generations = value.map((generation, index) =>
    withValidationPath(index, () => parseExplorationGeneration(generation)),
  );
  return [...new Set(generations)].sort((left, right) => left - right);
}

export function isGenerationClosed(
  closedGenerations: ClosedExplorationGenerations,
  generation: ExplorationGeneration,
): boolean {
  return closedGenerations.includes(generation);
}

export function closeGeneration(
  closedGenerations: ClosedExplorationGenerations,
  generation: ExplorationGeneration,
): ClosedExplorationGenerations {
  return parseClosedExplorationGenerations([
    ...closedGenerations,
    parseExplorationGeneration(generation),
  ]);
}

export function createNextGeneration(
  currentGeneration: ExplorationGeneration | null = null,
): ExplorationGeneration {
  const current =
    currentGeneration === null
      ? -1
      : parseExplorationGeneration(currentGeneration);
  if (current === Number.MAX_SAFE_INTEGER) {
    validationFailure({
      path: [],
      code: "generation_overflow",
      message: "ExplorationGeneration ne peut plus être incrémentée.",
    });
  }
  return parseExplorationGeneration(current + 1);
}

export const explorationGenerationSchema = createRuntimeSchema(
  parseExplorationGeneration,
);
export const closedExplorationGenerationsSchema = createRuntimeSchema(
  parseClosedExplorationGenerations,
);
