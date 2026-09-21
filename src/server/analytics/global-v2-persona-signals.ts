import "server-only";

import { Temporal } from "@js-temporal/polyfill";

import {
  GLOBAL_PERSONA_PROFILE_METHOD_VERSION,
  buildPersonaProfile,
  type DeclaredSignal,
  type DifferenceSignal,
  type GlobalPersonaDifference,
  type GlobalPersonaFamily,
  type MobilitySignal,
  type MomentSignal,
  type NeedSignal,
  type PersonalCostSignal,
  type PersonaProfileOutput,
  type PersonaSignal,
  type ProductCycleSignal,
  type RoutineSignal,
  type SharedActivitySignal,
} from "@/analytics/global-v2";
import { parsePersonId, type HouseholdId, type PersonId } from "@/core/identity";
import type { Money } from "@/core/money";
import { parseLocalDate, type LocalDate } from "@/core/time";
import { parseMethodVersion } from "@/core/versions";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { canonicalMoney, canonicalString, optionalCanonicalString } from "@/server/canonical/record";

export const GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION = parseMethodVersion("global_persona_signal_adapter@v1");
export const GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION = parseMethodVersion("global_persona_declared_provider@v1");

type PersonalCostAuthority = {
  readonly costId: string;
  readonly semanticKey: string;
  readonly beneficiaryPersonId?: PersonId;
  readonly beneficiaryEvidenceRefs?: readonly string[];
  readonly payerPersonId?: PersonId;
  readonly observedAmount?: Money;
  readonly typicalAmount?: Money;
  readonly entityRef?: string;
  readonly needKey?: string;
  readonly recurrenceStatus?: "ACTIVE" | "ENDED" | "INTERRUPTED" | "RESTARTED" | "UNKNOWN";
  readonly family?: GlobalPersonaFamily;
  readonly context?: string;
  readonly evidenceRefs: readonly string[];
};

type NeedGroup = {
  readonly key: string;
  readonly dimension: { readonly status: string; readonly id?: string; readonly evidenceRefs?: readonly string[] };
  readonly activeMonths: number;
  readonly monthlyAmount?: Money;
  readonly typicalAmount?: Money | null;
  readonly evidenceRefs: readonly string[];
};

type ActivityRhythm = {
  readonly activityId: string;
  readonly personId: string;
  readonly rawOccurrenceCount?: number;
  readonly includedOccurrenceCount?: number;
  readonly eligibleObservableDays?: number;
  readonly rate?: { readonly status?: string; readonly value?: string };
  readonly cadence?: { readonly status?: string; readonly medianIntervalDays?: string };
  readonly support?: { readonly supportStatus?: string; readonly occurrenceCount?: number };
  readonly dependencyRefs?: readonly string[];
};

type RoutinePattern = {
  readonly routineId: string;
  readonly scope: "PERSON" | "SHARED" | "HOUSEHOLD";
  readonly personId?: string;
  readonly eligibilityContext: string;
  readonly coreTokens: readonly string[];
  readonly optionalTokens?: readonly string[];
  readonly occurrenceCount: number;
  readonly prevalence: number;
  readonly certificationStatus: "CERTIFIED" | "HYPOTHESIS_ONLY";
  readonly strength: string;
  readonly evidenceRefs: readonly string[];
};

type MomentSummary = {
  readonly moment: {
    readonly momentId: string;
    readonly startDate?: LocalDate;
    readonly endDate?: LocalDate;
    readonly householdParticipantIds: readonly string[];
    readonly participationEvidenceRefs: readonly string[];
    readonly transformationAnchor?: { readonly value: true };
    readonly declaredImportance?: { readonly value: true };
  };
  readonly resolvedType?: { readonly family: string; readonly normalizedKey: string };
  readonly causalCost: { readonly status: string; readonly value?: Money };
  readonly experienceDayCount?: number;
  readonly sourceRefs: readonly string[];
};

type SharedUniverse = {
  readonly universeId: string;
  readonly grain: string;
  readonly support: {
    readonly eligibleUnits: number;
    readonly resolvedUnits: number;
    readonly unresolvedUnits: number;
    readonly conflictUnits: number;
    readonly sharedUnits: number;
    readonly sharedObservableCoverage: number | null;
    readonly sharedRate: number | null;
    readonly knowledgeState: string;
  };
  readonly sharedUnits: readonly {
    readonly unitId: string;
    readonly resolution: string;
    readonly evidenceRefs: readonly string[];
  }[];
};

