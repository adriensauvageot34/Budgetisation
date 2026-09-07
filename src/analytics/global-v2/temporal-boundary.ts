import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  canonicalSerializeGlobal,
  parseGlobalResolvedNaturalWindow,
  parseGlobalSupport,
  parseGlobalTimeWindowPolicy,
  parseGlobalValueProvenance,
  type CorpusAuthority,
  type GlobalResolvedNaturalWindow,
  type GlobalSupport,
  type GlobalTimeWindowPolicy,
  type GlobalValueProvenance,
  type NormalizedGlobalAnalysisScopeV2,
} from "../../core/global-v2";
import { parseLocalDate, type LocalDate } from "../../core/time";

export type GlobalTemporalUnitCandidate = {
  readonly unitId: string;
  readonly authority: CorpusAuthority;
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly eligible: boolean;
  readonly observed: boolean;
  readonly comparable: boolean;
  readonly methodExcluded: boolean;
  readonly dependencyRefs: readonly string[];
};

export type GlobalTemporalSupportPolicy = {
  readonly policyRef: string;
  readonly minimumRequired: number;
  readonly strongAt: number;
};

export type GlobalTemporalBoundaryResolution = {
  readonly window: GlobalResolvedNaturalWindow;
  readonly certifiedUnitIds: readonly string[];
  readonly liveTailUnitIds?: readonly string[];
  readonly excludedUnitIds: readonly string[];
  readonly resolutionHash: string;
};

function nonEmptyMachineRef(value: string, field: string): string {
  if (value.trim() !== value || value.length === 0 || /\s/u.test(value)) {
    throw new TypeError(`${field} doit être une référence machine non vide.`);
  }
  return value;
}

function parseCount(value: number, field: string, positive = false): number {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new TypeError(`${field} doit être un entier ${positive ? "strictement " : ""}positif.`);
  }
  return value;
}

function normalizeCandidates(
  values: readonly GlobalTemporalUnitCandidate[],
): readonly GlobalTemporalUnitCandidate[] {
  const byId = new Map<string, GlobalTemporalUnitCandidate>();
  for (const value of values) {
    const candidate: GlobalTemporalUnitCandidate = {
      unitId: nonEmptyMachineRef(value.unitId, "GlobalTemporalUnitCandidate.unitId"),
      authority: value.authority,
      start: parseLocalDate(value.start),
      end: parseLocalDate(value.end),
      eligible: value.eligible,
      observed: value.observed,
      comparable: value.comparable,
      methodExcluded: value.methodExcluded,
      dependencyRefs: [...new Set(value.dependencyRefs.map((entry) =>
        nonEmptyMachineRef(entry, "GlobalTemporalUnitCandidate.dependencyRefs"),
      ))].sort(),
    };
    if (candidate.start > candidate.end) {
      throw new TypeError("GlobalTemporalUnitCandidate.start doit précéder end.");
    }
    const existing = byId.get(candidate.unitId);
    if (existing !== undefined) {
      if (canonicalSerializeGlobal(existing) !== canonicalSerializeGlobal(candidate)) {
        throw new TypeError("Deux unités temporelles contradictoires portent la même identité.");
      }
      continue;
    }
    byId.set(candidate.unitId, candidate);
  }
  return [...byId.values()].sort((left, right) =>
    left.start.localeCompare(right.start) ||
    left.end.localeCompare(right.end) ||
    left.unitId.localeCompare(right.unitId),
  );
}

function applyLookback(
  candidates: readonly GlobalTemporalUnitCandidate[],
  policy: GlobalTimeWindowPolicy,
): readonly GlobalTemporalUnitCandidate[] {
  const { lookback } = policy;
  if (lookback.kind === "ALL_RELIABLE") return candidates;
  if (lookback.kind === "DECLARED_RANGE") {
    return candidates.filter(({ start, end }) => start >= lookback.start && end <= lookback.end);
  }
  if (lookback.kind === "COMPARABLE_INTERSECTION") {
    if (lookback.unit !== policy.naturalGrain) {
      throw new TypeError("La comparable intersection doit utiliser le grain naturel de la policy.");
    }
    return candidates.filter(({ comparable }) => comparable);
  }
  const eligible = candidates.filter(({ eligible }) => eligible);
  const retained = new Set(eligible.slice(-lookback.count).map(({ unitId }) => unitId));
  return candidates.filter(({ unitId }) => retained.has(unitId));
}

