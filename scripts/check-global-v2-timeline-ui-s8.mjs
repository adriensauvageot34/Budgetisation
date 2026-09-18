import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1))), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href
      : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw error;
    }
  },
});

const presentation = await import("../src/features/global-v2/life-timeline-presentation.ts");
let checks = 0;
function check(assertion) {
  assertion();
  checks += 1;
}

const semanticClassification = {
  taxonomyVersion: "timeline_semantic_taxonomy@v1",
  close: { key: "visite_ami", label: "Visite ami" },
  intermediate: { key: "visites_et_temps_avec_les_proches", label: "Visites & temps avec les proches" },
  grand: { key: "relations_fetes_et_evenements_de_vie", label: "Relations, fêtes & événements de vie" },
};
const event = (index, visibilityTier, overrides = {}) => ({
  eventRef: `moment:00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
  sourceKind: "MOMENT",
  canonicalName: `Événement ${index}`,
  startDate: `2025-01-${String(index).padStart(2, "0")}`,
  endDate: `2025-01-${String(index).padStart(2, "0")}`,
  visibilityTier,
  semanticClassification,
  eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: String(index) },
  comparisonLevels: [],
  momentDetailAvailable: true,
  ...overrides,
});

const events = [event(1, "PRINCIPAL"), event(2, "EXTENDED"), event(3, "PRINCIPAL")];
const principal = presentation.timelineEventsForDensity(events, "PRINCIPAL");
const extended = presentation.timelineEventsForDensity(events, "EXTENDED");
check(() => assert.deepEqual(principal.map(({ eventRef }) => eventRef), [events[0].eventRef, events[2].eventRef]));
check(() => assert.equal(extended, events));
check(() => assert.deepEqual(extended.map(({ eventRef }) => eventRef), events.map(({ eventRef }) => eventRef)));
check(() => assert.equal(extended.every((entry) => entry.visibilityTier === "PRINCIPAL" || entry.visibilityTier === "EXTENDED"), true));
check(() => assert.equal(principal.every((entry) => events.includes(entry)), true));

const knownZero = event(4, "PRINCIPAL", { eventCost: { authority: "M6_CAUSAL", status: "KNOWN", value: "0" } });
const unknown = event(5, "EXTENDED", { eventCost: { authority: "NONE", status: "UNKNOWN" } });
const conflict = event(6, "EXTENDED", { eventCost: { authority: "M6_CAUSAL", status: "CONFLICT" } });
check(() => assert.match(presentation.timelineEventAmount(knownZero), /^0(?:,00)?\s?€/u));
check(() => assert.equal(presentation.timelineEventAmount(unknown), "Coût non établi"));
check(() => assert.equal(presentation.timelineEventAmount(conflict), "Coût non établi"));

const comparable = event(7, "PRINCIPAL", { comparisonLevels: [{ level: "SAME_CLOSE_FAMILY", label: "Famille proche", supportStatus: "PARTIAL", relatedPeerCount: 3, costPeerCount: 2, materiality: "UNKNOWN" }] });
check(() => assert.equal(presentation.hasTimelineComparisonAffordance(comparable), true));
check(() => assert.equal(presentation.hasTimelineComparisonAffordance(events[0]), false));
check(() => assert.deepEqual(comparable.comparisonLevels, [{ level: "SAME_CLOSE_FAMILY", label: "Famille proche", supportStatus: "PARTIAL", relatedPeerCount: 3, costPeerCount: 2, materiality: "UNKNOWN" }]));

const source = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/features/global-v2/global-v2.module.css"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "src/features/global-v2/life-timeline-presentation.ts"), "utf8");
const v2Card = source.slice(source.indexOf("function TimelineV2EventRow"), source.indexOf("function TimelineEventRow"));
const component = source.slice(source.indexOf("export function LifeTimeline"));
check(() => assert.match(component, /useState<TimelineDensityMode>\("PRINCIPAL"\)/u));
check(() => assert.match(component, /timelineEventsForDensity\(model\.events, density\)/u));
check(() => assert.match(component, />Principal<\/button>[\s\S]*>Étendu<\/button>/u));
check(() => assert.equal((component.match(/resource: "analysis_global_life_timeline"/gu) ?? []).length, 1));
check(() => assert.match(source, /timelineComparisonRequest\(event\.eventRef, "SAME_CLOSE_FAMILY"\)/u));
check(() => assert.match(v2Card, /semanticClassification\.close\.label/u));
check(() => assert.match(v2Card, /semanticClassification\.intermediate\.label[\s\S]*semanticClassification\.grand\.label|semanticClassification\.grand\.label[\s\S]*semanticClassification\.intermediate\.label/u));
check(() => assert.doesNotMatch(v2Card, /familySource|typeKey/u));
check(() => assert.match(v2Card, /event\.sourceKind === "MOMENT" && event\.momentDetailAvailable/u));
check(() => assert.match(v2Card, /aria-expanded=\{expanded\}[\s\S]*onClick=\{onToggle\}/u));
check(() => assert.match(v2Card, /isMomentDetail[\s\S]*onMomentDetail\(event\.eventRef, event\.canonicalName\)[\s\S]*Voir le détail complet/u));
check(() => assert.match(v2Card, /comparisonAvailable \? <TimelineComparator/u));
check(() => assert.doesNotMatch(`${v2Card}\n${component}\n${presentationSource}`, /median|quartile|\bq1\b|\bq3\b|\bmad\b|peerObservations|materiality\s*[=!<>]|\.sort\(|\.reduce\(/iu));
check(() => assert.match(source, /semanticCloseIcons[\s\S]*semanticIntermediateIcons/u));
check(() => assert.match(css, /\.timelineDensity button\[aria-pressed="true"\]/u));
check(() => assert.match(css, /\.timelineLifeEventDetails/u));

console.log(`Global V2 Timeline UI S8: ${checks}/${checks} PASS`);
console.log("Density defaults to PRINCIPAL; EXTENDED is an order-preserving superset; client comparator math: 0.");
