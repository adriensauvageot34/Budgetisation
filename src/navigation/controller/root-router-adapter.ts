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
