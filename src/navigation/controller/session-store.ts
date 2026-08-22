import {
  navigationContextMemorySchema,
  parseReturnDestination,
  type NavigationContextMemory,
  type ReturnDestination,
} from "../contracts/context-transfer";
import type {
  AnalysisScrollContext,
  ScrollMemory,
} from "../contracts/restoration";
import {
  parseClosedExplorationGenerations,
  type ClosedExplorationGenerations,
} from "../history/generation";
import { SessionScrollMemoryStore } from "../restoration/scroll-memory";

export interface NavigationSessionStore {
  getContextMemory(): NavigationContextMemory;
  setContextMemory(memory: NavigationContextMemory): void;

  getClosedGenerations(): ClosedExplorationGenerations;
  setClosedGenerations(generations: ClosedExplorationGenerations): void;

  getScrollMemory(context: AnalysisScrollContext): ScrollMemory | null;
  setScrollMemory(context: AnalysisScrollContext, memory: ScrollMemory): void;

  getReturnDestination(): ReturnDestination | null;
  setReturnDestination(destination: ReturnDestination | null): void;
}

export class InMemoryNavigationSessionStore implements NavigationSessionStore {
  private contextMemory: NavigationContextMemory = {};
  private closedGenerations: ClosedExplorationGenerations = [];
  private readonly scrollMemories = new SessionScrollMemoryStore();
  private returnDestination: ReturnDestination | null = null;

  getContextMemory(): NavigationContextMemory {
    return this.contextMemory;
  }

  setContextMemory(memory: NavigationContextMemory): void {
    this.contextMemory = navigationContextMemorySchema.parse(memory);
  }

  getClosedGenerations(): ClosedExplorationGenerations {
    return this.closedGenerations;
  }

  setClosedGenerations(generations: ClosedExplorationGenerations): void {
    this.closedGenerations = parseClosedExplorationGenerations(generations);
  }

  getScrollMemory(context: AnalysisScrollContext): ScrollMemory | null {
    return this.scrollMemories.get(context);
  }

  setScrollMemory(
    context: AnalysisScrollContext,
    memory: ScrollMemory,
  ): void {
    this.scrollMemories.set(context, memory);
  }

  getReturnDestination(): ReturnDestination | null {
    return this.returnDestination;
  }

  setReturnDestination(destination: ReturnDestination | null): void {
    this.returnDestination =
      destination === null ? null : parseReturnDestination(destination);
  }
}
