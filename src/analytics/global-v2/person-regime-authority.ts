import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../core/time";
import type { GlobalTransformationSeries } from "./transformations";
import type { buildGlobalTransformations } from "./transformations";

export const GLOBAL_PERSON_REGIME_ALLOWED_ACTIVITY_IDS = ["travail_site", "teletravail"] as const;

type GlobalTransformation = ReturnType<typeof buildGlobalTransformations>["transformations"][number];
type GlobalCurrentRegime = GlobalTransformation["currentRegime"];

export type GlobalPersonRegimeAuthority =
  | {
      readonly status: "KNOWN";
      readonly capabilityState: "AVAILABLE";
      readonly reasonCodes: readonly [];
      readonly personId: string;
      readonly sourceActivityId: typeof GLOBAL_PERSON_REGIME_ALLOWED_ACTIVITY_IDS[number];
      readonly sourceSignalId: string;
      readonly transformationId: string;
      readonly validFrom: YearMonth;
      readonly validThrough: LocalDate;
      readonly result: GlobalCurrentRegime;
    }
  | {
      readonly status: "UNKNOWN";
      readonly capabilityState: "GATED";
      readonly reasonCodes: readonly ["AUTHORITY_GATED_CURRENT_REGIME"];
      readonly personId: string;
    }
  | {
      readonly status: "CONFLICT";
      readonly capabilityState: "GATED";
      readonly reasonCodes: readonly ["CONFLICTING_CURRENT_REGIME_AUTHORITIES"];
      readonly personId: string;
    };

type RegimeClosure = {
  readonly regime: { readonly start: string };
  readonly boundary: string;
};

function parseWorkSignal(signalId: string) {
  const match = /^m4:person:([^:]+):activity:(travail_site|teletravail):frequency@(\d{4}-\d{2})$/u.exec(signalId);
  if (match === null) return undefined;
  return {
    personId: match[1]!,
    activityId: match[2]! as typeof GLOBAL_PERSON_REGIME_ALLOWED_ACTIVITY_IDS[number],
    sourceSignalId: signalId.slice(0, signalId.lastIndexOf("@")),
  };
}

function qualifiedCandidate(input: {
  readonly personId: string;
  readonly certifiedThroughMonth: YearMonth;
  readonly transformation: GlobalTransformation;
  readonly series: readonly GlobalTransformationSeries[];
}) {
  const { transformation } = input;
  if (transformation.kind !== "DURABLE_CHANGE"
    || transformation.status !== "CONFIRMED_ONGOING"
    || transformation.supportingSignals.length !== 0
    || transformation.currentRegime.status !== "KNOWN"
    || !transformation.currentRegime.structuralReferenceEligible
    || transformation.currentRegime.supportStatus !== "SUFFICIENT"
    || transformation.currentRegime.includedMonths.length < 6) return undefined;
  const work = parseWorkSignal(transformation.primaryDriver);
  if (work === undefined || work.personId !== input.personId) return undefined;
  const sourceSeries = input.series.filter(({ signalId }) => signalId === work.sourceSignalId);
  if (sourceSeries.length !== 1) return undefined;
  const source = sourceSeries[0]!;
  if (source.subjectRef !== `person:${input.personId}`
    || source.catalogKey !== "ACTIVITY_FREQUENCY"
    || source.certifiedThroughMonth !== input.certifiedThroughMonth
    || source.structuralAuthorityRefs.length === 0
    || source.structuralAuthorityRefs.some((ref) => ref.startsWith("fct_activity_occurrence:"))) return undefined;
  try {
    const closure = JSON.parse(transformation.currentRegime.closure) as RegimeClosure;
    const validFrom = parseYearMonth(closure.regime.start);
    if (parseYearMonth(closure.boundary) !== input.certifiedThroughMonth) return undefined;
    return { transformation, work, validFrom };
  } catch {
    return undefined;
  }
}

/** Pure D2 selector. It detects nothing: only already-confirmed BASE M3 work
 * transformations with explicit structural authority can cross into M5.
 */
export function selectGlobalPersonRegimeAuthority(input: {
  readonly personId: string;
  readonly certifiedThrough: LocalDate | string;
  readonly transformations: readonly GlobalTransformation[];
  readonly series: readonly GlobalTransformationSeries[];
}): GlobalPersonRegimeAuthority {
  if (!input.personId.trim()) throw new TypeError("Global Person regime authority requires a Person identity.");
  const validThrough = parseLocalDate(input.certifiedThrough);
  const certifiedThroughMonth = parseYearMonth(validThrough.slice(0, 7));
  const candidates = input.transformations.flatMap((transformation) => {
    const candidate = qualifiedCandidate({ personId: input.personId, certifiedThroughMonth, transformation, series: input.series });
    return candidate === undefined ? [] : [candidate];
  });
  if (candidates.length === 0) {
    return { status: "UNKNOWN", capabilityState: "GATED", reasonCodes: ["AUTHORITY_GATED_CURRENT_REGIME"], personId: input.personId };
  }
  if (candidates.length !== 1) {
    return { status: "CONFLICT", capabilityState: "GATED", reasonCodes: ["CONFLICTING_CURRENT_REGIME_AUTHORITIES"], personId: input.personId };
  }
  const [{ transformation, work, validFrom }] = candidates;
  return {
    status: "KNOWN",
    capabilityState: "AVAILABLE",
    reasonCodes: [],
    personId: input.personId,
    sourceActivityId: work.activityId,
    sourceSignalId: work.sourceSignalId,
    transformationId: transformation.transformationId,
    validFrom,
    validThrough,
    result: transformation.currentRegime,
  };
}
