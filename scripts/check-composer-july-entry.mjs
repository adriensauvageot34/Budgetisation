import assert from "node:assert/strict";
import Module from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";

const month = "2026-07";
const cardId = "event-restaurant";
const source = { month, cards: [{ id: cardId, section: "events", payments: [] }] };
const pilotCardId = `${cardId}-pilot-confirmed`;
const calls = [];
const model = {};
function JulyPilotMonth() {}
function ComposerEditor() {}
function ArchivedRealizedMonth() {}

const mocks = {
  "@/app/product-query": { withProductAuthentication: work => work() },
  "@/server/bootstrap/context": {
    getBootstrapSession: async () => ({ context: { household: {} }, session: { supabase: {} } }),
  },
  "@/server/phase2/month-source-cache": { createMonthSourceCache: () => ({}) },
  "@/server/phase2/planner/cutover": { plannerComposerEnabled: () => true },
  "@/server/phase2/planner/runtime": {
    authorizedPlanner: async () => { calls.push("planner"); return {}; },
  },
  "@/server/phase2/planner/composer-draft-cutover": { composerDraftAutosaveEnabledFor: () => true },
  "@/server/phase2/planner/composer-draft-service": {
    readComposerDrafts: async () => { calls.push("drafts"); return null; },
  },
  "@/server/phase2/planner/composer-opening": {
    readComposerOpening: async (_deps, _householdId, _month, readDrafts) => ({ model, drafts: await readDrafts() }),
  },
  "@/server/phase2/planner/read-model": {},
  "@/server/phase2/planner/composer-service": {},
  "@/server/phase2/planner/reconstruct-july-draft": {},
  "@/server/phase2/planner/snapshot-observation": { observeSnapshot: async work => ({ value: await work() }) },
  "@/server/phase2/planner/realized-month": {
    readRealizedMonth: async () => { calls.push("realized"); return source; },
  },
  "@/server/phase2/planner/realized-snapshots": {},
  "@/server/phase2/planner/july-pilot": {
    projectJulyPilot: board => ({ ...board, cards: [{ id: pilotCardId, pilotSourceId: cardId }] }),
  },
  "./actions": {},
  "./archived-realized-month": { ArchivedRealizedMonth },
  "./july-pilot-month": { JulyPilotMonth },
  "./composer-editor": { ComposerEditor },
};

const load = Module._load;
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith("composer/page.tsx") || parent?.filename.endsWith("composer\\page.tsx")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
  }
  return load.call(this, name, parent, ...args);
};

try {
  const { default: page } = require("@/app/mois-a-venir/composer/page");
  const { reconstructedId } = require("@/domain/phase2/planner/realized-month-entry");
  const read = await page({ searchParams: Promise.resolve({ month, carte: pilotCardId, statut: "confirmed" }) });
  assert.equal(read.type, JulyPilotMonth);
  assert.equal(read.props.initialCardId, pilotCardId);
  assert.equal(read.props.initialStatus, "confirmed");
  assert.deepEqual(read.props.editableSourceIds, [cardId]);
  assert.deepEqual(calls.splice(0), ["realized"]);

  const edit = await page({ searchParams: Promise.resolve({ month, view: "edition", carte: cardId }) });
  const editor = edit.props.children[0];
  assert.equal(editor.type, ComposerEditor);
  assert.equal(editor.props.initialModel, model);
  assert.equal(editor.props.initialEditCard, reconstructedId(month, cardId));
  assert.deepEqual(calls.splice(0).sort(), ["drafts", "planner", "realized"]);

  const balance = await page({ searchParams: Promise.resolve({ month, view: "bilan" }) });
  assert.equal(balance.type, ArchivedRealizedMonth);
  assert.deepEqual(calls, ["realized"]);
} finally {
  Module._load = load;
}
console.log("PASS: July consultation, direct edit link, and full realized view.");
