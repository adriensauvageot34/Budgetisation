"use client";
import { useEffect, useRef } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

/** Presentation only. Geometry is measured on resize; scroll frames only write the shared scene progress. */
export function usePlannedScrollScene() {
  const anchor = useRef<HTMLSpanElement>(null), toolbar = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = toolbar.current, start = anchor.current;
    const shell = nav?.closest<HTMLElement>("[data-planned-shell]");
    const header = shell?.querySelector<HTMLElement>("[data-planned-header]");
    if (!nav || !start || !shell || !header) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, snapTimer = 0, needsMeasure = true, initialized = false, locked = false, previous = -1;
    let lockAt = 1, headerHeight = 72, parallax = 24, zoom = .05, bend = 1.5, blur = 10;
    const properties = ["--planned-scroll-progress", "--planned-header-progress", "--planned-header-follow", "--planned-header-scale", "--planned-background-scale", "--planned-background-y", "--planned-toolbar-bend", "--planned-glass-blur", "--planned-glass-opacity", "--planned-toolbar-height", "--planned-anchor-offset", "--planned-toolbar-left", "--planned-toolbar-right", "--planned-toolbar-radius"];
    const update = () => {
      frame = 0;
      const scroll = Math.max(0, window.scrollY);
      if (needsMeasure) {
        needsMeasure = false;
        const navStyle = getComputedStyle(nav), bounds = nav.getBoundingClientRect();
        const top = parseFloat(navStyle.top) || 0;
        lockAt = Math.max(1, start.getBoundingClientRect().top + scroll - top);
        headerHeight = header.offsetHeight;
        const mobile = window.innerWidth <= 700, tablet = window.innerWidth <= 1024;
        zoom = reduced.matches || mobile ? 0 : tablet ? .025 : .05;
        parallax = reduced.matches || mobile ? 0 : Math.min(lockAt * .22, tablet ? 12 : 24);
        bend = reduced.matches || mobile ? 0 : tablet ? .75 : 1.5;
        blur = mobile ? 4 : 10;
        shell.style.setProperty("--planned-toolbar-height", `${nav.offsetHeight}px`);
        shell.style.setProperty("--planned-anchor-offset", `${top + nav.offsetHeight + 20}px`);
        shell.style.setProperty("--planned-toolbar-left", `${bounds.left}px`);
        shell.style.setProperty("--planned-toolbar-right", `${document.documentElement.clientWidth - bounds.right}px`);
        shell.style.setProperty("--planned-toolbar-radius", navStyle.borderTopLeftRadius);
        previous = -1;
      }
      const progress = clamp(scroll / lockAt);
      if (progress === previous) return; // Once locked, there are no continuing background/style writes.
      previous = progress;
      const lens = smooth(clamp((progress - .25) / .75));
      shell.style.setProperty("--planned-scroll-progress", progress.toFixed(4));
      shell.style.setProperty("--planned-header-progress", lens.toFixed(4));
      shell.style.setProperty("--planned-header-follow", `${Math.min(scroll, lockAt) - lens * headerHeight * .7}px`);
      shell.style.setProperty("--planned-header-scale", `${1 - lens * .76}`);
      shell.style.setProperty("--planned-background-scale", `${1 + zoom * (1 - progress)}`);
      shell.style.setProperty("--planned-background-y", `${-parallax * progress}px`);
      shell.style.setProperty("--planned-toolbar-bend", `${-Math.sin(progress * Math.PI) * bend}px`);
      shell.style.setProperty("--planned-glass-blur", `${14 + blur * progress}px`);
      shell.style.setProperty("--planned-glass-opacity", `${.16 + .10 * progress}`);
      const nextLocked = progress === 1;
      if (nextLocked !== locked || !initialized) {
        window.clearTimeout(snapTimer);
        nav.removeAttribute("data-liquid-snap");
        if (nextLocked && initialized && !reduced.matches && window.innerWidth > 700) {
          nav.setAttribute("data-liquid-snap", "");
          snapTimer = window.setTimeout(() => nav.removeAttribute("data-liquid-snap"), 720);
        }
        shell.dataset.plannedLocked = String(nextLocked);
        locked = nextLocked;
      }
      initialized = true;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const measure = () => { needsMeasure = true; schedule(); };
    const resize = new ResizeObserver(measure);
    resize.observe(shell); resize.observe(header); resize.observe(nav);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    reduced.addEventListener("change", measure);
    update();
    return () => {
      window.cancelAnimationFrame(frame); window.clearTimeout(snapTimer); resize.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure); nav.removeAttribute("data-liquid-snap");
      delete shell.dataset.plannedLocked;
      for (const property of properties) shell.style.removeProperty(property);
    };
  }, []);
  return { anchor, toolbar };
}
