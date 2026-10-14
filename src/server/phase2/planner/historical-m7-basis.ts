import "server-only";
import { parseMobilityLegFact, type MobilityLegFact } from "@/analytics/facts";
import { GLOBAL_M7_MOBILITY_CONTEXT_METHOD_VERSION, GLOBAL_M7_MOBILITY_CONTEXT_POLICY,
  type GlobalM7MobilityContextAuthority } from "@/analytics/global-v2/mobility-context";
import type { CanonicalDateRange, CanonicalRepository } from "@/server/canonical/repository";
import { resolveGlobalM7MobilityContextAuthority } from "@/server/analytics/global-v2-mobility-context-authority";
import { plannerDigest, plannerKeys, plannerRecord } from "@/domain/phase2/planner/json";
import { activityHistoryScope, decodeActivityHistoryPayload, readDirectActivityHistory,
  type ActivityHistory, type ActivityHistoryScope } from "./activity-history-artifact";
import { completeBasisSourceClient, decodeHistoricalBasisEnvelope, HISTORICAL_BASIS_SHARED_COVERAGE,
  makeHistoricalBasisArtifact, type HistoricalBasisStore } from "./historical-basis";
import { snapshotHistoryTrace, snapshotWork } from "./snapshot-observation";
import { CanonicalRepository as Repository } from "@/server/canonical/repository";

export const HISTORICAL_M7_METHOD = "composer-m7-basis@v1";
export type HistoricalM7Payload = Readonly<{
  simpleOccurrences: ActivityHistory;
  mobilityLegs: readonly MobilityLegFact[];
  mobilityContext: GlobalM7MobilityContextAuthority;
}>;

export function historicalM7Scope(repository: CanonicalRepository, range: CanonicalDateRange): ActivityHistoryScope {
  return activityHistoryScope(repository, range, range.endExclusive, HISTORICAL_M7_METHOD);
}

function checkedPayload(raw: unknown, scope: ActivityHistoryScope): HistoricalM7Payload {
  const value = plannerRecord(raw); plannerKeys(value, ["simpleOccurrences", "mobilityLegs", "mobilityContext"]);
  const simple = decodeActivityHistoryPayload(value.simpleOccurrences, scope);
  if (!Array.isArray(value.mobilityLegs))
    throw new TypeError("M7_BASIS_PAYLOAD_INVALID");
  const people = new Set(scope.personIds), events = new Set<string>(), legs = new Set<string>();
  for (const rawEvent of simple.occurrences) {
    const event = plannerRecord(rawEvent);
    if (event.householdId !== scope.householdId || typeof event.lifeEventId !== "string"
      || events.has(event.lifeEventId) || !Array.isArray(event.participantIds)
      || event.participantIds.some(id => typeof id !== "string" || !people.has(id))) throw new TypeError("M7_BASIS_EVENT_SCOPE_INVALID");
    events.add(event.lifeEventId);
  }
  for (const rawLink of simple.links) {
    const link = plannerRecord(rawLink);
    if (typeof link.lifeEventId !== "string" || !events.has(link.lifeEventId)) throw new TypeError("M7_BASIS_LINK_SCOPE_INVALID");
  }
  for (const rawLeg of value.mobilityLegs) {
    const leg = parseMobilityLegFact(rawLeg);
    if (leg.householdId !== scope.householdId || typeof leg.legId !== "string" || legs.has(leg.legId)
      || typeof leg.date !== "string" || leg.date < scope.start || leg.date >= scope.endExclusive)
      throw new TypeError("M7_BASIS_LEG_SCOPE_INVALID");
    legs.add(leg.legId);
  }
  const context = plannerRecord(value.mobilityContext);
  if (context.methodVersion !== GLOBAL_M7_MOBILITY_CONTEXT_METHOD_VERSION
    || plannerDigest(context.policy) !== plannerDigest(GLOBAL_M7_MOBILITY_CONTEXT_POLICY)
    || context.liveWrites !== "NONE" || !Array.isArray(context.contextLinks)
    || !Array.isArray(context.presenceResolutions) || context.sourceLegCount !== legs.size)
    throw new TypeError("M7_BASIS_CONTEXT_INVALID");
  for (const rawLink of context.contextLinks) {
    const link = plannerRecord(rawLink);
    if (typeof link.mobilityLegId !== "string" || !legs.has(link.mobilityLegId)
      || (link.subjectPersonId !== null && (typeof link.subjectPersonId !== "string" || !people.has(link.subjectPersonId))))
      throw new TypeError("M7_BASIS_CONTEXT_SCOPE_INVALID");
  }
  for (const rawPresence of context.presenceResolutions) {
    const presence = plannerRecord(rawPresence);
    if (typeof presence.mobilityLegId !== "string" || !legs.has(presence.mobilityLegId)
      || typeof presence.subjectPersonId !== "string" || !people.has(presence.subjectPersonId)
      || typeof presence.otherPersonId !== "string" || !people.has(presence.otherPersonId))
      throw new TypeError("M7_BASIS_PRESENCE_SCOPE_INVALID");
  }
  return { simpleOccurrences: simple, mobilityLegs: value.mobilityLegs as readonly MobilityLegFact[],
    mobilityContext: context as GlobalM7MobilityContextAuthority };
}

