import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveCalendarModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const model = require(path.join(repositoryRoot, "src/features/calendar/model.ts"));
const query = require(path.join(repositoryRoot, "src/query-api/index.ts"));
const navigation = require(path.join(repositoryRoot, "src/navigation/index.ts"));

function metric(value, availability = "known") {
  return {
    availability,
    value: availability === "known" ? value : null,
    unit: "EUR",
    provenance: "observed",
  };
}

function day(date, economicAmount = metric("1")) {
  return {
    date,
    observability: "observable",
    dayContext: { kind: "unknown" },
    lifeScopeSummary: { availability: "unknown", entries: [] },
    economicAmount,
    hasDetail: true,
    flags: [],
  };
}

function monthReadModel(month, economicByDate = new Map()) {
  return {
    month,
    timezone: "Europe/Paris",
    subject: { kind: "household" },
    summary: { economicAmount: metric("1"), periodCompleteness: "complete" },
    days: query.listCivilMonthDates(month).map((date) => day(date, economicByDate.get(date) ?? metric("1"))),
    capabilities: { available: [] },
  };
}

const summaries = [];
for (let index = 0; index < 13; index += 1) {
  const month = model.planTwelveMonthSummaries("2026-12").months[index] ?? "2025-12";
  summaries.unshift({
    month,
    timezone: "Europe/Paris",
    subject: { kind: "household" },
    summary: { economicAmount: metric("1"), periodCompleteness: "complete" },
    capabilities: { available: [] },
  });
}
summaries.push({
  ...summaries[0],
  month: "2027-01",
  summary: { ...summaries[0].summary, periodCompleteness: "partial" },
});
const selectedMonths = model.selectTwelveCompleteMonthSummaries(summaries);
assert.equal(selectedMonths.length, 12);
assert.deepEqual(selectedMonths.map((entry) => entry.month), [...selectedMonths.map((entry) => entry.month)].sort());
assert.equal(selectedMonths.some((entry) => entry.month === "2027-01"), false);

const mayGrid = model.buildMonthGrid(monthReadModel("2026-05"));
assert.equal(mayGrid.length % 7, 0);
assert.equal(mayGrid.slice(0, 4).every((slot) => slot.kind === "padding" && !("day" in slot)), true);
assert.equal(mayGrid.filter((slot) => slot.kind === "day").length, 31);

const zero = metric("0");
const unknown = metric(null, "unknown");
const april = monthReadModel("2026-04", new Map([["2026-04-30", zero]]));
const may = monthReadModel("2026-05", new Map([["2026-05-01", unknown]]));
const weekRef = model.calendarWeekRefFor("2026-04-30");
const week = model.selectCalendarWeek("2026-04", weekRef, [april, may]);
assert.equal(week.days.length, 7);
assert.equal(week.days[0].date, "2026-04-27");
assert.equal(week.days[6].date, "2026-05-03");
assert.deepEqual(week.resourcePlan.months, ["2026-04", "2026-05"]);
assert.equal(week.resourcePlan.months.length <= 2, true);
assert.equal(week.days[3].economicAmount, zero);
assert.equal(week.days[4].economicAmount, unknown);
assert.notEqual(week.days[4].economicAmount.availability, "known");

const pushedRoots = [];
let historyState = null;
const controller = navigation.createNavigationController({
  router: {
    read: () => ({ area: "calendar", context: { kind: "calendar_month", month: "2026-07", day: "2026-07-31" } }),
    push: (root) => pushedRoots.push(root),
    replace: () => undefined,
  },
  history: {
    get state() { return historyState; },
    push: (state) => { historyState = state; },
    replace: (state) => { historyState = state; },
    back: () => undefined,
    forward: () => undefined,
    subscribe: () => () => undefined,
  },
  session: new navigation.InMemoryNavigationSessionStore(),
  surface: {
    activateRoute: () => undefined,
    readScope: () => null,
    applyScope: () => undefined,
    readSubview: () => null,
    applySubview: () => undefined,
  },
  restoration: { cancel: () => undefined, restore: async () => ({ kind: "top", scrollY: 0 }) },
  readiness: { activateRoute: () => undefined, wait: async () => ({ kind: "ready" }) },
  scroll: {
    getScrollY: () => 0,
    scrollTo: () => undefined,
    getAnchorTop: () => 0,
  },
  compatibility: { categoryIds: true, activityIds: true, merchantIds: true, placeIds: true, lifeScopeContext: true, dayContext: true },
});
assert.equal(controller.start().kind, "applied");
assert.equal(controller.nextDay().kind, "applied");
const augustRoot = controller.getSnapshot().history.root;
assert.deepEqual(augustRoot, {
  area: "calendar",
  context: { kind: "calendar_month", month: "2026-08", day: "2026-08-01" },
});
assert.equal(controller.previousDay().kind, "applied");
assert.equal(controller.getSnapshot().history.day, "2026-07-31");
controller.dispose();

const calendarSourceRoot = path.join(repositoryRoot, "src/features/calendar");
const source = fs.readdirSync(calendarSourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
  .map((entry) => fs.readFileSync(path.join(calendarSourceRoot, entry.name), "utf8"))
  .join("\n");
assert.equal(/\.(?:reduce|groupBy)\s*\(/.test(source), false);
assert.equal(/\b\w*[Aa]mount\s*\?\?\s*0\b/.test(source), false);
assert.match(source, /operationCount/);
assert.match(source, /activityOccurrenceCount/);
assert.match(source, /placeVisitCount/);
assert.match(source, /openDay\(day\.date\)/);
assert.match(source, /history_day_detail/);
assert.match(source, /openExploration/);
assert.match(source, /OverlaySkeleton/);
assert.match(source, /previousData/);

console.log("Calendar / Day targeted checks: PASS");
