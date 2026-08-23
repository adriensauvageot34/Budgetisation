export type {
  AnalysisRouteContext,
  CalendarRouteContext,
  CalendarWeekRef,
  HistoryRootContext,
  OperationsRouteContext,
  RootNavigationContext,
} from "./contracts/routes";
export {
  calendarWeekRefSchema,
  historyRootContextSchema,
  parseCalendarWeekRef,
  parseHistoryRootContext,
  parseRootNavigationContext,
  rootNavigationContextSchema,
} from "./contracts/routes";
export {
  parseRootNavigation,
  serializeRootNavigation,
} from "./codecs/history-root-navigation";

export type {
  NavigationCheckpoint,
  NavigationFilterSnapshot,
} from "./contracts/checkpoint";
export {
  navigationCheckpointSchema,
  navigationCheckpointVersion,
  parseNavigationCheckpoint,
} from "./contracts/checkpoint";
export type { NavigationSubviewRef } from "./contracts/subviews";
export {
  navigationSubviewRefSchema,
  parseNavigationSubviewRef,
} from "./contracts/subviews";

export type {
  NavigationAnchorItem,
  NavigationEntityId,
  NavigationModuleId,
  SemanticAnchor,
} from "./contracts/anchors";
export {
  parseNavigationAnchorItem,
  parseSemanticAnchor,
  semanticAnchorSchema,
} from "./contracts/anchors";

export type {
  ExplorationNode,
  GalleryExplorationNode,
  NonGalleryExplorationNode,
} from "./contracts/exploration";
export {
  explorationNodeSchema,
  parseExplorationNode,
} from "./contracts/exploration";
export type {
  ActiveExplorationState,
  ExplorationStack,
} from "./contracts/exploration-state";
export {
  activeExplorationStateSchema,
  parseActiveExplorationState,
} from "./contracts/exploration-state";
export {
  canPopExploration,
  getCurrentNode,
  getExplorationDepth,
  getExplorationOrigin,
  getParentNode,
  getRootNode,
} from "./exploration/stack";

export type {
  NavigationHistoryEntryId,
  NavigationHistoryState,
} from "./contracts/history";
export {
  navigationHistoryStateSchema,
  navigationHistoryVersion,
  parseNavigationHistoryState,
} from "./contracts/history";
export type { BrowserHistoryAdapter } from "./history/browser-history-adapter";
export { WebBrowserHistoryAdapter } from "./history/browser-history-adapter";

export type {
  OperationsLocalDisplayState,
  OperationsNavigationFilters,
  OperationsQuestion,
} from "./contracts/operations";
export {
  operationsNavigationFiltersSchema,
  parseOperationsNavigationFilters,
  splitOperationsNavigationState,
} from "./contracts/operations";
export type {
  GalleryFilters,
  GalleryFiltersByKind,
  GalleryKind,
  GalleryNavigationFilters,
} from "./contracts/gallery";

export type {
  CalendarMonthRootContext,
  CalendarMonthRouteContext,
  DayDrawerNavigationState,
} from "./contracts/day-drawer";
export {
  getDayDrawerNavigationState,
  isDayDrawerSuspended,
} from "./day/day-navigation";

export type {
  AnalysisScrollContext,
  NavigationRestorationCause,
  RestorationOutcome,
  RestorationReadiness,
  ScrollContainerRef,
  ScrollMemory,
} from "./contracts/restoration";
export {
  navigationRestorationCauseSchema,
  restorationReadinessSchema,
  scrollContainerRefSchema,
  scrollMemorySchema,
} from "./contracts/restoration";
export type { AnchorRegistry } from "./restoration/anchor-registry";
export { BrowserAnchorRegistry } from "./restoration/anchor-registry";
export type { ScrollAdapter } from "./restoration/scroll-adapter";
export { RestorationCoordinator } from "./restoration/coordinator";

export type {
  AnalysisTransferCompatibility,
  NavigationContextMemory,
  OperationsNavigationIntent,
  ReturnDestination,
  ShowDayNavigationIntent,
} from "./contracts/context-transfer";
export {
  analysisTransferCompatibilitySchema,
  navigationContextMemorySchema,
  operationsNavigationIntentSchema,
  returnDestinationSchema,
  showDayNavigationIntentSchema,
} from "./contracts/context-transfer";

export type {
  NavigationCommandResult,
  NavigationController,
  NavigationControllerDeps,
  NavigationControllerSnapshot,
  NavigationSurfaceAdapter,
  RestorationReadinessAdapter,
} from "./contracts/controller";
export { createNavigationController } from "./controller/navigation-controller";
export type { RootRouterAdapter } from "./controller/root-router-adapter";
export { WebRootRouterAdapter } from "./controller/root-router-adapter";
export type { NavigationSessionStore } from "./controller/session-store";
export { InMemoryNavigationSessionStore } from "./controller/session-store";
export { ProductSurfaceRegistry } from "./controller/product-surface-registry";
export type { ProductSurfaceRegistration } from "./controller/product-surface-registry";
export { ProductReadinessRegistry } from "./restoration/product-readiness-registry";
export type { ProductReadinessModule } from "./restoration/product-readiness-registry";
