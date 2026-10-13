import type {ComposerUiModel} from '@/domain/phase2/planner/composer-ui-contract';
type Drop=ComposerUiModel['dropCapabilities'][number];
// Only an index of the immutable UI projection, never an authority or World
// cache. A new model gets a new index, including changed prices/capabilities.
const indexes=new WeakMap<ComposerUiModel,ReturnType<typeof buildIndex>>();
function buildIndex(model:ComposerUiModel){const drops=new Map<string,Drop[]>();
  for(const drop of model.dropCapabilities){const rows=drops.get(drop.sourceAssetKey);if(rows)rows.push(drop);else drops.set(drop.sourceAssetKey,[drop]);}
  return {drops,assets:new Map(model.library.searchableAssets.map(a=>[a.assetKey,a])),contexts:new Map(model.board.contexts.map(c=>[c.contextOccurrenceId,c])),
    controls:new Map([...model.board.baselineControls,...model.board.discretionaryControls,...model.board.savings].map(c=>[c.targetRef,c]))};
}
export function composerRenderIndex(model:ComposerUiModel){let index=indexes.get(model);if(!index){index=buildIndex(model);indexes.set(model,index);}return index;}
