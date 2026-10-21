import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
const {inventoryLayoutPages,inventoryColumns}=require('@/app/mois-a-venir/composer/inventory-layout');
const {barSurface}=require('@/app/mois-a-venir/composer/bar-surface');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const bar={id:'bar',kind:'CONTEXT',width:350,height:145,density:'SPARSE',spatialFamily:'MOMENTS',context:{templateKey:'night-out',fields:presetCreationFields('night-out','bar-apero')}};
const cases=[];
for(const count of [5,20,40])for(const width of [1152,1440,1920]){
  const items=[bar,...Array.from({length:count-1},(_,index)=>({...bar,id:`card:${index}`,width:210+index%4*25,height:125+index%3*40}))];
  const snapshot=JSON.stringify(items);
  const layout=(expanded,height,anchor,previous)=>inventoryLayoutPages(items,width,620,expanded,height,{continuous:true,surface:barSurface('summary',true),anchor,previous});
  const closed=layout(undefined,520),origin=closed[0].find(box=>box.item.id==='bar');
  assert.equal(closed.length,1);
  const opened=layout('bar',470,{id:'bar',page:0,column:origin.column,row:origin.row},closed[0]);
  assert.equal(opened.length,1);
  assert.equal(opened[0].find(box=>box.item.id==='bar').column,origin.column,'Bar keeps its horizontal anchor');
  for(const scene of [closed,opened]){
    assert.deepEqual(scene[0].map(box=>box.item.id),items.map(item=>item.id));
    assert.deepEqual(scene,layout(scene===opened?'bar':undefined,scene===opened?470:520,scene===opened?{id:'bar',page:0,column:origin.column,row:origin.row}:undefined,scene===opened?closed[0]:undefined));
    const used=new Set();for(const box of scene[0])for(let y=box.row;y<box.row+box.rowSpan;y++)for(let x=box.column;x<box.column+box.columnSpan;x++){
      const key=`${x}:${y}`;assert(!used.has(key),`overlap ${count}/${width}: ${key}`);used.add(key);
    }
  }
  for(const box of opened[0]){const prior=closed[0].find(item=>item.item.id===box.item.id);assert.equal(box.row,prior.row,'opening preserves rows');assert(box.column>=prior.column,'collisions move right without crossing the Bar');}
  assert.deepEqual(layout(undefined,520),closed,'closing returns to the compact layout');
  const extent=Math.max(...opened[0].map(box=>box.column+box.columnSpan-1));
  assert(extent<=count*inventoryColumns(width),'strip grows only for occupied columns');
  assert.equal(JSON.stringify(items),snapshot,'layout is a read-only projection');
  cases.push({count,width,extent});
}
console.log(JSON.stringify({status:'PASS',level:'PURE_GEOMETRY_NO_BROWSER',cases}));
