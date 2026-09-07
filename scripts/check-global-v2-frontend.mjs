import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* continue */ }
    throw error;
  }
} });

const query = await import("../src/query-api/global-v2/index.ts");
const fixtures = await import("../src/features/global-v2/fixture-data.ts");
const catalog = await import("../src/features/global-v2/catalog.ts");
const visit = await import("../src/features/global-v2/visit-runtime.ts");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const checkAsync = async (fn) => { await fn(); checks += 1; };
const contract = fixtures.createGlobalV2FixtureBundle("contract");

check(() => assert.equal(query.globalInitialReadModelSchema.safeParse(contract.initial).success, true));
check(() => assert.equal(query.importedGlobalSummaryReadModelSchema.safeParse(contract.summary).success, true));
check(() => assert.equal(contract.modules.length, 10));
check(() => assert.deepEqual(contract.modules.map(({ order }) => order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
check(() => assert.equal(contract.modules.every((model) => query.globalPrimaryReadModelSchemas[model.resource].safeParse(model).success), true));
check(() => assert.equal(contract.modules.every(({ primaryInsight, kpis }) => (primaryInsight === undefined ? 0 : 1) <= 1 && kpis.length <= 3), true));
check(() => assert.equal(contract.modules.find(({ moduleKey }) => moduleKey === "CONSUMPTION")?.visibility, "PLACEHOLDER"));
check(() => assert.equal(contract.modules.find(({ moduleKey }) => moduleKey === "CONSUMPTION")?.primaryInsight, undefined));
check(() => assert.equal(contract.summary.status, "FRESH"));
check(() => assert.equal(contract.summary.sanitizedHtml?.match(/<p>/gu)?.length, 2));

const transport = fixtures.createGlobalV2FixtureTransport(contract, "contract");
for (const presentation of catalog.globalModulePresentations) {
  for (const sectionKey of query.globalExpandedSectionKeys.filter((value) => value !== "METHODOLOGY")) {
    const result = await transport({ resource: presentation.expandedResource, params: { sectionKey } });
    await checkAsync(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(result.data).success, true));
    check(() => assert.equal(result.data.moduleKey, presentation.key));
    check(() => assert.equal(result.data.sectionKey, sectionKey));
    check(() => assert.ok(result.data.secondaryInsights.length + (result.data.primaryInsight === undefined ? 0 : 1) <= 5));
  }
}
for (const presentation of catalog.globalModulePresentations.filter(({ detailResource }) => detailResource !== undefined)) {
  const entityRef = `entity:${presentation.key}`;
  const result = await transport({ resource: presentation.detailResource, params: { entityRef } });
  await checkAsync(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(result.data).success, true));
  check(() => assert.equal(result.data.resource, presentation.detailResource));
  check(() => assert.ok(result.data.rows.every(({ rowId }) => rowId.startsWith(entityRef))));
}
const methodology = await transport({ resource: "analysis_global_methodology", params: { moduleKey: "ECONOMIC", methodRef: "method:economic" } });
await checkAsync(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(methodology.data).success, true));

check(() => assert.deepEqual([...visit.updateExpandedModules(new Set(["A"]), "B", false)].sort(), ["A", "B"]));
check(() => assert.deepEqual([...visit.updateExpandedModules(new Set(["A"]), "B", true)], ["B"]));
check(() => assert.equal(visit.updateExpandedModules(new Set(["A"]), "A", true).size, 0));
check(() => assert.deepEqual(visit.parseGlobalDeepLink("#lieux-evolution"), { anchor: "lieux-evolution", moduleKey: "LIEUX", sectionKey: "EVOLUTION" }));
check(() => assert.deepEqual(visit.parseGlobalDeepLink("#synthese"), { anchor: "synthese" }));
check(() => assert.equal(visit.parseGlobalDeepLink(""), null));

