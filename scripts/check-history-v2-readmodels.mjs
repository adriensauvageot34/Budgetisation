import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const calendar = await import("../src/analytics/history-v2/calendar/index.ts");
const daily = await import("../src/analytics/history-v2/daily-finance/index.ts");
const readmodels = await import("../src/query-api/history-v2/index.ts");
const capabilitiesApi = await import("../src/query-api/capabilities/index.ts");
const request = await import("../src/query-api/request/index.ts");
const registry = await import("../src/query-api/read-model-registry.ts");

const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = uuid(1);
const personId = uuid(2);
const authority = { kind: "OBSERVED_CANONICAL", authority: "fixture", sourceRefs: ["fixture:history-v2"] };
let checks = 0;
const check = (callback) => { callback(); checks += 1; };

function capability(resource) {
  const maximum = capabilitiesApi.getQueryCapabilityMaximum(resource);
  return {
    resource: maximum.resource,
    availableSections: maximum.sections,
    availableMeasures: maximum.measures,
    compatibleFilters: maximum.filters,
    unavailable: [],
  };
}

function life(id, typeKey, overrides = {}) {
  return {
    lifeEventId: uuid(id),
    typeKey,
    title: `${typeKey}-${id}`,
    startDate: "2026-05-12",
    endDate: "2026-05-12",
    validationStatus: "Confirmé",
    participantIds: [personId],
    authority,
    ...overrides,
  };
}

function calendarArtifact(month, input = {}) {
  return calendar.buildCalendarSemanticMonthArtifact({
    householdId,
    month,
    lifeEvents: [],
    moments: [],
    contexts: [],
    momentLifeEvents: [],
    sourceCompleteness: "KNOWN",
    ...input,
  });
}

const mayCalendar = calendarArtifact("2026-05", {
  lifeEvents: [
    life(10, "funeraire"),
    life(11, "celebration"),
    life(12, "examen_permis"),
    life(13, "sortie_soiree"),
    life(14, "demarche_admin"),
    life(15, "rdv_medical"),
    life(16, "pharmacie"),
    life(17, "demarche_admin", { startTime: "09:30" }),
    ...Array.from({ length: 5 }, (_, index) => life(30 + index, "voyage_sejour", {
      title: `Ribbon ${index}`,
      startDate: "2026-05-04",
      endDate: "2026-05-10",
    })),
    life(35, "voyage_sejour", {
      title: "Ribbon source mai",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
    }),
  ],
  moments: [{
    momentId: uuid(50),
    type: "Soirée",
    title: "Moment lié",
    startDate: "2026-05-12",
    endDate: "2026-05-12",
    participantIds: [personId],
    authority,
  }],
  momentLifeEvents: [{
    momentId: uuid(50),
    lifeEventId: uuid(13),
    relationType: "Événement principal",
    validationStatus: "Confirmé",
  }],
  contexts: [{
    contextId: uuid(70),
    typeKey: "teletravail",
    date: "2026-05-12",
    participantIds: [personId],
    title: "Télétravail",
    authority,
  }],
});
const aprilCalendar = calendarArtifact("2026-04", {
  lifeEvents: [
    life(100, "pharmacie", {
      title: "Pharmacie bord avril",
      startDate: "2026-04-27",
      endDate: "2026-04-27",
    }),
    ...Array.from({ length: 5 }, (_, index) => life(110 + index, "voyage_sejour", {
      title: `Ribbon bord avril ${index}`,
      startDate: "2026-04-27",
      endDate: "2026-05-03",
    })),
  ],
});
const juneCalendar = calendarArtifact("2026-06");

function component(key, amount) {
  return {
    canonicalComponentKey: key,
    amount,
    economicMonth: "2026-05",
    sourceRefs: [`operation:${key}`],
    timingEvidence: [],
    sourceKind: "operation",
    provenance: authority,
  };
}

