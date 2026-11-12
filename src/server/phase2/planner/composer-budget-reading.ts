import "server-only";
import Big from "big.js";
import { costItemCashTreatment } from "@/domain/phase2/planned-money";
import type { ComposerBudgetReading, ComposerIntentImpact, MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import type { ContextualEffect } from "@/domain/phase2/planner/component-contract";
import type { CompiledComponent, CompiledPlanSlot } from "@/domain/phase2/planner/compiler-contract";
import { isPurchaseBasket } from "@/domain/phase2/planner/purchase-basket";
import type { MonthForecastSnapshot } from "../month-forecast-snapshot";

const sum = (values: readonly string[]) => values.reduce((total, value) => total.plus(value), new Big(0)).toFixed(2);
const completeSum = (values: readonly (string | null)[]) =>
  values.length && values.every(value => value !== null) ? sum(values) : null;
const slotDomain = (slot: CompiledPlanSlot) => slot.baseline.simpleAuthority?.domain ?? slot.baseline.semanticKey;

function groceriesCoverage(slots: readonly CompiledPlanSlot[], effects: readonly ContextualEffect[], mode: unknown): ComposerIntentImpact["groceriesCoverage"] {
  const envelopes = slots.filter(slot => slot.role === "BEHAVIOR" && slot.baseline.kind === "AMOUNT" && slotDomain(slot) === "groceries");
  if (!envelopes.length) return "ABSENT";
  if (envelopes.length !== 1) return "UNRESOLVED";
  const [envelope] = envelopes;
  if (envelope.effectiveAmount === null && envelope.baseline.inclusion === "UNRESOLVED_RESERVE" && !envelope.decisionId) return "ABSENT";
  if (mode !== "CONFIRMED_CONSUMPTION" && mode !== "EXTRA_TO_SLOT") return "CONFIRM";
  if (!effects.length) return "UNRESOLVED";
  if (effects.every(effect => effect.slotRelation === "EXTRA_TO_SLOT")) return "EXTRA";
  if (!effects.every(effect => effect.slotRelation === "CONSUMES_SLOT")) return "UNRESOLVED";
  const additional = completeSum(effects.map(effect => effect.incrementalAmount));
  const displaced = completeSum(effects.map(effect => effect.displacedAmount));
  if (additional === null || displaced === null) return "UNRESOLVED";
  if (new Big(additional).eq(0)) return "COVERED";
  return new Big(displaced).eq(0) ? "EXHAUSTED" : "PARTIAL";
}

/** Totals of already evaluated rows for display. This view never changes a Preview or its proof. */
export function composerBudgetReading({ preview, board }: Pick<MonthComposerReadModel, "preview" | "board">, income: MonthForecastSnapshot["income"]): ComposerBudgetReading {
  const { compiled } = preview;
  const effectsById = new Map(compiled.contextualEffects.map(effect => [effect.componentId, effect]));
  const cardsById = new Map(board.contexts.map(card => [card.contextOccurrenceId, card]));
  const slotsById = new Map(compiled.planSlots.map(slot => [slot.baseline.planSlotId, slot]));
  const postsById = new Map([...board.baselineControls, ...board.discretionaryControls].map(card => [card.cardId, card.label]));
  const componentsByContext = new Map<string, CompiledComponent[]>();
  for (const component of compiled.components) {
    if (component.contextOccurrenceId === null) continue;
    const components = componentsByContext.get(component.contextOccurrenceId);
    if (components) components.push(component);
    else componentsByContext.set(component.contextOccurrenceId, [component]);
  }
  const byContext: Record<string, ComposerIntentImpact> = {};

  for (const context of compiled.contexts) {
    const card = cardsById.get(context.contextOccurrenceId);
    if (!card || card.readOnly || context.status === "SUGGESTED") continue;
    const groceries = isPurchaseBasket(card) && card.fields.budgetDomain === "groceries";
    const components = componentsByContext.get(context.contextOccurrenceId) ?? [];
    const effects = components.flatMap(component => {
      const effect = effectsById.get(component.componentId);
      return effect ? [effect] : [];
    });
    const amounts = effects.flatMap(effect => effect.grossAmount === null ? [] : [effect.grossAmount]);
    const complete = components.length > 0 && components.length === amounts.length
      && !context.componentSlots?.some(slot => slot.contributes && slot.state === "UNRESOLVED");
    const posts = effects.flatMap(effect => {
      if (effect.slotRelation !== "CONSUMES_SLOT" || effect.displacedAmount === null || !effect.baselinePlanSlotId) return [];
      const slot = slotsById.get(effect.baselinePlanSlotId);
      const label = slot && slotDomain(slot) === "groceries" ? "Enveloppe Courses" : postsById.get(effect.baselinePlanSlotId);
      return label ? [label] : [];
    });
    const declaredFundingSources = components.flatMap(component =>
      component.evaluation.economicAmount === null || costItemCashTreatment({ assetKey: component.assetKey ?? null }) === "ECONOMIC_ONLY"
        ? [] : component.fundingAllocations.filter(allocation => new Big(allocation.amount).gt(0)).map(allocation => allocation.source));
    const groceryEffects = components.flatMap(component => {
      if (component.role !== "item" && component.role !== "shipping") return [];
      const effect = effectsById.get(component.componentId);
      return effect ? [effect] : [];
    });
    const knownSubtotal = amounts.length ? sum(amounts) : null;
    byContext[context.contextOccurrenceId] = {
      gross: complete ? knownSubtotal : null,
      knownSubtotal,
      displaced: complete ? completeSum(effects.map(effect => effect.displacedAmount)) : null,
      incremental: complete ? completeSum(effects.map(effect => effect.incrementalAmount)) : null,
      groceriesCoverage: groceries ? groceriesCoverage(compiled.planSlots, groceryEffects, card.fields.basketCoverage) : null,
      plannedPosts: [...new Set(posts)],
      declaredFundingSources: [...new Set(declaredFundingSources)],
      hasChildren: !!context.childContextIds?.length,
    };
  }

  const declared = preview.scenario.inputs.declaredResources;
  const missingMonthlyDeclarations = ([
    ["benefit:swile", "Swile"], ["benefit:edenred", "Edenred"],
  ] as const).flatMap(([key, label]) => declared[key] === undefined ? [label] : []);
  const missingSalaryForecasts = ([
    ["income:Digital Learning Contest", "Salaire Adrien"], ["income:Promotrans", "Salaire Manon"],
  ] as const).flatMap(([key, label]) => {
    const source = income.components.find(part => part.key === key);
    return source?.central == null ? [source?.label ?? label] : [];
  });
  return { semanticStateDigest: preview.semanticStateDigest, byContext, missingMonthlyDeclarations, missingSalaryForecasts };
}
