"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "../../accessibility";
import { IconButton } from "../../primitives";

export type ContentRailItem = {
  readonly key: string;
  readonly content: ReactNode;
};

export type ContentRailProps = {
  readonly label: string;
  readonly items: readonly ContentRailItem[];
  readonly mode?: "row" | "rail";
};

export function ContentRail({ label, items, mode = "row" }: ContentRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;
  const resolvedMode = items.length >= 4 && mode === "rail" ? "rail" : "row";
  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(240, rail.clientWidth * 0.8),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  return (
    <section className="ui-content-rail-frame" aria-label={label}>
      {resolvedMode === "rail" ? (
        <div className="ui-content-rail-actions">
          <IconButton icon={ChevronLeft} label={`Précédent — ${label}`} action={{ kind: "callback", onAction: () => move(-1) }} />
          <IconButton icon={ChevronRight} label={`Suivant — ${label}`} action={{ kind: "callback", onAction: () => move(1) }} />
        </div>
      ) : null}
      <div
        ref={railRef}
        className="ui-content-rail"
        data-mode={resolvedMode}
        data-count={items.length}
      >
        {items.map((item) => <div key={item.key}>{item.content}</div>)}
      </div>
    </section>
  );
}
