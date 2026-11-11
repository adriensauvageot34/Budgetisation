import type { ClayCatalogEntry } from '../clay-v22-catalog';
import type { ComposerUiModel } from '@/domain/phase2/planner/composer-ui-contract';
import type { ComposerAssetView, DropTarget } from '@/domain/phase2/planner/composer-contract';
import type { ComponentSelectionV1 } from '@/domain/phase2/planner/component-contract';
import { composerPreset, presetForContext } from '@/domain/phase2/planner/composer-presets';
import { publishedDrop } from './interactions';
import { componentId } from '@/domain/phase2/planner/identity';
import { clayAssetArtwork } from '../clay-v22-media';
import { plannedAsset } from '@/domain/phase2/planned-assets';
import { isPurchaseBasket, type BasketConcept } from '@/domain/phase2/planner/purchase-basket';

export const CATALOG_SCOPES = [['all','Tous les éléments'],['courses','Courses'],['cinema','Cinéma'],['bar','Bar / Apéro'],
  ['restaurant','Restaurant et repas'],['purchase','Achats / Amazon'],['beauty','Beauté'],['stay','Week-end et visites'],
  ['gift','Cadeaux'],['home','Maison'],['transport','Trajets'],['activity','Activités'],['service','Services et frais']] as const;
export type CatalogMoment = 'before' | 'at-bar' | 'lodging' | 'article' | 'included' | 'cinema';
export type DiscoveryTarget = Readonly<{contextId?:string;controlRef?:string;scope?:string;moment?:CatalogMoment}>;
export type CatalogCommand = Readonly<{key?:string;visualConceptId:string;label:string;run:()=>void;editsExisting?:boolean;allowRepeat?:boolean}>;
export const MONTHLY_GROCERIES_REF = 'HOUSEHOLD:household:groceries';
export const normalizeCatalog=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function scopeForCard(model:ComposerUiModel,id?:string){
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);if(!card)return 'all';
 if(presetForContext(card)?.presetKey==='cinema')return 'cinema';
 if(isPurchaseBasket(card)&&card.fields.budgetDomain==='groceries')return 'courses';
 const scopes:Readonly<Record<string,string>>={'night-out':'bar','short-stay':'stay','family-visit':'stay','friend-visit':'stay','fast-food':'restaurant',delivery:'restaurant','beauty-restock':'beauty','home-project':'home'};
 if(card.templateKey==='purchase'&&card.fields.budgetDomain==='home-small')return 'home';
 const scope=scopes[card.templateKey]??card.templateKey;
 return CATALOG_SCOPES.some(([key])=>key===scope)?scope:'all';
}
/** Shared ordinal comparator used by discovery and the existing cinema Dock.
 * Lower tiers first; no probabilities, private affinity or financial computation. */
