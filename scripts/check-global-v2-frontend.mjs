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
  check(() => presentation.key === "CATEGORIES_NEEDS"
    ? assert.deepEqual(result.data.metrics.map(({ metricId }) => metricId), ["detail:annual-amount", "detail:annual-share", "detail:active-months", "detail:current-amount", "detail:typical-amount", "detail:delta-amount", "detail:delta-relative"])
    : assert.ok(result.data.rows.every(({ rowId }) => rowId.startsWith(entityRef))));
}
const methodology = await transport({ resource: "analysis_global_methodology", params: { moduleKey: "ECONOMIC", methodRef: query.globalV2MethodRef("ECONOMIC") } });
await checkAsync(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(methodology.data).success, true));
check(() => assert.equal(query.globalV2MethodRef("ECONOMIC"), "method:global-economic@v1"));

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
const catalogSource = fs.readFileSync(path.join(root, "src/features/global-v2/catalog.ts"), "utf8");
const shellSource = fs.readFileSync(path.join(root, "src/components/layout/app-shell.tsx"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "src/app/analyse-globale/page.tsx"), "utf8");
const fixturePageSource = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-fixture-page.tsx"), "utf8");
const overlaySource = fs.readFileSync(path.join(root, "src/ui/overlays/overlay-frame.tsx"), "utf8");
const monetaryEvolutionSource = fs.readFileSync(path.join(root, "src/ui/charts/monetary-evolution/monetary-evolution.tsx"), "utf8");
const chartLegendSource = fs.readFileSync(path.join(root, "src/ui/charts/shared/chart-legend.tsx"), "utf8");
const m2Source = pageSource.slice(pageSource.indexOf("function M2MoneyRows"), pageSource.indexOf("function PersonaColumns"));
const m2CompactSource = pageSource.slice(pageSource.indexOf("function M2CompactCard"), pageSource.indexOf("function PersonaColumns"));
const m2InsightSource = pageSource.slice(pageSource.indexOf("function M2CompactRecentInsight"), pageSource.indexOf("function M2CompactCard"));
const m2ComparisonsSource = pageSource.slice(pageSource.indexOf("function M2Comparisons"), pageSource.indexOf("function M2NeedsContent"));
const m2ExpandedSource = pageSource.slice(pageSource.indexOf("function M2ExpandedContent"), pageSource.indexOf("function GlobalExpandedContent"));
const m2DetailSource = pageSource.slice(pageSource.indexOf("function M2EntityDetail"), pageSource.indexOf("function M2ExpandedContent"));
check(() => assert.match(pageSource, /IntersectionObserver/u));
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

