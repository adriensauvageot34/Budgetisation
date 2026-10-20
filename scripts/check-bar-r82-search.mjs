/** Real React handlers, synthetic network; no browser or live provider claim. */
import assert from 'node:assert/strict';import Module,{createRequire} from 'node:module';import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url)),React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:name==='react-dom'?{createPortal:n=>n}:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};globalThis.HTMLElement=class{};globalThis.document={activeElement:null,body:{}};
const {BarRouteEndpointSearch}=require('@/app/mois-a-venir/composer/bar-route-endpoint-search'),{BarPlaceTransportContext}=require('@/app/mois-a-venir/composer/bar-place-transport');
const selected=[],calls=[],pending=[];let root;
const request=async(path,init)=>{const body=JSON.parse(init.body);calls.push({path,kind:body.context.kind});if(path.endsWith('autocomplete'))return Response.json({suggestions:[{source:'google_places',placeId:'ChIJ_search_fixture',primaryText:'Gare publique',secondaryText:'France'}]});return new Promise(resolve=>pending.push(resolve));};
let props={identity:'outbound:origin',decisionKey:'draft1',query:'Gare',change(){},googleOn:true,toggle(){},choose:(label,id)=>selected.push({label,id}),free(){},known:[{key:'home',label:'Maison admissible',iconKey:'activity',choose(){}}],card:{contextOccurrenceId:'bar',label:'Bar'},model:{library:{searchableAssets:[]},presentation:{objects:{},dragSources:{}}},dockHost:{}};
const render=()=>React.createElement(BarPlaceTransportContext.Provider,{value:request},React.createElement(BarRouteEndpointSearch,props));
const waitSearch=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,340)));
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
const button=label=>root.root.findAll(n=>n.type==='button'&&text(n).includes(label))[0];
const detail={provider:'google_places',placeId:'ChIJ_search_fixture',displayName:'Gare publique',formattedAddress:'Adresse publique, France',countryCode:'FR',lat:43.6,lng:3.9,types:[],photoAvailable:false,photoAttributions:[]};
try{
 await act(async()=>{root=create(render());});await waitSearch();assert.ok(button('Gare publique'));assert.ok(button('Maison admissible'));assert.ok(button('Nom libre'));
 await act(async()=>button('Gare publique').props.onClick());assert.equal(selected.length,0);
 props={...props,identity:'return:destination',decisionKey:'draft2'};await act(async()=>root.update(render()));await act(async()=>pending.shift()(Response.json({place:detail})));assert.equal(selected.length,0,'Late Details for another leg must not commit');
 await waitSearch();await act(async()=>button('Gare publique').props.onClick());await act(async()=>pending.shift()(Response.json({place:{...detail,placeId:'ChIJ_wrong'}})));assert.equal(selected.length,0);assert.ok(button('Réessayer cette adresse'));
 await act(async()=>button('Réessayer cette adresse').props.onClick());await act(async()=>pending.shift()(Response.json({place:detail})));assert.deepEqual(selected,[{label:'Gare publique',id:'ChIJ_search_fixture'}]);
 props={...props,googleOn:false,query:'Un nom sans Google'};await act(async()=>root.update(render()));const before=calls.length;await waitSearch();assert.equal(calls.length,before);assert.ok(button('Maison admissible'));assert.ok(button('Retenir ce nom libre'));
 const result={status:'PASS',level:'REACT_WITH_SYNTHETIC_NETWORK_NOT_BROWSER',checks:['ONE_INPUT','GOOGLE_EXACT_DETAILS_BEFORE_CHOICE','LATE_DIFFERENT_LEG_IGNORED','WRONG_DETAILS_ID_REJECTED_RETRY','OFF_NO_PROVIDER_REQUEST','KNOWN_AND_FREE_ALWAYS_AVAILABLE'],calls:calls.length,remoteWrites:0};
 assert.equal(root.root.findAll(n=>n.type==='input').length,1);fs.mkdirSync('outputs/bar-r82',{recursive:true});fs.writeFileSync('outputs/bar-r82/search-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(root)await act(async()=>root.unmount());}
