import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

// Uses the existing C8 localhost host and its synthetic durable Draft transport.
// Never supply a remote application URL: no Auth, household or bank data here.
const origin=new URL(process.env.COMPOSER_UX_ORIGIN??'http://127.0.0.1:3147');
assert(['127.0.0.1','localhost'].includes(origin.hostname),'LOCAL_FIXTURE_ONLY');
const require=createRequire(process.env.PLANNER_PLAYWRIGHT_TOOLS
 ? path.resolve(process.env.PLANNER_PLAYWRIGHT_TOOLS,'package.json'):import.meta.url);
const {chromium}=require('playwright-core');
const output=process.env.COMPOSER_UX_OUTPUT??'outputs/p21-journey-evidence';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
const results=[],runId=Date.now();
const widths=(process.env.COMPOSER_UX_WIDTHS??'1280,390,360').split(',').map(Number);
assert(widths.length&&widths.every(width=>[1280,390,360].includes(width)),'SUPPORTED_FIXTURE_VIEWPORTS_ONLY');
let page,step='initial';
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:typeof name==='string'});
const ready=()=>page.waitForFunction(()=>['FRESH','BLOCKED','FAILED'].includes(document.querySelector('[data-composer]')?.getAttribute('data-preview-state')),null,{timeout:120000});
const digest=()=>page.locator('[data-composer]').getAttribute('data-digest');
const panel=()=>page.locator('[data-restaurant-editor],dialog[open]').filter({has:page.locator('[data-workshop-navigation]')});
const saved=()=>page.locator('[data-draft-status][data-state="SAVED"]').waitFor({timeout:30000});
const back=async()=>{await button('← Mes intentions').click();await page.locator('[data-workshop-navigation]').waitFor({state:'hidden'});};
const choose=async id=>{await page.getByRole('combobox',{name:'Retrouver une intention du mois',exact:true}).selectOption(id);await page.locator('[data-workshop-navigation]').waitFor();};
const snapshot=async scenario=>(await page.request.get(new URL('/draft?scenario='+scenario,origin).href)).json();
const add=async(query,preset)=>{
 await page.getByRole('textbox',{name:'Rechercher une intention',exact:true}).fill(query);
 await page.locator('[data-library] [data-preset="'+preset+'"]').click();
 await page.locator('[data-workshop-navigation]').waitFor();await ready();await saved();
 const id=await page.getByRole('combobox',{name:'Changer d’intention',exact:true}).inputValue();
 assert(id);return id;
};
const rowPrice=()=>page.locator('[data-workshop-component] input[inputmode="decimal"]').first();
const saveRow=async()=>{await button('Conserver ce poste',panel()).click();await ready();await saved();};
const cost=async(expected)=>{
 const region=page.getByRole('region',{name:'Impact sur le budget',exact:true});
 if(!await region.isVisible() && await button('← Retour au résumé',panel()).isVisible())await button('← Retour au résumé',panel()).click();
 if(!await region.isVisible() && await button('Retour au résumé',page.locator('dialog[open]')).isVisible())await button('Retour au résumé',page.locator('dialog[open]')).click();
 await region.waitFor();
 const amounts=await region.locator('dd').allTextContents();
 assert(amounts[0]?.includes(expected),'Expected '+expected+' got '+amounts);return amounts;
};
const inspect=async(key,width)=>{
 const before=await digest(), region=page.getByRole('region',{name:'Impact sur le budget',exact:true});
 await region.scrollIntoViewIfNeeded();
 const layout=await region.evaluate(element=>{
  const p=element.closest('[role="dialog"],dialog'),r=p.getBoundingClientRect();
  const dock=[...document.querySelectorAll('[data-question-dock]')].find(node=>node.getBoundingClientRect().height>0),d=dock?.getBoundingClientRect();
  return {documentWidth:document.documentElement.scrollWidth,panelOverflow:p.scrollWidth-p.clientWidth,
   gap:d?d.top-r.bottom:null,selects:[...p.querySelectorAll('select')].every(node=>node.getBoundingClientRect().right<=r.right+1)};
 });
 assert.equal(layout.documentWidth,width,key+' page horizontal overflow');assert(layout.panelOverflow<=1,key+' panel overflow');
 assert(layout.selects,key+' selector clipped');assert(layout.gap!==null&&layout.gap>=-1,key+' dock overlap '+layout.gap);
 await page.screenshot({path:path.join(output,key+'-'+width+'.png')});
 assert.equal(await digest(),before,key+' read must not mutate');
 return layout;
};
try{
 for(const [width,height] of [[1280,720],[390,844],[360,800]]){
  if(!widths.includes(width))continue;
  const context=await browser.newContext({viewport:{width,height}});page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST')requests.push({path:new URL(request.url()).pathname,body:request.postDataJSON()});});
  const scenario='L1_UX_'+runId+'_'+width;
  await page.goto(new URL('/?scenario='+scenario+'&durable=1&draftDelay=800',origin).href,{timeout:180000});
  await page.locator('[data-composer]').waitFor({timeout:180000});
  const initial=await snapshot(scenario);assert.equal(initial.active,null);assert.equal(initial.archives.length,0);
  const ids={};

  step='Cinema '+width;
  ids.cinema=await add('cinema','cinema');
  await button(/^Billet de cinéma/,panel()).click();
  const untouched=await digest();await rowPrice().fill('12,');
  await page.locator('[data-save-raw]').waitFor();assert.equal(await digest(),untouched);
  const rawBounds=await page.locator('[data-save-raw]').boundingBox(),headerBounds=await page.locator('[data-composer] > header').boundingBox();
  assert(rawBounds.y>=headerBounds.y&&rawBounds.y+rawBounds.height<=headerBounds.y+headerBounds.height,'RAW status must stay in the save header');
  await button('← Mes intentions').click();await button('Continuer à modifier').click();assert.equal(await rowPrice().inputValue(),'12,');
  await button('Conserver ce poste',panel()).click();assert.match(await panel().getByRole('alert').innerText(),/deux décimales/);
  assert.equal(await rowPrice().inputValue(),'12,');assert.equal(await digest(),untouched);
  await rowPrice().fill('12');await saveRow();
  await button(/^Popcorn — Préparer un supplément/).click();
  const notAdopted=await digest();await button('Supplément réel').click();assert.equal(await digest(),notAdopted);
  await rowPrice().fill('4');await saveRow();await cost('16,00');
  const cinemaState=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.cinema);
  const ticketId=cinemaState.slotSelections.main.items[0].selectionId;
  await button(/^Modifier · Billet/).click();await rowPrice().fill('13');await saveRow();await cost('17,00');
  await back();await page.locator('[data-history-action="undo"]').click();await ready();await saved();
  await choose(ids.cinema);await cost('16,00');
  const cinemaAfter=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.cinema);
  assert.equal(cinemaAfter.slotSelections.main.items.length,1);assert.equal(cinemaAfter.slotSelections.main.items[0].selectionId,ticketId);
  results.push({key:'cinema',width,status:'PASS',layout:await inspect('cinema',width),raw:true,undo:true,ticketId});await back();

  step='Restaurant '+width;
  ids.restaurant=await add('restaurant','restaurant-for-two');
  await button(/^Préciser l’addition/).click();await page.getByLabel('Coût prévu à notre charge (€)',{exact:true}).fill('40');
  await button('Conserver ce coût').click();await ready();await saved();await cost('40,00');
  await button(/^Renseigner une bière comprise/).click();await page.getByLabel('Montant de la ligne compris (€)',{exact:true}).fill('6');
  await button('Conserver ce détail inclus').click();await ready();await saved();await cost('40,00');
  await button(/^Préparer un supplément distinct/).click();
  if(await button('Supplément réel').isVisible())await button('Supplément réel').click();
  await rowPrice().fill('6');await saveRow();await cost('46,00');
  const restaurantBefore=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.restaurant);
  await button(/^Modifier la bière comprise/).click();
  await page.getByLabel('Montant de la ligne compris (€)',{exact:true}).fill('5');await button('Conserver ce détail inclus').click();await ready();await saved();await cost('46,00');
  const restaurantAfter=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.restaurant);
  assert.deepEqual(restaurantAfter.slotSelections,restaurantBefore.slotSelections);
  assert.equal(restaurantAfter.fields.restaurantIncludedDetails.items.length,1);
  assert.equal(restaurantAfter.fields.restaurantIncludedDetails.items[0].detailId,restaurantBefore.fields.restaurantIncludedDetails.items[0].detailId);
  results.push({key:'restaurant',width,status:'PASS',layout:await inspect('restaurant',width),includedNotAdded:true});await back();

  step='Weekend '+width;
  ids.weekend=await add('weekend','weekend-gite');
  await button(/^Préciser l’hébergement/).click();
  await button('Prix par nuit').click();
  await rowPrice().fill('100');await page.getByLabel('Nombre de nuits (facultatif)',{exact:true}).fill('2');
  await button('Conserver et prévisualiser',panel()).click();await ready();await saved();await cost('200,00');
  const perNight=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.weekend);
  await button(/^Modifier l’hébergement/).click();
  await button('Hébergement et autres postes').click();await button(/^Prix total/).click();await rowPrice().fill('200');
  await button('Conserver et prévisualiser',panel()).click();await ready();await saved();await cost('200,00');
  await button(/^Modifier l’hébergement/).click();
  await button('Hébergement et autres postes').click();await button('Type d’hébergement').click();await button('Hôtel').click();
  await button('Conserver et prévisualiser',panel()).click();await ready();await saved();
  const weekendBefore=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.weekend);
  assert.equal(weekendBefore.slotSelections.lodging.items[0].selectionId,perNight.slotSelections.lodging.items[0].selectionId);
  assert.equal(weekendBefore.fields.nightCount,2);
  await button(/^Examiner · Petit-déjeuner/).click();assert.equal(await digest(),(await snapshot(scenario)).active.digest);
  await button('← Mes intentions').click();await choose(ids.weekend);
  await button(/^Examiner · Taxe/).click();await button(/^Préparer un supplément distinct · Taxe/).click();
  await rowPrice().fill('8');await button('Conserver et prévisualiser',panel()).click();await ready();await saved();await cost('208,00');
  const weekendAfter=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.weekend);
  assert.deepEqual(weekendAfter.slotSelections.lodging,weekendBefore.slotSelections.lodging);
  results.push({key:'weekend',width,status:'PASS',layout:await inspect('weekend',width),nightCount:weekendAfter.fields.nightCount});await back();

  async function line(label,quantity,price){
   await button('Saisir un article').click();await page.getByLabel('Nom de l’article',{exact:true}).fill(label);
   await page.getByLabel('Quantité',{exact:true}).fill(quantity);await page.getByRole('textbox',{name:'Prix par unité (€)',exact:true}).fill(price);
   await button('Conserver l’article').click();await ready();await saved();
  }
  step='Amazon '+width;
  ids.amazon=await add('amazon','amazon-purchase');
  if(await button('Passer au panier multi-articles').isVisible())await button('Passer au panier multi-articles').click();
  await line('Shampoing','2','9');await line('Shampoing','1','5');await line('Livre','1','25');
  await button('Livraison et frais',panel()).click();await page.getByRole('combobox',{name:'Modalité',exact:true}).selectOption('DELIVERY');
  await page.getByRole('combobox',{name:'Frais de livraison',exact:true}).selectOption('ADDITIONAL');await page.getByLabel('Frais distincts (€)',{exact:true}).fill('5');
  await button('Conserver la livraison').click();await ready();await saved();await cost('53,00');
  const amazonBefore=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.amazon);
  const lines=page.locator('[data-basket-line]');const lineId=await lines.first().getAttribute('data-basket-line');
  await button(/^Modifier/,lines.first()).click();await page.getByRole('textbox',{name:'Prix par unité (€)',exact:true}).fill('10');await button('Conserver l’article').click();await ready();await saved();await cost('55,00');
  const amazonAfter=(await snapshot(scenario)).active.semanticState.contexts.find(row=>row.contextOccurrenceId===ids.amazon);
  assert.equal(amazonAfter.slotSelections.item.items.length,3);assert.equal(amazonAfter.slotSelections.item.items[0].selectionId,lineId);
  assert.deepEqual(amazonAfter.slotSelections.item.items.slice(1),amazonBefore.slotSelections.item.items.slice(1));
  const localOnly=await digest();await page.getByText('Gérer les suggestions',{exact:true}).click();
  const dismiss=button(/^Masquer ·/).first();await dismiss.click();assert.equal(await digest(),localOnly);
  await button('Réafficher les suggestions masquées').click();assert.equal(await digest(),localOnly);
  results.push({key:'amazon',width,status:'PASS',layout:await inspect('amazon',width),sameLineId:true,otherLinesUnchanged:true,maskNeutral:true});await back();

  step='Clothing '+width;
  ids.clothing=await add('vetements','clothing-shopping');
  if(await button('Passer au panier multi-articles').isVisible())await button('Passer au panier multi-articles').click();
  await line('Pantalon','1','20');await line('Pull à chiffrer','1','');await cost('Total à préciser');
  const clothingDigest=await digest();
  await button(/^Modifier/,page.locator('[data-basket-line]').last()).click();
  const unknownPrice=page.getByRole('textbox',{name:'Prix par unité (€)',exact:true});assert.equal(await unknownPrice.inputValue(),'');
  await unknownPrice.fill('12,');await button('Retour au panier').click();await button('Continuer à modifier').click();
  assert.equal(await unknownPrice.inputValue(),'12,');assert.equal(await digest(),clothingDigest);
  await button('Retour au panier').click();await button('Abandonner cette saisie').click();assert.equal(await digest(),clothingDigest);
  results.push({key:'clothing',width,status:'PASS',layout:await inspect('clothing',width),unknownNotZero:true});await back();

  step='Mascara '+width;
  ids.mascara=await add('mascara','mascara');
  await button(/^Préciser le produit/).click();await rowPrice().fill('12,50');await saveRow();await cost('12,50');
  await button(/^Modifier prix et quantité/).click();await page.getByLabel('Quantité totale',{exact:true}).fill('2');await saveRow();await cost('25,00');
  results.push({key:'mascara',width,status:'PASS',layout:await inspect('mascara',width),quantity:2});await back();

  step='Courses '+width;
  ids.groceries=await add('courses','groceries-purchase');await line('Panier fictif','1','8');
  await button('Vendeur, date et budget',panel()).click();await page.getByRole('combobox',{name:'Enveloppe Courses',exact:true}).selectOption('CONFIRMED_CONSUMPTION');
  await button('Conserver les détails').click();await ready();await saved();await cost('8,00');
  const groceryLine=page.locator('[data-basket-line]'),groceryId=await groceryLine.getAttribute('data-basket-line');
  await button(/^Modifier/,groceryLine).click();await page.getByRole('textbox',{name:'Prix par unité (€)',exact:true}).fill('9');
  await button('Conserver l’article').click();await ready();await saved();await cost('9,00');
  await back();await page.locator('[data-history-action="undo"]').click();await ready();await saved();await choose(ids.groceries);await cost('8,00');
  assert.equal(await page.locator('[data-basket-line]').count(),1);assert.equal(await page.locator('[data-basket-line]').getAttribute('data-basket-line'),groceryId);
  results.push({key:'courses',width,status:'PASS',layout:await inspect('courses',width)});await back();

  step='Mixed navigation and reload '+width;
  await choose(ids.amazon);await button(/^Modifier/,page.locator('[data-basket-line]').first()).click();
  const unaccepted=page.getByRole('textbox',{name:'Prix par unité (€)',exact:true});await unaccepted.fill('12,');const guardedDigest=await digest();
  await page.getByRole('combobox',{name:'Changer d’intention',exact:true}).selectOption(ids.restaurant);
  await button('Continuer à modifier').click();assert.equal(await unaccepted.inputValue(),'12,');assert.equal(await digest(),guardedDigest);
  assert.equal(await page.getByRole('combobox',{name:'Changer d’intention',exact:true}).inputValue(),ids.amazon);
  await page.getByRole('combobox',{name:'Changer d’intention',exact:true}).selectOption(ids.restaurant);
  await button('Abandonner cette saisie').click();await page.getByRole('heading',{name:'Restaurant à deux',exact:true,level:2}).waitFor();
  assert.equal(await digest(),guardedDigest);await back();
  const mixedDigest=await digest(),secondCinema=await add('cinema','cinema');assert.notEqual(secondCinema,ids.cinema);
  const names=await page.getByRole('combobox',{name:'Changer d’intention',exact:true}).locator('option').allTextContents();
  assert(names.some(name=>name.startsWith('Cinéma · 1 ·')));assert(names.some(name=>name.startsWith('Cinéma · 2 ·')));
  await back();
  await page.getByRole('textbox',{name:'Rechercher une intention',exact:true}).fill('');
  await page.getByRole('button',{name:/^Activités & loisirs/}).click();
  assert.match(await page.locator('[data-library] [data-preset="cinema"]').innerText(),/Ajouter un autre Cinéma/);
  await page.locator('[data-history-action="undo"]').click();await ready();await saved();assert.equal(await digest(),mixedDigest);
  await page.locator('[data-history-action="redo"]').click();await ready();await saved();
  assert((await snapshot(scenario)).active.semanticState.contexts.some(row=>row.contextOccurrenceId===secondCinema));
  await page.locator('[data-history-action="undo"]').click();await ready();await saved();assert.equal(await digest(),mixedDigest);
  const beforeReload=await snapshot(scenario),finalDigest=await digest();
  assert.equal(beforeReload.active.semanticState.contexts.length,7);
  for(const id of [ids.restaurant,ids.cinema,ids.weekend,ids.amazon]){await choose(id);assert.equal(await digest(),finalDigest);await back();}
  await page.reload();await page.locator('[data-composer]').waitFor();await ready();await saved();assert.equal(await digest(),finalDigest);
  const afterReload=await snapshot(scenario);assert.deepEqual(afterReload.active,beforeReload.active);assert.deepEqual(afterReload.archives,beforeReload.archives);
  const evidence=await(await page.request.get(new URL('/evidence?scenario='+scenario,origin).href)).json();
  assert.equal(evidence.active,null);assert.equal(evidence.counts.plans,0);assert.equal(evidence.counts.revisions,0);
  assert.equal(evidence.remoteWrites,0);assert.equal(evidence.historicalCanaryWrites,0);
  assert(!requests.some(row=>row.body?.kind==='APPLY'||row.body?.kind==='ARCHIVE'));
  assert.deepEqual(errors,[]);results.push({key:'mixed-save-reload',width,status:'PASS',digest:finalDigest,version:afterReload.active.version,noPlan:true,errors});
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({width,status:'PASS',scenarios:7,durableReload:true}));await context.close();
 }
 step='Save failure and retry';
 const context=await browser.newContext({viewport:{width:1280,height:720}});page=await context.newPage();page.setDefaultTimeout(20000);
 const scenario='L1_UX_ERROR_'+runId;
 await page.goto(new URL('/?scenario='+scenario+'&durable=1&draftFailOnce=1&draftDelay=1200',origin).href,{timeout:180000});
 await page.locator('[data-composer]').waitFor({timeout:180000});
 await page.getByRole('textbox',{name:'Rechercher une intention',exact:true}).fill('cinema');
 await page.locator('[data-library] [data-preset="cinema"]').click();
 await page.locator('[data-draft-status][data-state="ERROR"]').waitFor({timeout:30000});
 assert.equal((await snapshot(scenario)).active,null);const pending=await digest();
 await back();await page.locator('[data-save-retry]').click();
 await page.locator('[data-draft-status][data-state="SAVING"]').waitFor();assert.doesNotMatch(await page.locator('[data-draft-status]').innerText(),/Sauvegardé/);
 await saved();assert.equal(await digest(),pending);assert.equal((await snapshot(scenario)).active.version,1);
 const evidence=await(await page.request.get(new URL('/evidence?scenario='+scenario,origin).href)).json();
 assert.equal(evidence.active,null);assert.equal(evidence.remoteWrites,0);
 results.push({key:'save-error-retry',status:'PASS',version:1,digest:pending,noPlan:true});
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));await context.close();
 console.log(JSON.stringify({status:'PASS',scenarios:7*widths.length,widths,durableReloads:widths.length,saveErrorRetry:true,remoteWrites:0,apply:false}));
}catch(error){
 console.error('FAILED '+step+' '+error.message);
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
 if(page){await fs.writeFile(path.join(output,'failure.txt'),await page.locator('body').ariaSnapshot());await page.screenshot({path:path.join(output,'failure.png')});}
 throw error;
}finally{await browser.close();}
