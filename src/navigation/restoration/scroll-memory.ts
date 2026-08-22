import { parseGlobalWindow, parseYearMonth } from "../../core/time";
import {
  scrollMemorySchema,
  type AnalysisScrollContext,
  type ScrollContextKey,
  type ScrollMemory,
} from "../contracts/restoration";

export function createScrollContextKey(
  context: AnalysisScrollContext,
): ScrollContextKey {
  const scope = context.scopeHash ?? "none";
  return (context.kind === "analysis_month"
    ? `month:${parseYearMonth(context.month)}:scope=${scope}`
    : `global:${parseGlobalWindow(context.window)}:scope=${scope}`) as ScrollContextKey;
}

export class SessionScrollMemoryStore {
  private readonly memories = new Map<ScrollContextKey, ScrollMemory>();

  get(context: AnalysisScrollContext): ScrollMemory | null {
    return this.memories.get(createScrollContextKey(context)) ?? null;
  }

  set(context: AnalysisScrollContext, memory: ScrollMemory): void {
    this.memories.set(
      createScrollContextKey(context),
      scrollMemorySchema.parse(memory),
    );
  }

  delete(context: AnalysisScrollContext): void {
    this.memories.delete(createScrollContextKey(context));
  }

  clear(): void {
    this.memories.clear();
  }
}
