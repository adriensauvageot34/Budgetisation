import assert from "node:assert/strict";
import fs from "node:fs";
import { require } from "./lib/phase2-ts-loader.mjs";
import { createKernelPostgres } from "./lib/planner-kernel-postgres.mjs";
import { fixture, state, uuid, householdId } from "./fixtures/planner-headless.mjs";
import { userId } from "./fixtures/planner-kernel.mjs";

const { handleComposerRequest } = require("@/server/phase2/planner/composer-service");
const { readMonthComposer } = require("@/server/phase2/planner/read-model");
const { createPlanApplyRepository } = require("@/server/phase2/planner/repository");
const { saveComposerDraft, readComposerDrafts } = require("@/server/phase2/planner/composer-draft-service");
const { manifestContextRegistry } = require("@/server/phase2/planner/context-registry");
const { semanticStateDigest } = require("@/domain/phase2/planner/semantic-state");
const { plannerDigest } = require("@/domain/phase2/planner/json");
const { stageLocalDecision } = require("@/app/mois-a-venir/composer/local-draft");
const { purchaseSuggestions } = require("@/app/mois-a-venir/composer/purchase-suggestions");
const { componentId } = require("@/domain/phase2/planner/identity");
const collection = JSON.parse(fs.readFileSync("public/planned-visuals/builder/clay/v22/collection.json", "utf8"));
const concept = label => {
  const entry = collection.entries.find(item => item.label === label && item.discovery.sourceRow);
  assert.ok(entry, label);
  return { id: entry.visualConceptId, label };
};
const pg = await createKernelPostgres();
const world = fixture();
const deps = { repository: createPlanApplyRepository(pg.client), readWorld: async () => world, householdPersons: [] };
let draft = state(), model, sequence = 0;
const month = "2026-11";
const context = id => draft.contexts.find(item => item.contextOccurrenceId === id);
const card = id => model.board.contexts.find(item => item.contextOccurrenceId === id);
const call = operation => handleComposerRequest(deps, householdId, { sequence: ++sequence, targetMonth: month, draft, ...operation });
async function apply(operation) {
  const response = await call(operation);
  assert.equal(response.ok, true, JSON.stringify(response));
  model = response.model;
  draft = model.semanticState;
}
const create = (id, presetKey, basket = false) => apply({ kind: "DROP", assetKey: "template:purchase",
  target: { kind: "BOARD_ZONE" }, identity: id, selectionId: crypto.randomUUID(), values: {}, presetKey, ...(basket ? { purchaseBasket: true } : {}) });
const operation = (id, change) => ({ kind: "EDIT_PURCHASE_BASKET", edit: { contextOccurrenceId: id,
  expectedContextDigest: plannerDigest(context(id)), change } });
const edit = (id, change) => apply(operation(id, change));
const article = (id, selectionId, label, quantity, price, unit = "UNIT", ref = concept(label)) =>
  edit(id, { kind: "SAVE_ITEM", selectionId, label, quantity, price, unit, concept: ref });
const ids = id => context(id).slotSelections.item.items.map(item => item.selectionId);
const summary = id => card(id).purchaseSummary;
const suggestions = id => purchaseSuggestions(context(id), card(id), model);

