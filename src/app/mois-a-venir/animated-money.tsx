"use client";
import { useEffect, useRef } from "react";
import material from "./month-material.module.css";

/** Animates a formatted server value only when it changes; never interpolates a financial amount. */
export function AnimatedMoney({ value }: { value: string }) {
  const node = useRef<HTMLSpanElement>(null), previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (!node.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const style = window.getComputedStyle(node.current);
    const animation = node.current.animate([{ opacity: .45, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: Number.parseFloat(style.getPropertyValue("--motion-fast")) || 180, easing: style.getPropertyValue("--ease-premium").trim() || "ease-out" });
    return () => animation.cancel();
  }, [value]);
  return <span ref={node} className={material.money} data-animated-money>{value}</span>;
}
