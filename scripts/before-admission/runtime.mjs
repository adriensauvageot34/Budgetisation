import fs from 'node:fs';import path from 'node:path';import Module,{createRequire}from'node:module';import{fileURLToPath,pathToFileURL}from'node:url';
const scriptDir=path.dirname(fileURLToPath(import.meta.url));
export const repo=path.resolve(scriptDir,'../..'),root=path.resolve(repo,'../..'),origin=repo,here=path.join(repo,'outputs/before-admission'),url=p=>pathToFileURL(p).href;
fs.mkdirSync(here,{recursive:true});
process.chdir(repo);process.env.NODE_PATH=path.join(origin,'node_modules');Module._initPaths();
export const rr=createRequire(path.join(origin,'package.json'));
export const{require}=await import(url(path.join(origin,'scripts/lib/phase2-ts-loader.mjs')));
export const{d1Fixture,parentId,beforeId,compiledD1,totalD1,toGlobal}=await import(url(path.join(origin,'scripts/check-bar-d1-global.mjs')));
export const{fixture,householdId,uuid}=await import(url(path.join(origin,'scripts/fixtures/planner-headless.mjs')));
export const{userId}=await import(url(path.join(origin,'scripts/fixtures/planner-kernel.mjs')));
export const{semanticStateDigest,parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
export const{plannerDigest,canonicalPlannerJson,plannerUuid,plannerMonth}=require('@/domain/phase2/planner/json');
export const{barBeforeMomentPatch,barBeforeDelete,barBefore}=require('@/app/mois-a-venir/composer/bar-before');
export const{editNightOut}=require('@/domain/phase2/planner/night-out-edit');
export const{stageLocalDecision}=require('@/app/mois-a-venir/composer/local-draft');
export const{handleComposerRequest}=require('@/server/phase2/planner/composer-service');
export const{saveComposerDraft,readComposerDrafts}=require('@/server/phase2/planner/composer-draft-service');
export const parent=s=>s.contexts.find(c=>c.contextOccurrenceId===parentId);
export const child=s=>s.contexts.find(c=>c.parentContextOccurrenceId===parentId&&c.templateKey==='activity');
export const clone=structuredClone;
export const makeDeps=world=>({repository:{readActivePlan:async()=>null},readWorld:async()=>world,householdPersons:[],validateContextReferences:async(_h,refs)=>{if(refs.personIds.length)throw Error('FIXTURE_KNOWN_PERSON_NOT_ALLOWED');const places=new Set(world.mobilityFacts.places.map(p=>p.placeId));if(refs.placeIds.some(id=>!places.has(id)))throw Error('FIXTURE_KNOWN_PLACE_NOT_ALLOWED');}});
export async function model(s,world=fixture()){const r=await handleComposerRequest(makeDeps(world),householdId,{kind:'READ',sequence:1,targetMonth:s.targetMonth,draft:s});if(!r.ok)throw Error(r.code+':'+r.message);return r.model;}
export function bareFixture(){const source=d1Fixture();return editNightOut(source,{contextOccurrenceId:parentId,fields:{},before:null,slots:{extras:[]}});}
export function noneOperation(s,fields={},ids){const op=barBeforeMomentPatch(s,parent(s),null,[],fields);if(ids){op.edit.before.childContextOccurrenceId=ids.child;op.edit.before.selectionId=ids.link;}return op;}
export function requestFP(request,session){return plannerDigest({protocol:'before-admission-replay@v1',actor:session.userId,household:session.householdId,request});}
export const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('BEFORE_ADMISSION_NETWORK_FORBIDDEN');};
export{fs,path,Module};

export const{BeforeDraftHistory}=require('@/app/mois-a-venir/composer/before-draft-history');
export const{isAdmittedBeforeSave}=require('@/server/phase2/planner/before-draft-admission');
