import "server-only";

export const CANONICAL_IN_BATCH_SIZE = 100;
export const CANONICAL_IN_MAX_CONCURRENCY = 3;

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
 * Executes one logical canonical `.in(...)` read with bounded physical
 * concurrency. Results are only returned after every batch succeeds and are
 * merged in canonical batch order, independently from completion order.
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
  const batches: (readonly string[])[] = [];
  for (let offset = 0; offset < normalizedValues.length; offset += batchSize) {
    batches.push(normalizedValues.slice(offset, offset + batchSize));
  }

  const rowsByBatch: (readonly Row[])[] = new Array(batches.length);
  let nextBatchIndex = 0;
  async function worker(): Promise<void> {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      rowsByBatch[batchIndex] = await executeBatch(batches[batchIndex], batchIndex);
    }
  }
  const workerCount = Math.min(CANONICAL_IN_MAX_CONCURRENCY, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  const rows = rowsByBatch.flat();

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
