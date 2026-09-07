import "server-only";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { buildGlobalMomentExperiences, createGlobalM6DependencyDeclaration, GlobalTemporalBoundaryResolver, type GlobalMomentComponentAuthority, type GlobalMomentInput } from "@/analytics/global-v2";
import { parseActivityCausalFinancialLinks, type EconomicComponentFact } from "@/analytics/facts";
import { projectCanonicalMomentRelations } from "@/analytics/history-v2/shared-doctrines";
import { canonicalSerializeGlobal, parseGlobalAnalysisScopeV2, parseGlobalTimeWindowPolicy, parseGlobalValueProvenance, assertGlobalDependencyClosure, computeGlobalDependencyDeclarationDigest } from "@/core/global-v2";
import { addDays, parseLocalDate } from "@/core/time";
import { compareMoney } from "@/core/money";
import { canonicalString, optionalCanonicalString } from "@/server/canonical/record";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { loadMomentParticipantsByMomentId } from "@/server/query/sources/canonical-relations";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** Read-only Canonical -> Facts -> M6 wiring. It deliberately leaves absent
 * Moment facets absent instead of deriving them from names, Places or costs. */
export async function resolveGlobalM6MomentAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly scope: unknown;
}) {
  const { repository } = input, context = repository.context;
  const scope = parseGlobalAnalysisScopeV2(input.scope, { householdTimeZone: context.timezone, authorizedPersonIds: context.personIds });
  if (scope.time.asOf > context.asOf) throw new TypeError("M6_RUNTIME_ASOF_MISMATCH");
  if (Object.values(scope.filters).some((values) => values.length)) throw new TypeError("M6_FILTER_PROVIDER_NOT_RESOLVED");
  const rows = await repository.loadEntityRows("moments", "moment_id");
  const momentIds = rows.map((row) => canonicalString(row, ["moment_id"], "entities"));
  const links = await repository.loadMomentLifeEventRowsByMomentIds(momentIds);
  const participantsByMoment = await loadMomentParticipantsByMomentId({ repository, context, momentIds });
  const lifeEventIds = [...new Set(links.map((row) => canonicalString(row, ["life_event_id"], "life_events")))].sort();
  const financialLinkRows = await repository.loadActivityCausalFinancialLinkRows(lifeEventIds);
  const financialLinks = parseActivityCausalFinancialLinks(financialLinkRows);
  const momentByLifeEvent = new Map<string, { momentId: string; relationType: string }[]>();
  for (const row of links) {
    const lifeEventId = canonicalString(row, ["life_event_id"], "life_events");
    const values = momentByLifeEvent.get(lifeEventId) ?? [];
    values.push({ momentId: canonicalString(row, ["moment_id"], "life_events"), relationType: canonicalString(row, ["relation_type"], "life_events") });
    momentByLifeEvent.set(lifeEventId, values);
  }
  const normalized: GlobalMomentInput[] = rows.map((row) => {
    const momentId = canonicalString(row, ["moment_id"], "entities");
    const rawType = optionalCanonicalString(row, ["type"]);
    const start = optionalCanonicalString(row, ["start_date", "starts_on"]);
    const end = optionalCanonicalString(row, ["end_date", "ends_on"]);
    const participants = participantsByMoment.get(momentId) ?? [];
    const lifeEvents = links.filter((link) => canonicalString(link, ["moment_id"], "life_events") === momentId).map((link) => canonicalString(link, ["life_event_id"], "life_events"));
    const facet = (keys: readonly string[]) => {
      const value = optionalCanonicalString(row, keys);
      return value === undefined ? undefined : { status: "KNOWN" as const, value, evidenceRefs: [`moment:${momentId}:${keys[0]}`] };
    };
    return {
      momentId, householdId: String(context.householdId),
      type: rawType === undefined ? { status: "UNKNOWN" as const } : { status: "KNOWN" as const, value: rawType, evidenceRefs: [`moment:${momentId}:type`] },
      ...(optionalCanonicalString(row, ["moment_series_id", "series_id"]) === undefined ? {} : { seriesId: optionalCanonicalString(row, ["moment_series_id", "series_id"]) }),
      ...(start === undefined || end === undefined ? {} : { startDate: parseLocalDate(start), endDate: parseLocalDate(end) }),
      temporalPrecision: start === undefined || end === undefined ? "UNKNOWN" as const : "DAY" as const,
      householdParticipantIds: participants.map(({ personId }) => String(personId)), externalParticipantIds: [],
      participationEvidenceRefs: participants.flatMap(({ personId }) => [`moment:${momentId}:participant:${personId}`]),
      facets: {
        ...(facet(["lodging_mode"]) === undefined ? {} : { LODGING_MODE: facet(["lodging_mode"])! }),
        ...(facet(["organizer_role"]) === undefined ? {} : { ORGANIZER_ROLE: facet(["organizer_role"])! }),
        ...(facet(["geographic_scope"]) === undefined ? {} : { GEOGRAPHIC_SCOPE: facet(["geographic_scope"])! }),
      },
      lifeEventIds: [...new Set(lifeEvents)].sort(), activityCount: new Set(lifeEvents).size,
      ...(row.declared_importance === true ? { declaredImportance: { value: true as const, evidenceRefs: [`moment:${momentId}:declared_importance`] } } : {}),
    };
  }).filter((moment) => moment.endDate === undefined || moment.endDate <= scope.time.certifiedThrough)
    .filter((moment) => scope.subject.kind === "household" || moment.householdParticipantIds.includes(String(scope.subject.personId)));

  const sourceProvenance = parseGlobalValueProvenance({
    resultNature: "OBSERVED", precision: "EXACT", integrationMode: "DERIVED_FROM_OBSERVED", monetaryBasis: "AUTHORITATIVE_ECONOMIC",
    sourceRefs: ["canonical:moments", "canonical:moment_life_events", "canonical:life_event_participations"], factRefs: [],
    evidenceRefs: normalized.map((moment) => `moment:${moment.momentId}`).sort(), entityRefs: normalized.map((moment) => moment.momentId), upstreamMetricRefs: [],
    policyVersions: { momentCohort: "v1" }, dataRevision: context.dataRevision, analyticsRevision: context.analyticsRevision,
  });
  const boundary = new GlobalTemporalBoundaryResolver().resolve({
    scope,
    policy: parseGlobalTimeWindowPolicy({ policyId: "global-moment-certified-cohort", policyVersion: "v1", naturalGrain: "MOMENT", corpus: "CERTIFIED_HISTORY", lookback: { kind: "ALL_RELIABLE" }, gapPolicy: "PRESERVE", comparableIntersection: "NOT_REQUIRED" }),
    supportPolicy: { policyRef: "global-moment-peer-support@v1", minimumRequired: 3, strongAt: 8 },
    candidates: normalized.flatMap((moment) => moment.startDate === undefined || moment.endDate === undefined ? [] : [{ unitId: moment.momentId, authority: "CERTIFIED_HISTORY" as const, start: moment.startDate, end: moment.endDate, eligible: true, observed: true, comparable: moment.type.status === "KNOWN", methodExcluded: false, dependencyRefs: [`moment:${moment.momentId}`] }]),
    certifiedProvenance: sourceProvenance,
  });
  const selected = normalized.filter((moment) => boundary.certifiedUnitIds.includes(moment.momentId));
  const first = selected.flatMap((moment) => moment.startDate === undefined ? [] : [moment.startDate]).sort()[0];
  const ranged = first === undefined ? [] : await repository.loadEconomicFacts({ start: first, endExclusive: addDays(scope.time.certifiedThrough, 1) });
  const causal = await repository.loadEconomicFactsByMomentIds(selected.map((moment) => moment.momentId));
  const factByKey = new Map<string, EconomicComponentFact>();
  for (const fact of [...ranged, ...causal]) {
    const key = String(fact.canonicalComponentKey), previous = factByKey.get(key);
    if (previous && canonicalSerializeGlobal(previous) !== canonicalSerializeGlobal(fact)) throw new TypeError("M6_CONTRADICTORY_ECONOMIC_COMPONENT");
    factByKey.set(key, fact);
  }
  // loadEconomicFactsByMomentIds is the exhaustive canonical fact query for the
  // selected Moment set. An empty set is therefore a proved empty causal
  // universe, not missing coverage.
  const selectedWithExpected = selected.map((moment) => ({
    ...moment,
    expectedCausalComponentKeys: causal
      .filter((fact) => fact.moment.kind === "resolved" && String(fact.moment.id) === moment.momentId)
      .map((fact) => String(fact.canonicalComponentKey))
      .sort(),
  }));
  const componentAuthorities: GlobalMomentComponentAuthority[] = [];
  const authorityByIdentity = new Map<string, GlobalMomentComponentAuthority>();
  for (const link of financialLinks) for (const membership of momentByLifeEvent.get(String(link.lifeEventId)) ?? []) {
    const key = String(link.canonicalComponentKey), fact = factByKey.get(key);
    if (fact?.moment.kind !== "resolved" || String(fact.moment.id) !== membership.momentId || link.economicAmountLinked === null || compareMoney(link.economicAmountLinked, fact.net) !== 0) continue;
    const causalRole = membership.relationType === "Préparation" || link.relationType === "Preparation" ? "PREPARATION" as const : "CORE_EXPERIENCE" as const;
    const authority = { componentKey: key, momentId: membership.momentId, causalRole, ...(causalRole === "PREPARATION" ? { compositionGroup: "PREPARATION" as const } : {}), ...(fact.bankDate.kind === "known" ? { paymentDate: fact.bankDate.date } : {}), evidenceRefs: [`financial-link:${link.financialLinkId}`, `moment-life-event:${membership.momentId}:${link.lifeEventId}`] };
    const identity = `${membership.momentId}:${key}`, previous = authorityByIdentity.get(identity);
    if (previous && previous.causalRole !== authority.causalRole) throw new TypeError("M6_CONFLICTING_CAUSAL_ROLE_AUTHORITY");
    authorityByIdentity.set(identity, authority);
  }
  componentAuthorities.push(...authorityByIdentity.values());
  const dependencyDigests: Record<string, string> = {};
  const register = (ref: string, value: unknown) => { dependencyDigests[ref] = digest(value); };
  for (const moment of selectedWithExpected) {
    register(`moment:${moment.momentId}`, moment);
    if (moment.type.status === "KNOWN") register(`moment:${moment.momentId}:type`, moment.type.value);
    for (const ref of moment.participationEvidenceRefs) register(ref, ref);
    for (const facet of Object.values(moment.facets ?? {})) for (const ref of facet?.evidenceRefs ?? []) register(ref, ref);
    for (const proof of [moment.declaredImportance, moment.transformationAnchor, moment.routineRepresentative]) for (const ref of proof?.evidenceRefs ?? []) register(ref, ref);
  }
  for (const fact of factByKey.values()) register(`economic-component:${fact.canonicalComponentKey}`, fact);
  for (const authority of componentAuthorities) for (const ref of authority.evidenceRefs) register(ref, ref);
  const financialRelations = projectCanonicalMomentRelations([...factByKey.values()]);
  for (const relation of financialRelations) if (relation.kind !== "UNDEFINED") for (const ref of relation.evidenceRefs) register(ref, ref);
  const result = buildGlobalMomentExperiences({ householdId: String(context.householdId), householdMemberIds: context.personIds.map(String), moments: selectedWithExpected, economicFacts: [...factByKey.values()], financialRelations, componentAuthorities, dependencyDigests });
  const personScope = scope.subject.kind === "household" ? { kind: "HOUSEHOLD" as const } : { kind: "PERSON" as const, personId: scope.subject.personId };
  const declaration = createGlobalM6DependencyDeclaration({ personScope, authorizedPersonIds: context.personIds, momentIds: selectedWithExpected.map((moment) => moment.momentId) });
  const consumption = { factDependencyIds: ["fct_economic_component"], entityDependencyIds: ["moments", "moment_life_events", "life_event_participations"], upstreamAnalyticsIds: ["history_shared_doctrines"], otherModuleDependencyIds: ["GlobalTemporalBoundaryResolver", "GlobalMaterialityEngine"], policyIds: ["global-moment-certified-cohort", "global-moment-peer-support", "global-moment-metadata-participant-financial", "global-materiality-moment-family", "comparisonCatalog", "peerSupport", "causalCost", "spentDuring", "paymentTimeline", "momentComposition", "narrativeImportance", "robustStatistics"] };
  assertGlobalDependencyClosure(declaration, consumption);
  return { ...result, boundary, dependencyDeclaration: declaration, sourceHash: digest(Object.entries(dependencyDigests).sort(([a], [b]) => a.localeCompare(b))), executionHash: digest({ inputHash: result.inputHash, boundary: boundary.resolutionHash, declaration: computeGlobalDependencyDeclarationDigest(declaration) }), providerStatus: { canonicalMoments: "CONNECTED", causalEconomics: "CONNECTED", momentPlaceFacets: selectedWithExpected.some((moment) => Object.values(moment.facets ?? {}).some((facet) => facet?.status === "KNOWN")) ? "PARTIAL" : "AUTHORITY_GATED" }, liveWrites: "NONE" as const };
}
