import Big from "big.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate } from "../../core/global-v2";
import { compareMoney, parseMoney, type Money } from "../../core/money";
import { addMonths, parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../core/time";
import { parseMethodVersion } from "../../core/versions";
import { globalMaterialityPolicies } from "./materiality";
import { buildGlobalTemporalAnalysis } from "./temporal-analysis";

export const GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION = parseMethodVersion("global_merchant_substitution@v1");
export const GLOBAL_MERCHANT_SUBSTITUTION_POLICY_VERSION = "merchant-substitution-catalog-windows@v1";

export type GlobalMerchantSubstitutionEvent = {
  readonly purchaseEventId: string;
  readonly merchantId: string;
  readonly month: YearMonth;
  readonly netRetainedValue: Money;
  readonly evidenceRefs: readonly string[];
};

export type GlobalMerchantSubstitutionCatalog =
  | { readonly status: "UNKNOWN"; readonly reasonCode: "DATA_GATED" | "AUTHORITY_GATED"; readonly evidenceRefs: readonly string[] }
  | {
      readonly status: "KNOWN";
      readonly catalogVersion: string;
      readonly universes: readonly {
        readonly universeId: string;
        readonly merchantIds: readonly string[];
        readonly evidenceRefs: readonly string[];
      }[];
      readonly evidenceRefs: readonly string[];
    };

export type GlobalPurchaseCoverageAuthority =
  | { readonly status: "KNOWN"; readonly numerator: number; readonly denominator: number; readonly ratio: 1; readonly evidenceRefs: readonly string[] }
  | { readonly status: "UNKNOWN" | "PARTIAL" | "CONFLICT"; readonly reasonCode: string; readonly evidenceRefs: readonly string[] };

export type GlobalMerchantFrequencyMaterialityProof = {
  readonly merchantId: string;
  readonly boundaryMonth: YearMonth;
  readonly window: "6+4" | "6+6";
  readonly status: "MATERIAL";
  readonly policyRef: "global-materiality:activity-frequency:v1";
  readonly evidenceRefs: readonly string[];
};

export type GlobalMerchantSubstitutionSignal = {
  readonly signalId: string;
  readonly universeId: string;
  readonly fromMerchantId: string;
  readonly toMerchantId: string;
  readonly axis: "SPEND_SHIFT" | "FREQUENCY_SHIFT" | "BOTH";
  readonly associationOnly: true;
  readonly comparisonWindows: {
    readonly from: { readonly beforeMonths: readonly YearMonth[]; readonly afterMonths: readonly YearMonth[] };
    readonly to: { readonly beforeMonths: readonly YearMonth[]; readonly afterMonths: readonly YearMonth[] };
  };
  readonly certifiedOnset: LocalDate;
  readonly shareDeltaFrom: string;
  readonly shareDeltaTo: string;
  readonly counterbalanceRatio: string;
  readonly support: { readonly fromPurchaseEvents: number; readonly toPurchaseEvents: number; readonly minimumRequired: 8 };
  readonly evidenceRefs: readonly string[];
  readonly methodVersion: typeof GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION;
};

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));
const unique = (values: readonly string[]) => [...new Set(values)].sort();
const sum = (values: readonly Money[]) => values.reduce((total, value) => total.plus(value), new Big(0));

function normalizedMonths(values: readonly YearMonth[], expected: 4 | 6, label: string): YearMonth[] {
  const months = unique(values.map(parseYearMonth)) as YearMonth[];
  if (months.length !== expected || months.some((month, index) => index > 0 && month !== addMonths(months[index - 1], 1))) {
    throw new TypeError(`P10_${label}_MONTH_WINDOW_INVALID`);
  }
  return months;
}

function monthDistanceDays(left: LocalDate, right: LocalDate): number {
  const a = Date.parse(`${parseLocalDate(left)}T00:00:00Z`);
  const b = Date.parse(`${parseLocalDate(right)}T00:00:00Z`);
  return Math.round(Math.abs(a - b) / 86_400_000);
}

export function areGlobalMerchantChangeOnsetsCompatible(left: LocalDate, right: LocalDate): boolean {
  return monthDistanceDays(left, right) <= 31;
}