// R3: annual-first M2 composition, honest Needs and same-overlay Category detail.
check(() => assert.match(catalogSource, /title: "Où va notre argent \?"/u));
check(() => assert.match(catalogSource, /structurent nos dépenses\./u));
check(() => assert.doesNotMatch(catalogSource, /title: "Catégories et besoins"|eyebrow: "M2"/u));
check(() => assert.match(m2CompactSource, /kpi:categories:top-five-concentration/u));
check(() => assert.match(m2CompactSource, /initialLimit=\{5\}/u));
check(() => assert.doesNotMatch(m2CompactSource, /M2MonetarySeries|numericDisplay/u));
check(() => assert.match(m2CompactSource, />Explorer l’analyse <span/u));
check(() => assert.match(pageSource, /label: "Besoins renseignés"/u));
check(() => assert.match(m2Source, /needs-monetary-coverage/u));
check(() => assert.match(m2Source, /needs-unclassified-annual-amount/u));
check(() => assert.match(m2Source, /Analyse partielle/u));
check(() => assert.match(m2Source, /row\.entityRef !== "need:__UNKNOWN__"/u));
check(() => assert.doesNotMatch(m2Source, /effectiveCoverage/u));
check(() => assert.match(m2Source, /sectionKey="COMPARISONS"/u));
check(() => assert.match(m2Source, /ArrowDown[\s\S]*ArrowUp/u));
check(() => assert.doesNotMatch(m2Source, /\.reduce\(|annualShare\s*=.*\/|topFive\s*=|group.*Autres/u));
check(() => assert.doesNotMatch(m2Source, /numericDisplay|displayValue\?\.match|displayValue\.replace/u));
check(() => assert.match(m2Source, /detail:annual-amount[\s\S]*detail:annual-share[\s\S]*detail:active-months[\s\S]*detail:current-amount[\s\S]*detail:typical-amount/u));
check(() => assert.match(m2Source, /M2MonetarySeries title="Montant mensuel"/u));
check(() => assert.match(pageSource, /m2NeedExpansionLabels[\s\S]*Voir tous les besoins[\s\S]*Voir moins de besoins/u));
check(() => assert.match(m2Source, /expansionLabels=\{m2NeedExpansionLabels\}/u));
check(() => assert.match(m2Source, /<small>\{formatMoney\(amount\)\}<\/small>/u));
check(() => assert.doesNotMatch(m2ExpandedSource, /sectionKey="OVERVIEW"/u));
check(() => assert.match(monetaryEvolutionSource, /ChartLegend[\s\S]*item\.label/u));
check(() => assert.match(m2Source, /Ce qui compose ce poste/u));
check(() => assert.match(m2DetailSource, /<dt>Référence<\/dt>/u));
check(() => assert.match(m2Source, /analysis_global_category_need_detail/u));
check(() => assert.match(m2Source, /detail:current-amount[\s\S]*detail:typical-amount[\s\S]*detail:delta-amount/u));
check(() => assert.match(m2Source, /Chaque montant compare le dernier mois analysé au niveau de référence/u));
check(() => assert.match(m2Source, /Nous préférons laisser cette part non attribuée plutôt que de la deviner/u));
check(() => assert.match(m2CompactSource, /period\.label\.replace\("—", "→"\)/u));
check(() => assert.doesNotMatch(m2Source, /Ce mois-ci|récemment/u));
check(() => assert.doesNotMatch(pageSource, /Montants mensuels publiés/u));
check(() => assert.match(pageSource, /backAction:[\s\S]*moduleOverlayTarget\("CATEGORIES_NEEDS", returnSection\)/u));
check(() => assert.match(m2Source, /model\.destinations/u));
check(() => assert.match(m2Source, /destination\.kind === "OPERATIONS"[\s\S]*destination\.resource === "operations_browse"/u));
check(() => assert.doesNotMatch(m2DetailSource, /\["detail:active-months", "Présent"\]/u));
check(() => assert.match(m2DetailSource, /\["detail:annual-amount", "Total sur la période"\][\s\S]*\["detail:annual-share", "Part de nos dépenses"\][\s\S]*\["detail:active-months", "Mois actifs"\]/u));
check(() => assert.match(m2DetailSource, /detail:current-amount[\s\S]*detail:typical-amount[\s\S]*detail:delta-amount[\s\S]*detail:delta-relative/u));
check(() => assert.match(m2DetailSource, /deltaValue === 0 \|\| deltaRelativeValue === undefined \? null/u));
check(() => assert.match(m2DetailSource, /isCategory[\s\S]*M2MonetarySeries title="Évolution mensuelle"[\s\S]*showLegend=\{false\}[\s\S]*showSummary=\{false\}/u));
check(() => assert.match(m2DetailSource, /reference=\{reference\}[\s\S]*highlightLastPoint/u));
check(() => assert.match(m2DetailSource, /initialLimit=\{isCategory \? 5 : 10\}[\s\S]*showRemainingCount: true/u));
check(() => assert.match(m2Source, /Voir les \$\{typedRows\.length - initialLimit\} autres[\s\S]*Réduire la liste/u));
check(() => assert.doesNotMatch(m2DetailSource, /subcategoryAmount\s*\/|annualShare\s*=|numericDisplay|displayValue\?\.match/u));
check(() => assert.match(monetaryEvolutionSource, /referenceLine[\s\S]*ReferenceLine y=\{referenceValue\}[\s\S]*ifOverflow="extendDomain"/u));
check(() => assert.match(monetaryEvolutionSource, /highlightLastPoint[\s\S]*ReferenceDot/u));
// UX-3: direct exploration, dense comparisons, sticky tabs and non-color chart cues.
check(() => assert.match(m2CompactSource, /M2MoneyRows[\s\S]*onEntityDetail\(row\.entityRef, humanLabel\(row\.labelKey\)\)/u));
check(() => assert.doesNotMatch(m2CompactSource, /interactive=\{false\}/u));
check(() => assert.match(m2InsightSource, /<button[\s\S]*data-m2-entity-ref=\{entityRef\}[\s\S]*onDetail\(entityRef, humanLabel\(insight\.titleKey\)\)/u));
check(() => assert.match(m2ComparisonsSource, /rows\.slice\(0, 6\)/u));
check(() => assert.match(m2ComparisonsSource, /Réduire la liste[\s\S]*Voir les \$\{rows\.length - 6\} autres/u));
check(() => assert.match(m2ComparisonsSource, /<button[\s\S]*data-m2-entity-ref=\{row\.entityRef\}[\s\S]*onDetail\(row\)/u));
check(() => assert.match(m2Source, /M2MonetarySeries title="Évolution des principaux postes annuels"[\s\S]*showSummary=\{false\}/u));
check(() => assert.match(chartLegendSource, /aria-label="Légende du graphique"[\s\S]*strokeStyle/u));
check(() => assert.match(monetaryEvolutionSource, /chartSeriesStrokeStyles[\s\S]*chartSeriesDashPatterns[\s\S]*strokeDasharray=\{chartSeriesDashPatterns/u));
check(() => assert.match(cssSource, /\.m2OverlayNavigation\s*\{[^}]*position:\s*sticky[^}]*z-index:\s*2[^}]*top:/u));
check(() => assert.match(cssSource, /\.sectionTabs button:focus-visible/u));
check(() => assert.match(cssSource, /\.m2Changes > div > button:focus-visible/u));
check(() => assert.match(cssSource, /\.m2InsightButton:focus-visible/u));
check(() => assert.match(pageSource, /returnSection\?: GlobalExpandedSectionKey[\s\S]*entityOverlayTarget[\s\S]*returnFocusEntityRef[\s\S]*MutationObserver/u));
check(() => assert.match(m2Source, /Le besoin associé est suffisamment renseigné/u));
check(() => assert.match(m2Source, /Analyse partielle/u));
check(() => assert.doesNotMatch(m2ComparisonsSource, /\.sort\(|Materiality|numericDisplay|displayValue/u));
check(() => assert.match(pageSource, /role: "tabpanel"[\s\S]*aria-labelledby/u));
check(() => assert.match(cssSource, /\.m2DetailMetrics[\s\S]*@media \(max-width: 767px\)/u));

// P2: human narrative, module-aware composition and overlay-only details.
check(() => assert.match(shellSource, /Historique[\s\S]*Analyse globale[\s\S]*Opérations/u));
check(() => assert.match(pageSource, /Notre vie, dans son ensemble/u));
check(() => assert.match(pageSource, /12 mois analysés/u));
check(() => assert.match(pageSource, /> Méthode</u));
check(() => assert.doesNotMatch(pageSource, /ANALYSE GLOBALE · NOUVELLE ARCHITECTURE|synthèse non importée|Non importée/u));
check(() => assert.match(pageSource, /Synthèse[\s\S]*Nos dépenses[\s\S]*Catégories[\s\S]*Rythmes[\s\S]*Moments[\s\S]*Lieux[\s\S]*Profils[\s\S]*Nous deux[\s\S]*Autres analyses/u));
check(() => assert.match(pageSource, /slot: "S1"[\s\S]*slot: "S2"[\s\S]*slot: "S3"[\s\S]*slot: "S4"[\s\S]*slot: "S5"[\s\S]*slot: "S6"[\s\S]*slot: "S7"/u));
check(() => assert.match(pageSource, /RankingBar/u));
check(() => assert.match(pageSource, /MultiSeriesMonetaryEvolution/u));
check(() => assert.match(pageSource, /Aucun changement durable clairement identifié/u));
check(() => assert.match(pageSource, /Pas encore assez d’éléments pour établir une relation fiable/u));
check(() => assert.match(pageSource, /Analyse pas encore disponible/u));
check(() => assert.doesNotMatch(pageSource, /0 achat|0 €/u));
check(() => assert.match(pageSource, /Aucune différence nette à mettre en avant entre vos profils/u));
check(() => assert.match(pageSource, /Ce que les données vous voient explicitement faire ensemble/u));
check(() => assert.doesNotMatch(pageSource, /toujours ensemble/iu));
check(() => assert.match(pageSource, /Voir le détail/u));
check(() => assert.doesNotMatch(pageSource, />Développer<|data-expanded=|aria-expanded=/u));
check(() => assert.match(pageSource, /MODULE_DETAIL[\s\S]*OverlayFrame/u));
check(() => assert.match(pageSource, /Analyse partielle/u));
check(() => assert.doesNotMatch(pageSource, /global\.placeholder\.unknown_required_value/u));
check(() => assert.match(catalogSource, /return "Information disponible"/u));
check(() => assert.match(cssSource, /grid-template-columns:\s*repeat\(12/u));
check(() => assert.match(cssSource, /data-module="RHYTHM"[\s\S]*span 8/u));
check(() => assert.match(cssSource, /data-module="TRANSFORMATIONS"[\s\S]*span 4/u));
check(() => assert.match(cssSource, /data-module="TOGETHER"[\s\S]*span 7/u));
check(() => assert.match(cssSource, /data-module="PERSONAS"[\s\S]*span 5/u));
check(() => assert.match(cssSource, /@media \(max-width: 1024px\)/u));

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
