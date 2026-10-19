/** Actual React handlers + actual HTTP boundary; mocks are explicit, no browser/Auth claim. */
import assert from 'node:assert/strict';import fs from 'node:fs';import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
let authCalls=0,reads=0,writes=0,authDenied=false;
Module._load=function(name,...args){
 if(name==='react')return React;
 if(name==='@/server/phase2/planner/runtime')return {authorizedPlanner:async()=>{authCalls++;if(authDenied)throw new (require('@/server/bootstrap/errors').BootstrapAuthenticationRequiredError)();return {userId:'f07b0000-0000-4000-8000-0000000000a1',householdId:'f07b0000-0000-4000-8000-000000000001'};}};
 if(name==='@/server/places/personal-google-place-store')return {createPersonalPlaceStore:()=>({read:async()=>{reads++;return [];},replay:async()=>null,mutate:async()=>{writes++;return {status:'CONFLICT'};}})};
 return load.call(this,name,...args);
};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {BarPersonalPlaces}=require('@/app/mois-a-venir/composer/bar-personal-places');
const {InlineEditRegistry,InlineEditContext}=require('@/app/mois-a-venir/composer/inline-edit-registry');
const rawRegistry=new InlineEditRegistry();
const checks=[];const test=async(id,run)=>{try{await run();checks.push({id,status:'PASS_LOCAL_DOMAIN'});console.log(id+' PASS');}catch(e){checks.push({id,status:'FAIL',error:e.message});console.error(e.stack);}};
let root,detail={provider:'google_places',placeId:'ChIJ_synthetic_bar',displayName:'Provider name',types:['bar']},chosen=[],calls=[],lost=true,capability=true,stored=[];
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
globalThis.fetch=async(url,init)=>{
 if(!init?.method)return {ok:true,json:async()=>({enabled:capability,places:stored})};
 const c=JSON.parse(init.body);calls.push(c);
 if(lost){lost=false;throw Error('lost after commit');}
 const p={id:'f07b0000-0000-4000-8000-000000000004',googlePlaceId:c.googlePlaceId,userLabel:c.userLabel,version:c.expectedVersion+1,status:c.action==='SAVE'?'SAVED':'ARCHIVED',kind:'PERSONAL_SAVED_PLACE',verifiedAt:new Date().toISOString()};stored=[p];
 return {ok:true,json:async()=>({status:p.status,place:p,replayed:true})};
};
const render=()=>React.createElement(InlineEditContext.Provider,{value:rawRegistry},React.createElement(BarPersonalPlaces,{detail,query:'',onChoose:(...args)=>chosen.push(args)}));
const buttons=()=>root.root.findAll(n=>n.type==='button');
const click=async label=>act(async()=>{const b=buttons().find(n=>text(n)===label);assert(b,'Missing '+label);assert(!b.props.disabled);await b.props.onClick();});
await test('UI_SAVE_RETRY_SAME_REQUEST_LABEL_NOT_PROVIDER_NO_AUTO_CHOICE',async()=>{
 await act(async()=>{root=create(render());});const input=root.root.findByType('input');assert.equal(input.props.value,'');
 await act(async()=>input.props.onChange({target:{value:'My own label'}}));
 assert.equal(rawRegistry.count(),1);
 await click('Enregistrer dans mes lieux');assert(text(root.toJSON()).includes('non confirmé'));assert.equal(chosen.length,0);
 await click('Enregistrer dans mes lieux');assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(calls[1].userLabel,'My own label');assert.equal(chosen.length,0);assert(text(root.toJSON()).includes('Enregistré'));
 assert.equal(rawRegistry.count(),0);
});
await test('UI_REOPEN_SELECT_EXPLICIT_ARCHIVE',async()=>{
 await act(async()=>root.unmount());detail=null;await act(async()=>{root=create(render());});
 await click('My own label · Lieu personnel');assert.equal(chosen.length,1);assert.equal(chosen[0][1].placeId,stored[0].googlePlaceId);
 await click('Retirer de mes lieux');assert.equal(calls.at(-1).action,'ARCHIVE');assert.equal(calls.at(-1).expectedVersion,1);assert(!buttons().some(n=>text(n)==='My own label · Lieu personnel'));
});
await test('UI_ARCHIVE_RECOVERY_RENAME_AND_REOPEN_NO_AUTO_CHOICE',async()=>{
 const count=chosen.length;await click('Lieux archivés');await click('Récupérer My own label');assert.equal(calls.at(-1).expectedVersion,2);assert.equal(calls.at(-1).action,'SAVE');
 await click('Mes lieux actifs');await click('Renommer My own label');
 await act(async()=>root.root.findByType('input').props.onChange({target:{value:'My renamed place'}}));assert.equal(rawRegistry.count(),1);
 await click('Enregistrer le nom');assert.equal(calls.at(-1).expectedVersion,3);assert.equal(chosen.length,count);assert.equal(rawRegistry.count(),0);
 await act(async()=>root.unmount());await act(async()=>{root=create(render());});assert(buttons().some(n=>text(n)==='My renamed place · Lieu personnel'));
});
await test('UI_DISABLED_NO_FAKE_ENTRY',async()=>{await act(async()=>root.unmount());capability=false;await act(async()=>{root=create(render());});assert.equal(root.toJSON(),null);await act(async()=>root.unmount());});
await test('RAW_OLD_CONFIRMATION_CANNOT_DISCARD_A_NEW_LABEL',async()=>{
 capability=true;stored=[];detail={...detail,placeId:'ChIJ_other_raw'};await act(async()=>{root=create(render());});
 const input=root.root.findByType('input');await act(async()=>input.props.onChange({target:{value:'First label'}}));
 let discard,continued=0;rawRegistry.requestConfirmation=(_text,accept)=>{discard=accept;};
 assert.equal(rawRegistry.guard(()=>continued++),false);
 await act(async()=>input.props.onChange({target:{value:'A newer label'}}));await act(async()=>discard());
 assert.equal(continued,0);assert.equal(root.root.findByType('input').props.value,'A newer label');
 rawRegistry.guard(()=>continued++);await act(async()=>discard());assert.equal(continued,1);assert.equal(root.root.findByType('input').props.value,'');await act(async()=>root.unmount());
});
const {GET,POST}=require('@/app/api/places/personal/route');
await test('UI_REPLAY_RECEIPT_NEVER_REPLACES_NEWER_ARCHIVE',async()=>{
 const previous=globalThis.fetch;const saved={id:'f07b0000-0000-4000-8000-000000000004',googlePlaceId:'ChIJ_replayed',userLabel:'Recorded before',version:1,status:'SAVED',kind:'PERSONAL_SAVED_PLACE',verifiedAt:new Date().toISOString()};
 globalThis.fetch=async(_url,init)=>({ok:true,json:async()=>init?.method?{status:'SAVED',place:saved,replayed:true,superseded:true,currentPlace:{...saved,version:3,status:'ARCHIVED'}}:{enabled:true,places:[]}});
 detail={...detail,placeId:saved.googlePlaceId};await act(async()=>{root=create(render());});await act(async()=>root.root.findByType('input').props.onChange({target:{value:'Retry label'}}));
 await click('Enregistrer dans mes lieux');assert(text(root.toJSON()).includes('version plus récente'));assert(!text(root.toJSON()).includes('Dans mes lieux personnels'));
 await act(async()=>root.unmount());globalThis.fetch=previous;
});
await test('HTTP_DISABLED_AUTH_ORIGIN_TYPE_SIZE_SCOPE',async()=>{
 delete process.env.BAR_PERSONAL_PLACES_ENABLED;assert.equal((await (await GET()).json()).enabled,false);assert.equal(authCalls,0);
 const url='https://fixture.invalid/api/places/personal';assert.equal((await POST(new Request(url,{method:'POST'}))).status,403);
 process.env.BAR_PERSONAL_PLACES_ENABLED='1';
 for(const headers of [{'origin':'https://evil.invalid','content-type':'application/json'},{origin:'https://fixture.invalid','content-type':'text/plain'}])assert([403,415].includes((await POST(new Request(url,{method:'POST',headers,body:'{}'}))).status));
 assert.equal(authCalls,0);
 assert.equal((await POST(new Request(url,{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json'},body:' '.repeat(4097)}))).status,413);
 authDenied=true;assert.equal((await GET()).status,401);authDenied=false;assert.equal((await GET()).status,200);assert.equal(reads,1);assert.equal(writes,0);
 delete process.env.BAR_PERSONAL_PLACES_ENABLED;
});
fs.mkdirSync('outputs/bar-live',{recursive:true});fs.writeFileSync('outputs/bar-live/ui-tests.json',JSON.stringify({level:'REACT_HANDLERS_HTTP_MOCK_AUTH_NOT_BROWSER_NOT_SUPABASE',checks},null,2));process.exitCode=checks.some(x=>x.status==='FAIL')?1:0;
