/** H1-A projection on synthetic data only. The continuous Board packer is unchanged. */
import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
import {uuid,householdId} from './fixtures/planner-headless.mjs';
const {composePresentationNodes}=require('@/app/mois-a-venir/composer/presentation/adapter');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {inventoryLayoutPages}=require('@/app/mois-a-venir/composer/inventory-layout');
const atoms=nodes=>nodes.flatMap(n=>n.kind==='CLUSTER'?n.children:[n]);
const checks=[];
for(const dense of [false,true]){
 const f=await readMonthFixture('2026-11',dense),worldBefore=JSON.stringify(f.world);
 const roots=[['restaurant','restaurant-for-two'],['purchase','amazon-purchase'],['beauty-restock','mascara']].map(([templateKey,preset],i)=>({contextOccurrenceId:uuid(97001+i),templateKey,status:'ACTIVE',parentContextOccurrenceId:null,fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields(templateKey,preset)},slotSelections:{},provenance:'EXPLICIT_USER_DECISION'}));
 const semantic={...f.semantic,contexts:[...f.semantic.contexts,...roots]};semantic.preferences.flexibility[roots[0].contextOccurrenceId]='PRESERVE';
 const r=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft:semantic});assert(r.ok);const model=r.model,before=JSON.stringify(model);
 const full=composePresentationNodes(model,true),folded=composePresentationNodes(model,false),ids=model.board.contexts.filter(c=>!c.parentContextOccurrenceId).map(c=>c.contextOccurrenceId).sort();
 assert.deepEqual(atoms(folded).map(n=>n.id).sort(),ids,'Folding hides monthly cards, never intentions');
 assert(atoms(folded).every(n=>n.kind==='CONTEXT'));
 assert.deepEqual(atoms(full).filter(n=>n.context).map(n=>n.id).sort(),ids,'Unfolding preserves context identities');
 const available=new Set(model.presentation.availableReservationRefs??[]);
 assert.deepEqual(atoms(full).filter(n=>n.control).map(n=>n.id).sort(),[...model.board.baselineControls,...model.board.discretionaryControls,...model.board.savings].filter(c=>!available.has(c.targetRef)).map(c=>c.targetRef).sort(),'All admitted monthly cards return');
 assert.deepEqual(composePresentationNodes(model,true),full,'Folding is reversible and deterministic');
 const group=folded.find(n=>n.kind==='CLUSTER'&&n.family==='ACTIVITY');
 if(dense){assert(group);assert.equal(group.children.length,18);assert.equal(group.amount,null);assert.equal(group.children[0].context.templateKey,'activity');}else assert(!group);
 for(const width of [432,720,1200]){const geometry=inventoryLayoutPages(folded,width,500,undefined,520,{continuous:true});assert.equal(geometry.length,1);assert.deepEqual(geometry[0].map(p=>p.item.id),folded.map(n=>n.id));const used=new Set();for(const p of geometry[0])for(let y=p.row;y<p.row+p.rowSpan;y++)for(let x=p.column;x<p.column+p.columnSpan;x++){const k=`${x}:${y}`;assert(!used.has(k));used.add(k);}}
 assert.equal(JSON.stringify(model),before,'No capability, cost, legacy selection or preference is changed');assert.equal(JSON.stringify(f.world),worldBefore);assert.deepEqual(f.writes,[]);
 checks.push({dense,contexts:ids.length,foldedCells:folded.length,expandedCells:full.length,status:'PASS'});
}
console.log(JSON.stringify({status:'PASS',level:'SYNTHETIC_PROJECTION_AND_CONTINUOUS_GEOMETRY',checks,sql:0,writers:0,remote:0}));
