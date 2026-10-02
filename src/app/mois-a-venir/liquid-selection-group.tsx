"use client";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { moveLiquidHighlight, type LiquidHighlightPose } from "./liquid-highlight";
import material from "./month-material.module.css";

/** Existing controls own selection and actions. This group only supplies their moving highlight. */
export function LiquidSelectionGroup({ value, children, ariaLabel, className = "" }: {
  value: string | null; children: ReactNode; ariaLabel: string; className?: string;
}) {
  const track = useRef<HTMLDivElement>(null), plate = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | undefined>(undefined);
  const previousPose = useRef<Required<LiquidHighlightPose> | null>(null);
  useLayoutEffect(() => {
    const group = track.current, highlight = plate.current;
    if (!group || !highlight) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const place = (immediate = false, force = false) => {
      const control = [...group.querySelectorAll<HTMLElement>("[data-liquid-key]")].find(node => node.dataset.liquidKey === value);
      if (!control) { animation.current?.cancel(); highlight.dataset.ready = "false"; previousPose.current = null; return; }
      const bounds = control.getBoundingClientRect(), origin = group.getBoundingClientRect();
      const border = getComputedStyle(group);
      const pose = { x: bounds.left - origin.left - parseFloat(border.borderLeftWidth) + group.scrollLeft,
        y: bounds.top - origin.top - parseFloat(border.borderTopWidth) + group.scrollTop, width: bounds.width, height: bounds.height };
      const last = previousPose.current;
      if (!force && last && Math.abs(pose.x - last.x) < .1 && Math.abs(pose.y - last.y) < .1
        && Math.abs(pose.width - last.width) < .1 && Math.abs(pose.height - last.height) < .1) return;
      animation.current = moveLiquidHighlight(highlight, group, pose, animation.current, immediate || reduced.matches);
      previousPose.current = pose;
    };
    place();
    const resize = new ResizeObserver(() => place(true));
    resize.observe(group);
    for (const control of group.querySelectorAll("[data-liquid-key]")) resize.observe(control);
    const preferenceChanged = () => place(true, true);
    reduced.addEventListener("change", preferenceChanged);
    return () => { resize.disconnect(); reduced.removeEventListener("change", preferenceChanged); };
  }, [value]);
  useEffect(() => () => { animation.current?.cancel(); }, []);
  return <div ref={track} role="group" aria-label={ariaLabel} className={`${material.liquidGroup} ${className}`}>
    <span ref={plate} aria-hidden="true" data-liquid-highlight className={material.liquidHighlight} />
    {children}
  </div>;
}
