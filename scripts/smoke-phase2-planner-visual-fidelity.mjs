import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inventoryNavigator} from './lib/planner-browser-inventory.mjs';
const cli=process.env.AGENT_BROWSER_CLI,origin=process.env.PLANNER_C8_BROWSER_ORIGIN??'http://127.0.0.1:3116',
  out=path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT??'outputs/planner-r5-browser');
if(!cli)throw new Error('AGENT_BROWSER_CLI required');
fs.mkdirSync(out,{recursive:true});let number=0,navigating=false;const passed=[],sizes=[];
function run(...args){
  if(!navigating&&['click','focus','hover','fill','scrollintoview'].includes(args[0]))reveal(args[1]);
  const stdout=path.join(out,'command-'+(++number)+'.json'),stderr=path.join(out,'command-'+number+'.stderr'),a=fs.openSync(stdout,'w'),b=fs.openSync(stderr,'w');
  let result;try{result=spawnSync(process.execPath,[cli,'--session','planner-r5-smoke','--json',...args],{stdio:['ignore',a,b],windowsHide:true,timeout:60000});}finally{fs.closeSync(a);fs.closeSync(b);}
  if(result.error)throw result.error;const data=JSON.parse(fs.readFileSync(stdout,'utf8'));assert.equal(data.success,true,args.join(' ')+': '+JSON.stringify(data));return data.data;
}
const evaluate=code=>{const v=run('eval','JSON.stringify('+code+')').result;return typeof v==='string'?JSON.parse(v):v;};
const reveal=inventoryNavigator((...args)=>{navigating=true;try{return run(...args);}finally{navigating=false;}},evaluate);
const ready=()=>run('wait','--fn','document.querySelector("[data-composer]")?.getAttribute("aria-busy")==="false"');
const digest=()=>evaluate('document.querySelector("[data-composer]").dataset.digest');
const check=(ids,fn)=>{fn();passed.push(...ids);console.log(ids.join(' ')+' PASS');};
const shot=name=>run('screenshot',path.join(out,name+'.png'));
const evidence=async key=>(await fetch(origin+'/evidence?scenario='+key)).json();
const box=selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect().toJSON()');
// Fresh documents avoid the real unsaved-draft beforeunload guard cancelling navigation.
function navigate(key,width=1728,height=900,extra=''){run('tab','new',origin+'/?scenario='+key+extra);run('set','viewport',String(width),String(height));run('wait','[data-composer]');ready();run('wait','250');}
function move(selector){reveal(selector);const r=box(selector),x=selector==='[data-board-drop]'?r.left+45:r.x+r.width/2,y=selector==='[data-board-drop]'?r.bottom-14:r.y+r.height/2;run('mouse','move',String(Math.round(x)),String(Math.round(y)));run('mouse','move',String(Math.round(x+1)),String(Math.round(y)));}
function begin(selector){run('scrollintoview',selector);move(selector);run('mouse','down');const r=box(selector);run('mouse','move',String(Math.round(r.x+r.width/2+18)),String(Math.round(r.y+r.height/2-3)));run('wait','--fn','document.querySelector("[data-composer]").dataset.dragging==="true"');}
function release(){run('mouse','up');ready();run('wait','250');}
const nightSelector=()=>evaluate('[...document.querySelectorAll("[data-context]")].find(e=>e.querySelector("h3").textContent.startsWith("Soirée")).dataset.context');
const metrics=()=>evaluate('(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect(),b=rect("[data-board-scroll]"),header=rect("[data-composer]>header"),lib=rect("[data-library]"),a=document.querySelector("[data-apply]"),ar=a.getBoundingClientRect(),visible=el=>{const r=el.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.left>=b.left&&r.right<=b.right},cards=[...document.querySelectorAll("[data-board-page][aria-hidden=false] [data-inventory-id]")].filter(visible),ys=[...new Set(cards.map(e=>Math.round(e.getBoundingClientRect().top)))],ls=rect("[data-library]"),assets=[...document.querySelectorAll("[data-asset]")].filter(e=>{const r=e.getBoundingClientRect();return r.top>=ls.top&&r.bottom<=ls.bottom});return {width:innerWidth,height:innerHeight,libraryWidth:lib.width,headerHeight:header.height,boardHeight:b.height,visibleCards:cards.length,firstRowCards:cards.filter(e=>Math.round(e.getBoundingClientRect().top)===ys[0]).length,rows:ys.length,pages:document.querySelectorAll("[data-board-page]").length,visibleAssets:assets.length,simpleMaxWidth:Math.max(...cards.filter(e=>e.firstElementChild.matches("[data-control][data-variant=SIMPLE]")).map(e=>e.getBoundingClientRect().width)),overflow:document.documentElement.scrollWidth>innerWidth,verticalOverflow:document.documentElement.scrollHeight>innerHeight,applyVisible:ar.top>=0&&ar.bottom<=innerHeight&&a.contains(document.elementFromPoint(ar.x+ar.width/2,ar.y+ar.height/2))}})()');
try{
  run('close');
  for(const [w,h] of [[1728,900],[1920,1080],[1440,900],[1440,760]]){
    navigate('VISUAL',w,h);const m=metrics();sizes.push(m);assert.equal(m.overflow,false);assert.equal(m.verticalOverflow,false);assert.equal(m.applyVisible,true);assert.ok(m.headerHeight<=90);assert.ok(m.libraryWidth>=270&&m.libraryWidth<=300);assert.ok(m.visibleAssets>=6);assert.ok(m.pages<=3);
    if(w===1728){assert.ok(m.visibleCards>=10);assert.ok(m.firstRowCards>=4&&m.firstRowCards<=5);assert.ok(m.rows>=2);}
    if(w===1920)assert.ok(m.visibleCards>=12);shot('NEW-rest-'+w+'x'+h);console.log(JSON.stringify(m));
  }
  passed.push('R5-009','R5-010','R5-011','R5-029','R5-030');
  navigate('VISUAL');const base=digest(),initialBoard=box('[data-board-scroll]'),id=nightSelector(),focus='[data-context="'+id+'"] [data-context-focus]';
  check(['R5-003','R5-015'],()=>assert.equal(evaluate('!!document.querySelector("[data-palette-dock]")'),false));
  check(['R5-016'],()=>{assert.ok(evaluate('[...document.querySelectorAll("[data-board-page][aria-hidden=false] [data-icon-scale=CARD] svg")].filter(e=>e.getBoundingClientRect().width>0).every(e=>e.getBoundingClientRect().width===52)'));});
  run('click',focus);check(['R5-018'],()=>{assert.equal(evaluate('document.querySelector('+JSON.stringify('[data-context="'+id+'"]')+').dataset.focused'),'true');assert.equal(evaluate('document.querySelector("[data-context-palette]").dataset.contextPalette'),id);assert.deepEqual(box('[data-board-scroll]'),initialBoard);});shot('NEW-context-selected');shot('NEW-equipment-palette');
  const satellite='[data-socket="'+id+':before"] [data-satellite]';run('focus',satellite);run('press','Enter');
  check(['R5-026'],()=>{const r=box('[popover]:popover-open');assert.ok(r.left>=12&&r.right<=1728-12&&r.top>=12&&r.bottom<=900-12);});shot('NEW-satellite-popover');run('press','Escape');assert.equal(evaluate('document.querySelector('+JSON.stringify('[data-context="'+id+'"]')+').dataset.focused'),'true');run('press','Escape');assert.equal(evaluate('!!document.querySelector("[data-context-palette]")'),false);
  run('click','[data-completeness-toggle]');check(['R5-005'],()=>{assert.equal(digest(),base);assert.equal(evaluate('document.querySelector("[data-mosaic]").dataset.completenessFocus'),'true');assert.ok(evaluate('[...document.querySelectorAll("[data-board-page][aria-hidden=false] [data-inventory-id]")].some(e=>getComputedStyle(e).opacity==="0.38")'));});shot('NEW-unresolved-focus');run('press','Escape');
  check(['R5-004'],()=>assert.ok(evaluate('[...document.querySelectorAll("[data-budget-unknown]")].every(e=>parseFloat(getComputedStyle(e).fontSize)<=11)')));
  run('click',focus);run('click','[data-page-index="1"]');run('wait','250');check(['R5-014'],()=>{assert.equal(digest(),base);assert.equal(evaluate('document.querySelector("[data-context-palette]").dataset.contextPalette'),id);});shot('NEW-page-selection-retained');run('click','[data-page-index="0"]');run('press','Escape');
  check(['R5-027'],()=>{const b=box('[data-board-scroll]');assert.ok(evaluate('[...document.querySelectorAll("[data-board-page][aria-hidden=false] [data-satellite]")].every(e=>{const r=e.getBoundingClientRect();const p=e.closest("[data-context]").getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom})'));assert.ok(b.height>650);});
  check(['R5-024'],()=>{run('press','/');assert.equal(evaluate('document.activeElement.hasAttribute("data-library-search")'),true);run('fill','[data-library-search]','Soiree');assert.equal(evaluate('document.querySelectorAll("[data-asset]").length'),1);run('press','Enter');assert.ok(evaluate('!!document.querySelector("dialog[open]")'));run('press','Escape');});
  run('fill','[data-library-search]','Activité');check(['R5-007'],()=>assert.equal(evaluate('document.querySelector('+JSON.stringify('[data-asset="template:activity"]')+').draggable'),true));
  begin('[data-asset="template:activity"]');move('[data-board-drop]');shot('NEW-drag-library');release();assert.notEqual(digest(),base);
  const afterDrop=digest();run('press','Control+z');ready();check(['R5-025'],()=>assert.equal(digest(),base));run('press','Control+Shift+z');ready();assert.equal(digest(),afterDrop);run('press','Control+z');ready();
  navigate('UNREADY');assert.equal(evaluate('document.querySelector("[data-apply]").disabled'),true);
  run('focus','[data-apply-control]');check(['R5-006'],()=>{assert.ok(evaluate('document.querySelector("[data-apply-reason]").getBoundingClientRect().height>0'));assert.ok(evaluate('document.querySelector("[data-apply-reason]").textContent.includes("à préciser")'));});shot('NEW-apply-disabled-reason');run('click','[data-show-unresolved]');assert.equal(evaluate('document.querySelector("[data-mosaic]").dataset.completenessFocus'),'true');run('press','Escape');
  navigate('RR');const rrId=nightSelector(),rrFocus='[data-context="'+rrId+'"] [data-context-focus]';run('click',rrFocus);const rrBefore='[data-socket="'+rrId+':before"] [data-satellite]',rrDigest=digest();
  begin(rrBefore);move(rrFocus);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');shot('NEW-drag-satellite');release();assert.notEqual(digest(),rrDigest);run('press','Control+z');ready();assert.equal(digest(),rrDigest);
  begin(rrBefore);move('[data-trash]');shot('NEW-trash');release();assert.notEqual(digest(),rrDigest);run('press','Control+z');ready();
  const protectedCard='[data-control][data-protected=true]';begin(protectedCard);check(['R5-028'],()=>{assert.equal(evaluate('document.querySelector("[data-drag-preview]").dataset.protected'),'true');assert.equal(evaluate('document.querySelector("[data-drag-amount]").textContent.trim()'),'Protégée');});move('[data-trash]');shot('NEW-protected');release();assert.equal(digest(),rrDigest);
  check(['R5-NATIVE-OVERFLOW'],()=>{assert.equal(evaluate('getComputedStyle(document.querySelector("[data-board-scroll]")).overflow'),'clip');assert.equal(evaluate('document.querySelector("[data-board-scroll]").scrollLeft'),0);});
  navigate('RA');const target=evaluate('[...document.querySelectorAll("[data-control]")].find(e=>e.querySelector("h3").textContent==="Courses").dataset.control'),card='[data-control="'+target+'"]';
  run('hover',card);check(['R5-019'],()=>assert.equal(evaluate('getComputedStyle(document.querySelector('+JSON.stringify(card)+').querySelector("[data-context-actions]").parentElement).opacity'),'1'));
  run('click',card+' [data-value-edit]');run('fill',card+' [data-amount-inline] input','280');run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');shot('NEW-inline-preview');run('click',card+' [data-amount-inline] button');ready();
  run('click','[data-balance]');ready();assert.ok(evaluate('document.querySelectorAll("[data-candidate]").length>0'));shot('NEW-assistant');run('click','button[aria-label="Fermer les suggestions"]');
  const compareBase=digest();run('click','[data-compare]');shot('NEW-compare');run('click','[data-compare-exit]');check(['R5-035'],()=>assert.equal(digest(),compareBase));
  navigate('RA',1728,900,'&delayHover=loading');const loadingBase=evaluate('document.querySelector("[data-remainder]").textContent'),loadingDigest=digest();
  run('hover','[data-control] [data-preset]');run('wait','--fn','document.querySelector("[data-cockpit]").dataset.calculating==="true"');
  check(['R5-023'],()=>{const pending=evaluate('({calculating:document.querySelector("[data-cockpit]").dataset.calculating,value:document.querySelector("[data-remainder]").textContent,label:document.querySelector("[data-cockpit]").textContent})');assert.equal(pending.calculating,'true');assert.equal(pending.value,loadingBase);assert.ok(pending.label.includes('Calcul…'));assert.equal(digest(),loadingDigest);});shot('NEW-preview-loading');
  run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');const loadingEvidence=await evidence('RA'),serverRemainder=loadingEvidence.log.at(-1).projection.plan.economicMonthEndRemainder;
  assert.equal(evaluate('document.querySelector("[data-remainder]").textContent'),serverRemainder===null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(serverRemainder)));assert.equal(digest(),loadingDigest);
  navigate('RA',1728,900,'&uiContract=ready');assert.equal(evaluate('document.querySelector("[data-ui-contract]").dataset.uiContract'),'ready-presentation-only');assert.equal(evaluate('!!document.querySelector("[data-plan-ready]")'),true);assert.equal(evaluate('document.querySelector("[data-apply]").disabled'),false);shot('NEW-apply-ready-contract-only');
  navigate('SPARSE');assert.equal(evaluate('document.querySelectorAll("[data-inventory-id]").length'),3);assert.equal(evaluate('!!document.querySelector("[data-carousel-nav]")'),false);shot('NEW-sparse-month');
  navigate('RICH');const rich=metrics();assert.ok(rich.pages<=3);shot('NEW-rich-month');const richDigest=digest();begin('[data-asset="template:activity"]');move('[data-board-edge="next"]');run('wait','900');assert.equal(evaluate('Number(document.querySelector("[data-board-page-active]").dataset.boardPageActive)'),1);run('wait','700');assert.equal(evaluate('Number(document.querySelector("[data-board-page-active]").dataset.boardPageActive)'),1);shot('NEW-drag-page-dwell');release();assert.equal(digest(),richDigest);
  run('set','media','light','reduced-motion');run('click','[data-page-index="0"]');check(['R5-032'],()=>{assert.equal(evaluate('getComputedStyle(document.querySelector("[data-plateau-track]")).transitionDuration'),'0s');assert.equal(digest(),richDigest);});
  const records={};for(const key of ['VISUAL','RR','RA','SPARSE','RICH']){const e=await evidence(key);assert.equal(e.rpcCalls,0);assert.deepEqual(e.counts,{plans:0,revisions:0});assert.equal(e.historicalCanaryWrites,0);assert.ok(e.log.every(l=>!l.uiPayloadFields.length));records[key]={requests:e.log.length,rpcCalls:e.rpcCalls,counts:e.counts};}
  assert.deepEqual(run('errors').errors,[]);
  fs.writeFileSync(path.join(out,'r5-browser-verification.json'),JSON.stringify({passed:[...new Set(passed)],sizes,records,rich,remoteWrites:0,readyFixture:'Presentation contract only; guarded against Apply; C7 never COMPLETE.'},null,2));
  console.log('R5 browser checks passed ('+new Set(passed).size+')');
}catch(error){try{shot('R5-failure');fs.writeFileSync(path.join(out,'failure-snapshot.json'),JSON.stringify(run('snapshot','-i'),null,2));}catch{}throw error;}
finally{run('close');}
