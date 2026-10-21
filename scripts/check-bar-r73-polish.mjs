/** Open/closed presentation regression; no financial writes or native certificate. */
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.document={querySelector(){return null;}};
const {BarGroupFace}=require('@/app/mois-a-venir/composer/bar-component-group');
const {BarLivingCard}=require('@/app/mois-a-venir/composer/bar-living-card');
const item={kind:'COMPONENT',selectionId:'test-line',optionKey:'extra',label:'Une bouteille au libellé volontairement très long',provenance:'EXPLICIT_USER_DECISION',quantity:'1',unitBasis:'SHARED',cost:{kind:'UNKNOWN'},productAssetRef:{assetKey:'house_party:wine'}};
const original=JSON.stringify(item),group={key:'test-group',items:[item]};
const model={semanticState:{contexts:[]},board:{draft:{semanticStateDigest:'test-digest'}},nightOutComponentGroups:[{contextOccurrenceId:'bar',slotKey:'extras',groupKey:group.key,selectionIds:['test-line'],semanticStateDigest:'test-digest',knownAmount:'17',incomplete:true,quantity:'1'}]};
let root,preserved=0,removed=0,closed=0;
const render=async element=>act(async()=>{root?.unmount();root=create(element);});
const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join(' ');
try{
 await render(React.createElement(BarGroupFace,{group,model,owner:'bar',slot:'extras'}));
 assert.doesNotMatch(text(root.toJSON()),/Lot partagé/);assert.match(text(root.toJSON()),/17,00\s*€ \+ \?/);
 assert.equal(root.root.findAll(n=>n.props['aria-label']==='Consommation commune · lot').length,1);
 assert.equal(root.root.findByType('strong').props.title,item.label);assert.ok(root.root.findByType('img').props.src.endsWith('/bar-compact/wine.webp'));assert.equal(JSON.stringify(item),original);
 await render(React.createElement(BarGroupFace,{group,model,owner:'bar',slot:'extras',closed:true}));
 assert.equal(root.root.findAll(n=>n.props['aria-label']==='Consommation commune (lot)').length,1);
 const card={contextOccurrenceId:'bar',label:'Bar / Apéro',knowledge:'UNKNOWN',fields:{},sockets:[]};
 await render(React.createElement(BarLivingCard,{card,model,living:{id:'bar',open(){},close(){closed++;}},busy:false,preserved:false,preserve(){preserved++;},remove(){removed++;},drag(){}}));
 // The Actions menu was already removed in main 59ee044; direct controls and
 // Escape are the current contract (baseline failure reproduced separately).
 assert.equal(root.root.findAllByType('details').length,0);
 const preserve=root.root.findAll(n=>n.type==='button'&&n.props['aria-label']==='Préserver les choix de cette sortie')[0];
 const remove=root.root.findAll(n=>n.type==='button'&&n.props['aria-label']==='Retirer la sortie')[0];
 await act(async()=>{preserve.props.onClick();remove.props.onClick();root.root.findByType('article').props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});});assert.equal(preserved,1);assert.equal(removed,1);assert.equal(closed,1);
 console.log(JSON.stringify({status:'PASS',level:'REACT_PRESENTATION_HANDLERS_NOT_BROWSER',checks:['PARTIAL_BADGE','SHARED_ICON_NO_LINE','LONG_TITLE','TRANSPARENT_WINE','DATA_UNCHANGED','CLOSED_UNIT_UNCHANGED','KEYBOARD_ACTIONS_PRESENT','PRESERVE_REMOVE_COLLAPSE_CALLBACKS'],remoteWrites:0,finance:'BASELINE_198_PASS_NOT_RERUN'}));
}finally{if(root)await act(async()=>root.unmount());}
