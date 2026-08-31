"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { suspendElement } from "../accessibility";
import { invokeUiAction, type UiAction } from "../primitives";
import { activateOverlayFocusTrap, focusOverlayInitialTarget } from "./overlay-focus";
import {
  captureFocusRestorationTarget,
  scheduleOverlayFocusRestoration,
} from "./overlay-restoration";
import { acquireOverlayScrollLock } from "./overlay-scroll-lock";
import { OverlayHeader } from "./overlay-header";

export const overlayKinds = ["exploration", "day_drawer", "operation_root"] as const;
export type OverlayKind = (typeof overlayKinds)[number];

export type OverlayFrameProps<NavigationIntent = never> = {
  readonly title: string;
  readonly subtitle?: string;
  readonly label?: string;
  readonly kind: OverlayKind;
  readonly children: ReactNode;
  readonly closeAction: UiAction<NavigationIntent>;
  readonly backAction?: UiAction<NavigationIntent>;
  readonly open?: boolean;
  readonly topmost?: boolean;
  readonly suspended?: boolean;
  readonly className?: string;
  readonly backgroundRootRef?: RefObject<HTMLElement | null>;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly restoreFocusRef?: RefObject<HTMLElement | null>;
  readonly semanticFallbackRef?: RefObject<HTMLElement | null>;
  readonly closeOnBackdrop?: boolean;
};

export function OverlayFrame<NavigationIntent = never>({
  title,
  subtitle,
  label,
  kind,
  children,
  closeAction,
  backAction,
  open = true,
  topmost = true,
  suspended = false,
  className,
  backgroundRootRef,
  initialFocusRef,
  restoreFocusRef,
  semanticFallbackRef,
  closeOnBackdrop = false,
}: OverlayFrameProps<NavigationIntent>) {
  const generatedTitleId = useId();
  const titleId = `ui-overlay-title-${generatedTitleId}`;
  const frameRef = useRef<HTMLElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    invokerRef.current = captureFocusRestorationTarget();
    const releaseScrollLock = acquireOverlayScrollLock();
    const restoreRoot = backgroundRootRef?.current
      ? suspendElement(backgroundRootRef.current)
      : undefined;
    return () => {
      const contentFallback = backgroundRootRef?.current?.querySelector<HTMLElement>(
        "[data-focus-restoration-fallback], [data-semantic-anchor], h1",
      );
      restoreRoot?.();
      releaseScrollLock();
      scheduleOverlayFocusRestoration({
        invoker: restoreFocusRef?.current ?? invokerRef.current,
        semanticFallback: semanticFallbackRef?.current,
        contentFallback,
      });
    };
  }, [open, backgroundRootRef, restoreFocusRef, semanticFallbackRef]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame || !suspended) return;
    return suspendElement(frame);
  }, [open, suspended]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !topmost || suspended || !frame) return;
    const releaseTrap = activateOverlayFocusTrap(frame);
    focusOverlayInitialTarget(frame, initialFocusRef?.current);
    return releaseTrap;
  }, [open, topmost, suspended, initialFocusRef]);

  if (!open) return null;
  const unavailableClose = closeAction.kind === "disabled" || closeAction.kind === "loading";
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || !topmost || suspended) return;
    if (unavailableClose) return;
    event.preventDefault();
    event.stopPropagation();
    if (closeAction.kind === "callback" || closeAction.kind === "navigation") {
      invokeUiAction(closeAction);
    }
  };

  return (
    <div
      className="ui-overlay-backdrop"
      data-overlay-layer=""
      data-topmost={topmost || undefined}
      data-suspended={suspended || undefined}
      onMouseDown={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget || unavailableClose) return;
        if (closeAction.kind === "callback" || closeAction.kind === "navigation") invokeUiAction(closeAction);
      }}
    >
      <section
        ref={frameRef}
        className={["ui-overlay-frame", className].filter(Boolean).join(" ")}
        data-overlay-shell=""
        data-overlay-kind={kind}
        data-topmost={topmost || undefined}
        role="dialog"
        aria-modal={topmost && !suspended ? true : undefined}
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <OverlayHeader
          title={title}
          titleId={titleId}
          subtitle={subtitle}
          closeAction={closeAction}
          backAction={backAction}
        />
        <div className="ui-overlay-content" data-overlay-content="" tabIndex={-1}>
          {children}
        </div>
      </section>
    </div>
  );
}