const requestA = { resource: "analysis_global_economic_expanded", params: { sectionKey: "OVERVIEW" } };
const requestB = { resource: "analysis_global_economic_expanded", params: { sectionKey: "EVOLUTION" } };
check(() => assert.notEqual(visit.globalV2UiCacheKey(contract.initial.publicationMeta, requestA), visit.globalV2UiCacheKey(contract.initial.publicationMeta, requestB)));
check(() => assert.notEqual(visit.globalV2UiCacheKey(contract.initial.publicationMeta, requestA), visit.globalV2UiCacheKey({ ...contract.initial.publicationMeta, revision: 83 }, requestA)));
check(() => assert.equal(visit.sameGlobalGeneration(contract.initial.publicationMeta, { ...contract.initial.publicationMeta, generatedAt: "2026-09-06T18:00:00Z" }), false));
check(() => assert.equal(visit.sameGlobalGeneration(contract.initial.publicationMeta, { ...contract.initial.publicationMeta, factsHash: "f".repeat(64) }), false));

let active = 0;
let maximum = 0;
const executionOrder = [];
const controlledTransport = async (request) => {
  active += 1;
  maximum = Math.max(maximum, active);
  executionOrder.push(request.resource);
  await new Promise((resolve) => setTimeout(resolve, 20));
  active -= 1;
  return { data: request.resource, publicationMeta: contract.initial.publicationMeta };
};
const runtime = new visit.GlobalV2VisitRuntime(contract.initial.publicationMeta, controlledTransport, 2);
const economicPromise = runtime.request({ resource: "analysis_global_economic", params: {} });
const categoriesPromise = runtime.request({ resource: "analysis_global_categories_needs", params: {} });
const rhythmPromise = runtime.request({ resource: "analysis_global_rhythm", params: {} });
const momentsRequest = { resource: "analysis_global_moments", params: {} };
const momentsPromise = runtime.request(momentsRequest);
const promotedMomentsPromise = runtime.request(momentsRequest, "DIRECT");
await Promise.all([economicPromise, categoriesPromise, rhythmPromise, momentsPromise, promotedMomentsPromise]);
check(() => assert.equal(maximum, 2));
check(() => assert.equal(executionOrder[2], "analysis_global_moments"));
let reads = 0;
const cachedRuntime = new visit.GlobalV2VisitRuntime(contract.initial.publicationMeta, async (request) => { reads += 1; return { data: request.resource, publicationMeta: contract.initial.publicationMeta }; });
await cachedRuntime.request(requestA);
await cachedRuntime.request(requestA);
check(() => assert.equal(reads, 1));
const lateRuntime = new visit.GlobalV2VisitRuntime(contract.initial.publicationMeta, async () => ({ data: {}, publicationMeta: { ...contract.initial.publicationMeta, publicationId: "late" } }));
await checkAsync(async () => assert.rejects(() => lateRuntime.request(requestA), /LATE_GENERATION_REJECTED/));
const nextGeneration = fixtures.createGlobalV2FixtureBundle("new-generation").newerPublication;
check(() => assert.ok(nextGeneration !== undefined));
const pinnedOld = new visit.GlobalV2VisitRuntime(contract.initial.publicationMeta, async () => ({ data: { generation: "new" }, publicationMeta: nextGeneration }));
await checkAsync(async () => assert.rejects(() => pinnedOld.request(requestA), /LATE_GENERATION_REJECTED/));
const refreshed = new visit.GlobalV2VisitRuntime(nextGeneration, async () => ({ data: { generation: "new" }, publicationMeta: nextGeneration }));
await checkAsync(async () => assert.deepEqual((await refreshed.request(requestA)).data, { generation: "new" }));

const failingBundle = fixtures.createGlobalV2FixtureBundle("local-error");
const failingTransport = fixtures.createGlobalV2FixtureTransport(failingBundle, "local-error");
await checkAsync(async () => assert.rejects(() => failingTransport({ resource: "analysis_global_relationships", params: {} }), /TEMPORARILY_UNAVAILABLE/));
await checkAsync(async () => assert.equal((await failingTransport({ resource: "analysis_global_relationships", params: {} })).data.moduleKey, "RELATIONSHIPS"));

const pageSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-page.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "src/app/analyse-globale/page.tsx"), "utf8");
const fixturePageSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-fixture-page.tsx"), "utf8");
const overlaySource = fs.readFileSync(path.join(root, "src/ui/overlays/overlay-frame.tsx"), "utf8");
check(() => assert.match(pageSource, /IntersectionObserver/u));
check(() => assert.match(pageSource, /aria-expanded/u));
check(() => assert.match(pageSource, /aria-controls/u));
check(() => assert.match(pageSource, /Alternative textuelle/u));
check(() => assert.match(pageSource, /global_module_viewed/u));
check(() => assert.match(pageSource, /global_module_expanded/u));
check(() => assert.match(pageSource, /global_section_expanded/u));
check(() => assert.match(pageSource, /global_entity_opened/u));
check(() => assert.match(pageSource, /global_methodology_opened/u));
check(() => assert.doesNotMatch(pageSource, /observationWindow|parseGlobalWindow|Fenêtre\s*<\/span>/u));
check(() => assert.match(cssSource, /prefers-reduced-motion/u));
check(() => assert.match(cssSource, /position:\s*sticky/u));
check(() => assert.match(cssSource, /@media \(max-width: 767px\)/u));
check(() => assert.match(routeSource, /NODE_ENV === "production"/u));
check(() => assert.match(routeSource, /GlobalV2ActivationPending/u));
check(() => assert.doesNotMatch(pageSource, /@\/analytics|@\/server|CanonicalRepository|FactSourceResolver/u));
check(() => assert.doesNotMatch(pageSource, /fixture-data|createGlobalV2FixtureTransport|31 juillet 2026/u));
check(() => assert.match(pageSource, /certifiedThrough/u));
check(() => assert.match(fixturePageSource, /Development\/browser-test adapter/u));
check(() => assert.match(overlaySource, /document\.addEventListener\("keydown", closeOnEscape, true\)/u));
check(() => assert.match(pageSource, /restoreFocusRef=\{overlayInvokerRef\}/u));
check(() => assert.match(pageSource, /kind: "ENTITY_DETAIL"/u));
check(() => assert.doesNotMatch(pageSource, /ANALYTICAL_DETAIL|Ouvrir la fiche entité/u));
check(() => assert.match(pageSource, /window\.location\.reload\(\)/u));

const masterIndex = JSON.parse(fs.readFileSync(path.join(root, "docs/global-v2/GLOBAL_MASTER_INDEX.json"), "utf8"));
const p16Requirements = masterIndex.requirements.filter(({ owner }) => owner === "P16");
const p16Capabilities = masterIndex.capabilities.filter(({ owner }) => owner === "P16");
const p16Tests = masterIndex.tests.filter(({ owner }) => owner === "P16");
const proofFor = ({ id }) => id.startsWith("GLO-UX-") ? "P16_UI_BEHAVIOR" : id.startsWith("GLO-CERT-") ? "P14_P15_CERTIFIED_RM_PLUS_P16_STATE_RENDERING" : "P01_P15_CERTIFIED_INPUT_PLUS_P16_PROJECTION";
check(() => assert.equal(p16Requirements.length, 150));
check(() => assert.equal(p16Requirements.every((entry) => proofFor(entry).length > 0), true));
check(() => assert.equal(p16Capabilities.length, 29));
check(() => assert.equal(p16Tests.length, 168));
check(() => assert.equal(new Set(p16Requirements.map(({ id }) => id)).size, 150));

console.log(`Global V2 frontend: ${checks}/${checks} PASS`);
console.log(`RuntimeSchemas fixture: ${contract.modules.length + 1 + 50 + 9 + 1}/${contract.modules.length + 1 + 50 + 9 + 1} PASS`);
console.log(`P16 Master matrix: ${p16Requirements.length} requirements, ${p16Capabilities.length} capabilities, ${p16Tests.length} tests mapped`);
console.log(`Background concurrency max: ${maximum}; pinned cache reads: ${reads}; live writes: 0`);
