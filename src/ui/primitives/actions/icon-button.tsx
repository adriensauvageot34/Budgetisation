"use client";

import type { LucideIcon } from "lucide-react";
import { requireAccessibleName } from "../../accessibility";
import { Icon } from "../../foundations";
import { hasConsultableDisabledReason, resolvePersistentInteractiveState } from "../../interaction";
import { invokeUiAction, type UiAction } from "./ui-action";
import type { ActionSize, ActionTone } from "./button";

export type IconButtonProps<NavigationIntent = never> = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly action: UiAction<NavigationIntent>;
  readonly tone?: ActionTone;
  readonly size?: ActionSize;
  readonly className?: string;
  readonly disabledReasonId?: string;
};

export function IconButton<NavigationIntent = never>({
  icon,
  label,
  action,
  tone = "quiet",
  size = "md",
  className,
  disabledReasonId,
}: IconButtonProps<NavigationIntent>) {
  const accessibleLabel = requireAccessibleName(label, "IconButton");
  const disabled = action.kind === "disabled";
  const loading = action.kind === "loading";
  const unavailable = disabled || loading;
  const consultableReason = disabled && hasConsultableDisabledReason({
    disabled: true,
    ...(action.reason === undefined ? {} : { reason: action.reason }),
  });
  return (
    <button
      className={["ui-action ui-icon-button ui-focusable", className]
        .filter(Boolean)
        .join(" ")}
      type="button"
      data-tone={tone}
      data-size={size}
      data-state={resolvePersistentInteractiveState({ disabled, loading })}
      aria-label={loading ? `${accessibleLabel}, ${action.label ?? "en cours"}` : accessibleLabel}
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
      <Icon icon={icon} size={size} decorative />
    </button>
  );
}
