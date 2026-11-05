import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fs, path, here, require, Module, fixture, bareFixture, d1Fixture, noneOperation, editNightOut,
  parentId, parent, child, householdId, handleComposerRequest, makeDeps, saveComposerDraft,
  semanticStateDigest, BeforeDraftHistory } from './runtime.mjs';
import { createDatabase } from './database.mjs';
import { Frames } from './frames.mjs';

const { beforeN2Enabled } = require('@/server/phase2/planner/before-n2-cutover');
const { applyPlanScenario, previewPlanScenario } = require('@/server/phase2/planner/apply');
const { barBeforePatch, barBeforeRemove } = require('@/app/mois-a-venir/composer/bar-before');
const base = bareFixture();
const descriptive = noneOperation(base, { label: 'Avant · fixture' });
const marked = editNightOut(base, descriptive.edit);
const world = fixture();
const deps = makeDeps(world);
const request = (operation, draft=base) => ({ ...operation, targetMonth: base.targetMonth, sequence: 1, draft });
const interact = (operation, draft) => handleComposerRequest(deps, householdId, request(operation,draft));
const db = await createDatabase();
const scope = db.scope(world);
const checks = [];

async function check(id, run) {
  await run();
  checks.push({ id, result: 'PASS' });
  console.log(id+' PASS');
}

function post(route, url, body, header, contract) {
  return route.POST(new Request(url,{method:'POST',headers:{origin:new URL(url).origin,
    'content-type':'application/json',[header]:contract},body:JSON.stringify(body)}));
}