export function meetsGlobalMerchantShareShiftThreshold(delta: string): boolean {
  return new Big(delta).abs().gte("0.10");
}

export function meetsGlobalMerchantEventSupport(count: number): boolean {
  return Number.isSafeInteger(count) && count >= 8;
}

export function meetsGlobalMerchantCounterbalanceThreshold(leftDelta: string, rightDelta: string): boolean {
  const left = new Big(leftDelta);
  const right = new Big(rightDelta);
  if (left.eq(0) || right.eq(0)) return false;
  return counterbalance(left, right).gte("0.50");
}

function canonicalEvents(values: readonly GlobalMerchantSubstitutionEvent[]) {
  const rows = values.map((event) => ({
    ...event,
    month: parseYearMonth(event.month),
    netRetainedValue: parseMoney(event.netRetainedValue),
    evidenceRefs: unique(event.evidenceRefs),
  })).sort((a, b) => a.month.localeCompare(b.month) || a.purchaseEventId.localeCompare(b.purchaseEventId));
  if (new Set(rows.map(({ purchaseEventId }) => purchaseEventId)).size !== rows.length) throw new TypeError("P10_DUPLICATE_PURCHASE_EVENT");
  if (rows.some(({ purchaseEventId, merchantId, evidenceRefs, netRetainedValue }) => !purchaseEventId || !merchantId || evidenceRefs.length === 0 || compareMoney(netRetainedValue, parseMoney("0")) < 0)) {
    throw new TypeError("P10_INVALID_MERCHANT_PURCHASE_EVENT");
  }
  return rows;
}

function windowShare(input: {
  readonly events: ReturnType<typeof canonicalEvents>;
  readonly merchantId: string;
  readonly merchantIds: ReadonlySet<string>;
  readonly months: readonly YearMonth[];
  readonly axis: "SPEND" | "FREQUENCY";
}) {
  const rows = input.events.filter(({ month, merchantId }) => input.months.includes(month) && input.merchantIds.has(merchantId));
  if (input.axis === "FREQUENCY") {
    return rows.length === 0 ? null : new Big(rows.filter(({ merchantId }) => merchantId === input.merchantId).length).div(rows.length);
  }
  const total = sum(rows.map(({ netRetainedValue }) => netRetainedValue));
  if (total.eq(0)) return null;
  return sum(rows.filter(({ merchantId }) => merchantId === input.merchantId).map(({ netRetainedValue }) => netRetainedValue)).div(total);
}

