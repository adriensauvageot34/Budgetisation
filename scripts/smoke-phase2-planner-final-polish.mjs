import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inventoryNavigator} from './lib/planner-browser-inventory.mjs';
const cli=process.env.AGENT_BROWSER_CLI,origin=process.env.PLANNER_C8_BROWSER_ORIGIN??'http://127.0.0.1:3115',out=path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT??'outputs/planner-r4-browser');
if(!cli)throw new Error('AGENT_BROWSER_CLI required');fs.mkdirSync(out,{recursive:true});let number=0,navigating=false,closeRetry=false;const passed=[],sizes=[];
function run(...args){if(!navigating&&['click','focus','hover','fill','scrollintoview'].includes(args[0]))reveal(args[1]);const filename=path.join(out,`r4-command-${++number}.json`),stderr=path.join(out,`r4-command-${number}.stderr`),a=fs.openSync(filename,'w'),b=fs.openSync(stderr,'w');let result;
  try{result=spawnSync(process.execPath,[cli,'--session','planner-r4-smoke','--json',...args],{stdio:['ignore',a,b],windowsHide:true,timeout:60000});}finally{fs.closeSync(a);fs.closeSync(b);}
  if(result.error)throw result.error;const data=JSON.parse(fs.readFileSync(filename,'utf8'));if(args[0]==='close'&&!data.success&&/Failed to read/.test(data.error??'')&&!closeRetry){closeRetry=true;try{return run('close');}finally{closeRetry=false;}}assert.equal(data.success,true,`${args.join(' ')}: ${JSON.stringify(data)}`);return data.data;}
