import "server-only";
import { createHash } from "node:crypto";
import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalSerializeGlobal } from "@/core/global-v2";
import type { MonthEconomicPlan, MonthInputs } from "./month-scenario";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import { matchesForecastCategory, type ForecastCalibration, type MonthPredictionEvidence } from "./remaining-month-forecast";
import { referenceMobilityDays, referenceQuantile } from "./month-reference";
import { FORECAST_MODEL_VERSION, FORECAST_POLICY, forecastHorizon } from "./forecast-statistics";

type CheckpointPayload = Readonly<{
  categories: readonly { key: string; label: string; projected: { low: string; central: string; high: string } }[];
  components: Readonly<Record<string, { label: string; amount: string }>>;
  final: MonthEconomicPlan["narrative"]["final"];
  provenance: { publicationId: string; sourceRevision: number; hasUserAssumptions: boolean; evidenceDigest: string };
}>;
export type ForecastCheckpoint = Readonly<{ checkpoint_id: string; target_month: string; as_of_date: string;
  computed_at: string; model_version: string; input_digest: string; payload: CheckpointPayload }>;
const digest = (value: unknown) => createHash("sha256").update(canonicalSerializeGlobal(value)).digest("hex");

/** Signed terms of the existing economic plan, not another financial engine. */
export function forecastComponents(plan: MonthEconomicPlan): CheckpointPayload["components"] {
  const prediction = plan.narrative.prediction;
  const terms: Record<string, { label: string; amount: string }> = {};
  for (const resource of plan.resources) terms[resource.key] = { label: resource.label, amount: resource.amount };
  for (const item of plan.certainOutflows.items) terms[item.key] = { label: item.label, amount: new Big(item.amount).neg().toFixed(2) };
  if (prediction) {
    for (const category of [...prediction.essential, ...prediction.optional]) terms[category.key] = {
      label: category.label, amount: new Big(category.projectedMonth.central).neg().toFixed(2),
    };
    const habitual = [...prediction.essential, ...prediction.optional].reduce((sum, c) => sum.plus(c.habitualProjectGross), new Big(0));
    terms.projects = { label: "Projets en plus", amount: new Big(plan.plannedExpenses.grossCost).minus(habitual).neg().toFixed(2) };
  } else terms.variables = { label: "Quotidien et projets", amount: new Big(plan.afterCertainOutflows).minus(plan.narrative.final.central).neg().toFixed(2) };
  const sum = Object.values(terms).reduce((total, part) => total.plus(part.amount), new Big(0));
  if (!sum.eq(plan.narrative.final.central)) throw new TypeError("FORECAST_COMPONENT_RECONCILIATION_FAILED");
  return terms;
}

export function makeForecastCheckpoint(forecast: MonthForecastSnapshot, inputs: MonthInputs,
  plan: MonthEconomicPlan, asOf: string): { inputDigest: string; payload: CheckpointPayload } {
  const evidenceDigest = digest(forecast.predictionEvidence ?? null);
  const payload: CheckpointPayload = {
    categories: [...(plan.narrative.prediction?.essential ?? []), ...(plan.narrative.prediction?.optional ?? [])]
      .map(c => ({ key: c.key, label: c.label, projected: c.projectedMonth })),
    components: forecastComponents(plan), final: plan.narrative.final,
    provenance: { publicationId: forecast.meta.sourcePublicationId, sourceRevision: forecast.meta.sourceRevision,
      hasUserAssumptions: Object.keys(inputs.decision?.assumptions ?? {}).length > 0, evidenceDigest },
  };
  return { payload, inputDigest: digest({ inputs, payload, asOf, version: FORECAST_MODEL_VERSION }) };
}

/** Caller supplies an authenticated household. Read is always scoped, even with the server client. */
export async function readForecastMemory(client: SupabaseClient, householdId: string, throughMonth: string): Promise<readonly ForecastCheckpoint[]> {
  const first = new Date(`${throughMonth}-01T12:00:00Z`); first.setUTCMonth(first.getUTCMonth() - 12);
  const rows: ForecastCheckpoint[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client.from("phase2_forecast_checkpoints")
      .select("checkpoint_id,target_month,as_of_date,computed_at,model_version,input_digest,payload")
      .eq("household_id", householdId).gte("target_month", first.toISOString().slice(0, 10))
      .lte("target_month", `${throughMonth}-01`).order("computed_at").order("checkpoint_id").range(offset, offset + 499);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []) as ForecastCheckpoint[]);
    if ((result.data?.length ?? 0) < 500) break;
  }
  return rows;
}

