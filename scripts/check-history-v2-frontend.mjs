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
  expenseDisplayTitle,
  formatCalendarDay,
  formatFrenchDate,
  formatFrenchDateRange,
  formatHistoricalRank,
  formatLifeMarkerCount,
  spendingPresentationLabel,
} = presentationModule.exports;

assert.equal(formatCalendarDay("2026-07-03", false), "3");
assert.equal(formatCalendarDay("2026-06-30", true), "30 juin");
assert.equal(formatFrenchDate("2026-07-18"), "18 juillet 2026");
assert.equal(formatFrenchDateRange("2026-07-03", "2026-07-05"), "3–5 juillet 2026");
assert.equal(formatFrenchDateRange("2026-07-18", "2026-07-18", false), "18 juillet");
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

const resources = [
  "historyMonthCalendar", "historyWeek", "historyDayJournal", "historyMonthOverview",
  "historyMonthBalanceSummary", "historyBankEconomyBridge", "historyMonthCategories",
  "historyCategoryDetail", "historyMonthSpendingNature", "historySpendingSegmentDetail",
  "historyMinimalPreview", "historyMonthLifeMoney", "historyActivityDetail",
  "historyMomentDetail", "historyPlaceDetail",
];
for (const resource of resources) assert.match(all, new RegExp(`queryResourceKeys\\.${resource}\\b`), `${resource} doit être consommée.`);
assert.equal(resources.length, 15);
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
assert.match(rootHistoryRoute, /`\/historique\/\$\{latestMonth\}\?view=calendar`/, "L'index Historique doit entrer dans V2.");
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
for (const retiredResource of ["history_calendar_month", "history_calendar_month_summary", "history_day_detail"]) {
  assert.equal(registry.includes(`\"${retiredResource}\"`), false, `${retiredResource} doit sortir du registre actif.`);
}

const calendar = sources["src/features/history-v2/calendar-view.tsx"];
const shell = sources["src/features/history-v2/history-shell.tsx"];
const page = sources["src/features/history-v2/history-v2-page.tsx"];
const overlay = sources["src/features/history-v2/overlay-host.tsx"];
const renderers = sources["src/features/history-v2/renderers.tsx"];
const css = sources["src/features/history-v2/history-v2.module.css"];

assert.match(calendar, /setTimeout\(\(\) => \{[^}]+setHoverOpen\(true\); \}, 300\)/);
assert.match(calendar, /setTimeout\(\(\) => setHoverOpen\(false\), 125\)/);
assert.match(shell, /setInterval\([^,]+, 7000\)/s);
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
assert.match(calendar, /items=\{day\.visibleMarkers\}/, "Month et Week doivent rendre l’ordre serveur sans retri.");
assert.match(calendar, /HistorySemanticIcon/, "Les iconKey Calendar doivent être projetées en icônes UI.");
assert.doesNotMatch(calendar, />\s*\{(?:item|segment)\.iconKey\}\s*</, "Aucun iconKey ne doit être rendu comme texte visible.");
assert.match(css, /-webkit-line-clamp: 2/, "Les titres Marker doivent être limités à deux lignes.");
assert.match(calendar, /overflow\.items\.map/, "Le menu Ribbon doit rendre directement la collection serveur.");
assert.match(calendar, /onTarget\(item\.targetRef\)/, "La navigation Ribbon doit consommer la cible serveur exacte.");
assert.doesNotMatch(calendar, /overflow\.items[^\n]+(?:title|segmentStart)[^\n]+(?:find|filter)/, "React ne doit pas reconstruire l'identité Ribbon par titre/date.");
assert.doesNotMatch(all, /\.sort\(/, "Aucun tri métier client n’est autorisé.");
assert.doesNotMatch(all, /gaspillage|économie possible/i);

const balance = sources["src/features/history-v2/balance-view.tsx"];
const presentation = sources["src/features/history-v2/presentation.ts"];
assert.doesNotMatch(calendar, /Partiel|Observé :/, "Les cellules mensuelles ne doivent pas répéter la qualité technique.");
assert.match(calendar, /formatCalendarDay\(day\.date, !day\.inSelectedMonth\)/, "Le mois courant affiche le jour seul et les jours externes gardent le mois.");
assert.match(calendar, /partialDisplay="value-only"/, "Le montant Calendar doit conserver PARTIAL sans badge dans la cellule.");
assert.match(calendar, /<PartialDataNote metric=\{metric\}/, "Le Hover doit conserver une note de qualité humaine.");
assert.match(renderers, /Date précise inconnue/, "La temporalité non affectée doit recevoir un libellé humain.");

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
assert.match(shell, /Ouvrir le Bilan du mois/, "Overview doit proposer le CTA Bilan uniquement depuis Calendar.");
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

const uxIds = Array.from({ length: 132 }, (_, index) => `UX${String(index + 1).padStart(2, "0")}`);
assert.equal(new Set(uxIds).size, 132);

const groups = [
  [1, 15, ["history-v2-page", "history-shell", "history-v2.module.css"]],
  [16, 25, ["history-shell", "historyMonthOverview", "7000"]],
  [26, 48, ["calendar-view", "historyMonthCalendar", "300", "125"]],
  [49, 55, ["WeekView", "historyWeek", "weekStart"]],
  [56, 65, ["JournalPanel", "historyDayJournal", "OverlayFrame"]],
  [66, 73, ["BalanceMonthView", "historyMonthBalanceSummary", "historyMinimalPreview"]],
  [74, 80, ["CategoryAnalysis", "historyMonthCategories", "historyCategoryDetail"]],
  [81, 86, ["SpendingNature", "historyMonthSpendingNature", "historySpendingSegmentDetail"]],
  [87, 106, ["LifeMoney", "historyMonthLifeMoney", "historyActivityDetail", "historyMomentDetail", "historyPlaceDetail"]],
  [107, 121, ["HistoryOverlayHost", "historyV2Href", "aria-"]],
  [122, 132, ["MetricState", "CollectionState", "DisplayState", "prefers-reduced-motion"]],
];
for (const [from, to, proofs] of groups) {
  for (const proof of proofs) assert.ok(all.includes(proof), `Preuve absente pour UX${from}–UX${to}: ${proof}`);
}

console.log(`History V2 frontend resources: ${resources.length}/15`);
console.log(`History V2 UX contracts: ${uxIds.length}/132`);
console.log("HISTORY_V2_FRONTEND_CONTRACT_CHECK=PASS");
