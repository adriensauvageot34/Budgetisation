import {
  normalizeAnalysisScope,
  type AnalysisFilters,
  type NormalizedAnalysisScope,
} from "../../core/scope";
import type { RootNavigationContext } from "../contracts/routes";

export function operationsAnalysisFilters(
  root: Extract<RootNavigationContext, { readonly kind: "operations" }>,
): AnalysisFilters | undefined {
  const filters: AnalysisFilters = {
    ...(root.filters.categoryIds === undefined
      ? {}
      : { categoryIds: root.filters.categoryIds }),
    ...(root.filters.activityIds === undefined
      ? {}
      : { activityIds: root.filters.activityIds }),
    ...(root.filters.merchantIds === undefined
      ? {}
      : { merchantIds: root.filters.merchantIds }),
    ...(root.filters.placeIds === undefined
      ? {}
      : { placeIds: root.filters.placeIds }),
    ...(root.filters.lifeScope === undefined
      ? {}
      : { lifeScopeContext: root.filters.lifeScope }),
    ...(root.filters.dayContext === undefined
      ? {}
      : { dayContext: root.filters.dayContext }),
  };
  return Object.keys(filters).length === 0 ? undefined : filters;
}

export function scopeForRoot(
  root: RootNavigationContext,
): NormalizedAnalysisScope | null {
  if ("kind" in root) {
    const subject = root.filters.personId
      ? { kind: "person" as const, personId: root.filters.personId }
      : { kind: "household" as const };
    const filters = operationsAnalysisFilters(root);
    if (
      root.filters.timeKind === "global_window" &&
      root.filters.globalWindow !== undefined &&
      root.filters.asOf !== undefined
    ) {
      return normalizeAnalysisScope({
        subject,
        time: {
          kind: "global",
          observationWindow: root.filters.globalWindow,
          asOf: root.filters.asOf,
        },
        ...(filters === undefined ? {} : { filters }),
      });
    }
    if (
      (root.filters.timeKind === "bank_month" ||
        root.filters.timeKind === "economic_month") &&
      root.filters.month !== undefined
    ) {
      return normalizeAnalysisScope({
        subject,
        time: { kind: "month", month: root.filters.month },
        ...(filters === undefined ? {} : { filters }),
      });
    }
    return null;
  }

  if (root.area === "calendar") {
    if (root.context.kind === "calendar_overview") return null;
    return normalizeAnalysisScope({
      subject: root.context.personId
        ? { kind: "person", personId: root.context.personId }
        : { kind: "household" },
      time: { kind: "month", month: root.context.month },
    });
  }

  const subject = root.context.personId
    ? { kind: "person" as const, personId: root.context.personId }
    : { kind: "household" as const };
  if (root.context.kind === "analysis_month") {
    return normalizeAnalysisScope({
      subject,
      time: { kind: "month", month: root.context.month },
      ...(root.context.filters === undefined
        ? {}
        : { filters: root.context.filters }),
    });
  }
  if (root.context.asOf === undefined) return null;
  return normalizeAnalysisScope({
    subject,
    time: {
      kind: "global",
      observationWindow: root.context.observationWindow,
      asOf: root.context.asOf,
    },
    ...(root.context.filters === undefined
      ? {}
      : { filters: root.context.filters }),
  });
}

export type ExplorationScopePreparation =
  | { readonly kind: "inactive" }
  | { readonly kind: "invalid_scope" }
  | {
      readonly kind: "ready";
      readonly scope: NormalizedAnalysisScope;
    };

export function prepareExplorationScope(input: {
  readonly root: RootNavigationContext;
  readonly registeredScope: NormalizedAnalysisScope | null;
  readonly explorationRequested: boolean;
}): ExplorationScopePreparation {
  if (!input.explorationRequested) return { kind: "inactive" };
  const scope = input.registeredScope ?? scopeForRoot(input.root);
  return scope === null
    ? { kind: "invalid_scope" }
    : { kind: "ready", scope };
}
