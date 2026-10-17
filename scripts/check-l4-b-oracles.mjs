import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {require} from './lib/phase2-ts-loader.mjs';
import {createKernelPostgres} from './lib/planner-kernel-postgres.mjs';
import {fixture,state,uuid,householdId} from './fixtures/planner-headless.mjs';
const {handleComposerRequest}=require('@/server/phase2/planner/composer-service');
const {createPlanApplyRepository}=require('@/server/phase2/planner/repository');
const {previewPlanScenario}=require('@/server/phase2/planner/apply');
const {fresh,fromSelection,buildComponentRow}=require('@/app/mois-a-venir/composer/night-out-components');
const {semanticStateDigest}=require('@/domain/phase2/planner/semantic-state');
const {validateStayCalendar}=require('@/app/mois-a-venir/composer/short-stay-editor');
globalThis.fetch=async()=>{throw Error('L4B_REMOTE_FORBIDDEN');};
const pg=await createKernelPostgres(),world=fixture(),before=structuredClone(world);
const deps={repository:createPlanApplyRepository(pg.client),readWorld:async()=>world,
  readDirectWorld:async()=>({forecast:world.forecast,monthInputs:world.monthInputs,externalIntents:world.externalIntents,asOfDate:world.asOfDate}),householdPersons:[]};
