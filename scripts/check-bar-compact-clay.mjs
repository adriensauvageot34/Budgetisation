import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {barCompactMonth} from './fixtures/bar-compact-clay.mjs';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {householdId} from './fixtures/planner-headless.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.requestAnimationFrame=cb=>{cb();return 0;};globalThis.cancelAnimationFrame=()=>{};
globalThis.document={activeElement:null,body:{}};globalThis.HTMLElement=class{};
const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const {BarComponentGroup}=require('@/app/mois-a-venir/composer/bar-component-group');
const {barOpeningScroll}=require('@/app/mois-a-venir/composer/bar-surface');
const {composePresentationNodes}=require('@/app/mois-a-venir/composer/presentation/adapter');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const pg=await createKernelPostgres();globalThis.window={addEventListener(){},removeEventListener(){}};
let root,checks=0,sequence=0,targets=[];const dimensions={};
try{
 for(const scene of ['empty','meta','before','mixed','long']){
  const fixture=barCompactMonth(scene),snapshot=JSON.stringify(fixture.semantic),id=fixture.semantic.contexts[0].contextOccurrenceId;
  const result=await handleComposerRequest({repository:createPlanApplyRepository(pg.client),readWorld:async()=>fixture.world,householdPersons:[]},householdId,{kind:'READ',sequence:++sequence,targetMonth:'2026-11',draft:fixture.semantic});
  assert.equal(result.ok,true,`${scene}: ${result.code??result.message}`);const model=result.model,card=model.board.contexts.find(c=>c.contextOccurrenceId===id);
  await act(async()=>{root?.unmount();root=create(React.createElement(BarLivingCard,{card,model,living:{open:(_c,target)=>targets.push(target),close(){}},busy:false,preserved:false,preserve(){},drag(){}}));});
  const tree=root.root,groups=tree.findAllByType(BarComponentGroup),rails=tree.findAll(n=>n.type==='div'&&n.props['data-bar-closed-rail']);
  assert.equal(rails.length,['empty','meta'].includes(scene)?0:1,'single shared rail');
  assert.equal(groups.length,scene==='before'?5:['mixed','long'].includes(scene)?3:0);
  if(scene==='empty')assert.equal(tree.findAll(n=>n.type==='nav'&&n.props['aria-label']==='Compléter la sortie').length,1);
  else{
   assert.equal(tree.findAll(n=>n.type==='nav'&&n.props['aria-label']==='Compléter la sortie').length,0);
   for(const [attribute,target] of [['data-bar-closed-place','place'],['data-bar-closed-date','date'],['data-bar-closed-people','people']]){
    const button=tree.find(n=>n.type==='button'&&n.props[attribute]!==undefined);await act(async()=>button.props.onClick());assert.equal(targets.at(-1),target);
   }
   assert.match(tree.find(n=>n.type==='button'&&n.props['data-bar-closed-date']!==undefined).children.join(''),/sam\. 14 nov\./);
  }
  const hidden=tree.findAll(n=>n.props['data-bar-hidden-groups']!==undefined);assert.equal(hidden.length,['mixed','long'].includes(scene)?1:0);
  if(hidden.length){assert.equal(hidden[0].type,'span');assert.equal(hidden[0].props.onClick,undefined);assert.equal(hidden[0].props.tabIndex,undefined);assert.equal(hidden[0].children.join(''),'+3');}
  if(['before','mixed','long'].includes(scene)){
   const crazy=tree.find(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Crazy Tiger sans alcool ·'));
   assert.equal(crazy.findByType('strong').children.join(''),'Crazy');assert.equal(crazy.props.title,'Crazy Tiger sans alcool');
   assert.equal(crazy.find(n=>n.type==='span'&&n.props['data-price-unknown']===true).children.join(''),'? €');
   const img=crazy.findByType('img');await act(async()=>img.props.onError());assert.equal(crazy.findAllByType('img').length,0,'image failure keeps a functional icon and full button name');
  }
  for(const group of groups){const line=group.props.group.items[0];await act(async()=>group.props.choose(line));assert.ok(targets.at(-1).endsWith(line.selectionId));if(group.props.slot==='$before')assert.notEqual(group.props.owner,id);}
  assert.equal(JSON.stringify(fixture.semantic),snapshot,'render and navigation preserve complete semantic state');
  const node=composePresentationNodes(model).find(n=>n.id===id);dimensions[scene]={width:node.width,height:node.height};checks++;
 }
 assert.equal(dimensions.meta.width,dimensions.empty.width);assert.equal(dimensions.before.width,dimensions.mixed.width);assert.equal(dimensions.before.height,dimensions.mixed.height);checks++;
 for(const [left,width,viewport,extent,expected] of [[1000,600,1000,4000,800],[10,600,1000,4000,0],[3900,600,1000,4200,3200],[50,600,1000,800,0]])assert.equal(barOpeningScroll(left,width,viewport,extent),expected);checks++;
 console.log(JSON.stringify({status:'PASS',checks,dimensions,level:'SYNTHETIC_COMPILER_REACT_AND_SCROLL_GEOMETRY',remoteWrites:0}));
}finally{await act(async()=>root?.unmount());await pg.close();}
