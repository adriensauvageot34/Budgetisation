/** Explicit ?barProbe=1 only. Bounded DOM geometry; no content, identities,
 * network interception, semantic state or financial calculation. */
export function startBarReceptionProbe(root: HTMLElement) {
  let frame=0,left=0,total=0,run=0,started=0,mutations=0,resizes=0;
  const samples:unknown[]=[];
  const events:unknown[]=[],paints:unknown[]=[],requests:unknown[]=[],states:unknown[]=[],drags:unknown[]=[];
  let lastState='';
  const publishLatency=()=>{root.dataset.barLatency=JSON.stringify({
    method:'NATIVE_EVENT_TIMING_16MS_THRESHOLD_8MS_QUANTIZATION_NOT_ALL_EVENTS_OR_DISPLAY_PHOTONS',
    eventTimingSupported:typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('event'),
    events,paints,requests,states,drags});};
  const category=(node:Element|null)=>node?.matches('input[aria-label="Prix unitaire (€)"]')?'PRICE_INPUT'
    :node?.closest('[data-trash]')?'TRASH':node?.getAttribute('aria-label')==='Annuler la dernière modification du brouillon'?'UNDO'
    :node?.closest('[data-bar-living-card]')?'BAR':node?.closest('[data-bar-dock]')?'DOCK':'OTHER';
  const eventTiming=typeof PerformanceObserver!=='undefined'?new PerformanceObserver(list=>{
    for(const raw of list.getEntries()){
      const entry=raw as PerformanceEntry&{target?:Node;processingStart?:number;processingEnd?:number;interactionId?:number};
      if(!['keydown','click','dragstart','dragend','drop'].includes(entry.name))continue;
      const target=entry.target instanceof Element?entry.target:null;
      // A successful removal detaches its trigger before the observer runs.
      // Attribute it only to a trusted event already captured inside this root.
      const captured=(events as {name:string;start:number;category:string}[]).find(event=>event.name===entry.name&&Math.abs(event.start-entry.startTime)<0.01);
      if((!target||!root.contains(target))&&!captured||paints.length>=300)continue;
      paints.push({name:entry.name,category:captured?.category??category(target),start:entry.startTime,duration:entry.duration,
        processingStart:entry.processingStart,processingEnd:entry.processingEnd,interactionId:entry.interactionId});
    }publishLatency();
  }):null;
  if(eventTiming&&PerformanceObserver.supportedEntryTypes.includes('event'))eventTiming.observe({type:'event',durationThreshold:16} as PerformanceObserverInit&{durationThreshold:number});
  const resourceTiming=typeof PerformanceObserver!=='undefined'?new PerformanceObserver(list=>{
    for(const raw of list.getEntries()){
      const entry=raw as PerformanceResourceTiming;let pathname='';
      try{pathname=new URL(entry.name).pathname;}catch{continue;}
      if(!['/interaction','/draft','/api/composer/preview','/api/composer/drafts'].includes(pathname)||requests.length>=100)continue;
      const phase=pathname==='/draft'||pathname==='/api/composer/drafts'?'DRAFT_HTTP':pathname==='/api/composer/preview'?'PREVIEW_HTTP':'MUTATE_OR_PREVIEW_FIXTURE';
      requests.push({phase,correlation:`${phase}-${requests.length+1}`,path:pathname,status:(entry as PerformanceResourceTiming&{responseStatus?:number}).responseStatus??null,start:entry.startTime,duration:entry.duration,requestStart:entry.requestStart,
        responseStart:entry.responseStart,responseEnd:entry.responseEnd,transferSize:entry.transferSize});
    }publishLatency();
  }):null;
  if(resourceTiming&&PerformanceObserver.supportedEntryTypes.includes('resource'))resourceTiming.observe({type:'resource'});
  const rect=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const visible=(node:Element)=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&!node.closest('[inert],[aria-hidden="true"]');};
  const bar=()=>root.querySelector<HTMLElement>('[data-bar-living-card]');
  function sample(){
    frame=0;const card=bar();
    if(card&&visible(card)){
      const b=card.getBoundingClientRect();
      const neighbors=[...root.querySelectorAll<HTMLElement>('[data-inventory-id]')].filter(node=>!node.contains(card)&&visible(node));
      const collisions=neighbors.filter(node=>{const n=node.getBoundingClientRect();return Math.min(b.right,n.right)-Math.max(b.left,n.left)>2&&Math.min(b.bottom,n.bottom)-Math.max(b.top,n.top)>2;});
      const dock=root.querySelector<HTMLElement>('[data-bar-dock]');
      const host=card.closest('[data-inventory-id]'),board=root.querySelector('[data-board-scroll]');
      samples.push({run,ms:Math.round((performance.now()-started)*100)/100,scene:card.querySelector('[data-bar-step]')?.getAttribute('data-bar-step')??'closed',expanded:card.dataset.expanded,
        bar:rect(card),transform:getComputedStyle(card).transform,hostTransform:host?getComputedStyle(host).transform:null,
        scrollLeft:board?.scrollLeft??0,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
        collisions:collisions.map(rect),neighbors:neighbors.slice(0,24).map((node,index)=>({index,...rect(node),transform:getComputedStyle(node).transform})),
        cardScroll:[card.scrollWidth,card.clientWidth,card.scrollHeight,card.clientHeight],
        dockScroll:dock?[dock.scrollWidth,dock.clientWidth,dock.scrollHeight,dock.clientHeight]:null,
        focusTag:document.activeElement?.tagName??null,mutations,resizes});
    }
    total++;if(--left>0&&total<900)frame=requestAnimationFrame(sample);
    else root.dataset.barReception=JSON.stringify({method:'DOM_RAF_SAMPLES_NOT_FINANCIAL_OR_AUTH_PROOF',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},samples});
  }
  const begin=(event?:Event)=>{
    if(event?.isTrusted&&events.length<400){const target=event.target instanceof Element?event.target:null;events.push({name:event.type,category:category(target),start:event.timeStamp,handler:performance.now(),...(event.type.startsWith('drag')||event.type==='drop'?{x:(event as DragEvent).clientX,y:(event as DragEvent).clientY}:{})});publishLatency();}
    if(total>=900||run>=40)return;started=performance.now();run++;left=32;if(!frame)frame=requestAnimationFrame(sample);
  };
  const observeState=()=>{
    const state={preview:root.dataset.previewState,save:root.dataset.saveState,dragging:root.dataset.dragging,
      removing:!!root.querySelector('[data-bar-living-card][data-removing="true"]'),barPresent:!!bar()};
    const key=JSON.stringify(state);if(key!==lastState&&states.length<160){lastState=key;states.push({ms:performance.now(),...state});}
    const trash=root.querySelector('[data-trash]');
    if(trash&&visible(trash)&&drags.length<40)drags.push({ms:performance.now(),kind:'VISIBLE_TRASH',rect:rect(trash),compatible:trash.getAttribute('data-compatible'),over:trash.getAttribute('data-drag-over')});
    publishLatency();
  };
  const observer=new MutationObserver(()=>{mutations++;observeState();});observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-preview-state','data-save-state','data-dragging','data-removing','data-drag-over']});
  const resize=new ResizeObserver(()=>{resizes++;});resize.observe(root);
  const eventNames=['click','keydown','input','dragstart','dragenter','dragover','dragend','drop'];
  for(const name of eventNames)root.addEventListener(name,begin,true);
  begin();observeState();
  return()=>{observer.disconnect();resize.disconnect();eventTiming?.disconnect();resourceTiming?.disconnect();if(frame)cancelAnimationFrame(frame);for(const name of eventNames)root.removeEventListener(name,begin,true);};
}
