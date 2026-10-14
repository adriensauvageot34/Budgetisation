import pg from 'pg';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {require} from './phase2-ts-loader.mjs';
const {createActivityHistoryStore}=require('@/server/phase2/planner/activity-history-store');
pg.types.setTypeParser(1082,v=>v);
const database=process.env.SNAP2_LOCAL_DATABASE??'postgres';
if(database!=='postgres'&&!/^snap2_[a-z0-9_]+$/.test(database))throw Error('SNAP2_LOCAL_DATABASE_INVALID');
export const localConfig={host:'127.0.0.1',port:55434,user:'postgres',database,ssl:false,
 password:()=>{throw Error('SNAP2_LOCAL_MUST_NOT_REQUEST_A_SECRET');}};
export const connection=async()=>{const c=new pg.Client(localConfig);await c.connect();return c;};
export async function setupNative(data){
 const c=await connection();
 await c.query(`DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='snap2_importer') THEN CREATE ROLE snap2_importer; END IF; END $$;
 CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz,deleted_at timestamptz);
 CREATE TABLE public.households(household_id uuid PRIMARY KEY,timezone text NOT NULL);
 CREATE TABLE public.persons(person_id uuid PRIMARY KEY,household_id uuid REFERENCES households);
 CREATE TABLE private.household_memberships(user_id uuid REFERENCES auth.users,household_id uuid REFERENCES households,PRIMARY KEY(user_id,household_id));
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION private.user_has_household_access(h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT exists(SELECT 1 FROM private.household_memberships WHERE household_id=h AND user_id=auth.uid()) $$;
 GRANT USAGE ON SCHEMA auth,private,public TO authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid(),private.user_has_household_access(uuid) TO authenticated;
 CREATE VIEW canonical_household_scope_control AS SELECT count(*)::integer AS household_count,min(household_id::text)::uuid AS household_id,
 CASE WHEN count(*)=1 THEN 'READY' ELSE 'AMBIGUOUS' END AS status FROM households
 WHERE household_id='${data.context.householdId}'; -- isolated fixture scope; not the production view
 CREATE TABLE life_event_types(life_event_type_id uuid PRIMARY KEY,type_key text,can_span_days boolean,active boolean);
 CREATE TABLE life_events(life_event_id uuid PRIMARY KEY,life_event_type_id uuid,life_event_series_id uuid,parent_life_event_id uuid,
 start_date date,end_date date,validation_status text,primary_place_id uuid,title text);
 CREATE TABLE life_event_participations(life_event_id uuid,person_day_id uuid,person_id uuid,start_at text,end_at text,time_precision text,
 participation_role text,participation_status text);
 CREATE TABLE life_event_financial_links(financial_link_id uuid PRIMARY KEY,life_event_id uuid,source_kind text,operation_id uuid,allocation_id uuid,
 item_id uuid,cash_use_id uuid,relation_type text,economic_amount_linked numeric,validation_status text);
 GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON life_events,life_event_types,life_event_participations,life_event_financial_links TO snap2_importer,service_role;
 CREATE TABLE household_revisions(household_id uuid PRIMARY KEY,data_revision bigint,analytics_revision bigint);
 CREATE TABLE analytics_publications(publication_id text PRIMARY KEY,status text);
 CREATE TABLE analytics_artifacts(artifact_key text PRIMARY KEY,payload jsonb);
 INSERT INTO household_revisions VALUES('${data.context.householdId}',1,1);
 INSERT INTO analytics_publications VALUES('synthetic-existing-publication','published');
 INSERT INTO analytics_artifacts VALUES('synthetic-existing-artifact','{"unchanged":true}');`);
 await c.query('INSERT INTO households VALUES($1,$2)',[data.context.householdId,data.context.timezone]);
 for(const id of data.context.personIds)await c.query('INSERT INTO persons VALUES($1,$2)',[id,data.context.householdId]);
 await c.query('INSERT INTO auth.users(id) VALUES($1)',[data.context.userId]);
 await c.query('INSERT INTO private.household_memberships VALUES($1,$2)',[data.context.userId,data.context.householdId]);
 for(const table of ['life_event_types','life_events','life_event_participations','life_event_financial_links'])
  for(const row of data.tables[table]){
   const fields=Object.keys(row).filter(key=>key!=='extra_unselected');
   await c.query(`INSERT INTO ${table}(${fields.join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(f=>row[f]));
  }
 const migration=process.env.SNAP2_MIGRATION_SQL??'supabase/candidates/P14_SNAP2_ACTIVITY_HISTORY_DO_NOT_APPLY.sql';
 if(!/^supabase\/(candidates|migrations)\/[a-zA-Z0-9_]+\.sql$/.test(migration))throw Error('SNAP_TEST_MIGRATION_PATH_INVALID');
 await c.query(fs.readFileSync(migration,'utf8'));
 return c;
}
export async function rpcClient(actor,role='authenticated'){
 const c=await connection();await c.query(`SET ROLE ${role}`);if(actor)await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor]);
 const calls=[],metrics=[];
 return {c,calls,metrics,async rpc(name,args){
  calls.push(name);
  const at=performance.now();
  const names=name==='inspect_planner_activity_history_v1'?['p_scope','p_key']:['p_scope','p_key','p_expected_generation','p_artifact'];
  try{const {rows}=await c.query(`SELECT public.${name}(${names.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,names.map(n=>args[n]));metrics.push({name,ms:performance.now()-at,bytes:Buffer.byteLength(JSON.stringify(rows[0].value)),status:'OK'});return {data:rows[0].value,error:null};}
  catch(error){metrics.push({name,ms:performance.now()-at,bytes:0,status:'ERROR',code:error.code});return {data:null,error:{code:error.code,message:error.message}};}
 },close:()=>c.end()};
}
export function nativeSourceClient(c,{cap=1000,before}={}){
 const calls=[];
 const client={from(table){
  let selection='*',exact=false,filters=[],orders=[],limit=cap,offset=0;
  const q={select:(s,o)=>(selection=s,exact=o?.count==='exact',q),in:(k,v)=>(filters.push([k,'in',v]),q),eq:(k,v)=>(filters.push([k,'=',v]),q),
   gte:(k,v)=>(filters.push([k,'>=',v]),q),lte:(k,v)=>(filters.push([k,'<=',v]),q),lt:(k,v)=>(filters.push([k,'<',v]),q),
   order:(k,o)=>(orders.push([k,o?.ascending!==false]),q),limit:n=>(limit=Math.min(n,cap),q),range:(a,b)=>(offset=a,limit=Math.min(b-a+1,cap),q),
   then(resolve,reject){return(async()=>{
    await before?.(table);if(!['canonical_household_scope_control','life_events','life_event_types','life_event_participations','life_event_financial_links'].includes(table))throw Error('SNAP2_UNEXPECTED_SOURCE');
    const params=[],bind=v=>(params.push(v),'$'+params.length),where=filters.map(([k,op,v])=>op==='in'?`${k}=ANY(${bind(v)}::${k.endsWith('_id')?'uuid':'text'}[])`:`${k}${op}${bind(v)}`);
    const sql=`SELECT ${selection}${exact?',count(*) OVER() AS snap2_count':''} FROM public.${table}
      ${where.length?'WHERE '+where.join(' AND '):''} ${orders.length?'ORDER BY '+orders.map(([k,a])=>k+(a?' ASC':' DESC')).join(','):''} LIMIT ${limit} OFFSET ${offset}`;
    const {rows}=await c.query(sql,params),count=exact?Number(rows[0]?.snap2_count??0):null;
    for(const row of rows)delete row.snap2_count;
    calls.push({table,selection,rows:rows.length,bytes:Buffer.byteLength(JSON.stringify(rows))});return {data:rows,error:null,count};
   })().then(resolve,reject);}
  };return q;
 }};return {client,calls};
}
export async function durableStore(actor){
 const reader=await rpcClient(actor),publisher=await rpcClient(null,'service_role');
 return {reader,publisher,store:createActivityHistoryStore(reader,publisher),close:async()=>{await reader.close();await publisher.close();}};
}
