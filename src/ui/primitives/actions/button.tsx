"use client";

import type { ReactNode } from "react";
import { hasConsultableDisabledReason, resolvePersistentInteractiveState } from "../../interaction";
import { invokeUiAction, type UiAction } from "./ui-action";

export const actionTones = ["primary", "secondary", "quiet", "destructive"] as const;
export const actionSizes = ["sm", "md"] as const;
export type ActionTone = (typeof actionTones)[number];
export type ActionSize = (typeof actionSizes)[number];

export type ButtonProps<NavigationIntent = never> = {
  readonly children: ReactNode;
  readonly action: UiAction<NavigationIntent>;
  readonly tone?: ActionTone;
  readonly size?: ActionSize;
  readonly className?: string;
  readonly type?: "button" | "submit";
  readonly disabledReasonId?: string;
};

export function Button<NavigationIntent = never>({
  children,
  action,
  tone = "primary",
  size = "md",
  className,
  type = "button",
  disabledReasonId,
}: ButtonProps<NavigationIntent>) {
  const disabled = action.kind === "disabled";
  const loading = action.kind === "loading";
  const unavailable = disabled || loading;
  const consultableReason = disabled && hasConsultableDisabledReason({
    disabled: true,
    ...(action.reason === undefined ? {} : { reason: action.reason }),
  });
  return (
    <button
      className={["ui-action ui-focusable", className].filter(Boolean).join(" ")}
      type={type}
      data-tone={tone}
      data-size={size}
      data-state={resolvePersistentInteractiveState({ disabled, loading })}
      disabled={disabled && !consultableReason}
      aria-disabled={unavailable || undefined}
      aria-busy={loading || undefined}
      aria-describedby={consultableReason ? disabledReasonId : undefined}
      title={consultableReason ? action.reason : undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        if (action.kind === "callback" || action.kind === "navigation") {
          invokeUiAction(action);
        }
      }}
    >
      {children}
      {loading ? (
        <span className="ui-action-loading-label" role="status">
          {action.label ?? "En cours…"}
        </span>
      ) : null}
    </button>
  );
}
