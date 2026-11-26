"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";


type Density = 0 | 1 | 2 | 3 | 4;

export function DensityAtom({ name, priority, minimum = 0, className, motionClassName, children }: {
  readonly name: string;
  readonly priority: number;
  readonly minimum?: Density;
  readonly className: string;
  readonly motionClassName: string;
  readonly children: ReactNode;
}) {
  return <div className={className} data-balance-atom={name} data-priority={priority}
    data-minimum={minimum} data-density={Math.max(2, minimum)}>
    <div className={motionClassName}>{children}</div>
  </div>;
}

export function useContentDensity() {
  const region = useRef<HTMLElement>(null);
  const flow = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = region.current;
    const content = flow.current;
    if (!container || !content) return;

    let frame = 0;
    let positions = new Map<HTMLElement, number>();
    const observed = new Set<HTMLElement>();
    const resize = new ResizeObserver(schedule);
    const mutation = new MutationObserver(schedule);

    function schedule() {
      if (!frame) frame = requestAnimationFrame(fit);
    }

    function fit() {
      frame = 0;
      const atoms = [...content!.querySelectorAll<HTMLElement>(":scope > [data-balance-atom]")]
        .toSorted((a, b) => Number(b.dataset.priority) - Number(a.dataset.priority));
      for (const node of observed) {
        if (!node.isConnected) {
          resize.unobserve(node);
          observed.delete(node);
        }
      }
      const style = getComputedStyle(container!);
      const available = container!.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      for (const node of atoms) {
        if (!observed.has(node)) {
          resize.observe(node);
          observed.add(node);
        }
        node.dataset.density = node.dataset.minimum ?? "0";
      }

      for (let target = 1; target <= 4; target++) {
        for (const node of atoms) {
          const previous = Number(node.dataset.density);
          if (previous !== target - 1) continue;
          node.dataset.density = String(target);
          if (content!.offsetHeight > available) node.dataset.density = String(previous);
        }
      }

      const nextPositions = new Map<HTMLElement, number>();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (const node of atoms) {
        if (node.dataset.density === "0") continue;
        const top = node.getBoundingClientRect().top;
        const previous = positions.get(node);
        nextPositions.set(node, top);
        if (reduced || previous === undefined || Math.abs(previous - top) < 2 || Math.abs(previous - top) > 160) continue;
        const child = node.firstElementChild;
        child?.getAnimations().forEach(animation => animation.cancel());
        child?.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "none" }],
          { duration: 200, easing: "cubic-bezier(.22,.75,.22,1)" });
      }
      positions = nextPositions;
    }

    resize.observe(container);
    mutation.observe(content, { childList: true, subtree: true, characterData: true });
    fit();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);
  return { region, flow };
}
