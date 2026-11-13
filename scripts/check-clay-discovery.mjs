import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
const {catalogResults,discoveryActions}=require('@/app/mois-a-venir/composer/catalog-discovery');
const {clayCatalogArtwork}=require('@/app/mois-a-venir/clay-v22-catalog');
const {cinemaSuggestions}=require('@/app/mois-a-venir/composer/cinema-suggestions');
const collection=JSON.parse(fs.readFileSync('public/planned-visuals/builder/clay/v22/collection.json'));
const {entries}=collection;
assert.equal(entries.length,687);assert.equal(new Set(entries.map(e=>e.visualConceptId)).size,687);
assert.equal(entries.filter(e=>!e.protected).length,632);assert.equal(entries.filter(e=>e.discovery.sourceRow).length,529);
assert.equal(entries.filter(e=>!e.protected&&e.discovery.sourceRow).length,524);assert.equal(entries.filter(e=>!e.protected&&!e.discovery.sourceRow).length,108);
for(const entry of entries){
 const art=clayCatalogArtwork(entry);assert(art,entry.visualConceptId);assert(fs.existsSync(path.join('public',art.src)),art.src);
 assert(entry.discovery.contexts.length);assert(entry.discovery.destination==='Composer > Tous les éléments');
 assert(catalogResults(entries,{query:entry.label}).some(r=>r.entry.visualConceptId===entry.visualConceptId));
 assert(entry.discovery.contexts.some(scope=>catalogResults([entry],{scope}).length));
}
const banned=new Set(['affinity','affinities','habits','situations','modes','personalValue','cycle','renewal','Affinité Adrien','Affinité Manon','Habitudes déclarées','Valeur personnelle']);
function check(value){if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){assert(!banned.has(key),'Private field '+key);check(v);}}check(collection);
const cinema=catalogResults(entries,{scope:'cinema'});assert.equal(cinema[0].entry.visualConceptId,'v22-art:excel:329');
assert(catalogResults(entries,{query:'MASCARA'}).some(r=>r.entry.label==='Mascara'));
const courses=catalogResults(entries,{scope:'courses'});assert.equal(courses[0].entry.discovery.family,'Courses et produits alimentaires');
assert(!courses.some(r=>r.entry.discovery.sourceRow===329));
assert.deepEqual(cinema.map(r=>r.key),catalogResults(entries,{scope:'cinema'}).map(r=>r.key));
const cid='00000000-0000-4000-8000-000000000017',assetKey='option:activity:main:activity';
const target={kind:'CONTEXT_SOCKET',contextOccurrenceId:cid,slotKey:'main'};
const card={contextOccurrenceId:cid,templateKey:'activity',fields:{presetKey:'cinema'},readOnly:false,capabilityRefs:['PATCH_CONTEXT'],sockets:[{contextOccurrenceId:cid,slotKey:'main',label:'Billet',choiceAssetKeys:[assetKey],currentItems:[],capabilityRefs:['activity:main:SELECT_COMPONENT']}]};
// presetForContext uses its published recipe marker; this synthetic marker mirrors production.
const {COMPOSER_PRESETS,ACTIVITY_PRESETS,presetCreationFields,presetIllustrationPath}=require('@/domain/phase2/planner/composer-presets');
const preset=COMPOSER_PRESETS.find(p=>p.presetKey==='cinema');card.fields={...preset.defaults,composerPresentation:{version:'composer-context-presentation@v1',presetKey:'cinema'}};
const model={board:{contexts:[card]},semanticState:{preferences:{anchors:[],flexibility:{}}},library:{searchableAssets:[{assetKey,kind:'SLOT_OPTION_ASSET',optionKey:'activity',optionKind:'COMPONENT'}]},dropCapabilities:[{sourceAssetKey:assetKey,target,resolution:'NEEDS_CHOICE',semanticAction:'PATCH_CONTEXT'}]};
const ticket=entries.find(e=>e.discovery.sourceRow===329);
let actions=discoveryActions(ticket,model,{contextId:cid});assert(actions.some(a=>a.kind==='CHOOSE'&&!a.selection));
card.sockets[0].currentItems=[{selectionId:'ticket-1',kind:'COMPONENT',optionKey:'activity',label:'Billet'}];
actions=discoveryActions(ticket,model,{contextId:cid});assert.equal(actions.filter(a=>a.kind==='CHOOSE').length,1);assert.equal(actions.find(a=>a.kind==='CHOOSE').selection.selectionId,'ticket-1');
card.readOnly=true;assert.equal(discoveryActions(ticket,model,{contextId:cid}).length,0);
const activityAsset={assetKey:'template:activity',kind:'CONTEXT_ASSET',templateKey:'activity'};
const createActivity={sourceAssetKey:activityAsset.assetKey,target:{kind:'BOARD_ZONE'},resolution:'ACCEPTED',semanticAction:'ADD_CONTEXT'};
for(const activity of ACTIVITY_PRESETS){
 const entry=entries.find(item=>item.visualConceptId===activity.visualConceptId);
 assert(entry);assert.equal(clayCatalogArtwork(entry,'wide').src,presetIllustrationPath(activity));
 const empty={...model,board:{contexts:[]},library:{searchableAssets:[activityAsset]},dropCapabilities:[createActivity]};
 const available=discoveryActions(entry,empty,{});
 assert.equal(available.length,1);assert.equal(available[0].presetKey,activity.presetKey);assert.equal(available[0].asset,activityAsset);
 assert.deepEqual(discoveryActions(entry,{...empty,dropCapabilities:[]},{}),[]);
 assert.deepEqual(discoveryActions(entry,empty,{controlRef:'HOUSEHOLD:household:groceries'}),[]);
 const existing={...card,label:'Intention renommée',fields:presetCreationFields('activity',activity.presetKey)};
 const actions=discoveryActions(entry,{...empty,board:{contexts:[existing]}},{});
 assert.deepEqual(actions.map(action=>[action.kind,action.contextId]),[['OPEN',cid]]);
 const generic={...card,fields:{},readOnly:false,sockets:[{...card.sockets[0],currentItems:[]}]};
 assert(discoveryActions(entry,{...model,board:{contexts:[generic]}},{contextId:cid}).some(action=>action.kind==='CHOOSE'));
}
const suggestions=cinemaSuggestions({contextOccurrenceId:cid,writable:true,ticketAllowed:true,dayChosen:false,placeChosen:false,extrasAllowed:true,extras:[],complementsOnly:false,dismissed:[]});
assert.equal(suggestions[0].sourceRow,329);assert(!suggestions.find(s=>s.conceptKey==='popcorn')?.sourceRow);
const output={status:'PASS',identities:687,newIllustrations:632,excelConcepts:529,protected:55,reachableBySearch:687,reachableInContext:687,
 orders:{cinema:cinema.slice(0,4).map(r=>({id:r.key,label:r.entry.label})),courses:courses.slice(0,4).map(r=>({id:r.key,label:r.entry.label}))},
 checks:['paths','label search','context destinations','private allowlist','determinism','cinema core','exact edit identity','readOnly gate','popcorn provenance','six activity routes']};
console.log(JSON.stringify(output,null,2));
