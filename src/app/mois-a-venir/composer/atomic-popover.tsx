import { useId, useRef, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./composer.module.css";
import { useDragHandle } from "./interactions";

/** Viewport coordinates are transient DOM placement, never part of a draft. */
export function AtomicPopover({ label, state, selectionId, empty, children, icon, focus, dragSourceKey, utility }: {
  label: string; state: string; selectionId?: string; empty?: boolean; icon: ReactNode;
  children: (close: () => void) => ReactNode; focus: () => void; dragSourceKey?: string; utility?: boolean;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const titleId = `${id}-title`;
  const dragProps = useDragHandle(dragSourceKey);
  const close = () => panel.current?.hidePopover();
  useEffect(() => {
    const node = panel.current;
    const place = () => {
      if (!node?.matches(":popover-open") || !trigger.current) return;
      const anchor = trigger.current.getBoundingClientRect(), box = node.getBoundingClientRect(), margin = 12;
      node.style.left = `${Math.max(margin, Math.min(innerWidth - box.width - margin, anchor.left + anchor.width / 2 - box.width / 2))}px`;
      const below = anchor.bottom + 9;
      node.style.top = `${Math.max(margin, Math.min(innerHeight - box.height - margin, below + box.height <= innerHeight - margin ? below : anchor.top - box.height - 9))}px`;
    };
    const toggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") { place(); node?.querySelector<HTMLElement>("[data-popover-title]")?.focus(); }
      else if (!document.querySelector("dialog[open]") && (!document.activeElement || document.activeElement === document.body || node?.contains(document.activeElement))) trigger.current?.focus();
    };
    node?.addEventListener("toggle", toggle);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { node?.removeEventListener("toggle", toggle); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, []);
  return <>
    <button ref={trigger} type="button" className={utility ? styles.iconButton : styles.satellite} data-context-actions={utility || undefined} data-satellite={utility ? undefined : true} data-selection={selectionId} data-state={state} data-empty={empty || undefined} {...dragProps}
      title={label} aria-label={label} aria-haspopup="dialog" aria-controls={id} onClick={() => { focus(); panel.current?.togglePopover(); }}>{icon}</button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={titleId} className={styles.atomicPopover} data-atomic-popover>
      <header><h4 id={titleId} tabIndex={-1} data-popover-title>{label}</h4><button type="button" className={styles.iconButton} aria-label="Fermer les détails" onClick={() => { close(); trigger.current?.focus(); }}><X size={15} /></button></header>
      {children(() => { close(); trigger.current?.focus(); })}
    </div>
  </>;
}
