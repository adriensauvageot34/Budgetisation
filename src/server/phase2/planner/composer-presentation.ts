import "server-only";
import Big from "big.js";
import type { MonthComposerReadModel, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerPresentation, ComposerObjectPresentation } from "@/domain/phase2/planner/composer-ui-contract";

// Icon identities are presentation aliases, never compatibility or pricing rules.
const iconAliases: Readonly<Record<string, string>> = {
  "tobacco-vape": "tobacco", "adrien-work-meals": "meal", "manon-work-meals": "meal",
  "adrien-work-coffee": "meal", "work-meal-adrien": "meal", "work-meal-manon": "meal",
  hairdresser: "haircut", "adrien-hairdresser": "haircut", "manon-mascara": "beauty",
  "manon-brows": "beauty", "maquillage_manon_mascara": "beauty", "maquillage_manon_sourcils": "beauty",
  "home-small": "home", "games-digital": "ticket", "family-visit": "family", "friend-visit": "family",
  "beauty-restock": "beauty", "home-project": "home", "other-context": "activity", purchase: "clothing",
  train: "tram", bus: "tram", taxi: "car", free: "activity", food: "meal", restaurants: "restaurant",
  products: "beauty", hospitality: "gift", items: "home", services: "activity", components: "activity",
  extras: "meal", purchases: "clothing", children: "activity", activities: "activity", item: "clothing",
};
const icon = (key: string) => iconAliases[key] ?? key;
export function composerAssetIcon(asset: ComposerAssetView, model: MonthComposerReadModel): string {
  if (asset.kind === "CONTEXT_ASSET") return icon(asset.templateKey!);
  if (asset.kind === "SLOT_OPTION_ASSET") {
    const slotKey = asset.assetKey.split(":")[2];
    if (asset.optionKind === "MOBILITY_INTENT") return icon(asset.optionKey!);
    if (slotKey === "main") return asset.templateKey === "night-out" ? "ticket" : "activity";
    return icon(slotKey);
  }
  const slot = model.preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === asset.capabilityRef);
  if (slot?.role === "SAVINGS") return "savings";
  return icon(slot?.baseline.simpleAuthority?.domain ?? slot?.baseline.semanticKey.replace(/^(need|renewal):/u, "") ?? "activity");
}
export function composerPresentation(model: MonthComposerReadModel): ComposerPresentation {
  const controls = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings];
  const roots = model.board.contexts.filter(c => !c.parentContextOccurrenceId);
  const objects: Record<string, ComposerObjectPresentation> = {};
  for (const card of controls) {
    const slot = model.preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === card.targetRef)!;
    const reservation = model.preview.baseline.structuralFacts.savingsReservations.find(r => `savings:${r.reservationId}` === card.targetRef);
    objects[card.targetRef] = {
      iconKey: composerAssetIcon(model.library.searchableAssets.find(a => a.capabilityRef === card.targetRef)!, model),
      variant: card.kind === "SAVINGS" ? "SAVINGS" : slot.baseline.renewalAuthority || slot.baseline.semanticKey.startsWith("need:") || slot.baseline.semanticKey === "hairdresser" ? "SIMPLE" : "HABIT",
      baselineAmount: slot.baseline.baselineValue.amount,
      baselineCount: slot.baseline.baselineValue.count,
      protectedSavings: reservation?.adjustability === "PROTECTED",
      // Display ratio against the original monthly reservation, not a savings goal or balance.
      reservationGauge: card.kind === "SAVINGS" ? { referenceAmount: slot.baseline.baselineValue.amount,
        percent: slot.effectiveAmount !== null && slot.baseline.baselineValue.amount !== null && new Big(slot.baseline.baselineValue.amount).gt(0)
          ? Math.max(0, Math.min(100, Number(new Big(slot.effectiveAmount).div(slot.baseline.baselineValue.amount).times(100).toFixed(1)))) : null } : null,
    };
  }
  for (const card of model.board.contexts) objects[card.contextOccurrenceId] = {
    iconKey: icon(card.templateKey), variant: card.sockets.length > 1 ? "COMPOSITE" : "SIMPLE",
    baselineAmount: null, baselineCount: null, protectedSavings: false, reservationGauge: null,
  };
  const gap = model.board.cockpit.goal.gapToGoal;
  // A sign inversion of C7's signed gap for the label "Marge"; no new calculation.
  const goalMargin = gap === null ? null : Number(gap) === 0 ? gap : gap.startsWith("-") ? gap.slice(1) : `-${gap}`;
  return { elementCount: controls.length + roots.length,
    unresolvedCount: controls.filter(c => !c.value.owned && (c.knowledge === "UNKNOWN" || c.knowledge === "PARTIAL")).length
      + roots.filter(c => c.knowledge === "UNKNOWN" || c.knowledge === "PARTIAL").length,
    goalMargin, objects };
}
