import assert from "node:assert/strict";
import path from "node:path";

/** Runs inside the disposable C4 importer fixture; no live services are contacted. */
export async function certifyC5BackgroundRhythms({ root, require, fs, ts, dto, pilotTables, canonical, food, carMobility, months }) {
  const query = require(path.join(root, "src/query-api/global-v2/background-rhythms.ts"));
  const { canonicalSerializeGlobal } = require(path.join(root, "src/core/global-v2/hash.ts"));
  const { buildGlobalBackgroundBenefitContext } = require(path.join(root, "src/server/analytics/global-v2-background-benefit-context.ts"));
  const wallet = pilotTables.benefit_wallets[0];
  assert.equal(String(wallet.coverage_start).slice(0, 10), "2025-08-01");
  assert.equal(String(wallet.coverage_end).slice(0, 10), "2026-08-29");
  const names = new Map(dto.purchases.map(({ merchant }) => [merchant.id, merchant.name]));
  const channels = new Map(pilotTables.purchase_event_channel_assertions.map(({ purchase_event_id, channel }) => [purchase_event_id, channel]));
  const presentations = pilotTables.purchase_events.map(({ purchase_event_id, merchant_id }) => ({
    purchaseEventId: purchase_event_id, merchantLabel: names.get(merchant_id), channel: channels.get(purchase_event_id),
  }));
  assert.ok(presentations.every(({ merchantLabel, channel }) => merchantLabel && channel));
  const canonicalEventIds = new Set(canonical.facts.filter(({ fact }) => fact === "fct_purchase_aware_economic_component")
    .map(({ purchaseEventId }) => purchaseEventId));
  const context = buildGlobalBackgroundBenefitContext({ canonical, food,
    coverage: { status: "FULL", startMonth: months[0], endMonth: months.at(-1), exceptions: [] }, months,
    fundingComponents: pilotTables.purchase_funding_components.filter(({ purchase_event_id }) => canonicalEventIds.has(purchase_event_id)),
    presentations: presentations.filter(({ purchaseEventId }) => canonicalEventIds.has(purchaseEventId)) });
  const cents = (value) => Math.round(Number(value ?? 0) * 100);
  assert.equal(food.fundingEligiblePurchaseEventIds.length, 116);
  const foodFunding = context.benefitFunding.months.reduce((sum, [, amount]) => sum + cents(amount), 0);
  const allFunding = pilotTables.purchase_funding_components.filter(({ purchase_event_id, funding_kind }) =>
    canonicalEventIds.has(purchase_event_id) && funding_kind === "BENEFIT_WALLET")
    .reduce((sum, { amount }) => sum + cents(amount), 0);
  assert.ok(foodFunding > 0 && foodFunding < allFunding, "Only C4-certified FOOD purchases can appear in the month focus funding line.");
  const meta = {
    publicationId: "fdff4ee0-5240-5362-8117-edd81624fb42", revision: 109,
    factsHash: "a".repeat(64), generatedAt: "2026-09-25T00:00:00Z", profileId: "global-v2-household@v1",
    manifestHash: "b".repeat(64),
  };
  const resourceMeta = { contractVersion: "global-v2-query@v1", methodSignature: "c".repeat(64),
    policyVersions: { projection: "global-background-rhythms-query@v2", wire: "global-background-rhythms-compact-wire@v2", transport: "background-near-viewport@v1" }, resourceInputHash: "d".repeat(64) };
  const snapshotInput = { food, carMobility, ...context, publicationMeta: meta,
    annualResourceMeta: resourceMeta, monthlyResourceMeta: () => resourceMeta,
    monthlyInstanceKey: ({ month }) => `global-query:car:${month}`, scopeHash: "e".repeat(64) };
  const first = query.buildGlobalBackgroundRhythmSnapshots(snapshotInput);
  const second = query.buildGlobalBackgroundRhythmSnapshots(snapshotInput);
  assert.equal(canonicalSerializeGlobal(first.annual), canonicalSerializeGlobal(second.annual));
  assert.equal(first.annualSerializedBytes, second.annualSerializedBytes);
  assert.equal(first.expectedFeatureSnapshotCount, 13);
  assert.equal(first.monthlyDetails.length, 12);
  assert.ok(first.annualSerializedBytes <= 47104, `C5 annual payload ${first.annualSerializedBytes} exceeds 47104`);
  assert.ok(first.featureTotalSerializedBytes <= 153600);
  const semantic = query.expandGlobalBackgroundFoodReadModel(first.annual);
  assert.equal(semantic.annual.money.total.quality, "LOWER_BOUND");
  assert.equal(semantic.annual.money.total.amount, "8546.07");
  assert.equal(first.annual.food.annual.moneyQuality[1], "8443.82");
  assert.deepEqual([semantic.annual.money.courses.amount, semantic.annual.money.restaurants.amount, semantic.annual.money.deliveries.amount], ["6193.44", "2077.38", "275.25"]);
  assert.equal(semantic.months.filter(({ money }) => money.total.quality === "KNOWN").length, 6);
  assert.equal(semantic.months.filter(({ money }) => money.total.quality === "LOWER_BOUND").length, 6);
  assert.equal(semantic.annual.restaurantBehavior.medianCost.status, "GATED");
  assert.equal(semantic.annual.deliveryBehavior.purchaseCount, 13);
  assert.equal(semantic.months.every(({ benefitCoverage }) => benefitCoverage === "IN_COVERAGE"), true);
  const clone = () => structuredClone(first.annual);
  const invalid = (mutate) => { const value = clone(); mutate(value); assert.equal(query.globalBackgroundRhythmsReadModelSchema.safeParse(value).success, false); };
  invalid((value) => { value.food.annual.moneyQuality[0] = 64; });
  invalid((value) => { value.food.months[0][12] = [64, "0", "0"]; });
  invalid((value) => { value.food.months[0].pop(); });
  invalid((value) => { value.food.months[1][0] = value.food.months[0][0]; });
  invalid((value) => { value.food.months[0][1] = "-1"; });
  invalid((value) => { value.food.benefitCoverage.endMonth = "2027-01"; });
  invalid((value) => { value.food.monthlyBenefitFunding.push(value.food.monthlyBenefitFunding[0]); });
  invalid((value) => { value.food.months[0][10][0][0][2] = "UNKNOWN_SOURCE"; });
  const sourceMonth = first.annual.food.months.find((row) => row[10].some((bucket) => bucket.length > 0));
  assert.ok(sourceMonth);
  invalid((value) => { const row = value.food.months.find((entry) => entry[0] === sourceMonth[0]); row[10].find((bucket) => bucket.length > 0)[0] = ["bad-channel", "1", "PURCHASE_COMPONENT", null, "New Delhi", null, null, null, null, null, "X"]; });
  invalid((value) => { const row = value.food.months.find((entry) => entry[0] === sourceMonth[0]); row[10][0] = [["duplicate", "1", "OPERATION", null, "x"], ["duplicate", "2", "OPERATION", null, "y"]]; });
  const outside = clone();
  outside.food.benefitCoverage = { status: "PARTIAL", startMonth: months[0], endMonth: months.at(-1), exceptions: [[0, "OUT_OF_COVERAGE"], ...months.slice(1).map((_, index) => [index + 1, "IN_COVERAGE"])] };
  outside.food.monthlyBenefitFunding = outside.food.monthlyBenefitFunding.filter(([index]) => index !== 0);
  const outsideSemantic = query.expandGlobalBackgroundFoodReadModel(outside);
  assert.equal(outsideSemantic.months[0].benefitCoverage, "OUT_OF_COVERAGE");
  assert.equal(outsideSemantic.months[0].monthlyBenefitFunding, null);

  require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };
  require.extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { FoodRhythmRiver } = require(path.join(root, "src/features/global-v2/food-rhythm-river.tsx"));
  const { FoodMonthFocus } = require(path.join(root, "src/features/global-v2/food-month-focus.tsx"));
  const renderFocus = (month, annotations = semantic.annotations) => renderToStaticMarkup(React.createElement(FoodMonthFocus,
    { month, annotations, connectorPosition: 50, onClose: () => {} }));
  const annualHtml = renderToStaticMarkup(React.createElement(FoodRhythmRiver, { food: semantic }));
  assert.match(annualHtml, /≥[\s\S]*8[\s\u00a0\u202f]*546,07/u);
  assert.match(annualHtml, /au moins 8[\s\u00a0\u202f]*546,07 euros/u);
  assert.equal((annualHtml.match(/data-tone="food-/gu) ?? []).length, 3);
  assert.doesNotMatch(annualHtml, /Swile|titres-restaurant|financés par/u);
  const known = semantic.months.find(({ money }) => money.total.quality === "KNOWN");
  const lower = semantic.months.find(({ money, showBenefitFunding }) => money.total.quality === "LOWER_BOUND" && showBenefitFunding);
  assert.ok(known && lower);
  assert.doesNotMatch(renderFocus(known).match(/<h5[^>]*>[\s\S]*?<\/h5>/u)?.[0] ?? "", /≥/u);
  assert.match(renderFocus(lower), /≥[\s\S]*financés par titres-restaurant/u);
  assert.match(renderFocus(outsideSemantic.months[0]), /Source titres-restaurant non observée pour ce mois/u);
  assert.doesNotMatch(renderFocus(outsideSemantic.months[0]), /dont 0[\s\S]*financés/u);
  assert.match(renderFocus(lower), /achats en livraison/u);
  assert.doesNotMatch(annualHtml, /médiane de restaurant|prix médian/u);
  const highlightMonth = semantic.months.find(({ highlights }) => highlights.some((bucket) => bucket.length > 0));
  assert.ok(highlightMonth);
  const baseHighlight = highlightMonth.highlights.flat()[0];
  const withHighlight = (highlight) => ({ ...highlightMonth, highlights: [[highlight], [], []] });
  const mixedHtml = renderFocus(withHighlight({ ...baseHighlight, stableSourceId: "purchase-event:mixed:2025-08", amount: { amount: "30.80", quality: "KNOWN" }, sourceType: "OPERATION", merchantLabel: "New Delhi", channel: null }));
  assert.match(mixedHtml, /New Delhi[\s\S]*30,80/u);
  assert.doesNotMatch(mixedHtml, /25,00|5,80|Swile/u);
  const benefitOnlyHtml = renderFocus(withHighlight({ ...baseHighlight, stableSourceId: "purchase-event:benefit-only:2025-08", amount: { amount: "25", quality: "KNOWN" }, sourceType: "PURCHASE_COMPONENT", merchantLabel: "Burger King", channel: null }));
  assert.match(benefitOnlyHtml, /Burger King[\s\S]*25,00/u);
  assert.doesNotMatch(benefitOnlyHtml, /purchase_component|operationId|Benefit-only/u);
  const channelHtml = renderFocus(withHighlight({ ...baseHighlight, stableSourceId: "purchase-event:channel:2025-08", merchantLabel: "New Delhi", channel: "UBER_EATS" }));
  assert.match(channelHtml, /New Delhi[\s\S]*via Uber Eats/u);
  const uiSources = ["food-rhythm-river.tsx", "food-month-focus.tsx"].map((name) => fs.readFileSync(path.join(root, "src/features/global-v2", name), "utf8"));
  for (const source of uiSources) assert.doesNotMatch(source, /\.reduce\(|\.sort\(|fundingComponents|bankAmount|grossAmount|purchaseIdentityKey|medianCost\.value/u);
  console.log(JSON.stringify({ c5: "PASS", annualV2PayloadBytes: first.annualSerializedBytes,
    payloadHeadroomBytes: 49152 - first.annualSerializedBytes, featurePayloadBytes: first.featureTotalSerializedBytes,
    snapshotCount: first.expectedFeatureSnapshotCount, fundingMonths: first.annual.food.monthlyBenefitFunding.length,
    wireFixtures: 10, negativeSchemaFixtures: 10, uiFixtures: 10, determinism: "PASS" }, null, 2));
}
