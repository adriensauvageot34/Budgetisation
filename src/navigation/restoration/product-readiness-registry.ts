import { serializeRootNavigation } from "../codecs/history-root-navigation";
import type { NavigationCheckpoint } from "../contracts/checkpoint";
import type { RestorationReadinessAdapter } from "../contracts/controller";
import type { RestorationReadiness } from "../contracts/restoration";
import type { RootNavigationContext } from "../contracts/routes";
import type { AnchorRegistry } from "./anchor-registry";

type ReadinessState = "pending" | "ready" | "terminal_without_anchor";
type Waiter = {
  readonly checkpoint: NavigationCheckpoint;
  readonly resolve: (value: RestorationReadiness) => void;
};

function keyFor(route: RootNavigationContext): string {
  return serializeRootNavigation(route);
}

export class ProductReadinessRegistry implements RestorationReadinessAdapter {
  private activeKey: string | null = null;
  private readonly states = new Map<string, ReadinessState>();
  private readonly waiters = new Map<string, Waiter[]>();

  constructor(private readonly anchors: AnchorRegistry) {}

  activateRoute(route: RootNavigationContext): void {
    const key = keyFor(route);
    if (this.activeKey !== null && this.activeKey !== key) {
      this.cancelWaiters(this.activeKey);
    }
    this.activeKey = key;
    this.states.set(key, "pending");
  }

  markPending(route: RootNavigationContext): void {
    const key = keyFor(route);
    if (key === this.activeKey) this.states.set(key, "pending");
  }

  markReady(route: RootNavigationContext): void {
    const key = keyFor(route);
    if (key !== this.activeKey) return;
    this.states.set(key, "ready");
    this.flush(key);
  }

  markTerminalWithoutAnchor(route: RootNavigationContext): void {
    const key = keyFor(route);
    if (key !== this.activeKey) return;
    this.states.set(key, "terminal_without_anchor");
    this.flush(key);
  }

  wait(checkpoint: NavigationCheckpoint): Promise<RestorationReadiness> {
    const key = keyFor(checkpoint.route);
    const state = this.states.get(key);
    if (state === "ready" || state === "terminal_without_anchor") {
      return Promise.resolve(this.outcome(checkpoint, state));
    }
    return new Promise((resolve) => {
      const current = this.waiters.get(key) ?? [];
      current.push({ checkpoint, resolve });
      this.waiters.set(key, current);
    });
  }

  private outcome(checkpoint: NavigationCheckpoint, state: ReadinessState): RestorationReadiness {
    if (state === "terminal_without_anchor") return { kind: "terminal_without_anchor" };
    if (checkpoint.anchor !== undefined && this.anchors.resolve(checkpoint.anchor) === null) {
      return { kind: "terminal_without_anchor" };
    }
    return { kind: "ready" };
  }

  private flush(key: string): void {
    const state = this.states.get(key);
    if (state !== "ready" && state !== "terminal_without_anchor") return;
    const waiters = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of waiters) waiter.resolve(this.outcome(waiter.checkpoint, state));
  }

  private cancelWaiters(key: string): void {
    const waiters = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of waiters) waiter.resolve({ kind: "cancelled" });
  }
}
