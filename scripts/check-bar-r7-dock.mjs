/** R7 actual React palette handlers. No browser, remote write or financial certificate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
const rr=createRequire(new URL('../outputs/l4c-test-tools/package.json',import.meta.url));
const React=rr('react'),{create,act}=rr('react-test-renderer'),load=Module._load;
Module._load=function(name,...args){return name==='react'?React:load.call(this,name,...args);};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){} disconnect(){}};
const {ContextPalette}=require('@/app/mois-a-venir/composer/context-palette');
const {BarProductVisual}=require('@/app/mois-a-venir/composer/bar-product-visual');
const card={contextOccurrenceId:'r7-memory-only'},model={library:{searchableAssets:[]},presentation:{objects:{}}};
let root,back=0,checks=0;
const events=new Map(),node={scrollLeft:0,clientWidth:500,scrollWidth:2400,scrollBy({left}){this.scrollLeft+=left;},addEventListener(k,v){events.set(k,v);},removeEventListener(k){events.delete(k);}};
const memory={},props={card,model,busy:false,appearance:'bar',choose(){},close(){},questionScroll:memory,onQuestionScrollChange:(key,value)=>memory[key]=value};
const choices=Array.from({length:30},(_,i)=>({key:'bar:beer:'+i,label:'Bière '+i,iconKey:'night-out',choose(){}}));
const question={title:'Boissons',nature:'OBJECTS',identity:'bar-products',choices,search:{value:'old query',change(){},label:'Chercher un objet'},backToFamilies(){back++;}};
const render=async q=>act(async()=>{const element=React.createElement(ContextPalette,{...props,question:q});if(root)root.update(element);else root=create(element,{createNodeMock:el=>el.props['data-palette-options']?node:null});});
const nodes=predicate=>root.root.findAll(n=>typeof n.type==='string'&&predicate(n));
try{
 await render(question);
 assert.equal(nodes(n=>n.type==='input').length,0);assert.equal(nodes(n=>n.type==='h3').length,0);
 assert.equal(nodes(n=>n.type==='strong').length,30,'no product limiting/show-more or search filtering');
 await act(async()=>nodes(n=>n.type==='button'&&n.children.includes('← Familles'))[0].props.onClick());assert.equal(back,1);checks++;
 await act(async()=>nodes(n=>n.props['aria-label']==='Réponses suivantes')[0].props.onClick());assert.equal(node.scrollLeft,300);
 const rail=()=>nodes(n=>n.props['data-palette-options'])[0];let prevented=false;
 await act(async()=>rail().props.onKeyDown({key:'ArrowRight',target:node,currentTarget:node,preventDefault(){prevented=true;}}));assert.equal(prevented,true);assert.equal(node.scrollLeft,480);
 let wheelPrevented=false;events.get('wheel')({deltaX:0,deltaY:80,deltaMode:0,preventDefault(){wheelPrevented=true;}});assert.equal(node.scrollLeft,560);assert.equal(wheelPrevented,true);
 await act(async()=>rail().props.onScroll());checks++;
 await render({...question,identity:'before-products'});assert.equal(node.scrollLeft,0);
 await render(question);assert.equal(node.scrollLeft,560);checks++;
 await render({...question,nature:'FAMILIES',choices:choices.slice(0,2)});assert.equal(nodes(n=>n.type==='input'||n.type==='h3').length,0);assert.equal(nodes(n=>n.type==='strong').length,2);checks++;
 await render({...question,nature:'PEOPLE',identity:'people'});assert.equal(nodes(n=>n.type==='input').length,1);assert.equal(nodes(n=>n.type==='h3').length,1);assert.equal(events.has('wheel'),false);checks++;
 await act(async()=>root.unmount());root=null;
 for(const key of ['drinks','food','bar:beer','bar:wine','bar:cocktail','bar:shot','bar:soft','bar:water']){
  await act(async()=>{root=create(React.createElement(BarProductVisual,{dock:true,assetKey:key}));});
  const img=root.root.findByType('img');assert.equal(fs.existsSync('public'+img.props.src),true,img.props.src);assert.equal(img.props.draggable,false);assert.ok(!img.props.src.endsWith('/bar-editorial.webp'));
  await act(async()=>root.unmount());root=null;
 }
 checks++;
 console.log(JSON.stringify({status:'PASS',checks,level:'REACT_HANDLERS_SYNTHETIC',finance:'UNCHANGED_NOT_RERUN',browser:'NOT_RUN_IN_THIS_SCRIPT',remoteWrites:0}));
}finally{if(root)await act(async()=>root.unmount());}
