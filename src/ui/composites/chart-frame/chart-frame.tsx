"use client";

import { useId, type ReactNode } from "react";
import type { ApiError } from "../../../core/api";
import type { ExplorationNode } from "../../../navigation";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  RefreshIndicator,
} from "../../feedback";
import { Button, type UiAction } from "../../primitives";

export type ChartFrameState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | {
      readonly kind: "filtered_empty";
      readonly onEditFilters?: () => void;
      readonly onClearFilters?: () => void;
    }
  | { readonly kind: "error"; readonly error: ApiError; readonly onRetry?: () => void }
  | {
      readonly kind: "ready";
      readonly refreshing?: boolean;
      readonly refreshError?: ApiError;
    };

export type ChartFrameProps = {
  readonly title: string;
  readonly description?: string;
  readonly legend?: ReactNode;
  readonly toolbar?: ReactNode;
  readonly state: ChartFrameState;
  readonly summary: ReactNode;
  readonly methodologyAction?: UiAction<ExplorationNode>;
  readonly children: ReactNode;
};

export function ChartFrame({
  title,
  description,
  legend,
  toolbar,
  state,
  summary,
  methodologyAction,
  children,
}: ChartFrameProps) {
  const titleId = useId();
  const descriptionId = useId();
  let content: ReactNode;
  if (state.kind === "loading") content = <ChartSkeleton />;
  else if (state.kind === "empty") content = <EmptyState />;
  else if (state.kind === "filtered_empty") {
    content = (
      <FilteredEmptyState
        onEditFilters={state.onEditFilters}
        onClearFilters={state.onClearFilters}
      />
    );
  } else if (state.kind === "error") {
    content = <ErrorState error={state.error} onRetry={state.onRetry} />;
  } else {
    content = (
      <>
        {children}
        {state.refreshing ? <RefreshIndicator /> : null}
        {state.refreshError ? <RefreshIndicator failed /> : null}
      </>
    );
  }

  return (
    <section
      className="ui-chart-frame"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <header className="ui-chart-frame-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        {toolbar}
      </header>
      {legend ? <div className="ui-chart-legend">{legend}</div> : null}
      <div className="ui-chart-content">{content}</div>
      {state.kind === "ready" ? <div className="ui-chart-summary">{summary}</div> : null}
      {methodologyAction ? (
        <Button action={methodologyAction} tone="quiet" size="sm">
          Méthodologie
        </Button>
      ) : null}
    </section>
  );
}
