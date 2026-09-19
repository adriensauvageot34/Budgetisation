import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const timeline = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const range = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const card = timeline.slice(timeline.indexOf("function TimelineV2EventRow"), timeline.indexOf("function TimelineEventRow"));
let checks = 0;
const check = (run) => { run(); checks += 1; };

check(() => assert.doesNotMatch(range, /comparisonRangeLegend|comparisonRangeHint/u));
check(() => assert.doesNotMatch(range, /Survolez un point|<figcaption/u));
check(() => assert.doesNotMatch(range, /subjectLabel \?\?|comparisonRangeMedianKey|comparisonRangeObservedKey/u));
check(() => assert.match(range, /selected === undefined \? null : <article/u));
check(() => assert.match(range, /comparisonRangePreview/u));
check(() => assert.match(range, /comparisonRangeMedianLabel[\s\S]*<small>Médiane<\/small>/u));
check(() => assert.match(range, /comparisonRangeObservedLabel[\s\S]*<small>Vous<\/small>/u));
check(() => assert.match(css, /\.timelineMonth li > button, \.timelineMonth li > article\s*\{[^}]*grid-template-columns:\s*34px 46px minmax\(0, 3fr\) minmax\(0, 2fr\) 18px/u));
check(() => assert.match(css, /\.timelineExpensePreview\s*\{[^}]*grid-column:\s*4[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u));
check(() => assert.match(css, /\.timelineExpensePreview\s*\{[^}]*grid-auto-flow:\s*row[^}]*max-height:\s*54px[^}]*overflow-y:\s*auto/u));
check(() => assert.match(css, /li\[data-has-expenses="false"\][^}]*grid-template-columns:\s*34px 46px minmax\(0, 1fr\)/u));
check(() => assert.match(card, /const canExpand = expenseRows\.length > 0 && comparisonAvailable/u));
check(() => assert.match(card, /expenseRows\.length > 0 \? <TimelineExpenses rows=\{expenseRows\} compact/u));
check(() => assert.doesNotMatch(`${timeline}\n${range}`, /medianMoney|moneyQuartiles|MedianAbsoluteDeviation|computeMateriality/u));

console.log(`Global V2 Timeline final UI fixes S9.5: ${checks}/${checks} PASS`);
