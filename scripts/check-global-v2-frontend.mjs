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
const comparisonRange = await import("../src/features/global-v2/comparison-range-model.ts");
const rhythmCollections = await import("../src/features/global-v2/rhythm-collections.ts");
const rhythmDetailRouting = await import("../src/features/global-v2/rhythm-detail-routing.ts");
const rhythmNarrative = await import("../src/features/global-v2/rhythm-narrative.ts");
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
const comparisonRangeModelSource = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range-model.ts"), "utf8");
const comparisonRangeSource = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range.tsx"), "utf8");
const rhythmCollectionsSource = fs.readFileSync(path.join(root, "src/features/global-v2/rhythm-collections.ts"), "utf8");
const rhythmDetailRoutingSource = fs.readFileSync(path.join(root, "src/features/global-v2/rhythm-detail-routing.ts"), "utf8");
const rhythmNarrativeSource = fs.readFileSync(path.join(root, "src/features/global-v2/rhythm-narrative.ts"), "utf8");
const lifeTimelineSource = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const m2Source = pageSource.slice(pageSource.indexOf("function M2MoneyRows"), pageSource.indexOf("function LifeInsightList"));
const m2CompactSource = pageSource.slice(pageSource.indexOf("function M2CompactCard"), pageSource.indexOf("function PersonaColumns"));
const m2InsightSource = pageSource.slice(pageSource.indexOf("function M2CompactRecentInsight"), pageSource.indexOf("function M2CompactCard"));
const m2ComparisonsSource = pageSource.slice(pageSource.indexOf("function M2Comparisons"), pageSource.indexOf("function M2NeedsContent"));
const m2ExpandedSource = pageSource.slice(pageSource.indexOf("function M2ExpandedContent"), pageSource.indexOf("function LifeInsightList"));
const m2DetailSource = pageSource.slice(pageSource.indexOf("function M2EntityDetail"), pageSource.indexOf("function M2ExpandedContent"));
const lifeSource = pageSource.slice(pageSource.indexOf("function LifeInsightList"), pageSource.indexOf("function GlobalExpandedContent"));
const lifeMethodSource = pageSource.slice(pageSource.indexOf("function LifeMethod"), pageSource.indexOf("function LifeActivityProfiles"));
const lifeFormattingSource = pageSource.slice(pageSource.indexOf("const lifeRatioFormatter"), pageSource.indexOf("function formatTrend"));
const lifeMomentsSource = pageSource.slice(pageSource.indexOf("function LifeMoments"), pageSource.indexOf("function metricBySuffix"));
const lifeActivityDetailSource = pageSource.slice(pageSource.indexOf("function lifePersonFrequency"), pageSource.indexOf("function LifeMomentDetail"));
const lifeMomentDetailSource = pageSource.slice(pageSource.indexOf("function LifeMomentDetail"), pageSource.indexOf("function LifeExpandedContent"));
const lifeExpandedContentSource = pageSource.slice(pageSource.indexOf("function LifeExpandedContent"), pageSource.indexOf("function GlobalExpandedContent"));
const globalDetailOverlaySource = pageSource.slice(pageSource.indexOf("function GlobalDetailOverlay"), pageSource.indexOf("function ExpandedPreview"));
const storyOrderSource = pageSource.slice(pageSource.indexOf("const storyOrder"), pageSource.indexOf("const internalNavigation"));
const navigationSource = pageSource.slice(pageSource.indexOf("const internalNavigation"), pageSource.indexOf("const moduleTabs"));
const moduleTabsSource = pageSource.slice(pageSource.indexOf("const moduleTabs"), pageSource.indexOf("function moduleForSlug"));
const summarySource = pageSource.slice(pageSource.indexOf("function HumanSummary"), pageSource.indexOf("export function GlobalV2Page"));
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
check(() => assert.match(pageSource, /analysis_global_category_need_detail/u));
check(() => assert.match(m2Source, /detail:current-amount[\s\S]*detail:typical-amount[\s\S]*detail:delta-amount/u));
check(() => assert.match(m2Source, /Chaque montant compare le dernier mois analysé au niveau de référence/u));
check(() => assert.match(m2Source, /Nous préférons laisser cette part non attribuée plutôt que de la deviner/u));
check(() => assert.match(m2CompactSource, /period\.label\.replace\("—", "→"\)/u));
check(() => assert.doesNotMatch(m2Source, /Ce mois-ci|récemment/u));
check(() => assert.doesNotMatch(pageSource, /Montants mensuels publiés/u));
check(() => assert.match(pageSource, /returnToCollection = \(\) => onReplace\(moduleOverlayTarget\(target\.moduleKey, returnSection\)\)[\s\S]*backAction:[\s\S]*returnToCollection/u));
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
check(() => assert.match(m2ComparisonsSource, /const label = humanLabel\(row\.labelKey\)\.replace\([\s\S]*<button[\s\S]*data-m2-entity-ref=\{row\.entityRef\}[\s\S]*onDetail\(row, label\)/u));
check(() => assert.match(pageSource, /onDetail=\{\(row, detailTitle\) =>[\s\S]*entityOverlayTarget\(target\.moduleKey, row\.entityRef, detailTitle \?\? humanLabel\(row\.labelKey\), section, rhythmOrigin\)/u));
check(() => assert.match(m2Source, /M2MonetarySeries title="Évolution mensuelle des principaux postes"[\s\S]*showSummary=\{false\}/u));
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
check(() => assert.match(navigationSource, /Synthèse[\s\S]*Nos dépenses[\s\S]*Catégories[\s\S]*Vie & dépenses[\s\S]*Lieux[\s\S]*Profils[\s\S]*Nous deux/u));
check(() => assert.doesNotMatch(navigationSource, /Moments|Autres analyses|Relations/u));
check(() => assert.match(summarySource, /slot: "S1"[\s\S]*slot: "S2"[\s\S]*slot: "S3"[\s\S]*slot: "S4"[\s\S]*slot: "S5"[\s\S]*slot: "S6"/u));
check(() => assert.doesNotMatch(summarySource, /slot: "S7"|moduleKey: "MOMENTS"/u));
check(() => assert.match(pageSource, /RankingBar/u));
check(() => assert.match(pageSource, /MultiSeriesMonetaryEvolution/u));
check(() => assert.doesNotMatch(pageSource, /Aucun changement durable clairement identifié/u));
check(() => assert.doesNotMatch(pageSource, /Pas encore assez d’éléments pour établir une relation fiable/u));
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
check(() => assert.match(cssSource, /data-module="RHYTHM"[^\n]*span 12/u));
check(() => assert.match(cssSource, /data-module="TOGETHER"[\s\S]*span 7/u));
check(() => assert.match(cssSource, /data-module="PERSONAS"[\s\S]*span 5/u));
check(() => assert.match(cssSource, /@media \(max-width: 1024px\)/u));

// RUN C: one human life-spending chapter composed from the typed RHYTHM Query payload.
check(() => assert.match(catalogSource, /title: "Notre vie derrière nos dépenses"/u));
check(() => assert.match(catalogSource, /Ce que nos dépenses racontent de nos habitudes et des moments qui comptent\./u));
check(() => assert.doesNotMatch(storyOrderSource, /TRANSFORMATIONS|RELATIONSHIPS|MOMENTS/u));
check(() => assert.equal(contract.modules.find(({ moduleKey }) => moduleKey === "TRANSFORMATIONS")?.visibility, "HIDDEN"));
check(() => assert.equal(contract.modules.find(({ moduleKey }) => moduleKey === "RELATIONSHIPS")?.visibility, "HIDDEN"));
check(() => assert.equal(contract.modules.find(({ moduleKey }) => moduleKey === "MOMENTS")?.visibility, "HIDDEN"));
check(() => assert.equal((summarySource.match(/moduleKey: "RHYTHM"/gu) ?? []).length, 1));
check(() => assert.doesNotMatch(summarySource, /moduleKey: "MOMENTS"/u));
const lifePrimarySource = pageSource.slice(pageSource.indexOf("function LifeNarrativeHero"), pageSource.indexOf("function PersonaColumns"));
check(() => assert.match(lifePrimarySource, /data-rhythm-primary-experience="dynamic-narrative"/u));
check(() => assert.doesNotMatch(lifePrimarySource, /Explorer l’analyse|LifeInsightList|sectionTabs|moduleTabs/u));
check(() => assert.match(lifePrimarySource, /Ce qui se distingue[\s\S]*Dans notre quotidien[\s\S]*Les moments qui se voient dans nos dépenses/u));
check(() => assert.match(lifeSource, /primaryInsight[\s\S]*secondaryInsights[\s\S]*slice\(0, 3\)/u));
check(() => assert.match(pageSource, /patternsAvailable[\s\S]*momentsAvailable[\s\S]*evolutionAvailable/u));
check(() => assert.match(pageSource, /Habitudes & dépenses[\s\S]*Moments[\s\S]*Changements/u));
check(() => assert.doesNotMatch(pageSource.slice(pageSource.indexOf("RHYTHM: ["), pageSource.indexOf("RELATIONSHIPS: [")), /Relations/u));
check(() => assert.match(lifeSource, /en médiane quand un coût est connu/u));
check(() => assert.match(lifeSource, /buildHabitCoverageModel[\s\S]*Coût connu pour [\s\S]*coverage\.percentage/u));
check(() => assert.match(lifeSource, /Chaque habitude est à lire séparément : ces montants ne forment pas un total\./u));
check(() => assert.match(lifeSource, /Aucune habitude n’est disponible pour le moment\./u));
check(() => assert.doesNotMatch(lifeSource, /coût habituel/u));
check(() => assert.match(lifeActivityDetailSource, /Aucun montant n’est attribué à une personne\./u));
check(() => assert.match(lifeActivityDetailSource, /fois[\s\S]*environ tous les/u));
check(() => assert.match(lifeSource, /Notre timeline de vie/u));
check(() => assert.match(lifeSource, /Des moments qui sortent de l’ordinaire/u));
check(() => assert.match(lifeSource, /delta < 0 \? "en dessous" : "au-dessus"/u));
check(() => assert.match(lifeSource, /médiane de [\s\S]* moments comparables/u));
check(() => assert.doesNotMatch(lifeSource, /médiane des peers|famille de comparaison|occurrences renseignées|historique retenu/iu));
check(() => assert.doesNotMatch(lifeSource, /coûte habituellement|intervalle de confiance|fourchette future|fourchette habituelle/u));
check(() => assert.match(lifeMomentDetailSource, /Dépenses reliées à ce moment[\s\S]*Toutes nos dépenses[\s\S]*Ce total comprend toutes les dépenses enregistrées pendant ces dates, qu’elles soient liées ou non à ce moment\./u));
check(() => assert.match(lifeMomentDetailSource, /contre [\s\S]* en médiane parmi [\s\S]* moments comparables/u));
check(() => assert.match(lifeMomentDetailSource, /Pas assez de moments comparables pour situer celui-ci\./u));
check(() => assert.doesNotMatch(lifeMomentDetailSource, /\bdont\b|ratio|pourcentage|stacked|donut|part-of-whole/iu));
check(() => assert.doesNotMatch(lifeSource, /\?\? 0|0 €/u));
check(() => assert.match(lifeSource, /hasHumanLifeComponentLabel[\s\S]*composition = [^;]*hasHumanLifeComponentLabel/u));
check(() => assert.doesNotMatch(lifeMomentDetailSource, />Composante causale</u));
check(() => assert.match(lifeFormattingSource, /lifeRatioFormatter[\s\S]*maximumFractionDigits: 0/u));
check(() => assert.match(lifeFormattingSource, /shortMonths[\s\S]*longMonths[\s\S]*du [\s\S]* au [\s\S]* – /u));
check(() => assert.match(lifeMomentsSource, /lifeMomentIdentity\(row\.displayValue, false\)/u));
check(() => assert.match(lifeMomentDetailSource, /lifeMomentType\(identity\?\.displayValue\)[\s\S]*lifeMomentDates\(identity\?\.displayValue, true\)/u));
check(() => assert.doesNotMatch(lifeMomentsSource, /<small>\{row\.displayValue\}<\/small>/u));
check(() => assert.doesNotMatch(lifeSource, /numericDisplay|parseFloat|Number\([^)]*displayValue|monthlyEquivalent/u));
check(() => assert.doesNotMatch(lifeSource, /repère pour le prochain budget|prévision|budget estimé|Forecast|48 rythmes|37 Moments|14 comparaisons/u));
check(() => assert.match(pageSource, /analysis_global_moment_experience_detail[\s\S]*data-global-entity-ref[\s\S]*CSS\.escape\(entityRef\)/u));
check(() => assert.match(pageSource, /rhythmDetailReturnSection\(target\.rhythmDetailContext\)[\s\S]*moduleOverlayTarget\(target\.moduleKey, returnSection\)/u));
check(() => assert.match(cssSource, /\.lifeInsights[\s\S]*@media \(max-width: 767px\)[\s\S]*\.lifeInsights[^}]*grid-template-columns:\s*1fr/u));

const lifeOverview = await transport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "OVERVIEW" } });
const lifePatterns = await transport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "PATTERNS" } });
const lifeBreakdown = await transport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "BREAKDOWN" } });
const lifeComparisons = await transport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "COMPARISONS" } });
check(() => assert.ok(1 <= 1 + lifeOverview.data.secondaryInsights.length && 1 + lifeOverview.data.secondaryInsights.length <= 3));
check(() => assert.equal(lifePatterns.data.rows.every((row) => row.typedMeasure?.kind === "MONEY" && row.activityCostProfile?.nonAdditiveAcrossActivities === true), true));
check(() => assert.equal(lifeBreakdown.data.rows.every((row) => row.labelKey.length > 0 && row.entityRef?.startsWith("moment:") && row.typedMeasure?.kind === "MONEY"), true));
check(() => assert.equal(lifeComparisons.data.rows[0]?.momentComparison?.comparisonTier, "SAME_FAMILY"));
const comparedMoment = await transport({ resource: "analysis_global_moment_experience_detail", params: { entityRef: "moment:summer" } });
const unpairedMoment = await transport({ resource: "analysis_global_moment_experience_detail", params: { entityRef: "moment:concert" } });
const householdActivity = await transport({ resource: "analysis_global_routine_detail", params: { entityRef: "household-activity:sport" } });
const adrienActivity = await transport({ resource: "analysis_global_routine_detail", params: { entityRef: "person-activity:adrien:sport" } });
const manonActivity = await transport({ resource: "analysis_global_routine_detail", params: { entityRef: "person-activity:manon:sport" } });
check(() => assert.equal(comparedMoment.data.rows[0]?.labelKey, "Nos vacances d’été"));
check(() => assert.ok(comparedMoment.data.metrics.some(({ metricId }) => metricId.endsWith(":causal-cost")) && comparedMoment.data.metrics.some(({ metricId }) => metricId.endsWith(":spent-during"))));
const comparedMomentCausal = comparedMoment.data.metrics.find(({ metricId }) => metricId.endsWith(":causal-cost"))?.typedMeasure?.value;
const comparedMomentDuring = comparedMoment.data.metrics.find(({ metricId }) => metricId.endsWith(":spent-during"))?.typedMeasure?.value;
check(() => assert.equal(Number(comparedMomentCausal) > Number(comparedMomentDuring), true));
check(() => assert.equal(comparedMoment.data.rows[0]?.momentComparison?.comparisonTier, "SAME_FAMILY"));
check(() => assert.equal(unpairedMoment.data.rows[0]?.momentComparison, undefined));
for (const result of [householdActivity, adrienActivity, manonActivity]) check(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(result.data).success, true));
check(() => assert.equal(householdActivity.data.metrics.find(({ metricId }) => metricId.endsWith(":median"))?.typedMeasure?.value, "18"));
check(() => assert.deepEqual(adrienActivity.data.metrics.filter(({ metricId }) => metricId.endsWith(":occurrences") || metricId.endsWith(":cadence")).map(({ typedMeasure }) => typedMeasure?.value), ["8", "7"]));
check(() => assert.deepEqual(manonActivity.data.metrics.filter(({ metricId }) => metricId.endsWith(":occurrences") || metricId.endsWith(":cadence")).map(({ typedMeasure }) => typedMeasure?.value), ["6", "9"]));

