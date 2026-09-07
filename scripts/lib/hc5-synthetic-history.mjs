import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

/** Synthetic correction producer. No oracle/live export. Real Canonical reader,
 * Facts, Calendar/Daily engines, ReadModels, HC3 preflight and schema validator.
 * Empty finance is deliberate; this tests a life-domain correction, not finance
 * recertification. Typical/Minimal have no source and remain placeholders.
 */
export async function produceHc5SyntheticMonth({ require, client, context, month }) {
  const use = (file) => require(path.resolve(file));
  const { CanonicalRepository } = use("src/server/canonical/repository.ts");
  const { FactSourceResolver } = use("src/server/analytics/fact-source-resolver.ts");
  const monthly = use("src/server/analytics/history-v2-monthly-engines.ts");
  const daily = use("src/analytics/history-v2/daily-finance/index.ts");
  const analytics = use("src/analytics/history-v2/index.ts");
  const balance = use("src/analytics/history-v2/month-balance/index.ts");
  const core = use("src/core/history-v2/index.ts");
  const money = use("src/core/money/index.ts");
  const query = use("src/query-api/index.ts");
  const builders = use("src/query-api/history-v2/index.ts");
  const materialization = use("src/server/analytics/materialization/history-v2.ts");
  const { sumEconomicNetForScope } = use("src/analytics/context/index.ts");
  const scope = { subject: { kind: "household" }, time: { kind: "month", month } };
  const repository = new CanonicalRepository(client, context);
  const occurrences = await new FactSourceResolver(repository).loadActivityOccurrences(scope);
  const supportMonths = ["2026-04", month, "2026-06"];
  const calendarArtifacts = await Promise.all(supportMonths.map((m) => monthly.buildCalendarSemanticMonthFromCanonical(repository, m)));
  const actual = sumEconomicNetForScope([], scope);
  const dailyArtifacts = supportMonths.map((m) => daily.buildDailyEconomicLedgerMonthArtifact({
    householdId: context.householdId, month: m, currency: "EUR",
    actualMonthAmount: actual, components: [], purchaseEvents: [],
  }));
  const selectedCalendar = calendarArtifacts[1], ledger = dailyArtifacts[1];
  const sourceRefs = occurrences.map((o) => ({ kind: "life_event", id: o.lifeEventId }));
  const visible = (value) => ({ visibility: "VISIBLE", data: { status: "KNOWN", value } });
  const collection = (items) => ({ visibility: "VISIBLE", data: { status: "KNOWN", items, totalCount: items.length } });
  const absent = { visibility: "PLACEHOLDER", reasonCode: "DATA_NO_SOURCE" };
  const activities = balance.rankActivities(occurrences.length ? [{
    activityTypeKey: "pharmacie", occurrences: occurrences.length, hasOtherNarrativeMoment: false, priorityBand: 3,
  }] : []).map((activity) => ({
    ...activity, label: "Pharmacie synthétique", costKind: "NONE", cost: { status: "UNKNOWN" },
    detailRef: { resource: query.queryResourceKeys.historyActivityDetail, params: { activityTypeKey: activity.activityTypeKey } }, sourceRefs,
  }));
  const spending = balance.buildSpendingAxes({ actual, components: [] });
  const capability = (resource) => {
    const maximum = query.getQueryCapabilityMaximum(resource);
    return { resource: maximum.resource, availableSections: maximum.sections,
      availableMeasures: maximum.measures, compatibleFilters: maximum.filters, unavailable: [] };
  };
  const groupValues = {
    calendar_artifacts: calendarArtifacts, daily_ledgers: dailyArtifacts,
    activity_occurrences: occurrences, activity_links: [], activity_costs: [], economic_components: [],
    persons: [], expenses: [], operations: [], classifications: [], reference_labels: [], actual_history: [actual],
    typical: { status: "UNKNOWN" }, minimal: { status: "UNKNOWN" }, category_typical: [],
    category_history: [], moment_relations: [], journal_supplement: [], overview_supplement: [],
    primary_places: [], place_visits: [], place_authorities: [], local_expenses: [],
  };
  const buildQuery = (request) => {
    const closure = analytics.historyResourceDependencyClosure({
      resource: request.resource,
      groups: Object.fromEntries(analytics.historyV2ResourceDependencyGroups[request.resource].map((group) => {
        assert.ok(Object.hasOwn(groupValues, group), `Missing synthetic input group ${group}`);
        return [group, { identity: `hc5:${month}:${group}`, value: analytics.historyDependencyValue(groupValues[group]) }];
      })),
    });
    const context = { householdId: repository.householdId(), month,
      resourceInputHash: analytics.computeResourceInputHash({ identity: JSON.stringify(request.params), facts: closure.facts, dependencies: closure.dependencies }),
      policyVersions: core.resolvePolicyVersions(query.getQueryResourceContract(request.resource).policyIds),
      capabilities: capability(request.resource),
      sourceRefs: analytics.historyV2ResourceDependencyGroups[request.resource].some((group) =>
        group === "calendar_artifacts" || group === "activity_occurrences") ? sourceRefs : [] };
    const calendarContext = { householdId: context.householdId, timeZone: "Europe/Paris",
      capabilities: context.capabilities, calendarArtifacts, dailyArtifacts, personDirectory: [], expenseDescriptors: [] };
    let data;
    switch (request.resource) {
      case "history_month_calendar": data = builders.buildMonthCalendarReadModel(calendarContext, month); break;
      case "history_week": data = builders.buildWeekReadModel(calendarContext, request.params.weekStart); break;
      case "history_day_journal": data = builders.buildJournalDayReadModel(calendarContext, request.params.date, {
        refundsAndAdjustments: { status: "KNOWN", items: [], totalCount: 0 },
        inflows: { status: "KNOWN", items: [], totalCount: 0 }, technicalMovements: { status: "KNOWN", items: [], totalCount: 0 }, causalCostByCalendarItemId: {},
      }); break;
      case "history_month_overview": data = builders.buildMonthQuickOverviewReadModel(calendarContext, month, {
        bankOutflows: { status: "KNOWN", value: actual }, bankInflows: { status: "KNOWN", value: actual },
        causalCostByCalendarItemId: {}, explicitIncidentHighlights: [],
      }); break;
      case "history_month_balance_summary": data = builders.buildMonthBalanceSummaryReadModel({
        context, actual: visible(actual), typical: absent, minimal: absent,
        comparableActualsIncludingCurrent: [actual], typicalSupportMonths: 0, importedSummary: { freshness: "MISSING" },
      }); break;
      case "history_bank_economy_bridge": data = builders.buildBankEconomyBridgeReadModel({ context,
        bridge: balance.buildBankEconomyBridge({ bankOutflows: actual, actual, lines: [], linesComplete: true }),
      }); break;
      case "history_month_categories": data = builders.buildMonthCategoriesReadModel({
        context, categories: [], otherAmount: visible(actual), unclassifiedAmount: visible(actual),
      }); break;
      case "history_month_spending_nature": data = builders.buildMonthSpendingNatureReadModel({
        context, actual: visible(actual), ...spending, segments: [],
      }); break;
      case "history_minimal_preview": {
        // The optional preview is explicitly hidden when Minimal has no source.
        data = builders.buildMinimalPreviewReadModel({ context, minimal: absent,
          preview: balance.buildMinimalPreview({ minimal: actual, components: [] }) });
        data = { ...data, preview: absent }; break;
      }
      case "history_month_life_money": data = builders.buildMonthLifeMoneyReadModel({ context, activities, moments: [], places: [] }); break;
      case "history_activity_detail": data = builders.buildActivityDetailReadModel({
        context, activity: activities.find((a) => a.activityTypeKey === request.params.activityTypeKey),
        occurrences: collection(occurrences.map((o) => ({ occurrenceId: o.lifeEventId, effectiveDate: o.startDate,
          momentIds: [], placeIds: [], categoryIds: [], sourceRefs: [{ kind: "life_event", id: o.lifeEventId }] }))),
        frequencyTicket: { visibility: "VISIBLE", data: { availability: "UNKNOWN" } },
        causalExpenses: collection([]), associatedExpenses: collection([]),
      }); break;
      default: throw new Error(`Unreachable synthetic detail: ${request.resource}`);
    }
    return { data, ...closure };
  };
  const implementationFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--",
    "src/analytics", "src/core", "src/query-api", "src/server", "scripts/lib/hc5-synthetic-history.mjs"], { encoding: "utf8" })
    .trim().split(/\r?\n/u).sort();
  const hash = createHash("sha256");
  for (const file of implementationFiles) hash.update(file).update("\0").update(fs.readFileSync(file));
  const args = { context, month, buildQuery,
    implementation: { status: "KNOWN", gitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), digest: hash.digest("hex") },
    artifacts: [
      { artifactFamily: "calendar_semantic_month", payload: selectedCalendar, facts: [{ factType: "fct_activity_occurrence", identity: month, value: analytics.historyDependencyValue(occurrences) }] },
      { artifactFamily: "daily_economic_ledger_month", payload: ledger, facts: [{ factType: "economic_components", identity: month, value: [] }] },
    ],
  };
  const preflight = await materialization.buildHistoryV2Preflight(args);
  const checks = [];
  const check = (id, run) => { run(); checks.push({ id, status: "PASS" }); };
  check("F01_ACTUAL_COMMON", () => assert.equal(preflight.queries.find((q) => q.request.resource === "history_month_balance_summary").data.actualValue.data.value, actual));
  check("F02_DAILY_RECONCILIATION", () => assert.equal(ledger.reconciliationResidual, "0"));
  check("F03_DAYS_PLUS_UNASSIGNED", () => assert.equal(
    money.addMoney(ledger.days.reduce((sum, d) => money.addMoney(sum, d.economicAmount.value), "0"), ledger.unassignedEconomicAmount.value), actual));
  check("X_MANIFEST_15_RESOURCES", () => assert.equal(preflight.manifest.resourceFamilies.length, 15));
  check("X_HASHES", () => assert.equal(materialization.historyV2ManifestFactsHash(preflight.manifest), preflight.manifest.publicationFactsHash));
  const repeated = await materialization.buildHistoryV2Preflight(args);
  check("D01_DETERMINISM", () => assert.deepEqual(repeated, preflight));
  const stage = materialization.stageHistoryV2GenerationInMemory({
    preflight, publicationId: "00000000-0000-4000-8000-000000000999", revision: Number(context.analyticsRevision) + 1, generatedAt: context.asOf,
  });
  check("X_RUNTIME_SCHEMAS", () => assert.equal(stage.queries.length, preflight.queries.length));
  check("X_PUBLICATION_META", () => {
    for (const { data } of stage.queries) {
      assert.equal(data.publicationMeta.publicationId, stage.publicationId);
      assert.equal(data.publicationMeta.factsHash, preflight.manifest.publicationFactsHash);
    }
  });
  return { preflight, certification: { mode: "READ_ONLY", gate: "PASS", householdId: context.householdId,
    sourceRevision: context.dataRevision, month, manifestHash: preflight.manifest.manifestHash, checks } };
}
