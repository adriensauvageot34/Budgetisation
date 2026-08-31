"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefCallback,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NormalizedAnalysisScope } from "@/core/scope";
import type {
  NavigationCommandResult,
  NavigationController,
  NavigationControllerSnapshot,
  NavigationSubviewRef,
  ProductReadinessRegistry,
  ProductReadinessModule,
  ProductSurfaceRegistry,
  RootNavigationContext,
  ScrollAdapter,
  ScrollContainerRef,
  SemanticAnchor,
} from "@/navigation";
import { ProductOverlayCoordinator, type ProductOverlayState } from "./product-overlay-coordinator";
import {
  BrowserAnchorRegistry,
  InMemoryNavigationSessionStore,
  ProductReadinessRegistry as ReadinessRegistry,
  ProductSurfaceRegistry as SurfaceRegistry,
  RestorationCoordinator,
  WebBrowserHistoryAdapter,
  NextRootRouterAdapter,
  createNavigationController,
  serializeRootNavigation,
} from "@/navigation";

class ProductScrollAdapter implements ScrollAdapter {
  private element(container: ScrollContainerRef): HTMLElement | null {
    return container.kind === "day_drawer"
      ? document.querySelector<HTMLElement>("[data-overlay-kind='day_drawer'] [data-overlay-content]")
      : container.kind === "exploration"
        ? document.querySelector<HTMLElement>("[data-overlay-kind='exploration'] [data-overlay-content], [data-overlay-kind='operation_root'] [data-overlay-content]")
        : (document.scrollingElement as HTMLElement | null);
  }

  getScrollY(container: ScrollContainerRef): number {
    return this.element(container)?.scrollTop ?? window.scrollY;
  }

  scrollTo(container: ScrollContainerRef, y: number): void {
    const element = this.element(container);
    if (element) element.scrollTo({ top: y });
    else window.scrollTo({ top: y });
  }

  getAnchorTop(container: ScrollContainerRef, element: HTMLElement): number {
    const scroller = this.element(container);
    return element.getBoundingClientRect().top -
      (scroller?.getBoundingClientRect().top ?? 0) +
      (scroller?.scrollTop ?? window.scrollY);
  }
}

type ProductRuntimeValue = {
  readonly controller: NavigationController | null;
  readonly snapshot: NavigationControllerSnapshot | null;
  readonly surfaceRegistry: ProductSurfaceRegistry;
  readonly readinessRegistry: ProductReadinessRegistry;
  readonly anchors: BrowserAnchorRegistry;
  readonly backgroundRootRef: MutableRefObject<HTMLElement | null>;
  readonly overlays: ProductOverlayState;
  readonly run: (
    command: (controller: NavigationController) => NavigationCommandResult | Promise<NavigationCommandResult>,
  ) => NavigationCommandResult | Promise<NavigationCommandResult>;
};

const unavailable: NavigationCommandResult = { kind: "noop", reason: "not_started" };
const fallbackAnchors = new BrowserAnchorRegistry();
const fallbackSurface = new SurfaceRegistry();
const fallbackReadiness = new ReadinessRegistry(fallbackAnchors);
const fallbackBackground = { current: null } as MutableRefObject<HTMLElement | null>;

const ProductRuntimeContext = createContext<ProductRuntimeValue>({
  controller: null,
  snapshot: null,
  surfaceRegistry: fallbackSurface,
  readinessRegistry: fallbackReadiness,
  anchors: fallbackAnchors,
  backgroundRootRef: fallbackBackground,
  overlays: { dayOpen: false, explorationOpen: false, daySuspended: false, topmost: "none" },
  run: () => unavailable,
});

function ProductLocationObserver({ onSearchChange }: { readonly onSearchChange: (search: string) => void }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  useEffect(() => onSearchChange(search), [onSearchChange, search]);
  return null;
}

function isProductRoute(pathname: string): boolean {
  return pathname.startsWith("/historique/analyse/") || pathname === "/operations";
}

