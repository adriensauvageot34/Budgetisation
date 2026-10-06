import "server-only";
import Big from "big.js";
import type { MonthComposerReadModel, ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerPresentation, ComposerObjectPresentation, ComposerSocketPresentation } from "@/domain/phase2/planner/composer-ui-contract";

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
  const sockets: Record<string, ComposerSocketPresentation> = {};
  for (const card of controls) {
    const slot = model.preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === card.targetRef)!;
    const reservation = model.preview.baseline.structuralFacts.savingsReservations.find(r => `savings:${r.reservationId}` === card.targetRef);
    const links = model.preview.compiled.financialAdapterInput.adapterManifest.baselineConsumptions
      .filter(c => c.planSlotId === slot.baseline.planSlotId && c.count !== null).map(c => ({ componentId: c.componentId, count: c.count }));
    const count = slot.effectiveCount === null ? null : new Big(slot.effectiveCount);
    const linked = links.reduce((sum, link) => sum.plus(link.count!), new Big(0));
    objects[card.targetRef] = {
      iconKey: composerAssetIcon(model.library.searchableAssets.find(a => a.capabilityRef === card.targetRef)!, model),
      variant: card.kind === "SAVINGS" ? "SAVINGS" : slot.baseline.renewalAuthority || slot.baseline.semanticKey.startsWith("need:") || slot.baseline.semanticKey === "hairdresser" ? "SIMPLE" : "HABIT",
      baselineAmount: slot.baseline.baselineValue.amount,
      baselineCount: slot.baseline.baselineValue.count,
      protectedSavings: reservation?.adjustability === "PROTECTED",
      choiceGauge: card.kind !== "SAVINGS" && count === null && slot.baseline.baselineValue.amount !== null ? { referenceAmount: slot.baseline.baselineValue.amount,
        percent: slot.effectiveAmount !== null && new Big(slot.baseline.baselineValue.amount).gt(0)
          ? Math.max(0, Math.min(100, Number(new Big(slot.effectiveAmount).div(slot.baseline.baselineValue.amount).times(100).toFixed(1)))) : null } : null,
      // A bounded visual stack. Consumption links are copied from the certified manifest.
      occurrenceStack: count === null ? null : { bubbles: Array.from({ length: Math.min(3, Math.max(0, Math.ceil(Number(count)))) }, (_, i) =>
        linked.gt(i) ? "LINKED" as const : "AVAILABLE" as const), overflow: count.gt(3) ? count.minus(3).toString() : null, links },
      // Display ratio against the original monthly reservation, not a savings goal or balance.
      reservationGauge: card.kind === "SAVINGS" ? { referenceAmount: slot.baseline.baselineValue.amount,
        percent: slot.effectiveAmount !== null && slot.baseline.baselineValue.amount !== null && new Big(slot.baseline.baselineValue.amount).gt(0)
          ? Math.max(0, Math.min(100, Number(new Big(slot.effectiveAmount).div(slot.baseline.baselineValue.amount).times(100).toFixed(1)))) : null } : null,
    };
  }
  for (const card of model.board.contexts) objects[card.contextOccurrenceId] = {
    iconKey: icon(card.templateKey), variant: card.sockets.length > 1 ? "COMPOSITE" : "SIMPLE",
    baselineAmount: null, baselineCount: null, protectedSavings: false, reservationGauge: null, choiceGauge: null, occurrenceStack: null,
  };
  // Only published DropCapabilities and socket choices admit palette options.
  // Orbit aliases affect display positions, never compatibility or semantic identity.
  const orbitAliases: Record<string, ComposerSocketPresentation["orbit"]> = { before: "NORTH", main: "WEST", outbound: "EAST", transport: "EAST", food: "SOUTH", lodging: "NORTH" };
  const orbits: ComposerSocketPresentation["orbit"][] = ["NORTH", "WEST", "EAST", "SOUTH"];
  for (const card of model.board.contexts) for (const [index, socket] of card.sockets.entries()) {
    const drops = model.dropCapabilities.filter(d => d.target.kind === "CONTEXT_SOCKET" && d.target.contextOccurrenceId === card.contextOccurrenceId
      && d.target.slotKey === socket.slotKey && d.resolution !== "BLOCKED");
    const assets = model.library.searchableAssets.filter(a => socket.choiceAssetKeys?.includes(a.assetKey) && drops.some(d => d.sourceAssetKey === a.assetKey));
    const writable = !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT");
    sockets[`${card.contextOccurrenceId}:${socket.slotKey}`] = { orbit: orbitAliases[socket.slotKey] ?? orbits[index % orbits.length],
      canAdd: writable && assets.length > 0,
      options: assets.map(asset => { const selected = socket.currentItems.find(item => item.kind === "CHILD_CONTEXT"
          ? model.board.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId)?.templateKey === asset.templateKey : item.optionKey === asset.optionKey);
        return { assetKey: asset.assetKey, state: selected ? selected.provenance === "PERSONAL_SUGGESTION" ? "SUGGESTED" : "EQUIPPED"
          : socket.currentItems.length && drops.find(d => d.sourceAssetKey === asset.assetKey)?.choices.includes("REPLACE_ONE_OF") ? "ALTERNATIVE" : "AVAILABLE" }; }),
      satellites: socket.currentItems.map(item => {
        const asset = assets.find(a => a.optionKey === item.optionKey);
        const child = item.kind === "CHILD_CONTEXT" ? model.board.contexts.find(c => c.contextOccurrenceId === item.childContextOccurrenceId) : null;
        const amount = socket.evaluations?.find(e => e.selectionId === item.selectionId)?.economicAmount ?? null;
        const suggested = item.provenance === "PERSONAL_SUGGESTION";
        const derived = card.readOnly || socket.visualState === "DERIVED" || asset?.provenance === "DERIVED_CONSEQUENCE";
        return { selectionId: item.selectionId, label: child?.label ?? (item.kind === "COMPONENT" ? item.label : asset?.label ?? socket.label ?? item.optionKey),
          iconKey: child ? icon(child.templateKey) : asset ? composerAssetIcon(asset, model) : icon(socket.slotKey),
          state: suggested ? "SUGGESTED" : derived ? "DERIVED" : item.kind === "UNRESOLVED" || item.kind === "COMPONENT" && amount === null ? "UNRESOLVED" : "CHOSEN",
          economicAmount: suggested ? null : amount,
          details: suggested ? ["Suggestion personnelle · hors coût tant que non acceptée"] : item.kind === "MOBILITY_INTENT" ? ["Mobilité évaluée par le serveur dans le mois"]
            : item.kind === "COMPONENT" ? [`Quantité : ${item.quantity}`, ...(item.cost.kind === "UNKNOWN" ? ["Montant à préciser"] : [])] : [],
          editableAssetKey: writable && !derived && item.kind !== "CHILD_CONTEXT" && asset ? asset.assetKey : null,
          // Child contexts retain their own TRASH/reparent capability and identity.
          canRemove: writable && !derived && item.kind !== "CHILD_CONTEXT", canAccept: writable && !derived && suggested,
          childContextOccurrenceId: child?.contextOccurrenceId ?? null };
      }) };
  }
  const gap = model.board.cockpit.goal.gapToGoal;
  // A sign inversion of C7's signed gap for the label "Marge"; no new calculation.
  const goalMargin = gap === null ? null : Number(gap) === 0 ? gap : gap.startsWith("-") ? gap.slice(1) : `-${gap}`;
  return { elementCount: controls.length + roots.length,
    unresolvedCount: controls.filter(c => !c.value.owned && (c.knowledge === "UNKNOWN" || c.knowledge === "PARTIAL")).length
      + roots.filter(c => c.knowledge === "UNKNOWN" || c.knowledge === "PARTIAL").length,
    goalMargin, objects, sockets };
}
