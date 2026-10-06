import "server-only";
import type { ComposerEditor, ComposerField, ComposerRequest, ComposerResponse, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import { plannerMonth, plannerUuid } from "@/domain/phase2/planner/json";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import type { PlannerDependencies } from "./apply";
import { applyPlanScenario } from "./apply";
import { composerNeedLabel, readMonthComposer, resolveComposerDrop } from "./read-model";
import { publishContextRegistry, resolveContextTemplate } from "./context-registry";
import { mutatePlanSemanticState } from "./semantic-mutations";
import { acceptPlanBalanceSuggestion, readPlanBalanceSuggestions } from "./balance-assistant";
import { parseMobilityPricing } from "./mobility-selections";

const field = (key: string, label: string, kind: ComposerField["kind"] = "TEXT", required = false): ComposerField => ({ key, label, kind, required });
const choice = (key: string, label: string, choices: readonly (readonly [string, string])[]): ComposerField => ({ ...field(key, label, "CHOICE"), choices: choices.map(([value, label]) => ({ value, label })) });
const fundingField = choice("funding", "Financement déclaré", [["", "À préciser"], ["BANK", "Banque"]]);
const fieldLabels: Record<string, string> = { label: "Nom de l’intention", plannedDate: "Date prévue (facultative)", endDate: "Date de fin (facultative)", budgetDomain: "Enveloppe concernée" };
const familyLabels: Record<string, string> = { FOOD: "Sortir & manger", ACTIVITY: "Activités", VISIT: "Voir quelqu’un", PURCHASE: "Acheter", SOCIAL: "Sortir", TRAVEL: "Partir", BEAUTY: "Prendre soin", HOME: "Maison", OTHER: "Autres envies" };

export async function composerUiModel(deps: PlannerDependencies, household: string, model: MonthComposerReadModel): Promise<ComposerUiModel> {
  const active = await deps.repository.readActivePlan(household, model.semanticState.targetMonth);
  const { preview, ...view } = model;
  const templates = publishContextRegistry().templates;
  const editors = view.library.searchableAssets.flatMap<ComposerEditor>(asset => {
    if (asset.kind === "CONTEXT_ASSET") return [{ assetKey: asset.assetKey, fields: resolveContextTemplate(asset.templateKey!).fields.map(f => ({
      key: f.fieldKey, label: fieldLabels[f.fieldKey] ?? f.fieldKey, kind: f.kind, required: f.required,
      ...(f.choices ? { choices: f.choices.map(value => ({ value, label: value })) } : {}) })) }];
    if (asset.kind !== "SLOT_OPTION_ASSET") return [];
    const template = resolveContextTemplate(asset.templateKey!), parts = asset.assetKey.split(":"), slot = template.componentSlots.find(s => s.slotKey === parts[2])!;
    const option = slot.options.find(o => o.optionKey === asset.optionKey)!;
    const costMode = choice("costMode", "Connaissance du prix", [["AUTO", "Montant renseigné / devis existant"], ["UNKNOWN", "Prix à préciser"]]);
    const fields: ComposerField[] = option.kind === "COMPONENT" ? [field("label", "Libellé"), costMode, field("amount", "Montant unitaire (€) — vide si inconnu ou devis conservé", "AMOUNT"), { ...field("quantity", "Quantité", "AMOUNT", true), initial: "1" }, fundingField, field("fundingAmount", "Montant financé (€), si déclaré", "AMOUNT"),
      ...(option.bindingPolicy === "REQUIRES_CONFIRMATION" ? [choice("binding", "Relation avec l’enveloppe du mois", [["AUTO", "À confirmer"], ["CONFIRMED_CONSUMPTION", "Consomme l’enveloppe"], ["EXTRA_TO_SLOT", "S’ajoute à l’enveloppe"]])] : []),
      ...(slot.acceptsNeedOccurrence ? [choice("needOccurrenceId", "Besoin couvert (facultatif)", [["", "Achat libre"], ...preview.compiled.needs.map(n => [n.needOccurrenceId, composerNeedLabel(n.needKey)] as const)])] : [])]
      : [field("origin", "Départ (lieu enregistré conservé si vide)"), field("destination", "Destination (lieu enregistré conservé si vide)"),
        ...(option.mobilityMode === "CAR" ? [choice("preference", "Itinéraire", [["FASTEST", "Le plus rapide"], ["AVOID_TOLLS", "Éviter les péages"]]), choice("parkingMode", "Parking", [["UNKNOWN", "À préciser"], ["NO", "Aucun parking payant"], ["YES", "Parking payant"]]), field("parkingAmount", "Montant parking (€), si connu", "AMOUNT")]
          : [costMode, field("amount", "Billet / course (€) — vide si inconnu ou devis conservé", "AMOUNT")]), fundingField, field("fundingAmount", "Montant financé (€), si déclaré", "AMOUNT"),
        choice("returnRequired", "Aller-retour", [["false", "Aller uniquement"], ["true", "Aller-retour"]]),
        field("plannedTime", "Heure de départ, si connue (HH:MM)"), field("returnTime", "Heure de retour, si connue (HH:MM)"),
        choice("targetIntentId", "Trajet partagé — prix et financement portés par le trajet propriétaire", [["", "Trajet propre"], ...preview.compiled.mobilityIntents.map(i => [i.mobilityIntentId, `${view.board.contexts.find(c => c.contextOccurrenceId === i.contextOccurrenceId)?.label ?? i.contextOccurrenceId} · ${i.slotKey}`] as const)])];
    return [{ assetKey: asset.assetKey, fields }];
  });
  const controlEditors = [...view.board.baselineControls, ...view.board.discretionaryControls, ...view.board.savings].map(card => {
    const slot = preview.compiled.planSlots.find(s => s.baseline.slotIdentityKey === card.targetRef)!;
    const fields: ComposerField[] = [field(slot.baseline.kind === "AMOUNT" ? "amount" : "count", slot.baseline.kind === "AMOUNT" ? "Montant du mois (€)" : "Occurrences restantes", "AMOUNT", true)];
    if (slot.baseline.kind !== "AMOUNT" && (slot.baseline.simpleAuthority?.gate === "NEEDS_NEW_INPUT" || !!slot.baseline.renewalAuthority && slot.baseline.baselineValue.unitAmount === null))
      fields.push(field("unitAmount", "Montant d’une occurrence (€)", "AMOUNT", true));
    return { targetRef: card.targetRef, fields };
  });
  const groups = [...new Set(templates.map(t => t.family))];
  const friendlyCard = (card: ComposerCardView): ComposerCardView => ({ ...card, capability: card.capability ? { ...card.capability,
    naturalPresets: card.capability.naturalPresets.map(p => ({ ...p, label: ({ low: "Repère bas", median: "Repère médian", high: "Repère haut" } as Record<string, string>)[p.label]
      ?? (p.label === "central" ? "Repère médian" : p.label.startsWith("allocation ×") && p.semanticMutation.kind === "SET_STATE" && typeof p.semanticMutation.value.amount === "string"
        ? `Réserver ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(p.semanticMutation.value.amount))}` : p.label) })) } : null });
  return { ...view, library: { ...view.library, sections: [
    ...groups.map(family => ({ sectionKey: family, assetKeys: templates.filter(t => t.family === family).map(t => `template:${t.templateKey}`) })),
    { sectionKey: "options", assetKeys: view.library.searchableAssets.filter(a => a.kind === "SLOT_OPTION_ASSET").map(a => a.assetKey) },
    { sectionKey: "controls", assetKeys: view.library.searchableAssets.filter(a => ["PLAN_CONTROL", "RESERVATION_CONTROL"].includes(a.kind)).map(a => a.assetKey) }] },
    board: { ...view.board, baselineControls: view.board.baselineControls.map(friendlyCard), discretionaryControls: view.board.discretionaryControls.map(friendlyCard), savings: view.board.savings.map(friendlyCard) },
    proof: { expectedActiveRevisionId: preview.baseActiveRevisionId, expectedActiveRevisionNumber: preview.baseRevisionNumber,
      expectedBaselineDigest: preview.baselineDigest, expectedPreviewDigest: preview.previewDigest },
    appliedContextIds: active?.activeRevision?.semanticState.contexts.map(c => c.contextOccurrenceId) ?? [],
    editors, controlEditors, sectionLabels: { ...familyLabels, options: "Composants", controls: "Leviers du mois" } };
}

function dropMutation(model: MonthComposerReadModel, request: Extract<ComposerRequest, { kind: "DROP" }>): SemanticMutation | undefined {
  const asset = model.library.searchableAssets.find(a => a.assetKey === request.assetKey), target = request.target, values = request.values;
  if (target.kind === "TRASH") return undefined;
  if (request.assetKey.startsWith("context-occurrence:")) return { kind: "REPARENT_CONTEXT", contextOccurrenceId: plannerUuid(request.assetKey.slice(19)),
    parentContextOccurrenceId: plannerUuid(target.contextOccurrenceId), slotKey: target.slotKey!, selectionId: request.selectionId };
  if (!asset) throw new TypeError("COMPOSER_ASSET_MISSING");
  if (asset.kind === "CONTEXT_ASSET") {
    const definition = resolveContextTemplate(asset.templateKey!);
    const context = { contextOccurrenceId: plannerUuid(request.identity), templateKey: definition.templateKey, status: "ACTIVE" as const,
      parentContextOccurrenceId: null, fields: Object.fromEntries(definition.fields.filter(f => values[f.fieldKey]?.trim()).map(f => [f.fieldKey, values[f.fieldKey].trim()])),
      slotSelections: {}, provenance: "EXPLICIT_USER_DECISION" as const };
    return target.kind === "BOARD_ZONE" ? { kind: "ADD_CONTEXT", context } : { kind: "ATTACH_CONTEXT", context,
      parentContextOccurrenceId: target.contextOccurrenceId!, slotKey: target.slotKey!, selectionId: request.selectionId };
  }
  const card = model.board.contexts.find(c => c.contextOccurrenceId === target.contextOccurrenceId);
  const slot = resolveContextTemplate(card!.templateKey).componentSlots.find(s => s.slotKey === target.slotKey)!;
  const option = slot.options.find(o => o.optionKey === asset.optionKey && o.kind === asset.optionKind)!;
  const current = card!.sockets.find(s => s.slotKey === target.slotKey)!.currentItems;
  const previous = current.find(i => i.selectionId === request.selectionId && i.optionKey === option.optionKey);
  const amount = values.amount?.trim() ? decisionAmount(values.amount) : null;
  const quote = previous?.kind === "COMPONENT" ? previous.cost : previous?.kind === "MOBILITY_INTENT" ? previous.pricing?.fare : undefined;
  const cost = values.costMode === "UNKNOWN" ? { kind: "UNKNOWN" as const } : amount === null ? quote?.kind === "QUOTE" ? quote : { kind: "UNKNOWN" as const } : { kind: "MANUAL" as const, unitAmount: amount };
  const funding = !values.funding ? [] : [{ source: values.funding as "BANK" | "SWILE" | "EDENRED", amount: decisionAmount(values.fundingAmount) }];
  if (option.kind === "MOBILITY_INTENT" && values.targetIntentId && (amount !== null || funding.length || values.parkingMode === "YES"))
    throw new TypeError("COMPOSER_SHARED_JOURNEY_OWNER_PRICES");
  const common = { selectionId: request.selectionId, optionKey: option.optionKey, provenance: "EXPLICIT_USER_DECISION" as const };
  const selection: ComponentSelectionV1 = option.kind === "COMPONENT" ? { ...common, kind: "COMPONENT", label: values.label?.trim() || option.label,
    quantity: decisionAmount(values.quantity || "1"), cost, fundingAllocations: funding, ...(values.binding ? { binding: { mode: values.binding as "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" } } : {}),
    ...(values.needOccurrenceId ? { needOccurrenceId: values.needOccurrenceId } : {}) }
    : { ...common, kind: "MOBILITY_INTENT", origin: values.origin?.trim() ? { kind: "TEXT", label: values.origin.trim() } : previous?.kind === "MOBILITY_INTENT" && previous.origin?.kind === "KNOWN" ? previous.origin : null,
      destination: values.destination?.trim() ? { kind: "TEXT", label: values.destination.trim() } : previous?.kind === "MOBILITY_INTENT" && previous.destination?.kind === "KNOWN" ? previous.destination : null, returnRequired: values.returnRequired === "true",
      plannedTime: values.plannedTime || null, returnTime: values.returnTime || null,
      ...(!values.targetIntentId ? { pricing: parseMobilityPricing({ fare: cost, ...(option.mobilityMode === "CAR" ? { parking: values.parkingMode === "NO" ? { kind: "MANUAL" as const, unitAmount: "0" }
        : values.parkingAmount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.parkingAmount) } : { kind: "UNKNOWN" as const } } : {}),
        fundingAllocations: funding, preference: values.preference === "AVOID_TOLLS" ? "AVOID_TOLLS" : "FASTEST" }) } : {}),
      ...(values.targetIntentId ? { journey: { relation: "SHARES_JOURNEY" as const, certainty: "CERTAIN" as const, targetIntentId: values.targetIntentId,
        externalExpenseId: null, externalCostLineIds: [], choice: null, stopIndex: null, accessLegIndex: null } } : {}) };
  return { kind: "PATCH_CONTEXT", contextOccurrenceId: target.contextOccurrenceId!, slotKey: target.slotKey!,
    items: slot.cardinality === "REPEATING" ? [...current.filter(i => i.selectionId !== selection.selectionId && i.kind !== "UNRESOLVED"), selection] : [selection] };
}

