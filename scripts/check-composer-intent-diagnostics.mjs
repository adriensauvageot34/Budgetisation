import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {intentDiagnostics}=require('@/app/mois-a-venir/composer/intent-diagnostics');
const {IntentBudgetImpact,BudgetPreviewStatus,OpenMonthlyFinances}=require('@/app/mois-a-venir/composer/intent-budget-impact');
const {componentId,mobilityIntentId}=require('@/domain/phase2/planner/identity');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
globalThis.fetch=async()=>{throw Error('INTENT_DIAGNOSTICS_REMOTE_FORBIDDEN');};
const f=await readMonthFixture(),id=uuid(30800),sibling=uuid(30801),selectionId=uuid(30802);
let response=await handleComposerRequest(f.deps,householdId,{kind:'DROP',sequence:0,targetMonth:'2026-11',draft:f.semantic,assetKey:'template:activity',presetKey:'cinema',target:{kind:'BOARD_ZONE'},identity:id,selectionId:uuid(30803),values:{}});
assert(response.ok,response.code);
response=await handleComposerRequest(f.deps,householdId,{kind:'DROP',sequence:1,targetMonth:'2026-11',draft:response.model.semanticState,assetKey:'option:activity:transport:car',target:{kind:'CONTEXT_SOCKET',contextOccurrenceId:id,slotKey:'transport'},identity:uuid(30804),selectionId,values:{}});
assert(response.ok,response.code);
const diagnostic=(targetRef,message,severity='WARN')=>({targetRef,message,severity,code:'SYNTHETIC_DIAGNOSTIC',evidenceRefs:[]});
const own=[diagnostic(id,'Information du cinéma'),diagnostic(componentId(id,'transport',selectionId),'Information du poste transport'),diagnostic(mobilityIntentId(id,'transport'),'Information du trajet','BLOCK')];
const foreign=[diagnostic(sibling,'AUTRE_INTENTION'),diagnostic(componentId(sibling,'transport',selectionId),'AUTRE_POSTE'),diagnostic(null,'GLOBAL_HORS_INTENTION')];
const model={...response.model,board:{...response.model.board,diagnostics:[...own,...foreign,own[0]]}};
const digest=semanticStateDigest(model.semanticState);
assert.deepEqual(intentDiagnostics(model,id),own);
for(const status of ['FRESH','BLOCKED','STALE','PENDING']){
 const markup=renderToStaticMarkup(React.createElement(BudgetPreviewStatus.Provider,{value:status},React.createElement(OpenMonthlyFinances.Provider,
  {value:()=>assert.fail('Rendering must not open the monthly panel')},React.createElement(IntentBudgetImpact,{model,contextId:id}))));
 if(status==='FRESH'||status==='BLOCKED')for(const entry of own)assert(markup.includes(entry.message));
 else assert.doesNotMatch(markup,/Information du cinéma|Information du poste transport|Information du trajet/);
 for(const entry of foreign)assert(!markup.includes(entry.message));
 if(status==='FRESH')assert.match(markup,/Consulter les sources de ce mois/);
}
assert.equal(semanticStateDigest(model.semanticState),digest);assert.deepEqual(f.writes,[]);
console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,level:'LOCAL_REFERENCE_SCOPE_AND_RENDER'}));
