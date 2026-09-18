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
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
      try { return nextResolve(candidate, context); } catch { /* continue */ }
    }
    throw error;
  }
} });

const presentation = await import("../src/features/global-v2/life-timeline-presentation.ts");
const range = await import("../src/features/global-v2/comparison-range-model.ts");
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

const semanticClassification = {
  taxonomyVersion: "timeline_semantic_taxonomy@v1",
  close: { key: "soiree_techno_rave", label: "Soirée techno / rave" },
  intermediate: { key: "sorties_festives_et_nocturnes", label: "Sorties festives & nocturnes" },
  grand: { key: "sorties_loisirs_et_culture", label: "Sorties, loisirs & culture" },
};
const descriptor = (level, overrides = {}) => ({ level, label: level, supportStatus: "KNOWN", relatedPeerCount: 5, costPeerCount: 4, materiality: "NOT_MATERIAL", ...overrides });
const event = (comparisonLevels, overrides = {}) => ({
  eventRef: "moment:00000000-0000-0000-0000-000000000001",
  sourceKind: "MOMENT",
  canonicalName: "Soirée test",
  startDate: "2026-01-10",
  endDate: "2026-01-10",
  visibilityTier: "PRINCIPAL",
  semanticClassification,
  eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: "40" },
  series: { seriesRef: "series:techno", label: "Soirées techno" },
  comparisonLevels,
  momentDetailAvailable: true,
  ...overrides,
});

const zero = event([]);
const one = event([descriptor("SAME_CLOSE_FAMILY")]);
const multiple = event([
  descriptor("SAME_INTERMEDIATE_FAMILY"),
  descriptor("SAME_SERIES"),
  descriptor("SAME_CLOSE_FAMILY"),
], { defaultComparisonLevel: "SAME_CLOSE_FAMILY" });
check(() => assert.equal(presentation.hasTimelineComparisonAffordance(zero), false));
check(() => assert.equal(presentation.initialTimelineComparisonLevel(zero), undefined));
check(() => assert.deepEqual(presentation.orderedTimelineComparisonLevels(one).map(({ level }) => level), ["SAME_CLOSE_FAMILY"]));
check(() => assert.deepEqual(presentation.orderedTimelineComparisonLevels(multiple).map(({ level }) => level), ["SAME_SERIES", "SAME_CLOSE_FAMILY", "SAME_INTERMEDIATE_FAMILY"]));
check(() => assert.equal(presentation.initialTimelineComparisonLevel(multiple), "SAME_CLOSE_FAMILY"));
check(() => assert.equal(presentation.initialTimelineComparisonLevel(event(multiple.comparisonLevels)), "SAME_SERIES"));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(multiple, "SAME_SERIES"), "Soirées techno"));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(multiple, "SAME_CLOSE_FAMILY"), "Soirée techno / rave"));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(multiple, "SAME_INTERMEDIATE_FAMILY"), "Sorties festives & nocturnes"));
check(() => assert.equal(presentation.timelineComparisonLevelLabel(multiple, "SAME_GRAND_FAMILY"), "Sorties, loisirs & culture"));
const broadOnly = event([descriptor("SAME_GRAND_FAMILY")]);
check(() => assert.equal(presentation.initialTimelineComparisonLevel(broadOnly), undefined));
check(() => assert.deepEqual(presentation.orderedTimelineComparisonLevels(broadOnly), []));

const closeRequest = presentation.timelineComparisonRequest(multiple.eventRef, "SAME_CLOSE_FAMILY");
const intermediateRequest = presentation.timelineComparisonRequest(multiple.eventRef, "SAME_INTERMEDIATE_FAMILY");
check(() => assert.deepEqual(closeRequest, { resource: "analysis_global_timeline_event_comparison", params: { eventRef: multiple.eventRef, comparisonLevel: "SAME_CLOSE_FAMILY" } }));
check(() => assert.notDeepEqual(closeRequest.params, intermediateRequest.params));

