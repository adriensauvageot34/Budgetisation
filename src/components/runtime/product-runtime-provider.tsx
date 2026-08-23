"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  NavigationCommandResult,
  NavigationController,
  NavigationControllerSnapshot,
  ScrollAdapter,
  ScrollContainerRef,
} from "@/navigation";
import {
  BrowserAnchorRegistry,
  InMemoryNavigationSessionStore,
  RestorationCoordinator,
  WebBrowserHistoryAdapter,
  WebRootRouterAdapter,
  createNavigationController,
} from "@/navigation";

class ProductScrollAdapter implements ScrollAdapter {
  private element(container: ScrollContainerRef): HTMLElement | null {
    return container.kind === "day_drawer"
      ? document.querySelector<HTMLElement>(
          "[data-overlay-kind='day_drawer'] [data-overlay-content]",
        )
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
    return (
      element.getBoundingClientRect().top -
      (scroller?.getBoundingClientRect().top ?? 0) +
      (scroller?.scrollTop ?? window.scrollY)
    );
  }
}

type ProductRuntimeValue = {
  readonly controller: NavigationController | null;
  readonly snapshot: NavigationControllerSnapshot | null;
  readonly run: (
    command: (controller: NavigationController) =>
      | NavigationCommandResult
      | Promise<NavigationCommandResult>,
  ) => NavigationCommandResult | Promise<NavigationCommandResult>;
};

const unavailable: NavigationCommandResult = {
  kind: "noop",
  reason: "not_started",
};

const ProductRuntimeContext = createContext<ProductRuntimeValue>({
  controller: null,
  snapshot: null,
  run: () => unavailable,
});

function ProductLocationObserver({
  onSearchChange,
}: {
  readonly onSearchChange: (search: string) => void;
}) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => onSearchChange(search), [onSearchChange, search]);
  return null;
}

function isProductRoute(pathname: string): boolean {
  return pathname.startsWith("/historique") || pathname === "/operations";
}

export function ProductRuntimeProvider({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const [search, setSearch] = useState<string | null>(null);
  const session = useRef(new InMemoryNavigationSessionStore());
  const [controller, setController] = useState<NavigationController | null>(null);
  const [snapshot, setSnapshot] = useState<NavigationControllerSnapshot | null>(null);

  useEffect(() => {
    if (!isProductRoute(pathname)) {
      setController(null);
      setSnapshot(null);
      return;
    }
    if (search === null) return;
    const scroll = new ProductScrollAdapter();
    const anchors = new BrowserAnchorRegistry();
    const next = createNavigationController({
      router: new WebRootRouterAdapter(window),
      history: new WebBrowserHistoryAdapter(window),
      session: session.current,
      surface: {
        readScope: () => null,
        applyScope: () => undefined,
        readSubview: () => null,
        applySubview: () => undefined,
      },
      restoration: new RestorationCoordinator(anchors, scroll),
      readiness: { wait: async () => ({ kind: "ready" }) },
      scroll,
      anchors,
      compatibility: { categoryIds: true, activityIds: true },
    });
    next.start();
    setController(next);
    setSnapshot(next.getSnapshot());
    const sync = () => setSnapshot(next.getSnapshot());
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      next.dispose();
    };
  }, [pathname, search]);

  const run = useCallback<ProductRuntimeValue["run"]>(
    (command) => {
      if (controller === null) return unavailable;
      const result = command(controller);
      if (result instanceof Promise) {
        return result.finally(() => setSnapshot(controller.getSnapshot()));
      }
      setSnapshot(controller.getSnapshot());
      return result;
    },
    [controller],
  );

  const value = useMemo(
    () => ({ controller, snapshot, run }),
    [controller, run, snapshot],
  );
  return (
    <ProductRuntimeContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <ProductLocationObserver onSearchChange={setSearch} />
      </Suspense>
    </ProductRuntimeContext.Provider>
  );
}

export function useProductRuntime(): ProductRuntimeValue {
  return useContext(ProductRuntimeContext);
}
