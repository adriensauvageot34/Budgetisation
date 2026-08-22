import type { ScopeHash } from "../../core/scope";
import type { QueryResourceKey } from "./resource-key";

export type QueryCacheKey = readonly [
  "budgetisation-query",
  "v1",
  QueryResourceKey,
  ScopeHash,
  string,
];

function serializeCanonicalValue(
  value: unknown,
  ancestors: WeakSet<object>,
): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Les nombres canoniques doivent être finis.");
    }
    return JSON.stringify(value);
  }

  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new TypeError("Valeur non canonique dans les paramètres Query API.");
  }

  if (value instanceof Date) {
    throw new TypeError("Date JS interdite dans les paramètres Query API.");
  }

  if (ancestors.has(value)) {
    throw new TypeError("Référence cyclique interdite dans les paramètres.");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item) => serializeCanonicalValue(item, ancestors))
        .join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        "Seuls les objets simples sont canoniques dans les paramètres.",
      );
    }

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      throw new TypeError("Les clés symboliques ne sont pas canoniques.");
    }

    const record = value as Readonly<Record<string, unknown>>;
    return `{${(ownKeys as string[])
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeCanonicalValue(
            record[key],
            ancestors,
          )}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalSerializeQueryParams(params: unknown): string {
  if (
    typeof params !== "object" ||
    params === null ||
    Array.isArray(params)
  ) {
    throw new TypeError("Les paramètres Query API normalisés sont un objet.");
  }
  return serializeCanonicalValue(params, new WeakSet<object>());
}

export function createQueryCacheKey(identity: {
  readonly resource: QueryResourceKey;
  readonly scopeHash: ScopeHash;
  readonly normalizedParams: unknown;
}): QueryCacheKey {
  return [
    "budgetisation-query",
    "v1",
    identity.resource,
    identity.scopeHash,
    canonicalSerializeQueryParams(identity.normalizedParams),
  ];
}
