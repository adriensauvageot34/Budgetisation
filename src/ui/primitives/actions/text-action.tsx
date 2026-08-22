"use client";

import type { ReactNode } from "react";
import { invokeUiAction, type UiAction } from "./ui-action";

export type TextActionProps<NavigationIntent = never> = {
  readonly children: ReactNode;
  readonly action: UiAction<NavigationIntent>;
  readonly className?: string;
};

export function TextAction<NavigationIntent = never>({
  children,
  action,
  className,
}: TextActionProps<NavigationIntent>) {
  const disabled = action.kind === "disabled";
  return (
    <button
      type="button"
      className={["ui-text-action ui-focusable", className].filter(Boolean).join(" ")}
      disabled={disabled}
      title={disabled ? action.reason : undefined}
      onClick={disabled ? undefined : () => invokeUiAction(action)}
    >
      {children}
    </button>
  );
}
