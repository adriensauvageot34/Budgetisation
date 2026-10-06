import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const cli=process.env.AGENT_BROWSER_CLI,origin=process.env.PLANNER_C8_BROWSER_ORIGIN??'http://127.0.0.1:3115',out=path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT??'outputs/planner-r3-browser');
if(!cli)throw new Error('AGENT_BROWSER_CLI required');fs.mkdirSync(out,{recursive:true});let number=0;const passed=[];
function run(...args){const filename=path.join(out,`r3-command-${++number}.json`),stderr=path.join(out,`r3-command-${number}.stderr`),a=fs.openSync(filename,'w'),b=fs.openSync(stderr,'w');let result;
  try{result=spawnSync(process.execPath,[cli,'--session','planner-r3-smoke','--json',...args],{stdio:['ignore',a,b],windowsHide:true,timeout:60000});}finally{fs.closeSync(a);fs.closeSync(b);}
  if(result.error)throw result.error;const data=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(data.success,true,`${args.join(' ')}: ${JSON.stringify(data)}`);return data.data;}
const evaluate=code=>{const value=run('eval',`JSON.stringify(${code})`).result;return typeof value==='string'?JSON.parse(value):value;};
const ready=()=>run('wait','--fn','document.querySelector("[data-composer]")?.getAttribute("aria-busy")==="false"');
const digest=()=>evaluate('document.querySelector("[data-composer]").dataset.digest');
const check=(id,fn)=>{fn();passed.push(id);console.log(`${id} PASS`);};
const evidence=async scenario=>(await fetch(`${origin}/evidence?scenario=${scenario}`)).json();
const screenshot=name=>run('screenshot',path.join(out,`${name}.png`));
function navigate(scenario,extra=''){run('close');run('open',`${origin}/?scenario=${scenario}${extra}`);run('set','viewport','1440','900');run('wait','[data-composer]');ready();run('snapshot','-i');}
function box(selector){return evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);}
function move(selector){const r=box(selector);run('mouse','move',String(Math.round(r.x+r.width/2)),String(Math.round(r.y+r.height/2)));run('mouse','move',String(Math.round(r.x+r.width/2+1)),String(Math.round(r.y+r.height/2)));}
function begin(selector){run('scrollintoview',selector);move(selector);run('mouse','down');const r=box(selector);run('mouse','move',String(Math.round(r.x+r.width/2+9)),String(Math.round(r.y+r.height/2-5)));run('mouse','move',String(Math.round(r.x+r.width/2+18)),String(Math.round(r.y+r.height/2-3)));
  run('wait','--fn','document.querySelector("[data-composer]").dataset.dragging==="true"');}
const release=()=>{run('mouse','up');ready();};
const undo=()=>{run('click','button[aria-label="Annuler la dernière modification du brouillon"]');ready();};
const redo=()=>{run('click','button[aria-label="Rétablir la modification du brouillon"]');ready();};
function adjust(amount){const target=evaluate('[...document.querySelectorAll("[data-control]")].find(e=>e.querySelector("h3").textContent==="Courses").dataset.control');
  run('scrollintoview',`[data-control="${target}"]`);run('click',`[data-control="${target}"] [data-card-edit]`);run('fill','dialog[open] input[name=amount]',amount);run('click','dialog[open] [data-submit]');ready();assert.equal(evaluate('!!document.querySelector("dialog[open]")'),false);}