export function rankDiscoveryCandidates<T extends {key:string;tiers:readonly number[]}>(candidates:readonly T[]):T[]{
 return [...candidates].sort((a,b)=>{for(let i=0;i<Math.max(a.tiers.length,b.tiers.length);i++){const d=(a.tiers[i]??0)-(b.tiers[i]??0);if(d)return d;}return a.key<b.key?-1:a.key>b.key?1:0;});
}
export function selectedCatalogIdentities(model:ComposerUiModel,contextId?:string):ReadonlySet<string>{
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===contextId),ids=new Set<string>();
 for(const socket of card?.sockets??[])for(const item of socket.currentItems){
   if(item.kind!=='COMPONENT')continue;
   if(item.basketArticle?.concept)ids.add(item.basketArticle.concept.id);
   const id=clayAssetArtwork(item.productAssetRef?.assetKey)?.visualConceptId;if(id)ids.add(id);
   if(scopeForCard(model,contextId)==='cinema'&&socket.slotKey==='main'&&item.optionKey==='activity')ids.add('v22-art:excel:329');
 }return ids;
}
function momentRank(entry:ClayCatalogEntry,moment?:CatalogMoment){
 const keys=entry.assetKeys;
 switch(moment){
   case 'before': return keys.some(key=>key.startsWith('house_party:'))?0:1;
   case 'at-bar': return keys.some(key=>key.startsWith('bar:')&&!key.endsWith(':parking'))?0:1;
   case 'lodging': return entry.discovery.family==='Hébergements et locations'?0:1;
   case 'article': return purchaseCatalogProduct(entry)?0:1;
   case 'included': return keys.some(key=>key.startsWith('restaurant:'))?0:1;
   default: return 1;
 }
}
export function catalogResults(entries:readonly ClayCatalogEntry[],{query='',scope='all',family='',nature='',selectedIds=new Set<string>(),moment,commandIds=new Set<string>()}:{query?:string;scope?:string;family?:string;nature?:string;selectedIds?:ReadonlySet<string>;moment?:CatalogMoment;commandIds?:ReadonlySet<string>}){
 const q=normalizeCatalog(query),tokens=q.split(' ').filter(Boolean);
 return rankDiscoveryCandidates(entries.flatMap(entry=>{
   const label=normalizeCatalog(entry.label),text=normalizeCatalog(`${entry.label} ${entry.discovery.family}`);
   const inMoment=commandIds.has(entry.visualConceptId);
   if(family&&entry.discovery.family!==family||nature&&entry.discovery.nature!==nature||scope!=='all'&&!entry.discovery.contexts.includes(scope)&&!inMoment||!tokens.every(t=>text.includes(t)))return [];
   const core=scope==='cinema'?entry.discovery.sourceRow===329?0:entry.visualConceptId==='v22-art:extra:popcorn'?1:2
     :scope==='courses'?entry.discovery.family==='Courses et produits alimentaires'?0:entry.discovery.family==='Boissons'?1:2
     :scope==='bar'?entry.discovery.family==='Boissons'?0:1
     :scope==='purchase'?purchaseCatalogProduct(entry)?0:1:entry.discovery.nature==='INTENT'?0:1;
   const chosen=selectedIds.has(entry.visualConceptId),complement=scope==='cinema'&&selectedIds.has('v22-art:excel:329')&&entry.visualConceptId==='v22-art:extra:popcorn';
   const situated=inMoment?0:momentRank(entry,moment);
   return [{key:entry.visualConceptId,entry,tiers:[q?label===q?0:label.startsWith(q)?1:2:0,core,situated,chosen?0:1,complement?0:1],
     reason:chosen?'Déjà choisi · retrouver cet élément':complement?'Complément facultatif du billet':inMoment?'Choix disponible dans cette étape':scope==='all'?'Catalogue V22':core===0?'Au cœur de ce contexte':entry.discovery.nature==='SCENE'||entry.discovery.nature==='MODE'?'Repère visuel du contexte':'Élément pertinent dans ce contexte'}];
 }));
}
const purchaseModules = new Set(['beauty','clothing','household','home','tech','automotive']);
export function purchaseCatalogProduct(entry:ClayCatalogEntry,domain?:unknown){
 if(entry.discovery.nature!=='ELEMENT')return undefined;
 const expectedModule=domain==='clothing'?'clothing':domain==='home-small'?'household':domain==='games-digital'?'tech':undefined;
 return entry.assetKeys.map(plannedAsset).find(asset=>asset&&purchaseModules.has(asset.module)
   &&(!expectedModule||asset.module===expectedModule)
   &&asset.assetKey!=='beauty:hairdresser'&&asset.assetKey!=='automotive:wash'&&!/_fee$/u.test(asset.assetKey));
}
export type GuidedCatalogChoice = { kind:'article';label:string } | { kind:'socket';asset:ComposerAssetView;target:DropTarget;selection?:ComponentSelectionV1 };
export type DiscoveryAction = Readonly<{key:string;label:string;kind:'OPEN'|'PRESET'|'CHOOSE';contextId?:string;presetKey?:string;focus?:string;articleLabel?:string;componentLabel?:string;concept?:BasketConcept;
 asset?:ComposerAssetView;target?:DropTarget;selection?:ComponentSelectionV1}>;
export function catalogRefLocked(model:ComposerUiModel,id:string){
 return model.semanticState.preferences.anchors.includes(id)||model.semanticState.preferences.flexibility[id]==='PRESERVE';
}
export function catalogSocket(model:ComposerUiModel,contextId:string,slotKey:string,assetKey:string){
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===contextId);
 if(!card||card.readOnly||!card.capabilityRefs.includes('PATCH_CONTEXT')||catalogRefLocked(model,contextId))return;
 const socket=card.sockets.find(s=>s.slotKey===slotKey&&s.contextOccurrenceId===contextId);
 const asset=model.library.searchableAssets.find(a=>a.assetKey===assetKey);
 const target:DropTarget={kind:'CONTEXT_SOCKET',contextOccurrenceId:contextId,slotKey};
 if(!socket?.choiceAssetKeys?.includes(assetKey)||!asset||publishedDrop(model,assetKey,target)?.semanticAction!=='PATCH_CONTEXT')return;
 return {card,socket,asset,target};
}
/** Map only established identities onto capabilities already published by the server.
 * A visual, family or free label never grants a writer. */
