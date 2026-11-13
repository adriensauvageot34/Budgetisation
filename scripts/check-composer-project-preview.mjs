import assert from 'node:assert/strict';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {require} from './lib/phase2-ts-loader.mjs';
import {readMonthFixture} from './fixtures/composer-v22-b1.mjs';
const testRequire=createRequire(path.resolve('outputs/p21-react-tools/package.json'));
const React=testRequire('react'),jsx=testRequire('react/jsx-runtime'),{create,act}=testRequire('react-test-renderer');
const originalLoad=Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let focused=0,closed=0,created=[],root;
class Element{isConnected=true;focus(){focused++;}}
globalThis.HTMLElement=Element;globalThis.document={activeElement:new Element()};
globalThis.fetch=async()=>{throw Error('PROJECT_PREVIEW_REMOTE_FORBIDDEN');};
Module._load=function(name,parent,...args){if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;return originalLoad.call(this,name,parent,...args);};
const {ProjectStarterPreview}=require('@/app/mois-a-venir/composer/project-starter-preview');
const {projectStarters}=require('@/app/mois-a-venir/composer/project-starters');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const f=await readMonthFixture(),digest=semanticStateDigest(f.model.semanticState),starter=projectStarters.find(starter=>starter.key==='weekend-discovery');
const mount=async extras=>{await act(async()=>{root=create(React.createElement(ProjectStarterPreview,{starter,model:f.model,busy:false,create:choices=>created.push(choices),close:()=>closed++,...extras}),{createNodeMock:()=>({showModal(){}})});});};
try{
 await mount();
 await act(async()=>root.root.findByProps({maxLength:120}).props.onChange({target:{value:'Mon séjour'}}));
 await act(async()=>root.root.findAllByProps({type:'checkbox'})[0].props.onChange({target:{checked:false}}));
 assert.equal(created.length,0);assert.equal(semanticStateDigest(f.model.semanticState),digest);
 await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.deepEqual(created,[{label:'Mon séjour',children:['hiking-nature']}]);
 await act(async()=>root.unmount());root=null;assert.equal(focused,0);
 console.log('PP-01 Naming and optional children stay local until confirmation; success does not refocus the library: PASS');
 await mount();await act(async()=>root.root.findByType('dialog').props.onCancel({preventDefault(){}}));
 assert.equal(closed,1);await act(async()=>root.unmount());root=null;assert.equal(focused,1);
 await mount({blockedReason:'Quittez la comparaison.'});
 assert.equal(root.root.findByProps({'data-confirm-workshop':true}).props.disabled,true);
 await act(async()=>root.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(created.length,1);
 assert.equal(root.root.findAllByProps({role:'alert'}).length,1);
 console.log('PP-02 Cancellation restores focus and blocked confirmation cannot create a project: PASS');
 assert.deepEqual(f.writes,[]);
 console.log(JSON.stringify({status:'PASS',checks:2,remoteWrites:0,level:'LOCAL_REACT_PREVIEW'}));
}finally{if(root)await act(async()=>root.unmount());Module._load=originalLoad;}