try {
  // Seed the exact same marked state under the normal owner before testing OFF.
  process.env.COMPOSER_BEFORE_N2_ENABLED = 'true';
  await db.seed(base);
  const f = new Frames(await db.read(),world);
  await f.operation(descriptive);
  const command = f.request();
  assert.equal((await f.save(scope, command)).ok,true);
  const stored = await db.read();
  const snapshot = await db.snapshot();
  delete process.env.COMPOSER_BEFORE_N2_ENABLED;

  await check('N2_01_OFF_DEFAULT_AND_LEGACY_BAR_OWNER',async()=>{
    assert.equal(beforeN2Enabled(),false);
    process.env.COMPOSER_BEFORE_N2_ENABLED = '1';
    assert.equal(beforeN2Enabled(),false);
    delete process.env.COMPOSER_BEFORE_N2_ENABLED;
    assert.equal((await interact(descriptive)).code,'COMPOSER_BEFORE_N2_DISABLED');
    const bottle = child(d1Fixture()).slotSelections.main.items[0];
    const legacy = barBeforePatch(base,parent(base),bottle,[]);
    const response = await interact(legacy);
    assert.equal(response.ok,true,JSON.stringify(response));
    const journal = new BeforeDraftHistory(null,base);
    journal.record(base,response.model.semanticState,legacy);
    assert.equal(journal.envelope(response.model.semanticState),undefined);
    assert.throws(()=>barBeforeRemove(response.model.semanticState,parent(response.model.semanticState),bottle.selectionId,false),/Before entier/);
    assert.equal((await interact({kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{label:'Bar historique'}}})).ok,true);
  });

  await check('N2_02_MARKED_AND_TAMPERED_INTERACTIONS_REFUSED',async()=>{
    for(const operation of [{kind:'READ'},{kind:'SUGGESTIONS'},{kind:'PRESERVE',targetRef:parentId,preserve:true},
      {kind:'DROP',assetKey:'context-occurrence:'+parentId,target:{kind:'TRASH'},values:{}},
      {kind:'EDIT_NIGHT_OUT',edit:{contextOccurrenceId:parentId,fields:{},before:null}}]){
      assert.equal((await interact(operation,marked)).code,'COMPOSER_BEFORE_N2_DISABLED');
    }
    const injected = {...descriptive,edit:{...descriptive.edit,before:{...descriptive.edit.before,version:'unexpected'}}};
    assert.equal((await interact(injected)).code,'COMPOSER_BEFORE_N2_DISABLED');
  });

  await check('N2_03_DIRECT_HTTP_SAVE_PREVIEW_AND_HISTORIC_CLIENT',async()=>{
    const load=Module._load;
    let saves=0, drafts, preview, actions;
    Module._load=function(name,parent,...args){
      if(name==='@/server/phase2/planner/runtime')return {authorizedPlanner:async()=>({...scope,deps})};
      if(name==='@/server/phase2/planner/composer-draft-cutover')return {composerDraftAutosaveEnabledFor:()=>true};
      if(name==='@/server/phase2/planner/before-draft-executor')return {executeBeforeDraft:()=>{saves++;throw Error('UNEXPECTED_WRITE');}};
      if(name==='next/cache')return {revalidatePath(){throw Error('UNEXPECTED_REVALIDATION');}};
      return load.call(this,name,parent,...args);
    };
    try{
      drafts=require('@/app/api/composer/drafts/route');
      preview=require('@/app/api/composer/preview/route');
      actions=require('@/app/mois-a-venir/composer/actions');
    }finally{Module._load=load;}
    const previewFlag = process.env.COMPOSER_PREVIEW_HTTP_ENABLED;
    process.env.COMPOSER_PREVIEW_HTTP_ENABLED='1';
    try{
      const draftUrl='http://localhost/api/composer/drafts';
      const valid=await post(drafts,draftUrl,{kind:'SAVE',command},'X-Composer-Draft-Contract','composer-draft-http@2');
      assert.equal((await valid.json()).code,'ADMISSION_REFUSED');
      const old=await post(drafts,draftUrl,{kind:'SAVE',command},'X-Composer-Draft-Contract','composer-draft-http@1');
      assert.equal(old.status,409);
      const stripped={...command,beforeAdmission:undefined,semanticState:base,digest:semanticStateDigest(base)};
      const forged=await post(drafts,draftUrl,{kind:'SAVE',command:stripped},'X-Composer-Draft-Contract','composer-draft-http@2');
      assert.equal((await forged.json()).code,'ADMISSION_REFUSED');
      const archive=await post(drafts,draftUrl,{kind:'ARCHIVE',command:{targetMonth:base.targetMonth,draftId:stored.draftId,
        expectedDraftVersion:stored.version,requestId:randomUUID()}},'X-Composer-Draft-Contract','composer-draft-http@2');
      assert.equal((await archive.json()).code,'ADMISSION_REFUSED');
      const view=await post(preview,'http://localhost/api/composer/preview',request({kind:'READ'},marked),
        'X-Composer-Preview-Contract','composer-preview-http@1');
      assert.equal((await view.json()).code,'COMPOSER_BEFORE_N2_DISABLED');
      const apply={kind:'APPLY',command:{}};
      const viaPreview=await post(preview,'http://localhost/api/composer/preview',request(apply,marked),
        'X-Composer-Preview-Contract','composer-preview-http@1');
      assert.equal(viaPreview.status,400);
      assert.equal((await actions.composerInteraction(request(apply,marked))).code,'COMPOSER_BEFORE_N2_DISABLED');
      const read=await drafts.GET(new Request(draftUrl+'?month='+base.targetMonth, {headers:{'X-Composer-Draft-Contract':'composer-draft-http@2'}}));
      assert.equal((await read.json()).active.digest,stored.digest);
      assert.equal(saves,0);
      assert.equal(await db.snapshot(),snapshot);
    }finally{
      if(previewFlag===undefined)delete process.env.COMPOSER_PREVIEW_HTTP_ENABLED;
      else process.env.COMPOSER_PREVIEW_HTTP_ENABLED=previewFlag;
    }
  });

  await check('N2_04_APPLY_STAYS_DRAFT_ONLY_WHILE_ON',async()=>{
    let writes=0;
    const planDeps={...deps,repository:{...deps.repository,readAppliedRequest:async()=>null,
      async applyRevision(){writes++;throw Error('SYNTHETIC_WRITER_PROBE');}}};
    await assert.rejects(previewPlanScenario(planDeps,householdId,marked),/COMPOSER_BEFORE_N2_DISABLED/);
    await assert.rejects(applyPlanScenario(planDeps,householdId,marked,{}),/COMPOSER_BEFORE_N2_APPLY_UNAVAILABLE/);
    process.env.COMPOSER_BEFORE_N2_ENABLED='true';
    assert.equal((await interact(descriptive)).ok,true);
    assert.equal((await interact({kind:'APPLY',command:{}},marked)).code,'COMPOSER_BEFORE_N2_APPLY_UNAVAILABLE');
    await assert.rejects(applyPlanScenario(planDeps,householdId,marked,{}),/COMPOSER_BEFORE_N2_APPLY_UNAVAILABLE/);
    assert.equal(writes,0);
    const legacy = d1Fixture();
    const plan=await previewPlanScenario(planDeps,householdId,legacy);
    await assert.rejects(applyPlanScenario(planDeps,householdId,legacy,{applyRequestId:randomUUID(),
      expectedActiveRevisionId:null,expectedActiveRevisionNumber:0,
      expectedPreviewDigest:plan.previewDigest,expectedBaselineDigest:plan.baselineDigest}));
    assert.equal(writes,1);
    assert.equal(await db.snapshot(),snapshot);
  });
} finally {
  await db.close();
  fs.writeFileSync(path.join(here,'cutover-proof.json'),JSON.stringify({checks,databaseClosed:true,
    level:'ACTUAL_HTTP_HANDLERS_AND_SYNTHETIC_SCOPES_NO_REAL_APPLY'},null,2));
}
