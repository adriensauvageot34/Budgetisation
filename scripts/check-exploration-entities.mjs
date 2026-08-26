import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveExplorationModule(request, parent, isMain, options) {
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

const navigation = require(path.join(repositoryRoot, "src/navigation/index.ts"));
const query = require(path.join(repositoryRoot, "src/query-api/index.ts"));
const explorationTypes = require(path.join(repositoryRoot, "src/features/exploration/types.ts"));
const { normalizeAnalysisScope } = require(path.join(repositoryRoot, "src/core/scope/index.ts"));

const entries = [];
let entryIndex = -1;
let historyListener = null;
const history = {
  get state() {
    return entryIndex < 0 ? null : entries[entryIndex];
  },
  push(state) {
    entries.splice(entryIndex + 1);
    entries.push(state);
    entryIndex += 1;
  },
  replace(state) {
    if (entryIndex < 0) {
      entries.push(state);
      entryIndex = 0;
      return;
    }
    entries[entryIndex] = state;
  },
  back() {
    if (entryIndex <= 0) return;
    entryIndex -= 1;
    historyListener?.(entries[entryIndex]);
  },
  forward() {
    if (entryIndex >= entries.length - 1) return;
    entryIndex += 1;
    historyListener?.(entries[entryIndex]);
  },
  subscribe(listener) {
    historyListener = listener;
    return () => {
      historyListener = null;
    };
  },
};

const root = {
  area: "calendar",
  context: { kind: "calendar_month", month: "2026-08", day: "2026-08-23" },
};
let rootRouteRequests = 0;
const controller = navigation.createNavigationController({
  router: {
    read: () => root,
    push: () => { rootRouteRequests += 1; },
    replace: () => { rootRouteRequests += 1; },
  },
  history,
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
    getScrollY: () => 120,
    scrollTo: () => undefined,
    getAnchorTop: () => 0,
  },
  compatibility: { categoryIds: true, activityIds: true, merchantIds: true, placeIds: true, lifeScopeContext: true, dayContext: true },
});

assert.equal(controller.start().kind, "applied");
const nextState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["root"] };
const mergedState = navigation.mergeBudgetisationHistoryState(nextState, controller.getSnapshot().history);
assert.equal(mergedState.__NA, true);
assert.deepEqual(mergedState.__PRIVATE_NEXTJS_INTERNALS_TREE, ["root"]);
assert.deepEqual(navigation.extractBudgetisationHistoryState(mergedState), controller.getSnapshot().history);
assert.equal(navigation.resolveNavigationHistoryState(navigation.extractBudgetisationHistoryState(mergedState), []).kind, "restore");
assert.equal(controller.openExploration({ kind: "place", id: "11111111-1111-4111-8111-111111111111" }).kind, "applied");
let active = controller.getSnapshot().history.exploration;
assert.notEqual(active, null);
assert.equal(rootRouteRequests, 0, "Une Exploration same-URL ne doit pas demander de navigation Next");
assert.equal(navigation.getExplorationDepth(active), 1);
assert.equal(navigation.canPopExploration(active), false);
assert.equal(navigation.isDayDrawerSuspended(controller.getSnapshot().history), true);
const origin = navigation.getExplorationOrigin(active);
assert.deepEqual(active.rootCheckpoint.route, root);

assert.equal(controller.push({ kind: "merchant", id: "22222222-2222-4222-8222-222222222222" }).kind, "applied");
active = controller.getSnapshot().history.exploration;
assert.equal(navigation.getExplorationDepth(active), 2);
assert.equal(navigation.canPopExploration(active), true);
assert.equal(navigation.getParentNode(active).kind, "place");
assert.deepEqual(navigation.getExplorationOrigin(active), origin);

assert.equal(controller.pop().kind, "applied");
active = controller.getSnapshot().history.exploration;
assert.equal(navigation.getExplorationDepth(active), 1);
assert.equal(navigation.getCurrentNode(active).kind, "place");
assert.equal(controller.close().kind, "applied");
assert.equal(controller.getSnapshot().history.exploration, null);
assert.equal(controller.getSnapshot().history.day, "2026-08-23");

history.forward();
assert.equal(controller.getSnapshot().history.exploration, null);
controller.dispose();