export function ProductRuntimeProvider({ children }: { readonly children: React.ReactNode }) {
  const nextRouter = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState<string | null>(null);
  const session = useRef(new InMemoryNavigationSessionStore());
  const anchors = useRef(new BrowserAnchorRegistry()).current;
  const surfaceRegistry = useRef(new SurfaceRegistry()).current;
  const readinessRegistry = useRef(new ReadinessRegistry(anchors)).current;
  const overlayCoordinator = useRef(new ProductOverlayCoordinator()).current;
  const backgroundRootRef = useRef<HTMLElement | null>(null);
  const controllerRef = useRef<NavigationController | null>(null);
  const popstateCleanupRef = useRef<(() => void) | null>(null);
  const [controller, setController] = useState<NavigationController | null>(null);
  const [snapshot, setSnapshot] = useState<NavigationControllerSnapshot | null>(null);

  const disposeController = useCallback(() => {
    popstateCleanupRef.current?.();
    popstateCleanupRef.current = null;
    controllerRef.current?.dispose();
    controllerRef.current = null;
    setController(null);
    setSnapshot(null);
  }, []);

  useEffect(() => {
    if (!isProductRoute(pathname)) {
      if (controllerRef.current !== null) disposeController();
      return;
    }
    if (search === null) return;
    if (controllerRef.current === null) {
      const scroll = new ProductScrollAdapter();
      const next = createNavigationController({
        router: new NextRootRouterAdapter(nextRouter, window),
        history: new WebBrowserHistoryAdapter(window),
        session: session.current,
        surface: surfaceRegistry,
        restoration: new RestorationCoordinator(anchors, scroll),
        readiness: readinessRegistry,
        scroll,
        anchors,
        compatibility: {
          categoryIds: true,
          activityIds: false,
          merchantIds: true,
          placeIds: true,
          lifeScopeContext: true,
          dayContext: false,
        },
      });
      next.start();
      controllerRef.current = next;
      setController(next);
      setSnapshot(next.getSnapshot());
      const sync = () => setSnapshot(next.getSnapshot());
      window.addEventListener("popstate", sync);
      popstateCleanupRef.current = () => window.removeEventListener("popstate", sync);
      return;
    }
    controllerRef.current.reconcileExternalRoot();
    setSnapshot(controllerRef.current.getSnapshot());
  }, [anchors, disposeController, nextRouter, pathname, readinessRegistry, search, surfaceRegistry]);

  useEffect(() => disposeController, [disposeController]);

  const run = useCallback<ProductRuntimeValue["run"]>((command) => {
    const current = controllerRef.current;
    if (current === null) return unavailable;
    const result = command(current);
    if (result instanceof Promise) return result.finally(() => setSnapshot(current.getSnapshot()));
    setSnapshot(current.getSnapshot());
    return result;
  }, []);

  const value = useMemo(() => ({
    controller,
    snapshot,
    surfaceRegistry,
    readinessRegistry,
    anchors,
    backgroundRootRef,
    overlays: overlayCoordinator.resolve(snapshot),
    run,
  }), [anchors, controller, overlayCoordinator, readinessRegistry, run, snapshot, surfaceRegistry]);

  return (
    <ProductRuntimeContext.Provider value={value}>
      {children}
      <Suspense fallback={null}><ProductLocationObserver onSearchChange={setSearch} /></Suspense>
    </ProductRuntimeContext.Provider>
  );
}

export function useProductRuntime(): ProductRuntimeValue {
  return useContext(ProductRuntimeContext);
}

export function useProductSurface(input: {
  readonly route: RootNavigationContext;
  readonly scope: NormalizedAnalysisScope | null;
  readonly subview?: NavigationSubviewRef | null;
  readonly readiness: "pending" | "ready" | "terminal_without_anchor";
}): void {
  const runtime = useProductRuntime();
  const routeIdentity = serializeRootNavigation(input.route);
  const scopeIdentity = JSON.stringify(input.scope);
  const subviewIdentity = JSON.stringify(input.subview ?? null);
  const navigationEntryId = runtime.snapshot?.history.entryId ?? null;
  useEffect(() => runtime.surfaceRegistry.registerSurface({
    route: input.route,
    scope: input.scope,
    subview: input.subview ?? null,
  }), [routeIdentity, runtime.surfaceRegistry, scopeIdentity, subviewIdentity]);
  useLayoutEffect(() => {
    if (input.readiness === "pending") runtime.readinessRegistry.markPending(input.route);
    else if (input.readiness === "ready") runtime.readinessRegistry.markReady(input.route);
    else runtime.readinessRegistry.markTerminalWithoutAnchor(input.route);
  }, [input.readiness, navigationEntryId, routeIdentity, runtime.controller, runtime.readinessRegistry]);
}

export function useSemanticAnchor(anchor: SemanticAnchor): RefCallback<HTMLElement> {
  const { anchors } = useProductRuntime();
  const cleanup = useRef<(() => void) | null>(null);
  const identity = JSON.stringify(anchor);
  useEffect(() => () => cleanup.current?.(), []);
  return useCallback((element) => {
    cleanup.current?.();
    cleanup.current = element === null ? null : anchors.register(anchor, element);
  }, [anchors, identity]);
}

export function useProductModuleReadiness(
  route: RootNavigationContext,
  module: ProductReadinessModule,
  readiness: "pending" | "ready" | "terminal_without_anchor",
): void {
  const runtime = useProductRuntime();
  const routeIdentity = serializeRootNavigation(route);
  const navigationEntryId = runtime.snapshot?.history.entryId ?? null;
  useLayoutEffect(() => {
    if (readiness === "pending") runtime.readinessRegistry.markPending(route, module);
    else if (readiness === "ready") runtime.readinessRegistry.markReady(route, module);
    else runtime.readinessRegistry.markTerminalWithoutAnchor(route, module);
  }, [module, navigationEntryId, readiness, routeIdentity, runtime.readinessRegistry]);
}

export function useRestorableSubview(
  route: RootNavigationContext,
  onRestore: (subview: NavigationSubviewRef | null) => void,
): void {
  const runtime = useProductRuntime();
  const routeIdentity = serializeRootNavigation(route);
  const callbackRef = useRef(onRestore);
  callbackRef.current = onRestore;
  useEffect(() => {
    const apply = () => callbackRef.current(runtime.surfaceRegistry.readSubviewForRoute(route));
    const unsubscribe = runtime.surfaceRegistry.subscribe(route, apply);
    apply();
    return unsubscribe;
  }, [routeIdentity, runtime.surfaceRegistry]);
}
