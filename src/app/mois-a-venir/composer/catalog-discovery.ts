import type { ClayCatalogEntry } from '../clay-v22-catalog';
import type { ComposerUiModel } from '@/domain/phase2/planner/composer-ui-contract';
import type { ComposerAssetView, DropTarget } from '@/domain/phase2/planner/composer-contract';
import type { ComponentSelectionV1 } from '@/domain/phase2/planner/component-contract';
import { composerPreset, presetForContext } from '@/domain/phase2/planner/composer-presets';
import { publishedDrop } from './interactions';
import { componentId } from '@/domain/phase2/planner/identity';
import { clayAssetArtwork } from '../clay-v22-media';

export const CATALOG_SCOPES = [['all','Tous les éléments'],['courses','Courses'],['cinema','Cinéma'],['bar','Bar / Apéro'],
  ['restaurant','Restaurant et repas'],['purchase','Achats / Amazon'],['beauty','Beauté'],['stay','Week-end et visites'],
  ['gift','Cadeaux'],['home','Maison'],['transport','Trajets'],['activity','Activités'],['service','Services et frais']] as const;
export type DiscoveryTarget = Readonly<{contextId?:string;controlRef?:string;scope?:string}>;
export const normalizeCatalog=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function scopeForCard(model:ComposerUiModel,id?:string){
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===id);if(!card)return 'all';
 if(presetForContext(card)?.presetKey==='cinema')return 'cinema';
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
   const id=clayAssetArtwork(item.productAssetRef?.assetKey)?.visualConceptId;if(id)ids.add(id);
   if(scopeForCard(model,contextId)==='cinema'&&socket.slotKey==='main'&&item.optionKey==='activity')ids.add('v22-art:excel:329');
 }return ids;
}
export function catalogResults(entries:readonly ClayCatalogEntry[],{query='',scope='all',family='',nature='',selectedIds=new Set<string>()}:{query?:string;scope?:string;family?:string;nature?:string;selectedIds?:ReadonlySet<string>}){
 const q=normalizeCatalog(query),tokens=q.split(' ').filter(Boolean);
 return rankDiscoveryCandidates(entries.flatMap(entry=>{
   const label=normalizeCatalog(entry.label),text=normalizeCatalog(`${entry.label} ${entry.discovery.family}`);
   if(family&&entry.discovery.family!==family||nature&&entry.discovery.nature!==nature||scope!=='all'&&!entry.discovery.contexts.includes(scope)||!tokens.every(t=>text.includes(t)))return [];
   const core=scope==='cinema'?entry.discovery.sourceRow===329?0:entry.visualConceptId==='v22-art:extra:popcorn'?1:2
     :scope==='courses'?entry.discovery.family==='Courses et produits alimentaires'?0:entry.discovery.family==='Boissons'?1:2
     :scope==='bar'?entry.discovery.family==='Boissons'?0:1:entry.discovery.nature==='INTENT'?0:1;
   const chosen=selectedIds.has(entry.visualConceptId),complement=scope==='cinema'&&selectedIds.has('v22-art:excel:329')&&entry.visualConceptId==='v22-art:extra:popcorn';
   return [{key:entry.visualConceptId,entry,tiers:[q?label===q?0:label.startsWith(q)?1:2:0,core,entry.discovery.contexts.includes(scope)?0:1,chosen?0:1,complement?0:1],
     reason:chosen?'Déjà choisi · retrouver cet élément':complement?'Complément facultatif du billet':scope==='all'?'Catalogue V22':core===0?'Au cœur de ce contexte':entry.discovery.nature==='SCENE'||entry.discovery.nature==='MODE'?'Repère visuel du contexte':'Élément pertinent dans ce contexte'}];
 }));
}
export type DiscoveryAction = Readonly<{key:string;label:string;kind:'OPEN'|'PRESET'|'CHOOSE';contextId?:string;presetKey?:string;
 asset?:ComposerAssetView;target?:DropTarget;selection?:ComponentSelectionV1}>;
/** Map only established identities onto capabilities already published by the server.
 * A visual, family or free label never grants a writer. */
export function discoveryActions(entry:ClayCatalogEntry,model:ComposerUiModel,target:DiscoveryTarget):DiscoveryAction[]{
 const actions:DiscoveryAction[]=[];
 const card=model.board.contexts.find(c=>c.contextOccurrenceId===target.contextId);
 const locked=(id:string)=>model.semanticState.preferences.anchors.includes(id)||model.semanticState.preferences.flexibility[id]==='PRESERVE';
 if(entry.presetKey){
   const preset=composerPreset(entry.presetKey);
   const existing=model.board.contexts.filter(c=>presetForContext(c)?.presetKey===entry.presetKey);
   for(const [i,c] of existing.entries())actions.push({key:'open:'+c.contextOccurrenceId,kind:'OPEN',contextId:c.contextOccurrenceId,label:`Ouvrir ${c.label}${existing.length>1?` · occurrence ${i+1}`:''}`});
   const asset=preset&&model.library.searchableAssets.find(a=>a.kind==='CONTEXT_ASSET'&&a.templateKey===preset.templateKey);
   if(!existing.length&&asset&&publishedDrop(model,asset.assetKey,{kind:'BOARD_ZONE'})?.semanticAction==='ADD_CONTEXT')actions.push({key:'preset:'+entry.presetKey,kind:'PRESET',presetKey:entry.presetKey,asset,label:`Préparer ${preset!.label}`});
 }
 if(!card||card.readOnly||!card.capabilityRefs.includes('PATCH_CONTEXT')||locked(card.contextOccurrenceId))return actions;
 for(const socket of card.sockets){
   const exactTarget:DropTarget={kind:'CONTEXT_SOCKET',contextOccurrenceId:card.contextOccurrenceId,slotKey:socket.slotKey};
   const keys=[...entry.assetKeys];
   if(scopeForCard(model,card.contextOccurrenceId)==='cinema'&&entry.discovery.sourceRow===329&&socket.slotKey==='main')keys.push('option:activity:main:activity');
   const matches=socket.currentItems.filter(i=>i.kind==='COMPONENT'&&i.productAssetRef&&keys.includes(i.productAssetRef.assetKey));
   // A stored product identity is authoritative; label equality is not.
   for(const selection of matches){
     if(locked(componentId(card.contextOccurrenceId,socket.slotKey,selection.selectionId)))continue;
     actions.push({key:'existing:'+selection.selectionId,kind:'OPEN',contextId:card.contextOccurrenceId,label:`Ouvrir ${card.label} · ${entry.label} déjà choisi`});
   }
   if(matches.length)continue;
   for(const asset of model.library.searchableAssets.filter(a=>keys.includes(a.assetKey)&&socket.choiceAssetKeys?.includes(a.assetKey))){
     if(publishedDrop(model,asset.assetKey,exactTarget)?.semanticAction!=='PATCH_CONTEXT')continue;
     const existing=socket.currentItems.filter(i=>i.kind===asset.optionKind&&i.optionKey===asset.optionKey);
     if(existing.length){for(const selection of existing)if(!locked(componentId(card.contextOccurrenceId,socket.slotKey,selection.selectionId)))actions.push({key:`edit:${socket.slotKey}:${selection.selectionId}`,kind:'CHOOSE',asset,target:exactTarget,selection,label:`Modifier ${entry.label} · ${socket.label??socket.slotKey}`});}
     else actions.push({key:`configure:${socket.slotKey}:${asset.assetKey}`,kind:'CHOOSE',asset,target:exactTarget,label:`Configurer ${entry.label} · ${socket.label??socket.slotKey}`});
   }
 }
 return actions;
}
