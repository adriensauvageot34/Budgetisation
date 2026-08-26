import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadCalendarModule(request, parent, isMain) {
  if (request === "server-only") return {};
  if (request.endsWith(".module.css")) return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveCalendarModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const model = require(path.join(repositoryRoot, "src/features/calendar/model.ts"));
const historyPolicy = require(path.join(repositoryRoot, "src/server/bootstrap/history-calendar.ts"));
const query = require(path.join(repositoryRoot, "src/query-api/index.ts"));
const navigation = require(path.join(repositoryRoot, "src/navigation/index.ts"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { CalendarMonth, CalendarWeek } = require(path.join(
  repositoryRoot,
  "src/features/calendar/calendar-view.tsx",
));

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
    markers: [],
    hasDetail: true,
    flags: [],
  };
}

function monthReadModel(month, economicByDate = new Map()) {
  return {
    month,
    timezone: "Europe/Paris",
    subject: { kind: "household" },
    navigation: {},
    summary: { economicAmount: metric("1"), periodCompleteness: "complete" },
    highlights: [],
    spanningEvents: [],
    days: query.listCivilMonthDates(month).map((date) => day(date, economicByDate.get(date) ?? metric("1"))),
    capabilities: capabilities(
      "history_calendar_month",
      ["calendar", "summary"],
      ["economic_consumption_net_attributable", "activity_frequency", "place_visit_count"],
    ),
  };
}

function capabilities(resource, availableSections, availableMeasures) {
  return {
    resource,
    availableSections,
    availableMeasures,
    compatibleFilters: [],
    unavailable: [],
  };
}

const periods = [
  { month: "2026-03-01", isClosed: true, financeStatus: "complete", lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete" },
  { month: "2026-04-01", isClosed: true, financeStatus: "partial", lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete" },
  { month: "2026-05-01", isClosed: false, financeStatus: "complete", lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete" },
  { month: "2026-06-01", isClosed: true, financeStatus: "unknown", lifeStatus: "complete", locationStatus: "complete", calendarStatus: "complete" },
];
const eligible = historyPolicy.eligibleHistoryMonths(periods);
assert.deepEqual(eligible, ["2026-03", "2026-04"]);
assert.equal(historyPolicy.resolveEligibleHistoryMonth("2026-05", eligible), "2026-04");
assert.equal(historyPolicy.resolveEligibleHistoryMonth("2026-01", eligible), "2026-04");
assert.deepEqual(historyPolicy.adjacentEligibleHistoryMonths("2026-04", eligible), { previous: "2026-03" });

const summaries = [];
for (let index = 0; index < 13; index += 1) {
  const month = model.planTwelveMonthSummaries("2026-12").months[index] ?? "2025-12";
  summaries.unshift({
    month,
    timezone: "Europe/Paris",
    subject: { kind: "household" },
    summary: { economicAmount: metric("1"), periodCompleteness: "complete" },
    capabilities: capabilities(
      "history_calendar_month",
      ["calendar", "summary"],
      ["economic_consumption_net_attributable", "activity_frequency", "place_visit_count"],
    ),
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

const participantId = "11111111-1111-4111-8111-111111111111";
const lifeEventId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const ribbonLayout = model.layoutCalendarRibbons("2026-05", [
  { id: "trip", kind: "travel", label: "Voyage", priority: 95, startsOn: "2026-04-30", endsOn: "2026-05-05", participantIds: [participantId], target: { kind: "life_event", id: lifeEventId } },
  { id: "work", kind: "work", label: "Travail", priority: 70, startsOn: "2026-05-04", endsOn: "2026-05-08", participantIds: [participantId], target: { kind: "life_event", id: lifeEventId } },
]);
assert.equal(ribbonLayout.segments.some((segment) => segment.event.id === "trip" && segment.continuesBefore), true);
assert.equal(ribbonLayout.segments.some((segment) => segment.event.id === "trip" && segment.continuesAfter), true);
assert.equal(ribbonLayout.segments.every((segment) => segment.startColumn >= 1 && segment.startColumn + segment.span <= 8), true);

const overflowLayout = model.layoutCalendarRibbons("2026-05", [
  { id: "one", kind: "travel", label: "Un", priority: 3, startsOn: "2026-05-04", endsOn: "2026-05-08", participantIds: [] },
  { id: "two", kind: "family", label: "Deux", priority: 2, startsOn: "2026-05-04", endsOn: "2026-05-08", participantIds: [] },
  { id: "three", kind: "culture", label: "Trois", priority: 1, startsOn: "2026-05-04", endsOn: "2026-05-08", participantIds: [] },
], 2);
assert.equal([...overflowLayout.hiddenByWeek.values()].some((count) => count > 0), true);

const strictMonthFixture = monthReadModel("2026-05");
strictMonthFixture.navigation = { previous: "2026-04" };
strictMonthFixture.highlights = [{ id: "trip", kind: "travel", label: "Voyage", startsOn: "2026-05-02", endsOn: "2026-05-05", participantIds: [participantId], target: { kind: "life_event", id: lifeEventId } }];
strictMonthFixture.spanningEvents = [{ id: "trip", kind: "travel", label: "Voyage", priority: 95, startsOn: "2026-05-02", endsOn: "2026-05-05", participantIds: [participantId], target: { kind: "life_event", id: lifeEventId } }];
strictMonthFixture.days[1].markers = [{ id: "trip", kind: "travel", label: "Voyage", priority: 95, participantIds: [participantId], target: { kind: "life_event", id: lifeEventId } }];
assert.equal(query.parseHistoryCalendarMonthReadModel(strictMonthFixture).highlights.length, 1);

const strictDayFixture = {
  date: "2026-05-02",
  timezone: "Europe/Paris",
  subject: { kind: "household" },
  header: { date: "2026-05-02", observability: "observable", dayContext: { kind: "unknown" }, periodCompleteness: "complete" },
  finance: { economicAmount: metric("12"), lifeScopeBreakdown: { availability: "unknown", entries: [] } },
  contexts: { dayContext: { kind: "unknown" }, lifeScopeSummary: { availability: "unknown", entries: [] }, activitiesPresent: true, placesPresent: false },
  markers: strictMonthFixture.days[1].markers,
  moments: [{
    id: "life-event:trip",
    kind: "travel",
    label: "Voyage",
    startsOn: "2026-05-02",
    endsOn: "2026-05-05",
    participantIds: [participantId],
    operations: [{ operationId, bankDate: "2026-05-02", label: "Train", amount: "12" }],
    target: { kind: "life_event", id: lifeEventId },
  }],
  unlinkedOperations: [],
  capabilities: capabilities(
    "history_day_detail",
    ["header", "finance", "contexts", "journal"],
    ["economic_consumption_net_attributable", "activity_frequency", "place_visit_count", "person_day_count"],
  ),
};
assert.equal(query.parseHistoryDayDetailReadModel(strictDayFixture).moments.length, 1);
assert.throws(() => query.parseHistoryDayDetailReadModel({
  ...strictDayFixture,
  unlinkedOperations: strictDayFixture.moments[0].operations,
}), /à la fois liée et non liée/);

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

const juneOnlyRange = model.calendarWeekRange(
  "2026-06",
  model.calendarWeekRefFor("2026-06-10"),
);
assert.equal(juneOnlyRange.start, "2026-06-08");
assert.equal(juneOnlyRange.end, "2026-06-14");
assert.deepEqual(juneOnlyRange.months, ["2026-06"]);

const juneJulyRange = model.calendarWeekRange(
  "2026-06",
  model.calendarWeekRefFor("2026-06-29"),
);
assert.equal(juneJulyRange.start, "2026-06-29");
assert.equal(juneJulyRange.end, "2026-07-05");
assert.deepEqual(juneJulyRange.months, ["2026-06", "2026-07"]);

const decemberJanuaryRange = model.calendarWeekRange(
  "2026-12",
  model.calendarWeekRefFor("2026-12-31"),
);
assert.equal(decemberJanuaryRange.start, "2026-12-28");
assert.equal(decemberJanuaryRange.end, "2027-01-03");
assert.deepEqual(decemberJanuaryRange.months, ["2026-12", "2027-01"]);

const computationErrorState = {
  status: "error",
  error: {
    code: "COMPUTATION_FAILED",
    message: "Ce résultat n’a pas pu être calculé.",
    retryable: true,
    requestId: "calendar-error-controls",
  },
};
const errorMonthMarkup = renderToStaticMarkup(
  React.createElement(CalendarMonth, {
    month: "2026-04",
    persons: [],
    adjacentMonths: { previous: "2026-03", next: "2026-05" },
    state: computationErrorState,
  }),
);
assert.match(errorMonthMarkup, /Mois précédent/);
assert.match(errorMonthMarkup, /avril 2026/);
assert.match(errorMonthMarkup, /Mois suivant/);
assert.match(errorMonthMarkup, /Ce résultat n’a pas pu être calculé/);
assert.doesNotMatch(errorMonthMarkup, /role="grid"/);

const errorWeekMarkup = renderToStaticMarkup(
  React.createElement(CalendarWeek, {
    month: "2026-05",
    week: model.calendarWeekRefFor("2026-05-01"),
    persons: [],
    state: computationErrorState,
  }),
);
assert.match(errorWeekMarkup, /Semaine précédente/);
assert.match(errorWeekMarkup, /Semaine suivante/);
assert.match(errorWeekMarkup, /Retour au mois/);
assert.match(errorWeekMarkup, /Ce résultat n’a pas pu être calculé/);
assert.doesNotMatch(errorWeekMarkup, /Dépense économique par jour/);

const pushedRoots = [];
let historyState = null;
let activeRoot = { area: "calendar", context: { kind: "calendar_month", month: "2026-07", day: "2026-07-31" } };
const controller = navigation.createNavigationController({
  router: {
    read: () => activeRoot,
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
assert.equal(controller.getSnapshot().history.day, "2026-07-31", "La requête Next ne doit pas être publiée avant son commit");
activeRoot = pushedRoots.at(-1);
assert.equal(controller.reconcileExternalRoot().kind, "applied");
const augustRoot = controller.getSnapshot().history.root;
assert.deepEqual(augustRoot, {
  area: "calendar",
  context: { kind: "calendar_month", month: "2026-08", day: "2026-08-01" },
});
assert.equal(controller.previousDay().kind, "applied");
assert.equal(controller.getSnapshot().history.day, "2026-08-01");
activeRoot = pushedRoots.at(-1);
assert.equal(controller.reconcileExternalRoot().kind, "applied");
assert.equal(controller.getSnapshot().history.day, "2026-07-31");
controller.dispose();

const calendarSourceRoot = path.join(repositoryRoot, "src/features/calendar");
const source = fs.readdirSync(calendarSourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
  .map((entry) => fs.readFileSync(path.join(calendarSourceRoot, entry.name), "utf8"))
  .join("\n");
assert.equal(/\.(?:reduce|groupBy)\s*\(/.test(source), false);
assert.equal(/\b\w*[Aa]mount\s*\?\?\s*0\b/.test(source), false);
assert.doesNotMatch(source, />Activités\s*</);
assert.doesNotMatch(source, />Lieux\s*</);
assert.doesNotMatch(source, />Opérations\s*</);
assert.doesNotMatch(source, /Partiel/);
assert.match(source, /openDay\(day\.date\)/);
assert.match(source, /Journal du jour/);
assert.match(source, /layoutCalendarRibbons/);
assert.match(source, /CalendarIcon/);
assert.match(source, /PersonAvatarCluster/);
assert.match(source, /openExploration/);
assert.match(source, /OverlaySkeleton/);
assert.match(source, /previousData/);

console.log("Calendar / Day targeted checks: PASS");