function largestMissingRun(candidates: readonly GlobalTemporalUnitCandidate[]): number {
  let current = 0;
  let largest = 0;
  for (const candidate of candidates) {
    if (candidate.eligible && !candidate.observed) {
      current += 1;
      largest = Math.max(largest, current);
    } else if (candidate.eligible) {
      current = 0;
    }
  }
  return largest;
}

function supportFor(
  candidates: readonly GlobalTemporalUnitCandidate[],
  policy: GlobalTimeWindowPolicy,
  supportPolicy: GlobalTemporalSupportPolicy,
): GlobalSupport {
  const eligible = candidates.filter(({ eligible }) => eligible);
  const observed = eligible.filter(({ observed }) => observed);
  const included = observed.filter(({ comparable, methodExcluded }) =>
    comparable && !methodExcluded,
  );
  const minimumRequired = parseCount(
    supportPolicy.minimumRequired,
    "GlobalTemporalSupportPolicy.minimumRequired",
  );
  const strongAt = parseCount(
    supportPolicy.strongAt,
    "GlobalTemporalSupportPolicy.strongAt",
    true,
  );
  if (strongAt < minimumRequired) {
    throw new TypeError("GlobalTemporalSupportPolicy.strongAt doit être au moins minimumRequired.");
  }
  const supportStatus = included.length < minimumRequired
    ? "INSUFFICIENT"
    : included.length >= strongAt
      ? "STRONG"
      : "SUFFICIENT";
  return parseGlobalSupport({
    naturalGrain: policy.naturalGrain,
    eligibleUnits: eligible.length,
    observedUnits: observed.length,
    includedUnits: included.length,
    excludedObservedUnits: observed.length - included.length,
    minimumRequired,
    supportStatus,
    ...(eligible.length === 0
      ? {}
      : {
          supportStart: eligible[0].start,
          supportEnd: eligible.at(-1)!.end,
        }),
    gapCount: eligible.length - observed.length,
    largestGapUnits: largestMissingRun(candidates),
    policyRef: nonEmptyMachineRef(
      supportPolicy.policyRef,
      "GlobalTemporalSupportPolicy.policyRef",
    ),
  });
}

function selectedUnitIds(candidates: readonly GlobalTemporalUnitCandidate[]): readonly string[] {
  return candidates
    .filter(({ eligible, observed, comparable, methodExcluded }) =>
      eligible && observed && comparable && !methodExcluded,
    )
    .map(({ unitId }) => unitId);
}

function dependencyRefs(candidates: readonly GlobalTemporalUnitCandidate[]): readonly string[] {
  return [...new Set(candidates
    .filter(({ eligible, observed, comparable, methodExcluded }) =>
      eligible && observed && comparable && !methodExcluded,
    )
    .flatMap(({ dependencyRefs: refs }) => refs))].sort();
}

function slice(input: {
  readonly authority: CorpusAuthority;
  readonly candidates: readonly GlobalTemporalUnitCandidate[];
  readonly end: LocalDate;
  readonly policy: GlobalTimeWindowPolicy;
  readonly supportPolicy: GlobalTemporalSupportPolicy;
  readonly provenance: GlobalValueProvenance;
}) {
  const support = supportFor(input.candidates, input.policy, input.supportPolicy);
  const eligible = input.candidates.filter(({ eligible: value }) => value);
  return {
    authority: input.authority,
    ...(eligible.length === 0 ? {} : { start: eligible[0].start }),
    end: input.end,
    support,
    provenance: parseGlobalValueProvenance(input.provenance),
    dependencyRefs: dependencyRefs(input.candidates),
  };
}

