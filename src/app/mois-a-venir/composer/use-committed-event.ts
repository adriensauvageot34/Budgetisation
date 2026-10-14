import {useCallback,useLayoutEffect,useRef} from 'react';
/** Stable identity for UI handlers, with the latest committed closure. It never
 * keeps a financial model beyond the current React commit. */
export function useCommittedEvent<A extends unknown[],R>(handler:(...args:A)=>R){
  const latest=useRef(handler);useLayoutEffect(()=>{latest.current=handler;});
  return useCallback((...args:A)=>latest.current(...args),[]);
}