type MobilityAuthority = {
  readonly mobilityId: string;
  readonly personId?: PersonId;
  readonly scope: "PERSONAL" | "HOUSEHOLD";
  readonly mode?: string;
  readonly context?: string;
  readonly vehicleRef?: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalPersonaProductObservation = {
  readonly observationId: string;
  readonly subject: { readonly kind: "PERSON"; readonly personId: PersonId }
    | { readonly kind: "HOUSEHOLD"; readonly householdId: HouseholdId };
  readonly needKey: string;
  readonly productKey: string;
  readonly observedAt: LocalDate;
  readonly price?: Money;
  readonly family?: GlobalPersonaFamily;
  readonly groupKey?: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalV2PersonaSignalAdapterInput = {
  readonly householdId: HouseholdId;
  readonly personIds: readonly PersonId[];
  readonly displayNamesByPersonId: Readonly<Record<string, string>>;
  readonly m1: { readonly recurrences: { readonly series: readonly unknown[] } };
  /** M1 currently exposes no person-bound recurrence rows. This input stays empty until a beneficiary authority is projected. */
  readonly personalCostAuthorities?: readonly PersonalCostAuthority[];
  readonly m2: { readonly result: { readonly needs: { readonly groups: readonly NeedGroup[] } } };
  readonly m4: { readonly rhythms: readonly ActivityRhythm[]; readonly routinePatterns?: readonly RoutinePattern[] };
  readonly m6: { readonly summaries: readonly MomentSummary[] };
  readonly m7: {
    readonly mobilityCapabilities?: Readonly<Record<string, { readonly state?: string; readonly reasonCodes?: readonly string[] }>>;
    readonly mobility?: { readonly legs?: readonly unknown[]; readonly routes?: readonly unknown[] };
  };
  readonly mobilityAuthorities?: readonly MobilityAuthority[];
  readonly m8: { readonly capabilities?: { readonly products?: { readonly state?: string; readonly reasonCode?: string } } };
  readonly productObservations?: readonly GlobalPersonaProductObservation[];
  readonly m10: { readonly units: readonly unknown[]; readonly universes: readonly SharedUniverse[] };
  readonly differences: readonly GlobalPersonaDifference[];
};

export type GlobalV2PersonaSignalAdapterResult = {
  readonly adapterVersion: typeof GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION;
  readonly declarationProviderVersion: typeof GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION;
  readonly signals: readonly PersonaSignal[];
  readonly declarations: readonly DeclaredSignal[];
  readonly profile: PersonaProfileOutput;
  readonly limitations: readonly string[];
  readonly capabilities: {
    readonly productCycleRuntime: {
      readonly state: "CONNECTED" | "UNAVAILABLE";
      readonly mode: "DESCRIPTIVE_PRODUCT_OBSERVATIONS";
      readonly source: "product_observations";
      readonly reasonCodes: readonly string[];
    };
  };
};

const unique = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();
const evidence = (values: readonly string[], fallback: string): readonly string[] => unique(values.length === 0 ? [fallback] : values);

/**
 * Resolves only the explicitly person-bound fields from the canonical
 * product_observations table. It is deliberately not an M8 acquisition,
 * lifecycle or prediction provider.
 */
export async function resolveGlobalPersonaProductObservations(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough: LocalDate;
}): Promise<readonly GlobalPersonaProductObservation[]> {
  const rows = await input.repository.loadPersonaProductObservationRows(input.certifiedThrough);
  const authorizedPersonIds = new Set(input.repository.context.personIds.map(String));
  return rows.map((row): GlobalPersonaProductObservation => {
    const observationId = canonicalString(row, ["observation_id"], "product_observations");
    const personId = parsePersonId(canonicalString(row, ["person_id"], "product_observations"));
    if (!authorizedPersonIds.has(String(personId))) throw new TypeError("PERSONA_PRODUCT_OBSERVATION_PERSON_OUT_OF_SCOPE");
    const operationId = optionalCanonicalString(row, ["operation_id"]);
    const needId = optionalCanonicalString(row, ["need_id"]);
    const source = optionalCanonicalString(row, ["source_enrichissement"]);
    return {
      observationId,
      subject: { kind: "PERSON", personId },
      needKey: canonicalString(row, ["need_key"], "product_observations"),
      productKey: canonicalString(row, ["product_key"], "product_observations"),
      observedAt: parseLocalDate(canonicalString(row, ["date_achat"], "product_observations")),
      price: canonicalMoney(row, ["persona_price"], "product_observations"),
      evidenceRefs: unique([
        `product-observation:${observationId}`,
        ...(operationId === undefined ? [] : [`operation:${operationId}`]),
        ...(needId === undefined ? [] : [`need:${needId}`]),
        ...(source === undefined ? [] : [`product-observation-source:${source}`]),
      ]),
    };
  });
}

function personScope(personId: PersonId) {
  return { subject: { kind: "PERSON" as const, personId }, scope: "PERSONAL" as const };
}

function householdScope(householdId: HouseholdId) {
  return { subject: { kind: "HOUSEHOLD" as const, householdId }, scope: "HOUSEHOLD" as const };
}

function sharedScope(personIds: readonly PersonId[]) {
  const pair = personIds.length === 2 ? [...personIds].sort() as [PersonId, PersonId] : undefined;
  return { subject: { kind: "SHARED" as const, ...(pair === undefined ? {} : { personIds: pair }) }, scope: "SHARED" as const };
}

function activityFamily(activityId: string): GlobalPersonaFamily {
  const catalog: Readonly<Record<string, GlobalPersonaFamily>> = {
    travail_site: "WORK_AND_DAY_CONTEXT",
    teletravail: "WORK_AND_DAY_CONTEXT",
    deplacement_pro: "WORK_AND_DAY_CONTEXT",
    courses_alimentaires: "PERSONAL_PURCHASES",
    shopping_commerce: "PERSONAL_PURCHASES",
    livraison_repas: "FOOD_AND_WORK_MEALS",
    repas_restaurant: "FOOD_AND_WORK_MEALS",
    soin_personnel: "PERSONAL_CARE",
    rdv_medical: "PERSONAL_CARE",
    pharmacie: "PERSONAL_CARE",
    entretien_voiture: "MOBILITY",
    carburant: "MOBILITY",
    lecon_conduite: "MOBILITY",
    examen_permis: "MOBILITY",
    visite_famille: "SOCIAL_AND_FAMILY",
    visite_ami: "SOCIAL_AND_FAMILY",
  };
  return catalog[activityId] ?? "LEISURE_AND_ACTIVITIES";
}

function momentFamily(value: string | undefined): GlobalPersonaFamily | undefined {
  if (value === "TRAVEL_AND_STAY") return "LEISURE_AND_ACTIVITIES";
  if (value === "SOCIAL_AND_FAMILY_VISIT" || value === "CELEBRATION" || value === "SOCIAL_OUTING") return "SOCIAL_AND_FAMILY";
  if (value === "CULTURAL_AND_LEISURE_EVENT" || value === "PROJECT_MILESTONE") return "LEISURE_AND_ACTIVITIES";
  return undefined;
}

export function adaptGlobalM1PersonalCostSignals(input: {
  readonly authorities: readonly PersonalCostAuthority[];
  readonly authorizedPersonIds: readonly PersonId[];
}): readonly PersonalCostSignal[] {
  const authorized = new Set(input.authorizedPersonIds.map(String));
  return [...input.authorities]
    .sort((a, b) => a.costId.localeCompare(b.costId))
    .flatMap((authority): readonly PersonalCostSignal[] => {
      const beneficiary = authority.beneficiaryPersonId;
      if (beneficiary === undefined || !authorized.has(String(beneficiary)) || (authority.beneficiaryEvidenceRefs?.length ?? 0) === 0) return [];
      if (authority.observedAmount === undefined && authority.typicalAmount === undefined) return [];
      const recurrenceStatus = authority.recurrenceStatus ?? "UNKNOWN";
      return [{
        signalId: `m1:personal-cost:${authority.costId}`,
        signalType: "PERSONAL_COST",
        semanticKey: authority.semanticKey,
        ...personScope(beneficiary),
        kind: "HABIT",
        family: authority.family ?? "RECURRING_PERSONAL_COSTS",
        authority: "CANONICAL_DB",
        knowledgeStatus: "OBSERVED",
        temporalStatus: recurrenceStatus === "ACTIVE" || recurrenceStatus === "RESTARTED" ? "STABLE" : recurrenceStatus === "ENDED" ? "HISTORICAL" : "UNKNOWN",
        dimension: "FINANCE",
        sourceModule: "M1",
        methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
        ...(authority.context === undefined ? {} : { context: authority.context }),
        ...(authority.needKey === undefined ? {} : { needKey: authority.needKey }),
        ...(authority.entityRef === undefined ? {} : { entityRef: authority.entityRef }),
        ...(authority.observedAmount === undefined ? {} : { observedAmount: authority.observedAmount }),
        ...(authority.typicalAmount === undefined ? {} : { typicalAmount: authority.typicalAmount }),
        ...(authority.payerPersonId === undefined ? {} : { payerPersonId: authority.payerPersonId }),
        beneficiaryPersonId: beneficiary,
        metrics: { recurrenceStatus },
        evidenceRefs: evidence([...authority.evidenceRefs, ...(authority.beneficiaryEvidenceRefs ?? [])], `m1:personal-cost:${authority.costId}`),
      }];
    });
}

export function adaptGlobalM2NeedSignals(input: {
  readonly householdId: HouseholdId;
  readonly groups: readonly NeedGroup[];
}): readonly NeedSignal[] {
  return [...input.groups]
    .sort((a, b) => a.key.localeCompare(b.key))
    .flatMap((group): readonly NeedSignal[] => {
      if (group.dimension.status !== "KNOWN" || group.dimension.id === undefined) return [];
      const metrics: Record<string, string | number> = { activeMonths: group.activeMonths };
      if (group.monthlyAmount !== undefined) metrics.monthlyAmount = group.monthlyAmount;
      if (group.typicalAmount !== undefined && group.typicalAmount !== null) metrics.typicalAmount = group.typicalAmount;
      return [{
        signalId: `m2:need:${group.dimension.id}`,
        signalType: "NEED",
        semanticKey: `need:${group.dimension.id}`,
        ...householdScope(input.householdId),
        needKey: group.dimension.id,
        active: group.activeMonths > 0,
        authority: "CANONICAL_DB",
        knowledgeStatus: "OBSERVED",
        dimension: "ORGANIZATION",
        sourceModule: "M2",
        methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
        metrics,
        limitations: ["NEED_ROLE_NOT_PROJECTED_TO_PERSON"],
        evidenceRefs: evidence([...(group.dimension.evidenceRefs ?? []), ...group.evidenceRefs], `m2:need:${group.dimension.id}`),
      }];
    });
}

export function adaptGlobalM4RoutineSignals(input: {
  readonly rhythms: readonly ActivityRhythm[];
  readonly routinePatterns?: readonly RoutinePattern[];
  readonly authorizedPersonIds: readonly PersonId[];
}): readonly RoutineSignal[] {
  const personById = new Map(input.authorizedPersonIds.map((personId) => [String(personId), personId]));
  const rhythms = [...input.rhythms].sort((a, b) => a.personId.localeCompare(b.personId) || a.activityId.localeCompare(b.activityId)).flatMap((rhythm): readonly RoutineSignal[] => {
    const personId = personById.get(rhythm.personId);
    if (personId === undefined) return [];
    const occurrenceCount = rhythm.includedOccurrenceCount ?? rhythm.support?.occurrenceCount ?? rhythm.rawOccurrenceCount ?? 0;
    if (occurrenceCount <= 0) return [];
    const metrics: Record<string, string | number> = {};
    if (rhythm.rawOccurrenceCount !== undefined) metrics.rawOccurrenceCount = rhythm.rawOccurrenceCount;
    if (rhythm.includedOccurrenceCount !== undefined) metrics.occurrenceCount = rhythm.includedOccurrenceCount;
    else if (rhythm.support?.occurrenceCount !== undefined) metrics.occurrenceCount = rhythm.support.occurrenceCount;
    if (rhythm.eligibleObservableDays !== undefined) metrics.eligibleObservableDays = rhythm.eligibleObservableDays;
    if (rhythm.rate?.value !== undefined) metrics.ratePerObservableDay = rhythm.rate.value;
    if (rhythm.cadence?.medianIntervalDays !== undefined) metrics.medianIntervalDays = rhythm.cadence.medianIntervalDays;
    if (rhythm.support?.supportStatus !== undefined) metrics.supportStatus = rhythm.support.supportStatus;
    return [{
      signalId: `m4:rhythm:${rhythm.personId}:${rhythm.activityId}`,
      signalType: "ROUTINE",
      semanticKey: `activity:${rhythm.activityId}`,
      ...personScope(personId),
      kind: "ROUTINE",
      family: activityFamily(rhythm.activityId),
      authority: "OBSERVED",
      knowledgeStatus: rhythm.rate?.status === "KNOWN" ? "OBSERVED" : "TO_CONFIRM",
      temporalStatus: "UNKNOWN",
      dimension: "USAGE",
      context: `ACTIVITY:${rhythm.activityId}`,
      pattern: [`ACTIVITY:${rhythm.activityId}`],
      metrics,
      limitations: ["RHYTHM_IS_NOT_A_SEQUENCED_ROUTINE"],
      evidenceRefs: evidence(rhythm.dependencyRefs ?? [], `m4:rhythm:${rhythm.personId}:${rhythm.activityId}`),
      sourceModule: "M4",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    }];
  });
  const patterns = [...(input.routinePatterns ?? [])].sort((a, b) => a.routineId.localeCompare(b.routineId)).flatMap((pattern): readonly RoutineSignal[] => {
    if (pattern.scope !== "PERSON" || pattern.personId === undefined) return [];
    const personId = personById.get(pattern.personId);
    if (personId === undefined) return [];
    return [{
      signalId: `m4:routine:${pattern.routineId}`,
      signalType: "ROUTINE",
      semanticKey: `routine:${pattern.routineId}`,
      ...personScope(personId),
      kind: "ROUTINE",
      family: "WORK_AND_DAY_CONTEXT",
      authority: "OBSERVED",
      knowledgeStatus: pattern.certificationStatus === "CERTIFIED" ? "OBSERVED" : "TO_CONFIRM",
      temporalStatus: "UNKNOWN",
      dimension: "USAGE",
      context: pattern.eligibilityContext,
      pattern: pattern.coreTokens,
      metrics: { occurrenceCount: pattern.occurrenceCount, prevalence: pattern.prevalence, strength: pattern.strength },
      limitations: pattern.certificationStatus === "CERTIFIED" ? [] : ["ROUTINE_HYPOTHESIS_ONLY"],
      evidenceRefs: evidence(pattern.evidenceRefs, `m4:routine:${pattern.routineId}`),
      sourceModule: "M4",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    }];
  });
  return [...rhythms, ...patterns].sort((a, b) => a.signalId.localeCompare(b.signalId));
}

export function adaptGlobalM6MomentSignals(input: {
  readonly householdId: HouseholdId;
  readonly personIds: readonly PersonId[];
  readonly summaries: readonly MomentSummary[];
  readonly certifiedThrough: LocalDate;
}): readonly MomentSignal[] {
  const personById = new Map(input.personIds.map((personId) => [String(personId), personId]));
  return [...input.summaries].sort((a, b) => a.moment.momentId.localeCompare(b.moment.momentId)).map((summary) => {
    const participants = unique(summary.moment.householdParticipantIds).flatMap((id) => personById.get(id) ?? []);
    const scoped = participants.length === 1 ? personScope(participants[0]!) : participants.length === 2 ? sharedScope(participants) : householdScope(input.householdId);
    const isProject = summary.resolvedType?.family === "PROJECT_MILESTONE" || summary.moment.transformationAnchor?.value === true;
    const metrics: Record<string, string | number> = {};
    if (summary.causalCost.value !== undefined) metrics.causalCost = summary.causalCost.value;
    if (summary.experienceDayCount !== undefined) metrics.experienceDayCount = summary.experienceDayCount;
    return {
      signalId: `m6:moment:${summary.moment.momentId}`,
      signalType: "MOMENT",
      semanticKey: `moment:${summary.resolvedType?.normalizedKey ?? summary.moment.momentId}`,
      ...scoped,
      ...(isProject ? { kind: "PROJECT" as const } : {}),
      ...(momentFamily(summary.resolvedType?.family) === undefined ? {} : { family: momentFamily(summary.resolvedType?.family)! }),
      authority: "CANONICAL_DB" as const,
      knowledgeStatus: "OBSERVED" as const,
      temporalStatus: isProject ? "PROJECT" as const : summary.moment.endDate !== undefined && summary.moment.endDate <= input.certifiedThrough ? "HISTORICAL" as const : "UNKNOWN" as const,
      dimension: "TEMPORALITY" as const,
      momentRef: `moment:${summary.moment.momentId}`,
      ...(summary.moment.startDate === undefined ? {} : { validFrom: summary.moment.startDate }),
      ...(summary.moment.endDate === undefined ? {} : { validTo: summary.moment.endDate }),
      metrics,
      limitations: summary.causalCost.status === "KNOWN" ? [] : ["MOMENT_CAUSAL_COST_NOT_FULLY_KNOWN"],
      evidenceRefs: evidence([...summary.sourceRefs, ...summary.moment.participationEvidenceRefs], `moment:${summary.moment.momentId}`),
      sourceModule: "M6",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    } satisfies MomentSignal;
  });
}

export function adaptGlobalM8ProductObservationSignals(input: {
  readonly observations: readonly GlobalPersonaProductObservation[];
}): readonly ProductCycleSignal[] {
  const groups = new Map<string, GlobalPersonaProductObservation[]>();
  for (const observation of input.observations) {
    const subjectKey = observation.subject.kind === "PERSON" ? `PERSON:${observation.subject.personId}` : `HOUSEHOLD:${observation.subject.householdId}`;
    const key = `${subjectKey}\u0000${observation.needKey}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.values()].map((raw): ProductCycleSignal => {
    const rows = [...raw].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.observationId.localeCompare(b.observationId));
    const first = rows[0]!;
    const gaps = rows.slice(1).map((row, index) => Temporal.PlainDate.from(rows[index]!.observedAt).until(Temporal.PlainDate.from(row.observedAt), { largestUnit: "day" }).days).sort((a, b) => a - b);
    const prices = rows.flatMap(({ price }) => price === undefined ? [] : [Number(price)]).filter(Number.isFinite).sort((a, b) => a - b);
    const median = (values: readonly number[]): number | undefined => values.length === 0 ? undefined : values.length % 2 === 1 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
    const productKeys = unique(rows.map(({ productKey }) => productKey));
    const metrics: Record<string, string | number> = {
      occurrenceCount: rows.length,
      firstObservedDate: rows[0]!.observedAt,
      lastObservedDate: rows.at(-1)!.observedAt,
      referenceState: productKeys.length > 1 ? "CHANGED_PRODUCT" : "SAME_PRODUCT",
    };
    const medianGap = median(gaps), typicalPrice = median(prices);
    if (medianGap !== undefined) metrics.medianGapDays = medianGap;
    if (typicalPrice !== undefined) metrics.typicalPrice = typicalPrice;
    const scoped = first.subject.kind === "PERSON" ? personScope(first.subject.personId) : householdScope(first.subject.householdId);
    return {
      signalId: `m8:product-observations:${first.needKey}:${rows.map(({ observationId }) => observationId).join("+")}`,
      signalType: "PRODUCT_CYCLE",
      semanticKey: `product-need:${first.needKey}`,
      ...scoped,
      ...(first.family === undefined ? {} : { family: first.family }),
      authority: "OBSERVED",
      knowledgeStatus: "OBSERVED",
      temporalStatus: productKeys.length > 1 ? "CHANGED" : "UNKNOWN",
      dimension: "USAGE",
      needKey: first.needKey,
      ...(productKeys.length === 1 ? { productKey: productKeys[0] } : {}),
      referenceChanged: productKeys.length > 1,
      ...(first.groupKey === undefined ? {} : { groupKey: first.groupKey }),
      metrics,
      limitations: ["DESCRIPTIVE_PRODUCT_OBSERVATIONS_ONLY", "NOT_A_PURCHASE_CYCLE_ENGINE"],
      evidenceRefs: evidence(rows.flatMap(({ evidenceRefs }) => evidenceRefs), `m8:product-observations:${first.needKey}`),
      sourceModule: "M8_PRODUCT_OBSERVATION_FALLBACK",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    };
  }).sort((a, b) => a.signalId.localeCompare(b.signalId));
}

export function adaptGlobalM10SharedActivitySignals(input: {
  readonly personIds: readonly PersonId[];
  readonly universes: readonly SharedUniverse[];
}): readonly SharedActivitySignal[] {
  return [...input.universes].sort((a, b) => a.universeId.localeCompare(b.universeId) || a.grain.localeCompare(b.grain)).flatMap((universe): readonly SharedActivitySignal[] => {
    if (universe.support.sharedUnits <= 0 || universe.sharedUnits.length === 0) return [];
    const activityId = universe.universeId.startsWith("activity:") ? universe.universeId.slice("activity:".length) : universe.universeId;
    return [{
      signalId: `m10:shared:${universe.universeId}:${universe.grain}`,
      signalType: "SHARED_ACTIVITY",
      semanticKey: universe.universeId.startsWith("activity:") ? activityId : `shared:${universe.universeId}`,
      ...sharedScope(input.personIds),
      kind: "UNIVERSE",
      family: activityFamily(activityId),
      authority: "OBSERVED",
      knowledgeStatus: universe.support.knowledgeState === "KNOWN" ? "OBSERVED" : "TO_CONFIRM",
      temporalStatus: "UNKNOWN",
      dimension: "PARTICIPATION",
      activityKey: universe.universeId,
      upstreamUnitRefs: universe.sharedUnits.map(({ unitId }) => `m10-unit:${unitId}`).sort(),
      metrics: {
        eligibleUnits: universe.support.eligibleUnits,
        resolvedUnits: universe.support.resolvedUnits,
        unresolvedUnits: universe.support.unresolvedUnits,
        conflictUnits: universe.support.conflictUnits,
        sharedOccurrences: universe.support.sharedUnits,
        ...(universe.support.sharedObservableCoverage === null ? {} : { sharedObservableCoverage: universe.support.sharedObservableCoverage }),
        ...(universe.support.sharedRate === null ? {} : { sharedRate: universe.support.sharedRate }),
      },
      limitations: universe.support.knowledgeState === "KNOWN" ? [] : ["M10_PARTICIPATION_COVERAGE_PARTIAL"],
      evidenceRefs: evidence(universe.sharedUnits.flatMap(({ evidenceRefs }) => evidenceRefs), `m10:universe:${universe.universeId}`),
      sourceModule: "M10",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    } satisfies SharedActivitySignal];
  });
}

export function adaptGlobalM7MobilitySignals(input: {
  readonly householdId: HouseholdId;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly authorities: readonly MobilityAuthority[];
}): readonly MobilitySignal[] {
  const authorized = new Set(input.authorizedPersonIds.map(String));
  return [...input.authorities].sort((a, b) => a.mobilityId.localeCompare(b.mobilityId)).flatMap((authority): readonly MobilitySignal[] => {
    if (authority.scope === "PERSONAL" && (authority.personId === undefined || !authorized.has(String(authority.personId)))) return [];
    if (authority.mode === undefined && authority.context === undefined && authority.vehicleRef === undefined) return [];
    const scoped = authority.scope === "PERSONAL" ? personScope(authority.personId!) : householdScope(input.householdId);
    return [{
      signalId: `m7:mobility:${authority.mobilityId}`,
      signalType: "MOBILITY",
      semanticKey: `mobility:${authority.mobilityId}`,
      ...scoped,
      kind: authority.scope === "PERSONAL" ? "MOBILITY" : "HOUSEHOLD_ORGANIZATION",
      family: "MOBILITY",
      authority: "CANONICAL_DB",
      knowledgeStatus: "OBSERVED",
      temporalStatus: "UNKNOWN",
      dimension: authority.scope === "PERSONAL" ? "USAGE" : "OWNERSHIP",
      ...(authority.mode === undefined ? {} : { mode: authority.mode }),
      ...(authority.context === undefined ? {} : { context: authority.context }),
      ...(authority.vehicleRef === undefined ? {} : { vehicleRef: authority.vehicleRef }),
      limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "ANNUAL_COST_UNKNOWN"],
      evidenceRefs: evidence(authority.evidenceRefs, `m7:mobility:${authority.mobilityId}`),
      sourceModule: "M7",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    }];
  });
}

export function adaptGlobalPersonaDifferenceSignals(input: {
  readonly householdId: HouseholdId;
  readonly differences: readonly GlobalPersonaDifference[];
}): readonly DifferenceSignal[] {
  return [...input.differences].sort((a, b) => a.differenceId.localeCompare(b.differenceId)).map((difference) => ({
    signalId: `m9:difference:${difference.differenceId}`,
    signalType: "DIFFERENCE",
    semanticKey: `difference:${difference.metricId}`,
    ...householdScope(input.householdId),
    family: difference.family,
    authority: "DERIVED",
    knowledgeStatus: difference.materialityStatus === "INELIGIBLE" ? "TO_CONFIRM" : "DERIVED",
    temporalStatus: difference.temporalStatus === "STABLE_CURRENT_REGIME" ? "STABLE" : difference.temporalStatus === "RECENT_ONLY" ? "EMERGING" : difference.temporalStatus === "HISTORICAL_ONLY" ? "HISTORICAL" : difference.temporalStatus === "CHANGED_DIFFERENCE" ? "CHANGED" : "UNKNOWN",
    dimension: "GENERAL",
    differenceRef: difference.differenceId,
    comparisonPersonIds: [difference.personAId, difference.personBId],
    metrics: {
      ...(difference.rawDifference === null ? {} : { rawDifference: difference.rawDifference }),
      ...(difference.habitualDifference === null ? {} : { habitualDifference: difference.habitualDifference }),
      materialityStatus: difference.materialityStatus,
    },
    limitations: difference.reasonCodes,
    evidenceRefs: difference.evidenceRefs,
    sourceModule: "M9_HISTORICAL_DIFFERENCE",
    methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
  }));
}

function personByExactName(input: GlobalV2PersonaSignalAdapterInput, expected: string): PersonId | undefined {
  const match = input.personIds.filter((personId) => input.displayNamesByPersonId[String(personId)]?.trim().toLocaleLowerCase("fr-FR") === expected.toLocaleLowerCase("fr-FR"));
  return match.length === 1 ? match[0] : undefined;
}

/** Read-only v1 declarations. They qualify Persona meaning and never mutate upstream owner outputs. */
export function buildGlobalPersonaDeclaredSignalsV1(input: GlobalV2PersonaSignalAdapterInput): readonly DeclaredSignal[] {
  const adrien = personByExactName(input, "Adrien");
  const manon = personByExactName(input, "Manon");
  const shared = sharedScope(input.personIds);
  const household = householdScope(input.householdId);
  const declarations: DeclaredSignal[] = [
    { signalId: "declared-v1:gaming:shared", signalType: "DECLARED", semanticKey: "gaming", ...shared, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "USAGE", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:gaming-shared"] },
    { signalId: "declared-v1:techno:shared", signalType: "DECLARED", semanticKey: "techno", ...shared, action: "AFFIRM", value: true, kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "USAGE", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, limitations: ["DOES_NOT_REWRITE_M10_HISTORY"], evidenceRefs: ["declaration-v1:techno-shared"] },
    { signalId: "declared-v1:groceries:00-household", signalType: "DECLARED", semanticKey: "groceries.organization", ...household, action: "AFFIRM", value: true, kind: "HOUSEHOLD_ORGANIZATION", family: "PERSONAL_PURCHASES", authority: "USER_VALIDATED", dimension: "ORGANIZATION", groupKey: "groceries", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, limitations: ["NO_PERSONAL_OWNERSHIP_INFERRED", "NO_FIFTY_FIFTY_SPLIT_INFERRED"], evidenceRefs: ["declaration-v1:groceries-household"] },
    { signalId: "declared-v1:groceries:10-adrien-small", signalType: "DECLARED", semanticKey: "groceries.organization", ...household, action: "QUALIFY", value: "ADRIEN_SMALL_LOCAL_GROCERIES", authority: "USER_VALIDATED", dimension: "ORGANIZATION", groupKey: "groceries", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:adrien-small-groceries"] },
    { signalId: "declared-v1:groceries:20-manon-large", signalType: "DECLARED", semanticKey: "groceries.organization", ...household, action: "QUALIFY", value: "MANON_LARGE_GROCERIES", authority: "USER_VALIDATED", dimension: "ORGANIZATION", groupKey: "groceries", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:manon-large-groceries"] },
    { signalId: "declared-v1:household:no-pet", signalType: "DECLARED", semanticKey: "household.has_pet", ...household, action: "NEGATE", value: false, authority: "USER_VALIDATED", dimension: "GENERAL", groupKey: "household.pet", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:no-pet"] },
    { signalId: "declared-v1:vehicle:peugeot-207", signalType: "DECLARED", semanticKey: "vehicle.peugeot_207", ...household, action: "AFFIRM", value: "PEUGEOT_207", kind: "HOUSEHOLD_ORGANIZATION", family: "MOBILITY", authority: "USER_VALIDATED", dimension: "OWNERSHIP", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, limitations: ["CANONICAL_VEHICLE_AUTHORITY_UNAVAILABLE", "PERSONAL_OWNERSHIP_NOT_INFERRED"], evidenceRefs: ["declaration-v1:peugeot-207-household"] },
  ];
  if (adrien !== undefined) declarations.push(
    { signalId: "declared-v1:adrien:creative-projects", signalType: "DECLARED", semanticKey: "creative.projects.adrien", ...personScope(adrien), action: "AFFIRM", value: ["PHOTO", "MUSIC", "HOME_STUDIO"], kind: "UNIVERSE", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", temporalStatus: "UNKNOWN", dimension: "GENERAL", groupKey: "creative_projects", limitations: ["SUBDOMAIN_ACTIVITY_STATUS_UNSPECIFIED", "CADENCE_NOT_DECLARED"], sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:creative-projects-adrien"] },
    { signalId: "declared-v1:adrien:driving-license-in-progress", signalType: "DECLARED", semanticKey: "driving_license.adrien", ...personScope(adrien), action: "AFFIRM", value: "IN_PROGRESS", kind: "PROJECT", family: "MOBILITY", authority: "USER_VALIDATED", temporalStatus: "PROJECT", dimension: "TEMPORALITY", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:driving-license-in-progress"] },
    { signalId: "declared-v1:adrien:photo-active", signalType: "DECLARED", semanticKey: "creative.photo.adrien", ...personScope(adrien), action: "TEMPORAL_OVERRIDE", value: "PROJECT", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", dimension: "TEMPORALITY", sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:photo-active"] },
    { signalId: "declared-v1:adrien:work-commute", signalType: "DECLARED", semanticKey: "mobility.work.adrien", ...personScope(adrien), action: "AFFIRM", value: "TRAM_BUSTRAM", kind: "MOBILITY", family: "MOBILITY", authority: "USER_VALIDATED", dimension: "USAGE", context: "WORK_COMMUTE", metrics: { directCost: 0 }, limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_NOT_APPLICABLE", "ZERO_COST_IS_DECLARED_NOT_CALCULATED"], sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:adrien-work-tram-bustram-zero-cost"] },
    { signalId: "declared-v1:adrien:chatgpt", signalType: "DECLARED", semanticKey: "subscription.chatgpt.adrien", ...personScope(adrien), action: "AFFIRM", value: "PERSONAL_SUBSCRIPTION", kind: "HABIT", family: "RECURRING_PERSONAL_COSTS", authority: "USER_VALIDATED", dimension: "USAGE", limitations: ["CANONICAL_FINANCIAL_LINK_UNAVAILABLE", "AMOUNT_NOT_DECLARED"], sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:chatgpt-personal-adrien"] },
  );
  if (manon !== undefined) declarations.push(
    { signalId: "declared-v1:manon:work-commute", signalType: "DECLARED", semanticKey: "mobility.work.manon", ...personScope(manon), action: "AFFIRM", value: "CAR", kind: "MOBILITY", family: "MOBILITY", authority: "USER_VALIDATED", dimension: "USAGE", context: "WORK_COMMUTE", limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"], sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:manon-work-car"] },
  );
  return declarations.sort((a, b) => a.signalId.localeCompare(b.signalId));
}

export function buildGlobalV2PersonaSignals(input: GlobalV2PersonaSignalAdapterInput & { readonly certifiedThrough: LocalDate }): GlobalV2PersonaSignalAdapterResult {
  const declarations = buildGlobalPersonaDeclaredSignalsV1(input);
  const upstreamSignals: PersonaSignal[] = [
    ...adaptGlobalM1PersonalCostSignals({ authorities: input.personalCostAuthorities ?? [], authorizedPersonIds: input.personIds }),
    ...adaptGlobalM2NeedSignals({ householdId: input.householdId, groups: input.m2.result.needs.groups }),
    ...adaptGlobalM4RoutineSignals({ rhythms: input.m4.rhythms, ...(input.m4.routinePatterns === undefined ? {} : { routinePatterns: input.m4.routinePatterns }), authorizedPersonIds: input.personIds }),
    ...adaptGlobalM6MomentSignals({ householdId: input.householdId, personIds: input.personIds, summaries: input.m6.summaries, certifiedThrough: input.certifiedThrough }),
    ...adaptGlobalM7MobilitySignals({ householdId: input.householdId, authorizedPersonIds: input.personIds, authorities: input.mobilityAuthorities ?? [] }),
    ...adaptGlobalM8ProductObservationSignals({ observations: input.productObservations ?? [] }),
    ...adaptGlobalM10SharedActivitySignals({ personIds: input.personIds, universes: input.m10.universes }),
    ...adaptGlobalPersonaDifferenceSignals({ householdId: input.householdId, differences: input.differences }),
  ];
  const signals = [...upstreamSignals, ...declarations].sort((a, b) => a.signalId.localeCompare(b.signalId));
  const limitations = unique([
    ...(input.personalCostAuthorities?.length ? [] : [input.m1.recurrences.series.length > 0 ? "M1_RECURRENCES_LACK_PERSON_BENEFICIARY_BINDING" : "M1_PERSONAL_BENEFICIARY_AUTHORITY_UNAVAILABLE"]),
    ...(input.m4.routinePatterns?.length ? [] : ["M4_SEQUENCED_ROUTINE_OUTPUT_UNAVAILABLE"]),
    ...(input.productObservations === undefined
      ? ["M8_PRODUCT_OBSERVATION_PROVIDER_UNAVAILABLE"]
      : ["M8_PRODUCT_CYCLE_ENGINE_UNAVAILABLE_USING_DESCRIPTIVE_FALLBACK"]),
    ...((input.m7.mobility?.legs?.length ?? 0) > 0 ? [] : ["M7_ROUTE_DISTANCE_AND_COST_AUTHORITY_UNAVAILABLE"]),
  ]);
  const profile = buildPersonaProfile({ signals });
  if (profile.methodVersion !== GLOBAL_PERSONA_PROFILE_METHOD_VERSION) throw new TypeError("PERSONA_PROFILE_METHOD_VERSION_MISMATCH");
  return {
    adapterVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    declarationProviderVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION,
    signals,
    declarations,
    profile: { ...profile, limitations: unique([...(profile.limitations ?? []), ...limitations]) },
    limitations,
    capabilities: {
      productCycleRuntime: {
        state: input.productObservations === undefined ? "UNAVAILABLE" : "CONNECTED",
        mode: "DESCRIPTIVE_PRODUCT_OBSERVATIONS",
        source: "product_observations",
        reasonCodes: input.productObservations === undefined
          ? ["PRODUCT_OBSERVATION_PROVIDER_NOT_CONNECTED"]
          : ["FULL_M8_PRODUCT_CYCLE_AUTHORITY_UNAVAILABLE", "DESCRIPTIVE_FALLBACK_ONLY"],
      },
    },
  };
}