function assertEntityOperationsTransfer(kind, id, filterKey) {
  const requestedRoots = [];
  let transferHistoryState = null;
  const transferController = navigation.createNavigationController({
    router: {
      read: () => root,
      push: (nextRoot) => requestedRoots.push(nextRoot),
      replace: (nextRoot) => requestedRoots.push(nextRoot),
    },
    history: {
      get state() { return transferHistoryState; },
      push: (state) => { transferHistoryState = state; },
      replace: (state) => { transferHistoryState = state; },
      back: () => undefined,
      forward: () => undefined,
      subscribe: () => () => undefined,
    },
    session: new navigation.InMemoryNavigationSessionStore(),
    surface: {
      activateRoute: () => undefined,
      readScope: () => normalizeAnalysisScope({
        subject: { kind: "household" },
        time: { kind: "month", month: "2026-08" },
      }),
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
  assert.equal(transferController.start().kind, "applied");
  assert.equal(transferController.openExploration({ kind, id }).kind, "applied");
  assert.equal(transferController.goToOperations({ [filterKey]: [id] }).kind, "applied");
  const operationsRoot = requestedRoots.at(-1);
  assert.equal(operationsRoot.kind, "operations");
  assert.equal(operationsRoot.filters.timeKind, "economic_month");
  assert.equal(operationsRoot.filters.month, "2026-08");
  assert.deepEqual(operationsRoot.filters[filterKey], [id]);
  assert.deepEqual(
    navigation.parseRootNavigation(navigation.serializeRootNavigation(operationsRoot)),
    operationsRoot,
  );
  transferController.dispose();
}

assertEntityOperationsTransfer(
  "merchant",
  "22222222-2222-4222-8222-222222222222",
  "merchantIds",
);
assertEntityOperationsTransfer(
  "place",
  "11111111-1111-4111-8111-111111111111",
  "placeIds",
);

const momentsParams = query.parseGalleryMomentsParams({
  search: "  anniversaire  ",
  sort: { key: "recent" },
  filters: {},
});
assert.equal(momentsParams.search, "anniversaire");
assert.equal(momentsParams.sort.key, "recent");
assert.throws(() => query.parseGalleryMomentsParams({ sort: { key: "spent" }, filters: {} }));
assert.equal(query.parseGalleryPlacesParams({ sort: { key: "spent" }, filters: {} }).sort.key, "spent");
assert.equal(query.parseGalleryMerchantsParams({ sort: { key: "frequent" }, filters: {} }).sort.key, "frequent");
const adjustableBrowse = query.parseOperationsBrowseParams({
  time: { kind: "bank_month", month: "2026-07" },
  filters: { necessity: ["Ajustable"] },
  sort: { key: "bank_date", direction: "desc" },
});
assert.deepEqual(adjustableBrowse.filters.necessity, ["Ajustable"]);
const operationsNavigation = {
  kind: "operations",
  filters: {
    necessity: ["Ajustable"],
    cursor: "page-two",
    cursorTrail: ["first", "page-one"],
  },
};
assert.deepEqual(
  navigation.parseRootNavigation(navigation.serializeRootNavigation(operationsNavigation)),
  operationsNavigation,
);

const lifeEventModel = query.parseEntityLifeEventReadModel({
  id: "33333333-3333-4333-8333-333333333333",
  identity: { title: "Repas / restaurant" },
  type: "Repas / restaurant",
  startsOn: "2026-08-23",
  endsOn: "2026-08-23",
  validationStatus: "Confirmé",
  participants: [
    { personId: "44444444-4444-4444-8444-444444444444", label: "Adrien" },
    { personId: "55555555-5555-4555-8555-555555555555", label: "Manon" },
  ],
  places: { items: [], hasMore: false, totalCount: 0 },
  relatedMoments: { items: [], hasMore: false, totalCount: 0 },
  headline: {},
  capabilities: {
    resource: "entity_life_event",
    availableSections: ["identity", "participants", "places", "timeline", "headline"],
    availableMeasures: [],
    compatibleFilters: [],
    unavailable: [],
  },
});
assert.deepEqual(lifeEventModel.participants.map(({ label }) => label), ["Adrien", "Manon"]);
assert.throws(() => query.parseEntityLifeEventReadModel({
  ...lifeEventModel,
  participants: undefined,
  participantIds: ["44444444-4444-4444-8444-444444444444"],
}));

const revision = {
  dataRevision: "data-1",
  analyticsRevision: "analytics-1",
  contractVersion: "query-api.v1",
};
assert.equal(explorationTypes.sameRevision(revision, { ...revision }), true);
assert.equal(explorationTypes.sameRevision(revision, { ...revision, dataRevision: "data-2" }), false);

function collectSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSources(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fs.readFileSync(entryPath, "utf8")] : [];
  });
}

