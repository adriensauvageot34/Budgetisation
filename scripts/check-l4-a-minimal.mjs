import assert from 'node:assert/strict';
import {require} from './lib/phase2-ts-loader.mjs';
import {state,uuid} from './fixtures/planner-headless.mjs';
const {editNightOut}=require('@/domain/phase2/planner/night-out-edit');
const {parsePlanSemanticState,semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {fresh,fromSelection,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-editor');
const id=uuid(49001), selectionId=uuid(49002);
const seed=state([], [{contextOccurrenceId:id,templateKey:'night-out',parentContextOccurrenceId:null,status:'ACTIVE',provenance:'EXPLICIT_USER_DECISION',
  fields:{fieldSchemaVersion:'context-fields@v3',label:'Soirée techno',composerPresentation:{version:'composer-context-presentation@v1',presetKey:'techno-night'}},slotSelections:{}}]);
// This is serialization/recovery of the actual semantic contract, not authenticated HTTP persistence.
const component=buildComponentRow({...fresh('Entrées et événement'),id:selectionId,unitBasis:'SHARED',costMode:'MANUAL',amount:'30'},'main');
const saved=editNightOut(seed,{contextOccurrenceId:id,fields:{},slots:{main:[component]}});
const reload=parsePlanSemanticState(JSON.parse(JSON.stringify(saved)));
assert.equal(semanticStateDigest(saved),semanticStateDigest(reload));
const before=reload.contexts[0].slotSelections.main.items[0];
assert.equal(before.cost.unitAmount,'30');
const changed=editNightOut(reload,{contextOccurrenceId:id,fields:{},slots:{main:[buildComponentRow({...fromSelection(before),edited:true,amount:'35'},'main')]}});
assert.equal(changed.contexts.length,1); assert.equal(changed.contexts[0].contextOccurrenceId,id);
assert.equal(changed.contexts[0].slotSelections.main.items[0].selectionId,selectionId);
assert.equal(changed.contexts[0].slotSelections.main.items[0].cost.unitAmount,'35');
assert.deepEqual(changed.contexts[0].fields,seed.contexts[0].fields);
console.log('L4-A tranche A: 30 → serialization/reload → 35, same occurrence/selection/provenance PASS_CONTRACT_FIXTURE');
