import type { NormalizedAnalysisScope } from "../../core/scope";
import {
  parseGlobalWindow,
  parseYearMonth,
  type GlobalWindow,
  type LocalDate,
  type YearMonth,
} from "../../core/time";
import {
  navigationCheckpointSchema,
  navigationCheckpointVersion,
  parseNormalizedAnalysisScope,
  type NavigationCheckpoint,
} from "../contracts/checkpoint";
import {
  navigationContextMemorySchema,
  type NavigationContextMemory,
  type ReturnDestination,
} from "../contracts/context-transfer";
import type {
  NavigationCommandResult,
  NavigationController,
  NavigationControllerDeps,
  NavigationControllerSnapshot,
} from "../contracts/controller";
import {
  explorationNodeSchema,
  type ExplorationNode,
} from "../contracts/exploration";
import {
  getRootNavigationDay,
  navigationHistoryStateSchema,
  navigationHistoryVersion,
  type NavigationHistoryState,
} from "../contracts/history";
import {
  operationsNavigationFiltersSchema,
  type OperationsNavigationFilters,
} from "../contracts/operations";
import type {
  AnalysisScrollContext,
  NavigationRestorationCause,
  ScrollContainerRef,
  ScrollMemory,
} from "../contracts/restoration";
import {
  rootNavigationContextSchema,
  type CalendarWeekRef,
  type HistoryRootContext,
  type RootNavigationContext,
} from "../contracts/routes";
import { semanticAnchorSchema, type SemanticAnchor } from "../contracts/anchors";
import {
  buildCloseDayRoot,
  buildOpenDayRoot,
  getDayDrawerNavigationState,
  getNextDay,
  getPreviousDay,
} from "../day/day-navigation";
import { getCurrentNode } from "../exploration/stack";
import {
  createNextGeneration,
  parseExplorationGeneration,
  type ExplorationGeneration,
} from "../history/generation";
import {
  applyExplorationClose,
  createOpenExplorationHistoryState,
  createPushedExplorationHistoryState,
  prepareExplorationClose,
  resolveNavigationHistoryState,
} from "../history/policies";
import { selectScrollRestoration } from "../restoration/policies";
import {
  transferGlobalToMonth,
  transferMonthToGlobal,
} from "../transfer/analysis-transfer";
import {
  buildShowDayIntent,
  transferAnalysisToCalendar,
  transferCalendarToAnalysis,
} from "../transfer/inter-context";
import { buildOperationsIntent } from "../transfer/operations-intent";
import { serializeRootNavigation } from "../codecs/history-root-navigation";

const applied: NavigationCommandResult = { kind: "applied" };

function noop(
  reason: Extract<NavigationCommandResult, { kind: "noop" }>["reason"],
): NavigationCommandResult {
  return { kind: "noop", reason };
}

function rejected(
  reason: Extract<NavigationCommandResult, { kind: "rejected" }>["reason"],
): NavigationCommandResult {
  return { kind: "rejected", reason };
}

function scrollContainerFor(root: RootNavigationContext): ScrollContainerRef {
  return getDayDrawerNavigationState(root) === null
    ? { kind: "root" }
    : { kind: "day_drawer" };
}

function scrollContextFor(
  root: RootNavigationContext,
): AnalysisScrollContext | null {
  if (!("area" in root) || root.area !== "analysis") return null;
  return root.context.kind === "analysis_month"
    ? { kind: "analysis_month", month: root.context.month }
    : {
        kind: "analysis_global",
        window: root.context.observationWindow,
      };
}

function scrollMemoryFromCheckpoint(
  checkpoint: NavigationCheckpoint,
): ScrollMemory | null {
  if (checkpoint.scrollFallbackY === undefined) return null;
  return {
    ...(checkpoint.anchor === undefined ? {} : { anchor: checkpoint.anchor }),
    ...(checkpoint.anchorOffset === undefined
      ? {}
      : { anchorOffset: checkpoint.anchorOffset }),
    scrollY: checkpoint.scrollFallbackY,
  };
}

class DefaultNavigationController implements NavigationController {
  private currentState: NavigationHistoryState | null = null;
  private unsubscribeHistory: (() => void) | null = null;
  private entrySequence = 0;
  private latestGeneration: ExplorationGeneration | null = null;

