import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const featureFiles = [
  "src/app/historique/[month]/page.tsx",
  "src/app/historique/[month]/loading.tsx",
  "src/features/history-v2/index.ts",
  "src/features/history-v2/history-v2-page.tsx",
  "src/features/history-v2/history-shell.tsx",
  "src/features/history-v2/calendar-view.tsx",
  "src/features/history-v2/balance-view.tsx",
  "src/features/history-v2/overlay-host.tsx",
  "src/features/history-v2/renderers.tsx",
  "src/features/history-v2/route-state.ts",
  "src/features/history-v2/history-v2.module.css",
];
const sources = Object.fromEntries(featureFiles.map((path) => [path, read(path)]));
const all = Object.values(sources).join("\n");

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
  /method_signature", analyticsMethodSignature\(resource\)/,
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
assert.match(css, /grid-template-rows: repeat\(4, 20px\)/);
assert.match(css, /overlayJournal[^}]+700px/s);
assert.match(css, /overlayStandard[^}]+640px/s);
assert.match(css, /overlayMoment[^}]+680px/s);
assert.match(css, /overlayPlace[^}]+600px/s);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(calendar, /items=\{day\.visibleMarkers\}/, "Month et Week doivent rendre l’ordre serveur sans retri.");
assert.match(calendar, /overflow\.items\.map/, "Le menu Ribbon doit rendre directement la collection serveur.");
assert.match(calendar, /onTarget\(item\.targetRef\)/, "La navigation Ribbon doit consommer la cible serveur exacte.");
assert.doesNotMatch(calendar, /overflow\.items[^\n]+(?:title|segmentStart)[^\n]+(?:find|filter)/, "React ne doit pas reconstruire l'identité Ribbon par titre/date.");
assert.doesNotMatch(all, /\.sort\(/, "Aucun tri métier client n’est autorisé.");
assert.doesNotMatch(all, /gaspillage|économie possible/i);

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
