import assert from 'node:assert/strict';
import fs from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
const {inventoryLayoutPages,inventoryColumns}=require('@/app/mois-a-venir/composer/inventory-layout');
const {barSurface}=require('@/app/mois-a-venir/composer/bar-surface');
const bar={id:'bar',kind:'CONTEXT',width:350,height:140,density:'SPARSE',spatialFamily:'MOMENTS',iconKey:'night-out',context:{templateKey:'night-out',fields:{presetKey:'bar-apero'}}};
// Use the real preset projection shape rather than matching a user-facing name.
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');bar.context.fields=presetCreationFields('night-out','bar-apero');
const checks=[];
function valid(pages,items,width){assert.deepEqual(pages.flat().map(p=>p.item.id),items.map(i=>i.id));for(const page of pages){const used=new Set();for(const b of page){assert.ok(b.column>0&&b.row>0&&b.column+b.columnSpan-1<=inventoryColumns(width));for(let y=b.row;y<b.row+b.rowSpan;y++)for(let x=b.column;x<b.column+b.columnSpan;x++){const k=x+':'+y;assert.ok(!used.has(k),k);used.add(k);}}}}
for(const count of [5,16,30,50])for(const width of [560,720,1000,1330]){
 const items=[...Array.from({length:Math.min(3,count-1)},(_,i)=>({...bar,id:'before:'+i,width:210,height:128})),bar,...Array.from({length:count-4},(_,i)=>({...bar,id:'after:'+i}))],snapshot=JSON.stringify(items);
 const closed=inventoryLayoutPages(items,width,470);let page=closed.findIndex(p=>p.some(x=>x.item.id==='bar')),box=closed[page].find(x=>x.item.id==='bar');let anchor={id:'bar',page,column:box.column,row:box.row};
 for(const [scene,rich,height] of [['summary',false,245],['date',false,355],['row',false,290],['outbound',false,400],['summary',true,515],['date',false,355]]){
 const args=[items,width,470,'bar',height,{surface:barSurface(scene,rich),anchor}],pages=inventoryLayoutPages(...args);assert.deepEqual(inventoryLayoutPages(...args),pages);valid(pages,items,width);const next=pages.findIndex(p=>p.some(x=>x.item.id==='bar'));box=pages[next].find(x=>x.item.id==='bar');assert.equal(next,anchor.page,'scene must not force another page');anchor={id:'bar',page:next,column:box.column,row:box.row};
 }
 assert.equal(JSON.stringify(items),snapshot);assert.deepEqual(inventoryLayoutPages(items,width,470),closed);checks.push({count,width,status:'PASS'});
}
const single=[bar],small=inventoryLayoutPages(single,1000,470,'bar',300,{surface:barSurface('date')})[0][0],wide=inventoryLayoutPages(single,1000,470,'bar',300,{surface:barSurface('summary',true)})[0][0];assert.ok(small.columnSpan<wide.columnSpan);checks.push({surfaceSpans:[small.columnSpan,wide.columnSpan],status:'PASS'});
fs.mkdirSync('docs/status/geometry-r5/proofs',{recursive:true});fs.writeFileSync('docs/status/geometry-r5/proofs/packer.json',JSON.stringify({method:'PURE_LOCAL_NOT_BROWSER',checks},null,2));console.log('Geometry packer:',checks.length,'PASS; no semantic mutation');
