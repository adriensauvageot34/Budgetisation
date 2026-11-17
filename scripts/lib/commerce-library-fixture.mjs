import fs from "node:fs";
import crypto from "node:crypto";
import { require } from "./phase2-ts-loader.mjs";
import { createKernelPostgres } from "./planner-kernel-postgres.mjs";
import { userId, uuid } from "../fixtures/planner-kernel.mjs";
const { BadgeLibrary } = require("@/server/commerce/badge-library");
const { badgeRequest } = require("@/server/commerce/badge-http");
const sharp = require("sharp");

/** Actual additive schema, RLS and service on isolated PostgreSQL. Storage bytes stay in memory. */
export async function commerceLibraryFixture(extraTables = []) {
  const pg = await createKernelPostgres();
  const other = uuid(98002), files = new Map(), tokens = new Map(), faults = { loseImageUpdateReply: false };
  await pg.db.exec(`reset role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    create table public.merchants(merchant_id uuid primary key,nom_canonique text);
    create table public.referentiel_lieu(place_id uuid primary key,nom_canonique text,private_place boolean default false);
    grant select on public.merchants,public.referentiel_lieu to authenticated;`);
  await pg.db.query("insert into auth.users values($1)", [other]);
  await pg.db.exec(fs.readFileSync("supabase/migrations/20261115211441_composer_badge_library.sql", "utf8"));
  await pg.db.exec(fs.readFileSync("supabase/migrations/20261116223846_merchant_counterparty_identity.sql", "utf8"));
  await pg.db.exec(fs.readFileSync("supabase/migrations/20261116231908_merchant_commercial_presentation.sql", "utf8"));
  await pg.db.exec(fs.readFileSync("supabase/migrations/20261117001552_merchant_generic_badge_categories.sql", "utf8"));
  await pg.db.exec(fs.readFileSync("supabase/migrations/20261117012301_merchant_badge_policy.sql", "utf8"));
  for (const [id, name] of [[uuid(97001), "E.Leclerc"], [uuid(97002), "Atelier Homonyme"], [uuid(97003), "Atelier Homonyme"]])
    await pg.db.query(`insert into public.merchants (merchant_id, nom_canonique, identity_kind, identity_classified_at, identity_source)
      values($1,$2,'commercial',now(),'owner_confirmed')`, [id, name]);
  for (const [id, name] of [[uuid(97101), "E.Leclerc"], [uuid(97102), "Restaurant de recette"], [uuid(97103), "Salon de recette"]])
    await pg.db.query("insert into public.referentiel_lieu(place_id,nom_canonique) values($1,$2)", [id, name]);
  let queue = Promise.resolve();
  const asUser = (actor, operation) => {
    const task = queue.then(async () => {
      await pg.db.exec("reset role");
      await pg.db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
      await pg.db.exec("set role authenticated");
      return operation();
    });
    queue = task.catch(() => {});
    return task;
  };
  const identifier = value => {
    if (!/^[a-z_]+$/u.test(value)) throw Error("FIXTURE_IDENTIFIER");
    return value;
  };
  function client(actor) {
    return {
      from(table) {
        if (!["composer_badge_visuals", "composer_badge_bindings", "merchants", "referentiel_lieu", ...extraTables].includes(table)) throw Error("BADGE_FINANCIAL_WRITE_FORBIDDEN");
        const filters = [], values = [], order = []; let operation = "SELECT", projection = "*", data, single = false, limit;
        const parameter = value => { values.push(value); return "$" + values.length; };
        const query = {
          select(columns) { if (!/^[a-z_,*]+$/u.test(columns)) throw Error("FIXTURE_PROJECTION"); projection = columns; return query; },
          eq(key, value) { filters.push(identifier(key) + "=" + parameter(value)); return query; },
          neq(key, value) { filters.push(identifier(key) + "<>" + parameter(value)); return query; },
          is(key, value) {
            if (value !== null) throw Error("FIXTURE_FILTER");
            filters.push(identifier(key) + " is null"); return query;
          },
          not(key, operator, value) {
            if (operator !== "like") throw Error("FIXTURE_FILTER");
            filters.push(identifier(key) + " not like " + parameter(value)); return query;
          },
          in(key, list) { filters.push(identifier(key) + "=any(" + parameter(list) + ")"); return query; },
          ilike(key, value) { filters.push(identifier(key) + " ilike " + parameter(value)); return query; },
          order(key) { order.push(identifier(key)); return query; }, limit(count) { limit = count; return query; },
          insert(value) { operation = "INSERT"; data = value; return query; },
          update(value) { operation = "UPDATE"; data = value; return query; },
          delete() { operation = "DELETE"; return query; },
          maybeSingle() { single = true; return query; },
          then(resolve, reject) {
            return asUser(actor, async () => {
              try {
                const where = filters.length ? " where " + filters.join(" and ") : "";
                let sql;
                if (operation === "SELECT") sql = "select " + projection + " from public." + table + where + (order.length ? " order by " + order.join(",") : "") + (limit ? " limit " + Number(limit) : "");
                if (operation === "INSERT") sql = "insert into public." + table + "(" + Object.keys(data).map(identifier).join(",") + ") values(" + Object.values(data).map(parameter).join(",") + ") returning " + projection;
                if (operation === "UPDATE") sql = "update public." + table + " set " + Object.entries(data).map(([key, value]) => identifier(key) + "=" + parameter(value)).join(",") + where + " returning " + projection;
                if (operation === "DELETE") sql = "delete from public." + table + where + " returning " + projection;
                const result = await pg.db.query(sql, values);
                // PostgREST serializes a SQL date as YYYY-MM-DD, unlike PGlite's Date object.
                for (const row of result.rows) if (row.review_on instanceof Date) row.review_on = row.review_on.toISOString().slice(0,10);
                if (operation === "UPDATE" && data.object_path && faults.loseImageUpdateReply) {
                  faults.loseImageUpdateReply = false; throw new Error("Synthetic reply lost after commit");
                }
                return { data: single ? result.rows[0] ?? null : result.rows, error: null };
              } catch (error) { return { data: null, error }; }
            }).then(resolve, reject);
          },
        };
        return query;
      },
      storage: { from(bucket) {
        if (bucket !== "composer-badge-illustrations") throw Error("FIXTURE_BUCKET");
        return {
          async upload(path, bytes) {
            return asUser(actor, async () => {
              try { await pg.db.query("insert into storage.objects values($1,$2)", [bucket, path]); files.set(path, Buffer.from(bytes)); return { data: { path }, error: null }; }
              catch (error) { return { data: null, error }; }
            });
          },
          async download(path) {
            return asUser(actor, async () => {
              const result = await pg.db.query("select name from storage.objects where bucket_id=$1 and name=$2", [bucket, path]);
              return result.rows.length && files.has(path) ? { data: new Blob([files.get(path)], { type: "image/webp" }), error: null } : { data: null, error: new Error("Denied") };
            });
          },
          async createSignedUrls(paths) {
            return asUser(actor, async () => {
              const result = await pg.db.query("select name from storage.objects where bucket_id=$1 and name=any($2)", [bucket, paths]);
              return { data: result.rows.map(row => { const token = crypto.randomUUID(); tokens.set(token, row.name); return { path: row.name, signedUrl: "/fixture-badge-image/" + token + ".webp" }; }), error: null };
            });
          },
          async remove(paths) {
            return asUser(actor, async () => {
              const result = await pg.db.query("delete from storage.objects where bucket_id=$1 and name=any($2) returning name", [bucket, paths]);
              for (const row of result.rows) files.delete(row.name);
              return { data: [], error: null };
            });
          },
        };
      } },
    };
  }
  const services = new Map();
  const service = actor => {
    if (!services.has(actor)) services.set(actor, new BadgeLibrary(client(actor), actor));
    return services.get(actor);
  };
  const syntheticImage = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 160, g: 130, b: 210, alpha: .6 } } }).webp().toBuffer();
  return { pg, userId, other, client, service, asUser, files, faults, syntheticImage,
    request: (request, kind, actor = userId) => badgeRequest(request, kind, async () => service(actor)),
    signedImage(token) { const path = tokens.get(token); return path ? files.get(path) : undefined; },
  };
}
