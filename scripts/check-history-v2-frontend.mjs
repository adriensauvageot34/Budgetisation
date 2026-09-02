import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const featureFiles = [
  "src/app/historique/[month]/page.tsx",
  "src/app/historique/[month]/loading.tsx",
  "src/features/history-v2/index.ts",
  "src/features/history-v2/history-v2-page.tsx",
  "src/features/history-v2/history-shell.tsx",
  "src/features/history-v2/calendar-view.tsx",
  "src/features/history-v2/marker-projection.ts",
  "src/features/history-v2/semantic-icon.tsx",
  "src/features/history-v2/presentation.ts",
  "src/features/history-v2/balance-view.tsx",
  "src/features/history-v2/overlay-host.tsx",
  "src/features/history-v2/renderers.tsx",
  "src/features/history-v2/route-state.ts",
  "src/features/history-v2/history-v2.module.css",
];
const sources = Object.fromEntries(featureFiles.map((path) => [path, read(path)]));
const all = Object.values(sources).join("\n");

const coherenceModule = { exports: {} };
const coherenceJavaScript = ts.transpileModule(
  read("src/features/history-v2/publication-coherence.ts"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
new Function("module", "exports", coherenceJavaScript)(coherenceModule, coherenceModule.exports);
const { publicationMetasAreCoherent } = coherenceModule.exports;

const presentationModule = { exports: {} };
const presentationJavaScript = ts.transpileModule(
  read("src/features/history-v2/presentation.ts"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
new Function("module", "exports", presentationJavaScript)(presentationModule, presentationModule.exports);
const {
  compactNarrativeTitle,
  expenseDisplayTitle,
  formatCalendarDay,
  formatFrenchDate,
  formatFrenchDateRange,
  formatHistoricalRank,
  formatLifeMarkerCount,
  spendingPresentationLabel,
} = presentationModule.exports;

const markerProjectionModule = { exports: {} };
const markerProjectionJavaScript = ts.transpileModule(
  read("src/features/history-v2/marker-projection.ts"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
new Function("module", "exports", "require", markerProjectionJavaScript)(
  markerProjectionModule,
  markerProjectionModule.exports,
  (request) => {
    if (request === "@/core/history-v2") {
      return {
        calendarFilterTags: [
          "EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT",
          "WORK", "HEALTH_CARE", "FIXED_CHARGE", "SUBSCRIPTION", "UNASSIGNED_TIMING",
        ],
      };
    }
    throw new Error(`Import inattendu dans marker-projection: ${request}`);
  },
);
const { projectFilteredMarkers } = markerProjectionModule.exports;

const routePresetRegistry = {
  all: { tags: ["EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT", "WORK", "HEALTH_CARE", "FIXED_CHARGE", "SUBSCRIPTION", "UNASSIGNED_TIMING"], amount: "ALL" },
  daily: { tags: ["GROCERY", "DINING", "TRANSPORT", "HEALTH_CARE"], amount: "ALL" },
  highlights: { tags: ["EVENT_VISIT", "ACTIVITY_OUTING", "WORK"], amount: "ALL" },
  "exclude-fixed": { tags: ["EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT", "WORK", "HEALTH_CARE", "SUBSCRIPTION", "UNASSIGNED_TIMING"], amount: "EXCLUDE_FIXED" },
  expenses: { tags: ["GROCERY", "DINING", "TRANSPORT", "HEALTH_CARE", "FIXED_CHARGE", "SUBSCRIPTION", "UNASSIGNED_TIMING"], amount: "ALL" },
};
const routeStateModule = { exports: {} };
const routeStateJavaScript = ts.transpileModule(
  read("src/features/history-v2/route-state.ts"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
new Function("module", "exports", "require", routeStateJavaScript)(
  routeStateModule,
  routeStateModule.exports,
  (request) => {
    if (request === "@/core/history-v2") return {
      calendarFilterPresetRegistry: routePresetRegistry,
      parseCalendarFilterSelection: (input) => input.show === undefined
        ? { preset: "all", tags: routePresetRegistry.all.tags, amount: "ALL" }
        : { preset: "all", tags: input.show.split(","), amount: "ALL" },
    };
    if (request === "@/core/time") return { parseLocalDate: (value) => value };
    if (request === "@/query-api") return { queryResourceKeys: {
      historyDayJournal: "history_day_journal",
      historyMomentDetail: "history_moment_detail",
      historyActivityDetail: "history_activity_detail",
      historyPlaceDetail: "history_place_detail",
    } };
    throw new Error(`Import inattendu dans route-state: ${request}`);
  },
);
const { historyV2Href, parseHistoryCalendarFilters } = routeStateModule.exports;

const marker = (index, filterTag = "GROCERY") => ({
  calendarItemId: `marker-${index}`,
  title: `Marker ${index}`,
  filterTags: [filterTag],
});
const allFilters = {
  preset: "all",
  tags: [
    "EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT",
    "WORK", "HEALTH_CARE", "FIXED_CHARGE", "SUBSCRIPTION", "UNASSIGNED_TIMING",
  ],
  amount: "ALL",
};
for (const [inputCount, visibleCount, hiddenCount] of [
  [0, 0, 0],
  [1, 1, 0],
  [3, 3, 0],
  [6, 6, 0],
  [7, 6, 1],
  [10, 6, 4],
]) {
  const result = projectFilteredMarkers({
    status: "KNOWN",
    items: Array.from({ length: inputCount }, (_, index) => marker(index)),
    totalCount: inputCount,
  }, allFilters, 6);
  assert.equal(result.items.length, visibleCount, `${inputCount} Markers: préfixe visible incorrect.`);
  assert.equal(result.hidden.status, "KNOWN");
  assert.equal(result.hidden.value, hiddenCount, `${inputCount} Markers: overflow incorrect.`);
}
const filteredTen = projectFilteredMarkers({
  status: "KNOWN",
  items: Array.from({ length: 10 }, (_, index) => marker(index, index < 2 ? "GROCERY" : "WORK")),
  totalCount: 10,
}, { ...allFilters, tags: ["GROCERY"] }, 6);
assert.equal(filteredTen.items.length, 2, "Le filtre doit réduire dix Markers à deux avant le préfixe.");
assert.deepEqual(filteredTen.items.map(({ calendarItemId }) => calendarItemId), ["marker-0", "marker-1"]);
assert.equal(filteredTen.hidden.value, 0, "L'overflow doit être calculé après filtrage.");

assert.equal(historyV2Href({ month: "2026-07", view: "calendar", filters: allFilters }), "/historique/2026-07");
assert.equal(historyV2Href({ month: "2026-07", view: "balance", filters: allFilters }), "/historique/2026-07?view=balance");
assert.equal(historyV2Href({ month: "2026-07", view: "calendar", filters: { preset: "daily", ...routePresetRegistry.daily } }), "/historique/2026-07?preset=daily");
assert.equal(historyV2Href({ month: "2026-07", view: "balance", filters: { preset: "all", tags: ["GROCERY"], amount: "ALL", customSelection: true } }), "/historique/2026-07?view=balance&show=GROCERY");
assert.equal(historyV2Href({ month: "2026-07", view: "calendar", filters: { preset: "all", tags: routePresetRegistry.all.tags, amount: "ALL", customSelection: true } }), `/historique/2026-07?show=${routePresetRegistry.all.tags.join("%2C")}`, "Un show legacy doit rester explicite même s'il recopie exactement le preset all.");
assert.equal(parseHistoryCalendarFilters({ show: "GROCERY" }).customSelection, true, "Un show legacy doit rester custom et ne sélectionner aucun preset visuel.");

assert.equal(formatCalendarDay("2026-07-03", false), "3");
assert.equal(formatCalendarDay("2026-06-30", true), "30 juin");
assert.equal(formatFrenchDate("2026-07-18"), "18 juillet 2026");
assert.equal(formatFrenchDateRange("2026-07-03", "2026-07-05"), "3–5 juillet 2026");
assert.equal(formatFrenchDateRange("2026-07-18", "2026-07-18", false), "18 juillet");
assert.equal(compactNarrativeTitle("Visite famille – 3–5 juillet 2026", "2026-07-03", "2026-07-05"), "Visite famille");
assert.equal(compactNarrativeTitle("Visite famille – 4 juillet 2026", "2026-07-03", "2026-07-05"), "Visite famille – 4 juillet 2026", "Une date seulement ressemblante ne doit pas être supprimée.");
assert.equal(compactNarrativeTitle("Sortie au JAM", "2026-07-26"), "Sortie au JAM");
assert.equal(formatLifeMarkerCount("IMPORTANT_VISITS", 1), "1 visite");
assert.equal(formatLifeMarkerCount("IMPORTANT_VISITS", 6), "6 visites");
assert.equal(formatLifeMarkerCount("DRIVING", 5), "5 séances");
assert.equal(formatLifeMarkerCount("WORK_RHYTHM", 21), "21 jours");
assert.equal(formatHistoricalRank(1, 12), "1er mois le plus dépensier sur 12");
assert.equal(formatHistoricalRank(3, 12), "3e mois le plus dépensier sur 12");
assert.equal(spendingPresentationLabel("CONSTRAINED__VARIABLE"), "Contraintes variables");
assert.equal(expenseDisplayTitle({ label: "Paiement par carte", merchantLabel: "Super U", placeLabel: "Montpellier" }), "Super U");
assert.equal(expenseDisplayTitle({ label: "Paiement par carte", merchantLabel: " ", placeLabel: "Montpellier" }), "Montpellier");
assert.equal(expenseDisplayTitle({ label: "Paiement par carte" }), "Paiement par carte");

const publicationMeta = {
  publicationId: "08ac77f3-ad31-4455-921b-be6e175be65a",
  revision: 43,
  factsHash: "feb8aae3a1f688703d99b2804c1f45d027720d56b5fcbf8e16ce5e0d26d6168c",
  contractVersion: "v2",
  generatedAt: "2026-08-31T12:00:00Z",
  policyVersions: { month_balance_summary: "v2", daily_economic_allocation: "v2" },
};
assert.equal(publicationMetasAreCoherent([
  publicationMeta,
  { ...publicationMeta, policyVersions: { category_explanation: "v2" } },
]), true, "Des policyVersions propres aux ressources doivent rester cohérentes dans une même publication.");
assert.equal(publicationMetasAreCoherent([
  publicationMeta,
  { ...publicationMeta, publicationId: "another-publication" },
]), false, "Deux publicationId différents doivent être incompatibles.");
assert.equal(publicationMetasAreCoherent([
  publicationMeta,
  { ...publicationMeta, revision: 44 },
]), false, "Deux revisions différentes doivent être incompatibles.");
assert.equal(publicationMetasAreCoherent([
  publicationMeta,
  { ...publicationMeta, factsHash: "a".repeat(64) },
]), false, "Deux factsHash différents doivent être incompatibles.");
assert.equal(publicationMetasAreCoherent([publicationMeta, undefined]), false, "PublicationMeta manquant doit être incompatible.");

const historyV2Resources = [
  "historyMonthCalendar", "historyWeek", "historyDayJournal", "historyMonthOverview",
  "historyMonthBalanceSummary", "historyBankEconomyBridge", "historyMonthCategories",
  "historyCategoryDetail", "historyMonthSpendingNature", "historySpendingSegmentDetail",
  "historyMinimalPreview", "historyMonthLifeMoney", "historyActivityDetail",
  "historyMomentDetail", "historyPlaceDetail",
];
for (const resource of historyV2Resources) assert.match(all, new RegExp(`queryResourceKeys\\.${resource}\\b`), `${resource} doit être consommée.`);
assert.doesNotMatch(all, /queryResourceKeys\.(historyCalendarMonth|historyDayDetail|analysisMonthInitial)/, "Le chemin V2 ne doit pas lire un ReadModel legacy.");
assert.doesNotMatch(sources["src/features/history-v2/route-state.ts"], /snapshotId|publicationId/, "Les identifiants techniques ne doivent pas entrer dans l’URL.");

const canonicalRoute = sources["src/app/historique/[month]/page.tsx"];
const routeState = sources["src/features/history-v2/route-state.ts"];
const mainNavigation = read("src/components/layout/app-shell.tsx");
const rootHistoryRoute = read("src/app/historique/page.tsx");
const rootRoute = read("src/app/page.tsx");
const queryRuntime = read("src/server/query/runtime.ts");
const materializationStore = read("src/server/analytics/materialization/store.ts");
assert.match(canonicalRoute, /<HistoryV2Page\b/, "La route canonique /historique/[month] doit rendre History V2.");
assert.doesNotMatch(canonicalRoute, /@\/features\/calendar|historyCalendarMonth|historyDayDetail/, "La route canonique ne doit importer aucun frontend/ReadModel History V1.");
assert.match(routeState, /return `\/historique\/\$\{input\.month\}/, "Les deep links V2 doivent utiliser /historique.");
assert.match(mainNavigation, /href: "\/historique", label: "Historique"/, "La navigation principale doit viser /historique.");
assert.match(rootHistoryRoute, /`\/historique\/\$\{latestMonth\}`/, "L'index Historique doit entrer dans la route canonique V2.");
assert.match(rootHistoryRoute, /resolveLatestPublishedHistoryV2Month/, "L'index Historique doit utiliser la publication V2 active.");
assert.match(rootRoute, /resolveLatestPublishedHistoryV2Month/, "La racine produit doit utiliser la même publication V2 active.");
assert.doesNotMatch(`${rootHistoryRoute}\n${rootRoute}`, /eligibleHistoryMonths|periods\.at\(-1\)/, "Les routes sans mois ne doivent plus utiliser la dernière période Bootstrap.");
assert.match(queryRuntime, /export async function resolveLatestPublishedHistoryV2Month/, "Le resolver authentifié doit être partagé.");
assert.match(materializationStore, /async readLatestPublishedHistoryV2Month/, "La matérialisation doit porter la lecture du dernier mois publié.");
for (const proof of [
  /resource", resource/,
  /contract_version", contract\.contractVersion/,
  /method_signature",\s+historyV2AcceptedMethodSignatures\(resource\)/,
  /is_active", true/,
  /invalidated_at", null/,
  /analytics_publications\.status", "published"/,
]) assert.match(materializationStore, proof, "Le resolver doit sélectionner uniquement un snapshot History V2 publié et servable.");
for (const retiredPath of [
  "src/app/historique-v2/page.tsx",
  "src/app/historique-v2/[month]/page.tsx",
  "src/app/historique/calendrier/page.tsx",
  "src/app/historique/calendrier/[month]/page.tsx",
  "src/app/historique/calendrier/[month]/[week]/page.tsx",
  "src/app/historique/analyse/[month]/page.tsx",
  "src/features/calendar/index.ts",
  "src/features/analysis/month/analysis-month-page.tsx",
  "src/query-api/calendar/index.ts",
]) assert.equal(existsSync(join(root, retiredPath)), false, `${retiredPath} doit être retiré physiquement.`);
const registry = read("src/query-api/request/resource-registry.ts");
const contracts = read("src/query-api/request/resource-contract.ts");
const retainedHistoryV2Resources = (contracts.match(/history_[a-z_]+:\s*defineHistoryV2ResourceContract/g) ?? []);
assert.equal(retainedHistoryV2Resources.length, 15, "Les 15 familles History V2, dont M1–M4, doivent rester enregistrées.");
for (const retiredResource of ["history_calendar_month", "history_calendar_month_summary", "history_day_detail"]) {
  assert.equal(registry.includes(`\"${retiredResource}\"`), false, `${retiredResource} doit sortir du registre actif.`);
}

const calendar = sources["src/features/history-v2/calendar-view.tsx"];
const shell = sources["src/features/history-v2/history-shell.tsx"];
const page = sources["src/features/history-v2/history-v2-page.tsx"];
const overlay = sources["src/features/history-v2/overlay-host.tsx"];
const renderers = sources["src/features/history-v2/renderers.tsx"];
const css = sources["src/features/history-v2/history-v2.module.css"];

assert.match(overlay, /function JournalPanel[\s\S]+scope: scope\(yearMonthOf\(date\)\)[\s\S]+params: \{ date \}/,
  "JournalPanel doit continuer à résoudre le scope depuis la date réelle du Journal externe.");

assert.match(calendar, /setTimeout\(\(\) => \{[^}]+setHoverOpen\(true\); \}, 300\)/);
assert.match(calendar, /setTimeout\(\(\) => setHoverOpen\(false\), 125\)/);
assert.match(shell, /narrativeCarousel/);
assert.match(shell, /model\.highlights[\s\S]+legacy-event/, "Le code NEW doit continuer à présenter les highlights d'un snapshot OLD sans parser permissif.");
assert.match(shell, /calendarFilterPresetRegistry/);
assert.match(shell, /role="tablist"/);
assert.equal((shell.match(/role="tab"/g) ?? []).length, 2, "Calendrier/Bilan doivent former deux tabs accessibles.");
assert.match(shell, /aria-selected=\{view === "calendar"\}/);
assert.match(shell, /aria-selected=\{view === "balance"\}/);
assert.match(shell, /Débits/);
assert.match(shell, /Dépenses/);
assert.match(css, /animation: hover-in 150ms/);
assert.match(css, /animation-duration: 210ms/);
assert.match(css, /grid-template-columns: repeat\(7/);
assert.match(css, /grid-auto-rows: 20px/);
assert.match(css, /ribbonRail:empty[^}]+display: none/s, "Une semaine sans Ribbon ne doit pas réserver quatre lanes.");
assert.match(css, /overlayJournal[^}]+700px/s);
assert.match(css, /overlayStandard[^}]+640px/s);
assert.match(css, /overlayMoment[^}]+680px/s);
assert.match(css, /overlayPlace[^}]+600px/s);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(calendar, /items=\{day\.visibleMarkers\}/, "Le filtre ne doit jamais partir du préfixe visibleMarkers déjà tronqué.");
assert.match(calendar, /day\.orderedMarkerGroups/);
assert.match(calendar, /projectFilteredMarkers\(day\.orderedMarkerGroups, filters, limit\)/, "Month/Week doivent utiliser la projection filtrée déterministe.");
assert.match(sources["src/features/history-v2/marker-projection.ts"], /ordered\.filter/);
assert.match(sources["src/features/history-v2/marker-projection.ts"], /filtered\.slice\(0, limit\)/, "La projection filtre l'ordre publié puis prend le préfixe Month/Week.");
assert.equal((calendar.match(/<FilteredMarkerList day=\{day\} limit=\{6\}/g) ?? []).length, 2, "Month et Week doivent afficher jusqu'à six Markers.");
assert.doesNotMatch(calendar, /\.sort\(/, "React ne doit pas re-trier les Markers.");
assert.match(all, /hidden\.status === "PARTIAL"[\s\S]+observés/, "Un overflow PARTIAL doit rester explicitement observé, jamais présenté comme total exact.");
assert.match(calendar, /HistorySemanticIcon/, "Les iconKey Calendar doivent être projetées en icônes UI.");
assert.doesNotMatch(calendar, />\s*\{(?:item|segment)\.iconKey\}\s*</, "Aucun iconKey ne doit être rendu comme texte visible.");
assert.match(css, /-webkit-line-clamp: 2/, "Les titres Marker doivent être limités à deux lignes.");
const dayCellRule = css.match(/\.dayCell, \.weekDay \{([^}]+)\}/s)?.[1] ?? "";
assert.match(dayCellRule, /min-height:\s*112px/, "Les cellules doivent conserver une hauteur minimale.");
assert.doesNotMatch(dayCellRule, /(?:^|;)\s*(?:height|max-height|overflow)\s*:/, "La cellule ne doit pas empêcher sa croissance verticale.");
assert.doesNotMatch(css, /\.calendarGridRow[^}]*grid-auto-rows\s*:/s, "Une ligne Calendar ne doit pas imposer de hauteur fixe.");
assert.match(calendar, /overflow\.items\.map/, "Le menu Ribbon doit rendre directement la collection serveur.");
assert.match(calendar, /onTarget\(item\.targetRef\)/, "La navigation Ribbon doit consommer la cible serveur exacte.");
assert.match(calendar, /onTarget\(segment\.targetRef\)/, "Les Ribbons visibles doivent eux aussi consommer targetRef.");
assert.doesNotMatch(calendar, /overflow\.items[^\n]+(?:title|segmentStart)[^\n]+(?:find|filter)/, "React ne doit pas reconstruire l'identité Ribbon par titre/date.");
assert.doesNotMatch(all, /\.sort\(/, "Aucun tri métier client n’est autorisé.");
assert.doesNotMatch(all, /gaspillage|économie possible/i);
assert.doesNotMatch(shell, /Carrefour|merchant|rawBankLabel|localizedAmount\.data\.value\s*[<>]/i, "Le carrousel ne doit utiliser aucune heuristique de nom, marchand ou montant.");

const balance = sources["src/features/history-v2/balance-view.tsx"];
const presentation = sources["src/features/history-v2/presentation.ts"];
assert.doesNotMatch(calendar, /Partiel|Observé :/, "Les cellules mensuelles ne doivent pas répéter la qualité technique.");
assert.match(calendar, /formatCalendarDay\(day\.date, !day\.inSelectedMonth\)/, "Le mois courant affiche le jour seul et les jours externes gardent le mois.");
assert.match(calendar, /partialDisplay="value-only"/, "Le montant Calendar doit conserver PARTIAL sans badge dans la cellule.");
assert.match(calendar, /<PartialDataNote metric=\{metric\}/, "Le Hover doit conserver une note de qualité humaine.");
assert.doesNotMatch(calendar, /<UnassignedTiming|function UnassignedTiming|styles\.unassignedTiming/, "Le bandeau UnassignedTiming ne doit plus être rendu.");

assert.doesNotMatch(overlay, /Niveau \$\{|Niveau 1 sur 6|subtitle=\{`Niveau/, "La profondeur logique ne doit pas être visible.");
assert.match(overlay, /expenseDisplayTitle\(item\)/, "Le titre de dépense doit utiliser la hiérarchie de présentation.");
assert.match(overlay, /Voir le libellé bancaire/, "Le libellé brut doit rester secondaire et accessible.");
assert.doesNotMatch(overlay, /item\.label\.(?:split|match|replace)|new RegExp\([^)]*item\.label/, "Le frontend ne doit pas parser le libellé bancaire.");
assert.match(overlay, /Dépenses du jour/, "La collection otherExpenses doit avoir un titre humain.");
assert.match(overlay, /Données partielles|PartialDataNote/, "Le Journal doit conserver une note PARTIAL secondaire.");

for (const label of ["Habituel", "Minimum estimé", "Zone habituelle", "Comprendre l’écart avec mon compte"]) assert.match(balance, new RegExp(label));
assert.doesNotMatch(balance, /<span className="eyebrow">M[1-4]<\/span>/, "M1–M4 ne doivent plus être visibles.");
assert.match(balance, /freshness === "MISSING"\) return null/, "Le résumé IA absent ne doit produire aucun placeholder.");
assert.doesNotMatch(balance, /category\.material/, "Le badge Significatif ne doit plus être rendu.");
assert.match(balance, /shouldShowMoneyNode\(model\.unclassifiedAmount\)/, "Un montant non classé KNOWN(0) doit être masqué.");

for (const label of ["CONSTRAINED", "INDISPENSABLE", "OPTIONAL", "FIXED", "VARIABLE", "CURRENT_LIFE", "OUT_OF_DAILY"]) {
  assert.match(presentation, new RegExp(`${label}:`), `Traduction M3 absente pour ${label}.`);
}
assert.match(balance, /spendingPresentationLabel\(bucket\.key\)/, "Les buckets M3 doivent passer par le dictionnaire de présentation.");
assert.doesNotMatch(balance, />\{bucket\.key\}</, "Aucun enum M3 brut ne doit être rendu.");
assert.match(balance, /className=\{styles\.contributorList\}[\s\S]+<div key=/, "Les contributeurs doivent être présentés en lignes.");
assert.match(balance, /% du mois/, "La part M3 doit utiliser un vocabulaire humain.");
assert.doesNotMatch(balance, /bucket\.amount\s*\/|Number\(bucket\.amount\)/, "React ne doit pas recalculer la part M3.");
assert.match(balance, /matrixOpen/, "La matrice M3 doit être repliable avec un état local.");
assert.match(balance, /Marge ajustable maintenant/);
assert.match(balance, /Marge ajustable à moyen terme/);

assert.doesNotMatch(balance, /item\.score|place\.score|highlightRank|occurrence\(s\)|Aucun coût qualifié/, "M4 ne doit plus afficher ses métadonnées techniques.");
assert.match(balance, /fois ce mois/, "Les occurrences M4 doivent utiliser une formulation naturelle.");
assert.match(balance, /formatFrenchDateRange\(moment\.startDate/, "Les dates Moment doivent être françaises.");
assert.match(balance, /HistorySemanticIcon iconKey=\{moment\.fallbackIconKey\}/, "Le fallback Moment doit être sémantique.");
assert.doesNotMatch(balance, /place\.momentCount/, "Les cartes Lieux ne doivent plus afficher 0 moment(s).");

assert.match(page, /\.slice\(-6\)/, "La pile logique est bornée à six niveaux.");
assert.match(page, /findIndex\(\(entry\) => overlayTargetKey/, "Les cycles doivent être repliés.");
assert.match(page, /router\.back\(\)/, "Le Back sémantique doit utiliser l’historique navigateur.");
assert.match(page, /historyTransientDismissEvent/, "Les popovers temporaires doivent être exclusifs.");
assert.equal((page.match(/<HistoryOverlayHost\b/g) ?? []).length, 1, "Un seul overlay physique est autorisé.");
assert.match(overlay, /closeOnBackdrop/);
assert.match(overlay, /yearMonthOf\(date\)/, "Un jour hors mois doit lire son mois économique propriétaire.");
assert.match(overlay, /Ouvrir le Journal/, "Une occurrence d’activité datée doit ouvrir son Journal.");
for (const label of ["Nécessité", "Fixe-Variable", "Contexte"]) assert.match(overlay, new RegExp(label));
assert.match(overlay, /model\.classificationViews\[tab\]/, "Les tabs Category doivent rendre la projection serveur.");
assert.doesNotMatch(overlay, /classificationViews[^\n]+(?:reduce|groupBy|sort)/, "React ne doit ni regrouper ni renormaliser les classifications.");
assert.match(shell, />Calendrier<\/button>[\s\S]+>Bilan<\/button>/, "Le toggle local Calendrier/Bilan doit être présent.");
assert.match(page, /BalanceMonthView/);
assert.match(page, /historyMinimalPreview/, "MinimalPreview doit rester un drill-down lazy.");
for (const resource of ["historyMonthBalanceSummary", "historyMonthCategories", "historyMonthSpendingNature", "historyMonthLifeMoney"]) {
  assert.match(canonicalRoute, new RegExp(`queryResourceKeys\\.${resource}\\b`), `${resource} doit être chargé uniquement pour Bilan.`);
}
assert.match(canonicalRoute, /if \(view === "calendar"\)[\s\S]+historyMonthCalendar[\s\S]+historyWeek[\s\S]+historyMonthOverview[\s\S]+else \{[\s\S]+historyMonthOverview[\s\S]+historyMonthBalanceSummary[\s\S]+historyMonthCategories[\s\S]+historyMonthSpendingNature[\s\S]+historyMonthLifeMoney/,
  "La route doit séparer strictement les chargements Calendar/Week et Bilan.");
assert.match(canonicalRoute, /historyMonthOverview/);
assert.match(routeState, /calendarFilterPresetRegistry/);
assert.match(routeState, /parseHistoryCalendarFilters/);
assert.match(routeState, /input\.view === "balance"\) query\.set\("view", "balance"\)/);
assert.match(canonicalRoute, /rawView !== undefined && rawView !== "balance"/, "view=calendar doit être canonisé vers l'URL Calendar sans view.");
assert.match(page, /router\.replace/);
assert.match(page, /scroll: false/);
assert.match(shell, /aria-label=\{`Ouvrir les filtres de \$\{accessibleMonthLabel\}`\}/);
assert.match(shell, /toLocaleLowerCase\("fr-FR"\)/, "Le libellé accessible doit produire « Ouvrir les filtres de juillet 2026 ».");
assert.match(shell, /aria-haspopup="dialog"/);
assert.match(shell, /aria-expanded=\{filtersOpen\}/);
for (const label of ["Tout", "Sans charges fixes", "Quotidien", "Temps forts", "Dépenses"]) assert.match(shell, new RegExp(label));
assert.doesNotMatch(shell, /<fieldset|type="checkbox"|type="radio"|>\s*Filtres\s*</, "Le panneau doit contenir seulement les cinq presets et aucun bouton Filtres séparé.");
assert.match(shell, /customSelection === true/);
assert.match(shell, /setFiltersOpen\(false\)[\s\S]+filterTriggerRef\.current\?\.focus/);
assert.match(shell, /function NarrativeAmount/);
assert.match(shell, /metric\.status !== "KNOWN" && metric\.status !== "PARTIAL"/);
assert.doesNotMatch(shell.match(/function NarrativeAmount[\s\S]+?\n\}/)?.[0] ?? "", /DisplayState|Indisponible|\?\?\s*0/, "Un coût narratif non disponible ne doit rien rendre.");
assert.match(shell, /compactNarrativeTitle\(card\.title, card\.startDate, card\.endDate\)/);
assert.match(css, /grid-template-columns: 42px minmax\(0, 1fr\) max-content/);
assert.match(css, /narrativeAmount[^}]+white-space: nowrap/s);
assert.match(sources["src/features/history-v2/balance-view.tsx"], /Publication incompatible/);
assert.match(sources["src/features/history-v2/balance-view.tsx"], /publicationMetasAreCoherent/);
assert.match(sources["src/features/history-v2/balance-view.tsx"], /bucket\.shareOfActual/, "M3 doit afficher shareOfActual publié par le serveur.");
assert.doesNotMatch(sources["src/features/history-v2/balance-view.tsx"], /bucket\.amount\s*\/|Number\(bucket\.amount\)/, "M3 ne doit pas recalculer shareOfActual dans React.");
assert.match(sources["src/features/history-v2/balance-view.tsx"], /"segments" in model/, "Le frontend de transition doit distinguer M3 OLD et NEW.");
assert.match(sources["src/features/history-v2/balance-view.tsx"], /projection\.contributors/, "Les contributeurs M3 doivent venir du ReadModel NEW.");
assert.match(renderers, /Impossible de charger/);
assert.match(renderers, /Réessayer/);
assert.match(renderers, /status === "KNOWN"/);
assert.match(renderers, /status === "PARTIAL"/);
assert.match(renderers, /status === "NOT_APPLICABLE"/);
assert.match(renderers, /status === "CONFLICT"/);
assert.match(renderers, /visibility === "HIDDEN"/);
assert.match(renderers, /visibility === "PLACEHOLDER"/);

const filterContract = read("src/core/history-v2/calendar-filter.ts");
const finalUxRequirements = [
  ["canonical route", canonicalRoute, /historyMonthCalendar[\s\S]+historyMonthOverview/],
  ["week resources", canonicalRoute, /historyWeek[\s\S]+historyMonthOverview/],
  ["Calendar and Balance surfaces", page, /initialState\.kind === "calendar"[\s\S]+initialState\.kind === "week"[\s\S]+initialState\.kind === "balance"/],
  ["local Calendar Balance toggle", shell, /role="tablist"[\s\S]+Calendrier[\s\S]+Bilan/],
  ["bank/economic header", shell, /Débits[\s\S]+Dépenses/],
  ["manual and timed narrative carousel", shell, /setInterval[\s\S]+7_000/],
  ["five presets", filterContract, /all:[\s\S]+daily:[\s\S]+highlights:[\s\S]+"exclude-fixed":[\s\S]+expenses:/],
  ["ten authoritative tags", filterContract, /UNASSIGNED_TIMING/],
  ["URL filters", routeState, /preset[\s\S]+show[\s\S]+amount/],
  ["filter then prefix", sources["src/features/history-v2/marker-projection.ts"], /ordered\.filter[\s\S]+filtered\.slice\(0, limit\)/],
  ["generic overlay", routeState, /historyDayJournal[\s\S]+historyMomentDetail[\s\S]+historyActivityDetail[\s\S]+historyPlaceDetail/],
  ["one physical overlay", page, /<HistoryOverlayHost\b/],
  ["month filter trigger", shell, /Ouvrir les filtres de/],
  ["unassigned timing hidden", calendar, /CalendarMonthView/],
  ["reduced motion", css, /prefers-reduced-motion: reduce/],
];
for (const [label, source, proof] of finalUxRequirements) {
  assert.match(source, proof, `Contrat UX final absent: ${label}.`);
}

console.log(`History V2 consumed logical resources: ${historyV2Resources.length}/15`);
console.log(`History V2 retained logical resource contracts: ${retainedHistoryV2Resources.length}/15`);
console.log(`History V2 final UX frontend contracts: ${finalUxRequirements.length}/${finalUxRequirements.length}`);
console.log("HISTORY_V2_FRONTEND_CONTRACT_CHECK=PASS");
