import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { require } from './lib/phase2-ts-loader.mjs';
const rendererRequire = createRequire(new URL('../outputs/l4c-test-tools/package.json', import.meta.url));
const React = rendererRequire('react'), { create, act } = rendererRequire('react-test-renderer');
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === 'react') return React;
  return original.call(this, name, ...args);
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { barDockCatalog } = require('@/app/mois-a-venir/composer/bar-dock-catalog');
const { ContextPalette } = require('@/app/mois-a-venir/composer/context-palette');
const { rememberBarView } = require('@/app/mois-a-venir/composer/bar-view-memory');
for (const count of [25, 120, 150]) {
  const choices = Array.from({ length: count }, (_, i) => ({ key: `beer:${i}`, label: `Boisson ${i}`, iconKey: 'night-out', choose() {} }));
  assert.equal(barDockCatalog(choices, '').visible.length, 24);
  assert.deepEqual(barDockCatalog(choices, `boisson ${count - 1}`).visible.map(x => x.key), [`beer:${count - 1}`]);
  assert.equal(barDockCatalog(choices, '', count).visible.length, count);
}
const choices = Array.from({ length: 25 }, (_, i) => ({ key: `beer:${i}`, label: `Boisson ${i}`, iconKey: 'night-out', choose() {} }));
const memory = {};
const card = { contextOccurrenceId: 'card-A' }, model = { library: { searchableAssets: [] }, presentation: { objects: {} } };
const node = { scrollLeft: 0, clientWidth: 500, scrollWidth: 4200, scrollBy({ left }) { this.scrollLeft += left; } };
// R7 removes product search only. Keep this search regression on PEOPLE,
// whose complete catalogue must remain searchable with stable owner props.
const props = identity => ({ card, model, busy: false, appearance: 'bar', question: { identity, title: 'Personnes', nature: 'PEOPLE', choices },
  questionScroll: memory, onQuestionScrollChange: (key, value) => memory[key] = value, choose() {}, close() {} });
let root;
await act(async () => { root = create(React.createElement(ContextPalette, props('bar:drinks')), { createNodeMock: el => el.props['data-palette-options'] ? node : null }); });
const nodes = predicate => root.root.findAll(x => typeof x.type === 'string' && predicate(x));
assert.equal(nodes(x => x.props['aria-label']?.startsWith('Pages du dock')).length, 0);
assert.equal(nodes(x => x.props['data-dock-nature'] === 'PEOPLE').length, 1);
const rail = () => nodes(x => x.props['data-palette-options'])[0];
await act(async () => { nodes(x => x.props['aria-label'] === 'Réponses suivantes')[0].props.onClick(); rail().props.onScroll(); });
assert.equal(node.scrollLeft, 300);
let prevented = false;
await act(async () => { rail().props.onKeyDown({ target: node, currentTarget: node, key: 'ArrowRight', preventDefault() { prevented = true; } }); rail().props.onScroll(); });
assert.equal(prevented, true); assert.equal(node.scrollLeft, 480);
await act(async () => root.update(React.createElement(ContextPalette, props('before:drinks'))));
assert.equal(node.scrollLeft, 0);
await act(async () => root.update(React.createElement(ContextPalette, props('bar:drinks'))));
assert.equal(node.scrollLeft, 480);
await act(async () => nodes(x => x.type === 'input')[0].props.onChange({ target: { value: 'boisson 24' } }));
assert.equal(nodes(x => x.type === 'strong').length, 1);
assert.equal(nodes(x => x.type === 'strong')[0].children.join(''), 'Boisson 24');
await act(async () => root.unmount());
// The original bug requires stable props: internal filtering must remeasure
// even when the owner's question/card never changes and ResizeObserver is idle.
for(const count of [25,120,150]){
  const stableChoices=Array.from({length:count},(_,i)=>({key:`stable:${i}`,label:`Option ${String(i+1).padStart(3,'0')}`,iconKey:'night-out',choose(){}}));
  const stableProps={...props('stable:'+count),question:{identity:'stable:'+count,title:'Catalogue',nature:'PEOPLE',choices:stableChoices}};
  const railNode={scrollLeft:0,clientWidth:1027,scrollWidth:4468,scrollBy({left}){this.scrollLeft=Math.max(0,Math.min(this.scrollWidth-this.clientWidth,this.scrollLeft+left));}};
  await act(async()=>{root=create(React.createElement(ContextPalette,stableProps),{createNodeMock:el=>el.props['data-palette-options']?railNode:null});});
  const search=()=>nodes(x=>x.type==='input')[0],right=()=>nodes(x=>x.props['aria-label']==='Réponses suivantes');
  assert.equal(rail().props['data-overflow-after'],true);
  railNode.scrollWidth=180;railNode.scrollLeft=0;
  await act(async()=>search().props.onChange({target:{value:String(count).padStart(3,'0')}}));
  assert.equal(nodes(x=>x.type==='strong').length,1);assert.equal(rail().props['data-overflow-after'],false);assert.equal(right().length,0);
  railNode.scrollWidth=4468;
  await act(async()=>nodes(x=>x.props['aria-label']==='Effacer la recherche des choix')[0].props.onClick());
  assert.equal(rail().props['data-overflow-after'],true,'clear button must restore arrows without resize');assert.equal(right().length,1);
  await act(async()=>{right()[0].props.onClick();rail().props.onScroll();});assert.equal(railNode.scrollLeft,300);
  await act(async()=>{rail().props.onKeyDown({target:railNode,currentTarget:railNode,key:'ArrowLeft',preventDefault(){}});rail().props.onScroll();});assert.equal(railNode.scrollLeft,120);
  railNode.scrollWidth=180;railNode.scrollLeft=0;
  await act(async()=>search().props.onChange({target:{value:String(count).padStart(3,'0')}}));
  railNode.scrollWidth=4468;
  await act(async()=>search().props.onChange({target:{value:''}}));assert.equal(rail().props['data-overflow-after'],true,'input deletion must restore arrows');
  railNode.scrollLeft=3441;await act(async()=>rail().props.onScroll());assert.equal(rail().props['data-overflow-after'],false);assert.equal(rail().props['data-overflow-before'],true);
  await act(async()=>root.unmount());
  console.log(`PASS UI093 stable question ${count}: filter, clear button, input deletion, arrows, keyboard and end tolerance; no resize`);
}
const cache = new Map();
for (let i = 0; i < 34; i++) rememberBarView(cache, `month:${i}`, { queries: {}, pages: {}, dockScroll: {}, allPlaces: false, allBefore: false });
assert.equal(cache.size, 32); assert.equal(cache.has('month:0'), false);
console.log('PASS R5 L1: 25/120/150 full-search bounded projection; no pager; arrows/keyboard scroll; scene memory; bounded card memory. REACT_FIXTURE_ONLY');
