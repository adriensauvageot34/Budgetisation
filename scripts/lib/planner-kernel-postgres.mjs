import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { householdId, userId } from "../fixtures/planner-kernel.mjs";

/** Executes the unchanged C0 SQL on synthetic PostgreSQL only. No Supabase stack or network. */
export async function createKernelPostgres() {
  const db = new PGlite(); let rpcCalls = 0;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; create table auth.users(id uuid primary key);
    create table public.households(household_id uuid primary key);
    create table private.household_memberships(user_id uuid,household_id uuid);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.user_has_household_access(p_household_id uuid) returns boolean
      language sql stable security definer set search_path='' as $$ select exists(select 1 from private.household_memberships hm
        where hm.user_id=(select auth.uid()) and hm.household_id=p_household_id) $$;
    grant usage on schema public,auth,private to authenticated,anon,service_role;
    grant execute on function private.user_has_household_access(uuid) to authenticated;`);
  await db.query("insert into auth.users values($1)",[userId]);
  await db.query("insert into public.households values($1)",[householdId]);
  await db.query("insert into private.household_memberships values($1,$2)",[userId,householdId]);
  const canaries = ["operations","purchase_events","mobility_fixture","analytics_fixture","phase2_month_inputs","phase2_planned_expenses","benefit_wallet_fixture","household_revisions"];
  for (const table of canaries) await db.exec(`create table public.${table}(fixture_id integer primary key); insert into public.${table} values(1);
    create function private.deny_${table}_write() returns trigger language plpgsql as $$ begin raise exception 'HISTORICAL_WRITE_FORBIDDEN'; end; $$;
    create trigger deny_write before insert or update or delete on public.${table} for each row execute function private.deny_${table}_write();
    create trigger deny_truncate before truncate on public.${table} for each statement execute function private.deny_${table}_write();
    grant select on public.${table} to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261005202346_phase2_month_plan_foundation.sql","utf8"));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]); await db.exec("set role authenticated");
  const tables = new Set(["phase2_month_plans","phase2_month_plan_revisions"]);
  const client = { from(table) {
    if (!tables.has(table)) throw new Error(`UNEXPECTED_TABLE:${table}`);
    const filters = [];
    const query = { select(columns) { if(columns!=="*") throw new Error("UNEXPECTED_SELECT"); return query; },
      eq(key,value) { if(!/^[a-z_]+$/u.test(key)) throw new Error("INVALID_COLUMN"); filters.push([key,value]); return query; },
      async maybeSingle() {
        try { const rows=(await db.query(`select to_jsonb(t) as row from public.${table} t where ${filters.map(([key],i)=>`${key}=$${i+1}`).join(" and ")}`,
          filters.map(([,value])=>value))).rows.map(r=>r.row);
          if(rows.length>1) throw new Error("MULTIPLE_ROWS"); return {data:rows[0]??null,error:null};
        } catch(error) { return {data:null,error}; }
      } };
    return query;
  }, async rpc(name,args) {
    if(name!=="apply_phase2_month_plan_v1") throw new Error(`UNEXPECTED_RPC:${name}`);
    const keys=["household_id","target_month","expected_active_revision_id","expected_active_revision_number","apply_request_id",
      "baseline_digest","baseline_snapshot","semantic_state","semantic_state_digest","change_set","compiled_manifest","compiled_manifest_digest",
      "projection_evidence","preview_digest","compiler_version","model_versions"];
    const json=new Set(["baseline_snapshot","semantic_state","change_set","compiled_manifest","projection_evidence","model_versions"]);
    rpcCalls++;
    try { const data=(await db.query(`select public.${name}(${keys.map((_,i)=>`$${i+1}`).join(",")}) as result`,
      keys.map(key=>json.has(key)?JSON.stringify(args[`p_${key}`]):args[`p_${key}`]))).rows[0].result; return {data,error:null};
    } catch(error) { return {data:null,error}; }
  } };
  return {client,db,get rpcCalls(){return rpcCalls;},async counts(){return (await db.query(`select
    (select count(*)::int from public.phase2_month_plans) plans,(select count(*)::int from public.phase2_month_plan_revisions) revisions`)).rows[0];},
    async verifyCanaries(){for(const table of canaries) if((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n!==1)
      throw new Error(`CANARY_CHANGED:${table}`);}, close:()=>db.close()};
}
