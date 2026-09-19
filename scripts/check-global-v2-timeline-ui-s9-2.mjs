import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({ resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
  try { return nextResolve(target, context); } catch (error) {
    if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) try { return nextResolve(candidate, context); } catch { /* continue */ }
    throw error;
  }
} });

const presentation = await import("../src/features/global-v2/life-timeline-presentation.ts");
let checks = 0;
const check = (run) => { run(); checks += 1; };
const descriptor = (level, relatedPeerCount) => ({ level, label: level, supportStatus: "KNOWN", relatedPeerCount, costPeerCount: relatedPeerCount, materiality: "NOT_MATERIAL" });
const event = {
  eventRef: "moment:techno", sourceKind: "MOMENT", canonicalName: "Soirée techno — Dieze 15 août", startDate: "2025-08-15", endDate: "2025-08-15", visibilityTier: "PRINCIPAL",
  semanticClassification: { taxonomyVersion: "timeline_semantic_taxonomy@v1", close: { key: "soiree_techno_rave", label: "Techno / rave" }, intermediate: { key: "sorties_festives_et_nocturnes", label: "Vie nocturne" }, grand: { key: "sorties_loisirs_et_culture", label: "Sorties, loisirs & culture" } },
  eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: "25.99" }, series: { seriesRef: "series:techno", label: "Soirées techno" },
  comparisonLevels: [descriptor("SAME_GRAND_FAMILY", 50), descriptor("SAME_INTERMEDIATE_FAMILY", 16), descriptor("SAME_CLOSE_FAMILY", 3), descriptor("SAME_SERIES", 3)], momentDetailAvailable: true,
};
const visible = presentation.visibleTimelineComparisonLevels(event, [
  { level: "SAME_SERIES", peerRefs: ["moment:a", "moment:b", "moment:c"] },
  { level: "SAME_CLOSE_FAMILY", peerRefs: ["moment:c", "moment:b", "moment:a"] },
  { level: "SAME_INTERMEDIATE_FAMILY", peerRefs: Array.from({ length: 16 }, (_, index) => `moment:${index}`) },
]);
check(() => assert.deepEqual(visible.map(({ level }) => level), ["SAME_SERIES", "SAME_INTERMEDIATE_FAMILY"]));
check(() => assert.equal(visible.length <= 3, true));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(event, "SAME_SERIES"), "Soirées techno"));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(event, "SAME_INTERMEDIATE_FAMILY"), "Vie nocturne"));
check(() => assert.equal(presentation.hasTimelineComparisonAffordance({ ...event, comparisonLevels: [descriptor("SAME_GRAND_FAMILY", 50)] }), false));

const timeline = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const range = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const v2Card = timeline.slice(timeline.indexOf("function TimelineV2EventRow"), timeline.indexOf("function TimelineEventRow"));
const comparator = timeline.slice(timeline.indexOf("export function TimelineComparator"), timeline.indexOf("function TimelineV2EventRow"));
const lifeTimeline = timeline.slice(timeline.indexOf("export function LifeTimeline"));
check(() => assert.doesNotMatch(v2Card, />Comparer</u));
check(() => assert.match(v2Card, /aria-expanded=\{expanded\}[\s\S]*onClick=\{onToggle\}/u));
check(() => assert.match(lifeTimeline, /focusedEventRef[\s\S]*const nextRef = focusedEventRef === event\.eventRef \? undefined : event\.eventRef[\s\S]*setExpandedEventRef\(nextRef\)[\s\S]*setFocusedEventRef\(nextRef\)/u));
check(() => assert.match(v2Card, /aria-controls=\{detailsId\} onClick=\{onToggle\}>\{content\}<\/button>/u));
check(() => assert.match(comparator, /visibleTimelineComparisonLevels/u));
check(() => assert.doesNotMatch(comparator, /timelineRelatedPeers|Analyse indicative|événements reliés ·/u));
check(() => assert.match(range, /onPointerEnter[\s\S]*role="tooltip"/u));
check(() => assert.match(range, /setSelectedPeerRef[\s\S]*comparisonRangePreview/u));
check(() => assert.match(range, /Voir dans la Timeline/u));
check(() => assert.match(v2Card, /expenseRows\.length > 0 \? <TimelineExpenses rows=\{expenseRows\} compact/u));
check(() => assert.doesNotMatch(v2Card, /spentDuringContext|timelinePeriodContext/u));
check(() => assert.match(v2Card, /analysis_global_moment_experience_detail[\s\S]*detailsNearViewport && isMomentDetail/u));
check(() => assert.match(comparator, /TimelinePeerExpenses[\s\S]*selectedPeer/u));
check(() => assert.match(timeline, /<ComparisonRange/u));
check(() => assert.match(range, /Q1 ·[\s\S]*Q3 ·[\s\S]*Médiane[\s\S]*Vous/u));
check(() => assert.match(css, /timelineAccordion\[data-expanded="true"\][\s\S]*transition/u));
check(() => assert.match(css, /prefers-reduced-motion/u));
check(() => assert.doesNotMatch(`${timeline}\n${range}`, /medianMoney|moneyQuartiles|MedianAbsoluteDeviation|computeMateriality/u));

console.log(`Global V2 Timeline accordion UX S9.2: ${checks}/${checks} PASS`);
