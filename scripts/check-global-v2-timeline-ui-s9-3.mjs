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

const { buildComparisonRangeModel } = await import("../src/features/global-v2/comparison-range-model.ts");
const timeline = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const range = fs.readFileSync(path.join(root, "src/features/global-v2/comparison-range.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2-page.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline-presentation.ts"), "utf8");
const panel = page.slice(page.indexOf("function GlobalLifeTimelinePanel"), page.indexOf("type SummarySlotDefinition"));
const card = timeline.slice(timeline.indexOf("function TimelineV2EventRow"), timeline.indexOf("function TimelineEventRow"));
const comparator = timeline.slice(timeline.indexOf("export function TimelineComparator"), timeline.indexOf("function TimelineV2EventRow"));
let checks = 0;
const check = (run) => { run(); checks += 1; };

check(() => assert.doesNotMatch(panel, /presentation\.description|Ce que nos dépenses racontent/u));
check(() => assert.doesNotMatch(panel, /événements<\/span>/u));
check(() => assert.match(panel, /timelineModuleHeader[\s\S]*timelineDensity[\s\S]*>Principal<\/button>[\s\S]*>Étendu<\/button>[\s\S]*<LifeTimeline/u));
check(() => assert.match(panel, /useState<TimelineDensityMode>\("PRINCIPAL"\)/u));
check(() => assert.doesNotMatch(card, /eventDateLabel\(event\)|participantLabel|participantCount/u));
check(() => assert.match(card, /timelinePlaceLabel/u));
check(() => assert.match(css, /\.timelinePlaceLabel\s*\{[^}]*text-decoration:\s*underline/u));
check(() => assert.match(card, /event\.eventCost\.status === "KNOWN" \? <b>/u));
check(() => assert.doesNotMatch(card, /Coût non établi|Série ·|timelineSemanticContext/u));
check(() => assert.match(card, /detailsNearViewport && isMomentDetail, "BACKGROUND"/u));
check(() => assert.match(card, /IntersectionObserver[\s\S]*rootMargin: "120% 0px"/u));
check(() => assert.match(card, /expenseRows\.length > 0 \? <TimelineExpenses rows=\{expenseRows\} compact/u));
check(() => assert.doesNotMatch(timeline.slice(timeline.indexOf("function TimelineExpenses"), timeline.indexOf("function TimelinePeerExpenses")), /slice\(0, 3\)|\+\{rows\.length/u));
check(() => assert.match(css, /\.timelineExpensePreview\s*\{[^}]*grid-auto-rows:\s*25px[^}]*max-height:\s*54px[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/u));
check(() => assert.match(card, /const canExpand = expenseRows\.length > 0 && comparisonAvailable/u));
check(() => assert.match(card, /canExpand[\s\S]*\? <button[\s\S]*: <article/u));
check(() => assert.doesNotMatch(card, /timelineLifeEventDetails|timelineExpandedExpenses|Voir le détail complet|spentDuringContext|timelinePeriodContext/u));
check(() => assert.match(card, /canExpand \? <div[\s\S]*<TimelineComparator/u));
check(() => assert.doesNotMatch(comparator, /timelineRelatedPeers|Analyse indicative|événements reliés ·/u));
check(() => assert.doesNotMatch(presentation, /comparisonLevelOrder[\s\S]*SAME_GRAND_FAMILY/u));
check(() => assert.match(presentation, /return visible\.slice\(0, 3\)/u));
check(() => assert.match(presentation, /samePeerSet\(previousPeerRefs, peerRefs\)/u));
check(() => assert.match(comparator, /timelineComparisonLevelLabel\(event, level\)/u));
check(() => assert.doesNotMatch(comparator, />Série<|>Proche<|>Intermédiaire<|>Large</u));
check(() => assert.match(css, /\.comparisonRangePeerMarker\s*\{[^}]*z-index:\s*5/u));

const zeroPeer = { eventRef: "moment:zero", sourceKind: "MOMENT", canonicalName: "FCKG", startDate: "2025-01-01", endDate: "2025-01-01", visibilityTier: "PRINCIPAL", eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: "0" } };
const zeroModel = buildComparisonRangeModel({ observed: { kind: "MONEY", value: "0", unit: "EUR" }, median: { kind: "MONEY", value: "10", unit: "EUR" }, lower: { kind: "MONEY", value: "0", unit: "EUR" }, upper: { kind: "MONEY", value: "20", unit: "EUR" }, peers: [zeroPeer] });
check(() => assert.notEqual(zeroModel, undefined));
check(() => assert.notEqual(zeroModel.peers[0].lane, 0));
check(() => assert.equal(Number.isFinite(zeroModel.peers[0].position), true));
check(() => assert.match(range, /onPointerEnter[\s\S]*onSelectPeer/u));
check(() => assert.doesNotMatch(`${timeline}\n${presentation}`, /medianMoney|moneyQuartiles|MedianAbsoluteDeviation|computeMateriality/u));

console.log(`Global V2 Timeline card simplification S9.3: ${checks}/${checks} PASS`);