export function admittedHistoricalM7Basis(scope: ActivityHistoryScope,
  current: Awaited<ReturnType<HistoricalBasisStore["inspect"]>>): HistoricalM7Payload | null {
  if (current.proof?.coverage !== HISTORICAL_BASIS_SHARED_COVERAGE) return null;
  const decoded = decodeHistoricalBasisEnvelope(scope, current);
  return decoded === null ? null : checkedPayload(decoded, scope);
}

export async function inspectHistoricalM7Basis(repository: CanonicalRepository, range: CanonicalDateRange,
  store: HistoricalBasisStore): Promise<HistoricalM7Payload | null> {
  const scope = historicalM7Scope(repository, range), at = performance.now();
  const current = await snapshotWork("HistoricalM7_Admission", () => store.inspect(scope, plannerDigest(scope)));
  const validationMs = performance.now() - at, decodeAt = performance.now();
  const admitted = admittedHistoricalM7Basis(scope, current);
  snapshotHistoryTrace(admitted
    ? { status: "HIT", reason: "SNAP3_M7", validationMs, decodeMs: performance.now() - decodeAt }
    : { status: "MISS", reason: "SNAP3_M7_ABSENT_OR_STALE", validationMs });
  return admitted;
}

export async function directHistoricalM7Basis(repository: CanonicalRepository, range: CanonicalDateRange,
  through: string): Promise<HistoricalM7Payload> {
  const simpleOccurrences = await readDirectActivityHistory(repository, range);
  const [mobilityLegs, mobilityContext] = await Promise.all([
    repository.loadMobilityLegFacts(range),
    resolveGlobalM7MobilityContextAuthority({ repository, certifiedThrough: through,
      activityOccurrences: { range, facts: Promise.resolve(simpleOccurrences.occurrences) } }),
  ]);
  return checkedPayload({ simpleOccurrences, mobilityLegs, mobilityContext }, historicalM7Scope(repository, range));
}

export async function prepareHistoricalM7Basis(repository: CanonicalRepository, range: CanonicalDateRange,
  through: string, store: HistoricalBasisStore) {
  const at = performance.now(), scope = historicalM7Scope(repository, range), key = plannerDigest(scope);
  const before = await store.inspect(scope, key);
  if (before.proof?.coverage !== HISTORICAL_BASIS_SHARED_COVERAGE) throw new TypeError("M7_BASIS_WRITERS_NOT_COVERED");
  const fresh = new Repository(completeBasisSourceClient(repository.client), repository.context, { shareEconomicReads: true });
  const prepared = await directHistoricalM7Basis(fresh, range, through);
  const artifact = makeHistoricalBasisArtifact(scope, before.proof, before.generation + 1, prepared);
  let recovered = false, accepted: boolean;
  try { accepted = await store.publish(scope, key, before.generation, artifact); }
  catch (error) {
    const check = await store.inspect(scope, key);
    if (check.generation !== artifact.generation || plannerRecord(check.artifact).digest !== artifact.digest) throw error;
    accepted = recovered = true;
  }
  if (!accepted) return { status: "STALE_REJECTED", preparationMs: performance.now() - at };
  const current = await store.inspect(scope, key);
  if (!admittedHistoricalM7Basis(scope, current) || plannerRecord(current.artifact).digest !== artifact.digest)
    throw new TypeError("M7_BASIS_COMMIT_RELECTURE_UNCONFIRMED");
  return { status: recovered ? "RECOVERED_COMMIT" : "PUBLISHED", generation: artifact.generation,
    digest: artifact.digest, preparationMs: performance.now() - at, payloadBytes: artifact.payloadBytes,
    transferBytes: Buffer.byteLength(JSON.stringify(artifact)), legs: prepared.mobilityLegs.length,
    events: prepared.simpleOccurrences.occurrences.length, contextLinks: prepared.mobilityContext.contextLinks.length };
}
