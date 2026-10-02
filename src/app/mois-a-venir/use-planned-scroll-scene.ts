"use client";
import { useEffect, useRef, useState } from "react";
import { moveLiquidHighlight } from "./liquid-highlight";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Presentation only: one scroll subscription, cached geometry, state only on section changes. */
export function usePlannedScrollScene(sectionIds: readonly string[]) {
  const anchor = useRef<HTMLSpanElement>(null), toolbar = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLDivElement>(null), indicator = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(sectionIds[0]);
  useEffect(() => {
    const nav = toolbar.current, start = anchor.current, track = tabs.current, pill = indicator.current;
    const shell = nav?.closest<HTMLElement>("[data-planned-shell]");
    const header = shell?.querySelector<HTMLElement>("[data-planned-header]");
    const background = shell?.querySelector<HTMLElement>("[data-planned-background]");
    const page = nav?.closest<HTMLElement>("[data-planned-page]");
    if (!nav || !start || !shell || !header || !background || !track || !pill || !page) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nativeScroll = CSS.supports("animation-timeline", "scroll(root block)") && CSS.supports("animation-range", "0px 200px");
    const properties = ["--planned-lock-at", "--planned-background-start", "--planned-background-end-y",
      "--planned-toolbar-height", "--planned-anchor-offset", "--planned-toolbar-left", "--planned-toolbar-right", "--planned-toolbar-radius"];
    let frame = 0, sweepTimer = 0, needsMeasure = true, initialized = false, locked = false;
    let lockAt = 1, offset = 100, endAt = 0, parallax = 16, zoom = .04, previous = -1, activeId = "";
    let pillAnimation: Animation | undefined;
    let positions: { id: string; top: number; x: number; y: number; width: number; height: number }[] = [];

    const moveIndicator = (target: typeof positions[number], immediate: boolean) => {
      pillAnimation = moveLiquidHighlight(pill, track, target, pillAnimation, immediate || reduced.matches);
    };

    const update = () => {
      frame = 0;
      const scroll = Math.max(0, window.scrollY), measuring = needsMeasure;
      if (measuring) {
        needsMeasure = false;
        const navStyle = getComputedStyle(nav), bounds = nav.getBoundingClientRect();
        const top = parseFloat(navStyle.top) || 0;
        lockAt = Math.max(1, start.getBoundingClientRect().top + scroll - top);
        offset = top + nav.offsetHeight + 24;
        endAt = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        zoom = reduced.matches ? 0 : .04;
        parallax = reduced.matches ? 0 : Math.min(lockAt * .12, 16);
        positions = sectionIds.flatMap(id => {
          const node = document.getElementById(id);
          const link = track.querySelector<HTMLAnchorElement>('a[href="#' + id + '"]');
          if (!node || !link) return [];
          const section = node.closest("section") ?? node;
          const linkBounds = link.getBoundingClientRect(), trackBounds = track.getBoundingClientRect();
          return [{ id, top: section.getBoundingClientRect().top + scroll,
            x: linkBounds.left - trackBounds.left, y: linkBounds.top - trackBounds.top,
            width: linkBounds.width, height: linkBounds.height }];
        });
        shell.style.setProperty("--planned-lock-at", lockAt + "px");
        shell.style.setProperty("--planned-background-start", String(1 + zoom));
        shell.style.setProperty("--planned-background-end-y", -parallax + "px");
        shell.style.setProperty("--planned-toolbar-height", nav.offsetHeight + "px");
        shell.style.setProperty("--planned-anchor-offset", top + nav.offsetHeight + 20 + "px");
        shell.style.setProperty("--planned-toolbar-left", bounds.left + "px");
        shell.style.setProperty("--planned-toolbar-right", document.documentElement.clientWidth - bounds.right + "px");
        shell.style.setProperty("--planned-toolbar-radius", navStyle.borderTopLeftRadius);
        previous = -1;
      }
      let selected = positions[0];
      for (const position of positions) if (position.top <= scroll + offset) selected = position;
      // The last section can be shorter than a viewport, and must still become current.
      if (positions.length && scroll > 0 && scroll >= endAt - 2) selected = positions[positions.length - 1];
      if (selected && (selected.id !== activeId || measuring)) {
        moveIndicator(selected, measuring);
        if (selected.id !== activeId) { activeId = selected.id; setActive(selected.id); }
      }
      const progress = clamp(scroll / lockAt);
      // Modern browsers interpolate on the scroll timeline, independently of JS scroll events.
      // The fallback changes only the two small compositor poses, never inherited per-frame tokens.
      if (!nativeScroll && progress !== previous) {
        background.style.transform = "translate3d(0," + -parallax * progress + "px,0) scale(" + (1 + zoom * (1 - progress)) + ")";
        header.style.transform = reduced.matches ? "none" : "translate3d(0," + -12 * progress + "px,0)";
        header.style.opacity = reduced.matches ? "1" : String(1 - .18 * progress);
      }
      previous = progress;
      const nextLocked = progress === 1;
      if (nextLocked !== locked || !initialized) {
        window.clearTimeout(sweepTimer);
        nav.removeAttribute("data-liquid-sweep");
        if (nextLocked && initialized && !reduced.matches) {
          nav.setAttribute("data-liquid-sweep", "");
          sweepTimer = window.setTimeout(() => nav.removeAttribute("data-liquid-sweep"), 680);
        }
        shell.dataset.plannedLocked = String(nextLocked);
        locked = nextLocked;
      }
      initialized = true;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const measure = () => { needsMeasure = true; schedule(); };
    const resize = new ResizeObserver(measure);
    resize.observe(page); resize.observe(header); resize.observe(nav); resize.observe(track);
    for (const id of sectionIds) {
      const node = document.getElementById(id)?.closest("section");
      if (node) resize.observe(node);
    }
    // Forms, disclosures and project updates may shift later sections without resizing the viewport.
    const mutations = new MutationObserver(measure);
    mutations.observe(page, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    reduced.addEventListener("change", measure);
    update();
    return () => {
      window.cancelAnimationFrame(frame); window.clearTimeout(sweepTimer); pillAnimation?.cancel();
      resize.disconnect(); mutations.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure); nav.removeAttribute("data-liquid-sweep");
      delete shell.dataset.plannedLocked; delete pill.dataset.ready;
      background.style.removeProperty("transform"); header.style.removeProperty("transform"); header.style.removeProperty("opacity");
      for (const property of properties) shell.style.removeProperty(property);
    };
  }, [sectionIds]);
  return { anchor, toolbar, tabs, indicator, active };
}
