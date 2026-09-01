import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
} from "../validation";
import {
  parsePolicyVersion,
  type PolicyVersion,
} from "../versions";

export const historyV2PolicyIds = [
  "canonical_purchase_event_timing",
  "canonical_component_classification",
  "canonical_continuity",
  "quality_visibility",
  "calendar_semantics",
  "daily_economic_allocation",
  "week_journal_projection",
  "month_overview_selection",
  "month_balance_summary",
  "category_explanation",
  "spending_nature",
  "life_money_selection",
  "facts_hash",
] as const;

export type HistoryV2PolicyId = (typeof historyV2PolicyIds)[number];
export type PolicyVersions = Readonly<
  Partial<Record<HistoryV2PolicyId, PolicyVersion>>
>;

const policyIds: ReadonlySet<string> = new Set(historyV2PolicyIds);
const v1 = parsePolicyVersion("v1");
const v2 = parsePolicyVersion("v2");

export const historyV2PolicyRegistry = Object.freeze({
  canonical_purchase_event_timing: v1,
  canonical_component_classification: v1,
  canonical_continuity: v1,
  quality_visibility: v1,
  calendar_semantics: v2,
  daily_economic_allocation: v1,
  week_journal_projection: v1,
  month_overview_selection: v1,
  month_balance_summary: v1,
  category_explanation: v1,
  spending_nature: v2,
  life_money_selection: v2,
  facts_hash: v1,
} satisfies Record<HistoryV2PolicyId, PolicyVersion>);

export function parseHistoryV2PolicyId(value: unknown): HistoryV2PolicyId {
  return parseStringLiteral<HistoryV2PolicyId>(
    value,
    policyIds,
    "HistoryV2PolicyId",
  );
}

export function parsePolicyVersions(value: unknown): PolicyVersions {
  const record = parseStrictRecord(
    value,
    historyV2PolicyIds,
    "PolicyVersions",
  );
  const entries = historyV2PolicyIds
    .filter((policyId) => hasOwn(record, policyId))
    .map((policyId) => [
      policyId,
      parsePolicyVersion(record[policyId]),
    ] as const);
  return Object.freeze(Object.fromEntries(entries)) as PolicyVersions;
}

export function resolvePolicyVersions(
  requestedPolicyIds: readonly HistoryV2PolicyId[],
): PolicyVersions {
  const unique = [...new Set(requestedPolicyIds)].sort();
  return Object.freeze(Object.fromEntries(
    unique.map((policyId) => [policyId, historyV2PolicyRegistry[policyId]]),
  )) as PolicyVersions;
}

export function policyVersionsEqual(
  left: PolicyVersions,
  right: PolicyVersions,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) =>
      key === rightKeys[index]
      && left[key as HistoryV2PolicyId] === right[key as HistoryV2PolicyId]);
}
