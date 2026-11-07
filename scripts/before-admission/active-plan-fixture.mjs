/** Synthetic pre-existing Plan, never an Apply call. SQL rows are parsed by the product repository contracts. */
import{randomUUID}from'node:crypto';import{require,userId,householdId,compiledD1}from'./runtime.mjs';
export async function seedActivePlan(db,state){
 const p=await compiledD1(state),id=randomUUID(),revision=randomUUID();
 await db.db.query('insert into public.phase2_month_plans(plan_id,household_id,target_month,created_by,updated_by) values($1,$2,$3,$4,$4)',[id,householdId,'2026-11-01',userId]);
 const row={plan_revision_id:revision,plan_id:id,household_id:householdId,target_month:'2026-11-01',revision_number:1,parent_revision_id:null,apply_request_id:randomUUID(),baseline_digest:p.baselineDigest,baseline_snapshot:p.baseline,semantic_state:state,semantic_state_digest:p.semanticStateDigest,change_set:[],compiled_manifest:p.compiled.manifest,compiled_manifest_digest:p.compiledManifestDigest,projection_evidence:{version:'planner-projection-evidence@v1',compiledManifestDigest:p.compiledManifestDigest,projectionDigest:p.projectionDigest,projection:p.projection},preview_digest:p.previewDigest,compiler_version:p.compiled.manifest.compilerVersion,model_versions:p.compiled.manifest.modelVersions,created_by:userId};
 const keys=Object.keys(row),values=keys.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]);
 await db.db.query('insert into public.phase2_month_plan_revisions('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',values);
 await db.db.query('update public.phase2_month_plans set active_revision_id=$1,active_revision_number=1 where plan_id=$2',[revision,id]);
 const{parsePlanRow,parsePlanRevisionRow}=require('@/domain/phase2/planner/plan-contract');
 async function readActivePlan(h,month){return db.asRole('authenticated',userId,async()=>{const plan=(await db.db.query('select to_jsonb(p) as row from public.phase2_month_plans p where household_id=$1 and target_month=$2',[h,month+'-01'])).rows[0]?.row;if(!plan)return null;const active=(await db.db.query('select to_jsonb(r) as row from public.phase2_month_plan_revisions r where plan_revision_id=$1',[plan.active_revision_id])).rows[0]?.row;return{plan:parsePlanRow(plan),activeRevision:parsePlanRevisionRow(active)};});}
 async function fingerprint(){return JSON.stringify((await db.db.query('select to_jsonb(p) as row from public.phase2_month_plans p')).rows)+JSON.stringify((await db.db.query('select to_jsonb(r) as row from public.phase2_month_plan_revisions r')).rows);}
 return{readActivePlan,revisionId:revision,planId:id,fingerprint};
}