export function discoveryActions(entry:ClayCatalogEntry,model:ComposerUiModel,target:DiscoveryTarget):DiscoveryAction[]{
 const actions:DiscoveryAction[]=[];
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===target.contextId);
 if(!target.contextId&&entry.discovery.sourceRow&&entry.discovery.nature==="ELEMENT"&&purchaseCatalogProduct(entry)?.module==="beauty"){
   const asset=model.library.searchableAssets.find(candidate=>candidate.assetKey==="template:purchase");
   if(asset&&publishedDrop(model,asset.assetKey,{kind:"BOARD_ZONE"})?.semanticAction==="ADD_CONTEXT")
     actions.push({key:"beauty-basket:"+entry.visualConceptId,kind:"PRESET",presetKey:"beauty-purchase",asset,
       concept:{id:entry.visualConceptId,label:entry.label},label:`Préparer un achat de ${entry.label}`});
 }
 if(entry.presetKey){
   const preset=composerPreset(entry.presetKey);
   const existing=model.board.contexts.filter(c=>presetForContext(c)?.presetKey===entry.presetKey);
   for(const [i,c] of existing.entries())actions.push({key:'open:'+c.contextOccurrenceId,kind:'OPEN',contextId:c.contextOccurrenceId,label:`Ouvrir ${c.label}${existing.length>1?` · occurrence ${i+1}`:''}`});
   const asset=preset&&model.library.searchableAssets.find(a=>a.kind==='CONTEXT_ASSET'&&a.templateKey===preset.templateKey);
   if(!target.contextId&&!existing.length&&asset&&publishedDrop(model,asset.assetKey,{kind:'BOARD_ZONE'})?.semanticAction==='ADD_CONTEXT')actions.push({key:'preset:'+entry.presetKey,kind:'PRESET',presetKey:entry.presetKey,asset,label:`Préparer ${preset!.label}`});
 }
 if(!card||card.readOnly||!card.capabilityRefs.includes('PATCH_CONTEXT')||catalogRefLocked(model,card.contextOccurrenceId))return actions;
 const id=card.contextOccurrenceId;
 const preset=presetForContext(card)?.presetKey;
 if(preset==='bar-apero'){
   const before=card.sockets.find(socket=>socket.slotKey==='before')?.currentItems
     .find(item=>item.kind==='CHILD_CONTEXT');
   const child=before?.kind==='CHILD_CONTEXT'&&model.board.contexts.find(c=>c.contextOccurrenceId===before.childContextOccurrenceId&&c.parentContextOccurrenceId===id);
   const moments=[
     ...(target.moment!=='before'?[{owner:card,slots:['extras'],prefix:'',label:'Au bar'}]:[]),
     ...(child&&target.moment!=='at-bar'?[{owner:child,slots:['main','extras'],prefix:'before-',label:'Before'}]:[]),
   ];
   for(const moment of moments){
     if(moment.owner.readOnly||!moment.owner.capabilityRefs.includes('PATCH_CONTEXT')||catalogRefLocked(model,moment.owner.contextOccurrenceId))continue;
     for(const socket of moment.owner.sockets.filter(s=>moment.slots.includes(s.slotKey))){
       const matches=socket.currentItems.filter(item=>item.kind==='COMPONENT'&&item.productAssetRef&&entry.assetKeys.includes(item.productAssetRef.assetKey));
       for(const [index,selection] of matches.entries()){
         if(catalogRefLocked(model,componentId(moment.owner.contextOccurrenceId,socket.slotKey,selection.selectionId)))continue;
         actions.push({key:'bar:'+selection.selectionId,kind:'OPEN',contextId:id,
           focus:`component:${moment.prefix}${socket.slotKey}:${selection.selectionId}`,
           label:`Modifier ${entry.label} · ${moment.label}${matches.length>1?` · ligne ${index+1}`:''}`});
       }
     }
   }
   return actions;
 }
 if(card.templateKey==='purchase'&&!isPurchaseBasket(card)&&preset&&purchaseCatalogProduct(entry,card.fields.budgetDomain)){
   const route=catalogSocket(model,id,'item','option:purchase:item:item');
   const item=route?.socket.currentItems.find(item=>item.kind==='COMPONENT');
   if(route&&!item&&!String(card.fields.productLabel??'').trim())
     actions.push({key:'purchase:'+id,kind:'OPEN',contextId:id,label:'Configurer '+entry.label+' dans cet achat',articleLabel:entry.label});
   if(route&&item&&!catalogRefLocked(model,componentId(id,'item',item.selectionId)))
     actions.push({key:'purchase:'+item.selectionId,kind:'CHOOSE',asset:route.asset,target:route.target,selection:item,label:`Modifier l’article actuel · ${item.label}`});
 }
 const product=purchaseCatalogProduct(entry);
 const productSlot=card.templateKey==='beauty-restock'&&product?.module==='beauty'
   ? {slot:'products',key:'option:beauty-restock:products:product'}
   : card.templateKey==='home-project'&&product?.module==='home'
     ? {slot:'items',key:'option:home-project:items:item'} : undefined;
 if(productSlot){
   const route=catalogSocket(model,id,productSlot.slot,productSlot.key);
   if(route?.socket.cardinality==='REPEATING'){
     const sameLabel=route.socket.currentItems.some(item=>item.kind==='COMPONENT'&&normalizeCatalog(item.label)===normalizeCatalog(entry.label));
     if(sameLabel)actions.push({key:'review:'+id,kind:'OPEN',contextId:id,label:'Retrouver les postes déjà choisis'});
     actions.push({key:'product:'+route.asset.assetKey,kind:'CHOOSE',asset:route.asset,target:route.target,componentLabel:entry.label,
       label:sameLabel?`Préparer une autre ligne ${entry.label}`:`Configurer ${entry.label} · ${route.socket.label??productSlot.slot}`});
   }
 }
 if(card.templateKey==='activity'&&!preset&&['v22-art:excel:342','v22-art:excel:343'].includes(entry.visualConceptId)){
   const route=catalogSocket(model,id,'main','option:activity:main:activity');
   if(route&&!route.socket.currentItems.some(item=>item.kind!=='UNRESOLVED'))actions.push({key:'activity:'+id,kind:'CHOOSE',
     asset:route.asset,target:route.target,componentLabel:entry.label,label:`Configurer ${entry.label} dans cette activité`});
 }
 for(const socket of card.sockets){
   const keys=[...entry.assetKeys];
   if(preset==='cinema'&&entry.discovery.sourceRow===329&&socket.slotKey==='main')keys.push('option:activity:main:activity');
   if(preset==='cinema'&&entry.discovery.sourceRow===499&&socket.slotKey==='transport')keys.push('option:activity:transport:taxi');
   if(preset==='cinema'&&entry.discovery.sourceRow===520&&socket.slotKey==='transport'
     &&socket.currentItems.some(item=>item.kind==='MOBILITY_INTENT'&&item.optionKey==='car'))keys.push('option:activity:transport:car');
   for(const assetKey of new Set(keys)){
     const route=catalogSocket(model,id,socket.slotKey,assetKey);
     if(!route)continue;
     const {asset,target:exactTarget}=route;
     const existing=socket.currentItems.filter(item=>item.kind===asset.optionKind&&item.optionKey===asset.optionKey);
     if(existing.length){
       for(const [index,selection] of existing.entries()){
         if(catalogRefLocked(model,componentId(id,socket.slotKey,selection.selectionId)))continue;
         actions.push({key:`edit:${socket.slotKey}:${selection.selectionId}`,kind:'CHOOSE',asset,target:exactTarget,selection,
           label:`Modifier ${entry.label} · ${socket.label??socket.slotKey}${existing.length>1?` · ligne ${index+1}`:''}`});
       }
     }else if(!socket.currentItems.some(item=>item.kind!=='UNRESOLVED')){
       actions.push({key:`configure:${socket.slotKey}:${assetKey}`,kind:'CHOOSE',asset,target:exactTarget,label:`Configurer ${entry.label} · ${socket.label??socket.slotKey}`});
     }
   }
 }
 return actions;
}