export async function handleComposerRequest(deps: PlannerDependencies, household: string, request: ComposerRequest): Promise<ComposerResponse> {
  try {
    if (!Number.isSafeInteger(request.sequence) || request.sequence < 0) throw new TypeError("COMPOSER_SEQUENCE_INVALID");
    const month = plannerMonth(request.targetMonth);
    if (request.draft && parsePlanSemanticState(request.draft).targetMonth !== month) throw new TypeError("PLANNER_DRAFT_MONTH_INVALID");
    const model = await readMonthComposer(deps, household, month, request.draft);
    let state = model.semanticState, mutationKind: string | undefined;
    let suggestions;
    if (request.kind === "APPLY") {
      if (!request.draft) throw new TypeError("COMPOSER_DRAFT_REQUIRED");
      await applyPlanScenario(deps, household, state, request.command);
      return { ok: true, sequence: request.sequence, applied: true, model: await composerUiModel(deps, household, await readMonthComposer(deps, household, month)) };
    }
    if (request.kind === "MUTATE") {
      const mutation = request.mutation;
      // UI controls must use a published capability; the Compiler independently enforces hard constraints.
      if (mutation.kind === "SET_STATE") {
        const card = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(c => c.targetRef === mutation.targetRef);
        if (!card?.capability?.actions.length || card.capability.flexibility === "LOCKED") throw new TypeError("COMPOSER_CONTROL_LOCKED");
      } else if (mutation.kind === "PATCH_CONTEXT" || mutation.kind === "REMOVE_CONTEXT") {
        if (!model.board.contexts.find(c => c.contextOccurrenceId === mutation.contextOccurrenceId)?.capabilityRefs.includes(mutation.kind)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      } else throw new TypeError("COMPOSER_USE_DROP_CAPABILITY");
      state = mutatePlanSemanticState(state, mutation); mutationKind = mutation.kind;
    } else if (request.kind === "DROP") {
      const resolution = resolveComposerDrop(model, request.assetKey, request.target, dropMutation(model, request));
      if (!resolution.semanticMutation) throw new TypeError("COMPOSER_DROP_BLOCKED");
      state = mutatePlanSemanticState(state, resolution.semanticMutation); mutationKind = resolution.semanticMutation.kind;
      if (mutationKind === "REMOVE_CONTEXT") {
        const active = await deps.repository.readActivePlan(household, month);
        if (active?.activeRevision?.semanticState.contexts.some(c => c.contextOccurrenceId === request.assetKey.slice(19))) mutationKind = "CANCEL_CONTEXT";
      }
    } else if (request.kind === "CLEAR_SOCKET") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.contextOccurrenceId);
      if (!card?.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      const socket = card.sockets.find(s => s.slotKey === request.slotKey)!;
      state = mutatePlanSemanticState(state, { kind: "PATCH_CONTEXT", contextOccurrenceId: card.contextOccurrenceId, slotKey: socket.slotKey,
        items: socket.currentItems.filter(i => i.selectionId !== request.selectionId) });
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "EDIT_CONTEXT") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.contextOccurrenceId);
      if (!card?.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      const template = resolveContextTemplate(card.templateKey);
      const fields = Object.fromEntries(template.fields.filter(f => request.values[f.fieldKey]?.trim()).map(f => [f.fieldKey, request.values[f.fieldKey].trim()]));
      state = parsePlanSemanticState({ ...state, contexts: state.contexts.map(c => c.contextOccurrenceId === card.contextOccurrenceId ? { ...c, fields } : c) });
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "PRESERVE") {
      if (![...model.board.contexts.map(c => c.contextOccurrenceId), ...model.board.baselineControls.map(c => c.targetRef), ...model.board.discretionaryControls.map(c => c.targetRef), ...model.board.savings.map(c => c.targetRef)].includes(request.targetRef)) throw new TypeError("COMPOSER_PREFERENCE_TARGET_UNKNOWN");
      state = parsePlanSemanticState({ ...state, preferences: { ...state.preferences, flexibility: { ...state.preferences.flexibility, [request.targetRef]: request.preserve ? "PRESERVE" : "NORMAL" } } });
    } else if (request.kind === "SUGGESTIONS") suggestions = await readPlanBalanceSuggestions(deps, household, month, state);
    else if (request.kind === "ACCEPT") {
      const accepted = await acceptPlanBalanceSuggestion(deps, household, month, state, request.candidateSetDigest, request.candidateId);
      state = accepted.semanticState; suggestions = accepted.suggestions;
    } else if (request.kind !== "READ") throw new TypeError("COMPOSER_REQUEST_INVALID");
    const next = state === model.semanticState ? model : await readMonthComposer(deps, household, month, state);
    return { ok: true, sequence: request.sequence, model: await composerUiModel(deps, household, next), suggestions, mutationKind };
  } catch (error) {
    const code = error instanceof TypeError ? error.message : "COMPOSER_UNAVAILABLE";
    return { ok: false, sequence: request.sequence, code,
      message: code === "COMPOSER_SHARED_JOURNEY_OWNER_PRICES" ? "Un trajet partagé reprend le prix et le financement de son trajet propriétaire. Retirez le prix ou financement séparé, ou choisissez un trajet propre."
        : /STALE|CHANGED/u.test(code) ? "Le mois a changé. Rechargez la prévisualisation avant d’appliquer ; votre brouillon est conservé."
        : /LOCKED|BLOCKED/u.test(code) ? "Cette action n’est pas disponible. Vérifiez les contraintes et les informations manquantes."
        : "Cette proposition n’a pas pu être validée. Votre brouillon est conservé ; vérifiez les champs et réessayez." };
  }
}
