import "server-only";

export const CANONICAL_IN_BATCH_SIZE = 100;

export function normalizeCanonicalInValues(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

export type CanonicalInBatchReadOptions<Row> = {
  readonly values: readonly string[];
  readonly executeBatch: (
    values: readonly string[],
    batchIndex: number,
  ) => Promise<readonly Row[]>;
  readonly rowIdentity: (row: Row) => string;
  readonly compareRows: (left: Row, right: Row) => number;
  readonly batchSize?: number;
};

/**
 * Executes one logical canonical `.in(...)` read as deterministic sequential
 * physical requests. Results are only returned after every batch succeeds.
 */
export async function readCanonicalInBatches<Row>({
  values,
  executeBatch,
  rowIdentity,
  compareRows,
  batchSize = CANONICAL_IN_BATCH_SIZE,
}: CanonicalInBatchReadOptions<Row>): Promise<readonly Row[]> {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError("Canonical .in batch size must be a positive integer.");
  }

  const normalizedValues = normalizeCanonicalInValues(values);
  const rows: Row[] = [];
  for (let offset = 0; offset < normalizedValues.length; offset += batchSize) {
    const batch = normalizedValues.slice(offset, offset + batchSize);
    rows.push(...await executeBatch(batch, offset / batchSize));
  }

  const rowsByIdentity = new Map<string, Row>();
  for (const row of rows) {
    const identity = rowIdentity(row);
    const existing = rowsByIdentity.get(identity);
    if (
      existing !== undefined
      && JSON.stringify(existing) !== JSON.stringify(row)
    ) {
      throw new Error("Canonical batched read returned conflicting duplicate rows.");
    }
    rowsByIdentity.set(identity, row);
  }

  return [...rowsByIdentity.values()].sort(compareRows);
}
