import { validationFailure } from "./errors";

export type UnknownRecord = Readonly<Record<string, unknown>>;

export function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function parseStrictRecord(
  value: unknown,
  allowedKeys: readonly string[],
  typeName: string,
): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    validationFailure({
      path: [],
      code: "invalid_type",
      message: `${typeName} doit être un objet.`,
    });
  }

  const allowed = new Set(allowedKeys);
  const unexpectedKey = Reflect.ownKeys(value).find(
    (key) => typeof key !== "string" || !allowed.has(key),
  );
  if (unexpectedKey !== undefined) {
    validationFailure({
      path: typeof unexpectedKey === "string" ? [unexpectedKey] : [],
      code: "unrecognized_key",
      message: `${typeName} contient une clé non autorisée.`,
    });
  }

  return value as UnknownRecord;
}

export function requireProperty(
  record: UnknownRecord,
  key: string,
  typeName: string,
): unknown {
  if (!hasOwn(record, key)) {
    validationFailure({
      path: [key],
      code: "required",
      message: `${typeName}.${key} est requis.`,
    });
  }
  return record[key];
}

export function parseStringLiteral<const T extends string>(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  typeName: string,
): T {
  if (typeof value !== "string" || !allowedValues.has(value)) {
    validationFailure({
      path: [],
      code: "invalid_literal",
      message: `${typeName} contient une valeur non autorisée.`,
    });
  }
  return value as T;
}