try {
  const amazon = uuid(21001), mascara = uuid(21002), shampoo = uuid(21003), shirt = uuid(21004), fee = uuid(21005);
  await apply({ kind: "READ" });
  const initial = model;
  await create(amazon, "amazon-purchase", true);
  assert(suggestions(amazon).some(candidate => candidate.kind === "ADD"));
  assert(!suggestions(amazon).some(candidate => candidate.kind === "ITEM"));
  const first = operation(amazon, { kind: "SAVE_ITEM", selectionId: mascara, label: "Mascara", quantity: "1", price: "12", unit: "UNIT", concept: concept("Mascara") });
  assert.ok(stageLocalDecision(initial, draft, first), "Un premier article peut être conservé avant le retour de la projection");
  await article(amazon, mascara, "Mascara", "1", "12");
  await article(amazon, shampoo, "Shampoing", "2", "8");
  await article(amazon, shirt, "T-shirt", "1", "20");
  assert.deepEqual(ids(amazon), [mascara, shampoo, shirt]);
  assert.deepEqual(summary(amazon), { articleCount: 3, knownAmount: "48.00", complete: false });
  await edit(amazon, { kind: "SET_DELIVERY", mode: "DELIVERY", coverage: "INCLUDED" });
  assert.deepEqual(summary(amazon), { articleCount: 3, knownAmount: "48.00", complete: true });
  assert.equal(suggestions(amazon).find(candidate => candidate.kind === "DELIVERY").hint, "Livraison comprise");
  assert.equal(context(amazon).slotSelections.shipping.items.length, 0);
  await edit(amazon, { kind: "SET_DELIVERY", mode: "DELIVERY", coverage: "ADDITIONAL", selectionId: fee, price: "5" });
  assert.equal(summary(amazon).knownAmount, "53.00");
  assert.deepEqual(suggestions(amazon).find(candidate => candidate.kind === "DELIVERY").selectionIds, [fee]);
  const stale = operation(amazon, { kind: "REMOVE_ITEM", selectionId: shirt });
  await article(amazon, shampoo, "Shampoing", "2", "9");
  assert.deepEqual(ids(amazon), [mascara, shampoo, shirt]);
  assert.equal(summary(amazon).knownAmount, "55.00");
  assert.equal(context(amazon).slotSelections.item.items[1].quantity, "2");
  const refused = await call(stale);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "PURCHASE_BASKET_CHANGED");
  await edit(amazon, { kind: "REMOVE_ITEM", selectionId: mascara });
  assert.deepEqual(ids(amazon), [shampoo, shirt]);
  assert.equal(context(amazon).slotSelections.shipping.items[0].selectionId, fee);
  assert.equal(context(amazon).fields.merchantLabel, "Amazon");
  await article(amazon, uuid(21006), "Shampoing", "1", "");
  const homonyms = suggestions(amazon).find(candidate => candidate.kind === "CHOOSE_ITEM");
  assert.deepEqual(homonyms.selectionIds, [shampoo, uuid(21006)]);
  const protectedModel = { ...model, semanticState: { ...draft,
    preferences: { ...draft.preferences, anchors: [componentId(amazon, "item", shampoo), componentId(amazon, "item", uuid(21006))] } } };
  assert(!purchaseSuggestions(context(amazon), card(amazon), protectedModel).some(candidate => candidate.kind === "CHOOSE_ITEM"));
  const withoutShipping = { ...card(amazon), sockets: card(amazon).sockets.filter(socket => socket.slotKey !== "shipping") };
  assert(!purchaseSuggestions(context(amazon), withoutShipping, model).some(candidate => candidate.kind === "DELIVERY"));
  assert.equal(summary(amazon).knownAmount, "43.00");
  assert.equal(summary(amazon).complete, false);
  await edit(amazon, { kind: "SAVE_ITEM", selectionId: uuid(21007), label: "Pack de six bouteilles", quantity: "1", price: "10", unit: "PACK" });
  await edit(amazon, { kind: "SAVE_ITEM", selectionId: uuid(21008), label: "Produit au poids", quantity: "1,5", price: "4", unit: "KG" });
  assert.equal(summary(amazon).knownAmount, "59.00");
  assert.equal(context(amazon).slotSelections.item.items.at(-1).basketArticle.unit, "KG");
  await edit(amazon, { kind: "SAVE_EXTRA", selectionId: uuid(21017), label: "Emballage cadeau", price: "2" });
  assert.equal(summary(amazon).knownAmount, "61.00");
  await edit(amazon, { kind: "REMOVE_EXTRA", selectionId: uuid(21017) });
  assert.equal(summary(amazon).knownAmount, "59.00");
  console.log("Panier Amazon, lignes homonymes, prix et frais : PASS");

  const historical = uuid(21009), legacyLine = uuid(21010);
  await create(historical, "shein-purchase");
  await apply({ kind: "EDIT_PRESET_CONTEXT", edit: { contextOccurrenceId: historical, slots: { item: [{
    kind: "COMPONENT", optionKey: "item", selectionId: legacyLine, label: "Vêtement historique", quantity: "1",
    cost: { kind: "MANUAL", unitAmount: "19" }, provenance: "EXPLICIT_USER_DECISION",
  }] } } });
  const oldItem = structuredClone(context(historical).slotSelections.item.items[0]);
  const oldState = { ...draft, contexts: [context(historical)] };
  assert.notEqual(manifestContextRegistry(oldState).version, manifestContextRegistry(draft).version);
  assert.equal(card(historical).sockets.find(socket => socket.slotKey === "item").cardinality, "REQUIRED_ONE");
  await edit(historical, { kind: "UPGRADE" });
  assert.deepEqual(context(historical).slotSelections.item.items[0], oldItem);
  assert.equal(card(historical).sockets.find(socket => socket.slotKey === "item").cardinality, "REPEATING");
  console.log("Compatibilité historique et passage explicite : PASS");

  const clothing = uuid(21101), tee1 = uuid(21102), jeans = uuid(21103), tee2 = uuid(21104);
  await create(clothing, "clothing-shopping", true);
  assert.match(suggestions(clothing).find(candidate => candidate.kind === "ADD").label, /vêtement/);
  await article(clothing, tee1, "T-shirt noir", "2", "8", "UNIT", concept("T-shirt"));
  await edit(clothing, { kind: "SAVE_ITEM", selectionId: jeans, label: "Jean", quantity: "1", price: "20", unit: "UNIT" });
  await article(clothing, tee2, "T-shirt noir", "1", "", "UNIT", concept("T-shirt"));
  assert.deepEqual(suggestions(clothing).find(candidate => candidate.kind === "CHOOSE_ITEM").selectionIds, [tee1, tee2]);
  const beforeClothing = structuredClone(context(clothing).slotSelections.item.items);
  await article(clothing, tee2, "T-shirt noir", "1", "5", "UNIT", concept("T-shirt"));
  assert.deepEqual(context(clothing).slotSelections.item.items.slice(0, 2), beforeClothing.slice(0, 2));
  assert.equal(summary(clothing).knownAmount, "41.00");
  await edit(clothing, { kind: "REMOVE_ITEM", selectionId: tee2 });
  assert.deepEqual(context(clothing).slotSelections.item.items, beforeClothing.slice(0, 2));
  assert.equal(summary(clothing).knownAmount, "36.00");
  console.log("Vêtements, prix inconnu et édition/retrait ciblés : PASS");

  const groceries = uuid(21012), pastas = uuid(21013), milk = uuid(21014), bread = uuid(21015);
  const groceriesSlot = world.baseline.slots.find(slot => slot.semanticKey === "groceries");
  assert.ok(groceriesSlot);
  const budgetBefore = draft.controls;
  await create(groceries, "groceries-purchase");
  assert.equal(suggestions(groceries).find(candidate => candidate.kind === "ADD").label, "Ajouter le premier produit");
  await article(groceries, pastas, "Pâtes alimentaires", "2", "1,50");
  await article(groceries, milk, "Lait", "3", "1,20");
  await article(groceries, bread, "Pain", "1", "1,40");
  assert.equal(summary(groceries).knownAmount, "8.00");
  const effects = async () => {
    const { preview: { compiled } } = await readMonthComposer(deps, householdId, month, draft);
    const lines = new Set(compiled.components.filter(line => line.contextOccurrenceId === groceries).map(line => line.componentId));
    return compiled.contextualEffects.filter(effect => lines.has(effect.componentId));
  };
  assert.ok((await effects()).every(effect => effect.slotRelation === "UNRESOLVED"));
  await edit(groceries, { kind: "SET_DETAILS", merchant: "Épicerie de recette", date: "", coverage: "CONFIRMED_CONSUMPTION" });
  const covered = await effects();
  assert.ok(covered.length === 3 && covered.every(effect => effect.slotRelation === "CONSUMES_SLOT" && Number(effect.incrementalAmount) === 0));
  assert.deepEqual(draft.controls, budgetBefore);
  await edit(groceries, { kind: "SET_DETAILS", merchant: "Épicerie de recette", date: "", coverage: "EXTRA_TO_SLOT" });
  const independent = await effects();
  assert.ok(independent.length === 3 && independent.every(effect => effect.slotRelation === "EXTRA_TO_SLOT"));
  assert.equal(summary(groceries).knownAmount, "8.00");
  const secondMilk = uuid(21018);
  await article(groceries, secondMilk, "Lait", "1", "");
  assert.deepEqual(suggestions(groceries).find(candidate => candidate.kind === "CHOOSE_ITEM").selectionIds, [milk, secondMilk]);
  assert.equal(summary(groceries).knownAmount, "8.00");
  await edit(groceries, { kind: "REMOVE_ITEM", selectionId: secondMilk });
  assert.deepEqual(ids(groceries), [pastas, milk, bread]);
  const rejected = await call(operation(groceries, { kind: "SAVE_ITEM", selectionId: uuid(21016), label: "Verre de vin",
    quantity: "1", price: "5", unit: "UNIT", concept: concept("Verre de vin") }));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "PURCHASE_BASKET_CONCEPT_NOT_ADMITTED");
  console.log("Courses, références du catalogue et couverture du Compiler : PASS");

  await pg.db.exec("reset role; alter table auth.users add column raw_app_meta_data jsonb");
  for (const file of ["20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql", "20261011150830_p07_composer_draft_access_v2.sql"])
    await pg.db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  await pg.db.exec("update private.phase2_composer_draft_access set enabled_for_all=true; set role authenticated");
  const supabase = {
    from(table) {
      assert.ok(["phase2_composer_drafts", "phase2_month_plans"].includes(table));
      const filters = [];
      const query = { select() { return query; }, eq(key, value) { assert.match(key, /^[a-z_]+$/u); filters.push([key, value]); return query; },
        order() { return query; }, abortSignal() { return query; }, maybeSingle() { query.single = true; return query; },
        then(resolve, reject) {
          return pg.db.query(`select to_jsonb(t) as row from public.${table} t where ${filters.map(([key], i) => key + "=$" + (i + 1)).join(" and ")}`,
            filters.map(([, value]) => value)).then(result => ({ data: query.single ? result.rows[0]?.row ?? null : result.rows.map(row => row.row), error: null }),
            error => ({ data: null, error })).then(resolve, reject);
        } };
      return query;
    },
    rpc(name, args) {
      assert.equal(name, "save_phase2_composer_draft_v2");
      const keys = ["household_id", "target_month", "expected_draft_id", "expected_draft_version", "save_request_id",
        "base_plan_id", "base_plan_revision_id", "base_plan_revision_number", "semantic_state", "semantic_state_digest"];
      return { abortSignal() { return this; }, then(resolve, reject) {
        return pg.db.query(`select public.save_phase2_composer_draft_v2(${keys.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
          keys.map(key => key === "semantic_state" ? JSON.stringify(args["p_" + key]) : args["p_" + key]))
          .then(result => ({ data: result.rows[0].result, error: null }), error => ({ data: null, error })).then(resolve, reject);
      } };
    },
  };
  const scope = { supabase, userId, householdId };
  const command = { targetMonth: month, semanticState: draft, digest: semanticStateDigest(draft), requestId: crypto.randomUUID(),
    expectedDraftId: null, expectedDraftVersion: 0, expectedBaseRevisionId: null, expectedBaseRevisionNumber: 0 };
  const saved = await saveComposerDraft(scope, command);
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const reloaded = (await readComposerDrafts(scope, month)).active;
  assert.equal(reloaded.version, 1);
  assert.equal(reloaded.digest, command.digest);
  assert.deepEqual(reloaded.semanticState, draft);
  assert.deepEqual(await pg.counts(), { plans: 0, revisions: 0 });
  await pg.verifyCanaries();
  console.log("Save et Reload SQL isolés, identités et ordre intacts : PASS");
} finally { await pg.close(); }
