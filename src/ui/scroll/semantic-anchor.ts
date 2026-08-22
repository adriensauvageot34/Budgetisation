"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";
import type { AnchorRegistry, SemanticAnchor } from "../../navigation";

export type SemanticAnchorTargetProps = {
  readonly anchor: SemanticAnchor;
  readonly registry: AnchorRegistry;
  readonly children: ReactNode;
  readonly className?: string;
};

export function SemanticAnchorTarget({
  anchor,
  registry,
  children,
  className,
}: SemanticAnchorTargetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    return element ? registry.register(anchor, element) : undefined;
  }, [anchor, registry]);

  return createElement(
    "div",
    { ref, className, "data-semantic-anchor": anchor.moduleId },
    children,
  );
}
