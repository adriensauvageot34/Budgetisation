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

export function useContentDensity(detailViewportSelector?: string, layoutRevision?: number) {
  const region = useRef<HTMLElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const fitLayout = useRef<() => void>(null);
  const animateAtoms = layoutRevision === undefined;

  useLayoutEffect(() => {
    const container = region.current;
    const content = flow.current;
    if (!container || !content) return;

    let frame = 0;
    let positions = new Map<HTMLElement, number>();
    const observed = new Set<HTMLElement>();
    const fittedSizes = new WeakMap<Element, readonly [number, number]>();
    const resize = new ResizeObserver(entries => {
      if (animateAtoms || entries.some(entry => {
        const fitted = fittedSizes.get(entry.target);
        const size = entry.borderBoxSize[0];
        return !fitted || !size || Math.abs(size.inlineSize - fitted[0]) > 1 || Math.abs(size.blockSize - fitted[1]) > 1;
      })) schedule();
    });
    const mutation = new MutationObserver(schedule);

    function schedule() {
      if (!frame) frame = requestAnimationFrame(fit);
    }

    function fit() {
      cancelAnimationFrame(frame);
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
      if (detailViewportSelector) container!.style.setProperty("--region-available-height", `${Math.max(0, available)}px`);
      for (const node of atoms) {
        if (!observed.has(node)) {
          resize.observe(node);
          observed.add(node);
        }
        node.dataset.density = node.dataset.minimum ?? "0";
      }

      const detailViewport = detailViewportSelector ? content!.querySelector<HTMLElement>(detailViewportSelector) : null;
      if (detailViewport) {
        delete detailViewport.dataset.detailOverflow;
        detailViewport.removeAttribute("tabindex");
        const deficit = content!.offsetHeight - available;
        if (deficit > 0 && detailViewport.clientHeight > deficit) {
          detailViewport.style.setProperty("--balanced-detail-height", `${Math.floor(detailViewport.clientHeight - deficit)}px`);
          detailViewport.style.setProperty("--balanced-detail-width", `${detailViewport.clientWidth}px`);
          detailViewport.dataset.detailOverflow = "";
          detailViewport.tabIndex = 0;
        }
      }

      for (let target = 1; target <= 4; target++) {
        for (const node of atoms) {
          const previous = Number(node.dataset.density);
          if (previous !== target - 1) continue;
          node.dataset.density = String(target);
          if (content!.offsetHeight > available) node.dataset.density = String(previous);
        }
      }

      if (!animateAtoms) {
        // Changes already included in this fit do not need another pass on the next frame.
        mutation.takeRecords();
        for (const node of [container!, ...atoms]) fittedSizes.set(node, [node.offsetWidth, node.offsetHeight]);
        return;
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
    fitLayout.current = fit;
    if (animateAtoms) fit();
    return () => {
      fitLayout.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [animateAtoms, detailViewportSelector]);

  useLayoutEffect(() => {
    if (layoutRevision !== undefined) fitLayout.current?.();
  }, [layoutRevision]);

  return { region, flow };
}
