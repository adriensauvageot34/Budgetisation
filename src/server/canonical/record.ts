import "server-only";

import { parseMoney, type Money } from "@/core/money";
import { CanonicalReadError, type CanonicalSourceName } from "./errors";

export type CanonicalRecord = Readonly<Record<string, unknown>>;

export function canonicalRecords(
  value: unknown,
  source: CanonicalSourceName,
): readonly CanonicalRecord[] {
  if (!Array.isArray(value)) {
    throw new CanonicalReadError(source, `${source} n'a pas retourné une collection.`);
  }
  return value.map((row) => canonicalRecord(row, source));
}

export function canonicalRecord(
  value: unknown,
  source: CanonicalSourceName,
): CanonicalRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CanonicalReadError(source, `${source} contient une ligne invalide.`);
  }
  return value as CanonicalRecord;
}

export function canonicalString(
  record: CanonicalRecord,
  keys: readonly string[],
  source: CanonicalSourceName,
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  throw new CanonicalReadError(
    source,
    `${source} ne fournit aucune des colonnes textuelles attendues (${keys.join(", ")}).`,
  );
}

export function optionalCanonicalString(
  record: CanonicalRecord,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

export function canonicalMoney(
  record: CanonicalRecord,
  keys: readonly string[],
  source: CanonicalSourceName,
): Money {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return parseMoney(value);
  }
  throw new CanonicalReadError(
    source,
    `${source} ne fournit aucun montant canonique attendu (${keys.join(", ")}).`,
  );
}