const money = (value) => ({ kind: "MONEY", value: String(value), unit: "EUR" });
const count = (value) => ({ kind: "COUNT", value: String(value), unit: "event" });
const peer = (eventRef, value, sourceKind = "MOMENT", visibilityTier = "PRINCIPAL") => ({
  eventRef,
  sourceKind,
  canonicalName: eventRef,
  startDate: "2026-01-01",
  endDate: "2026-01-01",
  visibilityTier,
  eventCost: { authority: sourceKind === "MOMENT" ? "M6_CAUSAL" : "CANONICAL_LINKED", status: "KNOWN", value: String(value) },
});
const closePeers = [peer("moment:a", 10), peer("life-event:b", 20, "LIFE_EVENT", "EXTENDED"), peer("moment:c", 30)];
const intermediatePeers = [peer("moment:d", 5), peer("moment:e", 15), peer("moment:f", 25), peer("life-event:g", 35, "LIFE_EVENT")];
const rangeFor = (peers) => range.buildComparisonRangeModel({ observed: money(40), median: money(20), lower: money(10), upper: money(30), supportCount: count(peers.length), peers });
const closeModel = rangeFor(closePeers);
const intermediateModel = rangeFor(intermediatePeers);
check(() => assert.deepEqual(closeModel.peers.map(({ observation }) => range.comparisonRangePeerRef(observation)), closePeers.map(({ eventRef }) => eventRef)));
check(() => assert.deepEqual(intermediateModel.peers.map(({ observation }) => range.comparisonRangePeerRef(observation)), intermediatePeers.map(({ eventRef }) => eventRef)));
check(() => assert.notDeepEqual(closeModel.peers.map(({ value }) => value), intermediateModel.peers.map(({ value }) => value)));
check(() => assert.equal(closeModel.peers.length, closePeers.length));
check(() => assert.equal(intermediateModel.peers.length, intermediatePeers.length));
check(() => assert.equal(closeModel.supportCount, closePeers.length));

const timelineSource = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline-presentation.ts"), "utf8");
const rangeSource = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range.tsx"), "utf8");
const rangeModelSource = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range-model.ts"), "utf8");
const comparatorSource = timelineSource.slice(timelineSource.indexOf("function TimelineComparator"), timelineSource.indexOf("function TimelineV2EventRow"));
const v2CardSource = timelineSource.slice(timelineSource.indexOf("function TimelineV2EventRow"), timelineSource.indexOf("function TimelineEventRow"));
check(() => assert.match(v2CardSource, /canExpand \? <div[\s\S]*<TimelineComparator/u));
check(() => assert.match(comparatorSource, /role="radiogroup"[\s\S]*relatedPeerCount/u));
check(() => assert.match(comparatorSource, /setSelectedLevel\(level\)/u));
check(() => assert.match(comparatorSource, /timelineComparisonRequest\(event\.eventRef, "SAME_SERIES"\)[\s\S]*timelineComparisonRequest\(event\.eventRef, "SAME_CLOSE_FAMILY"\)[\s\S]*timelineComparisonRequest\(event\.eventRef, "SAME_INTERMEDIATE_FAMILY"\)/u));
check(() => assert.match(comparatorSource, /peers=\{model\.costComparablePeers\}/u));
check(() => assert.match(comparatorSource, /statistics\.median[\s\S]*statistics\.q1[\s\S]*statistics\.q3/u));
check(() => assert.match(comparatorSource, /<ComparisonRange/u));
check(() => assert.equal((timelineSource.match(/function ComparisonRange/gu) ?? []).length, 0));
check(() => assert.doesNotMatch(timelineSource, /comparisonRangePlot/u));
check(() => assert.doesNotMatch(comparatorSource, /\.filter\(|\.reduce\(|\.sort\(|medianMoney|moneyQuartiles|MedianAbsoluteDeviation|buildTimelineSemanticComparator|computeMateriality/iu));
check(() => assert.doesNotMatch(rangeModelSource, /\.filter\(/u));
check(() => assert.match(rangeModelSource, /for \(const observation of input\.peers \?\? \[\]\)[\s\S]*if \(value === undefined\) return undefined/u));
check(() => assert.match(timelineSource, /focusTimelinePeer[\s\S]*peer\.visibilityTier === "EXTENDED"\) onDensityChange\("EXTENDED"\)[\s\S]*setExpandedEventRef\(peer\.eventRef\)/u));
check(() => assert.match(v2CardSource, /scrollIntoView[\s\S]*cardButtonRef\.current \?\? cardArticleRef\.current/u));
check(() => assert.match(v2CardSource, /analysis_global_moment_experience_detail[\s\S]*detailsNearViewport && isMomentDetail/u));
check(() => assert.match(v2CardSource, /event\.distinctiveComparisonLevel !== undefined/u));
check(() => assert.match(comparatorSource, /event\.distinctiveComparisonLevel[\s\S]*timelineDistinctiveBasis/u));
check(() => assert.doesNotMatch(presentationSource.slice(presentationSource.indexOf("const comparisonLevelOrder"), presentationSource.indexOf("const moneyFormatter")), /SAME_GRAND_FAMILY/u));
check(() => assert.match(rangeSource, /GlobalTimelineComparisonPeerObservation|ComparisonRangePeerObservation/u));

console.log(`Global V2 Timeline comparator UI S9: ${checks}/${checks} PASS`);
console.log("Server descriptors only; lazy level-specific requests; exact peer arrays; ComparisonRange reused once.");
