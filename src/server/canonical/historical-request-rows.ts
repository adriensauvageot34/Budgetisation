import "server-only";
import type { CanonicalRecord } from "./record";
import { parseLocalDate } from "@/core/time";

export type HistoricalReadReuse = "keys" | "projected";
export const ACTIVITY_EVENT_COLUMNS = "life_event_id,life_event_type_id,life_event_series_id,parent_life_event_id,start_date,end_date,validation_status";
export const PARTICIPATION_FACT_COLUMNS = "life_event_id,person_day_id,person_id,participation_status";
export const PARTICIPATION_ENTITY_COLUMNS = "life_event_id,person_day_id,person_id,start_at,end_at,time_precision,participation_role,participation_status";

export function projectHistoricalColumns(row: CanonicalRecord, selection: string): CanonicalRecord {
  return Object.fromEntries(selection.split(",").filter(column => Object.hasOwn(row, column)).map(column => [column, row[column]]));
}

/** Positive identities only, in one authorized repository. A filtered presence
 * cannot prove absence for an unfiltered localization lookup. Never retain
 * rows from a failed or possibly capped logical read. No cross-request state. */
export class HistoricalRequestRows {
  private readonly identities = new Map<string, Map<string, CanonicalRecord>>();
  private readonly eventRanges = new Map<string, {
    start: string; endExclusive: string; rows: Promise<readonly CanonicalRecord[] | undefined>;
  }>();
  private identityHits = 0;
  private rangeHits = 0;

  observe(namespace: string, identityColumn: string, selection: string, rows: readonly CanonicalRecord[]): void {
    const previous = this.identities.get(namespace) ?? new Map<string, CanonicalRecord>();
    const next = new Map(previous);
    for (const row of rows) {
      const id = row[identityColumn];
      if (typeof id !== "string") throw new TypeError("HISTORICAL_ROW_IDENTITY_INVALID");
      const projected = projectHistoricalColumns(row, selection);
      if (selection.split(",").some(column => !Object.hasOwn(projected, column))) continue;
      const existing = next.get(id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(projected)) {
        throw new TypeError("HISTORICAL_ROW_CHANGED_WITHIN_REQUEST");
      }
      next.set(id, projected);
    }
    // Publish atomically, including duplicate/conflict validation.
    this.identities.set(namespace, next);
  }

  known(namespace: string, ids: readonly string[]): readonly CanonicalRecord[] | undefined {
    const scope = this.identities.get(namespace);
    if (!scope || ids.some(id => !scope.has(id))) return undefined;
    this.identityHits += ids.length;
    return ids.map(id => scope.get(id)!);
  }

  async events(start: string, endExclusive: string, load: () => Promise<readonly CanonicalRecord[]>, limit: number): Promise<readonly CanonicalRecord[]> {
    const covering = [...this.eventRanges.values()].find(range => range.start <= start && range.endExclusive >= endExclusive);
    if (covering) {
      const rows = await covering.rows;
      if (rows !== undefined) {
        this.rangeHits++;
        return rows.filter(row => typeof row.start_date === "string" && typeof row.end_date === "string"
          && row.start_date < endExclusive && row.end_date >= start);
      }
    }
    const original = Promise.resolve().then(load);
    const complete = original.then(rows => {
      if (rows.length >= limit) return undefined;
      try {
        for (const row of rows) {
          if (typeof row.start_date !== "string" || typeof row.end_date !== "string") return undefined;
          parseLocalDate(row.start_date); parseLocalDate(row.end_date);
        }
      } catch { return undefined; }
      return rows;
    });
    // A rejection stays a rejection for the same admitted scope. Observe it
    // while leaving callers to receive the original error, never partial rows.
    complete.catch(() => undefined);
    this.eventRanges.set(`${start}:${endExclusive}`, { start, endExclusive, rows: complete });
    return original;
  }

  metrics() {
    return { identityEntries: [...this.identities.values()].reduce((n, rows) => n + rows.size, 0),
      ranges: this.eventRanges.size, identityHits: this.identityHits, rangeHits: this.rangeHits };
  }
}
