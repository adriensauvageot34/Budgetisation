"use client";
import { useEffect, useRef, useState } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const indicatorTransform = (x: number, y: number, width: number) =>
  "translate3d(" + x + "px," + y + "px,0) scaleX(" + width / 100 + ")";

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
    let positions: { id: string; top: number; x: number; y: number; width: number }[] = [];

    const moveIndicator = (target: typeof positions[number], immediate: boolean) => {
      // Read the live pose once when the selection changes, so interrupted moves never jump.
      const from = pill.getBoundingClientRect(), origin = track.getBoundingClientRect();
      const x = from.left - origin.left, y = from.top - origin.top;
      const ready = pill.dataset.ready === "true";
      pillAnimation?.cancel();
      const destination = indicatorTransform(target.x, target.y, target.width);
      pill.style.transform = destination;
      pill.dataset.ready = "true";
      if (immediate || reduced.matches || !ready) return;
      const distance = target.x - x, stretch = Math.min(32, Math.abs(distance) * .22);
      const middleWidth = Math.max(from.width, target.width) + stretch;
      const middleX = x + distance * .55 - stretch / 2;
      pillAnimation = pill.animate([
        { transform: indicatorTransform(x, y, from.width) },
        { transform: indicatorTransform(middleX, target.y, middleWidth), offset: .55 },
        { transform: destination },
      ], { duration: 420 + Math.min(140, Math.abs(distance) / 4), easing: "cubic-bezier(.22,.75,.18,1)" });
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
          return [{ id, top: section.getBoundingClientRect().top + scroll, x: link.offsetLeft,
            y: link.offsetTop, width: link.offsetWidth }];
        });
        pill.style.height = (track.querySelector("a")?.offsetHeight ?? 32) + "px";
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
