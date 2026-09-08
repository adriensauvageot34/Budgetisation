import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { parseMoney, type Money } from "../../core/money";
import { parseSupport, type Support } from "../../core/metrics";
import { parseInstant, parseLocalDate, parseYearMonth, type Instant, type LocalDate, type YearMonth } from "../../core/time";
import { hasOwn, parseStrictRecord, parseStringLiteral, requireProperty } from "../../core/validation";
import { parseMethodVersion, type MethodVersion } from "../../core/versions";
import type { MinimalMonthComponent } from "./minimal-month";
import type { HistoricalAuthorityType } from "./historical-authority";

export const HISTORICAL_MINIMAL_AUTHORITY_MODEL =
  "BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1" as const;
export const MINIMAL_STATE_METHOD_VERSION: MethodVersion =
  parseMethodVersion("minimal_month_cost@v2");
export const VARIABLE_ESSENTIAL_Q25_METHOD_VERSION: MethodVersion =
  parseMethodVersion("minimal_variable_essential_q25@v2");

export type HistoricalMinimalRuleFamily =
  | "FIXED_REQUIRED"
  | "PERIODIC_REQUIRED"
  | "VARIABLE_ESSENTIAL"
  | "DECLARED_MINIMUM"
  | "EXCLUDED_FROM_MINIMAL";

export type HistoricalAuthorityIdentity = {
  readonly authorityId: string;
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
  readonly declaredAt: Instant;
  readonly sourceRevision: number;
  readonly authorityType: HistoricalAuthorityType;
  readonly declaredByRef: string;
  readonly validationRef: string;
  readonly methodVersion: MethodVersion;
  readonly evidenceRefs: readonly string[];
};

export type HistoricalMinimalRuleAuthority = HistoricalAuthorityIdentity & {
  readonly family: HistoricalMinimalRuleFamily;
};

export type HistoricalRecurrenceAuthority = HistoricalAuthorityIdentity & {
  readonly state: "ACTIVE_FOR_MINIMAL" | "INACTIVE_FOR_MINIMAL";
  readonly monthlyEquivalent: Money;
};

export type HistoricalDeclaredMinimumAuthority = HistoricalAuthorityIdentity & {
  readonly authorityType: "DECLARED";
  readonly amount: Money;
};

export type HistoricalMinimalObservation =
  | {
      readonly month: YearMonth;
      readonly status: "KNOWN";
      readonly amount: Money;
      readonly eligible: boolean;
      readonly evidenceRefs: readonly string[];
    }
  | {
      readonly month: YearMonth;
      readonly status: "UNKNOWN";
      readonly eligible: boolean;
      readonly evidenceRefs: readonly string[];
    };

export type HistoricalMinimalComponentPlan = {
  readonly canonicalComponentKey: string;
  readonly bucket: "NEUTRAL_VARIABLE" | "OBLIGATION_OR_PROVISION";
  readonly rule: HistoricalMinimalRuleAuthority;
  readonly observations: readonly HistoricalMinimalObservation[];
  readonly recurrenceAuthority?: HistoricalRecurrenceAuthority;
  readonly declaredMinimumAuthority?: HistoricalDeclaredMinimumAuthority;
};

export type HistoricalMinimalAuthorityBundle = {
  readonly model: typeof HISTORICAL_MINIMAL_AUTHORITY_MODEL;
  readonly completeness: "COMPLETE_FOR_TARGET_MONTH";
  readonly knowledgeAsOf: Instant;
  readonly components: readonly HistoricalMinimalComponentPlan[];
};

export type HistoricalMinimalComponentState =
  | {
      readonly status: "KNOWN";
      readonly bucket: HistoricalMinimalComponentPlan["bucket"];
      readonly component: MinimalMonthComponent;
      readonly methodVersion: MethodVersion;
      readonly inputHash: string;
    }
  | {
      readonly status: "UNKNOWN";
      readonly canonicalComponentKey: string;
      readonly bucket: HistoricalMinimalComponentPlan["bucket"];
      readonly reasonCode:
        | "RULE_NOT_EFFECTIVE"
        | "AUTHORITY_NOT_KNOWN_AT_AS_OF"
        | "INSUFFICIENT_ELIGIBLE_OBSERVATIONS"
        | "DECLARED_AUTHORITY_MISSING"
        | "RECURRENCE_AUTHORITY_MISSING_OR_INACTIVE";
      readonly support?: Support;
      readonly methodVersion: MethodVersion;
      readonly inputHash: string;
    };