const purchaseEventId = uuid(80);
const mayLedger = daily.buildDailyEconomicLedgerMonthArtifact({
  householdId,
  month: "2026-05",
  currency: "EUR",
  actualMonthAmount: "30",
  components: [component("purchase-a", "10"), component("purchase-b", "20")],
  purchaseEvents: [{
    fact: "fct_purchase_event",
    householdId,
    householdTimeZone: "Europe/Paris",
    purchaseEventId,
    sources: ["purchase-a", "purchase-b"].map((key) => ({
      membershipKind: "CONSUMPTION_COMPONENT",
      kind: "operation",
      sourceId: key,
      canonicalComponentKey: key,
      evidenceRefs: [`purchase_event:${purchaseEventId}`],
      provenance: "EXPLICIT_USER_ASSERTION",
    })),
    economicAmount: "30",
    timing: {
      status: "KNOWN",
      precision: "DAY",
      economicDate: "2026-05-12",
      economicMonth: "2026-05",
      authority: "EXPLICIT_EVENT",
      evidenceRefs: [`purchase_event:${purchaseEventId}`],
    },
    provenance: "EXPLICIT_USER_ASSERTION",
  }],
});
const emptyLedger = (month) => daily.buildDailyEconomicLedgerMonthArtifact({
  householdId, month, currency: "EUR", actualMonthAmount: "0", components: [], purchaseEvents: [],
});
const aprilLedger = emptyLedger("2026-04");
const juneLedger = emptyLedger("2026-06");
const expenseEventId = mayLedger.expenseEvents[0].expenseEventId;

const baseContext = {
  householdId,
  timeZone: "Europe/Paris",
  calendarArtifacts: [aprilCalendar, mayCalendar, juneCalendar],
  dailyArtifacts: [aprilLedger, mayLedger, juneLedger],
  personDirectory: [{
    personId,
    displayInitial: "M",
    label: "Manon",
    sourceRefs: [{ kind: "person", id: personId }],
  }],
  expenseDescriptors: [{
    expenseEventId,
    label: "Achat réel",
    merchantLabel: "Marchand",
    narrativeOwnerId: `moment:${uuid(50)}`,
    sourceRefs: [{ kind: "purchase_event", id: purchaseEventId }],
  }],
};

const monthModel = readmodels.buildMonthCalendarReadModel({
  ...baseContext,
  capabilities: capability(request.queryResourceKeys.historyMonthCalendar),
}, "2026-05");

