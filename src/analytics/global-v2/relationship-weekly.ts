import { parseLocalDate } from "../../core/time";
import { canonicalSerializeGlobal, parseGlobalMaterialityCandidate, type GlobalMaterialityCandidate } from "../../core/global-v2";
import { GlobalMaterialityEngine } from "./materiality";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { relationshipDetrend, relationshipRandom, relationshipSpearman, relationshipStatisticsPolicy } from "./relationship-statistics";

export const weeklyRelationshipCatalog = Object.freeze([
  { id: "weekly-onsite-transport", exposure: "ONSITE_DAYS", outcome: "TRANSPORT_COST", provider: "P08_MOBILITY", minimumWeeks: 16 },
  { id: "weekly-remote-restaurants", exposure: "REMOTE_DAYS", outcome: "RESTAURANT_COUNT", provider: "BC_CORE", minimumWeeks: 16 },
] as const);

export const relationshipWeeklyPolicy = Object.freeze({ version: "relationship-weekly-spearman-residual-permutation@v1", detrend: "OLS_LINEAR_TIME_RESIDUALS", minimumWeeks: 16, permutations: relationshipStatisticsPolicy.permutations });

export type RelationshipWeek = {
  readonly id: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly start: string;
  readonly end: string;
  readonly complete: boolean;
  readonly exposure: number;
  readonly outcome: number;
  readonly evidenceRefs: readonly string[];
};

export type RelationshipWeeklyMaterialityProof = {
  /** Companion effect in observable monthly occurrence units, from M4.
   * A Spearman coefficient is dimensionless and is never used as this effect.
   */
  readonly current: GlobalMaterialityCandidate;
  readonly corpusHash: string;
  readonly withdrawals: readonly { readonly month: string; readonly corpusHash: string; readonly candidate: GlobalMaterialityCandidate }[];
};

/** Binds a companion monthly effect to the exact observed weekly corpus. It is
 * not an effect estimator and cannot turn rho into an occurrence difference.
 */
export function relationshipWeeklyCorpusHash(weeks: readonly RelationshipWeek[]) {
  const byId = new Map<string, RelationshipWeek>();
  for (const week of weeks) {
    const normalized = { ...week, evidenceRefs: [...new Set(week.evidenceRefs)].sort() };
    const prior = byId.get(week.id);
    if (prior && canonicalSerializeGlobal(prior) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M5_CONTRADICTORY_WEEK");
    byId.set(week.id, normalized);
  }
  return bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal([...byId.values()].sort((a, b) => a.id.localeCompare(b.id))))));
}

export function normalizeRelationshipWeeklyMaterialityProof(proof: RelationshipWeeklyMaterialityProof) {
  canonicalSerializeGlobal(proof);
  return { corpusHash: proof.corpusHash, current: parseGlobalMaterialityCandidate(proof.current), withdrawals: proof.withdrawals.map((entry) => ({ ...entry, candidate: parseGlobalMaterialityCandidate(entry.candidate) })).sort((a, b) => a.month.localeCompare(b.month)) };
}

export function prepareWeeklyRelationship(input: Parameters<typeof testWeeklyRelationship>[0] & {
  readonly materialityProof?: RelationshipWeeklyMaterialityProof;
}) {
  const current = testWeeklyRelationship(input);
  const applicable = [...new Map(input.weeks.filter((week) => week.end <= input.through && week.complete && week.personId === input.personId && week.regimeId === input.regimeId && week.evidenceRefs.length > 0).map((week) => [week.id, week])).values()];
  const months = [...new Set(applicable.flatMap((week) => [week.start.slice(0, 7), week.end.slice(0, 7)]))].sort();
  const evaluate = (candidate: GlobalMaterialityCandidate | undefined) => {
    if (!candidate) return { status: "UNKNOWN" as const, reasonCode: "AUTHORITY_GATED_WEEKLY_MONTHLY_EFFECT" };
    if (current.definition.outcome !== "RESTAURANT_COUNT") throw new TypeError("M5_SPECIALIZED_WEEKLY_MATERIALITY_PROVIDER_PENDING");
    const parsed = parseGlobalMaterialityCandidate(candidate);
    if (parsed.metricRef !== current.definition.outcome || parsed.support.naturalGrain !== "MONTH" || !parsed.evidenceRefs.length) throw new TypeError("M5_WEEKLY_MATERIALITY_GRAIN_AUTHORITY");
    return new GlobalMaterialityEngine().evaluate({ policyId: "ACTIVITY_FREQUENCY", candidate: parsed });
  };
  if (input.materialityProof && new Set(input.materialityProof.withdrawals.map((entry) => entry.month)).size !== input.materialityProof.withdrawals.length) throw new TypeError("M5_DUPLICATE_WEEKLY_WITHDRAWAL_PROOF");
  if (input.materialityProof) {
    if (input.materialityProof.corpusHash !== relationshipWeeklyCorpusHash(applicable)) throw new TypeError("M5_WEEKLY_MATERIALITY_CORPUS_MISMATCH");
    for (const entry of input.materialityProof.withdrawals) {
      if (!months.includes(entry.month) || entry.corpusHash !== relationshipWeeklyCorpusHash(applicable.filter((week) => !week.start.startsWith(entry.month) && !week.end.startsWith(entry.month)))) throw new TypeError("M5_WEEKLY_WITHDRAWAL_CORPUS_MISMATCH");
    }
  }
  const materiality = evaluate(input.materialityProof?.current);
  const evaluateTemporal = () => {
  const trials = months.map((month) => {
    const remaining = applicable.filter((week) => !week.start.startsWith(month) && !week.end.startsWith(month));
    const trial = testWeeklyRelationship({ ...input, weeks: remaining });
    const withdrawalMateriality = evaluate(input.materialityProof?.withdrawals.find((entry) => entry.month === month)?.candidate);
    const direction = "effect" in trial && trial.effect !== undefined ? Math.sign(trial.effect) : 0;
    const sameDirection = "effect" in current && current.effect !== undefined && direction !== 0 && direction === Math.sign(current.effect);
    const opposition = "effect" in current && current.effect !== undefined && direction !== 0 && direction !== Math.sign(current.effect);
    return { month, supportPassed: trial.eligibleWeeks >= current.definition.minimumWeeks, effect: "effect" in trial ? trial.effect ?? null : null, sameDirection, materialOpposition: opposition && withdrawalMateriality.status === "MATERIAL", oppositionUnresolved: opposition && withdrawalMateriality.status === "UNKNOWN", materiality: withdrawalMateriality };
  });
  const sufficient = trials.length >= 2 && trials.every((trial) => trial.supportPassed);
  const sameDirectionCount = trials.filter((trial) => trial.sameDirection).length;
  const dominantMonth = trials.some((trial) => trial.effect === 0 || trial.effect === null);
  const robust = sufficient && !dominantMonth && sameDirectionCount / trials.length >= .8 && !trials.some((trial) => trial.materialOpposition || trial.oppositionUnresolved);
  return { trials, sufficient, sameDirectionCount, trialCount: trials.length, dominantMonth, robust };
  };
  return { ...current, materiality, evaluateTemporal, materialityProofStatus: input.materialityProof ? "SUPPLIED" : "AUTHORITY_GATED" };
}

