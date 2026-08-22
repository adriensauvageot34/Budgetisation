"use client";

import type { ReactNode } from "react";
import { invokeUiAction, type UiAction } from "../actions";

export const surfaceVariants = ["plain", "subtle", "outlined", "raised"] as const;
export type SurfaceVariant = (typeof surfaceVariants)[number];

export type SurfaceProps<NavigationIntent = never> = {
  readonly children: ReactNode;
  readonly variant?: SurfaceVariant;
  readonly action?: UiAction<NavigationIntent>;
  readonly className?: string;
  readonly ariaLabel?: string;
};

export function Surface<NavigationIntent = never>({
  children,
  variant = "plain",
  action,
  className,
  ariaLabel,
}: SurfaceProps<NavigationIntent>) {
  const classes = [
    "ui-surface",
    action?.kind === "callback" || action?.kind === "navigation"
      ? "ui-surface-action ui-focusable"
      : "",
    className,
  ].filter(Boolean).join(" ");
  if (action?.kind === "callback" || action?.kind === "navigation") {
    return (
      <button
        type="button"
        className={classes}
        data-variant={variant}
        aria-label={ariaLabel}
        onClick={() => invokeUiAction(action)}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={classes}
      data-variant={variant}
      aria-label={ariaLabel}
      aria-disabled={action?.kind === "disabled" || undefined}
      title={action?.kind === "disabled" ? action.reason : undefined}
    >
      {children}
    </div>
  );
}

export type CardSurfaceProps<NavigationIntent = never> = SurfaceProps<NavigationIntent>;

export function CardSurface<NavigationIntent = never>(
  props: CardSurfaceProps<NavigationIntent>,
) {
  return <Surface {...props} className={["ui-card-surface", props.className].filter(Boolean).join(" ")} />;
}
