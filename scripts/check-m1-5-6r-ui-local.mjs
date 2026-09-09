import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    if (/\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try { return next(candidate, context); } catch { /* continue */ }
    }
    throw error;
  }
} });

const ui = await import("../src/features/global-v2/economic-ui.ts");
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const quality = (knowledgeState) => ({ knowledgeState, limitationCodes: [], dataNature: "OBSERVED", methodVersion: "test@v1", inputHash: "a".repeat(64) });
const point = (unitKey, value, knowledgeState = "KNOWN") => ({ unitKey, ...(value === undefined ? {} : { displayValue: `${value} €`, typedMeasure: { kind: "MONEY", value, unit: "EUR/month" } }), phenomenonQuality: quality(knowledgeState), knowledgeState });
const series = [
  { seriesId: "economic:actual", labelKey: "Dépenses réelles", unit: "EUR/month", points: [point("2025-11", "100"), point("2025-12", "120")], evidenceRefs: [] },
  { seriesId: "economic:typical-state", labelKey: "État habituel", unit: "EUR/month", points: [point("2025-11", "90"), point("2025-12", "95")], evidenceRefs: [] },
  { seriesId: "economic:minimal-state", labelKey: "Minimum estimé", unit: "EUR/month", points: [point("2025-11", undefined, "UNKNOWN"), point("2025-12", "70")], evidenceRefs: [] },
];
const chart = ui.economicEvolutionPoints(series);

check(() => assert.equal(chart.length, 2));
check(() => assert.equal(chart[0].actual.availability, "known"));
check(() => assert.equal(chart[0].typical?.availability, "known"));
check(() => assert.equal(chart[0].minimal?.availability, "unknown"));
check(() => assert.equal(chart[1].minimal?.availability, "known"));
check(() => assert.equal(ui.economicValueText({ displayValue: "1 700 €", phenomenonQuality: quality("KNOWN") }), "1 700 €"));
check(() => assert.equal(ui.economicValueText({ phenomenonQuality: quality("UNKNOWN") }, "Socle indisponible"), "Socle indisponible"));
check(() => assert.equal(ui.economicValueText({ displayValue: "1 700 €", phenomenonQuality: quality("CONFLICT") }), "Classification à confirmer"));

const rows = [
  { rowId: "1", labelKey: "Nécessité · Indispensable", displayValue: "80 €", knowledgeState: "KNOWN", evidenceRefs: [] },
  { rowId: "2", labelKey: "Nécessité · Non classé", displayValue: "20 €", knowledgeState: "UNKNOWN", evidenceRefs: [] },
  { rowId: "3", labelKey: "Comportement · Variable", displayValue: "70 €", knowledgeState: "KNOWN", evidenceRefs: [] },
  { rowId: "4", labelKey: "Périmètre de vie · Classification en conflit", displayValue: "10 €", knowledgeState: "CONFLICT", evidenceRefs: [] },
];
const groups = ui.economicStructureGroups(rows);
check(() => assert.deepEqual(groups.map(({ axis }) => axis), ["Nécessité", "Fixe / variable", "Périmètre de vie"]));
check(() => assert.equal(groups.reduce((sum, group) => sum + group.rows.length, 0), 4));
check(() => assert.equal(ui.economicStructureLabel(rows[1]), "À classer"));
check(() => assert.equal(ui.economicStructureLabel(rows[3]), "Classification à confirmer"));

const page = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-page.tsx"), "utf8");
const helper = fs.readFileSync(path.join(root, "src/features/global-v2/economic-ui.ts"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/features/global-v2/catalog.ts"), "utf8");
const fixture = fs.readFileSync(path.join(root, "src/features/global-v2/fixture-data.ts"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");

check(() => assert.match(catalog, /title: "Nos dépenses"/u));
check(() => assert.doesNotMatch(catalog, /title: "Votre économie"|shortLabel: "Économie"/u));
check(() => assert.match(fixture, /"3124\.235"[\s\S]*"1634\.0783333333333"[\s\S]*"1490\.1566666666667"[\s\S]*"3773\.14"/u));
check(() => assert.match(page, /maximumFractionDigits: 0/u));
check(() => assert.match(page, /Notre mois habituel[\s\S]*Nos dépenses minimum[\s\S]*Notre marge/u));
check(() => assert.match(page, /dépensés[\s\S]*par rapport à notre niveau habituel avant \{targetMonthName\}/u));
check(() => assert.match(page, /Nos dépenses sur 12 mois/u));
check(() => assert.match(page, /Dépenses réelles[\s\S]*Niveau habituel[\s\S]*Nos dépenses minimum/u));
check(() => assert.match(page, /Tendance sur l’année[\s\S]*Hausse récente[\s\S]*Écart entre nos mois extrêmes/u));
check(() => assert.match(page, /Résumé[\s\S]*Évolution[\s\S]*Répartition[\s\S]*Dépenses récurrentes/u));
check(() => assert.match(page, /> Méthode</u));
check(() => assert.match(page, /globalV2MethodRef\(moduleKey\)/u));
check(() => assert.match(catalog, /analysis_global_economic_recurrence_detail/u));
check(() => assert.match(page, /<ReferenceLine y=\{annualMinimum\}/u));
check(() => assert.match(page, /<Line dataKey="actual"[\s\S]*connectNulls=\{false\}/u));
check(() => assert.match(page, /<Line dataKey="typical"[\s\S]*connectNulls=\{false\}/u));
check(() => assert.doesNotMatch(page, /seriesId === "economic:minimal-state"/u));
check(() => assert.doesNotMatch(helper, /numericDisplay|parseFloat|parseInt|displayValue\.replace|displayValue\.match/u));
check(() => assert.doesNotMatch(page, /économies possibles|gaspillage|budget incompressible|Signal principal|Lecture principale|Points à surveiller|Profils récurrents|Principaux contributeurs|Qualité de la donnée|global\.placeholder\./iu));
check(() => assert.match(page, /Ce que raconte l’année/u));
check(() => assert.match(page, /Selon leur nécessité[\s\S]*Fixes ou variables[\s\S]*Dans notre quotidien/u));
check(() => assert.match(page, /group\.rows\.filter\(\(row\) => \(economicNumber\(row\) \?\? 0\) > 0\)/u));
check(() => assert.match(page, /paiement[\s\S]*observé/u));
check(() => assert.match(page, /economicNumber\(right\)[\s\S]*economicNumber\(left\)/u));
check(() => assert.match(page, /analysis_global_economic_recurrence_detail[\s\S]*EconomicRecurrenceDetail/u));
check(() => assert.match(page, /row\.knowledgeState === "KNOWN" \|\| row\.knowledgeState === "PARTIAL"/u));
check(() => assert.doesNotMatch(page, /Cycle de vie inconnu|Cadence non qualifiée/u));
check(() => assert.match(page, /Période analysée[\s\S]*Limite importante[\s\S]*Détails techniques/u));
check(() => assert.match(css, /@media \(max-width: 767px\)[\s\S]*economicHero[\s\S]*sectionTabs/u));
check(() => assert.match(page, /aria-label="Nos trois repères mensuels"/u));
check(() => assert.doesNotMatch(page, /aria-labelledby="economic-contributors-title"/u));

console.log(`M1 5/6R UI local: ${checks}/${checks} PASS`);
console.log("Minimal annual is a ReferenceLine; visible amounts are rounded; React financial arithmetic: 0; live writes: 0");
