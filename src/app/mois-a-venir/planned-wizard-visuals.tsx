"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./planned-wizard.module.css";
import { BuilderIllustration } from "./builder-illustrations";

/** Compatibility scene names only. All image ownership is in builder-illustration-registry.json. */
export const WIZARD_SCENES = {
  restaurant: 0, fast_food: 1, work_meal: 2, groceries: 3, party: 4, visit: 5, activity: 6,
  purchase: 7, trip: 8, solo: 9, couple: 10, group: 11, date: 12, birthday: 13,
  valentine: 14, spontaneous: 15, partyOccasion: 16, reunion: 17, celebration: 18, occasion: 19, montpellier: 20,
  elsewhere: 21, tram: 22, walk: 23, bike: 24, car: 25, train: 26, taxi: 27,
  bus: 28, transport: 29, starter: 30, main: 31, dessert: 32, wine_glass: 33, wine_bottle: 34,
  cocktail: 35, soft: 36, water: 37, coffee: 38, menu: 39, digestif: 40, custom: 41,
  wallet: 42, bill: 43, restaurantExterior: 44, road: 45, note: 46, sharing: 47, room: 48,
} as const;
export type WizardScene = keyof typeof WIZARD_SCENES;
export function WizardBackdrop({ scene, className = "" }: { scene: WizardScene; className?: string }) {
  return <BuilderIllustration semanticKey={`scene:${scene}`} className={`${styles.scene} ${className}`} />;
}
export function WizardChoice({ label, scene, illustrationKey, icon, selected = false, value, compact = false, onClick }: {
  label: string; scene: WizardScene; icon?: ReactNode; selected?: boolean; value?: string;
  illustrationKey?: string; compact?: boolean; onClick: () => void;
}) {
  return <button type="button" aria-pressed={selected} className={`${styles.choice} ${styles.glassIntent} ${compact ? styles.compact : ""}`} onClick={onClick}>
    <BuilderIllustration semanticKey={illustrationKey ?? `scene:${scene}`} /><span className={styles.choiceWash} />
    <span className={styles.choiceContent}>{icon && <span className={styles.choiceIcon}>{icon}</span>}<strong>{label}</strong>{value && <span className={styles.choiceValue}>{value}</span>}</span>
    {selected && <span className={styles.selectedMark} aria-hidden="true">✓</span>}
  </button>;
}
/** Desktop dialog shell. Navigation/estimates remain owned by the existing builder. */
export type BuilderReturnPoint = { focus: HTMLElement | null; left: number; top: number };
export function PlannedBuilderFrame({ immersive, label = "Préparer une dépense", returnPoint, onDismiss, children }: { immersive: boolean; label?: string; returnPoint?: BuilderReturnPoint | null; onDismiss: () => void; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null), dismiss = useRef(onDismiss); dismiss.current = onDismiss;
  useEffect(() => {
    if (!immersive) return;
    const previous = document.body.style.overflow, previousFocus = returnPoint?.focus ?? document.activeElement as HTMLElement | null;
    const scrollPosition = { left: returnPoint?.left ?? window.scrollX, top: returnPoint?.top ?? window.scrollY };
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => frame.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }), 0);
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); }
      if (event.key !== "Tab") return;
      const focusRoot = frame.current?.querySelector<HTMLElement>('[role="alertdialog"]') ?? frame.current;
      const focusable = [...focusRoot?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]') ?? []].filter((element) => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previous; document.removeEventListener("keydown", keys); previousFocus?.focus({ preventScroll: true }); window.scrollTo(scrollPosition); };
  }, [immersive]);
  const content = immersive ? <div className={styles.scrim}><div ref={frame} role="dialog" aria-modal="true" aria-label={label} className={styles.frame}>{children}</div></div>
    : <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">{children}</div>;
  // Escape the page's isolated Glass layers so the site header cannot cover the dialog.
  return immersive && typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