check(() => readmodels.monthCalendarReadModelSchema.parse(monthModel));
check(() => {
  const artifactDay = mayCalendar.days.find(({ date }) => date === "2026-05-12");
  const day = monthModel.daysByDate["2026-05-12"];
  assert.deepEqual(
    day.visibleMarkers.map(({ calendarItemId }) => calendarItemId),
    artifactDay.orderedMarkerGroups.items.slice(0, 3).map(({ calendarItemId }) => calendarItemId),
    "Month top3 doit être le préfixe exact de l'ordre artifact",
  );
});
check(() => {
  assert.equal(monthModel.weeks.every(({ dayDates }) => dayDates.length === 7), true);
  assert.equal(monthModel.gridStartDate, "2026-04-27");
  const outside = monthModel.daysByDate["2026-04-27"];
  assert.equal(outside.inSelectedMonth, false);
  assert.equal(outside.targetMonth, "2026-04");
  assert.equal(outside.journalRef.params.date, "2026-04-27");
  assert.equal(outside.journalRef.resource, "history_day_journal");
  const adjacentMarker = outside.orderedMarkerGroups.items.find(({ semanticTypeKey }) => semanticTypeKey === "pharmacie");
  assert.deepEqual(adjacentMarker.targetRef, {
    resource: "history_day_journal",
    params: { date: "2026-04-27" },
  }, "un Marker provenant d'un artifact adjacent doit viser le Journal de sa date réelle");
  const localMarker = monthModel.daysByDate["2026-05-12"].orderedMarkerGroups.items
    .find(({ semanticTypeKey }) => semanticTypeKey === "pharmacie");
  assert.deepEqual(localMarker.targetRef, {
    resource: "history_activity_detail",
    params: { activityTypeKey: "pharmacie" },
  }, "un Marker provenant de l'artifact propriétaire conserve sa cible Activity");
});
check(() => {
  const ribbonSegments = monthModel.ribbonSegments.items.filter(({ weekStart }) => weekStart === "2026-05-04");
  assert.equal(ribbonSegments.length, 4);
  assert.deepEqual(ribbonSegments.map(({ lane }) => lane), [1, 2, 3, 4]);
  const overflow = monthModel.ribbonOverflow.items.find(({ weekStart }) => weekStart === "2026-05-04");
  assert.equal(overflow.count, 1);
  assert.equal(overflow.items.length, 1);
  assert.equal(overflow.items[0].calendarItemId, `life_event:${uuid(34)}`);
  assert.equal(overflow.items[0].title, "Ribbon 4");
  assert.deepEqual(overflow.items[0].targetRef, { resource: "history_activity_detail", params: { activityTypeKey: "voyage_sejour" } });
  assert.equal(ribbonSegments[0].eventStartDate, "2026-05-04");
  assert.equal(ribbonSegments[0].eventEndDate, "2026-05-10");
  assert.equal(ribbonSegments[0].targetRef.resource, "history_activity_detail");
  assert.equal(new Set(overflow.items.map(({ calendarItemId }) => calendarItemId)).size, overflow.items.length);
  assert.equal(monthModel.daysByDate["2026-05-04"].activeRibbonItemIds.length, 5, "aucun Ribbon n'est perdu dans le jour");
  assert.equal(monthModel.daysByDate["2026-05-04"].hiddenMarkerCount.value, 0, "overflow Ribbon et Marker restent distincts");
});
check(() => {
  const adjacentSegments = monthModel.ribbonSegments.items.filter(({ weekStart, title }) =>
    weekStart === "2026-04-27" && title.startsWith("Ribbon bord avril"));
  const adjacentOverflow = monthModel.ribbonOverflow.items.find(({ weekStart }) => weekStart === "2026-04-27");
  assert.equal(adjacentSegments.length, 4);
  assert.equal(adjacentOverflow.count, 1);
  assert.equal(adjacentSegments.every(({ targetRef }) => targetRef.resource === "history_day_journal"
    && targetRef.params.date === "2026-04-27"), true, "les Ribbons adjacents normaux doivent viser le Journal réel");
  assert.deepEqual(adjacentOverflow.items[0].targetRef, {
    resource: "history_day_journal",
    params: { date: "2026-04-27" },
  }, "le Ribbon overflow adjacent doit suivre la même doctrine Journal");
});
check(() => {
  const hover = monthModel.daysByDate["2026-05-12"].hover.data;
  assert.equal(hover.economicExpenses.data.items.length, 1, "Hover reste au grain acte économique humain");
  assert.equal(hover.economicExpenses.data.items[0].expenseEventId, expenseEventId);
  assert.equal(hover.economicExpenses.data.items[0].amount, "30");
});

const weekModel = readmodels.buildWeekReadModel({
  ...baseContext,
  capabilities: capability(request.queryResourceKeys.historyWeek),
}, "2026-05-11");
check(() => readmodels.weekReadModelSchema.parse(weekModel));
check(() => {
  const monthOrder = monthModel.daysByDate["2026-05-12"].orderedMarkerGroups.items.map(({ calendarItemId }) => calendarItemId);
  const weekDay = weekModel.days.find(({ date }) => date === "2026-05-12");
  assert.deepEqual(weekDay.visibleMarkers.map(({ calendarItemId }) => calendarItemId), monthOrder.slice(0, 6));
  assert.equal(weekModel.referenceMonth, "2026-05");
});

