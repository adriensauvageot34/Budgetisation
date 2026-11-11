import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
const [repo,campaign]=process.argv.slice(2).map(p=>path.resolve(p));
const read=async p=>JSON.parse(await readFile(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const require=createRequire(import.meta.url),ts=require(path.join(repo,'node_modules/typescript'));
const sharp=require('C:/Users/AdrienSauvageot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const m14=path.join(campaign,'outputs/m14-1'),m13=path.join(campaign,'outputs/m13');
const manifestBytes=await readFile(path.join(m14,'manifests/M14-EXPORT-MANIFEST.json'));
const lock=await read(path.join(m14,'manifests/M14-EXPORT-SHA256.json'));
assert.equal(hash(manifestBytes),lock.documents['manifests/M14-EXPORT-MANIFEST.json']);
const m14Data=JSON.parse(manifestBytes),masters=await read(path.join(m13,'manifests/M13-FINAL-MASTERS.json'));
const oldRegistry=await read(path.join(repo,'src/app/mois-a-venir/builder-illustration-registry.json'));
const assetsSource=await readFile(path.join(repo,'src/domain/phase2/planned-assets.ts'),'utf8');
const exported={};vm.runInNewContext(ts.transpileModule(assetsSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exported});
const assetList=exported.PLANNED_ASSETS;assert(Array.isArray(assetList),'Catalogue courant PLANNED_ASSETS');
const actualAssets=new Map(assetList.map(a=>[a.assetKey,a]));
const active=masters.masters.filter(m=>m.priority!=='P2'),assets={},builders={},artworks={},decisions=[];
const protectedAssetKeys=new Set(['gift:flowers','gift:chocolate','gift:book','gift:toy','gift:gift_card','gift:game','gift:jewelry','clothing:jewelry','beauty:hairdresser']);
for(const m of active)for(const a of m.integrationEvidence.associationsM11){
 if(!a.key||!actualAssets.has(a.key)||protectedAssetKeys.has(a.key))continue;
 assert.equal(actualAssets.get(a.key).label,a.label,'Libellé courant changé : '+a.key);
 assert(!assets[a.key]||assets[a.key]===m.visualConceptId,'Association ambiguë '+a.key);
 assets[a.key]=m.visualConceptId;
}
// Explicit meaning of the existing illustration keys. Asset-specific bindings take precedence.
const byIllustration={
 'drinks/beer':'excel:2','drinks/beer-closed':'excel:2','drinks/wine-glass':'excel:6','drinks/wine-bottle':'excel:7',
 'drinks/shared-bottle-closed':'extra:bottle-general','drinks/shot':'excel:13','drinks/soft':'extra:boisson-non-alcool','drinks/soft-closed':'extra:boisson-non-alcool',
 'drinks/cocktail-closed':'extra:cocktail-general','drinks/water':'extra:eau-generale','drinks/coffee':'excel:24','drinks/energy':'extra:energy-drink','drinks/vodka':'extra:vodka','drinks/rum':'extra:rhum',
 'scenes/bar-interior-closed':'extra:bar-interior','moments/before-editorial':'extra:before-moment',
 'intent/restaurant':'extra:restaurant-intent','intent/fast-food':'extra:fastfood-intent','intent/work-meal':'extra:workmeal-intent','intent/groceries':'extra:groceries-intent',
 'intent/party':'extra:party-intent','intent/visit':'extra:visit-intent','intent/activity':'extra:activity-intent','intent/purchase':'extra:purchase-intent','intent/travel':'extra:travel-intent',
 'social/solo':'extra:solo-scene','social/group':'extra:group-scene','social/birthday':'extra:birthday-occasion','social/valentine':'extra:valentine-occasion','social/celebration':'extra:celebration-occasion','social/family':'extra:family-visit',
 'outing/club':'extra:club-festival-intent','outing/private-party':'extra:private-party-intent','outing/festival':'extra:festival-intent',
 'food/main':'extra:main-dish-general','food/snack':'extra:snack-general','food/tapas':'extra:plateau-apero','food/tapas-closed':'extra:plateau-apero',
 'food/produce':'extra:produce-group','food/fresh':'extra:fresh-group','food/pantry':'extra:pantry-group','food/bread':'extra:bread-bakery','food/meat':'extra:viande-generale',
 'transport/car':'extra:car-mode','transport/train':'extra:train-mode','transport/tram':'extra:tram-mode','transport/bus':'extra:bus-mode','transport/plane':'extra:flight-mode','transport/bike':'extra:bike-mode','transport/walking':'extra:walking-mode',
 'transport/scooter':'extra:scooter-rental','transport/fuel':'extra:fuel-estimate','transport/road':'extra:other-paid-travel',
 'lodging/hotel':'extra:hotel-stay-general','lodging/rental':'extra:rental-platform','lodging/hostel':'extra:hostel-category','lodging/sleep':'extra:lodging-room',
 'misc/delivery':'excel:503','misc/receipt':'excel:504','misc/document':'extra:administrative','misc/contribution':'extra:contribution-general','misc/gift':'extra:gift-intent',
 'activities/cinema':'extra:activity-cinema','activities/kayak':'extra:kayak-activity','activities/theme-park':'extra:themepark-activity','activities/show':'extra:show-activity','activities/match':'extra:match-activity','activities/sport':'extra:sport-activity','activities/fishing':'extra:fishing-activity','activities/photo':'extra:photo-activity','activities/museum':'extra:visits-general',
 'home/lamp':'extra:lamp','home/furniture':'extra:furniture-general','home/bedding':'extra:bedding','home/storage':'extra:storage','home/decor':'extra:decor-general','home/kitchen':'extra:kitchen-general','home/dishes':'extra:dishes','home/diy':'extra:diy-general','home/electric':'extra:electric-general',
 'clothing/bag':'extra:bag-general','clothing/shoes':'extra:shoes-general',
 'food/thai':'extra:thai-food','food/tacos':'extra:tacos-kebab','food/chicken':'extra:chicken-other',
};
const protectedIllustrations=new Set(['food/chocolate','misc/book','misc/game','misc/toy','misc/gift-card','misc/flowers','clothing/jewelry','beauty/hairdresser']);
for(const [key,file]of Object.entries(oldRegistry.illustrations)){
 if(byIllustration[key]||protectedIllustrations.has(key))continue;
 const candidates=active.filter(m=>m.integrationEvidence.legacyMedia.includes('public/planned-visuals/builder/clay/'+file));
 if(candidates.length===1)byIllustration[key]=candidates[0].visualConceptId.replace('v22-art:','');
 else decisions.push({illustrationKey:key,status:'HISTORICAL_FALLBACK',candidateIds:candidates.map(m=>m.visualConceptId),reason:'Absence de correspondance unique démontrée pour cet alias.'});
}
for(const [key,illustration]of Object.entries(oldRegistry.choices)){
 if(key.startsWith('asset:')){const id=assets[key.slice(6)];if(id)builders[key]=id;continue;}
 const short=byIllustration[illustration];if(short)builders[key]='v22-art:'+short;
}
for(const [key,id]of Object.entries(assets))builders['asset:'+key]=id;
// The former generic media aliases hid differences already present in the business keys.
Object.assign(builders,{
 'scene:taxi':'v22-art:extra:taxi-vtc-mode','choice:transport:TAXI':'v22-art:extra:taxi-vtc-mode',
 'choice:workMode:DELIVERED':'v22-art:extra:delivery-meal-intent','choice:fastFoodChannel:DELIVERY':'v22-art:extra:delivery-meal-intent',
 'scene:menu':'v22-art:excel:69','scene:digestif':'v22-art:extra:digestif',
});
const deferredBuilderKeys=['choice:workMode:BOUGHT','choice:groceriesNature:TOP_UP','choice:channel:PICKUP',
 'choice:channel:DELIVERY','choice:provider:DIRECT','choice:channel:TAKEAWAY','choice:channel:ONLINE','choice:fastFoodChannel:TAKEAWAY',
 'choice:purchaseCategory:beauty','module:beauty','choice:groceryFocus:HYGIENE','choice:purchaseCategory:home_equipment',
 'module:home','choice:automotiveKind:SERVICE','choice:automotiveKind:PRODUCT','scene:custom'];
for(const key of deferredBuilderKeys){delete builders[key];decisions.push({semanticKey:key,status:'HISTORICAL_FALLBACK',reason:'Choix générique ou canal : aucune équivalence démontrée avec un objet précis ou des frais. Le média historique reste en place.'});}
const directConsumers={
 'v22-art:excel:329':['Cinema suggestions: billet-cinema'],
 'v22-art:excel:479':['ShortStay extras: breakfast'],
 'v22-art:excel:483':['ShortStay extras: tax'],
 'v22-art:excel:499':['Cinema suggestions: taxi'],
 'v22-art:extra:popcorn':['Cinema suggestions: popcorn'],
 'v22-art:extra:boisson-generale':['Cinema suggestions: boisson'],
 'v22-art:extra:bar-interior':['BarLivingCard CSS header'],
};
const publicRelative='public/planned-visuals/builder/clay/v22',destination=path.join(repo,publicRelative);
for(const role of ['primary','wide','compact','specialized'])await mkdir(path.join(destination,role),{recursive:true});
const allEntries=[],derived=[];
for(const row of m14Data.illustrations){
 const roles={};
 for(const exp of row.exports){
  const relative=exp.exportPath.replace('exports/',''),target=path.join(destination,relative),input=await readFile(path.join(m14,exp.exportPath));
  assert.equal(hash(input),exp.exportSHA256,exp.exportPath);
  await writeFile(target,input);
  roles[exp.role]={path:relative,dimensions:exp.dimensions,bytes:exp.bytes,sha256:exp.exportSHA256,source:'M14.1'};
 }
 if(row.priority!=='P2'&&row.nativeRatio==='2:1'&&!roles.compact){
  const input=await readFile(path.join(m13,row.sourcePath));assert.equal(hash(input),row.sourceSHA256);
  const png=await sharp(input).resize(256,256,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const webp=await sharp(png).webp({quality:95,alphaQuality:100,effort:5}).toBuffer();
  const file='compact/'+row.visualConceptId.replaceAll(':','-')+'.webp';await writeFile(path.join(destination,file),webp);
  roles.compact={path:file,dimensions:[256,256],bytes:webp.length,sha256:hash(webp),source:'M15_TECHNICAL_DERIVATIVE'};
  derived.push({visualConceptId:row.visualConceptId,sourceSHA256:row.sourceSHA256,sourcePath:row.sourcePath,export:roles.compact,reason:'Miniature des scènes déjà consommées, sans charger le panorama dans une palette ou la Library.',settings:{fit:'contain',quality:95,alphaQuality:100,effort:5}});
 }
 const entry={visualConceptId:row.visualConceptId,label:row.label,priority:row.priority,nativeRatio:row.nativeRatio,sourceSHA256:row.sourceSHA256,roles};
 allEntries.push(entry);
 if(row.priority!=='P2')artworks[row.visualConceptId]={ratio:row.nativeRatio,roles:Object.fromEntries(Object.entries(roles).map(([role,r])=>[role,r.dimensions]))};
}
for(const id of [...Object.values(assets),...Object.values(builders),...Object.keys(directConsumers)])assert(artworks[id],id);
const binding={schema:'clay-v22-bindings@1',assets,builders,artworks};
const json=async(file,v)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(v,null,2)+'\n');};
await json(path.join(repo,'src/app/mois-a-venir/clay-v22-bindings.json'),binding);
await json(path.join(destination,'collection.json'),{schema:'clay-v22-collection@1',purpose:'Illustrations uniquement : aucune disponibilité métier, aucun owner, aucun mediaKey créé.',sourceDigest:m14Data.source.collectionDigestSHA256,entries:allEntries});
const mappings=allEntries.map(row=>({...row,assetKeys:Object.entries(assets).filter(([,id])=>id===row.visualConceptId).map(([key])=>key),builderKeys:Object.entries(builders).filter(([,id])=>id===row.visualConceptId).map(([key])=>key),directConsumers:directConsumers[row.visualConceptId]??[],status:row.priority==='P2'?'PREPARED_ONLY':'APPLICATION_BINDING_PREPARED'}));
const reportRoot=path.join(campaign,'work/clay-campaign/m15');await mkdir(reportRoot,{recursive:true});
await json(path.join(reportRoot,'M14-2-MAPPING.json'),{schema:'m14-2-mapping@1',baselineHead:'91cd52313886457f2a22bf26abc1dcb86fca1276',protectedAssetKeys:[...protectedAssetKeys],assetCatalogSourceSHA256:hash(Buffer.from(assetsSource)),assets: Object.keys(assets).length,builderKeys:Object.keys(builders).length,decisions,illustrations:mappings});
await json(path.join(reportRoot,'M15-TECHNICAL-DERIVATIVES.json'),{derivatives:derived});
console.log(JSON.stringify({registered:allEntries.length,activeArtwork:Object.keys(artworks).length,assetBindings:Object.keys(assets).length,builderBindings:Object.keys(builders).length,derived:derived.length,unboundActive:mappings.filter(r=>r.priority!=='P2'&&!r.assetKeys.length&&!r.builderKeys.length&&!r.directConsumers.length).map(r=>({id:r.visualConceptId,label:r.label}))}));
