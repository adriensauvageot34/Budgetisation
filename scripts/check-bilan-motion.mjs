import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";

const reactTools = createRequire(process.env.COMPOSER_REACT_TEST_TOOLS ?? new URL("../outputs/l4c-test-tools/package.json", import.meta.url));
const React = reactTools("react");
const jsxRuntime = reactTools("react/jsx-runtime");
const { act, create } = reactTools("react-test-renderer");
const load = Module._load;
Module._load = function loadFixture(name, ...args) {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name === "next/link") return "a";
  return load.call(this, name, ...args);
};

const { DailySpendingTrend, MonthTimeline } = require("@/features/history-v2/balance-dashboard-charts");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = {
  location: new URL("https://fixture.test/bilan?month=2026-06&journal=2026-06-02"),
  history: { replaceState(_state, _title, url) { window.location = new URL(url); } },
};
const known = value => ({ status: "KNOWN", value });
const reference = { publicationId: "fixture", revision: 1, factsHash: "fixture" };
const series = Promise.resolve({ publicationMeta: reference, days: [
  { date: "2026-06-01", total: known("450"), withoutFixed: known("100") },
  { date: "2026-06-02", total: known("200"), withoutFixed: known("200") },
  { date: "2026-06-03", total: known("-50"), withoutFixed: known("-50") },
  { date: "2026-06-04" },
] });
const opened = [];
const previewed = [];
let chart, timeline;

try {
  await act(async () => {
    chart = create(React.createElement(DailySpendingTrend, {
      series, reference, activeDate: "2026-06-02", linked: true,
      onInspect: date => opened.push(date), onPreview: date => previewed.push(date),
    }));
  });
  const day = index => chart.root.findByProps({ "data-index": index });
  const height = index => day(index).findByType("i").props.style["--daily-height"];
  const zero = () => chart.root.findByProps({ className: "dailyPlot" }).props.style["--daily-zero"];
  const firstHeight = height(0);
  const unchangedHeight = height(1);
  const baseline = zero();
  assert.equal(day(1).props["aria-expanded"], true);
  assert.equal(day(1).props["data-linked"], true);
  assert.match(day(3).props["aria-label"], /indisponible/);
  await act(async () => chart.root.findByProps({ "data-mode": "withoutFixed" }).findAllByType("button")[1].props.onClick());
  assert.notEqual(height(0), firstHeight);
  assert.equal(height(1), unchangedHeight);
  assert.equal(zero(), baseline);
  assert.equal(day(1).props["aria-expanded"], true);
  assert.equal(window.location.searchParams.get("journal"), "2026-06-02");
  assert.equal(window.location.searchParams.get("charges"), "toutes");
  await act(async () => day(0).props.onPointerEnter({ pointerType: "mouse" }));
  assert.equal(previewed.at(-1), "2026-06-01");
  assert.equal(day(1).props["aria-expanded"], true);
  await act(async () => day(0).props.onClick());
  assert.deepEqual(opened, ["2026-06-01"]);

  const moments = [
    { momentId: "a", title: "Sortie", startDate: "2026-06-05" },
    { momentId: "b", title: "Séjour", startDate: "2026-06-05", endDate: "2026-06-07" },
  ];
  await act(async () => {
    timeline = create(React.createElement(MonthTimeline, { month: "2026-06", moments, activeId: "b", previewId: "b",
      linkedIds: new Set(["b"]), onPreview: () => {}, onOpen: moment => opened.push(moment.momentId),
    }));
  });
  const group = timeline.root.findByProps({ "data-multiple": true });
  assert.equal(group.props["data-linked"], true);
  assert.equal(group.props["aria-expanded"], false);
  assert.equal(timeline.root.findByProps({ className: "timelineSpan" }).props["data-current"], true);
  await act(async () => group.props.onClick({ currentTarget: {} }));
  const choices = timeline.root.findByProps({ className: "timelineChoices" }).findAllByType("button");
  assert.deepEqual(choices.map(choice => choice.children[0]), ["Sortie", "Séjour"]);
  await act(async () => choices[1].props.onClick());
  assert.equal(opened.at(-1), "b");
  console.log("PASS: échelle commune, sélection et aperçu du jour, événements groupés et intervalle actif");
} finally {
  await act(async () => { chart?.unmount(); timeline?.unmount(); });
  Module._load = load;
}
