// B2 read-only presentation using actual persisted synthetic revisions. Never connects to Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import {performance} from 'node:perf_hooks';
import {require} from './lib/phase2-ts-loader.mjs';
import {persistedCase,cases} from './fixtures/b2-plan.mjs';
globalThis.fetch=async()=>{throw Error('B2_TEST_NETWORK_FORBIDDEN');};
const oldLoad=Module._load;
Module._load=function(name,...args){return name==='next/navigation'?{useRouter:()=>({refresh(){throw Error('B2_READ_ONLY');}})}:oldLoad.call(this,name,...args);};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {AppliedMonthView}=require('@/app/mois-a-venir/applied-month-view');
const {plannerDigest}=require('@/domain/phase2/planner/json');
const out='docs/status/evidence/b2-mois-a-venir-plan-ux';fs.mkdirSync(out,{recursive:true});
const results=[],timings=[];
for (const key of cases) {
  const {props,proof}=await persistedCase(key), before=plannerDigest(props);
  const start=performance.now(),html=renderToStaticMarkup(React.createElement(AppliedMonthView,props));
  timings.push({case:key,renderMs:+(performance.now()-start).toFixed(3),htmlBytes:Buffer.byteLength(html)});
  assert.equal(plannerDigest(props),before,'presentation must not mutate authority');
  assert.equal((html.match(/data-applied-remainder=/g)??[]).length,1);
  assert.equal((html.match(/data-plan-net-impact=/g)??[]).length,1);
  assert.ok(html.includes('Elle ne s’ajoute pas aux autres effets') || key==='D');
  if(key==='A'){assert.equal(proof.baseline,'650.00');assert.equal(proof.remainder,'580.00');assert.equal(proof.impact,'-70.00');assert.ok(html.includes('Courses'));}
  if(key==='B'){assert.equal(proof.impact,'0.00');assert.ok(html.includes('aucun supplément établi'));}
  if(key==='C'){
    assert.equal((html.match(/data-plan-short-stay=/g)??[]).length,1);
    assert.equal((html.match(/data-plan-child=/g)??[]).length,2);
    assert.equal((html.match(/data-plan-journey=/g)??[]).length,1);
  }
  if(key==='D'){assert.ok(html.includes('Protégée des ajustements'));assert.ok(!/Réduire|Diminuer/.test(html));}
  if(key==='E'){assert.ok(html.includes('pas un plein'));assert.ok(html.includes('Peugeot 207'));assert.ok(html.includes('Non fixée'));}
  if(key==='F'){assert.equal(proof.remainder,null);assert.ok(html.includes('100,00'));assert.ok(html.includes('À préciser'));}
  if(key==='G'){assert.equal(proof.counts.revisions,2);assert.equal(proof.freshness.activeRevision,'SUPERSEDED');assert.ok(html.includes('Une version plus récente de votre Plan existe.'));}
  if(key==='CHANGED'){assert.equal(proof.freshness.authorities,'CHANGED_AUTHORITIES');assert.ok(html.includes('Prévision actualisée'));}
  if(key==='UNAVAILABLE'){assert.equal(proof.freshness.activeRevision,'UNAVAILABLE');assert.ok(html.includes('La dernière version n’a pas pu être vérifiée.'));assert.ok(!html.includes('Plan à jour'));}
  if(key==='INTERACTIONS'){
    assert.equal(proof.impact,'-40.00');assert.equal((html.match(/data-plan-context=/g)??[]).length,4);
    assert.ok(props.comparison.decisions.some(d=>d.interactingDecisionIds.length));
    assert.ok(html.includes('Elle ne s’ajoute pas aux autres effets'));
  }
  if(key==='GIFT'){assert.ok(html.includes('Léa'));assert.ok(html.includes('Anniversaire'));assert.ok(html.includes('Un roman choisi'));assert.ok(html.includes('Livre'));}
  results.push({case:key,status:'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY',...proof});console.log(`B2_${key} PASS`);
}
const view=fs.readFileSync('src/app/mois-a-venir/applied-month-view.tsx','utf8');
assert.ok(!/readWorld|deriveMonthScenario|evaluatePlanScenario|\.reduce\(/.test(view));
assert.ok(view.includes('projection.plan.impactOnMonthEnd'));
const noPlan=fs.readFileSync('src/app/mois-a-venir/month-forecast-view.tsx','utf8');
assert.ok(noPlan.includes('!hasAppliedPlan') || noPlan.includes('!activePlan'));
fs.writeFileSync(`${out}/contract-results.json`,JSON.stringify({results,timings,financialWrites:'ONLY_EPHEMERAL_SYNTHETIC_C0',authenticatedPlan:'NOT_RUN'},null,2));
console.log(`${results.length} persisted B2 scenarios PASS; no authenticated Supabase claim.`);
