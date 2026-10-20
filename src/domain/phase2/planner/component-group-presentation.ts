import type {ComponentSelectionV1} from './component-contract';

/** Read-only membership. Callers provide ONE owner and ONE slot/moment.
 * Neither labels nor prices establish product identity. No financial arithmetic. */
export function componentPresentationGroups(items:readonly ComponentSelectionV1[]) {
  const groups=new Map<string,{key:string;items:ComponentSelectionV1[]}>();
  for(const item of items){
    const key=item.kind==='COMPONENT'&&item.productAssetRef
      ?JSON.stringify([item.kind,item.productAssetRef.catalogVersion,item.productAssetRef.assetKey,item.unitBasis??'ITEM',
        item.quantityEvidenceVersion??null,item.quantityPerPerson??null,item.pricedParticipantCount??null,
        item.binding??null,item.provenance,item.economicScope?{...item.economicScope,coveredSelectionIds:item.economicScope.coveredSelectionIds.map(id=>id===item.selectionId?'$self':id).sort()}:null])
      :JSON.stringify(['single',item.selectionId]);
    const group=groups.get(key)??{key,items:[]};group.items.push(item);groups.set(key,group);
  }
  return [...groups.values()].map(group=>({...group,items:group.items.toSorted((a,b)=>a.selectionId.localeCompare(b.selectionId))}));
}

export type ComponentGroupProjection=Readonly<{contextOccurrenceId:string;slotKey:string;groupKey:string;selectionIds:readonly string[];
  semanticStateDigest:string;quantity:string|null;unitBasis:string;knownAmount:string|null;incomplete:boolean}>;
