"use client";
import {useEffect,useRef,useState,type PointerEvent,type DragEvent} from 'react';
import {useDragHandle} from './interactions';

/** Native image of this existing card, never a second business component.
 * Kept until dragend so Chromium can rasterize the real artwork and contents. */
export function barNativeDragImage(card:HTMLElement,event:DragEvent<HTMLElement>){
  if(typeof card.cloneNode!=="function"||!event.dataTransfer)return ()=>{};
  const rect=card.getBoundingClientRect(),image=card.cloneNode(true) as HTMLElement;
  image.setAttribute('aria-hidden','true');image.inert=true;
  image.dataset.barNativeDragImage='true';
  image.removeAttribute('id');image.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  Object.assign(image.style,{position:'fixed',left:'-10000px',top:'0',width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',pointerEvents:'none',opacity:'.92',transform:'none',boxShadow:'0 12px 28px #62452230'});
  document.body.appendChild(image);
  try{event.dataTransfer.setDragImage(image,Math.max(0,Math.min(rect.width,event.clientX-rect.left)),Math.max(0,Math.min(rect.height,event.clientY-rect.top)));}
  catch{image.remove();return ()=>{};}
  return ()=>image.remove();
}

/** Only empty card surface can arm the existing HTML drag source. Never a control. */
export function isBarDragSurface(target:EventTarget|null,root:HTMLElement){
  return target instanceof Element&&!target.closest('button,a,input,select,textarea,summary,[role="button"],[role="dialog"],[role="tooltip"],[data-bar-cost-info],[contenteditable="true"]')&&root.contains(target);
}
export function useBarClosedDrag(source:string,enabled:boolean){
  const handle=useDragHandle(enabled?source:undefined),[armed,setArmed]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),origin=useRef<{x:number;y:number}|null>(null),ready=useRef(false),moved=useRef(false);
  const clearImage=useRef<(()=>void)|null>(null);
  const cancel=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;origin.current=null;ready.current=false;setArmed(false);};
  useEffect(()=>{if(!enabled)cancel();return()=>{if(timer.current!==null)clearTimeout(timer.current);clearImage.current?.();clearImage.current=null;};},[enabled]);
  return {
    draggable:handle.draggable,'data-drag-source':handle['data-drag-source'],'data-grabbed':handle['data-grabbed'],'data-drag-armed':armed,
    onPointerDown:(event:PointerEvent<HTMLElement>)=>{
      cancel();moved.current=false;
      if(!enabled||event.button!==0||!isBarDragSurface(event.target,event.currentTarget))return;
      origin.current={x:event.clientX,y:event.clientY};
      timer.current=setTimeout(()=>{timer.current=null;ready.current=true;setArmed(true);},180);
    },
    onPointerMove:(event:PointerEvent<HTMLElement>)=>{if(timer.current!==null&&origin.current&&Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>6)cancel();},
    onPointerUp:cancel,onPointerCancel:cancel,
    onPointerLeave:()=>{if(!ready.current)cancel();},
    onDragStart:(event:DragEvent<HTMLElement>)=>{
      // Satellites stop their own drag event. Unhandled native image/text drags
      // inside controls must not become the parent card's source.
      if(event.target!==event.currentTarget){event.preventDefault();return;}
      if(!ready.current){event.preventDefault();return;}
      moved.current=true;handle.onDragStart(event);
      if(!event.defaultPrevented){clearImage.current?.();clearImage.current=barNativeDragImage(event.currentTarget,event);}
    },
    onDragEnd:()=>{handle.onDragEnd();clearImage.current?.();clearImage.current=null;cancel();},
    suppressClick:()=>moved.current,
  };
}
