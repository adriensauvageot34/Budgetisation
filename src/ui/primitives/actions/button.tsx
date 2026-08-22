"use client";

import type { ReactNode } from "react";
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
};

export function Button<NavigationIntent = never>({
  children,
  action,
  tone = "primary",
  size = "md",
  className,
  type = "button",
}: ButtonProps<NavigationIntent>) {
  const disabled = action.kind === "disabled";
  return (
    <button
      className={["ui-action ui-focusable", className].filter(Boolean).join(" ")}
      type={type}
      data-tone={tone}
      data-size={size}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? action.reason : undefined}
      onClick={disabled ? undefined : () => invokeUiAction(action)}
    >
      {children}
    </button>
  );
}
