import fs from 'node:fs';import{require}from'./lib/phase2-ts-loader.mjs';
const {COMPOSER_PRESETS}=require('@/domain/phase2/planner/composer-presets');
const catalog=JSON.parse(fs.readFileSync('docs/design/builder-clay-inventory.json','utf8'));
const future=(flow)=>['health','automotive','car'].some(k=>flow.includes(k))?'L5':['beauty','household'].some(k=>flow.includes(k))?'L6':'CAPACITÉ EXISTANTE À EXPOSER';
const existing=catalog.choices.map(c=>({assetKey:c.assetKey,label:c.label,ownerFlow:c.flow,status:future(c.flow??''),composerExposure:'Not certified by the Builder illustration inventory; use existing published sockets or future owner work.'}));
const recipes=COMPOSER_PRESETS.map((p,i)=>({assetKey:'preset:'+p.presetKey,label:p.label,templateKey:p.templateKey,status:i<5?'LIVRÉ L2-A':'LIVRÉ L2-B',scope:'Existing Context and sockets; no new specialized financial capacity'}));
const roadmap=[
['Restaurant en groupe','EXISTANT','Restaurant L1, explicit participants; no automatic division'],
['Concert / Festival','L4','Existing Activity base; dedicated recipe and original image deferred'],
['Soirée anniversaire','L4','Existing Night-out base; dedicated recipe and image deferred'],
['Pêche et matériel','LIVRÉ L2-A','Fishing intention; specialized equipment catalog not created'],
['Débardeur / crop top / robe / chaussures','CAPACITÉ EXISTANTE À EXPOSER','Purchase text/components; no certified SKU or stock'],
['Toner / sérum / crème / eyeliner','L6','Beauty components available; dedicated product/stock workflow deferred'],
['Papier toilette / pastilles lave-vaisselle / sacs poubelle','L6','Purchase home-small available; no false specific search result or stock'],
['Consultation / pharmacie / dentiste','L5','No dedicated Composer clinical capability asserted'],
['Batterie / pneus / contrôle technique','L5','No dedicated maintenance owner exposed by this lot'],
['Trajet autonome','CAPACITÉ EXISTANTE À EXPOSER','Existing prospective transport sockets, standalone entry not invented'],
['Frais administratifs','CAPACITÉ EXISTANTE À EXPOSER','Generic context/components; no invented special rule'],
['Cadeaux','EXISTANT','Gift P05 editor and object classification'],
['Projets de voyage','EXISTANT','Short-stay P11 within-month only; savings P08 existing'],
].map(([label,status,scope])=>({label,status,scope}));
fs.writeFileSync('docs/status/evidence/l2b-composer-library/master-asset-inventory.json',JSON.stringify({scope:'Complete existing Builder mapping inventory: 326 semantic choices plus 44 compatibility aliases, Composer recipes and explicit future intentions. Future lot assignments are proposals, not delivered specialized features.',counts:{builderMappingsIncludingAliases:existing.length,composerRecipes:recipes.length},recipes,roadmap,builderChoices:existing},null,2)+'\n');

