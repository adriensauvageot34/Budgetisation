import type { Temporal } from "@js-temporal/polyfill";
import type { PlaceVisitFact } from "../facts";

type PresenceInterval = { readonly startAt: string; readonly endAt: string };
type Entry = { readonly visit: PlaceVisitFact; readonly ordinal: number; readonly start: bigint; readonly end: bigint };

// Candidate search only. The caller still applies the existing overlaps oracle.
// No duration validation: its two inequalities also define zero/inverted cases.
export function createPresenceIntervalIndex(
  visits: readonly PlaceVisitFact[],
  intervalForVisit: (visit: PlaceVisitFact) => PresenceInterval | null,
  parseInstant: (value: string) => Temporal.Instant,
): (interval: PresenceInterval) => readonly PlaceVisitFact[] {
  const entries: Entry[] = [];
  const fallback: { readonly visit: PlaceVisitFact; readonly ordinal: number }[] = [];
  visits.forEach((visit, ordinal) => {
    const interval = intervalForVisit(visit);
    if (interval === null) return;
    try {
      entries.push({ visit, ordinal, start: parseInstant(interval.startAt).epochNanoseconds, end: parseInstant(interval.endAt).epochNanoseconds });
    } catch {
      // Parsing here must not throw earlier than the original short-circuit.
      // Keep every such visit for the original oracle, in original source order.
      fallback.push({ visit, ordinal });
    }
  });
  entries.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1
    : a.end < b.end ? -1 : a.end > b.end ? 1 : a.ordinal - b.ordinal);
  const maxEnds: bigint[] = new Array(entries.length);
  function prepare(low: number, high: number): bigint | undefined {
    if (low >= high) return undefined;
    const mid = low + Math.floor((high - low) / 2);
    const left = prepare(low, mid), right = prepare(mid + 1, high);
    let end = entries[mid].end;
    if (left !== undefined && left > end) end = left;
    if (right !== undefined && right > end) end = right;
    maxEnds[mid] = end;
    return end;
  }
  prepare(0, entries.length);
  return interval => {
    let start: bigint, end: bigint;
    try { start = parseInstant(interval.startAt).epochNanoseconds; end = parseInstant(interval.endAt).epochNanoseconds; }
    catch { return visits; } // The original oracle keeps its parsing order/errors.
    const candidates: { readonly visit: PlaceVisitFact; readonly ordinal: number }[] = [...fallback];
    function search(low: number, high: number): void {
      if (low >= high) return;
      const mid = low + Math.floor((high - low) / 2), entry = entries[mid];
      // Every end in this subtree is <= query start: no strict overlap possible.
      if (maxEnds[mid] <= start) return;
      search(low, mid);
      // Every start on the right is >= this start: equality is not an overlap.
      if (entry.start >= end) return;
      if (entry.end > start) candidates.push(entry);
      search(mid + 1, high);
    }
    search(0, entries.length);
    return candidates.sort((a, b) => a.ordinal - b.ordinal).map(entry => entry.visit);
  };
}
