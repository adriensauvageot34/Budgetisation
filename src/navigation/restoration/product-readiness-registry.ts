import { serializeRootNavigation } from "../codecs/history-root-navigation";
import type { NavigationCheckpoint } from "../contracts/checkpoint";
import type { RestorationReadinessAdapter } from "../contracts/controller";
import type { RestorationReadiness } from "../contracts/restoration";
import type { RootNavigationContext } from "../contracts/routes";
import type { AnchorRegistry } from "./anchor-registry";

type ReadinessState = "pending" | "ready" | "terminal_without_anchor";
export type ProductReadinessModule = "initial" | "evolution" | "structure" | "lived" | "moments" | "baseline" | "typical" | "habits" | "profiles" | "universe";
type Waiter = { readonly checkpoint: NavigationCheckpoint; readonly resolve: (value: RestorationReadiness) => void };

function keyFor(route: RootNavigationContext): string { return serializeRootNavigation(route); }
function stateKey(routeKey: string, module: ProductReadinessModule): string { return `${routeKey}::${module}`; }

function moduleForCheckpoint(checkpoint: NavigationCheckpoint): ProductReadinessModule {
  const anchor = checkpoint.anchor;
  if (anchor?.moduleId === "analysis-global") {
    const key = anchor.itemKey ?? "";
    if (key.startsWith("baseline")) return "baseline";
    if (key.startsWith("typical")) return "typical";
    if (key.startsWith("evolution")) return "evolution";
    if (key.startsWith("habits")) return "habits";
    if (key.startsWith("profiles")) return "profiles";
    if (key.startsWith("universe")) return "universe";
    return "initial";
  }
  if (anchor?.moduleId !== "analysis-month") return "initial";
  if (anchor.item?.kind === "moment") return "moments";
  if (anchor.item?.kind === "category") return "structure";
  if (anchor.item?.kind === "activity") return "lived";
  const key = anchor.itemKey ?? "";
  if (key.startsWith("evolution")) return "evolution";
  if (key.startsWith("structure")) return "structure";
  if (key.startsWith("lived")) return "lived";
  if (key.startsWith("moments")) return "moments";
  return "initial";
}

export class ProductReadinessRegistry implements RestorationReadinessAdapter {
  private activeKey: string | null = null;
  private readonly states = new Map<string, ReadinessState>();
  private readonly waiters = new Map<string, Waiter[]>();

  constructor(private readonly anchors: AnchorRegistry) {}

  activateRoute(route: RootNavigationContext): void {
    const key = keyFor(route);
    if (this.activeKey !== null && this.activeKey !== key) this.cancelWaiters(this.activeKey);
    this.activeKey = key;
    for (const module of ["initial", "evolution", "structure", "lived", "moments", "baseline", "typical", "habits", "profiles", "universe"] as const) {
      this.states.delete(stateKey(key, module));
    }
    this.states.set(stateKey(key, "initial"), "pending");
  }

  markPending(route: RootNavigationContext, module: ProductReadinessModule = "initial"): void {
    const key = keyFor(route);
    if (key === this.activeKey) this.states.set(stateKey(key, module), "pending");
  }

  markReady(route: RootNavigationContext, module: ProductReadinessModule = "initial"): void {
    const key = keyFor(route);
    if (key !== this.activeKey) return;
    this.states.set(stateKey(key, module), "ready");
    this.flush(key);
  }

  markTerminalWithoutAnchor(route: RootNavigationContext, module: ProductReadinessModule = "initial"): void {
    const key = keyFor(route);
    if (key !== this.activeKey) return;
    this.states.set(stateKey(key, module), "terminal_without_anchor");
    this.flush(key);
  }

  wait(checkpoint: NavigationCheckpoint): Promise<RestorationReadiness> {
    const key = keyFor(checkpoint.route);
    const state = this.stateForCheckpoint(key, checkpoint);
    if (state !== "pending") return Promise.resolve(this.outcome(checkpoint, state));
    return new Promise((resolve) => {
      const current = this.waiters.get(key) ?? [];
      current.push({ checkpoint, resolve });
      this.waiters.set(key, current);
    });
  }

  private stateForCheckpoint(key: string, checkpoint: NavigationCheckpoint): ReadinessState {
    const initial = this.states.get(stateKey(key, "initial")) ?? "pending";
    if (initial !== "ready") return initial;
    const module = moduleForCheckpoint(checkpoint);
    return module === "initial" ? initial : this.states.get(stateKey(key, module)) ?? "pending";
  }

  private outcome(checkpoint: NavigationCheckpoint, state: ReadinessState): RestorationReadiness {
    if (state === "terminal_without_anchor") return { kind: "terminal_without_anchor" };
    if (checkpoint.anchor !== undefined && this.anchors.resolve(checkpoint.anchor) === null) return { kind: "terminal_without_anchor" };
    return { kind: "ready" };
  }

  private flush(key: string): void {
    const waiters = this.waiters.get(key) ?? [];
    const remaining: Waiter[] = [];
    for (const waiter of waiters) {
      const state = this.stateForCheckpoint(key, waiter.checkpoint);
      if (state === "pending") remaining.push(waiter);
      else waiter.resolve(this.outcome(waiter.checkpoint, state));
    }
    if (remaining.length === 0) this.waiters.delete(key);
    else this.waiters.set(key, remaining);
  }

  private cancelWaiters(key: string): void {
    const waiters = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of waiters) waiter.resolve({ kind: "cancelled" });
  }
}
