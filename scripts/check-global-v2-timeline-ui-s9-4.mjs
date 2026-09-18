import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const timeline = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const comparator = timeline.slice(timeline.indexOf("export function TimelineComparator"), timeline.indexOf("function TimelineV2EventRow"));
const card = timeline.slice(timeline.indexOf("function TimelineV2EventRow"), timeline.indexOf("function TimelineEventRow"));
const lifeTimeline = timeline.slice(timeline.indexOf("export function LifeTimeline"));
let checks = 0;
const check = (run) => { run(); checks += 1; };

check(() => assert.match(lifeTimeline, /<TimelineLoadingSkeleton \/>/u));
check(() => assert.doesNotMatch(lifeTimeline, />Chargement de la timeline…<\/div>/u));
check(() => assert.match(comparator, /<TimelineComparatorLoading \/>/u));
check(() => assert.doesNotMatch(comparator, />Chargement de la comparaison…<\/p>/u));
check(() => assert.match(timeline, /timelineVisuallyHidden[^>]*>Chargement de la timeline/u));
check(() => assert.match(timeline, /timelineVisuallyHidden[^>]*>Chargement de la comparaison/u));
check(() => assert.match(css, /\.timelineLoading\s*\{[^}]*min-height:\s*clamp\(520px, 62vh, 680px\)/u));
check(() => assert.match(css, /\.timelineComparatorLoading\s*\{[^}]*min-height:\s*152px/u));
check(() => assert.match(css, /@keyframes timelineShimmer/u));
check(() => assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*\.01ms !important/u));
check(() => assert.match(css, /scrollbar-gutter:\s*stable/u));
check(() => assert.match(css, /\.timelineMonth li > button:hover \.timelineMarker/u));
check(() => assert.match(card, /const canExpand = expenseRows\.length > 0 && comparisonAvailable/u));
check(() => assert.doesNotMatch(`${timeline}\n${css}`, /SAME_GRAND_FAMILY|medianMoney|moneyQuartiles|MedianAbsoluteDeviation|computeMateriality/u));

console.log(`Global V2 Timeline final polish S9.4: ${checks}/${checks} PASS`);