let sequence=0,identity=60000;
const checks=[];
const request=async(op,draft)=>{const r=await handleComposerRequest(deps,householdId,{sequence:++sequence,targetMonth:'2026-11',draft,...op});assert.equal(r.ok,true,`${r.code}: ${r.message}`);return r.model;};
const create=async(template,preset)=>{const id=uuid(identity++);const m=await request({kind:'DROP',assetKey:'template:'+template,presetKey:preset,target:{kind:'BOARD_ZONE'},values:{},identity:id,selectionId:uuid(identity++)},state());return {id,m};};
const component=(option,label,amount,quantity='1',basis='ITEM',people='')=>buildComponentRow({...fresh(label),id:uuid(identity++),costMode:amount===null?'UNKNOWN':'MANUAL',amount:amount??'',quantity,unitBasis:basis,personCount:people},option);
const patch=(id,slot,items)=>({kind:'MUTATE',mutation:{kind:'PATCH_CONTEXT',contextOccurrenceId:id,slotKey:slot,items}});
const amounts=async m=>(await previewPlanScenario(deps,householdId,m.semanticState)).compiled.components.map(c=>c.evaluation.economicAmount).sort();
const check=async(name,run)=>{await run();checks.push({name,status:'EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY'});console.log(name+' PASS');};
try {
  await check('S1_COCKTAIL_SHARED_UNKNOWN_PRICE_ONLY',async()=>{
    const {id,m}=await create('night-out','bar-apero');
    const cocktails=component('extra','Cocktails','8','2'),bottle=component('extra','Bouteille','25','1','SHARED');
    let x=await request(patch(id,'extras',[cocktails,bottle]),m.semanticState);
    assert.deepEqual(await amounts(x),['16.00','25.00']);
    const changed=buildComponentRow({...fromSelection(cocktails),amount:'9',edited:true},'extra');
    x=await request(patch(id,'extras',[changed,bottle]),x.semanticState);
    assert.deepEqual(await amounts(x),['18.00','25.00']);
    assert.deepEqual(x.semanticState.contexts[0].slotSelections.extras.items[1],bottle);
  });
  await check('A1_SPA_TOTAL_VS_PROVEN_PERSON_QUANTITY',async()=>{
    const {id,m}=await create('activity','spa-relax');
    const total=await request(patch(id,'main',[component('activity','Duo','150','1','SHARED')]),m.semanticState);
    assert.deepEqual(await amounts(total),['150.00']);
    const persons=await request(patch(id,'main',[component('activity','Billets','20','1','PERSON','2')]),total.semanticState);
    assert.deepEqual(await amounts(persons),['40.00']);
    assert.equal(persons.semanticState.contexts[0].slotSelections.main.items[0].pricedParticipantCount,2);
  });
  await check('A2_PARKING_WITH_UNKNOWN_MAIN',async()=>{
    const {id,m}=await create('activity','hiking-nature');
    const x=await request(patch(id,'main',[component('activity','Sortie',null)]),m.semanticState);
    const y=await request(patch(id,'extras',[component('extra','Parking','4')]),x.semanticState);
    const prices=await amounts(y);assert.ok(prices.includes(null));assert.ok(prices.includes('4.00'));
  });
  for(const [template,preset,name] of [['restaurant','restaurant-for-two','R1'],['delivery','uber-eats-order','R3']])
    await check(name+'_TOTAL_REPLACED_BY_DETAIL',async()=>{
      const {id,m}=await create(template,preset),total=template==='restaurant'?'60':'35',first=template==='restaurant'?'45':'30',extra=template==='restaurant'?'15':'5';
      const row=component(template,'Total',total,'1','SHARED');
      let x=await request(patch(id,'meal',[row]),m.semanticState);
      assert.deepEqual(await amounts(x),[total+'.00']);
      const op={kind:template==='restaurant'?'EDIT_RESTAURANT':'EDIT_PRESET_CONTEXT',edit:{contextOccurrenceId:id,slots:{meal:[buildComponentRow({...fromSelection(row),amount:first,edited:true},template)],extras:[component('extra','Hors premier poste',extra)]}}};
      x=await request(op,x.semanticState);assert.deepEqual(await amounts(x),[first+'.00',extra+'.00'].sort());
      assert.equal(x.semanticState.contexts[0].slotSelections.meal.items[0].selectionId,row.selectionId);
    });
  await check('R2_SNACK_15_NO_INVENTED_CHANNEL',async()=>{
    const {id,m}=await create('fast-food','chicken-snack');
    const x=await request(patch(id,'meal',[component('fast-food','Snack','15')]),m.semanticState);
    assert.deepEqual(await amounts(x),['15.00']);
    for(const key of ['channel','plannedDate','placeRef']) assert.equal(x.semanticState.contexts[0].fields[key],undefined);
  });
  await check('W1_TOTAL_PER_NIGHT_AND_DATE_CONFLICT',async()=>{
    const {id,m}=await create('short-stay','weekend-gite');
    const total={...component('lodging','Gîte','240'),lodgingPricing:{version:'lodging-pricing@v1',basis:'TOTAL',nightCount:2}};
    let x=await request({kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:id,fields:{nightCount:2},slots:{lodging:[total]}}},m.semanticState);
    assert.deepEqual(await amounts(x),['240.00']);
    const nightly={...total,quantity:'2',cost:{kind:'MANUAL',unitAmount:'90'},lodgingPricing:{version:'lodging-pricing@v1',basis:'PER_NIGHT',nightCount:2}};
    x=await request({kind:'EDIT_SHORT_STAY',edit:{contextOccurrenceId:id,fields:{},slots:{lodging:[nightly]}}},x.semanticState);
    assert.deepEqual(await amounts(x),['180.00']);
    assert.throws(()=>validateStayCalendar({...x.semanticState.contexts[0].fields,plannedDate:'2026-11-01',endDate:'2026-11-04'}),/dates indiquent 3 nuit/);
    validateStayCalendar({...x.semanticState.contexts[0].fields,plannedDate:'2026-11-01',endDate:'2026-11-03'});
    assert.deepEqual(await amounts(x),['180.00']);
  });
  await check('P2_MIXED_SELLER_TOTAL_NO_INVENTED_CLASSIFICATION',async()=>{
    const {id,m}=await create('purchase','amazon-purchase');
    const x=await request(patch(id,'item',[component('item','Commande mixte','70','1','SHARED')]),m.semanticState);
    assert.deepEqual(await amounts(x),['70.00']);assert.equal(x.semanticState.contexts[0].fields.budgetDomain,undefined);
    assert.equal(x.semanticState.contexts[0].fields.merchantLabel,'Amazon');
  });
  await check('P1_ENVELOPE_100_COVERED_PURCHASE_40_NOT_140',async()=>{
    const {id,m}=await create('purchase','clothing-shopping');
    const control=m.board.discretionaryControls.find(card=>card.targetRef.includes('clothing'));
    assert.ok(control);
    const envelope=await request({kind:'MUTATE',mutation:{kind:'SET_STATE',targetRef:control.targetRef,value:{amount:'100'}}},m.semanticState);
    const item={...component('item','Vêtement choisi','40'),binding:{mode:'CONFIRMED_CONSUMPTION'}};
    const x=await request(patch(id,'item',[item]),envelope.semanticState);
    const p=await previewPlanScenario(deps,householdId,x.semanticState);
    assert.equal(p.compiled.components[0].binding.relation,'CONSUMES_SLOT');
    const effect=p.compiled.contextualEffects.find(effect=>effect.componentId===p.compiled.components[0].componentId);
    assert.equal(effect.incrementalAmount,'0.00');assert.equal(effect.displacedAmount,'40.00');
    assert.equal(p.compiled.planSlots.find(slot=>slot.baseline.simpleAuthority?.domain==='clothing').remainingAmount,'60.00');
  });
  await check('P3_GIFT_PARTIAL_RECIPIENT_PRESERVES_20_PLUS_5',async()=>{
    const {id,m}=await create('gift','gift-present'),item=component('gift','Livre','20');
    let x=await request({kind:'EDIT_GIFT',contextOccurrenceId:id,values:{objectLabel:'Livre',occasion:'Anniversaire'},item},m.semanticState);
    x=await request(patch(id,'extras',[component('extra','Emballage','5')]),x.semanticState);
    const original=x.semanticState.contexts[0].slotSelections;
    x=await request({kind:'EDIT_CONTEXT',contextOccurrenceId:id,values:{recipientRef:{kind:'TEXT',label:'Proche synthétique'}}},x.semanticState);
    assert.deepEqual(x.semanticState.contexts[0].slotSelections,original);assert.deepEqual(await amounts(x),['20.00','5.00']);
    assert.equal(x.semanticState.contexts[0].fields.occasion,'Anniversaire');
  });
  await check('B1_MANUAL_PRODUCT_PRICE_NO_INVENTED_RENEWAL',async()=>{
    const {id,m}=await create('beauty-restock','mascara');
    const x=await request(patch(id,'products',[component('product','Mascara choisi','16')]),m.semanticState);
    assert.deepEqual(await amounts(x),['16.00']);assert.equal(x.semanticState.contexts[0].slotSelections.products.items[0].needOccurrenceId,undefined);
  });
  await check('M1_TWO_PACKS_PRICE_ONLY_STABLE_IDENTITIES',async()=>{
    const {id,m}=await create('purchase','laundry-detergent'),item=component('item','Lessive · paquet','6','2');
    const x=await request(patch(id,'item',[item]),m.semanticState);assert.deepEqual(await amounts(x),['12.00']);
    const y=await request(patch(id,'item',[buildComponentRow({...fromSelection(item),amount:'7',edited:true},'item')]),x.semanticState);
    assert.deepEqual(await amounts(y),['14.00']);assert.deepEqual(y.semanticState.contexts[0].fields,x.semanticState.contexts[0].fields);
    assert.notEqual(semanticStateDigest(y.semanticState),semanticStateDigest(x.semanticState));
  });
  assert.deepEqual(world,before);await pg.verifyCanaries();
  writeFileSync('docs/status/evidence/l4-b-all-assets/economic-oracles.json',JSON.stringify({environment:'PGLITE_SYNTHETIC_ONLY',checks,remoteWrites:0,authenticated:'NOT_RUN_AUTH'},null,2)+'\n');
} finally {await pg.close();}
