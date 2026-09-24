import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const migrationName = "20260921162509_optimize_frozen_content_guards.sql";
const readMigration = (name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8");
const optimizationSql = readMigration(migrationName);
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); checks += 1; };
const hash = (character) => character.repeat(64);

check(() => assert.equal((optimizationSql.match(/create or replace function public\.guard_(?:global|history)_v2_frozen_content\(\)/giu) ?? []).length, 2));
check(() => assert.doesNotMatch(optimizationSql, /to_jsonb\s*\(\s*(?:new|old)\s*\)/iu));
check(() => assert.doesNotMatch(optimizationSql, /(?:create|drop)\s+(?:table|trigger|index)|alter\s+table|statement_timeout/iu));
check(() => assert.match(optimizationSql, /returns trigger language plpgsql security invoker set search_path = ''/giu));
check(() => assert.match(optimizationSql, /old\.payload is distinct from new\.payload/iu));
check(() => assert.match(optimizationSql, /select a\.artifact_row_id into v_existing_id[\s\S]+if found then[\s\S]+select \* into strict v_existing_artifact/iu));

const moduleFile = process.env.FROZEN_GUARD_PGLITE_MODULE;
if (moduleFile === undefined) {
  console.log(`Frozen content guard optimization: ${checks}/${checks} PASS (SQL=NOT_RUN: set FROZEN_GUARD_PGLITE_MODULE)`);
  process.exit(0);
}

