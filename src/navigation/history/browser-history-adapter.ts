import {
  navigationHistoryStateSchema,
  type NavigationHistoryState,
} from "../contracts/history";

export interface BrowserHistoryAdapter {
  readonly state: unknown;

  push(state: NavigationHistoryState, url?: string): void;

  replace(state: NavigationHistoryState, url?: string): void;

  back(): void;

  forward(): void;

  subscribe(listener: (state: unknown) => void): () => void;
}

type BrowserHistoryHost = Pick<
  Window,
  "history" | "addEventListener" | "removeEventListener"
>;

export class WebBrowserHistoryAdapter implements BrowserHistoryAdapter {
  constructor(private readonly host: BrowserHistoryHost = window) {}

  get state(): unknown {
    return this.host.history.state;
  }

  push(state: NavigationHistoryState, url?: string): void {
    this.host.history.pushState(
      navigationHistoryStateSchema.parse(state),
      "",
      url,
    );
  }

  replace(state: NavigationHistoryState, url?: string): void {
    this.host.history.replaceState(
      navigationHistoryStateSchema.parse(state),
      "",
      url,
    );
  }

  back(): void {
    this.host.history.back();
  }

  forward(): void {
    this.host.history.forward();
  }

  subscribe(listener: (state: unknown) => void): () => void {
    const handlePopState = (event: PopStateEvent): void => listener(event.state);
    this.host.addEventListener("popstate", handlePopState);
    return () => this.host.removeEventListener("popstate", handlePopState);
  }
}
