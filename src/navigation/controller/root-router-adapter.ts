import {
  parseRootNavigation,
  serializeRootNavigation,
} from "../codecs/history-root-navigation";
import {
  rootNavigationContextSchema,
  type RootNavigationContext,
} from "../contracts/routes";

export interface RootRouterAdapter {
  read(): RootNavigationContext;
  push(context: RootNavigationContext): void;
  replace(context: RootNavigationContext): void;
}

type RootRouterHost = Pick<Window, "history" | "location">;

export type NextRouterNavigation = {
  push(href: string): void;
  replace(href: string): void;
};

/**
 * Next owns real route transitions. The controller still owns the typed target,
 * while this adapter only translates it to an App Router navigation request.
 */
export class NextRootRouterAdapter implements RootRouterAdapter {
  constructor(
    private readonly router: NextRouterNavigation,
    private readonly host: Pick<Window, "location"> = window,
  ) {}

  read(): RootNavigationContext {
    return parseRootNavigation(
      `${this.host.location.pathname}${this.host.location.search}`,
    );
  }

  push(context: RootNavigationContext): void {
    this.router.push(serializeRootNavigation(rootNavigationContextSchema.parse(context)));
  }

  replace(context: RootNavigationContext): void {
    this.router.replace(serializeRootNavigation(rootNavigationContextSchema.parse(context)));
  }
}

/** @deprecated Use NextRootRouterAdapter in the product runtime. */
export class WebRootRouterAdapter implements RootRouterAdapter {
  constructor(private readonly host: RootRouterHost = window) {}

  read(): RootNavigationContext {
    return parseRootNavigation(
      `${this.host.location.pathname}${this.host.location.search}`,
    );
  }

  push(context: RootNavigationContext): void {
    const parsed = rootNavigationContextSchema.parse(context);
    this.host.history.pushState(
      this.host.history.state,
      "",
      serializeRootNavigation(parsed),
    );
  }

  replace(context: RootNavigationContext): void {
    const parsed = rootNavigationContextSchema.parse(context);
    this.host.history.replaceState(
      this.host.history.state,
      "",
      serializeRootNavigation(parsed),
    );
  }
}
