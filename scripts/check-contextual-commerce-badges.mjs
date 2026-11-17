import assert from "node:assert/strict";
import fs from "node:fs";
import { require } from "./lib/phase2-ts-loader.mjs";
const { commerceBadges } = require("@/domain/phase2/planner/commerce-badges");
const { contextBadgeSuggestions, monthlyCommerceBadges } = require("@/domain/phase2/planner/commerce-badge-profiles");
const { COMPOSER_LIBRARY_PRESETS, presetCreationFields } = require("@/domain/phase2/planner/composer-presets");
const { clayBadgeCatalog } = require("@/domain/phase2/commerce-badge-catalog");
const { badgeAnchor } = require("@/domain/phase2/commerce-media");
const sharp = require("sharp");
assert.equal(clayBadgeCatalog.filter(x => x.type === "generic").length, 103);
assert.equal(new Set(clayBadgeCatalog.map(x => x.key)).size, clayBadgeCatalog.length);
const byKey = new Map(clayBadgeCatalog.map(x => [x.key, x]));
for (const preset of COMPOSER_LIBRARY_PRESETS) {
  const context = { contextOccurrenceId: "00000000-0000-4000-8000-000000097205", templateKey: preset.templateKey, fields: presetCreationFields(preset.templateKey, preset.presetKey) };
  const suggestions = contextBadgeSuggestions(context);
  for (const key of suggestions) assert.equal(byKey.get(key)?.type, "generic", `${preset.presetKey}: ${key}`);
  if (["fontes-family-visit", "servian-family-visit", "visit-friends", "stay-with-relatives", "friends-evening", "home-evening"].includes(preset.presetKey))
    assert.equal(commerceBadges(context).length, 0);
}
const groceries = { templateKey: "purchase", fields: presetCreationFields("purchase", "groceries-purchase") };
assert.ok(contextBadgeSuggestions(groceries).includes("categories:fishmonger"));
assert.ok(contextBadgeSuggestions(groceries).includes("categories:bakery"));
assert.ok(!contextBadgeSuggestions(groceries).includes("categories:nightclub"));
const [monthly] = monthlyCommerceBadges({ targetRef: "HOUSEHOLD:household:groceries", label: "Courses", kind: "BASELINE_CONTROL" });
assert.ok(monthly.suggestedKeys.includes("categories:fishmonger"));
assert.deepEqual(badgeAnchor(monthly.anchor), monthly.anchor);
assert.deepEqual(monthlyCommerceBadges({ targetRef: "HOUSEHOLD:household:groceries", label: "Épargne", kind: "SAVINGS" }), []);
for (const asset of clayBadgeCatalog.filter(x => x.type === "generic")) {
  const file = "public" + asset.src; assert.ok(fs.existsSync(file), file);
  const meta = await sharp(file).metadata(); assert.equal(meta.format, "webp");
  assert.equal(meta.width, asset.width); assert.equal(meta.height, asset.height);
}
console.log("CONTEXTUAL_GENERIC_BADGES PASS · 103 visuals, 70 presets, Courses, private visits and valid WebP");
