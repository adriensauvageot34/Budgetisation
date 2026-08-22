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
const controller = navigation.createNavigationController({
  router: {
    read: () => root,
    push: () => undefined,
    replace: () => undefined,
  },
  history,
  session: new navigation.InMemoryNavigationSessionStore(),
  surface: {
    readScope: () => null,
    applyScope: () => undefined,
    readSubview: () => null,
    applySubview: () => undefined,
  },
  restoration: { cancel: () => undefined, restore: async () => ({ kind: "top", scrollY: 0 }) },
  readiness: { wait: async () => ({ kind: "ready" }) },
  scroll: {
    getScrollY: () => 120,
    scrollTo: () => undefined,
    getAnchorTop: () => 0,
  },
  compatibility: { categoryIds: true, activityIds: true },
});

assert.equal(controller.start().kind, "applied");
assert.equal(controller.openExploration({ kind: "place", id: "11111111-1111-4111-8111-111111111111" }).kind, "applied");
let active = controller.getSnapshot().history.exploration;
assert.notEqual(active, null);
assert.equal(navigation.getExplorationDepth(active), 1);
assert.equal(navigation.canPopExploration(active), false);
assert.equal(navigation.isDayDrawerSuspended(controller.getSnapshot().history), true);
const origin = navigation.getExplorationOrigin(active);

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

console.log("Exploration / Entities targeted checks: PASS");
