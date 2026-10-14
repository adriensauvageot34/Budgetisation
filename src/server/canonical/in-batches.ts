import "server-only";

export const CANONICAL_IN_BATCH_SIZE = 100;
export const CANONICAL_ECONOMIC_IN_BATCH_SIZE = 120;
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
  return mergeCanonicalBatchRows(rowsByBatch.flat(), rowIdentity, compareRows);
}

export function mergeCanonicalBatchRows<Row>(rows: readonly Row[],
  rowIdentity: (row: Row) => string, compareRows: (left: Row, right: Row) => number): readonly Row[] {
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

/** One authorized repository/request only. Each namespace denotes an identical
 * projection, filter and grouping column. A key becomes reusable only after ALL
 * physical batches of its first logical read succeed, including an empty result.
 * Rejections are retained just like the repository's existing Promise cache. */
export class CanonicalRequestKeyReads<Row> {
  private readonly scopes = new Map<string, Map<string, Promise<readonly Row[] | undefined>>>();

  async read(namespace: string, options: CanonicalInBatchReadOptions<Row>,
    keyOf: (row: Row) => string, resultLimit: number,
    onComplete?: (rows: readonly Row[]) => void): Promise<readonly Row[]> {
    if (!Number.isInteger(resultLimit) || resultLimit <= 0) throw new RangeError("Canonical result limit must be positive.");
    const keys = normalizeCanonicalInValues(options.values);
    let scope = this.scopes.get(namespace);
    if (!scope) { scope = new Map(); this.scopes.set(namespace, scope); }
    const missing = keys.filter(key => !scope!.has(key));
    let ownRead: Promise<readonly Row[]> | undefined;
    if (missing.length) {
      // Register promises before starting I/O, so overlapping concurrent calls
      // cannot dispatch a second physical read for an already pending key.
      let possiblyCapped = false;
      const loaded = ownRead = Promise.resolve().then(() => readCanonicalInBatches({ ...options, values: missing,
        executeBatch: async (batch, index) => {
          const rows = await options.executeBatch(batch, index);
          if (rows.length >= resultLimit) possiblyCapped = true;
          return rows;
        } }));
      const grouped = loaded.then(rows => {
        // The legacy reader's response ceiling is a completeness boundary.
        // Preserve its first result, but never infer reusable per-key groups
        // from a response that may have been truncated by PostgREST.
        if (possiblyCapped) return undefined;
        const groups = new Map(missing.map(key => [key, [] as Row[]]));
        for (const row of rows) {
          const group = groups.get(keyOf(row));
          if (!group) throw new Error("Canonical keyed read returned a row outside its requested keys.");
          group.push(row);
        }
        return groups;
      });
      for (const key of missing) scope.set(key, grouped.then(groups => groups?.get(key)));
    }
    const rows = await Promise.all(keys.map(key => scope!.get(key)!));
    if (rows.some(group => group === undefined)) {
      // A first read need not be duplicated. An overlapping/subset read falls
      // back once to the original full-key query, preserving its result/order.
      return missing.length === keys.length && ownRead ? ownRead : readCanonicalInBatches(options);
    }
    const merged = mergeCanonicalBatchRows((rows as readonly (readonly Row[])[]).flat(), options.rowIdentity, options.compareRows);
    onComplete?.(merged);
    return merged;
  }
}