try{
  navigate('RR','&delayDrop=true');const night=evaluate('document.querySelector("[data-context]").dataset.context');run('click',`[data-context="${night}"] [data-context-focus]`);
  const before=`[data-socket="${night}:before"] [data-satellite]`,nucleus=`[data-context="${night}"] [data-context-focus]`,initial=digest(),canonical=evaluate('document.querySelector("[data-remainder]").textContent');
  check('R3-006-BROWSER',()=>assert.equal(evaluate('!!document.querySelector("[data-trash]")'),false));
  begin(before);move(nucleus);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');
  check('R3-003-BROWSER',()=>{assert.equal(digest(),initial);assert.equal(evaluate('document.querySelector("[data-gesture-impact] small").textContent'),'impact de ce geste');});screenshot('before-hover');
  move('h1');run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="false"');
  check('R3-005-BROWSER',()=>assert.equal(evaluate('document.querySelector("[data-remainder]").textContent'),canonical));
  move(nucleus);move('h1');run('wait','1200');
  check('R3-004-BROWSER',()=>{assert.equal(evaluate('document.querySelector("[data-cockpit]").dataset.temporary'),'false');assert.equal(digest(),initial);});
  move(nucleus);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');release();
  check('R3-001-BROWSER',()=>{assert.equal(evaluate(`document.querySelector(${JSON.stringify(before)}).dataset.state`),'CHOSEN');assert.notEqual(digest(),initial);});screenshot('before-equipped');
  const equipped=digest();undo();assert.equal(digest(),initial);redo();assert.equal(digest(),equipped);passed.push('R3-UNDO-REDO-BROWSER');
  begin(before);move(`[data-socket="${night}:outbound"]`);release();
  check('R3-002-BROWSER',()=>assert.equal(digest(),equipped));
  const protectedCard='[data-control][data-protected=true]';run('scrollintoview',protectedCard);begin(protectedCard);run('wait','[data-trash][data-protected=true]');screenshot('protected-trash');move('[data-trash]');release();
  check('R3-009-BROWSER',()=>{assert.equal(digest(),equipped);assert.equal(evaluate('!!document.querySelector("[data-trash]")'),false);assert.equal(evaluate('!!document.querySelector("[role=alert]")'),false);});
  run('click','[data-completeness-toggle]');assert.equal(evaluate('document.querySelector("[data-mosaic]").dataset.completenessFocus'),'true');run('press','Escape');assert.equal(evaluate('document.querySelector("[data-mosaic]").dataset.completenessFocus'),'false');passed.push('R3-COMPLETENESS-BROWSER');
  // A direct ONE_OF replacement uses the actual palette, satellite and server preview.
  navigate('RB');const bNight=evaluate('document.querySelector("[data-context]").dataset.context');run('click',`[data-context="${bNight}"] [data-context-focus]`);
  const tram='[data-context-palette] [data-palette-asset="option:night-out:outbound:train"]',transport=`[data-socket="${bNight}:outbound"] [data-satellite]`;
  evaluate(`document.querySelector(${JSON.stringify(tram)}).scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})`);run('snapshot','-i');
  begin(tram);move(transport);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');screenshot('tram-replaces-uber-preview');release();
  check('R3-010-BROWSER',()=>{assert.equal(evaluate(`document.querySelectorAll('[data-socket="${bNight}:outbound"] [data-selection]').length`),1);assert.match(evaluate(`document.querySelector(${JSON.stringify(transport)}).title`),/Train/);});screenshot('tram-equipped');
  undo();run('focus',tram);run('press','Enter');ready();
  check('R3-021-BROWSER',()=>assert.match(evaluate(`document.querySelector(${JSON.stringify(transport)}).title`),/Train/));
  // Library -> independent context -> existing REPARENT, keeping exactly the same identity.
  navigate('RC');const stay=evaluate('document.querySelector("[data-context]").dataset.context');run('fill','input[aria-label="Rechercher une intention"]','Restaurant');run('snapshot','-i');run('scrollintoview','[data-add-element]');
  begin('[data-asset="template:restaurant"]');assert.equal(evaluate('document.querySelector("[data-pack-ghost]").textContent.includes("Estimation après ajout")'),true);move('[data-add-element]');release();
  const independent=evaluate('[...document.querySelectorAll("[data-context]")].find(e=>!e.parentElement.closest("[data-context]")&&e.querySelector("h3").textContent==="Restaurant").dataset.context');
  run('scrollintoview',`[data-context="${stay}"]`);run('snapshot','-i');begin(`[data-context="${independent}"] button[aria-label^="Déplacer "]`);
  run('scrollintoview',`[data-context="${stay}"]`);move(`[data-context="${stay}"] [data-context-focus]`);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');screenshot('restaurant-reparent-preview');release();
  check('R3-011-BROWSER',()=>{assert.equal(evaluate(`document.querySelectorAll('[data-context="${independent}"]').length`),1);assert.equal(evaluate(`!!document.querySelector('[data-context="${stay}"] [data-context="${independent}"]')`),true);});
  // Structural ghosts never invent an accepted component or a pack total.
  run('fill','input[aria-label="Rechercher une intention"]','Soirée');run('scrollintoview','[data-add-element]');run('snapshot','-i');const ghostDigest=digest();begin('[data-asset="template:night-out"]');move('[data-add-element]');screenshot('night-pack-ghost');
  check('R3-012-BROWSER',()=>{assert.equal(digest(),ghostDigest);assert.ok(evaluate('!!document.querySelector("[data-pack-ghost]")'));assert.equal(evaluate('document.querySelector("[data-pack-ghost]").textContent.includes("Estimation après ajout")'),true);});move('h1');release();assert.equal(digest(),ghostDigest);
  // Small suggestion hand, actual ACCEPT owner and candidate regeneration.
  navigate('RA');run('click','[data-balance]');ready();run('snapshot','-i');const oldSet=evaluate('document.querySelector("[data-candidate-set]").dataset.candidateSet');screenshot('assistant-hand');
  check('R3-015-BROWSER',()=>{assert.equal(evaluate('!!document.querySelector("dialog[open]")'),false);assert.ok(evaluate('document.querySelectorAll("[data-candidate]").length')>0);});
  const candidateTarget=evaluate('document.querySelector("[data-candidate]").dataset.candidateTarget');run('scrollintoview',`[data-control="${candidateTarget}"]`);run('snapshot','-i');
  begin('[data-candidate]');move(`[data-control="${candidateTarget}"] h3`);run('wait','--fn','document.querySelector("[data-cockpit]").dataset.temporary==="true"');screenshot('assistant-drag-preview');release();passed.push('R3-ASSISTANT-DRAG-BROWSER');
  check('R3-016-BROWSER',()=>assert.notEqual(evaluate('document.querySelector("[data-candidate-set]").dataset.candidateSet'),oldSet));run('click','[data-candidate]');ready();passed.push('R3-ASSISTANT-CLICK-BROWSER');run('click','button[aria-label="Fermer les suggestions"]');
  const comparisonBase=digest();assert.equal(evaluate('document.querySelector("[data-cockpit] [data-tone=positive] b").textContent.includes("€")'),true);
  run('click','[data-compare]');assert.equal(evaluate('!!document.querySelector("[data-apply]")'),false);adjust('800');const firstVariant=digest();assert.notEqual(firstVariant,comparisonBase);screenshot('compare-variant');
  assert.equal(evaluate('!!document.querySelector("[data-cockpit] [data-tone=negative] b")'),true);passed.push('R3-GOAL-TENSION-BROWSER');
  undo();assert.equal(digest(),comparisonBase);redo();assert.equal(digest(),firstVariant);run('click','[data-compare-exit]');
  check('R3-017-BROWSER',()=>assert.equal(digest(),comparisonBase));run('click','[data-compare]');adjust('285');const kept=digest();run('click','[data-compare-keep]');
  check('R3-018-BROWSER',()=>{assert.equal(digest(),kept);assert.equal(evaluate('document.querySelector("[data-composer]").dataset.comparing'),'false');});undo();assert.equal(digest(),comparisonBase);
  const a=await evidence('RA');assert.equal(a.rpcCalls,0);assert.deepEqual(a.counts,{plans:0,revisions:0});passed.push('R3-019-BROWSER');
  run('set','media','light','reduced-motion');run('snapshot','-i');
  check('R3-022-BROWSER',()=>{const value=evaluate('({transition:getComputedStyle(document.querySelector("[data-control]")).transitionDuration,animation:getComputedStyle(document.querySelector("[data-control]")).animationDuration})');assert.equal(value.transition,'0s');assert.equal(value.animation,'0s');});run('click','[data-compare]');adjust('290');run('click','[data-compare-exit]');assert.equal(digest(),comparisonBase);
  const evidenceByScenario={};for(const key of ['RA','RB','RC','RR']){const e=await evidence(key);assert.equal(e.rpcCalls,0);assert.deepEqual(e.counts,{plans:0,revisions:0});assert.ok(e.log.every(l=>l.uiPayloadFields.length===0));evidenceByScenario[key]=e;}
  assert.deepEqual(run('errors').errors,[]);fs.writeFileSync(path.join(out,'r3-browser-verification.json'),JSON.stringify({passed,evidence:evidenceByScenario},null,2));console.log(`R3 browser checks passed (${passed.length})`);
}catch(error){try{screenshot('r3-failure');fs.writeFileSync(path.join(out,'r3-failure-snapshot.json'),JSON.stringify(run('snapshot','-i'),null,2));}catch{}throw error;}
finally{run('close');}
