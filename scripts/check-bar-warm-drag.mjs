/** DOM adapter test only. Native browser drag image appearance is a separate gate. */
import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
const {barNativeDragImage}=require('@/app/mois-a-venir/composer/bar-closed-drag');
let appended=null,removed=0,rasterized=null,removedIds=0;
const image={dataset:{},style:{},setAttribute(k,v){this[k]=v;},removeAttribute(k){assert.equal(k,'id');removedIds++;},querySelectorAll(){return [{removeAttribute(){removedIds++;}}];},remove(){removed++;}};
const card={cloneNode(deep){assert.equal(deep,true);return image;},getBoundingClientRect(){return {left:40,top:80,width:285,height:250};}};
globalThis.document={body:{appendChild(node){appended=node;}}};
const cleanup=barNativeDragImage(card,{clientX:110,clientY:100,dataTransfer:{setDragImage(node,x,y){rasterized={node,x,y};}}});
assert.equal(appended,image);assert.deepEqual(rasterized,{node:image,x:70,y:20});assert.equal(image.inert,true);assert.equal(image['aria-hidden'],'true');assert.equal(image.style.width,'285px');assert.equal(image.style.height,'250px');assert.equal(image.style.opacity,'.92');assert.equal(image.dataset.barNativeDragImage,'true');assert.equal(removedIds,2);assert.equal(removed,0);cleanup();assert.equal(removed,1);
const failure=barNativeDragImage(card,{clientX:0,clientY:0,dataTransfer:{setDragImage(){throw Error('unavailable');}}});assert.equal(removed,2);failure();assert.equal(removed,2);
console.log(JSON.stringify({status:'PASS',level:'DOM_ADAPTER_ONLY_NOT_NATIVE_VISUAL',checks:['CLONE_CURRENT_CARD','EXACT_DIMENSIONS','POINTER_OFFSET','INERT_NO_DUPLICATE_IDS','END_CLEANUP','FAILURE_CLEANUP'],financialChanges:false}));
