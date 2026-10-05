import "server-only";
import Big from "big.js";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { parsePlannerJsonObject, plannerDigest, plannerKeys, plannerRecord, plannerString } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import type { CompilePlanInputV1, CompiledContext, CompiledSemanticPlanV1, ComponentRequest, SlotBinding } from "@/domain/phase2/planner/compiler-contract";
import type { FundingAllocation } from "../planned-expenses";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { parseKernelCost, resolveComponentCost } from "./cost-resolver";
import { bindPlanSlots, materializePlanSlots, resolveContextualEffects } from "./plan-slot-resolver";
import { evaluatePlanConstraints, KERNEL_CONSTRAINT_POLICY } from "./constraint-engine";
import { buildFinancialAdapterInput, FINANCIAL_ADAPTER_VERSION, financialAdapterForecast } from "./financial-adapter";
import { compare } from "./baseline-evidence";
import { planningBaselineDigest } from "./baseline";

export const PLANNER_COMPILER_VERSION = "planner-semantic-compiler@v1";
/** Typed owner outputs may have optional undefined fields. Persist only their JSON representation. */
export const jsonEnvelope = (value: unknown) => parsePlannerJsonObject(JSON.parse(JSON.stringify(value)));
export function financeAuthorityEvidence(input: CompilePlanInputV1) {
  const forecast = structuredClone(input.world.forecast);
  const { computedAt: _clock, ...meta } = forecast.meta;
  return jsonEnvelope({ forecast: { ...forecast, meta }, monthInputs: input.world.monthInputs, asOfDate: input.world.asOfDate,
    externalIntents: [...input.externalIntents].sort((a, b) => compare(a.id, b.id)), costQuotes: input.world.costQuotes });
}
function binding(raw: unknown): SlotBinding {
  const value = plannerRecord(raw);
  plannerKeys(value, ["slotIdentityKey", "relation", "displacement", "amount", "count"]);
  if (!["CONSUMES_SLOT", "EXTRA_TO_SLOT", "NO_RELATED_SLOT", "UNRESOLVED"].includes(String(value.relation))
    || !["KNOWN", "UNKNOWN"].includes(String(value.displacement))) throw new TypeError("PLANNER_BINDING_INVALID");
  const slotIdentityKey = value.slotIdentityKey === null ? null : plannerString(value.slotIdentityKey);
  if ((value.relation === "CONSUMES_SLOT" || value.relation === "EXTRA_TO_SLOT") && slotIdentityKey === null
    || value.relation === "NO_RELATED_SLOT" && slotIdentityKey !== null) throw new TypeError("PLANNER_BINDING_INVALID");
  const amount = value.amount === null ? null : decisionAmount(value.amount), count = value.count === null ? null : decisionAmount(value.count);
  if (value.relation !== "CONSUMES_SLOT" && (amount !== null || count !== null)) throw new TypeError("PLANNER_BINDING_INVALID");
  return { slotIdentityKey, relation: value.relation as SlotBinding["relation"], displacement: value.displacement as SlotBinding["displacement"], amount, count };
}
function funding(raw: unknown): FundingAllocation[] {
  if (!Array.isArray(raw) || raw.length > 3) throw new TypeError("PLANNER_FUNDING_INVALID");
  const values = raw.map(v => {
    const a = plannerRecord(v); plannerKeys(a, ["source", "amount"]);
    if (!["BANK", "SWILE", "EDENRED"].includes(String(a.source))) throw new TypeError("PLANNER_FUNDING_INVALID");
    // C2 has no eligibility resolver. Wallet allocations need a domain-certified asset in C3+.
    if (a.source !== "BANK") throw new TypeError("PLANNER_WALLET_ELIGIBILITY_UNRESOLVED");
    return { source: "BANK" as const, amount: decisionAmount(a.amount) };
  });
  if (new Set(values.map(a => a.source)).size !== values.length) throw new TypeError("PLANNER_FUNDING_DUPLICATE");
  return values;
}
export function compileSemanticPlan(input: CompilePlanInputV1): CompiledSemanticPlanV1 {
  const state = parsePlanSemanticState(input.semanticState), { world, baseline } = input;
  if (state.targetMonth !== baseline.targetMonth || world.baseline.digest !== baseline.digest
    || baseline.digest !== planningBaselineDigest(baseline) || world.forecast.meta.targetMonth !== baseline.targetMonth)
    throw new TypeError("PLANNER_COMPILER_SCOPE_INVALID");
  const external = [...input.externalIntents].sort((a, b) => compare(a.id, b.id));
  if (new Set(external.map(e => e.id)).size !== external.length || external.some(e => e.householdId !== baseline.householdId || e.targetMonth !== baseline.targetMonth))
    throw new TypeError("PLANNER_EXTERNAL_SCOPE_INVALID");
  if (plannerDigest({ external }) !== plannerDigest({ external: [...world.externalIntents].sort((a, b) => compare(a.id, b.id)) }))
    throw new TypeError("PLANNER_EXTERNAL_AUTHORITY_MISMATCH");
  const slots = materializePlanSlots(baseline, state, input.forcedOwnedSlotKeys), requests: ComponentRequest[] = [], contexts: CompiledContext[] = [];
  const linked = new Set<string>();
  for (const context of state.contexts) {
    if (context.templateKey !== "kernel.generic") throw new TypeError("PLANNER_CONTEXT_TEMPLATE_UNSUPPORTED_C2");
    plannerKeys(plannerRecord(context.fields), ["label", "plannedDate", "externalIntentId"], ["label", "plannedDate"]);
    const label = plannerString(context.fields.label), plannedDate = context.fields.plannedDate === null ? null : plannerString(context.fields.plannedDate);
    if (plannedDate !== null && (!plannedDate.startsWith(`${state.targetMonth}-`) || !/^\d{4}-\d{2}-\d{2}$/u.test(plannedDate)
      || !Number.isFinite(Date.parse(`${plannedDate}T12:00:00Z`)) || new Date(`${plannedDate}T12:00:00Z`).toISOString().slice(0, 10) !== plannedDate))
      throw new TypeError("PLANNER_CONTEXT_DATE_INVALID");
    const externalIntentId = context.fields.externalIntentId === undefined ? null : plannerString(context.fields.externalIntentId);
    if (externalIntentId && (!external.some(e => e.id === externalIntentId) || linked.has(externalIntentId) || Object.keys(context.slotSelections).length))
      throw new TypeError("PLANNER_EXTERNAL_LINK_INVALID");
    if (externalIntentId) linked.add(externalIntentId);
    const ids: string[] = [];
    for (const [role, raw] of Object.entries(context.slotSelections).sort(([a], [b]) => compare(a, b))) {
      plannerString(role);
      const value = plannerRecord(raw); plannerKeys(value, ["quantity", "cost", "binding", "fundingAllocations"]);
      const quantity = decisionAmount(value.quantity);
      if (new Big(quantity).lte(0) || new Big(quantity).gt(9999)) throw new TypeError("PLANNER_QUANTITY_INVALID");
      const id = componentId(context.contextOccurrenceId, role, "single"); ids.push(id);
      requests.push({ componentId: id, ownerRef: context.contextOccurrenceId, contextOccurrenceId: context.contextOccurrenceId,
        externalEntryId: null, externalLineId: null, role, label, quantity, cost: parseKernelCost(value.cost), binding: binding(value.binding),
        fundingAllocations: funding(value.fundingAllocations), plannedDate });
    }
    contexts.push({ contextOccurrenceId: context.contextOccurrenceId, templateKey: context.templateKey, componentIds: ids, externalIntentId });
  }
  // External intents keep their identity. They acquire a binding only when C2 owns their existing
  // financial reference; their DB row and historical facts remain untouched.
  const consumedKeys = new Set(requests.filter(r => r.binding.relation === "CONSUMES_SLOT").map(r => r.binding.slotIdentityKey));
  for (const expense of external) for (const line of expense.costItems) {
    const slot = slots.find(s => s.financeKey === line.baselineKey && (s.owned || consumedKeys.has(s.baseline.slotIdentityKey)));
    if (!slot) continue;
    if (expense.status !== "PLANNED") throw new TypeError("PLANNER_EXTERNAL_REALIZED_RECONCILIATION_REQUIRED");
    requests.push({ componentId: `external:${expense.id}:${line.id}`, ownerRef: expense.id, contextOccurrenceId: null,
      externalEntryId: expense.id, externalLineId: line.id, role: "external", label: line.label, quantity: line.quantity,
      cost: { kind: "MANUAL", unitAmount: line.unitAmount }, plannedDate: expense.plannedDate,
      fundingAllocations: line.fundingAllocations ?? [], binding: { slotIdentityKey: slot.baseline.slotIdentityKey, relation: "CONSUMES_SLOT", displacement: "KNOWN",
        amount: slot.baseline.kind === "AMOUNT" ? plannedLineGross(line) : null, count: slot.baseline.kind === "AMOUNT" ? null : line.quantity } });
  }
  requests.sort((a, b) => Number(b.externalEntryId !== null) - Number(a.externalEntryId !== null) || compare(a.componentId, b.componentId));
  const consumptions = bindPlanSlots(slots, requests);
  const components = requests.map(request => ({ ...request, evaluation: { ...resolveComponentCost(request, world),
    ...(request.externalEntryId ? { provenance: ["CANONICAL_FACT" as const] } : {}) } }));
  const effects = resolveContextualEffects(slots, components, consumptions);
  const constraints = evaluatePlanConstraints(world, slots, components, effects);
  const diagnostics = [...baseline.diagnostics, ...constraints.filter(c => c.severity !== "PASS").map(c => ({
    code: c.code, severity: c.severity as "BLOCK" | "WARN" | "INFO", targetRef: c.targetRef, message: c.code, evidenceRefs: c.evidenceRefs }))];
  const financialAdapterInput = buildFinancialAdapterInput(world, slots, components, consumptions);
  const effectiveForecast = financialAdapterForecast(world, slots);
  const { computedAt: _clock, ...effectiveMeta } = effectiveForecast.meta;
  const manifest = jsonEnvelope({ version: "planner-manifest@v1", compilerVersion: input.compilerVersion,
    modelVersions: { ...baseline.modelVersions, ...world.modelVersions, ...input.modelVersions,
      financialAdapter: FINANCIAL_ADAPTER_VERSION, constraints: KERNEL_CONSTRAINT_POLICY }, baselineDigest: baseline.digest,
    authorityEvidence: financeAuthorityEvidence(input), effectiveForecast: { ...effectiveForecast, meta: effectiveMeta },
    semanticState: state, semanticStateDigest: semanticStateDigest(state), planSlots: slots, contexts, components,
    contextualEffects: effects, constraints, diagnostics, unresolvedReserves: baseline.unresolvedReserves, financialAdapterInput });
  return { version: "compiled-semantic-plan@v1", targetMonth: state.targetMonth, semanticStateDigest: semanticStateDigest(state),
    planSlots: slots, contexts, components, needs: [], mobilityIntents: [], journeys: [], contextualEffects: effects, constraints,
    diagnostics, financialAdapterInput, manifest, manifestDigest: plannerDigest(manifest) };
}
