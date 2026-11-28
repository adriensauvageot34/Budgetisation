"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const maxDensity = 4;
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

type Atom = {
  element: HTMLElement;
  priority: number;
  minimum: number;
  density: number;
  previous: number;

};

function setDensity(atom: Atom, density: number) {
  atom.density = density;
  atom.element.dataset.density = String(density);
}

/**
 * Sections keep their DOM order and intrinsic heights. A whole column shares one
 * height budget, so every pixel released by one section is offered to its neighbours.
 */
export function useAdaptiveColumn(revision: number, detailSelector: string, motionType: string) {
  const column = useRef<HTMLDivElement>(null);
  const fitLayout = useRef<(animate: boolean) => void>(null);

  useLayoutEffect(() => {
    const container = column.current;
    if (!container) return;
    const root = container;
    const lastTops = new Map<HTMLElement, number>();
    const animations = new Map<HTMLElement, Animation>();
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let verificationFrame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const resize = new ResizeObserver(() => {
      if (root.clientWidth !== lastWidth || root.clientHeight !== lastHeight) schedule();
    });
    const mutation = new MutationObserver(records => {
      if (records.some(({ target }) => {
        const element = target instanceof Element ? target : target.parentElement;
        return element && !element.closest("svg, .ui-chart-renderer");
      })) schedule();
    });

    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(() => fit(true));
    }

    function fit(animate: boolean) {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(verificationFrame);
      frame = 0;
      const available = root.clientHeight;
      const width = root.clientWidth;
      if (!available || !width) return;
      const regions = Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-adaptive-region]"));
      const flows = regions.flatMap(region => Array.from(region.querySelectorAll<HTMLElement>(":scope > [data-adaptive-flow]")));
      const oldTops = new Map(lastTops);
      for (const [region, animation] of animations) {
        if (animation.playState === "running") oldTops.set(region, region.getBoundingClientRect().top);
        animation.cancel();
      }
      animations.clear();

      for (const viewport of root.querySelectorAll<HTMLElement>("[data-detail-overflow]")) {
        delete viewport.dataset.detailOverflow;
        viewport.removeAttribute("tabindex");
      }
      const list = root.querySelector<HTMLElement>("[data-adaptive-list]");
      list?.style.removeProperty("max-block-size");
      const detail = root.querySelector<HTMLElement>(":scope > [data-adaptive-active]")?.querySelector<HTMLElement>(detailSelector);

      const atoms = flows.flatMap(flow => {
        const focusBonus = flow.parentElement?.hasAttribute("data-adaptive-active") ? 30 : 0;
        return Array.from(flow.querySelectorAll<HTMLElement>(":scope > [data-balance-atom]"), (element): Atom => ({
          element,
          priority: Number(element.dataset.priority) + focusBonus,
          minimum: Number(element.dataset.minimum),
          density: Number(element.dataset.density),
          previous: Number(element.dataset.density),
        }));
      });
      const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
      const limit = available - gap * Math.max(0, regions.length - 1);
      const chrome = regions.reduce((height, region) => {
        const style = getComputedStyle(region);
        return height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
          + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      }, 0);
      const usedHeight = () => flows.reduce((height, flow) => height + flow.getBoundingClientRect().height, chrome);

      for (const atom of atoms) setDensity(atom, atom.minimum);
      let actual = usedHeight();
      const upgrades = atoms.flatMap(atom => Array.from({ length: maxDensity - atom.minimum }, (_, index) => {
        const level = atom.minimum + index + 1;
        // Showing an additional piece of information ranks ahead of enlarging
        // an existing one with a comparable priority.
        return { atom, level, score: atom.priority - (level - 1) * 45 };
      })).sort((a, b) => b.score - a.score);

      for (const { atom, level } of upgrades) {
        if (atom.density !== level - 1) continue;
        setDensity(atom, level);
        const next = usedHeight();
        const reserve = next > actual && atom.previous < level && level > 1 ? 4 : 0;
        if (next > limit - reserve) setDensity(atom, level - 1);
        else actual = next;
      }
      actual = usedHeight();
      function limitDetail(height: number) {
        if (!detail || height <= limit + 1.25) return;
        const space = Math.max(48, Math.ceil(detail.getBoundingClientRect().height - (height - limit)));
        detail.style.setProperty("--balanced-detail-height", `${space}px`);
        detail.dataset.detailOverflow = "";
        detail.tabIndex = 0;
      }
      limitDetail(actual);

      const listAtom = list && atoms.find(({ element }) => element.contains(list));
      function fitList() {
        if (!list || !listAtom) return;
        const density = Math.max(1, listAtom.density);
        setDensity(listAtom, 0);
        const room = limit - usedHeight();
        if (room < 55 && listAtom.minimum === 0) return;
        list.style.maxBlockSize = `${Math.max(36, Math.min(360, Math.floor(room - 12)))}px`;
        setDensity(listAtom, density);
      }
      fitList();

      // Local charts may settle after their data and styles are committed.
      verificationFrame = requestAnimationFrame(() => {
        let height = usedHeight();
        if (height > limit + .5) {
          for (const animation of animations.values()) animation.cancel();
          animations.clear();
          for (const { atom, level } of upgrades.toReversed()) {
            if (height <= limit + .5) break;
            if (atom.density !== level) continue;
            setDensity(atom, level - 1);
            height = usedHeight();
          }
        }
        fitList();
        limitDetail(usedHeight());
      });

      const positions = regions.map(region => {
        const box = region.getBoundingClientRect();
        return { region, top: box.top, height: box.height, from: oldTops.get(region) ?? box.top };
      });
      // A translation keeps its new height throughout the animation. If it
      // would cross a neighbour while data is arriving, use the fitted layout.
      const originsFit = positions.every(({ from }, index) => {
        const previous = positions[index - 1];
        return !previous || from >= previous.from + previous.height - .5;
      });
      const canAnimate = originsFit && animate && width === lastWidth && available === lastHeight && !reducedMotion.matches
        && !(CSS.supports(`selector(:active-view-transition-type(${motionType}))`)
          && document.documentElement.matches(`:active-view-transition-type(${motionType})`));
      lastTops.clear();
      for (const { region, top, from } of positions) {
        const delta = from - top;
        lastTops.set(region, top);
        if (canAnimate && Math.abs(delta) > 1) {
          animations.set(region, region.animate([{ translate: `0 ${delta}px` }, { translate: "0 0" }],
            { duration: 200, easing: "cubic-bezier(.22,.75,.22,1)" }));
        }
      }
      lastWidth = width;
      lastHeight = available;
    }

    resize.observe(root);
    mutation.observe(root, { childList: true, subtree: true, characterData: true });
    root.addEventListener("load", schedule, true);
    document.fonts.addEventListener("loadingdone", schedule);
    fitLayout.current = fit;
    return () => {
      fitLayout.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(verificationFrame);
      resize.disconnect();
      mutation.disconnect();
      root.removeEventListener("load", schedule, true);
      document.fonts.removeEventListener("loadingdone", schedule);
      for (const animation of animations.values()) animation.cancel();
    };
  }, [detailSelector, motionType]);

  useLayoutEffect(() => { fitLayout.current?.(false); }, [revision]);
  return column;
}
