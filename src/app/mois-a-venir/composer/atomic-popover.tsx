import { useId, useRef, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./composer.module.css";
import { useDragHandle } from "./interactions";

/** Shared transient placement, independent of semantic or financial state. */
export function placeAtomicPopover(node:HTMLElement,trigger:HTMLElement){
  const anchor=trigger.getBoundingClientRect(),box=node.getBoundingClientRect(),margin=12;
  node.style.left=`${Math.max(margin,Math.min(innerWidth-box.width-margin,anchor.left+anchor.width/2-box.width/2))}px`;
  const below=anchor.bottom+9;
  node.style.top=`${Math.max(margin,Math.min(innerHeight-box.height-margin,below+box.height<=innerHeight-margin?below:anchor.top-box.height-9))}px`;
}

/** Controlled surface for an existing value trigger. Manual dismissal always
 * goes through its owner's RAW guard; native light-dismiss cannot discard it. */
export function AnchoredAtomicPopover({label,anchor,onClose,children}:{label:string;anchor:()=>HTMLElement|null;onClose:()=>void;children:ReactNode}){
  const id=useId(),panel=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const node=panel.current,trigger=anchor();if(!node||!trigger)return;
    let alive=true,frame=0;
    const place=()=>{if(node.isConnected&&node.matches(':popover-open'))placeAtomicPopover(node,trigger);};
    // Board page stabilization closes native popovers. The controlled cost scene
    // still owns this one; reopen after that move, never over a RAW modal.
    const toggle=(event:Event)=>{if((event as ToggleEvent).newState!=="closed")return;
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(alive&&node.isConnected&&!document.querySelector('dialog[open]')){node.showPopover();place();(node.querySelector<HTMLElement>('input')??node.querySelector<HTMLElement>('button'))?.focus({preventScroll:true});}});
    };
    node.addEventListener('toggle',toggle);node.showPopover();place();
    (node.querySelector<HTMLElement>('input')??node.querySelector<HTMLElement>('button'))?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{
      if(!(event.target instanceof Node)||node.contains(event.target)||trigger.contains(event.target)||document.querySelector('dialog[open]'))return;
      event.preventDefault();event.stopPropagation();closeRef.current();
    };
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('transitionend',place,true);document.addEventListener('animationend',place,true);document.addEventListener('pointerdown',outside,true);
    return()=>{alive=false;cancelAnimationFrame(frame);node.removeEventListener('toggle',toggle);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('transitionend',place,true);document.removeEventListener('animationend',place,true);document.removeEventListener('pointerdown',outside,true);node.hidePopover();if(!document.querySelector('dialog[open]'))trigger.isConnected&&trigger.focus({preventScroll:true});};
    // The anchor is the value button for this mounted scene; never refocus on a keystroke.
  },[]);
  return <div ref={panel} popover="manual" role="dialog" aria-labelledby={id} className={`${styles.atomicPopover} ${styles.barCostPopover}`} data-bar-cost-popover
    onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();}}}>
    <header><h4 id={id}>{label}</h4><button type="button" className={styles.iconButton} aria-label="Fermer le coût prévu" onClick={onClose}><X size={15}/></button></header>
    {children}
  </div>;
}

/** Viewport coordinates are transient DOM placement, never part of a draft. */
export function AtomicPopover({ label, state, selectionId, empty, children, icon, focus, dragSourceKey, utility }: {
  label: string; state: string; selectionId?: string; empty?: boolean; icon: ReactNode;
  children: (close: () => void) => ReactNode; focus: () => void; dragSourceKey?: string; utility?: boolean;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), [open, setOpen] = useState(false);
  const titleId = `${id}-title`;
  const dragProps = useDragHandle(dragSourceKey);
  const close = () => panel.current?.hidePopover();
  useEffect(() => {
    const node = panel.current;
    const place = () => {
      if (!node?.matches(":popover-open") || !trigger.current) return;
      placeAtomicPopover(node,trigger.current);
    };
    const toggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") { setOpen(true); place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
        node?.querySelector<HTMLElement>("[data-popover-title]")?.focus(); }
      else { setOpen(false); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
        if (!document.querySelector("dialog[open]") && (!document.activeElement || document.activeElement === document.body || node?.contains(document.activeElement))) trigger.current?.focus(); }
    };
    node?.addEventListener("toggle", toggle);
    return () => { node?.removeEventListener("toggle", toggle); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, []);
  return <>
    <button ref={trigger} type="button" className={utility ? styles.iconButton : styles.satellite} data-context-actions={utility || undefined} data-satellite={utility ? undefined : true} data-selection={selectionId} data-state={state} data-empty={empty || undefined} {...dragProps}
      title={label} aria-label={label} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={() => { focus(); panel.current?.togglePopover(); }}>{icon}</button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={titleId} className={styles.atomicPopover} data-atomic-popover>
      <header><h4 id={titleId} tabIndex={-1} data-popover-title>{label}</h4><button type="button" className={styles.iconButton} aria-label="Fermer les détails" onClick={() => { close(); trigger.current?.focus(); }}><X size={15} /></button></header>
      {open && children(() => { close(); trigger.current?.focus(); })}
    </div>
  </>;
}
