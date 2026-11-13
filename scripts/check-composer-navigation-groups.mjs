import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
const {intentionNavigationGroups,IntentionSwitcher,WorkshopNavigationContext,ParentProjectLink}=require('@/app/mois-a-venir/composer/workshop-navigation');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const entries=[{id:'stay',label:'Week-end musée'},{id:'movie-a',label:'Cinéma · 1'},{id:'movie-b',label:'Cinéma · 2'},
 {id:'dinner',label:'Restaurant'},{id:'project',label:'Autre projet'},...Array.from({length:5},(_,i)=>({id:`other-${i}`,label:`Autre ${i}`}))];
const parents=new Map([['movie-a','stay'],['movie-b','stay'],['dinner','movie-b']]);
const before=JSON.stringify(entries),groups=intentionNavigationGroups(entries,parents);
assert.deepEqual(groups.find(group=>group.key==='stay').entries.map(entry=>entry.id),['stay','movie-a','movie-b','dinner']);
assert.deepEqual(intentionNavigationGroups(entries,parents,'musée cinéma').flatMap(group=>group.entries).map(entry=>entry.id),['movie-a','movie-b']);
assert.deepEqual(intentionNavigationGroups(entries,parents,'introuvable'),[]);
const malformed=new Map([['movie-a','movie-b'],['movie-b','movie-a'],['dinner','absent']]);
assert.equal(intentionNavigationGroups(entries,malformed).flatMap(group=>group.entries).length,entries.length);
const markup=renderToStaticMarkup(React.createElement(WorkshopNavigationContext.Provider,{value:{entries,parents,busy:false,open(){assert.fail('Reading must not open');},back(){assert.fail();}}},
 React.createElement(IntentionSwitcher,{contextId:'movie-b'})));
assert.match(markup,/Filtrer mes intentions/);
assert.match(markup,/value="movie-b" selected=""/);
assert.equal((markup.match(/value="movie-a"/g)??[]).length,1);
assert.equal(JSON.stringify(entries),before);
const parentLink=renderToStaticMarkup(React.createElement(WorkshopNavigationContext.Provider,{value:{entries,parents,busy:false,open(){assert.fail('Rendering a parent link must not open');},back(){assert.fail();}}},React.createElement(ParentProjectLink,{contextId:'movie-b'})));
assert.match(parentLink,/data-parent-project="stay"/);
assert.match(parentLink,/Voir le projet Week-end musée/);
assert.equal(renderToStaticMarkup(React.createElement(ParentProjectLink,{contextId:'unknown'})),'');
console.log(JSON.stringify({status:'PASS',checks:4,remoteWrites:0,level:'LOCAL_IDENTITY_AND_RENDER'}));
