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

export const budgetisationHistoryStateKey = "__budgetisation" as const;

function historyRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function extractBudgetisationHistoryState(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[budgetisationHistoryStateKey]
    : undefined;
}

export function mergeBudgetisationHistoryState(
  current: unknown,
  state: NavigationHistoryState,
): Record<string, unknown> {
  return {
    ...historyRecord(current),
    [budgetisationHistoryStateKey]: navigationHistoryStateSchema.parse(state),
  };
}

export class WebBrowserHistoryAdapter implements BrowserHistoryAdapter {
  constructor(private readonly host: BrowserHistoryHost = window) {}

  get state(): unknown {
    return extractBudgetisationHistoryState(this.host.history.state);
  }

  push(state: NavigationHistoryState, url?: string): void {
    this.host.history.pushState(
      mergeBudgetisationHistoryState(this.host.history.state, state),
      "",
      url,
    );
  }

  replace(state: NavigationHistoryState, url?: string): void {
    this.host.history.replaceState(
      mergeBudgetisationHistoryState(this.host.history.state, state),
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
    const handlePopState = (event: PopStateEvent): void =>
      listener(extractBudgetisationHistoryState(event.state));
    this.host.addEventListener("popstate", handlePopState);
    return () => this.host.removeEventListener("popstate", handlePopState);
  }
}
