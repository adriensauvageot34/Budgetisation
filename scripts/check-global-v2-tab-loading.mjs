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
  // Exercise the actual dashboard and detail components without a layout engine.
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
globalThis.document = { activeElement: null };
globalThis.HTMLElement = class HTMLElement {};
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
const click = (props) => act(async () => root.root.findByProps(props).props.onClick());
async function reply(entry) {
  const value = await fixtureTransport(entry.request);
  await act(async () => { entry.resolve(value); });
}

try {
  await mount("");
  assert.deepEqual(requests(), ["OVERVIEW", "EVOLUTION"], "Both financial reads start together");
  assert.equal(root.root.findAllByProps({ role: "tablist" }).length, 0);
  assert.deepEqual(root.root.findAllByType("h2").map(({ props }) => props.id), ["economie-title", "categories-title", "rythmes-title", "profils-title"]);
  await reply(pending[1]);
  assert.equal(root.root.findAllByProps({ "aria-label": "Dépenses réelles et niveau habituel sur douze mois" }).length, 1);
  assert.equal(root.root.findAllByProps({ "aria-label": "Chargement de chiffres clés" }).length, 1);
  await reply(pending[0]);
  await reply(pending.find(({ request }) => request.params.sectionKey === "BREAKDOWN"));
  await reply(pending.find(({ request }) => request.resource === "analysis_global_life_timeline"));
  assert.ok(!requests().includes(globalV2PersonaPanelResource), "Portraits do not trigger a profile read");

  const selectPortrait = () => act(async () => {
    const portrait = root.root.findAllByType("button").find(({ props }) => props.children?.[1]?.props?.children?.[0]?.props?.children === "Adrien");
    assert.ok(portrait);
    portrait.props.onClick();
  });
  await selectPortrait();
  assert.equal(requests().at(-1), globalV2PersonaPanelResource);
  assert.ok(root.root.findByProps({ "aria-label": "Chargement de Profils" }));
  await reply(pending.at(-1));
  await click({ "aria-label": "Fermer le détail" });
  const completed = pending.length;
  await selectPortrait();
  assert.equal(pending.length, completed, "The pinned visit reuses profile data on re-entry");
  await act(async () => root.unmount());

  await mount("#profils");
  await reply(pending[0]);
  await reply(pending[1]);
  const profileRead = pending.find(({ request }) => request.resource === globalV2PersonaPanelResource);
  assert.ok(profileRead, "The profile deep link opens its inline detail");
  await act(async () => profileRead.reject(new Error("SNAPSHOT_TEMPORARILY_UNAVAILABLE")));
  await act(async () => root.root.findByProps({ role: "alert" }).findByType("button").props.onClick());
  await reply(pending.find(({ request }) => request.params.sectionKey === "BREAKDOWN"));
  await reply(pending.find(({ request }) => request.resource === "analysis_global_life_timeline"));
  assert.equal(requests().filter((key) => key === globalV2PersonaPanelResource).length, 2);
  console.log("PASS: concurrent financial reads, fixed headings, lazy profiles, visit reuse, deep link and retry");
} finally {
  await act(async () => root?.unmount());
  Module._load = load;
}
