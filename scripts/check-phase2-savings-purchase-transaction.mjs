import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const [household, stranger, batch, payment, goal, line] = [1, 2, 3, 4, 5, 6].map(uuid);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema private;
    create function private.user_has_household_access(uuid) returns boolean
      language sql stable as 'select false';
    create table households(household_id uuid primary key);
    create table import_batches(import_batch_id uuid primary key, household_id uuid);
    create table operations(operation_id uuid primary key, import_batch_id uuid, montant numeric,
      date_bancaire date, marchand text, libelle_bancaire text, flux text);
    create table canonical_household_scope_control(status text, household_id uuid);
    grant usage on schema private to service_role;
    grant select on operations, import_batches, canonical_household_scope_control to service_role;
  `);
  for (const file of [
    "20261126092641_phase2_savings_goals",
    "20261126104724_phase2_savings_purchases",
    "20261126121039_phase2_savings_purchase_items",
    "20261126133443_phase2_savings_progress",
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), "utf8"));

  await db.query("insert into households values ($1), ($2)", [household, stranger]);
  await db.query("insert into import_batches values ($1, $2)", [batch, household]);
  await db.query("insert into operations values ($1, $2, -80, '2026-12-02', 'Marchand', 'Débit', 'Dépense')", [payment, batch]);
  await db.query("insert into phase2_savings_goals (household_id, goal_id, project, label, target_cents, allocations) values ($1, $2, 'christmas', 'Cadeau', 10000, $3::jsonb)",
    [household, goal, JSON.stringify([{ id: uuid(7), month: "2026-11", cents: 5000, status: "saved", accounted: true }])]);

  const initial = [{ id: line, goalId: goal, article: "Cadeau", recipient: null, grossCents: 6000, refundedCents: 0, livretCents: 4000 }];
  const call = (previous, items, owner = household) => db.query("select set_phase2_savings_purchase_items($1,$2,$3::jsonb,$4::jsonb)",
    [owner, payment, JSON.stringify(previous), JSON.stringify(items)]);
  const error = (code, message) => reason => reason.code === code && (!message || reason.message === message);
  await db.exec("set role authenticated");
  await assert.rejects(call([], initial), error("42501"));
  await db.exec("set role service_role");
  await assert.rejects(call([], initial, stranger), error("22023", "PURCHASE_UNAVAILABLE"));
  await assert.rejects(call([], [{ ...initial[0], grossCents: 8001 }]), error("23514", "PAYMENT_EXCEEDED"));
  await assert.rejects(call([], [{ ...initial[0], livretCents: 5001 }]), error("23514", "LIVRET_EXCEEDED"));
  assert.equal((await db.query("select count(*)::integer as n from phase2_savings_purchase_lines")).rows[0].n, 0);

  // Simulate two clients submitting from the same original snapshot and an identical retry.
  const second = [{ ...initial[0], article: "Autre cadeau" }];
  await call([], initial);
  await assert.rejects(call([], second), error("40001", "PURCHASE_CHANGED"));
  await call([], initial);
  assert.equal((await db.query("select revision from phase2_savings_goals")).rows[0].revision, 2);

  await call(initial, [{ ...initial[0], refundedCents: 2500 }]);
  const { rows } = await db.query(`
    select p.cents, p.gross_cents, g.revision,
      private.savings_livret_available(g.household_id, g.goal_id, g.allocations)::integer as livret
    from phase2_savings_purchase_lines p join phase2_savings_goals g using (goal_id)
  `);
  assert.deepEqual(rows, [{ cents: 3500, gross_cents: 6000, revision: 3, livret: 1500 }]);
  console.log("PASS SAVINGS TRANSACTION: permissions, household, payment limit, livret rollback, stale edit, retry and refund");
} finally {
  await db.close();
}
