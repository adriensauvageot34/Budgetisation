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
        const order = Math.max(0, siblings.filter(sibling => sibling.matches("[data-month-motion-item]")).indexOf(node));
        // Content is visible by default; no hidden SSR data or unrevealed section can remain.
        const animation = node.animate([
          { opacity: .68, transform: "translate3d(0,12px,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" },
        ], { duration: 480, delay: Math.min(order * 45, 135), easing: "cubic-bezier(.2,.75,.2,1)", fill: "backwards" });
        animations.add(animation);
        void animation.finished.then(() => { animations.delete(animation); animation.cancel(); }, () => animations.delete(animation));
      }
    }, { rootMargin: "-90px 0px -24px 0px", threshold: .08 });
    const collect = () => {
      for (const node of page.querySelectorAll("[data-month-story] h2, [data-month-motion-item]")) {
        if (!seen.has(node)) observer.observe(node);
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