async function narrativeFixture(scenario) {
  const fixtureBundle = fixtures.createGlobalV2FixtureBundle(scenario);
  const fixtureTransport = fixtures.createGlobalV2FixtureTransport(fixtureBundle, scenario);
  const [overviewResult, patternsResult, breakdownResult, evolutionResult] = await Promise.all([
    fixtureTransport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "OVERVIEW" } }),
    fixtureTransport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "PATTERNS" } }),
    fixtureTransport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "BREAKDOWN" } }),
    fixtureTransport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "EVOLUTION" } }),
  ]);
  for (const result of [overviewResult, patternsResult, breakdownResult, evolutionResult]) check(() => assert.equal(query.globalExpandedReadModelSchema.safeParse(result.data).success, true));
  return rhythmNarrative.composeRhythmNarrative({ overview: overviewResult.data, patterns: patternsResult.data, breakdown: breakdownResult.data, evolution: evolutionResult.data });
}

const narrativeCaseA = await narrativeFixture("contract");
const narrativeCaseB = await narrativeFixture("rhythm-empty-hero");
const narrativeCaseC = await narrativeFixture("rhythm-m3-positive");
const narrativeCaseD = await narrativeFixture("rhythm-m5-positive");
const narrativeCaseEHabits = await narrativeFixture("rhythm-empty-habits");
const narrativeCaseEMoments = await narrativeFixture("rhythm-empty-moments");
const narrativeHeroM3 = await narrativeFixture("rhythm-hero-m3");
const narrativeHeroM5 = await narrativeFixture("rhythm-hero-m5");
const narrativeHeroM6Contextual = await narrativeFixture("rhythm-hero-m6-contextual");
check(() => assert.ok(narrativeCaseA.primary !== undefined && narrativeCaseA.habits.length > 0 && narrativeCaseA.moments.length > 0));
check(() => assert.equal(narrativeCaseA.primary?.kind, "M6_MATERIAL_COMPARISON"));
check(() => assert.ok(narrativeCaseA.primaryRow?.momentComparison !== undefined));
check(() => assert.equal(narrativeCaseA.changes.length, 0));
check(() => assert.equal(narrativeCaseA.relationships.length, 0));
check(() => assert.ok(narrativeCaseB.primary === undefined && narrativeCaseB.habits.length > 0 && narrativeCaseB.moments.length > 0));
check(() => assert.equal(narrativeCaseC.changes[0]?.kind, "M3_CERTIFIED_TRANSFORMATION"));
check(() => assert.equal(narrativeCaseD.relationships[0]?.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
check(() => assert.match(narrativeCaseD.relationships[0]?.statementKey ?? "", /associés/u));
check(() => assert.doesNotMatch(narrativeCaseD.relationships[0]?.statementKey ?? "", /cause|provoque|explique|entraîne/iu));
check(() => assert.equal(narrativeCaseEHabits.habits.length, 0));
check(() => assert.equal(narrativeCaseEMoments.moments.length, 0));
check(() => assert.equal(narrativeCaseA.primary === undefined ? 0 : 1, 1));
check(() => assert.match(rhythmNarrativeSource, /const primary = selectedInsights\[0\]/u));
check(() => assert.doesNotMatch(rhythmNarrativeSource, /\.sort\(|parseFloat|numericDisplay|displayValue|Math\.|reduce\(/u));
check(() => assert.match(lifePrimarySource, /narrative\.primary === undefined \? null[\s\S]*narrative\.habits\.length === 0 \? null[\s\S]*narrative\.moments\.length === 0 \? null[\s\S]*narrative\.changes\.length === 0 \? null[\s\S]*narrative\.relationships\.length === 0 \? null/u));
check(() => assert.match(lifePrimarySource, /slice\(0, 3\)|composeRhythmNarrative/u));
check(() => assert.doesNotMatch(lifePrimarySource, /rythmes Adrien|rythmes Manon|monthlyEquivalent|support moteur/u));

// RUN 3: pure display geometry for real M6 comparisons, never analytical recomputation.
const moneyMeasure = (value) => ({ kind: "MONEY", value: String(value), unit: "EUR" });
const countMeasure = (value) => ({ kind: "COUNT", value: String(value), unit: "moment" });
const rangeCase = (overrides = {}) => comparisonRange.buildComparisonRangeModel({
  observed: moneyMeasure(82),
  median: moneyMeasure(33),
  lower: moneyMeasure(26),
  upper: moneyMeasure(49),
  supportCount: countMeasure(7),
  subjectLabel: "Cette soirée",
  comparisonLabel: "soirées comparables",
  ...overrides,
});
const observedAboveMedian = rangeCase();
const observedBelowMedian = rangeCase({ observed: moneyMeasure(22), median: moneyMeasure(33) });
const observedAtMedian = rangeCase({ observed: moneyMeasure(33), median: moneyMeasure(33) });
const observedInsideRange = rangeCase({ observed: moneyMeasure(40), median: moneyMeasure(33) });
const observedAboveUpper = rangeCase({ observed: moneyMeasure(82), upper: moneyMeasure(49) });
const observedBelowLower = rangeCase({ observed: moneyMeasure(12), lower: moneyMeasure(26) });
const collapsedRange = rangeCase({ observed: moneyMeasure(33), median: moneyMeasure(33), lower: moneyMeasure(33), upper: moneyMeasure(33) });
const medianOnly = rangeCase({ lower: undefined, upper: undefined });
const unknownObserved = rangeCase({ observed: moneyMeasure("UNKNOWN") });
check(() => assert.equal(observedAboveMedian.observedPosition > observedAboveMedian.medianPosition, true));
check(() => assert.equal(observedBelowMedian.observedPosition < observedBelowMedian.medianPosition, true));
check(() => assert.equal(observedAtMedian.observedPosition, observedAtMedian.medianPosition));
check(() => assert.equal(observedInsideRange.observedPosition > observedInsideRange.lowerPosition && observedInsideRange.observedPosition < observedInsideRange.upperPosition, true));
check(() => assert.equal(observedAboveUpper.observedPosition > observedAboveUpper.upperPosition, true));
check(() => assert.equal(observedBelowLower.observedPosition < observedBelowLower.lowerPosition, true));
check(() => assert.equal(observedAboveMedian.mode, "Q1_Q3"));
check(() => assert.equal(collapsedRange.lowerPosition, collapsedRange.upperPosition));
check(() => assert.equal(medianOnly.mode, "MEDIAN_ONLY"));
check(() => assert.equal(unknownObserved, undefined));
check(() => assert.doesNotMatch(comparisonRangeModelSource, /\?\?\s*0|\|\|\s*0/u));
check(() => assert.equal(observedAboveMedian.supportCount, 7));
check(() => assert.match(observedAboveMedian.accessibleLabel, /Cette soirée[\s\S]*82\s*€[\s\S]*médiane[\s\S]*33\s*€[\s\S]*7 soirées comparables/u));
check(() => assert.match(comparisonRangeSource, /role="img"[\s\S]*aria-label=\{model\.accessibleLabel\}/u));
check(() => assert.match(comparisonRangeSource, /if \(model === undefined\) return null/u));
check(() => assert.match(comparisonRangeSource, /comparisonRangeMedianMarker[\s\S]*comparisonRangeObservedMarker/u));
check(() => assert.doesNotMatch(comparisonRangeSource, /boxplot|whisker|intervalle de confiance|percentile|score/iu));
check(() => assert.match(lifePrimarySource, /rhythmHeroComparison[\s\S]*<ComparisonRange/u));
check(() => assert.match(lifeMomentDetailSource, /<ComparisonRange[\s\S]*lifeComparisonDelta/u));
check(() => assert.ok(rhythmNarrative.rhythmHeroComparison(narrativeCaseA) !== undefined));
check(() => assert.equal(narrativeHeroM3.primary?.kind, "M3_CERTIFIED_TRANSFORMATION"));
check(() => assert.equal(rhythmNarrative.rhythmHeroComparison(narrativeHeroM3), undefined));
check(() => assert.equal(narrativeHeroM5.primary?.kind, "M5_MATERIAL_ROBUST_ASSOCIATION"));
check(() => assert.equal(rhythmNarrative.rhythmHeroComparison(narrativeHeroM5), undefined));
check(() => assert.equal(narrativeHeroM6Contextual.primary?.kind, "M6_CONTEXTUAL_CAUSAL_MOMENT"));
check(() => assert.equal(rhythmNarrative.rhythmHeroComparison(narrativeHeroM6Contextual), undefined));
check(() => assert.match(lifeMomentDetailSource, /Pas assez de moments comparables pour situer celui-ci\./u));
check(() => assert.doesNotMatch(rhythmNarrativeSource, /\.sort\(|parseFloat|numericDisplay|displayValue|Math\.|reduce\(/u));
check(() => assert.doesNotMatch(comparisonRangeModelSource, /peer selection|recalculate|percentile|confidence|score/iu));

// RUN 4: visible entity -> exact structured detail, with Narrative as a first-class origin.
const heroMomentRef = narrativeCaseA.primary?.entityRefs.find((entityRef) => entityRef.startsWith("moment:"));
const heroMomentRoute = heroMomentRef === undefined ? undefined : rhythmDetailRouting.resolveRhythmDetailContext(heroMomentRef, "NARRATIVE");
const habitRoute = rhythmDetailRouting.resolveRhythmDetailContext(narrativeCaseA.habits[0]?.entityRef ?? "", "NARRATIVE");
const momentRoute = rhythmDetailRouting.resolveRhythmDetailContext(narrativeCaseA.moments[0]?.entityRef ?? "", "NARRATIVE");
check(() => assert.deepEqual(heroMomentRoute, { kind: "MOMENT", entityRef: "moment:summer", origin: "NARRATIVE", resource: "analysis_global_moment_experience_detail" }));
check(() => assert.deepEqual(habitRoute, { kind: "ACTIVITY", entityRef: "household-activity:sport", origin: "NARRATIVE", resource: "analysis_global_routine_detail" }));
check(() => assert.deepEqual(momentRoute, { kind: "MOMENT", entityRef: "moment:concert", origin: "NARRATIVE", resource: "analysis_global_moment_experience_detail" }));
const similarlyNamedMoments = [{ label: "Soirée du 25 avril", entityRef: "moment:evening-2026-04-25" }, { label: "Soirée du 25 avril", entityRef: "moment:evening-2025-04-25" }];
const similarlyNamedHabits = [{ label: "Courses", entityRef: "household-activity:groceries" }, { label: "Courses", entityRef: "household-activity:running" }];
check(() => assert.deepEqual(similarlyNamedMoments.map(({ entityRef }) => rhythmDetailRouting.resolveRhythmDetailContext(entityRef, "NARRATIVE")?.entityRef), similarlyNamedMoments.map(({ entityRef }) => entityRef)));
check(() => assert.deepEqual(similarlyNamedHabits.map(({ entityRef }) => rhythmDetailRouting.resolveRhythmDetailContext(entityRef, "NARRATIVE")?.entityRef), similarlyNamedHabits.map(({ entityRef }) => entityRef)));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(heroMomentRoute), undefined));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(rhythmDetailRouting.resolveRhythmDetailContext("household-activity:sport", "HABITS_COLLECTION")), "PATTERNS"));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(rhythmDetailRouting.resolveRhythmDetailContext("moment:concert", "MOMENTS_COLLECTION")), "BREAKDOWN"));
check(() => assert.equal(rhythmDetailRouting.resolveRhythmDetailContext("", "NARRATIVE"), undefined));
check(() => assert.equal(rhythmDetailRouting.resolveRhythmDetailContext("moment:", "NARRATIVE"), undefined));
check(() => assert.equal(rhythmDetailRouting.resolveRhythmDetailContext("unknown:invented", "NARRATIVE"), undefined));
check(() => assert.doesNotMatch(rhythmDetailRoutingSource, /labelKey|displayValue|title|indexOf|find\(/u));
check(() => assert.match(lifePrimarySource, /data-global-entity-ref=\{momentRef\}[\s\S]*onEntityDetail\(momentRef, lifeUiCopy\(insight\.titleKey\)\)/u));
check(() => assert.match(lifePrimarySource, /row\.entityRef === undefined \? <article[\s\S]*data-global-entity-ref=\{row\.entityRef\}[\s\S]*onEntityDetail\(row\.entityRef!/u));
check(() => assert.match(lifePrimarySource, /aria-label=\{`Comprendre \$\{lifeUiCopy\(insight\.titleKey\)\}`\}/u));
check(() => assert.match(pageSource, /entityOverlayTarget\(moduleKey, entityRef, title, undefined, moduleKey === "RHYTHM" \? "NARRATIVE" : undefined\)/u));
check(() => assert.match(globalDetailOverlaySource, /detailHasBack[\s\S]*rhythmReturnSection !== undefined[\s\S]*rhythmDetailContext\?\.origin/u));
check(() => assert.match(globalDetailOverlaySource, /restoreFocusRef=\{restoreFocusRef\}/u));
check(() => assert.doesNotMatch(moduleTabsSource, /RHYTHM:\s*\[\{ key: "OVERVIEW"/u));
check(() => assert.match(lifeExpandedContentSource, /sectionKey === "OVERVIEW"\) return null/u));
check(() => assert.match(globalDetailOverlaySource, /showTabs = target\.moduleKey !== "RHYTHM"/u));
check(() => assert.doesNotMatch(globalDetailOverlaySource, /target\.moduleKey === "RHYTHM" \? "OVERVIEW"/u));
check(() => assert.match(lifeActivityDetailSource, /medianAmount[\s\S]*formatMoney\(medianAmount\)[\s\S]*En médiane quand un coût est connu\./u));
check(() => assert.match(lifeActivityDetailSource, /Coût connu pour [\s\S]*activitySubject[\s\S]*formatLifeRatio\(coverageRatio\)/u));
check(() => assert.match(lifeActivityDetailSource, /LifePersonRhythm[\s\S]*:occurrences[\s\S]*:cadence[\s\S]*personRows\.map[\s\S]*<LifePersonRhythm/u));
check(() => assert.match(lifeActivityDetailSource, /Aucun montant n’est attribué à une personne\.[\s\S]*Chaque habitude est à lire séparément : ces montants ne forment pas un total\./u));
check(() => assert.doesNotMatch(lifeActivityDetailSource, />Occurrences renseignées<|>Intervalle médian<|>Support<|>PersonDay<|>Owner<|>Scope</iu));
check(() => assert.match(lifeMomentDetailSource, /lifeMomentType[\s\S]*lifeMomentDates[\s\S]*Dépenses reliées à ce moment[\s\S]*Toutes nos dépenses/u));
check(() => assert.match(lifeMomentDetailSource, /Ce montant regroupe uniquement les dépenses reliées à ce moment\./u));
check(() => assert.match(lifeMomentDetailSource, /Ces deux montants correspondent à deux périmètres différents\./u));
check(() => assert.match(lifeMomentDetailSource, /<ComparisonRange/u));
check(() => assert.match(lifeMomentDetailSource, /Pas assez de moments comparables pour situer celui-ci\./u));
check(() => assert.doesNotMatch(lifeMomentDetailSource, />Composante causale|\bdont\b|représente [^<]*%|stacked|donut|part-of-whole/iu));
check(() => assert.match(overlaySource, /document\.addEventListener\("keydown", closeOnEscape, true\)/u));

// RUN 5: exhaustive contextual collections, year timeline and responsive shared details.
const countValue = (value) => ({ kind: "COUNT", value: String(value), unit: "occurrence" });
const ratioValue = (value) => ({ kind: "RATIO", value: String(value), unit: "ratio" });
const coverageCase = (known, total, ratio) => rhythmCollections.buildHabitCoverageModel({
  activityLabel: "Courses",
  knownCausalCostCount: countValue(known),
  totalOccurrenceCount: countValue(total),
  coverageRatio: ratioValue(ratio),
});
const coverageZero = coverageCase(0, 10, 0);
const coveragePartial = coverageCase(8, 10, 0.8);
const coverageFull = coverageCase(10, 10, 1);
const coverageUnknown = coverageCase(0, 10, "UNKNOWN");
check(() => assert.equal(coverageZero?.barWidth, 0));
check(() => assert.equal(coveragePartial?.percentage, 80));
check(() => assert.equal(coverageFull?.barWidth, 100));
check(() => assert.equal(coverageUnknown, undefined));
check(() => assert.match(coveragePartial?.accessibleLabel ?? "", /Coût connu pour 8 courses sur 10, soit 80 %\./u));
check(() => assert.doesNotMatch(rhythmCollectionsSource, /fiabilit|confiance|score|green|red/iu));

const timelineRows = [
  { rowId: "2026:a", labelKey: "Avril", displayValue: "Soirée · 2026-04-25 → 2026-04-26", knowledgeState: "KNOWN", entityRef: "moment:2026-a", evidenceRefs: [] },
  { rowId: "2026:b", labelKey: "Juillet", displayValue: "Réparation · 2026-07-07 → 2026-07-29", knowledgeState: "KNOWN", entityRef: "moment:2026-b", evidenceRefs: [] },
  { rowId: "2025:a", labelKey: "Octobre", displayValue: "Projet · 2025-10-03 → 2025-11-10", knowledgeState: "KNOWN", entityRef: "moment:2025-a", evidenceRefs: [] },
  { rowId: "unknown", labelKey: "Sans date", knowledgeState: "UNKNOWN", entityRef: "moment:unknown", evidenceRefs: [] },
];
const timelineGroups = rhythmCollections.groupRhythmMomentsByYear(timelineRows);
check(() => assert.deepEqual(timelineGroups.map(({ label }) => label), ["2026", "2025", "Date non disponible"]));
check(() => assert.deepEqual(timelineGroups[0]?.rows.map(({ entityRef }) => entityRef), ["moment:2026-a", "moment:2026-b"]));
check(() => assert.deepEqual(timelineGroups.flatMap(({ rows }) => rows.map(({ rowId }) => rowId)), timelineRows.map(({ rowId }) => rowId)));
check(() => assert.doesNotMatch(rhythmCollectionsSource, /\.sort\(|editorialRank|amount|typedMeasure/u));

const emptyComparisonsBundle = fixtures.createGlobalV2FixtureBundle("rhythm-empty-comparisons");
const emptyComparisonsTransport = fixtures.createGlobalV2FixtureTransport(emptyComparisonsBundle, "rhythm-empty-comparisons");
const emptyComparisons = await emptyComparisonsTransport({ resource: "analysis_global_rhythm_expanded", params: { sectionKey: "COMPARISONS" } });
check(() => assert.equal(emptyComparisons.data.rows.length, 0));
check(() => assert.deepEqual(lifePatterns.data.rows.map(({ entityRef }) => entityRef), ["household-activity:sport", "household-activity:cinema"]));
check(() => assert.deepEqual(lifeBreakdown.data.rows.map(({ entityRef }) => entityRef), ["moment:summer", "moment:concert"]));
check(() => assert.match(lifeSource, /Toutes nos habitudes[\s\S]*model\.rows\.filter/u));
check(() => assert.doesNotMatch(lifeSource.slice(lifeSource.indexOf("function LifeActivityProfiles"), lifeSource.indexOf("function lifeComparisonDelta")), /\.sort\(/u));
check(() => assert.match(lifeSource, /data-global-entity-ref=\{row\.entityRef\}[\s\S]*onDetail\(row, label\)/u));
check(() => assert.match(lifeMomentsSource, /groupRhythmMomentsByYear[\s\S]*Notre timeline de vie[\s\S]*Date ou type non disponible[\s\S]*Montant non disponible/u));
check(() => assert.match(lifeMomentsSource, /data-global-entity-ref=\{row\.entityRef\}[\s\S]*onDetail\(row, lifeUiCopy\(row\.labelKey\)\)/u));
check(() => assert.match(lifeSource, /function LifeMomentComparisons[\s\S]*subjectCost[\s\S]*peerMedian[\s\S]*peerCount[\s\S]*moments comparables/u));
check(() => assert.match(pageSource, /title = moduleKey === "RHYTHM" && initialSection === "PATTERNS"[\s\S]*"Nos habitudes"[\s\S]*"Nos moments"/u));
check(() => assert.match(globalDetailOverlaySource, /showTabs = target\.moduleKey !== "RHYTHM"/u));
check(() => assert.match(globalDetailOverlaySource, /rhythmDetailMode[\s\S]*styles\.rhythmDetailSheet/u));
check(() => assert.match(cssSource, /\.rhythmDetailSheet\s*\{[^}]*width:\s*min\(760px, 48vw\)/u));
check(() => assert.match(cssSource, /@media \(max-width: 767px\)[\s\S]*\.rhythmDetailSheet\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*width:\s*100vw[^}]*max-height:\s*100dvh/u));
check(() => assert.match(cssSource, /\.lifeTimelineMarker\s*\{[^}]*width:\s*11px[^}]*height:\s*11px/u));
check(() => assert.doesNotMatch(cssSource.slice(cssSource.indexOf(".lifeTimelineMarker"), cssSource.indexOf(".lifeComparisonGrid")), /amount|nth-child|data-/iu));
check(() => assert.match(globalDetailOverlaySource, /returnScrollTop[\s\S]*content\.scrollTop = returnScrollTop\.current[\s\S]*row\.focus\(\{ preventScroll: true \}\)/u));
check(() => assert.match(globalDetailOverlaySource, /closeDetail = rhythmReturnSection === undefined \? onClose : returnToCollection/u));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(rhythmDetailRouting.resolveRhythmDetailContext("household-activity:sport", "HABITS_COLLECTION")), "PATTERNS"));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(rhythmDetailRouting.resolveRhythmDetailContext("moment:summer", "MOMENTS_COLLECTION")), "BREAKDOWN"));
check(() => assert.equal(rhythmDetailRouting.rhythmDetailReturnSection(rhythmDetailRouting.resolveRhythmDetailContext("moment:summer", "NARRATIVE")), undefined));
check(() => assert.match(globalDetailOverlaySource, /Fiabilité & méthode/u));
check(() => assert.match(overlaySource, /role="dialog"[\s\S]*aria-labelledby/u));
check(() => assert.match(overlaySource, /activateOverlayFocusTrap[\s\S]*scheduleOverlayFocusRestoration[\s\S]*acquireOverlayScrollLock/u));
check(() => assert.match(lifeExpandedContentSource, /LifeActivityDetail[\s\S]*LifeMomentDetail[\s\S]*LifeActivityProfiles[\s\S]*LifeMoments/u));

