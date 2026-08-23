import type { NormalizedAnalysisScope } from "../../core/scope";
import { parseNormalizedAnalysisScope } from "../contracts/checkpoint";
import type { NavigationSurfaceAdapter } from "../contracts/controller";
import type { RootNavigationContext } from "../contracts/routes";
import { rootNavigationContextSchema } from "../contracts/routes";
import type { NavigationSubviewRef } from "../contracts/subviews";
import { navigationSubviewRefSchema } from "../contracts/subviews";
import { serializeRootNavigation } from "../codecs/history-root-navigation";

export type ProductSurfaceRegistration = {
  readonly route: RootNavigationContext;
  readonly scope: NormalizedAnalysisScope | null;
  readonly subview: NavigationSubviewRef | null;
};

type MutableSurface = {
  scope: NormalizedAnalysisScope | null;
  subview: NavigationSubviewRef | null;
};

type DesiredSurfaceState = Partial<MutableSurface>;

function routeKey(route: RootNavigationContext): string {
  return serializeRootNavigation(rootNavigationContextSchema.parse(route));
}

export class ProductSurfaceRegistry implements NavigationSurfaceAdapter {
  private activeKey: string | null = null;
  private readonly surfaces = new Map<string, MutableSurface>();
  private readonly desired = new Map<string, DesiredSurfaceState>();
  private readonly listeners = new Map<string, Set<() => void>>();

  subscribe(route: RootNavigationContext, listener: () => void): () => void {
    const key = routeKey(route);
    const listeners = this.listeners.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  readSubviewForRoute(route: RootNavigationContext): NavigationSubviewRef | null {
    const key = routeKey(route);
    return this.surfaces.get(key)?.subview ?? this.desired.get(key)?.subview ?? null;
  }

  private notify(key: string): void {
    for (const listener of this.listeners.get(key) ?? []) listener();
  }

  activateRoute(route: RootNavigationContext): void {
    this.activeKey = routeKey(route);
  }

  registerSurface(input: ProductSurfaceRegistration): () => void {
    const key = routeKey(input.route);
    const desired = this.desired.get(key);
    const surface: MutableSurface = {
      scope: desired?.scope === undefined ? input.scope : desired.scope,
      subview: desired?.subview === undefined ? input.subview : desired.subview,
    };
    this.surfaces.set(key, surface);
    this.desired.delete(key);
    this.notify(key);
    return () => {
      if (this.surfaces.get(key) === surface) this.surfaces.delete(key);
    };
  }

  readScope(): NormalizedAnalysisScope | null {
    if (this.activeKey === null) return null;
    return this.surfaces.get(this.activeKey)?.scope ?? this.desired.get(this.activeKey)?.scope ?? null;
  }

  applyScope(scope: NormalizedAnalysisScope | null): void {
    if (this.activeKey === null) return;
    const parsed = scope === null ? null : parseNormalizedAnalysisScope(scope);
    const surface = this.surfaces.get(this.activeKey);
    if (surface) surface.scope = parsed;
    else this.desired.set(this.activeKey, { ...this.desired.get(this.activeKey), scope: parsed });
  }

  readSubview(): NavigationSubviewRef | null {
    if (this.activeKey === null) return null;
    return this.surfaces.get(this.activeKey)?.subview ?? this.desired.get(this.activeKey)?.subview ?? null;
  }

  applySubview(subview: NavigationSubviewRef | null): void {
    if (this.activeKey === null) return;
    const parsed = subview === null ? null : navigationSubviewRefSchema.parse(subview);
    const surface = this.surfaces.get(this.activeKey);
    if (surface) surface.subview = parsed;
    else this.desired.set(this.activeKey, { ...this.desired.get(this.activeKey), subview: parsed });
    this.notify(this.activeKey);
  }
}
