import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** PostgreSQL transport for tests only; never uses a URL, token or live client. */
export function postgresClient(query) {
  return {
    from(table) {
      const state = { filters: [], values: [], orders: [], columns: "*", mode: "select" };
      const bind = (value) => { state.values.push(value); return `$${state.values.length}`; };
      const column = (key) => key.startsWith("analytics_publications.") ? key : `t.${key}`;
      const builder = {
        select(columns = "*") { state.columns = columns; return this; },
        eq(key, value) { state.filters.push(`${column(key)}=${bind(value)}`); return this; },
        is(key, value) { if (value !== null) throw new Error("Unsupported test is"); state.filters.push(`${column(key)} is null`); return this; },
        not(key, op, value) { if (op !== "is" || value !== null) throw new Error("Unsupported test not"); state.filters.push(`${column(key)} is not null`); return this; },
        in(key, values) { state.filters.push(`${column(key)} in (${values.map(bind).join(",") || "null"})`); return this; },
        lte(key, value) { state.filters.push(`${column(key)}<=${bind(value)}`); return this; },
        gte(key, value) { state.filters.push(`${column(key)}>=${bind(value)}`); return this; },
        order(key, options = {}) { state.orders.push(`${column(key)} ${options.ascending === false ? "desc" : "asc"}`); return this; },
        range(start, end) { state.offset = start; state.limit = end - start + 1; return this; },
        limit(limit) { state.limit = limit; return this; },
        single() { state.single = true; return this; },
        maybeSingle() { state.single = true; return this; },
        insert(row) { state.mode = "insert"; state.row = row; return this; },
        upsert(row, options) { state.mode = "upsert"; state.row = row; state.conflict = options.onConflict; return this; },
        async then(resolve) {
          try {
            let sql;
            if (state.mode === "select") {
              const join = state.columns.includes("analytics_publications!inner");
              const cols = state.columns.replace(/,analytics_publications!inner\([^)]*\)/u, "");
              const selection = cols === "*" ? "t.*" : cols.split(",").map((c) => `t.${c}`).join(",");
              sql = `select ${selection} from public.${table} t`;
              if (join) sql += " join analytics_publications on analytics_publications.publication_id=t.publication_id";
              if (state.filters.length) sql += ` where ${state.filters.join(" and ")}`;
              if (state.orders.length) sql += ` order by ${state.orders.join(",")}`;
              if (state.limit !== undefined) sql += ` limit ${state.limit} offset ${state.offset ?? 0}`;
            } else {
              const cols = Object.keys(state.row);
              state.values = cols.map((c) => c === "payload" ? JSON.stringify(state.row[c]) : state.row[c]);
              sql = `insert into public.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`;
              if (state.mode === "upsert") sql += ` on conflict (${state.conflict}) do update set ${cols.map((c) => `${c}=excluded.${c}`).join(",")}`;
              sql += " returning *";
            }
            const data = JSON.parse(JSON.stringify(await query(sql, state.values)));
            return resolve({ data: state.single ? data[0] ?? null : data, error: null });
          } catch (error) { return resolve({ data: null, error }); }
        },
      };
      return builder;
    },
    async rpc(name, params = {}) {
      try {
        const entries = Object.entries(params);
        const data = await query(`select * from public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")})`,
          entries.map(([key, value]) => key === "p_manifest" ? JSON.stringify(value) : value));
        return { data, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
}

export async function createHc5Postgres(moduleFile, householdId, month) {
  if (!moduleFile) throw new Error("HC5_PGLITE_MODULE required: external local PostgreSQL test runtime, never Supabase.");
  const { PGlite } = await import(pathToFileURL(moduleFile).href);
  const db = new PGlite();
  const raw = async (sql, values = []) => {
    const result = await db.query(sql, values);
    // Match PostgREST's DATE transport, not JavaScript Date timestamps.
    for (const row of result.rows) for (const field of result.fields) {
      if (field.dataTypeID === 1082 && row[field.name] instanceof Date) row[field.name] = row[field.name].toISOString().slice(0, 10);
    }
    return result.rows;
  };
  const read = (name) => fs.readFileSync(path.join("supabase/migrations", name), "utf8");
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema private;
    create function private.user_has_household_access(uuid) returns boolean language sql as 'select false';
    create table households(household_id uuid primary key);
    create table persons(person_id uuid primary key);
    create table household_revisions(household_id uuid primary key, data_revision bigint, analytics_revision bigint, updated_at timestamptz default now());
    create table analysis_periods(household_id uuid, month date, source_revision bigint, updated_at timestamptz);
    create table analytics_change_log(change_id uuid default gen_random_uuid(), household_id uuid, entity_kind text,
      entity_id uuid, affected_month date, data_revision bigint, impact_scope text, processed_at timestamptz);
    -- Missing from the versioned repository: synthetic prerequisite only.
    -- Its revision/log contract is exercised, not claimed as a live-DDL proof.
    create function private.bump_revision_and_log(h uuid,k text,e uuid,m date,s text)
      returns table(data_revision bigint, change_id uuid) language plpgsql as $$
      declare r bigint; c uuid;
      begin
        update public.household_revisions hr set data_revision=hr.data_revision+1 where household_id=h returning hr.data_revision into r;
        insert into public.analytics_change_log(household_id,entity_kind,entity_id,affected_month,data_revision,impact_scope)
          values(h,k,e,m,r,s) returning analytics_change_log.change_id into c;
        return query select r,c;
      end $$;
    create table life_event_types(life_event_type_id uuid primary key,type_key text,can_span_days boolean,active boolean);
    create table life_events(life_event_id uuid primary key,household_id uuid,life_event_type_id uuid,
      life_event_series_id uuid,parent_life_event_id uuid,start_date date,end_date date,validation_status text);
    create table life_event_participations(life_event_id uuid,person_day_id uuid,person_id uuid,participation_status text);
    create table life_event_continuity_assertions(life_event_id uuid,household_id uuid,status text,continuity_qualifier text,authority text,evidence_refs text[],provenance text);
    create table moments(moment_id uuid,household_id uuid);
    create table moment_life_events(moment_id uuid,life_event_id uuid,relation_type text,validation_status text);
    create view canonical_household_scope_control as select 1 as household_count,household_id,'READY' as status from households;
    grant select on all tables in schema public to service_role;
    -- Only a synthetic Canonical edit boundary; not installed by a migration.
    create function public.hc5_correct_event(h uuid,e uuid,s text) returns void
      language plpgsql security definer as $$
      begin
        if s not in ('Confirmé','À valider') then raise exception 'Invalid fixture correction'; end if;
        update life_events set validation_status=s where household_id=h and life_event_id=e;
        if not found then raise exception 'Wrong household/event'; end if;
      end $$;
    revoke all on function public.hc5_correct_event(uuid,uuid,text) from public,anon,authenticated;
    grant execute on function public.hc5_correct_event(uuid,uuid,text) to service_role;
  `);
  for (const migration of ["20260825105100_analytics_materialization.sql",
    "20260831150000_history_v2_publication_rollback.sql",
    "20260902105811_enforce_single_active_analytics_generation.sql",
    "20260904110151_history_v2_dependency_manifest.sql",
    "20260904110402_history_v2_frozen_publications.sql"]) await db.exec(read(migration));
  await raw("insert into households values ($1)", [householdId]);
  await raw("insert into household_revisions(household_id,data_revision,analytics_revision) values ($1,7,11)", [householdId]);
  await raw("insert into analysis_periods values ($1,$2,7,now())", [householdId, `${month}-01`]);
  await raw("insert into life_event_types values ($1,'pharmacie',false,true)", ["00000000-0000-4000-8000-000000000502"]);
  await raw("insert into life_events values ($1,$2,$3,null,null,$4,$4,'Confirmé')",
    ["00000000-0000-4000-8000-000000000501", householdId, "00000000-0000-4000-8000-000000000502", `${month}-12`]);
  await db.exec("set role service_role");
  return { db, raw, client: postgresClient(raw) };
}