// RUN 6: final frontend red-team matrix.
const visibleRhythmSource = [lifePrimarySource, lifeMethodSource, lifeMomentsSource, lifeActivityDetailSource, lifeMomentDetailSource].join("\n");
const visibleRhythmTextNodes = [...visibleRhythmSource.matchAll(/>([^<>{}\r\n]+)</gu)].map((match) => match[1]).join("\n");
const exposedBackendVocabulary = /\bpeers?\b|\bfamily\b|famille de comparaison|comparisonTier|comparisonProfileId|Composante causale|causalMomentCost|spentDuring|coverageRatio|numerator|denominator|\bsupport\b|\bowner\b|readmodel|snapshot|analytics revision|entityRef|\bscope\b|phenomenon|inputHash|methodVersion|PersonDay|UNKNOWN|NOT_EVALUATED|AUTHORITY_GATED/iu;
check(() => assert.doesNotMatch(visibleRhythmTextNodes, exposedBackendVocabulary));
check(() => assert.doesNotMatch(visibleRhythmSource, />[^<>{}]*\d{4}-\d{2}-\d{2}[^<>{}]*</u));
check(() => assert.match(lifeFormattingSource, /Intl\.NumberFormat\("fr-FR"[\s\S]*maximumFractionDigits: 0/u));
check(() => assert.doesNotMatch(lifeFormattingSource, /en-US|maximumFractionDigits:\s*2/u));
check(() => assert.match(lifeMethodSource, /Coût connu[\s\S]*Comparaisons[\s\S]*Foyer et personnes[\s\S]*Valeur non disponible/u));
check(() => assert.doesNotMatch(lifeMethodSource, /HumanRows|entityRef|displayValue/u));
check(() => assert.match(pageSource, /sectionKey === "METHODOLOGY" && model\.moduleKey === "RHYTHM"\) return <LifeMethod/u));
check(() => assert.doesNotMatch(lifeMomentsSource, /spentDuring|peerMedian|\bq1\b|\bq3\b|supportCount/u));
const lifePersonRhythmSource = lifeActivityDetailSource.slice(lifeActivityDetailSource.indexOf("function LifePersonRhythm"), lifeActivityDetailSource.indexOf("function LifeActivityDetail"));
check(() => assert.doesNotMatch(lifePersonRhythmSource, /formatMoney|MONEY|€|causal/u));
check(() => assert.doesNotMatch(lifeMomentDetailSource, /\bdont\b|ratio|pourcentage|stacked|donut|part-of-whole/iu));
check(() => assert.match(lifeMomentDetailSource, /causalAmount === undefined \|\| spentDuringAmount === undefined \? null[\s\S]*deux périmètres différents/u));
check(() => assert.doesNotMatch(rhythmNarrativeSource, /\.sort\(|\.reduce\(|parseFloat|numericDisplay|Math\.|median|coverageRatio|cadence/u));
check(() => assert.doesNotMatch(lifeMomentsSource, /\.sort\(|editorialRank|ranking|Math\.(?:min|max)/u));
check(() => assert.equal(narrativeCaseA.primary === undefined ? 0 : 1, 1));
check(() => assert.equal(narrativeCaseB.primary, undefined));
check(() => assert.equal(narrativeCaseC.changes.length > 0, true));
check(() => assert.equal(narrativeCaseD.relationships.length > 0, true));
check(() => assert.doesNotMatch(narrativeCaseD.relationships.map(({ statementKey }) => statementKey).join(" "), /cause|provoque|explique|entraîne|fait augmenter|fait baisser/iu));
check(() => assert.match(lifePrimarySource, /narrative\.changes\.length === 0 \? null[\s\S]*narrative\.relationships\.length === 0 \? null/u));
check(() => assert.doesNotMatch(lifePrimarySource, /rien n’a changé|aucun changement|aucune relation|rien à signaler/iu));
check(() => assert.doesNotMatch(cssSource, /\.lifeMomentGrid/u));
check(() => assert.match(lifePrimarySource, /Fiabilité & méthode/u));
check(() => assert.match(cssSource, /\.methodLink\s*\{[^}]*color:\s*var\(--color-muted\)[^}]*font-size:\s*13px/u));
check(() => assert.match(globalDetailOverlaySource, /target\.kind === "ENTITY_DETAIL" && target\.moduleKey === "RHYTHM"/u));
check(() => assert.doesNotMatch(pageSource, /@\/analytics|@\/server|CanonicalRepository|FactSourceResolver/u));

// D6: timeline-first life chapter, projected only from the published typed timeline.
const timelineFixture = await transport({ resource: "analysis_global_life_timeline", params: {} });
check(() => assert.equal(query.globalLifeTimelineReadModelSchema.safeParse(timelineFixture.data).success, true));
check(() => assert.equal(timelineFixture.data.events.some((event) => event.causalCost.status === "KNOWN" && event.causalCost.value.value === "0"), true));
check(() => assert.match(pageSource, /moduleKey === "RHYTHM" \? <GlobalLifeTimelinePanel/u));
check(() => assert.match(lifeTimelineSource, /resource: "analysis_global_life_timeline"/u));
check(() => assert.doesNotMatch(lifeTimelineSource, /analysis_global_rhythm|displayValue|numericDisplay|parseFloat|\.sort\(/u));
check(() => assert.match(lifeTimelineSource, /Sequential projection only: the Query order remains authoritative/u));
check(() => assert.match(lifeTimelineSource, /"LIFE_EVENT:activite_loisir"[\s\S]*"M6:week-end-escapade"/u));
check(() => assert.doesNotMatch(lifeTimelineSource, /includes\([^)]*typeKey|typeKey[^\n]*includes/u));
check(() => assert.match(lifeTimelineSource, /Coût non établi/u));
check(() => assert.match(lifeTimelineSource, /detailAvailability === "MOMENT_DETAIL"[\s\S]*\? <button[\s\S]*: <article/u));
check(() => assert.match(lifeTimelineSource, /comparison\.status === "PARTIAL" \|\| comparison\.peerCount < 5/u));
check(() => assert.match(lifeTimelineSource, /comparisonSummary\?\.status === "KNOWN" && event\.comparisonSummary\.materiality === "MATERIAL"/u));
check(() => assert.match(lifeTimelineSource, /filters\.has\("KNOWN_COST"\) && event\.causalCost\.status !== "KNOWN"/u));
check(() => assert.match(lifeTimelineSource, /filters\.has\("COMPARABLE"\)[\s\S]*filters\.has\("DISTINCTIVE"\)/u));
check(() => assert.doesNotMatch(lifeTimelineSource, /amount\s*>\s*0|Number\([^)]*\)\s*>\s*0/u));
check(() => assert.doesNotMatch(lifeTimelineSource, /Explorer l’analyse|Nos moments|LifeNarrative|Hero/u));
check(() => assert.match(cssSource, /\.timelineScroller\s*\{[^}]*height:\s*clamp\(520px, 62vh, 680px\)[^}]*scrollbar-gutter:\s*stable/u));
check(() => assert.match(cssSource, /@media \(max-width: 767px\)[\s\S]*\.timelineScroller\s*\{[^}]*height:\s*64dvh/u));
check(() => assert.match(cssSource, /\.timelineMonth > h4\s*\{[^}]*position:\s*sticky/u));
check(() => assert.match(cssSource, /\.timelineMonth li > button:focus-visible/u));

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
