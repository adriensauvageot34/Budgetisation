"use client";

import type { ReactNode } from "react";
import { hasConsultableDisabledReason, resolvePersistentInteractiveState } from "../../interaction";
import { invokeUiAction, type UiAction } from "./ui-action";

export type TextActionProps<NavigationIntent = never> = {
  readonly children: ReactNode;
  readonly action: UiAction<NavigationIntent>;
  readonly className?: string;
  readonly disabledReasonId?: string;
};

export function TextAction<NavigationIntent = never>({
  children,
  action,
  className,
  disabledReasonId,
}: TextActionProps<NavigationIntent>) {
  const disabled = action.kind === "disabled";
  const loading = action.kind === "loading";
  const unavailable = disabled || loading;
  const consultableReason = disabled && hasConsultableDisabledReason({
    disabled: true,
    ...(action.reason === undefined ? {} : { reason: action.reason }),
  });
  return (
    <button
      type="button"
      className={["ui-text-action ui-focusable", className].filter(Boolean).join(" ")}
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
      {loading ? ` — ${action.label ?? "En cours…"}` : null}
    </button>
  );
}
