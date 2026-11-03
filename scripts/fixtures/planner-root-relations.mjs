import {monthFixture} from './composer-v22-b1.mjs';
import {uuid,householdId} from './planner-headless.mjs';
import {require} from '../lib/phase2-ts-loader.mjs';
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');

/** Real owner publications over an existing synthetic World; no financial writer. */
export async function rootRelationsFixture(){
  const f=monthFixture(),ids=[uuid(98201),uuid(98202),uuid(98203),uuid(98204)];
  const contexts=ids.map((id,index)=>({contextOccurrenceId:id,templateKey:'night-out',status:'ACTIVE',parentContextOccurrenceId:null,
    fields:{fieldSchemaVersion:'context-fields@v2',...presetCreationFields('night-out',index%2?'bar-apero':'friends-evening'),plannedDate:'2026-11-12'},
    slotSelections:{main:{items:[{selectionId:uuid(98301+index),optionKey:'main',kind:'COMPONENT',provenance:'EXPLICIT_USER_DECISION',
      label:'Entrée synthétique',quantity:'1',unitBasis:'SHARED',cost:{kind:'MANUAL',unitAmount:index%2?'12.50':'8.00'},fundingAllocations:[],binding:{mode:'NO_RELATED_SLOT'}}]}},
    provenance:'EXPLICIT_USER_DECISION'}));
  const raw={...f.semantic,contexts};
  async function authority(draft=raw,canManageRelations=true){
    const response=await handleComposerRequest(f.deps,householdId,{kind:'READ',sequence:0,targetMonth:'2026-11',draft});
    if(!response.ok)throw Error(`N1_FIXTURE_READ:${response.code}`);
    return {canManageRelations,model:response.model};
  }
  const access=await authority();
  return {...f,base:access.model.semanticState,authority,access,ids,groupId:uuid(98401),otherGroupId:uuid(98402)};
}