  constructor(private readonly deps: NavigationControllerDeps) {}

  start(): NavigationCommandResult {
    if (this.unsubscribeHistory !== null) return noop("already_started");

    const root = rootNavigationContextSchema.parse(this.deps.router.read());
    const resolution = resolveNavigationHistoryState(
      this.deps.history.state,
      this.deps.session.getClosedGenerations(),
      root,
    );

    if (resolution.kind === "restore") {
      this.currentState = resolution.state;
      this.syncLatestGeneration(resolution.state);
      const checkpoint =
        resolution.state.checkpoint ??
        resolution.state.exploration?.rootCheckpoint;
      if (checkpoint !== undefined) {
        this.applyCheckpointState(checkpoint);
        this.scheduleRestoration(
          this.restoreScroll({ kind: "browser_history" }, checkpoint),
        );
      } else {
        this.rememberRoot(resolution.state.root);
      }
    } else if (resolution.reason === "closed-generation") {
      const state = this.createRootState(resolution.root, resolution.checkpoint);
      this.deps.router.replace(resolution.root);
      this.deps.history.replace(state, serializeRootNavigation(resolution.root));
      this.currentState = state;
      this.syncLatestGeneration(state);
      this.applyCheckpointState(resolution.checkpoint);
      this.scheduleRestoration(
        this.restoreScroll({ kind: "checkpoint_restore" }, resolution.checkpoint),
      );
    } else {
      const state = this.createRootState(root);
      this.deps.history.replace(state, serializeRootNavigation(root));
      this.currentState = state;
      this.syncLatestGeneration(state);
      this.rememberRoot(root);
    }

    this.unsubscribeHistory = this.deps.history.subscribe((rawState) => {
      this.handlePopState(rawState);
    });
    return applied;
  }

  dispose(): void {
    this.unsubscribeHistory?.();
    this.unsubscribeHistory = null;
    this.deps.restoration.cancel();
  }

  getSnapshot(): NavigationControllerSnapshot {
    const state = this.requireState();
    return {
      history: state,
      contextMemory: this.deps.session.getContextMemory(),
      returnDestination: this.deps.session.getReturnDestination(),
    };
  }