const crossMonthWeek = readmodels.buildWeekReadModel({
  ...baseContext,
  capabilities: capability(request.queryResourceKeys.historyWeek),
}, "2026-04-27");
check(() => {
  const adjacentRibbon = crossMonthWeek.ribbonSegments.items
    .find(({ calendarItemId }) => calendarItemId === `life_event:${uuid(35)}`);
  assert.equal(crossMonthWeek.referenceMonth, "2026-04");
  assert.deepEqual(adjacentRibbon.targetRef, {
    resource: "history_day_journal",
    params: { date: "2026-05-01" },
  }, "Week utilise le mois du jeudi et externalise les Ribbons de l'artifact adjacent");
});

const journalSupplement = {
  refundsAndAdjustments: {
    status: "KNOWN",
    items: [{
      movementId: uuid(90),
      date: "2026-05-20",
      label: "Remboursement achat",
      amount: "5",
      relatedExpenseEventId: expenseEventId,
      sourceRefs: [{ kind: "operation", id: uuid(90) }],
    }],
    totalCount: 1,
  },
  inflows: { status: "KNOWN", items: [], totalCount: 0 },
  technicalMovements: { status: "KNOWN", items: [], totalCount: 0 },
  causalCostByCalendarItemId: { [`moment:${uuid(50)}`]: { status: "KNOWN", value: "30" } },
};
const journal = readmodels.buildJournalDayReadModel({
  ...baseContext,
  capabilities: capability(request.queryResourceKeys.historyDayJournal),
}, "2026-05-12", journalSupplement);
check(() => readmodels.journalDayReadModelSchema.parse(journal));
check(() => {
  const ribbonJournal = readmodels.buildJournalDayReadModel({
    ...baseContext,
    capabilities: capability(request.queryResourceKeys.historyDayJournal),
  }, "2026-05-04", journalSupplement);
  const ids = ribbonJournal.activeContinuousEvents.data.items.map(({ calendarItemId }) => calendarItemId);
  assert.equal(ids.length, 5);
  assert.ok(ids.includes(`life_event:${uuid(34)}`), "la cible Journal expose aussi le Ribbon masqué");
});
check(() => {
  const timed = journal.timedTimeline.data.items;
  const untimed = journal.untimedEvents.data.items;
  assert.ok(timed.every((item) => Object.hasOwn(item, "startTime")));
  assert.ok(untimed.every((item) => !Object.hasOwn(item, "startTime")), "Journal n'invente aucune heure");
  const ids = [...timed, ...untimed].map(({ calendarItemId }) => calendarItemId);
  assert.equal(new Set(ids).size, ids.length, "Moment et autres mouvements ne sont pas dupliqués");
  assert.equal(journal.otherMovements.otherExpenses.visibility, "HIDDEN", "une dépense possédée narrativement n'est pas répétée dans les autres dépenses");
});
check(() => {
  const refundDay = readmodels.buildJournalDayReadModel({
    ...baseContext,
    capabilities: capability(request.queryResourceKeys.historyDayJournal),
  }, "2026-05-20", journalSupplement);
  const refund = refundDay.otherMovements.refundsAndAdjustments.data.items[0];
  assert.equal(refund.relatedExpenseEventId, expenseEventId, "le remboursement conserve son rattachement économique");
  assert.equal(refund.date, "2026-05-20", "le remboursement conserve sa date économique fournie, sans fallback bancaire");
  assert.equal(refundDay.otherMovements.otherExpenses.visibility, "HIDDEN");
});

const spentDuringOwnerId = "moment:spent-during-fixture";
const expenseSummary = (id, economicDate, amount, overrides = {}) => ({
  expenseEventId: `expense:${id}`,
  economicDate,
  label: `Dépense ${id}`,
  eventKind: "PURCHASE_EVENT",
  amount,
  sourceRefs: [{ kind: "purchase_event", id }],
  ...overrides,
});
const knownExpenses = (items) => ({ status: "KNOWN", items, totalCount: items.length });
const multiDayWindow = { startDate: "2026-05-12", endDate: "2026-05-13" };

