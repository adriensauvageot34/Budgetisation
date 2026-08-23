import type { NormalizedAnalysisScope } from "../../core/scope";
import type { GlobalWindow, LocalDate, YearMonth } from "../../core/time";
import type { AnchorRegistry } from "../restoration/anchor-registry";
import type { RestorationCoordinator } from "../restoration/coordinator";
import type { ScrollAdapter } from "../restoration/scroll-adapter";
import type { BrowserHistoryAdapter } from "../history/browser-history-adapter";
import type { RootRouterAdapter } from "../controller/root-router-adapter";
import type { NavigationSessionStore } from "../controller/session-store";
import type { SemanticAnchor } from "./anchors";
import type { NavigationCheckpoint } from "./checkpoint";
import type {
  AnalysisTransferCompatibility,
  NavigationContextMemory,
  ReturnDestination,
} from "./context-transfer";
import type { ExplorationNode } from "./exploration";
import type { NavigationHistoryState } from "./history";
import type { OperationsNavigationFilters } from "./operations";
import type { RestorationReadiness } from "./restoration";
import type { NavigationSubviewRef } from "./subviews";
import type { CalendarWeekRef } from "./routes";

export type NavigationCommandResult =
  | { readonly kind: "applied" }
  | {
      readonly kind: "noop";
      readonly reason:
        | "already_started"
        | "not_started"
        | "no_exploration"
        | "no_day"
        | "same_target"
        | "restoration_cancelled";
    }
  | {
      readonly kind: "rejected";
      readonly reason:
        | "invalid_checkpoint"
        | "invalid_operations_filters"
        | "missing_analysis_scope"
        | "missing_calendar_month"
        | "missing_last_calendar_context"
        | "missing_place_origin"
        | "missing_return_destination"
        | "not_analysis_context"
        | "not_calendar_context";
    };

export type NavigationControllerSnapshot = {
  readonly history: NavigationHistoryState;
  readonly contextMemory: NavigationContextMemory;
  readonly returnDestination: ReturnDestination | null;
};

export interface NavigationSurfaceAdapter {
  activateRoute(route: import("./routes").RootNavigationContext): void;
  readScope(): NormalizedAnalysisScope | null;
  applyScope(scope: NormalizedAnalysisScope | null): void;
  readSubview(): NavigationSubviewRef | null;
  applySubview(subview: NavigationSubviewRef | null): void;
}

export interface RestorationReadinessAdapter {
  activateRoute(route: import("./routes").RootNavigationContext): void;
  wait(checkpoint: NavigationCheckpoint): Promise<RestorationReadiness>;
}

export type NavigationControllerDeps = {
  readonly router: RootRouterAdapter;
  readonly history: BrowserHistoryAdapter;
  readonly session: NavigationSessionStore;
  readonly surface: NavigationSurfaceAdapter;
  readonly restoration: RestorationCoordinator;
  readonly readiness: RestorationReadinessAdapter;
  readonly scroll: ScrollAdapter;
  readonly anchors?: AnchorRegistry;
  readonly compatibility: AnalysisTransferCompatibility;
  readonly onError?: (error: unknown) => void;
};

export interface NavigationController {
  start(): NavigationCommandResult;
  dispose(): void;
  getSnapshot(): NavigationControllerSnapshot;

  openDay(date: LocalDate): NavigationCommandResult;
  closeDay(): NavigationCommandResult;
  previousDay(): NavigationCommandResult;
  nextDay(): NavigationCommandResult;

  openCalendarMonth(month: YearMonth): NavigationCommandResult;
  openCalendarWeek(
    month: YearMonth,
    week: CalendarWeekRef,
  ): NavigationCommandResult;

  reconcileExternalRoot(): NavigationCommandResult;
  openExploration(node: ExplorationNode, anchor?: SemanticAnchor): NavigationCommandResult;
  push(node: ExplorationNode, anchor?: SemanticAnchor): NavigationCommandResult;
  pop(): NavigationCommandResult;
  close(): NavigationCommandResult;

  goToMonth(month: YearMonth): Promise<NavigationCommandResult>;
  goToGlobal(window: GlobalWindow): Promise<NavigationCommandResult>;
  goToOperations(
    filters: OperationsNavigationFilters,
  ): NavigationCommandResult;
  updateOperations(
    filters: OperationsNavigationFilters,
    mode?: "push" | "replace",
  ): NavigationCommandResult;

  createCheckpoint(anchor?: SemanticAnchor): NavigationCheckpoint;
  restoreCheckpoint(checkpoint: unknown): Promise<NavigationCommandResult>;

  showDayFromExploration(day: LocalDate): NavigationCommandResult;
  returnToOrigin(): Promise<NavigationCommandResult>;
  goToAnalysis(): Promise<NavigationCommandResult>;
  goToCalendar(): Promise<NavigationCommandResult>;
}
