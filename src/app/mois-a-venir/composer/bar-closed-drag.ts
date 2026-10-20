"use client";
import {useEffect,useRef,useState,type PointerEvent,type DragEvent} from 'react';
import {useDragHandle} from './interactions';

/** Only empty card surface can arm the existing HTML drag source. Never a control. */
export function isBarDragSurface(target:EventTarget|null,root:HTMLElement){
  return target instanceof Element&&!target.closest('button,a,input,select,textarea,summary,[role="button"],[role="dialog"],[role="tooltip"],[data-bar-cost-info],[contenteditable="true"]')&&root.contains(target);
}
export function useBarClosedDrag(source:string,enabled:boolean){
  const handle=useDragHandle(enabled?source:undefined),[armed,setArmed]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),origin=useRef<{x:number;y:number}|null>(null),ready=useRef(false),moved=useRef(false);
  const cancel=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;origin.current=null;ready.current=false;setArmed(false);};
  useEffect(()=>{if(!enabled)cancel();return()=>{if(timer.current!==null)clearTimeout(timer.current);};},[enabled]);
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
    },
    onDragEnd:()=>{handle.onDragEnd();cancel();},
    suppressClick:()=>moved.current,
  };
}