const evaluate=code=>{const value=run('eval',`JSON.stringify(${code})`).result;return typeof value==='string'?JSON.parse(value):value;};
const reveal=inventoryNavigator((...args)=>{navigating=true;try{return run(...args);}finally{navigating=false;}},evaluate);
const ready=()=>run('wait','--fn','document.querySelector("[data-composer]")?.getAttribute("aria-busy")==="false"');
const digest=()=>evaluate('document.querySelector("[data-composer]").dataset.digest');
const check=(id,fn)=>{fn();if(!passed.includes(id))passed.push(id);console.log(`${id} PASS`);};
const evidence=async scenario=>(await fetch(`${origin}/evidence?scenario=${scenario}`)).json();
const screenshot=(name,width,height)=>run('screenshot',path.join(out,`${name}-${width}x${height}.png`));
function navigate(scenario,width=1440,height=900){run('close');run('open',`${origin}/?scenario=${scenario}`);run('set','viewport',String(width),String(height));run('wait','[data-composer]');ready();run('snapshot','-i');assert.deepEqual(run('errors').errors,[]);}
const box=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
function move(selector){reveal(selector);const r=box(selector);run('mouse','move',String(Math.round(r.x+r.width/2)),String(Math.round(r.y+r.height/2)));run('mouse','move',String(Math.round(r.x+r.width/2+1)),String(Math.round(r.y+r.height/2)));}
function begin(selector){run('scrollintoview',selector);move(selector);run('mouse','down');const r=box(selector);run('mouse','move',String(Math.round(r.x+r.width/2+18)),String(Math.round(r.y+r.height/2-3)));run('wait','--fn','document.querySelector("[data-composer]").dataset.dragging==="true"');}
const release=()=>{run('mouse','up');ready();};
const undo=()=>{run('click','button[aria-label="Annuler la dernière modification du brouillon"]');ready();};
const redo=()=>{run('click','button[aria-label="Rétablir la modification du brouillon"]');ready();};
const activePage=()=>evaluate('Number(document.querySelector("[data-board-page-active]").dataset.boardPageActive)');
const stableBoxes=()=>evaluate('["[data-cockpit]","[data-board-scroll]","[data-palette-dock]"].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})');
function allocation(target,amount){run('fill',`[data-control="${target}"] [data-savings-inline] input`,amount);run('click',`[data-control="${target}"] [data-savings-inline] button`);ready();}
try {
  for(const [width,height] of [[1920,1080],[1728,900],[1440,900],[1440,760]]){
    navigate('RICH',width,height);const metrics=evaluate('(()=>{const workspace=document.querySelector("[data-composer]").getBoundingClientRect(),board=document.querySelector("[data-board-scroll]").getBoundingClientRect(),apply=document.querySelector("[data-apply]"),r=apply.getBoundingClientRect();return {width:innerWidth,height:innerHeight,workspaceHeight:workspace.height,boardHeight:board.height,pages:document.querySelectorAll("[data-board-page]").length,overflow:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight,applyVisible:r.top>=0&&r.bottom<=innerHeight&&apply.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),visibleCards:document.querySelector("[data-board-page][aria-hidden=false]").querySelectorAll("[data-inventory-id]").length}})()');
    assert.equal(metrics.overflow,false);assert.equal(metrics.vertical,false);assert.equal(metrics.applyVisible,true);assert.ok(metrics.visibleCards>1);sizes.push(metrics);screenshot('rich-month',width,height);
  }
  passed.push('R4-027','R4-028');
  for(const [width,height] of [[1920,1080],[1440,900]]){
    navigate('RR',width,height);screenshot('normal-board',width,height);
    const night=evaluate('document.querySelector("[data-context]").dataset.context'),focus=`[data-context="${night}"] [data-context-focus]`,before=`[data-socket="${night}:before"] [data-satellite]`,initial=digest(),bounds=stableBoxes();
    run('click',focus);assert.deepEqual(stableBoxes(),bounds);screenshot('night-selected',width,height);
    check('R4-010',()=>{run('focus',before);run('press','Enter');assert.equal(evaluate('!!document.activeElement.closest("[popover]:popover-open")'),true);});
    check('R4-011',()=>{const r=box('[popover]:popover-open');assert.ok(r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=height);assert.deepEqual(stableBoxes(),bounds);});screenshot('before-popover',width,height);
    run('press','Escape');assert.equal(evaluate(`document.querySelector('[data-context="${night}"]').dataset.focused`),'true');assert.equal(evaluate('!!document.querySelector("[popover]:popover-open")'),false);
    run('press','Escape');assert.equal(evaluate('!!document.querySelector("[data-context-palette]")'),false);run('click',focus);
    begin(before);move(focus);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');assert.deepEqual(stableBoxes(),bounds);screenshot('before-drag',width,height);release();const chosen=digest();assert.notEqual(chosen,initial);
    check('R4-016',()=>{undo();assert.equal(digest(),initial);redo();assert.equal(digest(),chosen);});
    begin(before);move('[data-trash]');screenshot('contextual-trash',width,height);release();undo();assert.equal(digest(),chosen);
    const protectedCard='[data-control][data-protected=true]';run('scrollintoview',protectedCard);screenshot('protected-savings',width,height);const protectedDigest=digest();begin(protectedCard);move('[data-trash]');screenshot('protected-trash',width,height);release();assert.equal(digest(),protectedDigest);passed.push('R4-PROTECTED-GESTURE');
    navigate('RB',width,height);const bNight=evaluate('document.querySelector("[data-context]").dataset.context');run('click',`[data-context="${bNight}"] [data-context-focus]`);const tram='[data-context-palette] [data-palette-asset="option:night-out:outbound:train"]';
    run('scrollintoview',tram);begin(tram);move(`[data-socket="${bNight}:outbound"] [data-satellite]`);release();check('R4-017',()=>{assert.equal(evaluate(`document.querySelectorAll('[data-socket="${bNight}:outbound"] [data-selection]').length`),1);assert.match(evaluate(`document.querySelector('[data-socket="${bNight}:outbound"] [data-satellite]').title`),/Train/);});screenshot('tram-replaces-uber',width,height);
    navigate('RC',width,height);const stay=evaluate('document.querySelector("[data-context]").dataset.context');run('click',`[data-context="${stay}"] [data-context-focus]`);run('click',`[data-socket="${stay}:restaurants"] [data-satellite]`);screenshot('weekend-restaurant',width,height);run('press','Escape');
    navigate('SAVINGS',width,height);
    run('click','[aria-label="Types de cartes"] button:last-child');const asset=evaluate('[...document.querySelectorAll("[data-asset]")].find(e=>e.textContent.includes("Projet disponible")).dataset.asset');assert.ok(asset.startsWith('control:'));
    const savingsInitial=digest();begin(`[data-asset="${asset}"]`);move('[data-add-element]');release();assert.equal(digest(),savingsInitial);assert.equal(evaluate('!!document.querySelector("dialog[open]")'),true);run('fill','dialog[open] input[name=amount]','25');run('click','dialog[open] [data-submit]');ready();
    const target=asset.slice('control:'.length);assert.equal(evaluate(`document.querySelector('[data-control="${target}"] strong').textContent`).includes('25'),true);screenshot('savings-inline',width,height);
    allocation(target,'30');const allocated=digest();undo();redo();assert.equal(digest(),allocated);undo();undo();assert.equal(digest(),savingsInitial);assert.equal(evaluate(`!!document.querySelector('[data-control="${target}"]')`),false);passed.push('R4-SAVINGS-BROWSER');
    navigate('RA',width,height);const assistantBase=digest();run('click','[data-balance]');ready();assert.equal(digest(),assistantBase);screenshot('assistant',width,height);check('R4-019',()=>{assert.ok(evaluate('document.querySelectorAll("[data-candidate]").length')>0);assert.equal(evaluate('!!document.querySelector("dialog[open]")'),false);});run('click','button[aria-label="Fermer les suggestions"]');
    run('click','[data-compare]');assert.equal(evaluate('!!document.querySelector("[data-apply]")'),false);assert.ok(evaluate('document.querySelector("[data-composer] header").textContent.includes("VARIANTE")'));
    const courses=evaluate('[...document.querySelectorAll("[data-control]")].find(e=>e.querySelector("h3").textContent==="Courses").dataset.control');run('click',`[data-control="${courses}"] [data-card-edit]`);run('fill','dialog[open] input[name=amount]','285');run('click','dialog[open] [data-submit]');ready();screenshot('compare',width,height);run('click','[data-compare-exit]');assert.equal(digest(),assistantBase);passed.push('R4-022');
    check('R4-020',()=>assert.ok(evaluate('document.querySelector("[data-cockpit]").textContent.includes("Projection à compléter")')));screenshot('plan-partial-honest',width,height);
    navigate('RICH',width,height);const richDigest=digest();run('click','button[aria-label="Page suivante du mois"]');run('wait','250');assert.equal(activePage(),1);assert.equal(digest(),richDigest);screenshot('page-2',width,height);
    check('R4-013',()=>{run('focus','[data-page-index="1"]');run('press','Home');run('wait','250');assert.equal(activePage(),0);run('press','ArrowRight');run('wait','250');assert.equal(activePage(),1);assert.equal(evaluate('document.activeElement.dataset.pageIndex'),'1');assert.equal(digest(),richDigest);});
    run('click','[data-page-index="0"]');run('wait','250');const richLog=(await evidence('RICH')).log.length;
    begin('[data-asset="template:activity"]');move('[data-board-edge="next"]');run('wait','900');assert.equal(activePage(),1);run('wait','800');assert.equal(activePage(),1);screenshot('drag-page-dwell',width,height);release();
    check('R4-014',()=>assert.equal(digest(),richDigest));assert.equal((await evidence('RICH')).log.length,richLog);assert.equal(evaluate('document.querySelector("[data-composer]").dataset.dragging'),'false');
  }
  navigate('RICH');run('set','media','light','reduced-motion');const reducedDigest=digest();run('click','[data-page-index="1"]');check('R4-030',()=>{assert.equal(activePage(),1);assert.equal(evaluate('getComputedStyle(document.querySelector("[data-plateau-track]")).transitionDuration'),'0s');assert.equal(digest(),reducedDigest);});
  const records={};for(const key of ['RR','RB','RC','RA','SAVINGS','RICH']){const e=await evidence(key);assert.equal(e.rpcCalls,0);assert.deepEqual(e.counts,{plans:0,revisions:0});assert.equal(e.historicalCanaryWrites,0);assert.ok(e.log.every(l=>l.uiPayloadFields.length===0));records[key]={counts:e.counts,rpcCalls:e.rpcCalls,historicalCanaryWrites:e.historicalCanaryWrites,requests:e.log.length};}
  passed.push('R4-007','R4-021','R4-025');assert.deepEqual(run('errors').errors,[]);
  fs.writeFileSync(path.join(out,'r4-browser-verification.json'),JSON.stringify({passed:[...new Set(passed)],sizes,records,remoteWrites:0,readyBadgeDeferred:'C7 production projection never COMPLETE; no fabricated badge.'},null,2));console.log(`R4 browser checks passed (${new Set(passed).size})`);
}catch(error){try{run('screenshot',path.join(out,'r4-failure.png'));fs.writeFileSync(path.join(out,'r4-failure-snapshot.json'),JSON.stringify(run('snapshot','-i'),null,2));}catch{}throw error;}
finally{run('close');}
