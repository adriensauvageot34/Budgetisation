import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const {BarMomentRail}=require('@/app/mois-a-venir/composer/bar-moment-rail');
const {ComposerInteractionContext}=require('@/app/mois-a-venir/composer/interactions');
const target={kind:'CONTEXT_SOCKET',contextOccurrenceId:'before-child-fixture',slotKey:'extras'};
const source={sourceKey:'beer-fixture',assetKey:'option:night-out:extras:extra',protected:false};
const model={presentation:{dragSources:{'beer-fixture':source}},dropCapabilities:[{sourceAssetKey:source.assetKey,target,resolution:'NEEDS_CHOICE'}]};
let root,placed=[],over=[],rejected=0,added=0,prevented=0;
const node={clientWidth:200,scrollWidth:600,scrollLeft:0,scrollBy({left}){this.scrollLeft+=left;}};
const interaction={grabbed:source,over:t=>over.push(t),place:t=>placed.push(t),reject:()=>rejected++};
const render=async(extra={})=>act(async()=>{const el=React.createElement(ComposerInteractionContext.Provider,{value:interaction},React.createElement(BarMomentRail,{label:'Before',addLabel:'Ajouter Before',owner:target.contextOccurrenceId,slot:target.slotKey,model,add:()=>added++,...extra}));if(root)root.update(el);else root=create(el,{createNodeMock:el=>el.props['data-bar-moment-rail']?node:null});});
const slot=()=>root.root.findAll(n=>n.type==='button'&&n.props['data-bar-moment-slot']!==undefined)[0];
const event=(key='beer-fixture')=>({preventDefault(){prevented++;},stopPropagation(){},dataTransfer:{dropEffect:'none',getData:()=>key}});
try{
 await render();await act(async()=>slot().props.onClick());assert.equal(added,1);
 await act(async()=>{slot().props.onDragOver(event());slot().props.onDrop(event());});assert.deepEqual(over,[target]);assert.deepEqual(placed,[target]);assert.equal(prevented,2);
 await render({dropBlocked:true});await act(async()=>slot().props.onDrop(event()));assert.equal(placed.length,1);assert.equal(rejected,1);
 await render({disabled:true});await act(async()=>slot().props.onDrop(event()));assert.equal(placed.length,1);assert.equal(rejected,2);
 interaction.grabbed=null;await render();await act(async()=>slot().props.onDrop(event('unknown-source')));assert.equal(placed.length,1);
 // The native data transfer is checked against the published model, not a guessed owner.
 await act(async()=>slot().props.onDrop(event()));assert.deepEqual(placed.at(-1),target);
 const rail=root.root.findAll(n=>n.type==='div'&&n.props['data-bar-moment-rail']!==undefined)[0];
 await act(async()=>rail.props.onKeyDown({key:'ArrowRight',target:node,currentTarget:node,preventDefault(){}}));assert.equal(node.scrollLeft,200);
 console.log(JSON.stringify({checks:7,status:'PASS',level:'REACT_HANDLERS_ONLY_NOT_NATIVE_DND',remoteWrites:0}));
}finally{if(root)await act(async()=>root.unmount());}
