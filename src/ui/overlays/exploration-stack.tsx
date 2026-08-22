"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type {
  ExplorationNode,
  ExplorationStack as NavigationExplorationStack,
} from "../../navigation";
import { focusFirstAvailable } from "../accessibility";

export function projectExplorationPanels(
  stack: NavigationExplorationStack,
): readonly ExplorationNode[] {
  return [stack[stack.length - 1]!];
}
export type ExplorationStackProps = {
  readonly stack: NavigationExplorationStack;
  readonly renderNode: (node: ExplorationNode, index: number) => ReactNode;
  readonly semanticFallback?: HTMLElement | null;
};

export function ExplorationStack({
  stack,
  renderNode,
  semanticFallback,
}: ExplorationStackProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previousDepthRef = useRef(stack.length);
  const invokersRef = useRef(new Map<number, HTMLElement>());
  const current = stack[stack.length - 1]!;

  useEffect(() => {
    const previousDepth = previousDepthRef.current;
    if (stack.length > previousDepth && document.activeElement instanceof HTMLElement) {
      invokersRef.current.set(stack.length, document.activeElement);
      focusFirstAvailable([
        panelRef.current?.querySelector<HTMLElement>("[data-exploration-heading]"),
        panelRef.current,
      ]);
    } else if (stack.length < previousDepth) {
      focusFirstAvailable([
        invokersRef.current.get(previousDepth),
        semanticFallback,
        panelRef.current,
      ]);
      invokersRef.current.delete(previousDepth);
    }
    previousDepthRef.current = stack.length;
  }, [stack.length, semanticFallback]);

  return (
    <div className="ui-exploration-stack" data-stack-depth={stack.length}>
      <section
        ref={panelRef}
        key={`${current.kind}-${stack.length}`}
        data-exploration-kind={current.kind}
        data-exploration-current=""
        tabIndex={-1}
      >
        {renderNode(current, stack.length - 1)}
      </section>
    </div>
  );
}
