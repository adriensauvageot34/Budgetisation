import type { ReactNode } from "react";
import type {
  ExplorationNode,
  ExplorationStack as NavigationExplorationStack,
} from "../../../navigation";
import { Button, type UiAction } from "../../primitives";

export type OverlayFrameProps = {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function OverlayFrame({ header, children, className }: OverlayFrameProps) {
  return (
    <section className={["ui-overlay-frame", className].filter(Boolean).join(" ")} data-overlay-shell="">
      {header}
      <div className="ui-overlay-content">{children}</div>
    </section>
  );
}

export function OverlayHeader({
  title,
  subtitle,
  closeAction,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly closeAction?: UiAction;
}) {
  return (
    <header className="ui-overlay-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {closeAction ? <Button action={closeAction} tone="quiet">Fermer</Button> : null}
    </header>
  );
}

export function projectExplorationPanels(
  stack: NavigationExplorationStack,
): readonly ExplorationNode[] {
  return stack.length <= 2 ? [...stack] : stack.slice(-2);
}

export function ExplorationStack({
  stack,
  renderNode,
}: {
  readonly stack: NavigationExplorationStack;
  readonly renderNode: (node: ExplorationNode, index: number) => ReactNode;
}) {
  const panels = projectExplorationPanels(stack);
  return (
    <div className="ui-exploration-stack" data-visible-depth={panels.length}>
      {panels.map((node, index) => (
        <section key={`${node.kind}-${index}`} data-exploration-kind={node.kind}>
          {renderNode(node, index)}
        </section>
      ))}
    </div>
  );
}
