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
const { profileBlocks } = require("@/features/global-v2/persona/profile-content");

const subscription = { typicalPayment: null, cadence: null, observedPaymentCount: 0 };
const project = { purchaseCount: 1, grossCost: "10", netCost: "10", netCertifiedByRefundLink: false };
const social = (title) => ({ outingsWithoutPartnerParticipation: [{ eventRef: `event:${title}`, title, date: "2026-06-15", place: null }] });
const ownerFixture = {
  persons: [
    {
      personId: "adrien", socialLife: social("Concert Adrien"),
      work: { workMeals: {}, commute: { directCost: "0" } },
      personalUniverses: { permit: { cost: "10" }, photo: project, musicHeadphones: project, googleAiPro: subscription },
      recurringHabits: { qobuz: subscription, hairdresser: { places: [] }, stylingWax: {} },
    },
    {
      personId: "manon", socialLife: social("Cinéma Manon"),
      work: { workMeals: {}, primaryWorkPlaces: [], professionalInterventions: {} },
      personalUniverses: { products: [], sunoFatherSong: project },
      recurringHabits: { netflix: subscription, max: subscription, vape: {} },
    },
  ],
};
const directProfile = (personId) => ({ personId, daily: [], recurring: [], phases: [] });
const outingTitles = (personId) => profileBlocks(directProfile(personId), ownerFixture).find(({ key }) => key === "outings")?.items.map(({ title }) => title);
assert.deepEqual(outingTitles("manon"), ["Cinéma Manon"]);
assert.deepEqual(outingTitles("adrien"), ["Concert Adrien"]);
assert.equal(outingTitles("autre"), undefined);
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
  const timelineRead = pending.find(({ request }) => request.resource === "analysis_global_life_timeline");
  const timelineReply = await fixtureTransport(timelineRead.request);
  const seed = timelineReply.data.events.at(-1);
  const events = Array.from({ length: 6 }, (_, index) => ({
    ...seed, eventRef: `life-event:fixture-${index}`, canonicalName: `Événement test ${index + 1}`,
  }));
  await act(async () => timelineRead.resolve({ ...timelineReply, data: { ...timelineReply.data, events } }));
  const eventPicker = root.root.findAllByType("select").find(({ props }) =>
    React.Children.toArray(props.children).some((child) => React.isValidElement(child) && child.props.value === events.at(-1).eventRef));
  assert.ok(eventPicker, "All events are reachable by name and date");
  await act(async () => eventPicker.props.onChange({ currentTarget: { value: events.at(-1).eventRef } }));
  assert.equal(root.root.findByProps({ id: "global-detail-title" }).props.children, events.at(-1).canonicalName);
  await click({ "aria-label": "Fermer le détail" });
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