check(() => {
  const expenses = knownExpenses([
    expenseSummary("A", "2026-05-12", "10"),
  ]);
  assert.deepEqual(
    readmodels.computeSpentDuring({ expenses, window: multiDayWindow }),
    { status: "KNOWN", value: "10" },
    "Cas A: une dépense dans la fenêtre sans lien causal appartient à spentDuring",
  );
  assert.equal(
    readmodels.selectCausalExpenses(expenses, spentDuringOwnerId).items.length,
    0,
    "Cas A: la présence temporelle ne crée aucun lien causal",
  );
});

check(() => {
  const causalBefore = expenseSummary("B", "2026-05-11", "20", {
    narrativeOwnerId: spentDuringOwnerId,
  });
  const expenses = knownExpenses([causalBefore]);
  assert.equal(
    readmodels.selectCausalExpenses(expenses, spentDuringOwnerId).items[0].expenseEventId,
    causalBefore.expenseEventId,
    "Cas B: le lien causal reste autoritaire même avant le Moment",
  );
  assert.deepEqual(
    readmodels.computeSpentDuring({ expenses, window: multiDayWindow }),
    { status: "KNOWN", value: "0" },
    "Cas B: une dépense causale antérieure reste hors spentDuring",
  );
});

check(() => {
  const causalDuring = expenseSummary("C", "2026-05-12", "30", {
    narrativeOwnerId: spentDuringOwnerId,
  });
  const expenses = knownExpenses([causalDuring]);
  assert.equal(readmodels.selectCausalExpenses(expenses, spentDuringOwnerId).items.length, 1);
  assert.deepEqual(
    readmodels.computeSpentDuring({
      expenses: knownExpenses([causalDuring, { ...causalDuring }]),
      window: multiDayWindow,
    }),
    { status: "KNOWN", value: "30" },
    "Cas C: un même événement causal et temporel ne compte qu'une fois dans spentDuring",
  );
});

check(() => {
  const observed = expenseSummary("D", "2026-05-12", "5");
  const partialExpenses = {
    status: "PARTIAL",
    items: [observed],
    partialMeaning: "OBSERVED_ONLY",
    knownCount: 1,
    quality: { reasonCode: "DATA_UNASSIGNED_TIMING" },
  };
  assert.deepEqual(
    readmodels.computeSpentDuring({ expenses: partialExpenses, window: multiDayWindow }),
    {
      status: "PARTIAL",
      value: "5",
      partialMeaning: "OBSERVED_ONLY",
      quality: { reasonCode: "DATA_UNASSIGNED_TIMING" },
    },
    "Cas D: seul le montant observé est affirmé, sans distribuer l'unassigned",
  );
  assert.equal(
    readmodels.computeSpentDuring({
      expenses: { ...partialExpenses, items: [], knownCount: 0 },
      window: multiDayWindow,
    }).status,
    "UNKNOWN",
    "Cas D: sans dépense assignée observable, aucun zéro n'est inventé",
  );
});

check(() => {
  const expenses = knownExpenses([
    expenseSummary("E", "2026-05-12", "12"),
  ]);
  assert.deepEqual(
    readmodels.computeSpentDuring({
      expenses,
      window: { startDate: "2026-05-12", endDate: "2026-05-12" },
    }),
    { status: "NOT_APPLICABLE", quality: { reasonCode: "POLICY_NOT_APPLICABLE" } },
    "Cas E: un Moment ponctuel sans fenêtre horaire n'expose pas spentDuring",
  );
  assert.equal(
    readmodels.computeSpentDuring({
      expenses,
      window: {
        startDate: "2026-05-12",
        endDate: "2026-05-12",
        startTime: "18:00",
        endTime: "23:00",
      },
    }).status,
    "UNKNOWN",
    "Cas E: une dépense sans temporalité horaire reste UNKNOWN dans une fenêtre ponctuelle précise",
  );
});