const featureRoot = path.join(repositoryRoot, "src/features/exploration");
const source = collectSources(featureRoot).join("\n");
const galleriesSource = fs.readFileSync(path.join(featureRoot, "galleries.tsx"), "utf8");
const panelSource = fs.readFileSync(path.join(featureRoot, "exploration-panel.tsx"), "utf8");
const operationSource = fs.readFileSync(path.join(featureRoot, "operation-evidence.tsx"), "utf8");
const serverQueryRoot = path.join(repositoryRoot, "src/server/query/sources");
const entitiesSource = fs.readFileSync(path.join(serverQueryRoot, "entities.ts"), "utf8");
const operationsSource = fs.readFileSync(path.join(serverQueryRoot, "operations.ts"), "utf8");
const canonicalRelationsSource = fs.readFileSync(path.join(serverQueryRoot, "canonical-relations.ts"), "utf8");
const repositorySource = fs.readFileSync(path.join(repositoryRoot, "src/server/canonical/repository.ts"), "utf8");
const calendarSource = fs.readFileSync(path.join(serverQueryRoot, "calendar.ts"), "utf8");
const analysisSource = fs.readFileSync(path.join(serverQueryRoot, "analysis.ts"), "utf8");

assert.equal(/\.(?:reduce|groupBy)\s*\(/.test(source), false);
assert.equal(/\b(?:history\.pushState|history\.replaceState|history\.back|window\.history|globalThis\.history)\b/.test(source), false);
assert.equal(/@supabase|process\.env/.test(source), false);
assert.equal(/GenericEntity(?:Card|Surface)/.test(source), false);
assert.equal(/\b\w*[Aa]mount\s*\?\?\s*0\b/.test(source), false);
assert.equal((galleriesSource.match(/export function (?:Moments|Places|Merchants)Gallery/g) ?? []).length, 3);
assert.equal(/\.sort\s*\(/.test(galleriesSource), false);
assert.match(galleriesSource, /onSearch\(draft\.trim\(\)\)/);
assert.match(galleriesSource, /onLoadMore\(pageInfo\.nextCursor!\)/);
assert.equal((panelSource.match(/<OverlayFrame/g) ?? []).length, 1);
assert.match(panelSource, /<ExplorationStack/);
assert.match(source, /hasCapabilitySection/);
assert.match(source, /metricId/);
assert.match(source, /previousData/);
for (const section of ["Vérité bancaire", "Vérité économique", "Temporalité économique", "Classification", "Liens canoniques", "Composition", "Traçabilité"]) {
  assert.match(operationSource, new RegExp(section));
}
for (const group of ["Allocations", "Items", "Payment components", "Cash uses"]) {
  assert.match(operationSource, new RegExp(group));
}
assert.match(operationsSource, /value === "Ajustable"/);
assert.match(operationsSource, /state === "unknown"\s*\? "partial"/);
assert.match(operationsSource, /economicTiming:\s*state === "unknown"[\s\S]*?\{ kind: "unknown" \}/);
assert.match(entitiesSource, /loadFinancialLinkRowsByOperationIds/);
assert.match(entitiesSource, /primary_place_id/);
assert.match(entitiesSource, /loadActivityOccurrenceById/);
assert.match(entitiesSource, /eventTitle[\s\S]*?typeLabel/);
assert.match(entitiesSource, /person\.displayName/);
assert.match(canonicalRelationsSource, /loadMomentLifeEventRowsByMomentIds/);
assert.match(canonicalRelationsSource, /loadLifeEventParticipationRows/);
assert.match(repositorySource, /moment_life_events/);
assert.match(repositorySource, /life_event_participations/);
assert.match(calendarSource, /canonicalHumanLabel/);
assert.match(calendarSource, /calendar_public_label/);
assert.match(analysisSource, /canonicalHumanLabel|canonicalLabelMap/);
assert.doesNotMatch(entitiesSource, /\b(?:participant_ids|person_ids|place_ids|moment_ids)\b/);
assert.doesNotMatch(entitiesSource, /lifeEvents:\s*\[\]/);

console.log("Exploration / Entities targeted checks: PASS");
