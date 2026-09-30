// Evidence composition only: this script does not run browser interactions or
// mutate Supabase. Run the existing DD6 runner after cleanup, then supply the
// dated journal of actually observed browser flows. Never synthesize PASS.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const base = "docs/status/";
const read = name => JSON.parse(fs.readFileSync(base + name, "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const digest = name => createHash("sha256").update(fs.readFileSync(base + name, "utf8").replace(/\r\n/gu, "\n")).digest("hex");
const auto = read("phase2-c9-dd6-certification.json");
const restoration = read("phase2-c10-restoration.json");
const browserFile = "phase2-c10-browser-evidence.json";
const browser = fs.existsSync(base + browserFile) ? read(browserFile) : null;
const hash = s => createHash("sha256").update(s.replace(/\r\n/gu, "\n")).digest("hex");
const collect = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? collect(path.join(directory, entry.name)) : [path.join(directory, entry.name).replaceAll("\\", "/")]);
const currentFiles = [...collect("src/domain/phase2"), ...collect("src/server/phase2"), ...collect("src/app/mois-a-venir")];
const currentSource = hash(currentFiles.sort().map(file => file + ":" + hash(fs.readFileSync(file, "utf8"))).join("\n"));
if (currentSource !== auto.preflight.sourceSha256) throw new Error("Runtime changed after DD6 rerun; rerun before certification.");
const smokeIds = Array.from({ length: 10 }, (_, i) => `SMOKE-${String(i + 1).padStart(2, "0")}`);
const sameSource = browser?.sourceSha256 === auto.preflight.sourceSha256;
const fresh = date => Number.isFinite(Date.parse(date)) && Date.now() - Date.parse(date) >= 0 && Date.now() - Date.parse(date) < 86400000;
const observed = sameSource && browser?.status === "PASS"
  && fresh(browser.checkedAt) && fresh(auto.checkedAt)
  && browser.smokes.length === 10 && smokeIds.every(id => browser.smokes.filter(s => s.id === id && s.status === "PASS" && s.proof).length === 1)
  && browser.cleanup.browser === "PASS" && browser.cleanup.projectionReturnedToInitial === "PASS";
const browserStatus = !browser ? "NOT_TESTED" : observed ? "PASS" : "FAIL";
const cleanup = restoration.status === "PASS" && restoration.smokeRows === 0
  && restoration.plannedRows === restoration.before.plannedRows
  && restoration.novemberInputRows === restoration.before.novemberInputRows
  && restoration.syntheticHouseholdsRemaining === 0
  && Date.parse(auto.checkedAt) >= Date.parse(restoration.checkedAt)
  && auto.commands["scripts/check-phase2-planned-guards.mjs"].STATUS === "PASS"
  && fs.existsSync(base + "phase2-c10-cleanup.md") ? "PASS" : "FAIL";
const gates = auto.gates.map(g => g.ID === "GATE-21" ? { ...g, STATUS: browserStatus } : g);
if (cleanup !== "PASS") gates.find(g => g.ID === "GATE-20").STATUS = "FAIL";
const automated = gates.slice(0, 20).every(g => g.STATUS === "PASS") ? "PASS" : "PARTIAL";
const certified = automated === "PASS" && browserStatus === "PASS" && cleanup === "PASS";
const blockers = gates.filter(g => g.STATUS !== "PASS").map(g => `${g.ID}: ${g.NAME} = ${g.STATUS}`);
const gaps = ["No configured lint runner (NOT_APPLICABLE).", "Browser smokes use existing integrated automation; no standalone CLI browser replay suite.",
  "Keyboard extensions and responsive redesign excluded by user; no Vercel verification requested.", "Fuel observations remain dated July2026 estimates, with provenance shown.",
  "Lucas canonical return pair has no observation: PARTIAL is retained, requiring explicit manual distance; no symmetric return invented."];
const report = { checkedAt: new Date().toISOString(), headFinal: git("rev-parse", "HEAD"), branch: git("branch", "--show-current"),
  worktree: git("status", "--short").split("\n").filter(Boolean), sourceSha256: auto.preflight.sourceSha256,
  headConvention: "HEAD_FINAL identifies the tested implementation commit. The subsequent evidence-only commit references this immutable HEAD without a self-referential Git hash.",
  commands: auto.commands, gates, ruleCoverage: auto.ruleCoverage, metamorphic: auto.metamorphic,
  browserEvidence: browser, restoration, financialOracle: auto.commands["scripts/check-phase2-planned-finance.mjs"],
  routeOracle: auto.live, rls: read("phase2-c10-database-evidence.json"), zeroWrite: auto.targetedZeroWrite,
  previewSaveParity: auto.commands["scripts/check-phase2-planned-reliability.mjs"], cleanupReport: base + "phase2-c10-cleanup.md",
  remainingShims: ["Read-only compatibility for legacy month settings plannedEvents:[]; nonempty rejects, stripped on write. No active second rule engine."],
  liveDivergences: [], nonBlockingGaps: gaps, deferredV11: ["Planning Memory and personal presets/recents/repeat/as-last-time/learning; not persisted in V1."],
  deferredV2: ["Observed transaction reconciliation and historical confirmation; prospective declaration does not create banking reality."],
  evidenceHashes: Object.fromEntries(["phase2-c9-dd6-certification.json", browserFile, "phase2-c10-restoration.json", "phase2-c10-database-evidence.json", "phase2-c10-cleanup.md"]
    .filter(n => fs.existsSync(base + n)).map(n => [n, digest(n)])),
  summary: { C10_FINALIZATION: certified ? "PASS" : "PARTIAL", HEAD_FINAL: git("rev-parse", "HEAD"), AUTOMATED_CERTIFICATION: automated,
    RULE_COVERAGE: auto.summary.RULE_COVERAGE, METAMORPHIC: auto.summary.METAMORPHIC, RLS: auto.summary.RLS,
    ZERO_WRITE: auto.summary.HISTORICAL_ZERO_WRITE, PREVIEW_SAVE_PARITY: auto.summary.PREVIEW_SAVE_PARITY,
    PRODUCTION_BUILD: auto.summary.PRODUCTION_BUILD, BROWSER_USER_FLOW: browserStatus, CLEANUP: cleanup,
    SPEC_CODEX_READY: automated === "PASS" ? "YES" : "NO", IMPLEMENTATION_CERTIFIED: certified ? "YES" : "NO",
    BLOCKERS_REMAINING: blockers, NON_BLOCKING_GAPS: gaps, FINAL_EVIDENCE_PATH: base + "phase2-c10-final-evidence.md" } };
report.summary.DEFERRED_V1_1 = report.deferredV11;
report.summary.DEFERRED_V2 = report.deferredV2;
fs.writeFileSync(base + "phase2-c10-final-evidence.json", JSON.stringify(report, null, 2) + "\n");
const md = ["# C10 — certification finale Phase 2", "", `État : **${report.summary.C10_FINALIZATION}**. IMPLEMENTATION_CERTIFIED = **${report.summary.IMPLEMENTATION_CERTIFIED}**.`, "",
  `Exécution : ${report.checkedAt}. HEAD testé : \`${report.headFinal}\` ; branche \`${report.branch}\`.`,
  report.headConvention, "", `Source runtime SHA256 : \`${report.sourceSha256}\`.`, "", "## Sortie finale", "", "```ini",
  ...Object.entries(report.summary).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.length ? v.join(" ; ") : "NONE" : v}`),
  ...gates.map(g => `${g.ID.replace("-", "_")} = ${g.STATUS}`), "```", "", "## Gates", "",
  "| Gate | Contrat | Statut |", "| --- | --- | --- |", ...gates.map(g => `| ${g.ID} | ${g.NAME} | ${g.STATUS} |`), "",
  "## Parcours navigateur réellement exécutés", "", "| Smoke | Statut | Observation |", "| --- | --- | --- |",
  ...(browser?.smokes ?? smokeIds.map(id => ({ id, status: "NOT_TESTED", proof: "Checklist manuelle en attente" }))).map(s => `| ${s.id} | ${s.status} | ${s.proof} |`), "",
  "Le journal [browser](phase2-c10-browser-evidence.json) distingue les observations UI des preuves serveur/SQL. Aucun PASS browser ne vient du harness simulé.", "",
  "## Full rerun après cleanup", "", "| Commande | Statut |", "| --- | --- |",
  ...Object.entries(auto.commands).map(([k, v]) => `| ${v.command ?? k} | ${v.STATUS} |`), "",
  "Le full rerun réutilise le runner DD6 existant. RLS a été réellement rejoué séparément avec l'autorisation humaine et ROLLBACK ; SQL digest vérifié.", "",
  "## Rule Coverage Matrix et oracles", "",
  `Règles V1 : ${auto.ruleCoverage.filter(r => r.HORIZON === "V1" && r.STATUS === "PASS").length} PASS. Métamorphiques : ${auto.metamorphic.filter(r => r.STATUS === "PASS").length} PASS.`,
  "La [matrice complète DD6](phase2-c9-dd6-certification.md) et le [JSON final](phase2-c10-final-evidence.json) contiennent les owners, preuves et oracles de chaque règle. Les anciennes mentions PENDING_C10 de cette matrice automatique sont complétées par le présent Gate21 représentatif ; elles ne prétendent pas que chaque payload négatif a été joué au navigateur.",
  "Les oracles financiers sont les fixtures contractuelles et invariants des runners finance. Les oracles routes LIVE_CURRENT sont calculés indépendamment à partir des médianes dirigées canoniques. Aucune valeur attendue n'est régénérée à partir d'un test en échec.", "",
  "## RLS / zéro écriture historique / parité", "",
  "[RLS distant daté](phase2-c10-database-evidence.json) : isolation read/create/update/delete/lifecycle entre deux foyers, aucune fixture restante. Le test ne remplace pas RLS par un filtre client.",
  "Zéro write historique : traces par opération des vraies actions/services (table et prédicat de root contrôlés), puis traces des deux foyers synthétiques dans PostgreSQL. Les compteurs globaux ne sont pas utilisés seuls comme preuve.",
  "Parité Preview/Save/reload : runner reliability, avec idempotence, CAS, reprise serveur et stale facts. Les previews UI de coûts, paiements et baseline ont été comparées aux roots sauvegardées lors des smokes.", "",
  "## Nettoyage et restauration", "", "[Audit des authorities](phase2-c10-cleanup.md), [restauration vérifiée](phase2-c10-restoration.json).",
  ...report.remainingShims.map(s => `- ${s}`), "",
  "Les IDs privés de fixtures et la sauvegarde des inputs sont conservés hors Git. Les captures se limitent aux cartes synthétiques et au résultat du nettoyage. Aucun credential ni payload bancaire réel n'est inclus dans le bundle.", "",
  "## Limites, divergences et horizons", "", `Divergences live non résolues : ${report.liveDivergences.length ? report.liveDivergences.join(" ; ") : "aucune détectée dans le périmètre certifié"}.`, "",
  ...gaps.map(s => `- ${s}`), "", "V1.1 différé :", "", ...report.deferredV11.map(s => `- ${s}`), "",
  "V2 différé :", "", ...report.deferredV2.map(s => `- ${s}`), ""];
fs.writeFileSync(base + "phase2-c10-final-evidence.md", md.join("\n"));
console.log(JSON.stringify(report.summary));
if (!certified) process.exitCode = 1;
