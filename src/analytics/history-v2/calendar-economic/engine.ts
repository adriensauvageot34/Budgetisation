import { computeArtifactInputHash } from "../facts-hash";
import type { CalendarSemanticItem, CalendarSemanticMonthArtifact } from "../calendar";
import { addDays, addMonths, parseLocalDate, type LocalDate } from "../../../core/time";
import { addMoney, compareMoney, parseMoney, type Money } from "../../../core/money";
import type {
  CalendarEconomicComponentQualification,
  CalendarEconomicMarkerKind,
  CalendarEconomicProjection,
  CalendarEconomicProjectionInput,
} from "./types";

const zero = parseMoney("0");

const markerPolicy: Readonly<Record<CalendarEconomicMarkerKind, {
  readonly title: string;
  readonly iconKey: string;
  readonly filterTag: "GROCERY" | "DINING" | "HEALTH_CARE" | "TRANSPORT" | "SUBSCRIPTION" | "FIXED_CHARGE";
  readonly priorityBand: 1 | 2 | 3;
  readonly priorityWeight: number;
}>> = Object.freeze({
  HEALTH: { title: "Santé / pharmacie", iconKey: "pharmacy", filterTag: "HEALTH_CARE", priorityBand: 3, priorityWeight: 78 },
  DINING: { title: "Restaurant / repas", iconKey: "restaurant", filterTag: "DINING", priorityBand: 3, priorityWeight: 72 },
  BAKERY_MEAL: { title: "Boulangerie / repas", iconKey: "bakery", filterTag: "DINING", priorityBand: 2, priorityWeight: 68 },
  GROCERY: { title: "Courses", iconKey: "groceries", filterTag: "GROCERY", priorityBand: 2, priorityWeight: 64 },
  TRANSPORT_SPEND: { title: "Transport / déplacement", iconKey: "transport", filterTag: "TRANSPORT", priorityBand: 2, priorityWeight: 54 },
  SUBSCRIPTION: { title: "Abonnement", iconKey: "subscription", filterTag: "SUBSCRIPTION", priorityBand: 1, priorityWeight: 28 },
  FIXED_CHARGE: { title: "Charge fixe", iconKey: "fixed_charge", filterTag: "FIXED_CHARGE", priorityBand: 1, priorityWeight: 22 },
});

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function monthDates(month: CalendarEconomicProjectionInput["month"]): readonly LocalDate[] {
  const start = parseLocalDate(`${month}-01`);
  const end = addDays(parseLocalDate(`${addMonths(month, 1)}-01`), -1);
  const dates: LocalDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function markerKind(value: CalendarEconomicComponentQualification): CalendarEconomicMarkerKind | undefined {
  const category = value.categoryKey;
  const subcategory = value.subcategoryKey;
  if (
    value.recurrence === "CONFIRMED"
    && (category === "numerique" || category === "telecom" || category === "transport_voiture")
    && subcategory !== undefined
    && (
      subcategory.includes("__abonnement_")
      || subcategory.includes("__streaming_")
      || subcategory.includes("__stockage_cloud")
      || subcategory === "telecom__forfait_abonnement_telecom"
    )
  ) return "SUBSCRIPTION";
  if (subcategory === "alimentation__courses_alimentaires" || subcategory === "alimentation__epicerie_alimentation_generale") return "GROCERY";
  if (subcategory === "alimentation__boulangerie") return "BAKERY_MEAL";
  if (category === "restauration") return "DINING";
  if (category === "sante") return "HEALTH";
  if (category === "transport_voiture" || subcategory === "voyages__transport_aerien") return "TRANSPORT_SPEND";
  if (value.behavior === "FIXED" && ["logement", "assurances", "banque", "telecom"].includes(category ?? "")) return "FIXED_CHARGE";
  return undefined;
}

function markerItem(input: {
  readonly date: LocalDate;
  readonly kind: CalendarEconomicMarkerKind;
  readonly members: readonly CalendarEconomicComponentQualification[];
}): CalendarSemanticItem {
  const policy = markerPolicy[input.kind];
  const sourceRefs = sortedUnique(input.members.flatMap(({ sourceRefs, componentKey }) => [
    ...sourceRefs,
    `economic_component:${componentKey}`,
  ]));
  const music = input.kind === "SUBSCRIPTION"
    && input.members.some(({ subcategoryKey }) => subcategoryKey === "numerique__streaming_musical");
  return {
    calendarItemId: `economic:${input.date}:${input.kind}`,
    sourceKind: "economic",
    sourceRefs,
    filterTags: [policy.filterTag],
    itemKind: "ECONOMIC",
    semanticTypeKey: input.kind,
    title: music ? "Abonnement musique" : policy.title,
    titleKind: "GENERIC_FALLBACK",
    iconKey: music ? "music_subscription" : policy.iconKey,
    renderMode: "Marker",
    markerTier: policy.priorityBand === 3 ? "Standard" : "Secondary",
    priorityBand: policy.priorityBand,
    priorityWeight: policy.priorityWeight,
    spanBehavior: "POINT",
    anchorDate: input.date,
    startDate: input.date,
    endDate: input.date,
    householdParticipants: [],
    memberSourceIds: input.members.map(({ componentKey }) => `economic_component:${componentKey}`).sort(),
    rawOccurrenceCount: input.members.length,
    monthVisibility: true,
    authority: {
      kind: "DERIVED",
      authority: "calendar_economic_projection@v1",
      methodId: "calendar-economic-projection",
      methodVersion: "v1",
    },
  };
}

export function buildCalendarEconomicProjection(input: CalendarEconomicProjectionInput): CalendarEconomicProjection {
  if (input.ledger.month !== input.month || input.ledger.householdId !== input.householdId) {
    throw new TypeError("CalendarEconomicProjection exige un Daily Ledger du même foyer et du même mois.");
  }
  const factKeys = new Set(input.facts.map(({ canonicalComponentKey }) => String(canonicalComponentKey)));
  const qualificationByKey = new Map(input.qualifications.map((value) => [value.componentKey, value]));
  if (qualificationByKey.size !== input.qualifications.length) throw new TypeError("Qualification Calendar dupliquée.");
  const issues = new Set<string>();
  const markersByGroup = new Map<string, CalendarEconomicComponentQualification[]>();
  for (const allocation of input.ledger.allocationEntries) {
    if (!factKeys.has(allocation.componentKey)) continue;
    const qualification = qualificationByKey.get(allocation.componentKey);
    if (qualification === undefined) {
      issues.add("DATA_PARTIAL_SOURCE");
      continue;
    }
    if (allocation.effectiveEconomicDate.status !== "KNOWN" || compareMoney(allocation.amount, zero) <= 0) continue;
    const kind = markerKind(qualification);
    if (kind === undefined) continue;
    const key = `${allocation.effectiveEconomicDate.value}|${kind}`;
    markersByGroup.set(key, [...(markersByGroup.get(key) ?? []), qualification]);
  }
  const markers = [...markersByGroup.entries()].map(([key, members]) => {
    const separator = key.indexOf("|");
    return markerItem({
      date: parseLocalDate(key.slice(0, separator)),
      kind: key.slice(separator + 1) as CalendarEconomicMarkerKind,
      members,
    });
  }).sort((left, right) =>
    (left.anchorDate ?? "").localeCompare(right.anchorDate ?? "")
    || right.priorityBand - left.priorityBand
    || right.priorityWeight - left.priorityWeight
    || left.calendarItemId.localeCompare(right.calendarItemId));
  const unresolvedTiming = input.ledger.allocationEntries
    .filter(({ effectiveEconomicDate }) => effectiveEconomicDate.status !== "KNOWN")
    .map(({ componentKey }) => componentKey);
  const days = monthDates(input.month).map((date) => {
    const dayEntries = input.ledger.allocationEntries.filter(({ effectiveEconomicDate }) =>
      effectiveEconomicDate.status === "KNOWN" && effectiveEconomicDate.value === date);
    let amount: Money = zero;
    let partial = unresolvedTiming.length > 0;
    let conflict = false;
    for (const entry of dayEntries) {
      const qualification = qualificationByKey.get(entry.componentKey);
      if (qualification?.behavior === "NON_FIXED") amount = addMoney(amount, entry.amount);
      else if (qualification?.behavior === "UNKNOWN" || qualification === undefined) partial = true;
      else if (qualification.behavior === "CONFLICT") {
        partial = true;
        conflict = true;
      }
    }
    return {
      date,
      economicAmountExcludingFixed: partial
        ? {
            status: "PARTIAL" as const,
            value: amount,
            partialMeaning: "OBSERVED_ONLY" as const,
            quality: { reasonCode: conflict ? "DATA_CONFLICTING_AUTHORITIES" as const : "DATA_PARTIAL_SOURCE" as const },
          }
        : { status: "KNOWN" as const, value: amount },
    };
  });
  for (const qualification of input.qualifications) {
    if (qualification.recurrence === "CONFLICT" || qualification.behavior === "CONFLICT") issues.add("DATA_CONFLICTING_AUTHORITIES");
    if (qualification.recurrence === "UNKNOWN" || qualification.behavior === "UNKNOWN") issues.add("DATA_PARTIAL_SOURCE");
  }
  const projectionInputHash = computeArtifactInputHash({
    identity: `calendar_economic_projection:${input.householdId}:${input.month}`,
    facts: [
      ...input.qualifications.map((value) => ({ factType: "calendar_economic_qualification", identity: value.componentKey, value })),
      ...input.ledger.allocationEntries.map((value) => ({ factType: "daily_economic_allocation", identity: value.componentKey, value })),
    ].map((value) => ({ ...value, value: JSON.parse(JSON.stringify(value.value)) })),
  });
  return {
    householdId: input.householdId,
    month: input.month,
    markers: issues.has("DATA_PARTIAL_SOURCE")
      ? { status: "PARTIAL", items: markers, partialMeaning: "OBSERVED_ONLY", knownCount: markers.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" } }
      : { status: "KNOWN", items: markers, totalCount: markers.length },
    days,
    unassignedComponentKeys: sortedUnique(unresolvedTiming),
    issues: [...issues].sort(),
    dependencyPolicies: {
      calendar_amount_views: "v1",
      canonical_component_classification: "v1",
      daily_economic_allocation: "v1",
      quality_visibility: "v1",
      facts_hash: "v1",
    },
    projectionInputHash,
  };
}

export function emptyCalendarEconomicProjection(input: {
  readonly householdId: CalendarEconomicProjection["householdId"];
  readonly month: CalendarEconomicProjection["month"];
}): CalendarEconomicProjection {
  return {
    householdId: input.householdId,
    month: input.month,
    markers: { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } },
    days: monthDates(input.month).map((date) => ({
      date,
      economicAmountExcludingFixed: { status: "UNKNOWN", quality: { reasonCode: "DATA_NO_SOURCE" } },
    })),
    unassignedComponentKeys: [],
    issues: ["DATA_NO_SOURCE"],
    dependencyPolicies: {
      calendar_amount_views: "v1",
      canonical_component_classification: "v1",
      daily_economic_allocation: "v1",
      quality_visibility: "v1",
      facts_hash: "v1",
    },
    projectionInputHash: computeArtifactInputHash({
      identity: `calendar_economic_projection:${input.householdId}:${input.month}:unavailable`,
      facts: [],
    }),
  };
}

function compareCalendarCentricMarkers(left: CalendarSemanticItem, right: CalendarSemanticItem): number {
  return right.priorityBand - left.priorityBand
    || Number(left.itemKind === "ECONOMIC") - Number(right.itemKind === "ECONOMIC")
    || right.priorityWeight - left.priorityWeight
    || left.calendarItemId.localeCompare(right.calendarItemId);
}

export function attachCalendarEconomicProjection(
  artifact: CalendarSemanticMonthArtifact,
  projection: CalendarEconomicProjection,
): CalendarSemanticMonthArtifact {
  if (artifact.month !== projection.month || artifact.householdId !== projection.householdId) {
    throw new TypeError("La projection économique ne correspond pas à l'artifact Calendar.");
  }
  const economicItems = projection.markers.status === "KNOWN" || projection.markers.status === "PARTIAL"
    ? projection.markers.items
    : [];
  const lifeItems = artifact.items.status === "KNOWN" || artifact.items.status === "PARTIAL"
    ? artifact.items.items
    : [];
  const combinedItems = [...lifeItems, ...economicItems].sort((left, right) => left.calendarItemId.localeCompare(right.calendarItemId));
  const partial = artifact.items.status === "PARTIAL" || projection.markers.status !== "KNOWN";
  const items = partial
    ? { status: "PARTIAL" as const, items: combinedItems, partialMeaning: "OBSERVED_ONLY" as const, knownCount: combinedItems.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" as const } }
    : { status: "KNOWN" as const, items: combinedItems, totalCount: combinedItems.length };
  const economicByDate = new Map<LocalDate, CalendarSemanticItem[]>();
  for (const item of economicItems) {
    if (item.anchorDate === undefined) continue;
    economicByDate.set(item.anchorDate, [...(economicByDate.get(item.anchorDate) ?? []), item]);
  }
  const days = artifact.days.map((day) => {
    const existing = day.orderedMarkerGroups.status === "KNOWN" || day.orderedMarkerGroups.status === "PARTIAL"
      ? day.orderedMarkerGroups.items
      : [];
    const ordered = [...existing, ...(economicByDate.get(day.date) ?? [])].sort(compareCalendarCentricMarkers);
    const dayPartial = day.orderedMarkerGroups.status !== "KNOWN" || projection.markers.status !== "KNOWN";
    const orderedMarkerGroups = dayPartial
      ? { status: "PARTIAL" as const, items: ordered, partialMeaning: "OBSERVED_ONLY" as const, knownCount: ordered.length, quality: { reasonCode: "DATA_PARTIAL_SOURCE" as const } }
      : { status: "KNOWN" as const, items: ordered, totalCount: ordered.length };
    return {
      ...day,
      orderedMarkerGroups,
      markers: ordered.slice(0, 3),
      hiddenMarkerGroupCount: Math.max(0, ordered.length - 3),
    };
  });
  return {
    ...artifact,
    items,
    days,
    economicProjection: projection,
    semanticIssues: sortedUnique([...artifact.semanticIssues, ...projection.issues]),
    dependencyPolicies: {
      ...artifact.dependencyPolicies,
      calendar_semantics: "v3",
      calendar_amount_views: "v1",
    },
    artifactInputHash: computeArtifactInputHash({
      identity: `calendar_semantic_month:${artifact.householdId}:${artifact.month}:calendar-centric`,
      facts: [],
      dependencies: [
        { dependencyId: "life_calendar", dependencyHash: artifact.artifactInputHash },
        { dependencyId: "economic_projection", dependencyHash: projection.projectionInputHash },
      ],
    }),
  };
}
