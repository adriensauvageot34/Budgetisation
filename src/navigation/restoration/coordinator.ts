import { navigationCheckpointSchema } from "../contracts/checkpoint";
import {
  restorationReadinessSchema,
  scrollContainerRefSchema,
  type RestorationIntent,
  type RestorationOutcome,
} from "../contracts/restoration";
import type { AnchorRegistry } from "./anchor-registry";
import type { ScrollAdapter } from "./scroll-adapter";

const focusableAnchorTarget = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function restoreAnchorFocus(anchor: HTMLElement): void {
  const target = anchor.matches(focusableAnchorTarget)
    ? anchor
    : anchor.querySelector<HTMLElement>(focusableAnchorTarget);
  if (target?.isConnected) target.focus({ preventScroll: true });
}

export class RestorationCoordinator {
  private restorationGeneration = 0;

  constructor(
    private readonly anchors: AnchorRegistry,
    private readonly scroll: ScrollAdapter,
  ) {}

  cancel(): void {
    this.restorationGeneration += 1;
  }

  async restore(intent: RestorationIntent): Promise<RestorationOutcome> {
    const generation = this.restorationGeneration + 1;
    this.restorationGeneration = generation;
    const checkpoint = navigationCheckpointSchema.parse(intent.checkpoint);
    const container = scrollContainerRefSchema.parse(intent.container);
    const readiness = restorationReadinessSchema.parse(await intent.readiness);

    if (
      generation !== this.restorationGeneration ||
      readiness.kind === "cancelled"
    ) {
      return { kind: "cancelled" };
    }

    if (readiness.kind === "ready" && checkpoint.anchor !== undefined) {
      const element = this.anchors.resolve(checkpoint.anchor);
      if (element !== null) {
        const anchorTop = this.scroll.getAnchorTop(container, element);
        const target = anchorTop + (checkpoint.anchorOffset ?? 0);
        if (Number.isFinite(target)) {
          if (generation !== this.restorationGeneration) {
            return { kind: "cancelled" };
          }
          this.scroll.scrollTo(container, target);
          restoreAnchorFocus(element);
          return { kind: "anchor", scrollY: target };
        }
      }
    }

    if (generation !== this.restorationGeneration) {
      return { kind: "cancelled" };
    }
    if (checkpoint.scrollFallbackY !== undefined) {
      this.scroll.scrollTo(container, checkpoint.scrollFallbackY);
      return { kind: "fallback", scrollY: checkpoint.scrollFallbackY };
    }

    this.scroll.scrollTo(container, 0);
    return { kind: "top", scrollY: 0 };
  }
}