/** Standalone diagnostic convenience; production calls evaluateTemporal only
 * after closing the common FDR universe.
 */
export function buildWeeklyRelationshipRobustness(input: Parameters<typeof prepareWeeklyRelationship>[0]) {
  const { evaluateTemporal, ...prepared } = prepareWeeklyRelationship(input);
  return { ...prepared, temporal: evaluateTemporal() };
}

/** Returns a raw test, never a local FDR correction or publication decision.
 * Permutations act on residual rank pairings, not on calendar/matching authority.
 */
export function testWeeklyRelationship(input: {
  readonly definitionId: string;
  readonly personId: string;
  readonly regimeId: string;
  readonly through: string;
  readonly seed: number;
  readonly weeks: readonly RelationshipWeek[];
}) {
  canonicalSerializeGlobal(input);
  parseLocalDate(input.through);
  const definition = weeklyRelationshipCatalog.find((entry) => entry.id === input.definitionId);
  if (!definition) throw new TypeError("M5_UNCATALOGUED_WEEKLY_RELATION");
  const byId = new Map<string, RelationshipWeek>();
  for (const week of input.weeks) {
    parseLocalDate(week.start); parseLocalDate(week.end);
    if (week.end > input.through) continue;
    if (week.start > week.end || ![week.exposure, week.outcome].every(Number.isFinite)) throw new TypeError("M5_INVALID_WEEK");
    if (Date.parse(`${week.end}T00:00:00Z`) - Date.parse(`${week.start}T00:00:00Z`) !== 6 * 86400000) throw new TypeError("M5_SEVEN_DAY_WEEK_REQUIRED");
    const normalized = { ...week, evidenceRefs: [...new Set(week.evidenceRefs)].sort() };
    const prior = byId.get(week.id);
    if (prior && canonicalSerializeGlobal(prior) !== canonicalSerializeGlobal(normalized)) throw new TypeError("M5_CONTRADICTORY_WEEK");
    byId.set(week.id, normalized);
  }
  const weeks = [...byId.values()].filter((week) => week.personId === input.personId && week.regimeId === input.regimeId && week.complete && week.evidenceRefs.length > 0).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  if (weeks.some((week, index) => index > 0 && week.start <= weeks[index - 1].end)) throw new TypeError("M5_OVERLAPPING_WEEKS");
  const base = { definition, eligibleWeeks: weeks.length, methodVersion: "global_relationship_weekly@v1", policy: relationshipWeeklyPolicy, seed: input.seed, evidenceRefs: [...new Set(weeks.flatMap((week) => week.evidenceRefs))].sort() };
  if (weeks.length < definition.minimumWeeks) return { ...base, status: "UNKNOWN" as const, reasonCode: "INSUFFICIENT_WEEKLY_SUPPORT" };
  const time = weeks.map((week) => Date.parse(`${week.start}T00:00:00Z`) / 86400000);
  const x = relationshipDetrend(time, weeks.map((week) => week.exposure));
  const y = relationshipDetrend(time, weeks.map((week) => week.outcome));
  const effect = relationshipSpearman(x, y);
  if (effect === null) return { ...base, status: "UNKNOWN" as const, reasonCode: "NO_RESIDUAL_VARIATION" };
  const random = relationshipRandom(input.seed);
  let extreme = 0;
  for (let iteration = 0; iteration < relationshipStatisticsPolicy.permutations; iteration++) {
    const shuffled = [...y];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const permuted = relationshipSpearman(x, shuffled)!;
    if (Math.abs(permuted) >= Math.abs(effect)) extreme++;
  }
  return { ...base, status: "KNOWN" as const, effect, pValue: (extreme + 1) / (relationshipStatisticsPolicy.permutations + 1), permutations: relationshipStatisticsPolicy.permutations, requiredNextStage: "COMMON_SCOPE_REVISION_FDR" as const };
}
