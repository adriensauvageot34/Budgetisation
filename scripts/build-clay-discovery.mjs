import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Inputs must already be stripped to the explicit public allowlist. Never copy XLSX rows.
const [sourceFile, protectedFile] = process.argv.slice(2);
if (!sourceFile || !protectedFile) throw Error('Provide the local neutral concept projection and M13 protected manifest.');
const source=JSON.parse(fs.readFileSync(sourceFile,'utf8').replace(/^\uFEFF/,''));
assert.equal(source.source.concepts,529);
assert(source.concepts.every(c=>Object.keys(c).sort().join(',')==='family,label,sourceRow'));
const root=process.cwd(), require=createRequire(path.join(root,'package.json')), ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {COMPOSER_PRESETS,presetIllustrationPath}=require('./src/domain/phase2/planner/composer-presets.ts');
const original=JSON.parse(fs.readFileSync('docs/clay-v22/M14-2-MAPPING.json')).illustrations;
const protectedRefs=JSON.parse(fs.readFileSync(protectedFile)).references;
const familyScopes=[
 ['Courses et produits alimentaires',['courses']],['Boissons',['courses','bar','restaurant']],
 ['Restauration et repas préparés',['restaurant']],['Vêtements et accessoires',['purchase','gift']],
 ['Beauté, cosmétiques et hygiène personnelle',['beauty','purchase']],['Entretien et consommables de la maison',['courses','home']],
 ['Santé, pharmacie et matériel de soins',['purchase']],['Automobile — pièces, fluides et matériel',['purchase']],
 ['Mobilier, équipement et décoration',['home','purchase']],['Technologie, électronique et multimédia',['purchase']],
 ['Bricolage, travaux et fournitures',['home','purchase']],['Loisirs, culture, activités et billetterie',['activity']],
 ['Cadeaux, attentions et fournitures de fête',['gift']],['Prestations et services professionnels',['service']],
 ['Hébergements et locations',['stay']],['Transport et déplacements payants',['transport']],
 ['Frais supplémentaires, administratifs et contributions',['service']]
];
const extraGroups=[
 ['INTENT',['restaurant'],'restaurant-intent fastfood-intent delivery-meal-intent workmeal-intent'],
 ['INTENT',['activity'],'activity-intent activity-cinema festival-intent club-festival-intent fishing-activity kayak-activity match-activity photo-activity show-activity sport-activity themepark-activity'],
 ['INTENT',['purchase'],'purchase-intent'],['INTENT',['gift'],'gift-intent'],
 ['INTENT',['bar'],'party-intent private-party-intent'],['INTENT',['stay'],'travel-intent family-visit visit-intent visits-general'],
 ['INTENT',['courses'],'groceries-intent'],
 ['MODE',['transport'],'bike-mode bus-mode car-mode flight-mode other-paid-travel scooter-rental taxi-vtc-mode train-mode tram-mode walking-mode vtc-course'],
 ['CONFIGURATION',['stay'],'hostel-category hotel-stay-general lodging-room rental-platform'],
 ['SCENE',['bar'],'bar-interior before-moment group-scene solo-scene'],
 ['CONFIGURATION',['gift'],'birthday-occasion celebration-occasion valentine-occasion'],
 ['GROUP',['courses'],'fresh-group groceries-general groceries-special pantry-group produce-group hygiene-group cleaning-group'],
 ['GROUP',['bar'],'alcohol-group meal-subtotal'],['CONFIGURATION',['transport'],'fuel-estimate'],
 ['ELEMENT',['cinema'],'popcorn activity-snack activity-entry'],
 ['ELEMENT',['bar','restaurant'],'alcool-verre boisson-generale boisson-non-alcool bottle-general cocktail-general digestif eau-generale energy-drink food-club plateau-apero rhum snack-general vin-general vodka'],
 ['ELEMENT',['bar'],'club-entry contribution-general cover-bar merch-mixte'],
 ['ELEMENT',['restaurant'],'bakery-workmeal bread-bakery chain-fastfood chicken-other fresh-store-meal main-dish-general sandwich-burger tacos-kebab thai-food viande-generale food-brought'],
 ['ELEMENT',['purchase'],'bag-general baggage cable car-bulb car-part-general electric-general fishing-bait shoes-general'],
 ['ELEMENT',['home','purchase'],'bedding decor-general dishes diy-general furniture-general kitchen-general lamp lighting-general storage'],
 ['ELEMENT',['gift'],'gift-clothes gift-ticket-general'],['ELEMENT',['service'],'administrative'],
];
const extra=new Map(extraGroups.flatMap(([nature,contexts,keys])=>keys.split(' ').map(k=>[k,{nature,contexts}])));
assert.equal(extra.size,108);
const publicConcepts=new Map(source.concepts.map(c=>[`v22-art:excel:${c.sourceRow}`,c]));
const protectedAssets={
 'v22-art:excel:374':['gift:book','gift-book'], 'v22-art:excel:380':['gift:flowers','gift-flowers'],
 'v22-art:excel:382':['gift:chocolate','gift-chocolate'],'v22-art:excel:388':['gift:toy','gift-toy'],
 'v22-art:excel:393':['gift:gift_card','gift-card'],'v22-art:extra:game-general':['gift:game','gift-game'],
 'v22-art:extra:hairdresser-service':['beauty:hairdresser',null], 'v22-art:extra:jewelry-general':['gift:jewelry','gift-jewelry']
};
const entries=[...original,...protectedRefs.map(p=>{
 const preset=COMPOSER_PRESETS.find(q=>`v22-art:preset:${q.presetKey}`===p.visualConceptId);
 const [asset,name]=protectedAssets[p.visualConceptId]??[];
 const media=preset?presetIllustrationPath(preset):name?`/planned-visuals/builder/clay/catalog-compact/${name}.webp`:'/planned-visuals/builder/clay/beauty/hairdresser.webp';
 assert(fs.existsSync(path.join(root,'public',media)),'Missing protected export '+media);
 const bytes=fs.readFileSync(path.join(root,'public',media));
 return {visualConceptId:p.visualConceptId,label:preset?.label??p.label,sourceSHA256:p.sha256,nativeRatio:p.dimensions[0]===p.dimensions[1]?'1:1':'2:1',
   protected:true,assetKeys:asset?[asset]:[],presetKey:preset?.presetKey,
   roles:{primary:{path:media,dimensions:p.dimensions,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'PROTECTED'}}};
})].map(e=>{
 const c=publicConcepts.get(e.visualConceptId), ex=extra.get(e.visualConceptId.split(':').at(-1));
 let contexts=c?new Map(familyScopes).get(c.family):ex?.contexts;
 if(e.presetKey){const p=COMPOSER_PRESETS.find(p=>p.presetKey===e.presetKey);contexts=[({'night-out':'bar','short-stay':'stay','family-visit':'stay','friend-visit':'stay','fast-food':'restaurant','delivery':'restaurant','beauty-restock':'beauty','home-project':'home'})[p.templateKey]??p.templateKey];}
 if(e.visualConceptId==='v22-art:extra:hairdresser-service')contexts=['service','beauty'];
 if(['v22-art:extra:game-general','v22-art:extra:jewelry-general'].includes(e.visualConceptId))contexts=['gift','purchase'];
 if(e.visualConceptId==='v22-art:excel:329')contexts=['cinema','activity'];
 if(e.visualConceptId==='v22-art:excel:499'||e.visualConceptId==='v22-art:excel:520')contexts=['cinema','transport','bar','stay'];
 assert(contexts?.length,'Missing context '+e.visualConceptId);
 if(c)assert.equal(e.label,c.label,'Source/illustration identity mismatch '+e.visualConceptId);
 return {...e,assetKeys:e.assetKeys??[],discovery:{family:c?.family??(e.presetKey?'Intentions protégées':ex?.nature==='ELEMENT'?'Compléments hors Excel':'Scènes et configurations'),
   nature:e.presetKey?'INTENT':ex?.nature??'ELEMENT',contexts,sourceRow:c?.sourceRow,
   provenance:c?'EXCEL_NAME_FAMILY':e.protected?'PROTECTED':'M10_ADDITIONAL_VISUAL',
   destination:'Composer > Tous les éléments',searchable:true}};
});
assert.equal(entries.length,687);assert.equal(new Set(entries.map(e=>e.visualConceptId)).size,687);
assert.equal(entries.filter(e=>!e.protected).length,632);assert.equal(entries.filter(e=>e.discovery.sourceRow).length,529);
const collection={schema:'clay-v22-collection@2',purpose:'Shared concept names and visual discovery only. Actions require published capabilities; no private profiles.',sourceDigest:source.source.sourceSHA256,entries};
fs.writeFileSync('public/planned-visuals/builder/clay/v22/collection.json',JSON.stringify(collection,null,2)+'\n');
console.log(JSON.stringify({identities:entries.length,excel:529,newExcel:524,newExtras:108,protected:55,privateColumnsExported:0}));
