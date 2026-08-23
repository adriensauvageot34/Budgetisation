"use client";

import type { RootNavigationContext } from "@/navigation";
import { useProductModuleReadiness } from "@/components/runtime";
import { ErrorState, RefreshIndicator, SectionSkeleton, type UiTransportState } from "@/ui";

export function AnalysisMonthModuleBoundary<T>({
  route,
  module,
  state,
  children,
}: {
  readonly route: RootNavigationContext;
  readonly module: "evolution" | "structure" | "lived" | "moments";
  readonly state: UiTransportState<T>;
  readonly children: (data: T) => React.ReactNode;
}) {
  const data = state.status === "success" ? state.response.data : state.status === "error" ? state.previousData?.data : undefined;
  const readiness = state.status === "idle" || state.status === "loading"
    ? "pending"
    : state.status === "error" && data === undefined
      ? "terminal_without_anchor"
      : "ready";
  useProductModuleReadiness(route, module, readiness);

  if (state.status === "idle" || state.status === "loading") return <SectionSkeleton />;
  if (state.status === "error" && data === undefined) return <ErrorState error={state.error} />;
  if (data === undefined) return null;
  return (
    <>
      {children(data)}
      {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : null}
      {state.status === "error" ? <RefreshIndicator failed announce /> : null}
    </>
  );
}
