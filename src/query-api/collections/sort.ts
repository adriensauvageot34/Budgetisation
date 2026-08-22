import {
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type {
  KeysetAnchor,
  KeysetSortValue,
  KeysetStableId,
  SortDefinition,
  SortDirection,
  SortSpec,
} from "./types";

const sortDirections: ReadonlySet<string> = new Set<SortDirection>([
  "asc",
  "desc",
]);

export function getSortDefinition<Key extends string>(
  definitions: readonly SortDefinition<Key>[],
  key: unknown,
): SortDefinition<Key> {
  if (typeof key !== "string") {
    throw new TypeError("SortSpec.key doit être une clé sémantique.");
  }
  const definition = definitions.find((candidate) => candidate.key === key);
  if (definition === undefined) {
    throw new TypeError("SortSpec.key n'est pas autorisée pour la ressource.");
  }
  return definition;
}

export function parseSortSpec<Key extends string>(
  value: unknown,
  definitions: readonly SortDefinition<Key>[],
): SortSpec<Key> {
  const record = parseStrictRecord(value, ["key", "direction"], "SortSpec");
  const definition = getSortDefinition(
    definitions,
    requireProperty(record, "key", "SortSpec"),
  );
  const direction = Object.prototype.hasOwnProperty.call(record, "direction")
    ? parseStringLiteral<SortDirection>(
        record.direction,
        sortDirections,
        "SortSpec.direction",
      )
    : definition.defaultDirection;
  return { key: definition.key, direction };
}

function assertSortValue(value: KeysetSortValue): void {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("La valeur de tri keyset doit être finie.");
  }
}

function comparePrimitive(
  left: Exclude<KeysetSortValue, null>,
  right: Exclude<KeysetSortValue, null>,
): number {
  if (typeof left !== typeof right) {
    throw new TypeError("Les valeurs d'un tri keyset doivent être homogènes.");
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareSortValues(
  left: KeysetSortValue,
  right: KeysetSortValue,
  definition: SortDefinition<string>,
  direction: SortDirection,
): number {
  assertSortValue(left);
  assertSortValue(right);
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null
      ? definition.nulls === "first"
        ? -1
        : 1
      : definition.nulls === "first"
        ? 1
        : -1;
  }
  const comparison = comparePrimitive(left, right);
  return direction === "asc" ? comparison : -comparison;
}

function compareStableIds(
  left: KeysetStableId,
  right: KeysetStableId,
  definition: SortDefinition<string>,
  direction: SortDirection,
): number {
  if (typeof left !== definition.stableIdKind || typeof right !== definition.stableIdKind) {
    throw new TypeError("Le stable id ne respecte pas le type déclaré par le tri.");
  }
  if (
    (typeof left === "number" && !Number.isFinite(left)) ||
    (typeof right === "number" && !Number.isFinite(right))
  ) {
    throw new TypeError("Le stable id numérique doit être fini.");
  }
  if (left === right) return 0;
  const comparison = left < right ? -1 : 1;
  return direction === "asc" ? comparison : -comparison;
}

export function compareKeysetTuples(
  left: KeysetAnchor,
  right: KeysetAnchor,
  definition: SortDefinition<string>,
  direction: SortDirection,
): number {
  const sortComparison = compareSortValues(
    left.sortValue,
    right.sortValue,
    definition,
    direction,
  );
  return sortComparison !== 0
    ? sortComparison
    : compareStableIds(left.stableId, right.stableId, definition, direction);
}

export function isKeysetTupleAfter(
  candidate: KeysetAnchor,
  anchor: KeysetAnchor,
  definition: SortDefinition<string>,
  direction: SortDirection,
): boolean {
  return compareKeysetTuples(candidate, anchor, definition, direction) > 0;
}