function temporalForMerchant(input: {
  readonly events: ReturnType<typeof canonicalEvents>;
  readonly merchantId: string;
  readonly months: readonly YearMonth[];
  readonly certifiedThroughMonth: YearMonth;
  readonly coverage: Extract<GlobalPurchaseCoverageAuthority, { status: "KNOWN" }>;
  readonly universeEvidenceRefs: readonly string[];
  readonly axis: "SPEND" | "FREQUENCY";
  readonly materialFrequencyChange?: boolean;
}) {
  const selected = input.events.filter(({ merchantId, month }) => merchantId === input.merchantId && input.months.includes(month));
  const evidenceRefs = unique([...input.coverage.evidenceRefs, ...input.universeEvidenceRefs, ...selected.flatMap(({ evidenceRefs }) => evidenceRefs)]);
  const coverage = {
    dimensions: [{
      dimension: "PURCHASE_EVENT" as const,
      status: "KNOWN" as const,
      numerator: input.coverage.numerator,
      denominator: input.coverage.denominator,
      ratio: 1,
      unit: "eligible-purchase-event",
      basis: "resolved-over-authoritative-eligible-universe",
      evidenceRefs,
      policyRef: "purchase-merchant-coverage@v1",
    }],
    requiredDimensions: ["PURCHASE_EVENT" as const],
    effective: 1,
    aggregation: "MIN_REQUIRED_DIMENSIONS" as const,
  };
  const support = {
    naturalGrain: "PURCHASE_EVENT" as const,
    eligibleUnits: selected.length,
    observedUnits: selected.length,
    includedUnits: selected.length,
    excludedObservedUnits: 0,
    minimumRequired: 8,
    supportStatus: selected.length >= 8 ? "SUFFICIENT" as const : "INSUFFICIENT" as const,
    policyRef: "merchant-substitution-eight-events@v1",
  };
  const evidence = parseGlobalMaterialityCandidate({
    candidateId: `merchant:${input.merchantId}:validation`,
    phenomenonId: `merchant:${input.merchantId}:${input.axis.toLowerCase()}`,
    metricRef: input.axis === "SPEND" ? "merchant-monthly-net-economic-spend" : "merchant-monthly-retained-purchase-count",
    effect: { absolute: "0" },
    knowledgeState: "KNOWN",
    support,
    coverage,
    evidenceRefs,
    entityRefs: [input.merchantId],
    methodVersion: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
    materialityPolicy: globalMaterialityPolicies.MERCHANT.ref,
  });
  const { candidateId: _candidateId, effect: _effect, ...materialityEvidence } = evidence;
  return buildGlobalTemporalAnalysis({
    certifiedThroughMonth: input.certifiedThroughMonth,
    points: input.months.map((month) => ({
      month,
      corpus: "CERTIFIED_HISTORY" as const,
      status: "KNOWN" as const,
      value: input.axis === "SPEND"
        ? sum(selected.filter((event) => event.month === month).map(({ netRetainedValue }) => netRetainedValue)).toFixed()
        : String(selected.filter((event) => event.month === month).length),
      eligible: true,
      complete: true,
      dependencyRefs: unique([...input.universeEvidenceRefs, ...selected.filter((event) => event.month === month).flatMap(({ evidenceRefs }) => evidenceRefs)]),
    })),
    evidence: materialityEvidence,
    policyId: "MERCHANT",
    ...(input.materialFrequencyChange === undefined ? {} : { materialFrequencyChange: input.materialFrequencyChange }),
  });
}

function canonicalFrequencyProofs(values: readonly GlobalMerchantFrequencyMaterialityProof[]) {
  const proofs = values.map((proof) => ({
    ...proof,
    boundaryMonth: parseYearMonth(proof.boundaryMonth),
    evidenceRefs: unique(proof.evidenceRefs),
  })).sort((a, b) => a.merchantId.localeCompare(b.merchantId) || a.boundaryMonth.localeCompare(b.boundaryMonth) || a.window.localeCompare(b.window));
  const identities = proofs.map(({ merchantId, boundaryMonth, window }) => `${merchantId}:${boundaryMonth}:${window}`);
  if (new Set(identities).size !== identities.length || proofs.some(({ merchantId, evidenceRefs }) => !merchantId || evidenceRefs.length === 0)) {
    throw new TypeError("P10_INVALID_FREQUENCY_MATERIALITY_PROOF");
  }
  return proofs;
}

function counterbalance(left: Big, right: Big) {
  const leftAbs = left.abs();
  const rightAbs = right.abs();
  return (leftAbs.lte(rightAbs) ? leftAbs : rightAbs).div(leftAbs.gte(rightAbs) ? leftAbs : rightAbs);
}

