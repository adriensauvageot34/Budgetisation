import 'server-only';
import {editNightOut} from '@/domain/phase2/planner/night-out-edit';
import type {ComponentSelectionV1} from '@/domain/phase2/planner/component-contract';
import {PLANNED_ASSET_CATALOG_VERSION,plannedAsset} from '@/domain/phase2/planned-assets';

/** Synthetic reception only; the caller's existing Preview/Auth gate is required.
 * Literal user choices, not prices calculated by this fixture. Compiler prices them. */
export function barClosedFixture(draft:Parameters<typeof editNightOut>[0],id:string,state:'empty'|'partial'|'rich'|'three'|'five'|'long'){
  const line=(suffix:string,label:string,asset:string|null,amount:string|null,unitBasis:'ITEM'|'SHARED'):ComponentSelectionV1=>({
    selectionId:`ba610000-0000-4000-8000-0000000000${suffix}`,optionKey:'extra',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',label,quantity:'1',unitBasis,
    cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],binding:{mode:'AUTO'},
    ...(asset?{productAssetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset,labelAtSelection:plannedAsset(asset)?.label??label,provenance:'EXPLICIT_USER_DECISION' as const}}:{})});
  return editNightOut(draft,{contextOccurrenceId:id,fields:{},slots:{extras:state==='empty'?[]:[
    line('01','Bouteille',null,'20','SHARED'),
    line('02','Bière','bar:beer',state==='partial'?'8':'20','ITEM'),
    line('03','Bière','bar:beer',state==='partial'?null:'28','ITEM'),
    ...(['three','five','long'].includes(state)?[line('04','Cocktail','bar:cocktail','12','ITEM')]:[]),
    ...(['five','long'].includes(state)?[line('05','Soft','bar:soft','9','ITEM'),line('06',state==='long'?'Planche de dégustation à partager, grand format':'Planche','bar:tapas',state==='long'?'12345.67':'15','SHARED')]:[])
  ]}});
}
