import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";

const reactTools = createRequire(process.env.COMPOSER_REACT_TEST_TOOLS ?? new URL("../outputs/l4c-test-tools/package.json", import.meta.url));
const React = reactTools("react");
const jsxRuntime = reactTools("react/jsx-runtime");
const { act, create } = reactTools("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const load = Module._load;
Module._load = function loadTestComponent(name, ...args) {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return jsxRuntime;
  // Exercise the actual data and tab components without a layout engine.
  if (name === "recharts") return new Proxy({}, { get: () => () => null });
  return load.call(this, name, ...args);
};

const { GlobalV2Page } = require("@/features/global-v2/global-v2-page");
const { createGlobalV2FixtureBundle, createGlobalV2FixtureTransport } = require("@/features/global-v2/fixture-data");
const { globalV2PersonaPanelResource } = require("@/query-api/global-v2/persona-panel");
const fixture = createGlobalV2FixtureBundle("contract");
const fixtureTransport = createGlobalV2FixtureTransport(fixture, "contract");
globalThis.window = {
  location: { href: "https://fixture.test/analyse-globale", hash: "" },
  history: { pushState(_state, _title, hash) { window.location.hash = hash; } },
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const requestKey = ({ resource, params }) => params.sectionKey ?? resource;
let root, pending;

async function mount(hash) {
  window.location.hash = hash;
  pending = [];
  const transport = request => new Promise((resolve, reject) => pending.push({ request, resolve, reject }));
  await act(async () => {
    root = create(React.createElement(GlobalV2Page, {
      bundle: { initial: fixture.initial }, transport, certifiedThrough: "2026-07-31",
    }));
  });
}
const requests = () => pending.map(({ request }) => requestKey(request));
const select = id => act(async () => root.root.findByProps({ id: `global-tab-${id}` }).props.onClick());
async function reply(entry) {
  const value = await fixtureTransport(entry.request);
  await act(async () => { entry.resolve(value); });
}

try {
  await mount("");
  assert.deepEqual(requests(), ["OVERVIEW", "EVOLUTION"], "Both Synthèse requests start before either response");
  await reply(pending[1]);
  assert.equal(root.root.findAllByProps({ "aria-label": "Dépenses réelles et niveau habituel sur douze mois" }).length, 1);
  assert.equal(root.root.findAllByProps({ "aria-label": "Chargement de chiffres clés" }).length, 1);
  await reply(pending[0]);

  await select("profils");
  assert.deepEqual(requests(), ["OVERVIEW", "EVOLUTION", globalV2PersonaPanelResource]);
  assert.ok(root.root.findByProps({ "aria-label": "Chargement de Profils" }));
  await reply(pending[2]);
  assert.ok(root.root.findByProps({ id: "profils-title" }));
  await select("synthese");
  await select("profils");
  assert.equal(pending.length, 3, "The pinned visit reuses the profile on re-entry");
  await act(async () => root.unmount());

  await mount("#profils");
  assert.deepEqual(requests(), [globalV2PersonaPanelResource], "A profile deep link skips the Synthèse reads");
  await act(async () => pending[0].reject(new Error("SNAPSHOT_TEMPORARILY_UNAVAILABLE")));
  await act(async () => root.root.findByProps({ role: "alert" }).findByType("button").props.onClick());
  assert.deepEqual(requests(), [globalV2PersonaPanelResource, globalV2PersonaPanelResource]);
  await reply(pending[1]);
  assert.ok(root.root.findByProps({ id: "profils-title" }));
  console.log("PASS: parallel Synthèse, independent loading, lazy Profils, visit reuse, deep link and retry");
} finally {
  await act(async () => root?.unmount());
  Module._load = load;
}
