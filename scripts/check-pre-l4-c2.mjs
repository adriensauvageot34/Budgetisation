import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {l33Month} from './fixtures/planner-l3-3.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {planningBaselineDigest}=require('@/server/phase2/planner/baseline');
const {controlValuePresentation:present,controlValueSummary:summary}=require('@/app/mois-a-venir/composer/control-value-presentation');
const {controlAccessLabel,controlInputValue}=require('@/domain/phase2/planner/control-input');
const {InlineControlValue}=require('@/app/mois-a-venir/composer/inline-control-value');
const {ComposerFinancialInspector}=require('@/app/mois-a-venir/composer/composer-financial-inspector');
const {ComposerLibrary}=require('@/app/mois-a-venir/composer/composer-library');
const React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server');
globalThis.fetch=async()=>{throw Error('C2_REMOTE_FORBIDDEN');};
let {world,semantic}=l33Month(),reads=0,seq=0;
const deny=async()=>{throw Error('C2_WRITER_FORBIDDEN');};
const deps={readWorld:async()=>{reads++;return world;},repository:{readActivePlan:async()=>null,readRevision:async()=>null,readAppliedRequest:async()=>null,applyRevision:deny}};
const req=async(op,draft)=>{const r=await handleComposerRequest(deps,householdId,{sequence:++seq,targetMonth:'2026-11',draft,...op});assert.equal(r.ok,true,JSON.stringify(r));return r.model;};
const initial=await req({kind:'READ'},semantic),cards=m=>[...m.board.baselineControls,...m.board.discretionaryControls,...m.board.savings];
const rows=[];
const record=(name,card,expected)=>{const p=present(card);assert.equal(p.kind,expected);assert.doesNotMatch(controlAccessLabel(card),/Choix/);rows.push({name,id:card.targetRef,status:p.kind,label:p.label,summary:summary(card)});};
for(const label of ['Vêtements','Maison petit','Jeux / numérique ponctuel']){
 const card=cards(initial).find(c=>c.label===label);record(label+' absent',card,'UNKNOWN');
 assert.doesNotMatch(summary(card),/^0/);
 const zero=await req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:card.targetRef,value:{amount:'0.00'}}},initial.semanticState);
 const chosen=cards(zero).find(c=>c.targetRef===card.targetRef);record(label+' zéro explicite',chosen,'DECISION');assert.equal(present(chosen).value,'0.00');
}
const coffee=cards(initial).find(c=>c.label==='Café au travail Adrien');record('Café référence',coffee,'REFERENCE');
let current=await req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:coffee.targetRef,value:{count:'13'}}},initial.semanticState);
let c=cards(current).find(c=>c.targetRef===coffee.targetRef);record('Café count choisi prix historique',c,'DECISION');assert.equal(present(c,'unitAmount').kind,'REFERENCE');assert.match(summary(c),/prix de référence/);
assert.deepEqual(controlInputValue(c,'count','0'),{count:'0'});
current=await req({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:coffee.targetRef,value:{count:'13',unitAmount:'2.10'}}},current.semanticState);
c=cards(current).find(c=>c.targetRef===coffee.targetRef);record('Café count et prix choisis',c,'DECISION');assert.equal(present(c,'unitAmount').kind,'DECISION');assert.match(summary(c),/prix choisi/);
const hair=cards(initial).find(c=>c.label==='Coiffeur');record('Coiffeur fréquence connue',hair,'REFERENCE');assert.equal(present(hair,'unitAmount').kind,'UNKNOWN');assert.match(summary(hair),/prix à préciser/);
const external=cards(initial).find(c=>c.label==='Trajets travail fixes');assert.equal(external.capability?.actions.length??0,0);record('REFERENCE_ONLY non adoptable',external,typeof external.value.count==='string'?'REFERENCE':'UNKNOWN');
const saving=world.baseline.structuralFacts.savingsReservations.find(r=>r.reservationId!=='policy:safety-reserve');saving.adjustability='PROTECTED';world.baseline.digest=planningBaselineDigest(world.baseline);
const protectedModel=await req({kind:'READ'},semantic),s=cards(protectedModel).find(c=>c.targetRef==='savings:'+saving.reservationId);record('Savings protégée',s,'REFERENCE');assert.equal(s.capability.flexibility,'LOCKED');assert.match(controlAccessLabel(s),/Protégé/);
const before=JSON.stringify(initial),readCount=reads;
for(const card of cards(initial))for(const dimension of ['amount','count','unitAmount']){
 const html=render(React.createElement(InlineControlValue,{card,dimension,busy:false,focus(){},mutate:deny}));assert.match(html,new RegExp(`data-value-status="${present(card,dimension).kind}"`));
}
const inspector=render(React.createElement(ComposerFinancialInspector,{model:initial,mode:'FINANCE',stale:false,focused:null,focus(){},close(){}}));
assert.match(inspector,/data-inspector-target="HOUSEHOLD:household:clothing" data-value-status="UNKNOWN"/);assert.doesNotMatch(inspector,/Choix de ce mois/);
render(React.createElement(ComposerLibrary,{model:initial,openToken:0,busy:false,selected:null,choose(){},choosePreset(){},drag(){},inspectContext(){}}));
assert.equal(JSON.stringify(initial),before);assert.equal(reads,readCount);
const css=fs.readFileSync('src/app/mois-a-venir/composer/composer.module.css','utf8');assert.doesNotMatch(css,/@media\s*\([^)]*(?:min|max)-width/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 28px 28px/);
fs.mkdirSync('docs/status/evidence/pre-l4-c2',{recursive:true});
fs.writeFileSync('docs/status/evidence/pre-l4-c2/contracts.json',JSON.stringify({environment:'REAL_SERVICES_SYNTHETIC_READ_ONLY_REPOSITORY',rows,presentationReads:reads-readCount,financialWriters:0,modelUnchanged:true},null,2)+'\n');
console.log(`C2 PASS ${rows.length} cas, SSR inline/inspecteur/bibliothèque, aucune lecture ou mutation de présentation`);