const { PGlite } = await import(pathToFileURL(moduleFile).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema private;
    create function private.user_has_household_access(uuid) returns boolean language sql as 'select false';
    create table public.households(household_id uuid primary key);
    create table public.persons(person_id uuid primary key);
    create table public.household_revisions(household_id uuid primary key,data_revision bigint,analytics_revision bigint,updated_at timestamptz default now());
    create table public.analysis_periods(household_id uuid,month date,source_revision bigint,updated_at timestamptz);
    create table public.analytics_change_log(household_id uuid,affected_month date,data_revision bigint,impact_scope text,processed_at timestamptz);
    grant select on public.household_revisions to service_role;
  `);
  const initial = readMigration("20260825105100_analytics_materialization.sql");
  await db.exec(initial.slice(0, initial.indexOf("create or replace function public.record_analytics_mutation")) + "commit;");
  await db.exec(readMigration("20260831094236_history_v2_publication_rollback.sql"));
  await db.exec(readMigration("20260902105811_enforce_single_active_analytics_generation.sql"));
  await db.exec(readMigration("20260904110151_history_v2_dependency_manifest.sql"));
  await db.exec(readMigration("20260904110402_history_v2_frozen_publications.sql"));
  await db.exec(readMigration("20260907123714_global_v2_publication_infrastructure.sql"));
  await db.exec(optimizationSql);

  const definitions = (await db.query(`select p.proname,pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('guard_global_v2_frozen_content','guard_history_v2_frozen_content')
    order by p.proname`)).rows;
  check(() => assert.equal(definitions.length, 2));
  check(() => assert.equal(definitions.every(({ definition }) => !/to_jsonb\s*\(\s*(?:new|old)\s*\)/iu.test(definition)), true));

  const householdId = "00000000-0000-4000-8000-000000000001";
  const otherHouseholdId = "00000000-0000-4000-8000-000000000002";
  const globalPublicationId = "00000000-0000-4000-8000-000000000101";
  const historyPublicationId = "00000000-0000-4000-8000-000000000102";
  const globalArtifactKey = "global-artifact:large-owner-outputs";
  const historyArtifactKey = "history-artifact:calendar";
  await db.query("insert into public.households(household_id) values ($1),($2)", [householdId, otherHouseholdId]);
  await db.query("insert into public.household_revisions(household_id,data_revision,analytics_revision) values ($1,1,79),($2,1,5)", [householdId, otherHouseholdId]);
  await db.exec("set role service_role");

  const globalHandshake = (await db.query("select * from public.global_v2_publication_contract()")).rows;
  const historyHandshake = (await db.query("select * from public.history_v2_frozen_publication_contract()")).rows;
  check(() => assert.deepEqual(globalHandshake, [{ boundary_version: "global-v2-publication@v1" }]));
  check(() => assert.deepEqual(historyHandshake, [{ boundary_version: "history-frozen-month@v1" }]));

  await db.query(`insert into public.analytics_publications(
    publication_id,household_id,scope_kind,as_of_month,source_revision,base_analytics_revision,
    required_artifact_keys,required_query_keys,status
  ) values ($1,$2,'global','2026-09-01',1,79,array[$3],array[]::text[],'draft')`,
  [globalPublicationId, householdId, globalArtifactKey]);

  const insertGlobal = ({ artifactKey = globalArtifactKey, rowHouseholdId = householdId,
    sourceRevision = 1, active = false, payloadPublicationId = globalPublicationId, payloadSize = 1 } = {}) => db.query(`
    insert into public.analytics_artifacts(
      artifact_key,generation_key,household_id,subject_kind,period_kind,as_of_month,artifact_family,metric_id,
      scope_hash,filter_signature,method_version,contract_version,source_revision,analytics_revision,payload,
      computed_at,publication_id,is_active
    ) values ($3,$1::text,$2,'household','global','2026-09-01','global_owner_outputs','global_owner_outputs',
      $7,$8,'global-owner-outputs@v1','global-owner-outputs@v1',$4,79,
      pg_catalog.jsonb_build_object('publicationMeta',pg_catalog.jsonb_build_object('publicationId',$6::text,'revision','80'),
        'ownerOutputs',pg_catalog.repeat('x',$9)),
      '2026-09-21T12:00:00Z',$1::uuid,$5)`,
  [globalPublicationId, rowHouseholdId, artifactKey, sourceRevision, active,
    payloadPublicationId, hash("6"), hash("7"), payloadSize]);

  await rejects(() => insertGlobal({ payloadPublicationId: "00000000-0000-4000-8000-000000000199" }), /identity\/state mismatch/i);
  await rejects(() => insertGlobal({ artifactKey: "wrong-key" }), /unexpected.*artifact key/i);
  await rejects(() => insertGlobal({ rowHouseholdId: otherHouseholdId }), /identity\/state mismatch/i);
  await rejects(() => insertGlobal({ sourceRevision: 2 }), /identity\/state mismatch/i);
  await rejects(() => insertGlobal({ active: true }), /identity\/state mismatch/i);
  await insertGlobal({ payloadSize: 20 * 1024 * 1024 }); checks += 1;
  const payloadBytes = Number((await db.query("select pg_catalog.octet_length(payload::text)::bigint as bytes from analytics_artifacts where publication_id=$1", [globalPublicationId])).rows[0].bytes);
  check(() => assert.ok(payloadBytes >= 20 * 1024 * 1024));

  const retryColumns = `artifact_key,generation_key,household_id,subject_kind,subject_id,period_kind,period_month,as_of_month,
    artifact_family,metric_id,dimension_key,bucket_key,scope_hash,filter_signature,method_version,contract_version,
    source_revision,analytics_revision,payload,computed_at,publication_id,is_active,invalidated_at,invalidation_revision`;
  await db.query(`insert into public.analytics_artifacts(${retryColumns})
    select ${retryColumns} from public.analytics_artifacts where publication_id=$1 on conflict do nothing`, [globalPublicationId]);
  checks += 1;
  await rejects(() => db.query(`insert into public.analytics_artifacts(${retryColumns})
    select artifact_key,generation_key,household_id,subject_kind,subject_id,period_kind,period_month,as_of_month,
      artifact_family,metric_id,dimension_key,bucket_key,scope_hash,filter_signature,method_version,contract_version,
      source_revision,analytics_revision,pg_catalog.jsonb_set(payload,'{ownerOutputs}',pg_catalog.to_jsonb('changed'::text)),
      computed_at,publication_id,is_active,invalidated_at,invalidation_revision
    from public.analytics_artifacts where publication_id=$1 on conflict do nothing`, [globalPublicationId]), /retry changed content/i);
  await rejects(() => db.query("update public.analytics_artifacts set metric_id='changed' where publication_id=$1", [globalPublicationId]), /immutable/i);
  await rejects(() => db.query("update public.analytics_artifacts set payload=payload || '{\"changed\":true}'::jsonb where publication_id=$1", [globalPublicationId]), /immutable/i);
  await rejects(() => db.query("update public.analytics_artifacts set is_active=true where publication_id=$1", [globalPublicationId]), /workflow owner/i);
  await db.exec("reset role");
  await db.query("update public.analytics_artifacts set is_active=true where publication_id=$1", [globalPublicationId]);
  await db.exec("set role service_role"); checks += 1;
  await rejects(() => db.query("delete from public.analytics_artifacts where publication_id=$1", [globalPublicationId]), /cannot be deleted/i);

  await db.query(`insert into public.analytics_publications(
    publication_id,household_id,scope_kind,period_month,source_revision,base_analytics_revision,
    required_artifact_keys,required_query_keys,status
  ) values ($1,$2,'month','2026-08-01',1,79,array[$3],array[]::text[],'draft')`,
  [historyPublicationId, householdId, historyArtifactKey]);
  const insertHistory = () => db.query(`insert into public.analytics_artifacts(
    artifact_key,generation_key,household_id,subject_kind,period_kind,period_month,artifact_family,metric_id,
    scope_hash,filter_signature,method_version,contract_version,source_revision,analytics_revision,payload,
    computed_at,publication_id,is_active
  ) values ($3,$1::text,$2,'household','month','2026-08-01','calendar_semantic_month','calendar_semantic_month',
    $4,$5,'history-calendar@v2','v2',1,79,
    pg_catalog.jsonb_build_object('publicationMeta',pg_catalog.jsonb_build_object('publicationId',$1::text,'revision','80')),
    '2026-09-21T12:00:00Z',$1::uuid,false)`,
  [historyPublicationId, householdId, historyArtifactKey, hash("8"), hash("9")]);
  await insertHistory(); checks += 1;
  await db.query(`insert into public.analytics_artifacts(${retryColumns})
    select ${retryColumns} from public.analytics_artifacts where publication_id=$1 on conflict do nothing`, [historyPublicationId]);
  checks += 1;
  await rejects(() => db.query(`insert into public.analytics_artifacts(${retryColumns})
    select artifact_key,generation_key,household_id,subject_kind,subject_id,period_kind,period_month,as_of_month,
      artifact_family,metric_id,dimension_key,bucket_key,scope_hash,filter_signature,method_version,contract_version,
      source_revision,analytics_revision,payload || '{"changed":true}'::jsonb,computed_at,publication_id,is_active,
      invalidated_at,invalidation_revision from public.analytics_artifacts where publication_id=$1 on conflict do nothing`,
  [historyPublicationId]), /History retry changed/i);
  await rejects(() => db.query("update public.analytics_artifacts set metric_id='changed' where publication_id=$1", [historyPublicationId]), /History content is immutable/i);
  await rejects(() => db.query("update public.analytics_artifacts set payload=payload || '{\"changed\":true}'::jsonb where publication_id=$1", [historyPublicationId]), /History content is immutable/i);
  await rejects(() => db.query("update public.analytics_artifacts set is_active=true where publication_id=$1", [historyPublicationId]), /authorized workflow/i);
  await db.exec("reset role");
  await db.query("update public.analytics_artifacts set is_active=true where publication_id=$1", [historyPublicationId]);
  await db.exec("set role service_role"); checks += 1;
  await rejects(() => db.query("delete from public.analytics_artifacts where publication_id=$1", [historyPublicationId]), /cannot be deleted/i);

  const finalCounts = (await db.query(`select
    count(*) filter (where publication_id=$1)::int as global_rows,
    count(*) filter (where publication_id=$2)::int as history_rows
    from public.analytics_artifacts`, [globalPublicationId, historyPublicationId])).rows[0];
  check(() => assert.deepEqual(finalCounts, { global_rows: 1, history_rows: 1 }));
  console.log(`Frozen content guard optimization: ${checks}/${checks} PASS (SQL=PASS, LARGE_PAYLOAD_BYTES=${payloadBytes})`);
} finally {
  await db.close();
}