/**
 * Resolves CH and the optional descriptive LT before an Analytics engine sees
 * any input. Expected gaps must be supplied as explicit non-observed units;
 * the resolver never invents a continuous calendar for a non-calendar grain.
 */
export class GlobalTemporalBoundaryResolver {
  resolve(input: {
    readonly scope: NormalizedGlobalAnalysisScopeV2;
    readonly policy: GlobalTimeWindowPolicy;
    readonly supportPolicy: GlobalTemporalSupportPolicy;
    readonly candidates: readonly GlobalTemporalUnitCandidate[];
    readonly certifiedProvenance: GlobalValueProvenance;
    readonly liveTailProvenance?: GlobalValueProvenance;
  }): GlobalTemporalBoundaryResolution {
    const policy = parseGlobalTimeWindowPolicy(input.policy);
    const candidates = normalizeCandidates(input.candidates);
    const certified = applyLookback(candidates.filter(({ authority, end }) => {
      if (authority !== "CERTIFIED_HISTORY") return false;
      if (end > input.scope.time.certifiedThrough) {
        throw new TypeError("Une unité CERTIFIED_HISTORY dépasse certifiedThrough.");
      }
      return true;
    }), policy);

    const liveCandidates = candidates.filter(({ authority }) => authority === "LIVE_TAIL");
    if (liveCandidates.length > 0 && input.scope.time.liveThrough === undefined) {
      throw new TypeError("Des unités LIVE_TAIL exigent liveThrough.");
    }
    for (const candidate of liveCandidates) {
      if (
        candidate.start <= input.scope.time.certifiedThrough ||
        candidate.end > input.scope.time.liveThrough!
      ) {
        throw new TypeError("Une unité LIVE_TAIL doit être disjointe de CH et bornée par liveThrough.");
      }
    }
    const liveTail = policy.corpus === "CERTIFIED_PLUS_DESCRIPTIVE_LIVE_TAIL"
      ? applyLookback(liveCandidates, { ...policy, lookback: { kind: "ALL_RELIABLE" } })
      : [];
    if (liveTail.length > 0 && input.liveTailProvenance === undefined) {
      throw new TypeError("Une slice LIVE_TAIL exige une provenance distincte.");
    }

    const certifiedUnitIds = selectedUnitIds(certified);
    const liveTailUnitIds = selectedUnitIds(liveTail);
    const selectedIds = new Set([...certifiedUnitIds, ...liveTailUnitIds]);
    const excludedUnitIds = candidates
      .filter(({ unitId }) => !selectedIds.has(unitId))
      .map(({ unitId }) => unitId)
      .sort();
    const gapDates = [...new Set([...certified, ...liveTail]
      .filter(({ eligible, observed }) => eligible && !observed)
      .map(({ start }) => start))].sort();
    const window = parseGlobalResolvedNaturalWindow({
      naturalGrain: policy.naturalGrain,
      certified: slice({
        authority: "CERTIFIED_HISTORY",
        candidates: certified,
        end: input.scope.time.certifiedThrough,
        policy,
        supportPolicy: input.supportPolicy,
        provenance: input.certifiedProvenance,
      }),
      ...(liveTail.length === 0
        ? {}
        : {
            liveTail: slice({
              authority: "LIVE_TAIL",
              candidates: liveTail,
              end: input.scope.time.liveThrough!,
              policy,
              supportPolicy: input.supportPolicy,
              provenance: input.liveTailProvenance!,
            }),
          }),
      gapDates,
    });
    const resolutionHash = bytesToHex(sha256(utf8ToBytes(
      `global-temporal-boundary@v1\n${canonicalSerializeGlobal({
        policy,
        window,
        certifiedUnitIds,
        ...(liveTailUnitIds.length === 0 ? {} : { liveTailUnitIds }),
      })}`,
    )));
    return {
      window,
      certifiedUnitIds,
      ...(liveTailUnitIds.length === 0 ? {} : { liveTailUnitIds }),
      excludedUnitIds,
      resolutionHash,
    };
  }
}