/** Conditional M8 branch. It consumes certified Purchase events and a declared alternatives catalog. */
export function buildGlobalMerchantSubstitution(input: {
  readonly sourceRevision: string;
  readonly analyticsRevision: string;
  readonly certifiedThroughMonth: YearMonth;
  readonly referenceMonths: readonly YearMonth[];
  readonly currentMonths: readonly YearMonth[];
  readonly purchaseCoverage: GlobalPurchaseCoverageAuthority;
  readonly catalog: GlobalMerchantSubstitutionCatalog;
  readonly events: readonly GlobalMerchantSubstitutionEvent[];
  readonly frequencyMaterialityProofs?: readonly GlobalMerchantFrequencyMaterialityProof[];
}) {
  canonicalSerializeGlobal(input);
  const certifiedThroughMonth = parseYearMonth(input.certifiedThroughMonth);
  const referenceMonths = normalizedMonths(input.referenceMonths, 6, "REFERENCE");
  const currentMonths = normalizedMonths(input.currentMonths, input.currentMonths.length === 4 ? 4 : 6, "CURRENT");
  if (currentMonths[0] !== addMonths(referenceMonths.at(-1)!, 1) || currentMonths.at(-1)! > certifiedThroughMonth) throw new TypeError("P10_MERCHANT_WINDOWS_NOT_CONTIGUOUS_OR_FUTURE");
  const events = canonicalEvents(input.events).filter(({ month }) => [...referenceMonths, ...currentMonths].includes(month));
  const frequencyMaterialityProofs = canonicalFrequencyProofs(input.frequencyMaterialityProofs ?? []);
  const catalog = input.catalog.status === "UNKNOWN"
    ? { ...input.catalog, evidenceRefs: unique(input.catalog.evidenceRefs) }
    : {
        ...input.catalog,
        evidenceRefs: unique(input.catalog.evidenceRefs),
        universes: [...input.catalog.universes].map((universe) => ({ ...universe, merchantIds: unique(universe.merchantIds), evidenceRefs: unique(universe.evidenceRefs) }))
          .sort((a, b) => a.universeId.localeCompare(b.universeId)),
      };
  const purchaseCoverage = { ...input.purchaseCoverage, evidenceRefs: unique(input.purchaseCoverage.evidenceRefs) } as GlobalPurchaseCoverageAuthority;
  const baseHash = digest({ sourceRevision: input.sourceRevision, analyticsRevision: input.analyticsRevision, certifiedThroughMonth, referenceMonths, currentMonths, purchaseCoverage, catalog, events, frequencyMaterialityProofs, method: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION });
  if (catalog.status === "UNKNOWN") return {
    status: "UNAVAILABLE" as const,
    reasonCode: catalog.reasonCode === "DATA_GATED" ? "SUBSTITUTION_UNIVERSE_DATA_GATED" as const : "SUBSTITUTION_UNIVERSE_AUTHORITY_GATED" as const,
    signals: [] as const,
    inputHash: baseHash,
    methodVersion: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
  };
  if (purchaseCoverage.status !== "KNOWN" || purchaseCoverage.ratio !== 1) return {
    status: "UNAVAILABLE" as const,
    reasonCode: "PURCHASE_EVENT_COVERAGE_INCOMPLETE" as const,
    signals: [] as const,
    inputHash: baseHash,
    methodVersion: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
  };
  if (purchaseCoverage.denominator <= 0 || purchaseCoverage.numerator !== purchaseCoverage.denominator) throw new TypeError("P10_INVALID_PURCHASE_COVERAGE");
  if (input.catalog.status === "KNOWN" && input.catalog.universes.some(({ merchantIds }) => new Set(merchantIds).size !== merchantIds.length)) {
    throw new TypeError("P10_INVALID_SUBSTITUTION_UNIVERSE");
  }
  const universeIds = catalog.universes.map(({ universeId }) => universeId);
  if (!catalog.catalogVersion || catalog.evidenceRefs.length === 0 || new Set(universeIds).size !== universeIds.length) throw new TypeError("P10_INVALID_SUBSTITUTION_CATALOG");
  const signals: GlobalMerchantSubstitutionSignal[] = catalog.universes.flatMap((rawUniverse) => {
    const merchantIds = unique(rawUniverse.merchantIds);
    const universeEvidenceRefs = unique([...catalog.evidenceRefs, ...rawUniverse.evidenceRefs]);
    if (!rawUniverse.universeId || merchantIds.length < 2 || universeEvidenceRefs.length === 0) throw new TypeError("P10_INVALID_SUBSTITUTION_UNIVERSE");
    const set = new Set(merchantIds);
    const axes = ["SPEND", "FREQUENCY"] as const;
    const temporal = new Map(axes.flatMap((axis) => merchantIds.map((merchantId) => {
      const proof = frequencyMaterialityProofs.find((row) => row.merchantId === merchantId && row.boundaryMonth === currentMonths[0] && row.window === `6+${currentMonths.length}`);
      return [`${axis}:${merchantId}`, temporalForMerchant({
        events, merchantId, months: [...referenceMonths, ...currentMonths], certifiedThroughMonth,
        coverage: purchaseCoverage, universeEvidenceRefs: unique([...universeEvidenceRefs, ...(axis === "FREQUENCY" ? proof?.evidenceRefs ?? [] : [])]), axis,
        ...(axis === "FREQUENCY" ? { materialFrequencyChange: proof?.status === "MATERIAL" } : {}),
      })] as const;
    })));
    const candidates = axes.flatMap((axis) => merchantIds.flatMap((merchantId) => temporal.get(`${axis}:${merchantId}`)!.changes.candidates
      .filter(({ status, window, beforeMonths, afterMonths }) => status === "CONFIRMED_LEVEL_CHANGE" && beforeMonths.length === 6 && ((window === "6+6" && afterMonths.length === 6) || (window === "6+4" && afterMonths.length === 4)))
      .map((candidate) => ({ merchantId, axis, candidate }))));
    const output: GlobalMerchantSubstitutionSignal[] = [];
    for (let a = 0; a < candidates.length; a += 1) for (let b = a + 1; b < candidates.length; b += 1) {
      const left = candidates[a], right = candidates[b];
      const leftOnset = parseLocalDate(`${left.candidate.boundaryMonth}-01`);
      const rightOnset = parseLocalDate(`${right.candidate.boundaryMonth}-01`);
      if (left.axis !== right.axis || !areGlobalMerchantChangeOnsetsCompatible(leftOnset, rightOnset)) continue;
      const leftBeforeMonths = left.candidate.beforeMonths as YearMonth[], leftAfterMonths = left.candidate.afterMonths as YearMonth[];
      const rightBeforeMonths = right.candidate.beforeMonths as YearMonth[], rightAfterMonths = right.candidate.afterMonths as YearMonth[];
      const leftBefore = windowShare({ events, merchantId: left.merchantId, merchantIds: set, months: leftBeforeMonths, axis: left.axis });
      const leftAfter = windowShare({ events, merchantId: left.merchantId, merchantIds: set, months: leftAfterMonths, axis: left.axis });
      const rightBefore = windowShare({ events, merchantId: right.merchantId, merchantIds: set, months: rightBeforeMonths, axis: right.axis });
      const rightAfter = windowShare({ events, merchantId: right.merchantId, merchantIds: set, months: rightAfterMonths, axis: right.axis });
      if ([leftBefore, leftAfter, rightBefore, rightAfter].some((value) => value === null)) continue;
      const leftDelta = leftAfter!.minus(leftBefore!), rightDelta = rightAfter!.minus(rightBefore!);
      if (leftDelta.eq(0) || rightDelta.eq(0) || leftDelta.s * rightDelta.s !== -1 || !meetsGlobalMerchantShareShiftThreshold(leftDelta.toFixed()) || !meetsGlobalMerchantShareShiftThreshold(rightDelta.toFixed())) continue;
      if (left.candidate.materiality.status !== "MATERIAL" || right.candidate.materiality.status !== "MATERIAL") continue;
      const leftSupport = events.filter(({ merchantId, month }) => merchantId === left.merchantId && [...leftBeforeMonths, ...leftAfterMonths].includes(month)).length;
      const rightSupport = events.filter(({ merchantId, month }) => merchantId === right.merchantId && [...rightBeforeMonths, ...rightAfterMonths].includes(month)).length;
      if (!meetsGlobalMerchantEventSupport(leftSupport) || !meetsGlobalMerchantEventSupport(rightSupport)) continue;
      const ratio = counterbalance(leftDelta, rightDelta);
      if (!meetsGlobalMerchantCounterbalanceThreshold(leftDelta.toFixed(), rightDelta.toFixed())) continue;
      const declining = leftDelta.lt(0) ? left : right;
      const growing = leftDelta.lt(0) ? right : left;
      output.push({
        signalId: `${rawUniverse.universeId}:${declining.merchantId}->${growing.merchantId}:${left.candidate.boundaryMonth}:${left.axis.toLowerCase()}`,
        universeId: rawUniverse.universeId,
        fromMerchantId: declining.merchantId,
        toMerchantId: growing.merchantId,
        axis: left.axis === "SPEND" ? "SPEND_SHIFT" as const : "FREQUENCY_SHIFT" as const,
        associationOnly: true as const,
        comparisonWindows: {
          from: declining === left ? { beforeMonths: leftBeforeMonths, afterMonths: leftAfterMonths } : { beforeMonths: rightBeforeMonths, afterMonths: rightAfterMonths },
          to: growing === left ? { beforeMonths: leftBeforeMonths, afterMonths: leftAfterMonths } : { beforeMonths: rightBeforeMonths, afterMonths: rightAfterMonths },
        },
        certifiedOnset: (leftOnset <= rightOnset ? leftOnset : rightOnset),
        shareDeltaFrom: (declining === left ? leftDelta : rightDelta).toFixed(),
        shareDeltaTo: (growing === left ? leftDelta : rightDelta).toFixed(),
        counterbalanceRatio: ratio.toFixed(),
        support: { fromPurchaseEvents: declining === left ? leftSupport : rightSupport, toPurchaseEvents: growing === left ? leftSupport : rightSupport, minimumRequired: 8 },
        evidenceRefs: unique([...universeEvidenceRefs, ...left.candidate.dependencyRefs, ...right.candidate.dependencyRefs]),
        methodVersion: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
      });
    }
    return output;
  }).sort((a, b) => a.signalId.localeCompare(b.signalId));
  const mergedSignals = signals.reduce<GlobalMerchantSubstitutionSignal[]>((rows, signal) => {
    const peer = rows.find((row) => row.universeId === signal.universeId && row.fromMerchantId === signal.fromMerchantId && row.toMerchantId === signal.toMerchantId && row.certifiedOnset === signal.certifiedOnset && canonicalSerializeGlobal(row.comparisonWindows) === canonicalSerializeGlobal(signal.comparisonWindows));
    if (peer === undefined) return [...rows, signal];
    if (peer.axis === signal.axis || peer.axis === "BOTH") return rows;
    return rows.map((row) => row === peer ? {
      ...row,
      signalId: `${signal.universeId}:${signal.fromMerchantId}->${signal.toMerchantId}:${signal.certifiedOnset.slice(0, 7)}:both`,
      axis: "BOTH" as const,
      evidenceRefs: unique([...row.evidenceRefs, ...signal.evidenceRefs]),
    } : row);
  }, []).sort((a, b) => a.signalId.localeCompare(b.signalId));
  return {
    status: "KNOWN" as const,
    signals: mergedSignals,
    catalogVersion: catalog.catalogVersion,
    coverage: input.purchaseCoverage,
    temporalSeries: catalog.universes.flatMap(({ universeId, merchantIds }) => unique(merchantIds).flatMap((merchantId) => ([
      {
        signalId: `merchant:${merchantId}:net-spend`, subjectRef: `merchant:${merchantId}`, catalogKey: "PURCHASE_BASKET" as const, universeId,
        temporal: temporalForMerchant({ events, merchantId, months: [...referenceMonths, ...currentMonths], certifiedThroughMonth, coverage: purchaseCoverage, universeEvidenceRefs: unique([...catalog.evidenceRefs, ...catalog.universes.find((row) => row.universeId === universeId)!.evidenceRefs]), axis: "SPEND" }),
      },
      {
        signalId: `merchant:${merchantId}:retained-frequency`, subjectRef: `merchant:${merchantId}`, catalogKey: "MERCHANT_FREQUENCY" as const, universeId,
        temporal: temporalForMerchant({ events, merchantId, months: [...referenceMonths, ...currentMonths], certifiedThroughMonth, coverage: purchaseCoverage, universeEvidenceRefs: unique([...catalog.evidenceRefs, ...catalog.universes.find((row) => row.universeId === universeId)!.evidenceRefs, ...frequencyMaterialityProofs.filter((row) => row.merchantId === merchantId && row.boundaryMonth === currentMonths[0] && row.window === `6+${currentMonths.length}`).flatMap(({ evidenceRefs }) => evidenceRefs)]), axis: "FREQUENCY", materialFrequencyChange: frequencyMaterialityProofs.some((row) => row.merchantId === merchantId && row.boundaryMonth === currentMonths[0] && row.window === `6+${currentMonths.length}`) }),
      },
    ]))),
    inputHash: baseHash,
    outputHash: digest({ signals: mergedSignals, catalogVersion: catalog.catalogVersion }),
    methodVersion: GLOBAL_MERCHANT_SUBSTITUTION_METHOD_VERSION,
  };
}
