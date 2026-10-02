"use client";
import { useEffect, type RefObject } from "react";

/** Reveal content once, never animate the large glass/backdrop surfaces while scrolling. */
export function usePlannedContentMotion(toolbar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const page = toolbar.current?.closest("[data-planned-page]");
    if (!page) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>(), animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target as HTMLElement;
        observer.unobserve(node); seen.add(node);
        if (reduced.matches) continue;
        const siblings = [...(node.parentElement?.children ?? [])];
        const order = Number(node.dataset.motionOrder ?? Math.max(0, siblings.filter(sibling => sibling.matches("[data-month-motion-item]")).indexOf(node)));
        const kind = node.dataset.monthMotionItem;
        const heading = node.tagName === "H2";
        const distance = heading ? 8 : kind === "calendar-week" ? 6 : kind === "project" ? 16 : 12;
        const duration = heading ? 380 : kind === "calendar-week" ? 420 : kind === "project" ? 620 : 520;
        const initial = kind === "scenario" ? "translate3d(0,10px,0) scale(.985)" : "translate3d(0," + distance + "px,0)";
        // Content is visible by default; no hidden SSR data or unrevealed section can remain.
        const animation = node.animate([
          { opacity: heading ? .8 : .68, transform: initial },
          { opacity: 1, transform: "translate3d(0,0,0)" },
        ], { duration, delay: Math.min(order * 55, 180), easing: "cubic-bezier(.2,.75,.2,1)", fill: "backwards" });
        animations.add(animation);
        void animation.finished.then(() => { animations.delete(animation); animation.cancel(); }, () => animations.delete(animation));
      }
    }, { rootMargin: "-90px 0px -24px 0px", threshold: .08 });
    const collect = () => {
      for (const node of page.querySelectorAll("[data-month-story] h2, [data-month-motion-item]")) {
        if (!seen.has(node) && !node.closest('[role="dialog"], [popover]')) observer.observe(node);
      }
    };
    const cancel = () => { if (reduced.matches) { for (const animation of animations) animation.cancel(); animations.clear(); } };
    const mutations = new MutationObserver(collect);
    mutations.observe(page, { childList: true, subtree: true });
    reduced.addEventListener("change", cancel);
    collect();
    return () => {
      observer.disconnect(); mutations.disconnect(); reduced.removeEventListener("change", cancel);
      for (const animation of animations) animation.cancel();
    };
  }, [toolbar]);
}
