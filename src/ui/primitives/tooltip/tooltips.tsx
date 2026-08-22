"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { requireAccessibleName } from "../../accessibility";
import { closeTooltipOnEscape } from "../../interaction";

export type InfoTooltipProps = {
  readonly label: string;
  readonly children: ReactNode;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const accessibleLabel = requireAccessibleName(label, "InfoTooltip");
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (closeTooltipOnEscape(event.key, () => {
      if (ref.current) ref.current.open = false;
    })) event.stopPropagation();
  };
  return (
    <details ref={ref} className="ui-info-tooltip" onKeyDown={onKeyDown}>
      <summary className="ui-focusable">{accessibleLabel}</summary>
      <div role="tooltip">{children}</div>
    </details>
  );
}

export type ChartTooltipProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly onDismiss?: () => void;
};

export function ChartTooltip({ label, children, onDismiss }: ChartTooltipProps) {
  const accessibleLabel = requireAccessibleName(label, "ChartTooltip");
  return (
    <div
      className="ui-chart-tooltip ui-focusable"
      role="tooltip"
      aria-label={accessibleLabel}
      tabIndex={0}
      onKeyDown={(event) => {
        if (onDismiss && closeTooltipOnEscape(event.key, onDismiss)) {
          event.stopPropagation();
        }
      }}
    >
      <strong>{accessibleLabel}</strong>
      <div>{children}</div>
    </div>
  );
}

export function DisabledReason({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return <p id={id} className="ui-disabled-reason">{children}</p>;
}
