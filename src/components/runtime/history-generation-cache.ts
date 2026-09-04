import type { ApiResponse } from "@/core/api";
import type { YearMonth } from "@/core/time";
import { historyGenerationSignalSchema, type HistoryGenerationSignal } from "@/query-api";

type Entry = { month: YearMonth; householdId: string; response: ApiResponse<unknown> };
export function responsePublicationId(response: ApiResponse<unknown>): string | undefined {
  return response.meta.publication?.publicationId;
}

/** One session, scoped evictions, immutable payload cache. The metadata probe is
 * event-driven; no timer and no payload fetch when the generation is unchanged.
 */
export class HistoryGenerationCache {
  private readonly signals = new Map<YearMonth, HistoryGenerationSignal>();
  private readonly probes = new Map<YearMonth, Promise<HistoryGenerationSignal>>();
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Map<YearMonth, Set<() => void>>();
  private readonly reads = new Map<string, Promise<ApiResponse<unknown>>>();
  private householdId: string | undefined;

  constructor(private readonly probe: (month: YearMonth) => Promise<unknown>) {}

  subscribe(month: YearMonth, listener: () => void): () => void {
    const listeners = this.listeners.get(month) ?? new Set();
    listeners.add(listener); this.listeners.set(month, listeners);
    return () => { listeners.delete(listener); if (listeners.size === 0) this.listeners.delete(month); };
  }

  private accept(signal: HistoryGenerationSignal): void {
    if (this.householdId !== undefined && this.householdId !== signal.householdId) {
      this.entries.clear();
      this.signals.clear();
      for (const [month, listeners] of this.listeners) {
        if (month !== signal.month) for (const listener of listeners) listener();
      }
    }
    this.householdId = signal.householdId;
    const prior = this.signals.get(signal.month);
    this.signals.set(signal.month, signal);
    if (prior?.householdId === signal.householdId && prior?.publicationId === signal.publicationId) return;
    for (const [key, entry] of this.entries) {
      if (entry.month === signal.month || entry.householdId !== signal.householdId) this.entries.delete(key);
    }
    for (const listener of this.listeners.get(signal.month) ?? []) listener();
  }

  check(month: YearMonth): Promise<HistoryGenerationSignal> {
    const pending = this.probes.get(month);
    if (pending !== undefined) return pending;
    const capturedHousehold = this.householdId;
    const probe = this.probe(month).then((value) => {
      const signal = historyGenerationSignalSchema.parse(value);
      if (signal.month !== month) throw new TypeError("History generation month mismatch.");
      if (capturedHousehold !== this.householdId && this.householdId !== undefined
        && signal.householdId !== this.householdId) throw new Error("Session History changed during metadata read.");
      this.accept(signal);
      return signal;
    }).catch((error: unknown) => {
      // Never keep an old authenticated payload current after a failed probe.
      const prior = this.signals.get(month);
      if (prior !== undefined) this.accept({ ...prior, publicationId: null });
      for (const [key, entry] of this.entries) if (entry.month === month) this.entries.delete(key);
      throw error;
    }).finally(() => { this.probes.delete(month); });
    this.probes.set(month, probe);
    return probe;
  }

  matches(month: YearMonth, response: ApiResponse<unknown>): boolean {
    const signal = this.signals.get(month);
    return signal !== undefined && signal.publicationId !== null
      && signal.publicationId === responsePublicationId(response);
  }

  async read(month: YearMonth, key: string, fetchPayload: () => Promise<ApiResponse<unknown>>,
    initial?: ApiResponse<unknown>): Promise<ApiResponse<unknown>> {
    const signal = await this.check(month);
    if (signal.publicationId === null) throw new Error("Aucune génération History fraîche disponible.");
    if (initial !== undefined && this.matches(month, initial)) this.entries.set(key, { month, householdId: signal.householdId, response: initial });
    const cached = this.entries.get(key)?.response;
    if (cached !== undefined && this.matches(month, cached)) return cached;
    const generationKey = JSON.stringify([signal.householdId, month, signal.publicationId, key]);
    const existing = this.reads.get(generationKey);
    if (existing !== undefined) return existing;
    const read = fetchPayload().then(async (response) => {
      // Fence late P1 replies after invalidation/P2. Recheck also closes a
      // publication switch that happened while this payload was in transit.
      await this.check(month);
      if (!this.matches(month, response)) throw new Error("La génération History a changé pendant la lecture.");
      this.entries.set(key, { month, householdId: signal.householdId, response });
      return response;
    }).finally(() => { this.reads.delete(generationKey); });
    this.reads.set(generationKey, read);
    return read;
  }
}