/** Immutable INSERT only. A repeated request is a successful no-op, never an upsert. */
export async function insertForecastCheckpoint(client: SupabaseClient, householdId: string, userId: string,
  targetMonth: string, asOf: string, checkpoint: ReturnType<typeof makeForecastCheckpoint>): Promise<void> {
  const result = await client.from("phase2_forecast_checkpoints").insert({ household_id: householdId,
    created_by: userId, target_month: `${targetMonth}-01`, as_of_date: asOf, model_version: FORECAST_MODEL_VERSION,
    input_digest: checkpoint.inputDigest, payload: checkpoint.payload });
  if (result.error && result.error.code !== "23505") throw result.error;
}

/** Errors exist only for preserved predictions followed by explicitly FULL imports.
 * One month contributes at most once at each horizon. Intent overrides never train history. */
export function calibrateForecast(memory: readonly ForecastCheckpoint[], evidence: MonthPredictionEvidence, asOf: string): ForecastCalibration {
  const samples = new Map<string, Map<string, number>>();
  for (const row of [...memory].sort((a, b) => a.computed_at.localeCompare(b.computed_at) || a.checkpoint_id.localeCompare(b.checkpoint_id))) {
    const month = row.target_month.slice(0, 7);
    if (row.model_version !== FORECAST_MODEL_VERSION || month >= asOf.slice(0, 7)
      || !evidence.completeMonths?.includes(month) || row.payload.provenance.hasUserAssumptions
      || row.as_of_date.slice(0, 7) > month) continue;
    const horizon = forecastHorizon(row.as_of_date, month);
    for (const category of row.payload.categories) {
      const actual = category.key === "manon-work-mobility"
        ? referenceMobilityDays(evidence.history.mobilityLegs.filter(l => l.date.startsWith(month))).reduce((n, d) => n + d.commute + (d.detour ?? 0), 0)
        : evidence.history.economicEntries.filter(r => r.date.startsWith(month) && matchesForecastCategory(category.key, r)).reduce((n, r) => n + Number(r.amount), 0);
      const key = `${category.key}:${horizon}`, bucket = samples.get(key) ?? new Map<string, number>();
      if (!bucket.has(month)) bucket.set(month, actual - Number(category.projected.central));
      samples.set(key, bucket);
    }
  }
  return Object.fromEntries([...samples].map(([key, bucket]) => {
    const errors = [...bucket.values()], bias = referenceQuantile(errors, .5);
    return [key, { bias: new Big(bias).toFixed(2), absoluteError: new Big(referenceQuantile(errors.map(e => Math.abs(e - bias)), .75)).toFixed(2),
      count: errors.length, horizon: key.split(":").at(-1)! }];
  }).filter(([, value]) => (value as { count: number }).count >= FORECAST_POLICY.calibrationMonths)) as ForecastCalibration;
}

export function comparableForecastCheckpoints(memory: readonly ForecastCheckpoint[], targetMonth: string) {
  return memory.filter(row => row.target_month.startsWith(targetMonth) && row.model_version === FORECAST_MODEL_VERSION);
}

export function explainForecastChange(plan: MonthEconomicPlan, memory: readonly ForecastCheckpoint[], targetMonth: string) {
  const rows = comparableForecastCheckpoints(memory, targetMonth);
  const previous = rows.at(-1);
  if (!previous) return { changes: [], delta: "0.00", stability: "Pas encore d’estimation conservée pour comparer.", sampleCount: 0 };
  const current = forecastComponents(plan), keys = new Set([...Object.keys(previous.payload.components), ...Object.keys(current)]);
  const changes = [...keys].map(key => ({ key, label: current[key]?.label ?? previous.payload.components[key]!.label,
    delta: new Big(current[key]?.amount ?? 0).minus(previous.payload.components[key]?.amount ?? 0).toFixed(2) })).filter(c => c.delta !== "0.00");
  const delta = new Big(plan.narrative.final.central).minus(previous.payload.final.central).toFixed(2);
  if (!changes.reduce((sum, c) => sum.plus(c.delta), new Big(0)).eq(delta)) throw new TypeError("FORECAST_CHANGE_RECONCILIATION_FAILED");
  const byDay = new Map(rows.map(r => [r.as_of_date, r]));
  const distinct = [...byDay.values()].sort((a,b) => a.as_of_date.localeCompare(b.as_of_date)).slice(-3);
  const stable = distinct.length >= 3 && distinct.every(r => new Big(r.payload.final.central).minus(plan.narrative.final.central).abs().lte(10));
  return { changes, delta, sampleCount: rows.length, stability: stable ? "Les trois dernières estimations conservées sur des jours distincts varient de moins de 10 €."
    : distinct.length < 3 ? "Il faut des estimations conservées sur au moins trois jours pour juger la stabilité." : "La projection a évolué ; les écarts ci-dessous expliquent sa révision." };
}