const overview = readmodels.buildMonthQuickOverviewReadModel({
  ...baseContext,
  capabilities: capability(request.queryResourceKeys.historyMonthOverview),
}, "2026-05", {
  bankOutflows: { status: "KNOWN", value: "45" },
  bankInflows: { status: "KNOWN", value: "10" },
  causalCostByCalendarItemId: { [`moment:${uuid(50)}`]: { status: "KNOWN", value: "30" } },
  explicitIncidentHighlights: [{
    highlightId: "incident:1",
    calendarItemId: `life_event:${uuid(14)}`,
    title: "Incident explicite",
    dateLabel: "2026-05-12",
    iconKey: "incident",
    startDate: "2026-05-12",
    sourceRefs: [{ kind: "incident", id: "1" }],
    causalCost: { status: "KNOWN", value: "8" },
  }],
  narrativePlaces: [{
    placeId: uuid(90), title: "Lieu narratif", presenceDays: 3,
    localizedAmount: { status: "KNOWN", value: "12" }, iconKey: "place",
    sourceRefs: [{ kind: "place", id: uuid(90) }],
  }],
});
check(() => readmodels.monthQuickOverviewReadModelSchema.parse(overview));
check(() => {
  assert.equal(overview.narrativeCarousel.visibility, "VISIBLE");
  assert.deepEqual(overview.narrativeCarousel.data.items.slice(0, 2).map(({ kind }) => kind), ["EVENT", "PLACE"]);
  assert.equal(overview.narrativeCarousel.data.items[1].targetRef.resource, "history_place_detail");
});

function stripOldCalendarItem(item) {
  const clone = structuredClone(item);
  delete clone.filterTags;
  delete clone.itemKind;
  delete clone.targetRef;
  return clone;
}
function stripOldCollectionItems(node) {
  if (node?.status === "KNOWN" || node?.status === "PARTIAL") node.items = node.items.map(stripOldCalendarItem);
}
function stripOldDay(day) {
  delete day.economicAmountExcludingFixed;
  stripOldCollectionItems(day.orderedMarkerGroups);
  day.visibleMarkers = day.visibleMarkers.map(stripOldCalendarItem);
  if (day.hover?.visibility === "VISIBLE") {
    delete day.hover.data.economicAmountExcludingFixed;
    if (day.hover.data.calendarEvents?.visibility === "VISIBLE") stripOldCollectionItems(day.hover.data.calendarEvents.data);
    if (day.hover.data.activeRibbons?.visibility === "VISIBLE") stripOldCollectionItems(day.hover.data.activeRibbons.data);
  }
}
function stripOldRibbons(collection) {
  if (collection.status !== "KNOWN" && collection.status !== "PARTIAL") return;
  for (const segment of collection.items) {
    delete segment.eventStartDate;
    delete segment.eventEndDate;
    delete segment.targetRef;
  }
}
const oldMonthPayload = structuredClone(monthModel);
delete oldMonthPayload.unassignedTiming;
Object.values(oldMonthPayload.daysByDate).forEach(stripOldDay);
stripOldRibbons(oldMonthPayload.ribbonSegments);
const oldWeekPayload = structuredClone(weekModel);
oldWeekPayload.days.forEach(stripOldDay);
stripOldRibbons(oldWeekPayload.ribbonSegments);
const oldOverviewPayload = structuredClone(overview);
delete oldOverviewPayload.narrativeCarousel;
check(() => {
  readmodels.oldMonthCalendarReadModelSchema.parse(oldMonthPayload);
  readmodels.oldWeekReadModelSchema.parse(oldWeekPayload);
  readmodels.oldMonthQuickOverviewReadModelSchema.parse(oldOverviewPayload);
  assert.throws(() => readmodels.monthCalendarReadModelSchema.parse(oldMonthPayload));
  assert.throws(() => readmodels.weekReadModelSchema.parse(oldWeekPayload));
  assert.throws(() => readmodels.monthQuickOverviewReadModelSchema.parse(oldOverviewPayload));
});
check(() => {
  const serialized = JSON.stringify(overview);
  assert.equal(/typical|minimal|rank|rang|aiSummary/i.test(serialized), false, "Overview n'expose ni Typical, Minimal, rang, ni résumé IA");
});
check(() => {
  const again = readmodels.buildMonthQuickOverviewReadModel({
    ...baseContext,
    capabilities: capability(request.queryResourceKeys.historyMonthOverview),
  }, "2026-05", {
    bankOutflows: { status: "KNOWN", value: "45" },
    bankInflows: { status: "KNOWN", value: "10" },
    causalCostByCalendarItemId: { [`moment:${uuid(50)}`]: { status: "KNOWN", value: "30" } },
    explicitIncidentHighlights: [{
      highlightId: "incident:1", calendarItemId: `life_event:${uuid(14)}`, title: "Incident explicite",
      dateLabel: "2026-05-12", iconKey: "incident", startDate: "2026-05-12",
      sourceRefs: [{ kind: "incident", id: "1" }], causalCost: { status: "KNOWN", value: "8" },
    }],
    narrativePlaces: [{
      placeId: uuid(90), title: "Lieu narratif", presenceDays: 3,
      localizedAmount: { status: "KNOWN", value: "12" }, iconKey: "place",
      sourceRefs: [{ kind: "place", id: uuid(90) }],
    }],
  });
  assert.deepEqual(
    overview.highlights.data.items.map(({ highlightId }) => highlightId),
    again.highlights.data.items.map(({ highlightId }) => highlightId),
    "l'ordre des highlights doit être déterministe",
  );
});

