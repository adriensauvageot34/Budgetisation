import {barP3Month} from './bar-apero-p3.mjs';
import {uuid} from './planner-headless.mjs';
import {require} from '../lib/phase2-ts-loader.mjs';
const {parsePlanSemanticState}=require('@/domain/phase2/planner/semantic-state');
const {presetCreationFields}=require('@/domain/phase2/planner/composer-presets');
const {PLANNED_ASSET_CATALOG_VERSION}=require('@/domain/phase2/planned-assets');
/** Deterministic geometry setup only: every identity and price is synthetic.
 * Uses the production parser/compiler, never a production database or provider. */
export function bar350ReceptionMonth(count=15){
 const {world,semantic}=barP3Month();
 const item=(n,label,assetKey,basis='ITEM',amount='8',optionKey='extra')=>({kind:'COMPONENT',selectionId:uuid(n),optionKey,
  provenance:'EXPLICIT_USER_DECISION',label,quantity:'1',unitBasis:basis,cost:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},
  productAssetRef:{catalogVersion:PLANNED_ASSET_CATALOG_VERSION,assetKey,labelAtSelection:label,provenance:'EXPLICIT_USER_DECISION'},fundingAllocations:[]});
 const home={kind:'KNOWN',placeId:uuid(9100)},venue={kind:'KNOWN',placeId:uuid(99202)};
 const leg=(n,mode,origin,destination,amount)=>({kind:'MOBILITY_INTENT',selectionId:uuid(n),optionKey:mode,provenance:'EXPLICIT_USER_DECISION',origin,destination,returnRequired:false,
  pricing:{fare:amount===null?{kind:'UNKNOWN'}:{kind:'MANUAL',unitAmount:amount},parking:{kind:'UNKNOWN'},fundingAllocations:[],preference:'FASTEST'}});
 const outbound={...leg(99530,'car',home,venue,null),route:{version:'composer-mobility-route@v1',vehicleRef:{vehicleId:uuid(9150),labelAtSelection:'Peugeot 207',provenance:'EXPLICIT_USER_DECISION'},stops:[]}};
 const before=count===15;
 semantic.contexts=[{contextOccurrenceId:uuid(99500),templateKey:'night-out',parentContextOccurrenceId:null,status:'ACTIVE',provenance:'EXPLICIT_USER_DECISION',
  fields:{...presetCreationFields('night-out','bar-apero'),fieldSchemaVersion:'context-fields@v2',plannedDate:'2026-11-14',placeRef:venue,participantRefs:[{kind:'HOUSEHOLD_PERSON',personId:uuid(1)},...['Amandine','Cédric','Lucas','Florentine','Juliette'].map(label=>({kind:'TEXT',label}))]},
  slotSelections:{extras:{items:Array.from({length:count},(_,i)=>item(99600+i,i<2?'Bière':`Consommation ${i+1}`,i<2?'bar:beer':'bar:soft','ITEM',i===count-1?null:String(8+i)))},
   ...(count?{outbound:{items:[outbound]},return:{items:[leg(99531,'taxi',venue,home,'12')]}}:{}),
   ...(before?{before:{items:[{kind:'CHILD_CONTEXT',selectionId:uuid(99502),optionKey:'activity',provenance:'EXPLICIT_USER_DECISION',childContextOccurrenceId:uuid(99501)}]}}:{})}},
  ...(before?[{contextOccurrenceId:uuid(99501),templateKey:'activity',parentContextOccurrenceId:uuid(99500),status:'ACTIVE',provenance:'EXPLICIT_USER_DECISION',fields:{label:'Before',plannedDate:null},
   slotSelections:{main:{items:[item(99700,'Vodka','house_party:vodka','SHARED','20','activity')]},extras:{items:Array.from({length:8},(_,i)=>item(99701+i,i===0?'Diluant sans alcool':`Snack ${i}`,i===0?'house_party:mixer':'house_party:snack',i===0?'ITEM':'SHARED',i===7?null:'4'))}}}]:[])];
 return {world,semantic:parsePlanSemanticState(semantic)};
}
