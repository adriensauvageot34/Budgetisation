/** Explicit ?barProbe=1 only. Bounded DOM geometry; no content, identities,
 * network interception, semantic state or financial calculation. */
export function startBarReceptionProbe(root: HTMLElement) {
  let frame=0,left=0,total=0,run=0,started=0,mutations=0,resizes=0;
  const samples:unknown[]=[];
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
      samples.push({run,ms:Math.round((performance.now()-started)*100)/100,scene:card.querySelector('[data-bar-step]')?.getAttribute('data-bar-step')??'closed',
        bar:rect(card),collisions:collisions.map(rect),neighbors:neighbors.slice(0,8).map(rect),
        cardScroll:[card.scrollWidth,card.clientWidth,card.scrollHeight,card.clientHeight],
        dockScroll:dock?[dock.scrollWidth,dock.clientWidth,dock.scrollHeight,dock.clientHeight]:null,
        focusTag:document.activeElement?.tagName??null,mutations,resizes});
    }
    total++;if(--left>0&&total<900)frame=requestAnimationFrame(sample);
    else root.dataset.barReception=JSON.stringify({method:'DOM_RAF_SAMPLES_NOT_FINANCIAL_OR_AUTH_PROOF',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},samples});
  }
  const begin=()=>{if(total>=900||run>=40)return;started=performance.now();run++;left=18;if(!frame)frame=requestAnimationFrame(sample);};
  const observer=new MutationObserver(()=>{mutations++;});observer.observe(root,{childList:true,subtree:true,characterData:true});
  const resize=new ResizeObserver(()=>{resizes++;});resize.observe(root);
  root.addEventListener('click',begin,true);root.addEventListener('keydown',begin,true);root.addEventListener('dragstart',begin,true);root.addEventListener('dragend',begin,true);
  begin();
  return()=>{observer.disconnect();resize.disconnect();if(frame)cancelAnimationFrame(frame);for(const event of ['click','keydown','dragstart','dragend'])root.removeEventListener(event,begin,true);};
}
