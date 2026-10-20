import type {PlannedAsset} from '@/domain/phase2/planned-assets';
import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
import type {DropTarget} from '@/domain/phase2/planner/composer-contract';
import {publishedDrop} from './interactions';

/** A new catalogue item, never a move of an existing satellite. */
export type BarDockDrag = Readonly<{sourceKey:string;target:DropTarget;values:Readonly<Record<string,string>>}>;
export function barDockDrag(model:ComposerUiModel,target:DropTarget,asset:PlannedAsset):BarDockDrag|undefined {
  const card=model.board.contexts.find(c=>c.contextOccurrenceId===target.contextOccurrenceId);
  if(card?.readOnly||!card?.capabilityRefs.includes('PATCH_CONTEXT')||target.slotKey!=='extras')return;
  const socket=card.sockets.find(s=>s.slotKey===target.slotKey);
  const option=model.library.searchableAssets.find(o=>o.optionKey==='extra'&&o.optionKind==='COMPONENT'&&socket?.choiceAssetKeys?.includes(o.assetKey));
  const source=option&&model.presentation.dragSources[option.assetKey];
  if(!source||source.protected||source.selection||source.sourceSocket||!publishedDrop(model,source.assetKey,target))return;
  return {sourceKey:source.sourceKey,target,values:{productAssetKey:asset.assetKey,label:asset.label,quantity:'1',
    unitBasis:asset.quantityStrategy==='SHARED'?'SHARED':'ITEM',costMode:'UNKNOWN',binding:'AUTO'}};
}