  openDay(date: LocalDate): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const current = this.requireState().root;
    const personId = "area" in current && current.area === "calendar"
      ? current.context.personId
      : undefined;
    const dayRoot = buildOpenDayRoot(date);
    const target: HistoryRootContext = {
      ...dayRoot,
      context: {
        ...dayRoot.context,
        ...(personId === undefined ? {} : { personId }),
      },
    };
    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(target, "push");
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    this.rememberRoot(target);
    return applied;
  }

  closeDay(): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const root = this.requireState().root;
    if (
      !("area" in root) ||
      root.area !== "calendar" ||
      root.context.kind !== "calendar_month" ||
      root.context.day === undefined
    ) {
      return noop("no_day");
    }
    const target = buildCloseDayRoot({ area: "calendar", context: root.context });
    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(target, "push");
    this.rememberRoot(target);
    return applied;
  }

  previousDay(): NavigationCommandResult {
    const state = this.isStarted() ? this.requireState() : null;
    const day = state === null ? null : getRootNavigationDay(state.root);
    return day === null ? noop("no_day") : this.openDay(getPreviousDay(day));
  }

  nextDay(): NavigationCommandResult {
    const state = this.isStarted() ? this.requireState() : null;
    const day = state === null ? null : getRootNavigationDay(state.root);
    return day === null ? noop("no_day") : this.openDay(getNextDay(day));
  }

  openCalendarMonth(month: YearMonth): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const targetMonth = parseYearMonth(month);
    const current = this.requireState();
    const personId = "area" in current.root && current.root.area === "calendar"
      ? current.root.context.personId
      : undefined;
    if (
      current.exploration === null &&
      "area" in current.root &&
      current.root.area === "calendar" &&
      current.root.context.kind === "calendar_month" &&
      current.root.context.month === targetMonth &&
      current.root.context.day === undefined
    ) {
      return noop("same_target");
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    const target: HistoryRootContext = {
      area: "calendar",
      context: {
        kind: "calendar_month",
        month: targetMonth,
        ...(personId === undefined ? {} : { personId }),
      },
    };
    this.commitRoot(target, "push");
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    this.rememberRoot(target);
    return applied;
  }

  openCalendarWeek(
    month: YearMonth,
    week: CalendarWeekRef,
  ): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const targetMonth = parseYearMonth(month);
    const current = this.requireState();
    const personId = "area" in current.root && current.root.area === "calendar"
      ? current.root.context.personId
      : undefined;
    const target = rootNavigationContextSchema.parse({
      area: "calendar",
      context: {
        kind: "calendar_week",
        month: targetMonth,
        week,
        ...(personId === undefined ? {} : { personId }),
      },
    }) as HistoryRootContext;
    if (
      current.exploration === null &&
      "area" in current.root &&
      current.root.area === "calendar" &&
      current.root.context.kind === "calendar_week" &&
      current.root.context.month === targetMonth &&
      current.root.context.week === week
    ) {
      return noop("same_target");
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(target, "push");
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    this.rememberRoot(target);
    return applied;
  }

  openExploration(node: ExplorationNode): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const current = this.requireState();
    if (current.exploration !== null) return this.push(node);

    this.beginNavigation();
    const checkpoint = this.captureCurrentSnapshot();
    const state = createOpenExplorationHistoryState({
      current: this.requireState(),
      entryId: this.nextEntryId(),
      generation: this.nextGeneration(),
      rootCheckpoint: checkpoint,
      node: explorationNodeSchema.parse(node),
    });
    this.deps.history.push(state, serializeRootNavigation(state.root));
    this.currentState = state;
    return applied;
  }

  push(node: ExplorationNode): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const current = this.requireState();
    if (current.exploration === null) return this.openExploration(node);

    this.beginNavigation();
    const state = createPushedExplorationHistoryState(
      current,
      this.nextEntryId(),
      explorationNodeSchema.parse(node),
    );
    this.deps.history.push(state, serializeRootNavigation(state.root));
    this.currentState = state;
    return applied;
  }

  pop(): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    if (this.requireState().exploration === null) return noop("no_exploration");
    this.beginNavigation();
    this.deps.history.back();
    return applied;
  }

  close(): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const current = this.requireState();
    if (current.exploration === null) return noop("no_exploration");

    this.beginNavigation();
    const plan = prepareExplorationClose(
      current,
      this.deps.session.getClosedGenerations(),
    );
    this.deps.session.setClosedGenerations(plan.closedGenerations);
    this.deps.router.replace(plan.state.root);
    applyExplorationClose(this.deps.history, plan);
    this.currentState = plan.state;
    this.applyCheckpointState(plan.checkpoint);
    this.scheduleRestoration(
      this.restoreScroll({ kind: "checkpoint_restore" }, plan.checkpoint),
    );
    return applied;
  }

  async goToMonth(month: YearMonth): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const targetMonth = parseYearMonth(month);
    const current = this.requireState();
    if (
      current.exploration === null &&
      "area" in current.root &&
      current.root.area === "analysis" &&
      current.root.context.kind === "analysis_month" &&
      current.root.context.month === targetMonth
    ) {
      return noop("same_target");
    }

    const sourceScope = this.readScope();
    const currentMemory = this.deps.session.getContextMemory();
    let targetScope: NormalizedAnalysisScope | null = null;
    let memory: NavigationContextMemory;
    let cause: NavigationRestorationCause = {
      kind: "voluntary_month_navigation",
    };

    if (sourceScope?.time.kind === "global") {
      const isModeReturn = currentMemory.lastAnalysedMonth === targetMonth;
      const transfer = transferGlobalToMonth(
        sourceScope,
        this.deps.compatibility,
        navigationContextMemorySchema.parse({
          ...currentMemory,
          lastAnalysedMonth: targetMonth,
        }),
      );
      if (transfer.kind === "missing_last_analysed_month") {
        return rejected("missing_analysis_scope");
      }
      targetScope = transfer.targetScope;
      memory = transfer.memory;
      if (isModeReturn) cause = { kind: "analysis_mode_switch" };
    } else if (sourceScope?.time.kind === "month") {
      targetScope = parseNormalizedAnalysisScope({
        subject: sourceScope.subject,
        time: { kind: "month", month: targetMonth },
        filters: {
          categoryIds: this.deps.compatibility.categoryIds
            ? sourceScope.filters.categoryIds
            : [],
          activityIds: this.deps.compatibility.activityIds
            ? sourceScope.filters.activityIds
            : [],
          merchantIds: [],
          placeIds: [],
          lifeScopeContext: [],
          dayContext: [],
        },
      });
      memory = navigationContextMemorySchema.parse({
        ...currentMemory,
        lastAnalysedMonth: targetMonth,
      });
    } else {
      memory = navigationContextMemorySchema.parse({
        ...currentMemory,
        lastAnalysedMonth: targetMonth,
      });
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    const target: HistoryRootContext = {
      area: "analysis",
      context: { kind: "analysis_month", month: targetMonth },
    };
    this.commitRoot(target, "push");
    this.deps.surface.applyScope(targetScope);
    this.deps.surface.applySubview(null);
    this.deps.session.setContextMemory(memory);
    return this.restoreScroll(cause);
  }

  async goToGlobal(window: GlobalWindow): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const targetWindow = parseGlobalWindow(window);
    const currentRoot = this.requireState().root;
    if (!("area" in currentRoot) || currentRoot.area !== "analysis") {
      return rejected("not_analysis_context");
    }
    const sourceScope = this.readScope();
    if (sourceScope === null) return rejected("missing_analysis_scope");

    const currentMemory = this.deps.session.getContextMemory();
    let targetScope: NormalizedAnalysisScope;
    let targetRoot: HistoryRootContext;
    let memory: NavigationContextMemory;

    if (sourceScope.time.kind === "month") {
      const transfer = transferMonthToGlobal({
        sourceScope,
        targetWindow,
        asOf: sourceScope.time.month,
        compatibility: this.deps.compatibility,
        memory: currentMemory,
      });
      targetScope = transfer.targetScope;
      targetRoot = transfer.targetRoot;
      memory = transfer.memory;
    } else {
      if (
        sourceScope.time.observationWindow === targetWindow &&
        this.requireState().exploration === null
      ) {
        return noop("same_target");
      }
      targetScope = parseNormalizedAnalysisScope({
        subject: sourceScope.subject,
        time: {
          kind: "global",
          observationWindow: targetWindow,
          asOf: sourceScope.time.asOf,
        },
        filters: {
          categoryIds: this.deps.compatibility.categoryIds
            ? sourceScope.filters.categoryIds
            : [],
          activityIds: this.deps.compatibility.activityIds
            ? sourceScope.filters.activityIds
            : [],
          merchantIds: [],
          placeIds: [],
          lifeScopeContext: [],
          dayContext: [],
        },
      });
      targetRoot = {
        area: "analysis",
        context: {
          kind: "analysis_global",
          observationWindow: targetWindow,
          asOf: sourceScope.time.asOf,
        },
      };
      memory = navigationContextMemorySchema.parse({
        ...currentMemory,
        lastGlobalWindow: targetWindow,
      });
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(targetRoot, "push");
    this.deps.surface.applyScope(targetScope);
    this.deps.surface.applySubview(null);
    this.deps.session.setContextMemory(memory);
    return this.restoreScroll({ kind: "analysis_mode_switch" });
  }

  goToOperations(
    filters: OperationsNavigationFilters,
  ): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const parsedFilters = operationsNavigationFiltersSchema.safeParse(filters);
    if (!parsedFilters.success) return rejected("invalid_operations_filters");

    const current = this.requireState();
    const checkpoint = this.createCheckpoint();
    const returnDestination: ReturnDestination =
      current.exploration === null
        ? { kind: "root", checkpoint }
        : {
            kind: "exploration",
            checkpoint,
            node: getCurrentNode(current.exploration),
          };
    const intent = buildOperationsIntent(
      parsedFilters.data,
      returnDestination,
    );

    this.beginNavigation();
    this.persistCurrentCheckpoint(checkpoint);
    this.closeActiveGeneration();
    this.deps.session.setReturnDestination(intent.returnDestination);
    this.commitRoot(
      { kind: "operations", filters: intent.filters },
      "push",
      checkpoint,
    );
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    return applied;
  }

  createCheckpoint(anchor?: SemanticAnchor): NavigationCheckpoint {
    const current = this.requireState();
    const parsedAnchor =
      anchor === undefined ? undefined : semanticAnchorSchema.parse(anchor);
    const container = scrollContainerFor(current.root);
    const scrollY = this.deps.scroll.getScrollY(container);
    let anchorOffset: number | undefined;

    if (parsedAnchor !== undefined && this.deps.anchors !== undefined) {
      const element = this.deps.anchors.resolve(parsedAnchor);
      if (element !== null) {
        const anchorTop = this.deps.scroll.getAnchorTop(container, element);
        if (Number.isFinite(anchorTop)) anchorOffset = scrollY - anchorTop;
      }
    }

    const scope = this.readScope();
    const subview = this.deps.surface.readSubview();
    const filters =
      scope !== null
        ? { kind: "analysis" as const, value: scope.filters }
        : "kind" in current.root
          ? { kind: "operations" as const, value: current.root.filters }
          : undefined;

    return navigationCheckpointSchema.parse({
      version: navigationCheckpointVersion,
      route: current.root,
      ...(scope === null ? {} : { scope }),
      ...(filters === undefined ? {} : { filters }),
      ...(subview === null ? {} : { subview }),
      ...(parsedAnchor === undefined ? {} : { anchor: parsedAnchor }),
      ...(anchorOffset === undefined ? {} : { anchorOffset }),
      scrollFallbackY: scrollY,
    });
  }

  async restoreCheckpoint(checkpoint: unknown): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const parsed = navigationCheckpointSchema.safeParse(checkpoint);
    if (!parsed.success) return rejected("invalid_checkpoint");

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(parsed.data.route, "push", parsed.data);
    this.applyCheckpointState(parsed.data);
    return this.restoreScroll({ kind: "checkpoint_restore" }, parsed.data);
  }

  showDayFromExploration(day: LocalDate): NavigationCommandResult {
    if (!this.isStarted()) return noop("not_started");
    const current = this.requireState();
    if (current.exploration === null) return rejected("missing_place_origin");
    const node = getCurrentNode(current.exploration);
    if (node.kind !== "place") return rejected("missing_place_origin");

    const checkpoint = this.createCheckpoint();
    const intent = buildShowDayIntent(day, checkpoint, node);
    this.beginNavigation();
    this.persistCurrentCheckpoint(checkpoint);
    this.closeActiveGeneration();
    this.deps.session.setReturnDestination(intent.returnDestination);
    this.commitRoot(intent.targetRoot, "push", checkpoint);
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    this.rememberRoot(intent.targetRoot);
    return applied;
  }

  async returnToOrigin(): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const destination = this.deps.session.getReturnDestination();
    if (destination === null) return rejected("missing_return_destination");

    if (destination.kind === "root") {
      this.deps.session.setReturnDestination(null);
      return this.restoreCheckpoint(destination.checkpoint);
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(
      destination.checkpoint.route,
      "push",
      destination.checkpoint,
    );
    this.applyCheckpointState(destination.checkpoint);
    const state = createOpenExplorationHistoryState({
      current: this.requireState(),
      entryId: this.nextEntryId(),
      generation: this.nextGeneration(),
      rootCheckpoint: destination.checkpoint,
      node: destination.node,
    });
    this.deps.history.push(state, serializeRootNavigation(state.root));
    this.currentState = state;
    this.deps.session.setReturnDestination(null);
    return applied;
  }

  async goToAnalysis(): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const root = this.requireState().root;
    if (!("area" in root) || root.area !== "calendar") {
      return rejected("not_calendar_context");
    }
    const transfer = transferCalendarToAnalysis(
      root.context,
      this.deps.session.getContextMemory(),
    );
    if (transfer.kind === "missing_calendar_month") {
      this.deps.session.setContextMemory(transfer.memory);
      return rejected("missing_calendar_month");
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(transfer.targetRoot, "push");
    this.deps.session.setContextMemory(transfer.memory);
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    return this.restoreScroll({ kind: "voluntary_month_navigation" });
  }

  async goToCalendar(): Promise<NavigationCommandResult> {
    if (!this.isStarted()) return noop("not_started");
    const root = this.requireState().root;
    if (!("area" in root) || root.area !== "analysis") {
      return rejected("not_analysis_context");
    }
    const transfer = transferAnalysisToCalendar(
      root.context,
      this.deps.session.getContextMemory(),
    );
    if (transfer.kind === "missing_last_calendar_context") {
      return rejected("missing_last_calendar_context");
    }

    this.beginNavigation();
    this.captureCurrentSnapshot();
    this.closeActiveGeneration();
    this.commitRoot(transfer.targetRoot, "push");
    this.deps.session.setContextMemory(transfer.memory);
    this.deps.surface.applyScope(null);
    this.deps.surface.applySubview(null);
    return applied;
  }

  private isStarted(): boolean {
    return this.unsubscribeHistory !== null && this.currentState !== null;
  }

  private requireState(): NavigationHistoryState {
    if (this.currentState === null) {
      throw new Error("NavigationController doit être démarré.");
    }
    return this.currentState;
  }

  private nextEntryId(): NavigationHistoryState["entryId"] {
    this.entrySequence += 1;
    return `navigation-controller:${this.entrySequence}` as NavigationHistoryState["entryId"];
  }

  private syncLatestGeneration(state: NavigationHistoryState): void {
    const candidates = [
      ...this.deps.session.getClosedGenerations(),
      ...(state.generation === undefined ? [] : [state.generation]),
    ];
    if (candidates.length === 0) return;
    this.latestGeneration = parseExplorationGeneration(Math.max(...candidates));
  }

  private nextGeneration(): ExplorationGeneration {
    this.latestGeneration = createNextGeneration(this.latestGeneration);
    return this.latestGeneration;
  }

  private createRootState(
    rootInput: RootNavigationContext,
    checkpoint?: NavigationCheckpoint,
  ): NavigationHistoryState {
    const root = rootNavigationContextSchema.parse(rootInput);
    return navigationHistoryStateSchema.parse({
      version: navigationHistoryVersion,
      entryId: this.nextEntryId(),
      root,
      exploration: null,
      day: getRootNavigationDay(root),
      ...(checkpoint === undefined ? {} : { checkpoint }),
    });
  }

  private beginNavigation(): void {
    this.deps.restoration.cancel();
  }

  private commitRoot(
    rootInput: RootNavigationContext,
    mode: "push" | "replace",
    checkpoint?: NavigationCheckpoint,
  ): NavigationHistoryState {
    const root = rootNavigationContextSchema.parse(rootInput);
    if (mode === "push") this.deps.router.push(root);
    else this.deps.router.replace(root);
    const state = this.createRootState(root, checkpoint);
    this.deps.history.replace(state, serializeRootNavigation(root));
    this.currentState = state;
    return state;
  }

  private persistCurrentCheckpoint(
    checkpoint: NavigationCheckpoint,
  ): NavigationHistoryState {
    const state = navigationHistoryStateSchema.parse({
      ...this.requireState(),
      checkpoint,
    });
    this.deps.history.replace(state, serializeRootNavigation(state.root));
    this.currentState = state;
    this.rememberScroll(checkpoint);
    return state;
  }

  private captureCurrentSnapshot(): NavigationCheckpoint {
    const checkpoint = this.createCheckpoint();
    this.persistCurrentCheckpoint(checkpoint);
    return checkpoint;
  }

  private closeActiveGeneration(): void {
    const generation = this.requireState().generation;
    if (generation === undefined) return;
    const closed = this.deps.session.getClosedGenerations();
    this.deps.session.setClosedGenerations([...closed, generation]);
  }

  private readScope(): NormalizedAnalysisScope | null {
    const scope = this.deps.surface.readScope();
    return scope === null ? null : parseNormalizedAnalysisScope(scope);
  }

  private applyCheckpointState(checkpoint: NavigationCheckpoint): void {
    this.deps.surface.applyScope(checkpoint.scope ?? null);
    this.deps.surface.applySubview(checkpoint.subview ?? null);
    this.rememberRoot(checkpoint.route);
  }

  private rememberRoot(root: RootNavigationContext): void {
    const current = this.deps.session.getContextMemory();
    if ("area" in root && root.area === "calendar") {
      this.deps.session.setContextMemory({
        ...current,
        lastCalendarContext: root.context,
      });
      return;
    }
    if ("area" in root && root.area === "analysis") {
      this.deps.session.setContextMemory(
        root.context.kind === "analysis_month"
          ? { ...current, lastAnalysedMonth: root.context.month }
          : {
              ...current,
              lastGlobalWindow: root.context.observationWindow,
            },
      );
    }
  }

  private rememberScroll(checkpoint: NavigationCheckpoint): void {
    const context = scrollContextFor(checkpoint.route);
    const memory = scrollMemoryFromCheckpoint(checkpoint);
    if (context !== null && memory !== null) {
      this.deps.session.setScrollMemory(context, memory);
    }
  }

  private checkpointFromMemory(
    root: RootNavigationContext,
    memory: ScrollMemory,
  ): NavigationCheckpoint {
    const scope = this.readScope();
    return navigationCheckpointSchema.parse({
      version: navigationCheckpointVersion,
      route: root,
      ...(scope === null ? {} : { scope }),
      ...(memory.anchor === undefined ? {} : { anchor: memory.anchor }),
      ...(memory.anchorOffset === undefined
        ? {}
        : { anchorOffset: memory.anchorOffset }),
      scrollFallbackY: memory.scrollY,
    });
  }

  private async restoreScroll(
    cause: NavigationRestorationCause,
    snapshot?: NavigationCheckpoint,
  ): Promise<NavigationCommandResult> {
    const root = snapshot?.route ?? this.requireState().root;
    let checkpoint: NavigationCheckpoint;

    if (cause.kind === "checkpoint_restore" && snapshot !== undefined) {
      checkpoint = snapshot;
    } else {
      const context = scrollContextFor(root);
      const sessionMemory =
        context === null ? null : this.deps.session.getScrollMemory(context);
      const snapshotMemory =
        snapshot === undefined ? null : scrollMemoryFromCheckpoint(snapshot);
      const selection = selectScrollRestoration(
        cause,
        sessionMemory,
        snapshotMemory,
      );
      checkpoint =
        selection.kind === "memory"
          ? this.checkpointFromMemory(root, selection.memory)
          : navigationCheckpointSchema.parse({
              version: navigationCheckpointVersion,
              route: root,
            });
    }

    const outcome = await this.deps.restoration.restore({
      checkpoint,
      container: scrollContainerFor(root),
      readiness: this.deps.readiness.wait(checkpoint),
    });
    return outcome.kind === "cancelled"
      ? noop("restoration_cancelled")
      : applied;
  }

  private scheduleRestoration(
    restoration: Promise<NavigationCommandResult>,
  ): void {
    void restoration.catch((error: unknown) => this.deps.onError?.(error));
  }

  private handlePopState(rawState: unknown): void {
    try {
      this.beginNavigation();
      const root = rootNavigationContextSchema.parse(this.deps.router.read());
      const resolution = resolveNavigationHistoryState(
        rawState,
        this.deps.session.getClosedGenerations(),
        root,
      );

      if (resolution.kind === "restore") {
        this.currentState = resolution.state;
        this.syncLatestGeneration(resolution.state);
        const checkpoint =
          resolution.state.checkpoint ??
          resolution.state.exploration?.rootCheckpoint;
        if (checkpoint !== undefined) {
          this.applyCheckpointState(checkpoint);
          this.scheduleRestoration(
            this.restoreScroll({ kind: "browser_history" }, checkpoint),
          );
        } else {
          this.rememberRoot(resolution.state.root);
        }
        return;
      }

      if (resolution.reason === "closed-generation") {
        const state = this.createRootState(
          resolution.root,
          resolution.checkpoint,
        );
        this.deps.router.replace(resolution.root);
        this.deps.history.replace(
          state,
          serializeRootNavigation(resolution.root),
        );
        this.currentState = state;
        this.applyCheckpointState(resolution.checkpoint);
        this.scheduleRestoration(
          this.restoreScroll(
            { kind: "checkpoint_restore" },
            resolution.checkpoint,
          ),
        );
        return;
      }

      const state = this.createRootState(root);
      this.deps.history.replace(state, serializeRootNavigation(root));
      this.currentState = state;
      this.deps.surface.applyScope(null);
      this.deps.surface.applySubview(null);
      this.rememberRoot(root);
    } catch (error) {
      this.deps.onError?.(error);
    }
  }
}

export function createNavigationController(
  deps: NavigationControllerDeps,
): NavigationController {
  return new DefaultNavigationController(deps);
}
