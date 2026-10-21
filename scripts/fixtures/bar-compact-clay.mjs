import {bar350ReceptionMonth} from './bar-apero-350-reception.mjs';
import {uuid} from './planner-headless.mjs';
import {p4Extra} from './planner-p14-p4a.mjs';
import {require} from '../lib/phase2-ts-loader.mjs';
const {parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
const {PLANNED_ASSET_CATALOG_VERSION}=require('@/domain/phase2/planned-assets');

/** Deterministic, synthetic UI receipt. No provider or remote writer. */
export function barCompactMonth(scene='empty'){
  const variant=scene;if(['people1','people3','many'].includes(scene))scene='mixed';
  const value=bar350ReceptionMonth(15),parent=value.semantic.contexts[0],child=value.semantic.contexts[1],routes={outbound:parent.slotSelections.outbound,return:parent.slotSelections.return};
  const item=(n,label,asset,amount=null)=>({selectionId:uuid(n),kind:'COMPONENT',optionKey:'extra',label,quantity:'1',unitBasis:'ITEM',provenance:'EXPLICIT_USER_DECISION',cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},fundingAllocations:[],productAssetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey:asset,labelAtSelection:label,provenance:'EXPLICIT_USER_DECISION'}});
  parent.fields={...parent.fields,placeRef:{kind:'TEXT',label:'Espit Chupitos'},plannedDate:'2026-11-14',participantRefs:[{kind:'TEXT',label:'Camille Martin'},{kind:'TEXT',label:'Alex Dupont'}]};
  parent.slotSelections={};
  child.slotSelections={main:{items:[{...item(99801,'Vodka','house_party:vodka','20'),optionKey:'activity',unitBasis:'SHARED'}]},extras:{items:[item(99802,'Crazy Tiger sans alcool','house_party:crazy_tiger'),item(99803,'Diluant sans alcool','house_party:mixer'),item(99804,'Chips','house_party:chips','4'),item(99805,'Bière','house_party:beer','5')]}};
  if(['before','mixed','long','dense','tall'].includes(scene))parent.slotSelections.before={items:[{kind:'CHILD_CONTEXT',selectionId:uuid(99502),optionKey:'activity',provenance:'EXPLICIT_USER_DECISION',childContextOccurrenceId:child.contextOccurrenceId}]};
  if(['mixed','long','dense','tall'].includes(scene))parent.slotSelections.extras={items:[item(99806,'Planche de tapas','bar:tapas','15')]};
  if(scene==='tall')Object.assign(parent.slotSelections,routes);
  if(variant==='people1')parent.fields.participantRefs=parent.fields.participantRefs.slice(0,1);
  if(variant==='people3')parent.fields.participantRefs.push({kind:'TEXT',label:'Robin Test'});
  if(variant==='many')parent.slotSelections.extras.items.push(item(99807,'Cocktail','bar:cocktail'),item(99808,'Bière','bar:beer','6'),item(99809,'Soft','bar:soft'));
  if(scene==='long'){
    parent.fields.placeRef={kind:'TEXT',label:'Espit Chupitos — très long nom de lieu pour une sortie entre amis à Montpellier'};
    parent.fields.participantRefs=Array.from({length:7},(_,i)=>({kind:'TEXT',label:`Participant ${i+1}`}));
    child.slotSelections.main.items[0].quantity='99';child.slotSelections.main.items[0].cost={kind:'MANUAL',unitAmount:'12345.67'};
  }
  if(scene==='empty'){parent.fields.placeRef=null;parent.fields.plannedDate=null;parent.fields.participantRefs=[];}
  value.semantic.contexts=[parent,...(parent.slotSelections.before?[child]:[]),...(['dense','tall'].includes(scene)?Array.from({length:30},(_,i)=>p4Extra(i+1)):[])];
  value.semantic=parsePlanSemanticState(value.semantic);return value;
}