check(() => {
  const v2Resources = request.registeredQueryResourceKeys.filter((resource) => request.getQueryResourceContract(resource).family === "history_v2");
  assert.deepEqual(v2Resources, [
    "history_month_calendar",
    "history_week",
    "history_day_journal",
    "history_month_overview",
    "history_month_balance_summary",
    "history_bank_economy_bridge",
    "history_month_categories",
    "history_category_detail",
    "history_month_spending_nature",
    "history_spending_segment_detail",
    "history_minimal_preview",
    "history_month_life_money",
    "history_activity_detail",
    "history_moment_detail",
    "history_place_detail",
  ]);
  assert.equal(request.registeredQueryResourceKeys.includes("history_day_hover"), false);
  assert.equal(request.registeredQueryResourceKeys.includes("economic_expense_summary"), false);
  assert.equal(registry.findSchemaRegistryOrphans().length, 0);
});
check(() => {
  const published = readmodels.monthCalendarReadModelSchema.parse({
    ...monthModel,
    publicationMeta: {
      publicationId: "fake",
      revision: 1,
      contractVersion: "v2",
      factsHash: "0".repeat(64),
      policyVersions: monthModel.policyVersions,
      generatedAt: "2026-08-30T00:00:00Z",
    },
  });
  assert.notEqual(
    published.publicationMeta.factsHash,
    published.resourceInputHash,
    "le hash commun de publication est indépendant du hash interne de la ressource",
  );
});
check(() => {
  assert.throws(() => readmodels.monthCalendarReadModelSchema.parse({
    ...monthModel,
    publicationMeta: {
      publicationId: "fake",
      revision: 1,
      contractVersion: "v2",
      factsHash: "0".repeat(64),
      policyVersions: { ...monthModel.policyVersions, calendar_semantics: "v2" },
      generatedAt: "2026-08-30T00:00:00Z",
    },
  }), "un PublicationMeta dont les policies diffèrent doit être refusé");
});
check(() => {
  assert.equal(Object.hasOwn(monthModel, "publicationMeta"), false, "le build read-only n'invente pas de publicationId FROZEN_MONTH");
  assert.match(monthModel.resourceInputHash, /^[0-9a-f]{64}$/);
});

console.log(`History V2 ReadModels: ${checks}/${checks} checks PASS`);