export type HistoricalMinimalState =
  | {
      readonly status: "KNOWN";
      readonly value: Money;
      readonly componentStates: readonly HistoricalMinimalComponentState[];
      readonly methodVersion: MethodVersion;
      readonly inputHash: string;
    }
  | {
      readonly status: "UNKNOWN";
      readonly componentStates: readonly HistoricalMinimalComponentState[];
      readonly methodVersion: MethodVersion;
      readonly inputHash: string;
    };

function nonEmptyString(value: unknown, typeName: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${typeName} doit être une chaîne non vide.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, typeName: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${typeName} doit être un entier positif ou nul.`);
  }
  return value as number;
}

function parseIdentity(record: Readonly<Record<string, unknown>>, typeName: string): HistoricalAuthorityIdentity {
  const effectiveTo = hasOwn(record, "effectiveTo")
    ? parseLocalDate(requireProperty(record, "effectiveTo", typeName))
    : undefined;
  const identity = {
    authorityId: nonEmptyString(requireProperty(record, "authorityId", typeName), `${typeName}.authorityId`),
    effectiveFrom: parseLocalDate(requireProperty(record, "effectiveFrom", typeName)),
    ...(effectiveTo === undefined ? {} : { effectiveTo }),
    declaredAt: parseInstant(requireProperty(record, "declaredAt", typeName)),
    sourceRevision: nonNegativeInteger(requireProperty(record, "sourceRevision", typeName), `${typeName}.sourceRevision`),
    authorityType: parseStringLiteral<HistoricalAuthorityType>(requireProperty(record, "authorityType", typeName), new Set([
      "OBSERVED_ECONOMIC_EVIDENCE", "RETROSPECTIVE_DECLARATION", "DECLARED", "CONTRACTUAL", "ANALYTICS_DERIVED",
    ]), `${typeName}.authorityType`),
    declaredByRef: nonEmptyString(requireProperty(record, "declaredByRef", typeName), `${typeName}.declaredByRef`),
    validationRef: nonEmptyString(requireProperty(record, "validationRef", typeName), `${typeName}.validationRef`),
    methodVersion: parseMethodVersion(requireProperty(record, "methodVersion", typeName)),
    evidenceRefs: parseEvidenceRefs(requireProperty(record, "evidenceRefs", typeName)),
  };
  if (identity.effectiveTo !== undefined && identity.effectiveTo <= identity.effectiveFrom) {
    throw new TypeError(`${typeName}.effectiveTo doit suivre strictement effectiveFrom pour [from,to).`);
  }
  return identity;
}

export function parseHistoricalMinimalRuleAuthority(value: unknown): HistoricalMinimalRuleAuthority {
  const typeName = "HistoricalMinimalRuleAuthority";
  const record = parseStrictRecord(value, ["authorityId", "family", "effectiveFrom", "effectiveTo", "declaredAt", "sourceRevision", "authorityType", "declaredByRef", "validationRef", "methodVersion", "evidenceRefs"], typeName);
  return {
    ...parseIdentity(record, typeName),
    family: parseStringLiteral(requireProperty(record, "family", typeName), new Set<HistoricalMinimalRuleFamily>([
      "FIXED_REQUIRED", "PERIODIC_REQUIRED", "VARIABLE_ESSENTIAL", "DECLARED_MINIMUM", "EXCLUDED_FROM_MINIMAL",
    ]), `${typeName}.family`),
  };
}

function parseRecurrenceAuthority(value: unknown): HistoricalRecurrenceAuthority {
  const typeName = "HistoricalRecurrenceAuthority";
  const record = parseStrictRecord(value, ["authorityId", "state", "monthlyEquivalent", "effectiveFrom", "effectiveTo", "declaredAt", "sourceRevision", "authorityType", "declaredByRef", "validationRef", "methodVersion", "evidenceRefs"], typeName);
  return {
    ...parseIdentity(record, typeName),
    state: parseStringLiteral(requireProperty(record, "state", typeName), new Set(["ACTIVE_FOR_MINIMAL", "INACTIVE_FOR_MINIMAL"]), `${typeName}.state`),
    monthlyEquivalent: parseMoney(requireProperty(record, "monthlyEquivalent", typeName)),
  };
}

function parseDeclaredMinimumAuthority(value: unknown): HistoricalDeclaredMinimumAuthority {
  const typeName = "HistoricalDeclaredMinimumAuthority";
  const record = parseStrictRecord(value, ["authorityId", "authorityType", "amount", "effectiveFrom", "effectiveTo", "declaredAt", "sourceRevision", "declaredByRef", "validationRef", "methodVersion", "evidenceRefs"], typeName);
  return {
    ...parseIdentity(record, typeName),
    authorityType: parseStringLiteral(requireProperty(record, "authorityType", typeName), new Set(["DECLARED"]), `${typeName}.authorityType`),
    amount: parseMoney(requireProperty(record, "amount", typeName)),
  };
}

function parseEvidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError("HistoricalMinimalObservation.evidenceRefs doit être un tableau.");
  return [...new Set(value.map((entry) => nonEmptyString(entry, "HistoricalMinimalObservation.evidenceRef")))].sort();
}

function parseObservation(value: unknown): HistoricalMinimalObservation {
  const typeName = "HistoricalMinimalObservation";
  const record = parseStrictRecord(value, ["month", "status", "amount", "eligible", "evidenceRefs"], typeName);
  const status = parseStringLiteral<"KNOWN" | "UNKNOWN">(requireProperty(record, "status", typeName), new Set(["KNOWN", "UNKNOWN"]), `${typeName}.status`);
  if (typeof record.eligible !== "boolean") throw new TypeError(`${typeName}.eligible doit être booléen.`);
  const common = {
    month: parseYearMonth(requireProperty(record, "month", typeName)),
    eligible: record.eligible,
    evidenceRefs: parseEvidenceRefs(requireProperty(record, "evidenceRefs", typeName)),
  };
  if (status === "KNOWN") {
    return { ...common, status, amount: parseMoney(requireProperty(record, "amount", typeName)) };
  }
  if (hasOwn(record, "amount")) throw new TypeError("Une observation UNKNOWN ne porte pas de montant.");
  return { ...common, status };
}

export function parseHistoricalMinimalAuthorityBundle(value: unknown): HistoricalMinimalAuthorityBundle {
  const typeName = "HistoricalMinimalAuthorityBundle";
  const record = parseStrictRecord(value, ["model", "completeness", "knowledgeAsOf", "components"], typeName);
  const rawComponents = requireProperty(record, "components", typeName);
  if (!Array.isArray(rawComponents)) throw new TypeError(`${typeName}.components doit être un tableau.`);
  const components = rawComponents.map((raw) => {
    const componentType = "HistoricalMinimalComponentPlan";
    const component = parseStrictRecord(raw, ["canonicalComponentKey", "bucket", "rule", "observations", "recurrenceAuthority", "declaredMinimumAuthority"], componentType);
    const observations = requireProperty(component, "observations", componentType);
    if (!Array.isArray(observations)) throw new TypeError(`${componentType}.observations doit être un tableau.`);
    const recurrenceAuthority = hasOwn(component, "recurrenceAuthority")
      ? parseRecurrenceAuthority(requireProperty(component, "recurrenceAuthority", componentType))
      : undefined;
    const declaredMinimumAuthority = hasOwn(component, "declaredMinimumAuthority")
      ? parseDeclaredMinimumAuthority(requireProperty(component, "declaredMinimumAuthority", componentType))
      : undefined;
    return {
      canonicalComponentKey: nonEmptyString(requireProperty(component, "canonicalComponentKey", componentType), `${componentType}.canonicalComponentKey`),
      bucket: parseStringLiteral<HistoricalMinimalComponentPlan["bucket"]>(requireProperty(component, "bucket", componentType), new Set(["NEUTRAL_VARIABLE", "OBLIGATION_OR_PROVISION"]), `${componentType}.bucket`),
      rule: parseHistoricalMinimalRuleAuthority(requireProperty(component, "rule", componentType)),
      observations: observations.map(parseObservation),
      ...(recurrenceAuthority === undefined ? {} : { recurrenceAuthority }),
      ...(declaredMinimumAuthority === undefined ? {} : { declaredMinimumAuthority }),
    };
  }).sort((left, right) => left.canonicalComponentKey.localeCompare(right.canonicalComponentKey));
  if (new Set(components.map(({ canonicalComponentKey }) => canonicalComponentKey)).size !== components.length) {
    throw new TypeError("Une composante Minimal historique ne peut être déclarée deux fois.");
  }
  return {
    model: parseStringLiteral(requireProperty(record, "model", typeName), new Set([HISTORICAL_MINIMAL_AUTHORITY_MODEL]), `${typeName}.model`),
    completeness: parseStringLiteral(requireProperty(record, "completeness", typeName), new Set(["COMPLETE_FOR_TARGET_MONTH"]), `${typeName}.completeness`),
    knowledgeAsOf: parseInstant(requireProperty(record, "knowledgeAsOf", typeName)),
    components,
  };
}

function effectiveAt(authority: HistoricalAuthorityIdentity, targetMonth: YearMonth): boolean {
  const date = `${targetMonth}-01` as LocalDate;
  return authority.effectiveFrom <= date && (authority.effectiveTo === undefined || date < authority.effectiveTo);
}

function authorityUnavailableReason(
  authority: HistoricalAuthorityIdentity,
  targetMonth: YearMonth,
  knowledgeAsOf: Instant,
): "RULE_NOT_EFFECTIVE" | "AUTHORITY_NOT_KNOWN_AT_AS_OF" | undefined {
  if (!effectiveAt(authority, targetMonth)) return "RULE_NOT_EFFECTIVE";
  return authority.declaredAt > knowledgeAsOf ? "AUTHORITY_NOT_KNOWN_AT_AS_OF" : undefined;
}

function digest(label: string, value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`${label}\n${canonicalSerializeGlobal(value)}`)));
}

function q25Type7(values: readonly Money[]): Money {
  const sorted = [...values].sort((left, right) => new Big(left).cmp(right));
  const position = (sorted.length - 1) * 0.25;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return parseMoney(new Big(sorted[lower]!).plus(new Big(sorted[upper]!).minus(sorted[lower]!).times(position - lower)).toFixed());
}

export function calculateVariableEssentialQ25(input: {
  readonly canonicalComponentKey: string;
  readonly bucket?: HistoricalMinimalComponentPlan["bucket"];
  readonly targetMonth: YearMonth;
  readonly knowledgeAsOf: Instant;
  readonly observations: readonly HistoricalMinimalObservation[];
  readonly rule: HistoricalMinimalRuleAuthority;
}): HistoricalMinimalComponentState {
  const targetMonth = parseYearMonth(input.targetMonth);
  const bucket = input.bucket ?? "NEUTRAL_VARIABLE";
  const base = { targetMonth, canonicalComponentKey: input.canonicalComponentKey, rule: input.rule };
  if (input.rule.family !== "VARIABLE_ESSENTIAL") throw new TypeError("La règle doit être VARIABLE_ESSENTIAL.");
  const unavailableReason = authorityUnavailableReason(input.rule, targetMonth, input.knowledgeAsOf);
  if (unavailableReason !== undefined) {
    return {
      status: "UNKNOWN", canonicalComponentKey: input.canonicalComponentKey, bucket,
      reasonCode: unavailableReason, methodVersion: VARIABLE_ESSENTIAL_Q25_METHOD_VERSION,
      inputHash: digest("minimal-variable-essential-q25-input@v2", base),
    };
  }
  const byMonth = new Map<YearMonth, HistoricalMinimalObservation>();
  for (const observation of input.observations) {
    const parsed = parseObservation(observation);
    if (parsed.month >= targetMonth || !parsed.eligible || parsed.status !== "KNOWN") continue;
    const existing = byMonth.get(parsed.month);
    if (existing !== undefined && canonicalSerializeGlobal(existing) !== canonicalSerializeGlobal(parsed)) {
      throw new TypeError(`Observations Minimal contradictoires pour ${parsed.month}.`);
    }
    byMonth.set(parsed.month, parsed);
  }
  const selected = [...byMonth.values()].sort((left, right) => left.month.localeCompare(right.month)).slice(-12);
  const support = parseSupport({ n: selected.length, unit: "month", level: selected.length >= 6 ? "sufficient" : "insufficient" });
  const hashInput = { ...base, observations: selected, policy: { maximumMonths: 12, minimumObservations: 6, estimator: "Q25_LINEAR_TYPE_7", missingIsZero: false } };
  const inputHash = digest("minimal-variable-essential-q25-input@v2", hashInput);
  if (selected.length < 6) {
    return {
      status: "UNKNOWN", canonicalComponentKey: input.canonicalComponentKey, bucket,
      reasonCode: "INSUFFICIENT_ELIGIBLE_OBSERVATIONS", support,
      methodVersion: VARIABLE_ESSENTIAL_Q25_METHOD_VERSION, inputHash,
    };
  }
  return {
    status: "KNOWN", bucket,
    component: {
      canonicalComponentKey: input.canonicalComponentKey,
      amount: q25Type7(selected.map((observation) => observation.status === "KNOWN" ? observation.amount : parseMoney("0"))),
      support,
      coverage: { level: "complete" },
      provenance: "derived",
    },
    methodVersion: VARIABLE_ESSENTIAL_Q25_METHOD_VERSION,
    inputHash,
  };
}

function resolveComponent(plan: HistoricalMinimalComponentPlan, targetMonth: YearMonth, knowledgeAsOf: Instant): HistoricalMinimalComponentState {
  const common = { canonicalComponentKey: plan.canonicalComponentKey, bucket: plan.bucket, methodVersion: MINIMAL_STATE_METHOD_VERSION };
  const unavailableReason = authorityUnavailableReason(plan.rule, targetMonth, knowledgeAsOf);
  if (unavailableReason !== undefined) {
    return { ...common, status: "UNKNOWN", reasonCode: unavailableReason, inputHash: digest("minimal-component-input@v2", { targetMonth, knowledgeAsOf, plan }) };
  }
  if (plan.rule.family === "VARIABLE_ESSENTIAL") {
    return calculateVariableEssentialQ25({ canonicalComponentKey: plan.canonicalComponentKey, bucket: plan.bucket, targetMonth, knowledgeAsOf, observations: plan.observations, rule: plan.rule });
  }
  const known = (amount: Money): HistoricalMinimalComponentState => ({
    status: "KNOWN", bucket: plan.bucket,
    component: {
      canonicalComponentKey: plan.canonicalComponentKey,
      amount,
      support: parseSupport({ n: 1, unit: "month", level: "sufficient" }),
      coverage: { level: "complete" },
      provenance: "derived",
    },
    methodVersion: MINIMAL_STATE_METHOD_VERSION,
    inputHash: digest("minimal-component-input@v2", { targetMonth, knowledgeAsOf, plan }),
  });
  if (plan.rule.family === "EXCLUDED_FROM_MINIMAL") return known(parseMoney("0"));
  if (plan.rule.family === "DECLARED_MINIMUM") {
    const authority = plan.declaredMinimumAuthority;
    return authority !== undefined && effectiveAt(authority, targetMonth) && authority.declaredAt <= knowledgeAsOf
      ? known(authority.amount)
      : { ...common, status: "UNKNOWN", reasonCode: "DECLARED_AUTHORITY_MISSING", inputHash: digest("minimal-component-input@v2", { targetMonth, knowledgeAsOf, plan }) };
  }
  const recurrence = plan.recurrenceAuthority;
  return recurrence !== undefined && effectiveAt(recurrence, targetMonth) && recurrence.declaredAt <= knowledgeAsOf && recurrence.state === "ACTIVE_FOR_MINIMAL"
    ? known(recurrence.monthlyEquivalent)
    : { ...common, status: "UNKNOWN", reasonCode: "RECURRENCE_AUTHORITY_MISSING_OR_INACTIVE", inputHash: digest("minimal-component-input@v2", { targetMonth, knowledgeAsOf, plan }) };
}

export function resolveHistoricalMinimalState(input: {
  readonly targetMonth: YearMonth;
  readonly authority: HistoricalMinimalAuthorityBundle;
}): HistoricalMinimalState {
  const targetMonth = parseYearMonth(input.targetMonth);
  const authority = parseHistoricalMinimalAuthorityBundle(input.authority);
  const componentStates = authority.components.map((plan) => resolveComponent(plan, targetMonth, authority.knowledgeAsOf));
  const inputHash = digest("minimal-state-input@v2", { targetMonth, authority, componentHashes: componentStates.map(({ inputHash: hash }) => hash), methodVersion: MINIMAL_STATE_METHOD_VERSION });
  if (componentStates.some(({ status }) => status === "UNKNOWN")) {
    return { status: "UNKNOWN", componentStates, methodVersion: MINIMAL_STATE_METHOD_VERSION, inputHash };
  }
  const value = componentStates.reduce((sum, state) =>
    new Big(sum).plus(state.status === "KNOWN" ? state.component.amount : "0").toFixed(), "0");
  return { status: "KNOWN", value: parseMoney(value), componentStates, methodVersion: MINIMAL_STATE_METHOD_VERSION, inputHash };
}
