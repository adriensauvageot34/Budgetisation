"use client";

import type { LucideIcon } from "lucide-react";
import { Icon } from "../../foundations";
import { invokeUiAction, type UiAction } from "./ui-action";
import type { ActionSize, ActionTone } from "./button";

export type IconButtonProps<NavigationIntent = never> = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly action: UiAction<NavigationIntent>;
  readonly tone?: ActionTone;
  readonly size?: ActionSize;
  readonly className?: string;
};

export function IconButton<NavigationIntent = never>({
  icon,
  label,
  action,
  tone = "quiet",
  size = "md",
  className,
}: IconButtonProps<NavigationIntent>) {
  if (label.trim() === "") {
    throw new TypeError("IconButton exige un label accessible non vide.");
  }
  const disabled = action.kind === "disabled";
  return (
    <button
      className={["ui-action ui-icon-button ui-focusable", className]
        .filter(Boolean)
        .join(" ")}
      type="button"
      data-tone={tone}
      data-size={size}
      aria-label={label}
      disabled={disabled}
      title={disabled ? action.reason : undefined}
      onClick={disabled ? undefined : () => invokeUiAction(action)}
    >
      <Icon icon={icon} size={size} decorative />
    </button>
  );
}
