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
  sizes: (number | null)[];
  focused: boolean;
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
    const observed = new Set<HTMLElement>();
    const fittedSizes = new Map<Element, readonly [number, number]>();
    const lastTops = new Map<HTMLElement, number>();
    const animations = new Map<HTMLElement, Animation>();
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const resize = new ResizeObserver(entries => {
      if (entries.some(({ target }) => {
        const size = fittedSizes.get(target);
        return !size || size[0] !== target.clientWidth || size[1] !== target.clientHeight;
      })) schedule();
    });
    const mutation = new MutationObserver(schedule);

    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(() => fit(true));
    }

    function fit(animate: boolean) {
      cancelAnimationFrame(frame);
      frame = 0;
      const available = root.clientHeight;
      const width = root.clientWidth;
      if (!available || !width) return;
      const regions = Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-adaptive-region]"));
      const flows = regions.flatMap(region => Array.from(region.querySelectorAll<HTMLElement>(":scope > [data-adaptive-flow]")));
      const current = new Set([root, ...flows]);
      for (const node of observed) {
        if (current.has(node)) continue;
        resize.unobserve(node);
        fittedSizes.delete(node);
        observed.delete(node);
      }
      for (const node of current) {
        if (observed.has(node)) continue;
        resize.observe(node);
        observed.add(node);
      }

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
      const detail = root.querySelector<HTMLElement>(":scope > [data-adaptive-active]")?.querySelector<HTMLElement>(detailSelector);

      const groups = flows.map(flow => {
        const region = flow.parentElement!;
        const focused = region.hasAttribute("data-adaptive-active");
        return {
          gap: parseFloat(getComputedStyle(flow).rowGap) || 0,
          atoms: Array.from(flow.querySelectorAll<HTMLElement>(":scope > [data-balance-atom]"), element => ({
            element,
            priority: Number(element.dataset.priority),
            minimum: Number(element.dataset.minimum),
            density: Number(element.dataset.density),
            previous: Number(element.dataset.density),
            sizes: [],
            focused,
          } satisfies Atom)),
        };
      });
      const atoms: Atom[] = groups.flatMap(group => group.atoms);

      // Batch all style writes before the reads. This takes five layout passes
      // regardless of how many atoms or sections a dashboard contains.
      for (let level = 0; level <= maxDensity; level++) {
        for (const atom of atoms) setDensity(atom, Math.max(level, atom.minimum));
        for (const atom of atoms) atom.sizes[level] = atom.element.getClientRects()[0]?.height ?? null;
      }
      for (const atom of atoms) setDensity(atom, atom.minimum);

      const usedHeight = () => regions.reduce((sum, region) => sum + region.getBoundingClientRect().height, 0);
      const columnGap = (parseFloat(getComputedStyle(root).rowGap) || 0) * Math.max(0, regions.length - 1);
      const limit = available - columnGap;
      const minimumHeight = usedHeight();
      let used = minimumHeight;
      const visible = groups.map(group => group.atoms.filter(atom => atom.sizes[atom.minimum] !== null).length);
      const upgrades = groups.flatMap((group, groupIndex) => group.atoms.flatMap(atom => {
        const score = atom.priority + (atom.focused ? 30 : 0);
        return Array.from({ length: maxDensity - atom.minimum }, (_, step) => ({
          atom, groupIndex, level: atom.minimum + step + 1, score: score - (atom.minimum + step) * 40,
        }));
      })).sort((a, b) => b.score - a.score);
      const applied: typeof upgrades = [];

      for (const upgrade of upgrades) {
        const { atom, groupIndex, level } = upgrade;
        if (atom.density !== level - 1) continue;
        const before = atom.sizes[atom.density];
        const after = atom.sizes[level];
        const count = visible[groupIndex];
        const nextCount = count + Number(after !== null) - Number(before !== null);
        const cost = (after ?? 0) - (before ?? 0)
          + (Math.max(0, nextCount - 1) - Math.max(0, count - 1)) * groups[groupIndex].gap;
        const reserve = cost > 0 && atom.previous < level && level > 1 ? 4 : 0;
        if (used + cost > limit - reserve) continue;
        atom.density = level;
        visible[groupIndex] = nextCount;
        used += cost;
        applied.push(upgrade);
      }
      for (const atom of atoms) setDensity(atom, atom.density);

      // Cross-atom CSS (for instance an expanded ranking) may change the
      // computed height. Verify the resulting geometry before publishing it.
      let actual = usedHeight();
      while (actual > limit + .5 && applied.length) {
        const { atom, level } = applied.pop()!;
        setDensity(atom, level - 1);
        actual = usedHeight();
      }
      if (actual > limit + .5 && detail) {
        const space = Math.max(48, Math.floor(detail.clientHeight - (actual - limit)));
        detail.style.setProperty("--balanced-detail-height", `${space}px`);
        detail.dataset.detailOverflow = "";
        detail.tabIndex = 0;
      }

      const canAnimate = animate && width === lastWidth && available === lastHeight && !reducedMotion.matches
        && !(CSS.supports(`selector(:active-view-transition-type(${motionType}))`)
          && document.documentElement.matches(`:active-view-transition-type(${motionType})`));
      lastTops.clear();
      for (const region of regions) {
        const top = region.getBoundingClientRect().top;
        const delta = (oldTops.get(region) ?? top) - top;
        lastTops.set(region, top);
        if (canAnimate && Math.abs(delta) > 1) {
          animations.set(region, region.animate([{ translate: `0 ${delta}px` }, { translate: "0 0" }],
            { duration: 200, easing: "cubic-bezier(.22,.75,.22,1)" }));
        }
      }
      lastWidth = width;
      lastHeight = available;
      mutation.takeRecords();
      for (const node of current) fittedSizes.set(node, [node.clientWidth, node.clientHeight]);
    }

    mutation.observe(root, { childList: true, subtree: true, characterData: true });
    document.fonts.addEventListener("loadingdone", schedule);
    fitLayout.current = fit;
    return () => {
      fitLayout.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
      for (const animation of animations.values()) animation.cancel();
    };
  }, [detailSelector, motionType]);

  useLayoutEffect(() => { fitLayout.current?.(false); }, [revision]);
  return column;
}
