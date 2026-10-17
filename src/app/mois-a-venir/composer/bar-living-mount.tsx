"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import styles from "./composer.module.css";

type BarHost = {id:string;node:HTMLDivElement;focus:HTMLElement|null};
/** One ephemeral portal container per open card. Pagination moves the DOM
 * container; it must not unmount the editor that owns unadmitted RAW input. */
export function useBarLivingHost(id:string|undefined) {
  const [host,setHost]=useState<BarHost|null>(null);
  useEffect(()=>{
    if(!id){setHost(null);return;}
    const node=document.createElement("div");node.className=styles.barLivingHost;
    const next:BarHost={id,node,focus:null};
    const remember=(event:FocusEvent)=>{if(event.target instanceof HTMLElement)next.focus=event.target;};
    node.addEventListener("focusin",remember);setHost(next);
    return()=>{node.removeEventListener("focusin",remember);node.remove();};
  },[id]);
  return host?.id===id?host:null;
}
export function BarLivingMount({host}:{host:BarHost|null}) {
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const mount=root.current;if(!host||!mount)return;
    mount.appendChild(host.node);
    if(host.focus?.isConnected&&document.activeElement===document.body)host.focus.focus({preventScroll:true});
    return()=>{
      if(document.activeElement instanceof HTMLElement&&host.node.contains(document.activeElement))host.focus=document.activeElement;
      if(host.node.parentElement===mount)host.node.remove();
    };
  },[host]);
  return <div ref={root} className={styles.barLivingMount} data-bar-living-mount/>;
}
