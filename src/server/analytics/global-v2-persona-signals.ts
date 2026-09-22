import "server-only";

import { Temporal } from "@js-temporal/polyfill";

import {
  GLOBAL_PERSONA_PROFILE_METHOD_VERSION,
  buildPersonaProfile,
  type DeclaredSignal,
  type DifferenceSignal,
  type GlobalM1PersonalCostAuthority,
  type GlobalPersonPlaceReturnPattern,
  type GlobalPersonPlaceRollup,
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
export const GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION = parseMethodVersion("global_persona_declared_provider@v2");

type NeedGroup = {
  readonly key: string;
  readonly dimension: { readonly status: string; readonly id?: string; readonly evidenceRefs?: readonly string[] };
  readonly activeMonths: number;
  readonly monthlyAmount?: Money;
  readonly typicalAmount?: Money | null;
  readonly annualAmount?: Money;
  readonly subject?:
    | { readonly scope: "PERSONAL"; readonly personId: PersonId }
    | { readonly scope: "HOUSEHOLD" }
    | { readonly scope: "CONFLICT" };
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
  readonly m1: { readonly recurrences: { readonly series: readonly { readonly recurrenceId: string }[]; readonly personalCostAuthorities?: readonly GlobalM1PersonalCostAuthority[] } };
  readonly m2: { readonly result: { readonly needs: { readonly groups: readonly NeedGroup[] } } };
  readonly m4: { readonly rhythms: readonly ActivityRhythm[]; readonly routinePatterns?: readonly RoutinePattern[] };
  readonly m6: { readonly summaries: readonly MomentSummary[] };
  readonly m7: {
    readonly mobilityCapabilities?: Readonly<Record<string, { readonly state?: string; readonly reasonCodes?: readonly string[] }>>;
    readonly mobility?: { readonly legs?: readonly unknown[]; readonly routes?: readonly unknown[] };
    readonly personPlaceRollups?: readonly GlobalPersonPlaceRollup[];
    readonly personPlaceReturnPatterns?: readonly GlobalPersonPlaceReturnPattern[];
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

const PERSONAL_USAGE_SERVICE_DECLARATIONS_V1 = Object.freeze([
  { signalId: "declared-v1:adrien:chatgpt", personName: "Adrien", semanticKey: "subscription.chatgpt.adrien", recurrenceId: "91e58dd4-1a8d-536f-a841-eff33c136228", evidenceRef: "declaration-v1:chatgpt-personal-adrien" },
  { signalId: "declared-v1:adrien:qobuz", personName: "Adrien", semanticKey: "subscription.qobuz.adrien", recurrenceId: "b2abae46-3378-5f09-897c-7c44eed28073", evidenceRef: "declaration-v1:qobuz-personal-adrien" },
  { signalId: "declared-v2:adrien:google-ai-pro", personName: "Adrien", semanticKey: "subscription.google_ai_pro.adrien", recurrenceId: "67657950-b736-5f73-89bc-456d207b965c", evidenceRef: "declaration-v2:google-ai-pro-personal-usage-adrien" },
  { signalId: "declared-v1:manon:max", personName: "Manon", semanticKey: "subscription.max.manon", recurrenceId: "24c0cb89-34bf-5e2a-881d-4d4f9f7b694a", evidenceRef: "declaration-v1:max-personal-manon" },
  { signalId: "declared-v1:manon:netflix", personName: "Manon", semanticKey: "subscription.netflix.manon", recurrenceId: "6ceae158-ebba-5208-9d41-85eac3bd4dde", evidenceRef: "declaration-v1:netflix-personal-manon" },
] as const);

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
  readonly authorities: readonly GlobalM1PersonalCostAuthority[];
  readonly authorizedPersonIds: readonly PersonId[];
}): readonly PersonalCostSignal[] {
  const authorized = new Set(input.authorizedPersonIds.map(String));
  return [...input.authorities]
    .sort((a, b) => a.authorityId.localeCompare(b.authorityId))
    .flatMap((authority): readonly PersonalCostSignal[] => {
      const beneficiary = authority.personId;
      if (authority.attributionState !== "PERSONAL" || authority.support.status !== "SUFFICIENT" || beneficiary === undefined || !authorized.has(String(beneficiary)) || authority.evidenceRefs.length === 0) return [];
      if (authority.typicalOccurrenceAmount === undefined && authority.monthlyEquivalent === undefined) return [];
      const recurrenceStatus = authority.lifecycle.status === "KNOWN" ? authority.lifecycle.value : "UNKNOWN";
      return [{
        signalId: `m1:personal-cost:${authority.authorityId}`,
        signalType: "PERSONAL_COST",
        semanticKey: `personal-cost:${authority.recurrenceId}`,
        ...personScope(beneficiary),
        kind: "HABIT",
        family: "RECURRING_PERSONAL_COSTS",
        authority: "CANONICAL_DB",
        knowledgeStatus: "OBSERVED",
        temporalStatus: recurrenceStatus === "ACTIVE" || recurrenceStatus === "RESTARTED" ? "STABLE" : recurrenceStatus === "ENDED" ? "HISTORICAL" : "UNKNOWN",
        dimension: "FINANCE",
        sourceModule: "M1",
        methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
        entityRef: authority.detailRef.entityRef,
        ...(authority.typicalOccurrenceAmount === undefined ? {} : { typicalAmount: authority.typicalOccurrenceAmount }),
        beneficiaryPersonId: beneficiary,
        metrics: {
          recurrenceStatus,
          ...(authority.coverage.amountRatio === null ? {} : { personalCostCoverage: authority.coverage.amountRatio }),
          ...(authority.monthlyEquivalent === undefined ? {} : { monthlyEquivalent: authority.monthlyEquivalent }),
        },
        evidenceRefs: [authority.authorityId, authority.detailRef.entityRef].sort(),
      }];
    });
}

export function adaptGlobalM2NeedSignals(input: {
  readonly householdId: HouseholdId;
  readonly authorizedPersonIds: readonly PersonId[];
  readonly groups: readonly NeedGroup[];
}): readonly NeedSignal[] {
  const authorized = new Map(input.authorizedPersonIds.map((personId) => [String(personId), personId]));
  return [...input.groups]
    .sort((a, b) => a.key.localeCompare(b.key))
    .flatMap((group): readonly NeedSignal[] => {
      if (group.dimension.status !== "KNOWN" || group.dimension.id === undefined) return [];
      if (group.subject?.scope === "CONFLICT") return [];
      const personalPersonId = group.subject?.scope === "PERSONAL" ? authorized.get(String(group.subject.personId)) : undefined;
      if (group.subject?.scope === "PERSONAL" && personalPersonId === undefined) return [];
      const scope = personalPersonId === undefined ? householdScope(input.householdId) : personScope(personalPersonId);
      const metrics: Record<string, string | number> = { activeMonths: group.activeMonths };
      if (group.monthlyAmount !== undefined) metrics.monthlyAmount = group.monthlyAmount;
      if (group.typicalAmount !== undefined && group.typicalAmount !== null) metrics.typicalAmount = group.typicalAmount;
      if (group.annualAmount !== undefined) metrics.annualAmount = group.annualAmount;
      return [{
        signalId: `m2:need:${group.dimension.id}`,
        signalType: "NEED",
        semanticKey: `need:${group.dimension.id}`,
        ...scope,
        needKey: group.dimension.id,
        entityRef: `need:${group.dimension.id}`,
        active: group.activeMonths > 0,
        kind: "HABIT",
        family: "PRODUCTS_AND_CONSUMPTION",
        authority: "CANONICAL_DB",
        knowledgeStatus: "OBSERVED",
        dimension: "ORGANIZATION",
        sourceModule: "M2",
        methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
        metrics,
        ...(personalPersonId === undefined ? { limitations: ["NEED_ROLE_NOT_PROJECTED_TO_PERSON"] } : {}),
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

export function adaptGlobalM7PlaceReferenceSignals(input: {
  readonly authorizedPersonIds: readonly PersonId[];
  readonly rollups: readonly GlobalPersonPlaceRollup[];
  readonly returnPatterns: readonly GlobalPersonPlaceReturnPattern[];
}): readonly MobilitySignal[] {
  const authorized = new Map(input.authorizedPersonIds.map((personId) => [String(personId), personId]));
  const rollupSignals = [...input.rollups].sort((left, right) => left.entityRef.localeCompare(right.entityRef)).flatMap((rollup): readonly MobilitySignal[] => {
    const personId = authorized.get(rollup.personId);
    if (personId === undefined || rollup.support.status !== "SUFFICIENT") return [];
    return [{
      signalId: `m7:person-place:${rollup.entityRef}`,
      signalType: "MOBILITY",
      semanticKey: `person-place:${rollup.placeId}`,
      ...personScope(personId),
      entityRef: rollup.entityRef,
      kind: "HABIT",
      family: "MOBILITY",
      authority: "OBSERVED",
      knowledgeStatus: rollup.knowledgeState === "KNOWN" ? "OBSERVED" : "TO_CONFIRM",
      temporalStatus: "UNKNOWN",
      dimension: "USAGE",
      context: "PERSON_PLACE_ROLLUP",
      metrics: {
        visitCount: rollup.visitCount,
        distinctVisitDays: rollup.distinctVisitDays,
        ...(rollup.medianDurationMinutes === undefined ? {} : { medianDurationMinutes: rollup.medianDurationMinutes }),
      },
      limitations: ["OWNER_BACKED_PLACE_REFERENCE_ONLY"],
      evidenceRefs: [rollup.entityRef],
      sourceModule: "M7",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    }];
  });
  const patternSignals = [...input.returnPatterns].sort((left, right) => left.entityRef.localeCompare(right.entityRef)).flatMap((pattern): readonly MobilitySignal[] => {
    const personId = authorized.get(pattern.personId);
    if (personId === undefined || pattern.support.status !== "SUFFICIENT") return [];
    return [{
      signalId: `m7:person-place-return:${pattern.entityRef}`,
      signalType: "MOBILITY",
      semanticKey: `person-place-return:${pattern.originPlaceId}:${pattern.stopPlaceId}:${pattern.destinationPlaceId}`,
      ...personScope(personId),
      entityRef: pattern.entityRef,
      kind: "HABIT",
      family: "MOBILITY",
      authority: "OBSERVED",
      knowledgeStatus: pattern.knowledgeState === "KNOWN" ? "OBSERVED" : "TO_CONFIRM",
      temporalStatus: "UNKNOWN",
      dimension: "USAGE",
      context: "PERSON_PLACE_RETURN_PATTERN",
      metrics: { returnCount: pattern.occurrenceCount, distinctDayCount: pattern.distinctDayCount },
      limitations: ["SEMANTIC_ROLE_NOT_INFERRED", "OWNER_BACKED_PLACE_REFERENCE_ONLY"],
      evidenceRefs: [pattern.entityRef],
      sourceModule: "M7",
      methodVersion: GLOBAL_PERSONA_SIGNAL_ADAPTER_VERSION,
    }];
  });
  return [...rollupSignals, ...patternSignals].sort((left, right) => left.signalId.localeCompare(right.signalId));
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
  const peopleByName = new Map([
    ...(adrien === undefined ? [] : [["Adrien", adrien] as const]),
    ...(manon === undefined ? [] : [["Manon", manon] as const]),
  ]);
  const observedRecurrenceIds = new Set(input.m1.recurrences.series.map(({ recurrenceId }) => recurrenceId));
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
    { signalId: "declared-v2:adrien:styling-wax", signalType: "DECLARED", semanticKey: "personal_care.styling_wax.adrien", ...personScope(adrien), action: "AFFIRM", value: "REGULAR_REPURCHASE", kind: "HABIT", family: "PERSONAL_CARE", authority: "USER_VALIDATED", dimension: "USAGE", groupKey: "styling_wax", limitations: ["PRICE_UNAVAILABLE", "CADENCE_UNOBSERVED", "PERSONAL_PAYMENT_NOT_ESTABLISHED"], sourceModule: "DECLARED_V2", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v2:adrien-styling-wax-repurchase"] },
    { signalId: "declared-v2:adrien:hairdresser", signalType: "DECLARED", semanticKey: "personal_care.hairdresser.adrien", ...personScope(adrien), action: "AFFIRM", value: "PERSONAL_ROUTINE", kind: "HABIT", family: "PERSONAL_CARE", authority: "USER_VALIDATED", dimension: "USAGE", groupKey: "hairdresser", limitations: ["HOUSEHOLD_HAIRCUT_COST_NOT_PERSONAL_COST", "ANNUAL_FREQUENCY_NOT_CERTIFIED"], sourceModule: "DECLARED_V2", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v2:adrien-hairdresser-routine"] },
  );
  if (manon !== undefined) declarations.push(
    { signalId: "declared-v1:manon:work-commute", signalType: "DECLARED", semanticKey: "mobility.work.manon", ...personScope(manon), action: "AFFIRM", value: "CAR", kind: "MOBILITY", family: "MOBILITY", authority: "USER_VALIDATED", dimension: "USAGE", context: "WORK_COMMUTE", limitations: ["DISTANCE_UNKNOWN", "FUEL_COST_UNKNOWN", "WORK_COST_SHARE_UNKNOWN"], sourceModule: "DECLARED_V1", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v1:manon-work-car"] },
    { signalId: "declared-v2:manon:suno-father-song", signalType: "DECLARED", semanticKey: "creative.suno_father_song.manon", ...personScope(manon), action: "AFFIRM", value: "ONE_OFF_FATHER_SONG", kind: "PROJECT", family: "LEISURE_AND_ACTIVITIES", authority: "USER_VALIDATED", temporalStatus: "PROJECT", dimension: "USAGE", groupKey: "suno_father_song", entityRef: "recurrence:24cefd44-463b-59fa-b232-376b5404461c", limitations: ["NOVEMBER_2025_SUNO_NOT_LINKED", "PERSONAL_PAYMENT_NOT_ESTABLISHED"], sourceModule: "DECLARED_V2", methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION, evidenceRefs: ["declaration-v2:manon-suno-father-song", "recurrence:24cefd44-463b-59fa-b232-376b5404461c"] },
  );
  for (const service of PERSONAL_USAGE_SERVICE_DECLARATIONS_V1) {
    const personId = peopleByName.get(service.personName);
    if (personId === undefined) continue;
    const recurrenceObserved = observedRecurrenceIds.has(service.recurrenceId);
    declarations.push({
      signalId: service.signalId,
      signalType: "DECLARED",
      semanticKey: service.semanticKey,
      ...personScope(personId),
      action: "AFFIRM",
      value: "PERSONAL_USAGE",
      kind: "HABIT",
      family: "RECURRING_PERSONAL_COSTS",
      authority: "USER_VALIDATED",
      dimension: "USAGE",
      ...(recurrenceObserved ? { entityRef: `recurrence:${service.recurrenceId}` } : {}),
      limitations: recurrenceObserved
        ? ["PERSONAL_PAYMENT_NOT_ESTABLISHED", "PERSONAL_BENEFICIARY_COST_NOT_ESTABLISHED"]
        : ["HOUSEHOLD_SUBSCRIPTION_NOT_OBSERVED", "PERSONAL_PAYMENT_NOT_ESTABLISHED", "PERSONAL_BENEFICIARY_COST_NOT_ESTABLISHED"],
      sourceModule: "DECLARED_V1",
      methodVersion: GLOBAL_PERSONA_DECLARATION_PROVIDER_VERSION,
      evidenceRefs: [
        service.evidenceRef,
        ...(recurrenceObserved ? [`recurrence:${service.recurrenceId}`] : []),
      ].sort(),
    });
  }
  return declarations.sort((a, b) => a.signalId.localeCompare(b.signalId));
}

export function buildGlobalV2PersonaSignals(input: GlobalV2PersonaSignalAdapterInput & { readonly certifiedThrough: LocalDate }): GlobalV2PersonaSignalAdapterResult {
  const declarations = buildGlobalPersonaDeclaredSignalsV1(input);
  const upstreamSignals: PersonaSignal[] = [
    ...adaptGlobalM1PersonalCostSignals({ authorities: input.m1.recurrences.personalCostAuthorities ?? [], authorizedPersonIds: input.personIds }),
    ...adaptGlobalM2NeedSignals({ householdId: input.householdId, authorizedPersonIds: input.personIds, groups: input.m2.result.needs.groups }),
    ...adaptGlobalM4RoutineSignals({ rhythms: input.m4.rhythms, ...(input.m4.routinePatterns === undefined ? {} : { routinePatterns: input.m4.routinePatterns }), authorizedPersonIds: input.personIds }),
    ...adaptGlobalM6MomentSignals({ householdId: input.householdId, personIds: input.personIds, summaries: input.m6.summaries, certifiedThrough: input.certifiedThrough }),
    ...adaptGlobalM7MobilitySignals({ householdId: input.householdId, authorizedPersonIds: input.personIds, authorities: input.mobilityAuthorities ?? [] }),
    ...adaptGlobalM7PlaceReferenceSignals({ authorizedPersonIds: input.personIds, rollups: input.m7.personPlaceRollups ?? [], returnPatterns: input.m7.personPlaceReturnPatterns ?? [] }),
    ...adaptGlobalM8ProductObservationSignals({ observations: input.productObservations ?? [] }),
    ...adaptGlobalM10SharedActivitySignals({ personIds: input.personIds, universes: input.m10.universes }),
    ...adaptGlobalPersonaDifferenceSignals({ householdId: input.householdId, differences: input.differences }),
  ];
  const signals = [...upstreamSignals, ...declarations].sort((a, b) => a.signalId.localeCompare(b.signalId));
  const limitations = unique([
    ...(input.m1.recurrences.personalCostAuthorities?.some(({ attributionState }) => attributionState === "PERSONAL") ? [] : [input.m1.recurrences.series.length > 0 ? "M1_RECURRENCES_LACK_PERSON_BENEFICIARY_BINDING" : "M1_PERSONAL_BENEFICIARY_AUTHORITY_UNAVAILABLE"]),
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
