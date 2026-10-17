import "server-only";
import { validateControlValue } from "@/domain/phase2/planner/control-input";
import { ControlDecisionAdmissionError } from "./control-fields";
import { editRestaurant } from "@/domain/phase2/planner/restaurant-edit";
import { editGuidedContext } from "@/domain/phase2/planner/guided-context-edit";
import { presetCreationFields } from "@/domain/phase2/planner/composer-presets";
import { snapshotWork } from "./snapshot-observation";
import { composerMutationDependencies } from "./composer-mutation-world";
import Big from "big.js";
import type { ComposerApplyReceipt, ComposerEditor, ComposerField, ComposerRequest, ComposerResponse, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import { editNightOut } from "@/domain/phase2/planner/night-out-edit";
import { editShortStay } from "@/domain/phase2/planner/short-stay-edit";
import { editFamilyVisit } from "@/domain/phase2/planner/family-visit-edit";
import { mobilitySummaries } from "./mobility-presentation";
import { nightOutSummaries } from "./night-out-presentation";
import { knownContextReferences } from "./context-selections";
import { plannerDigest, plannerKeys, plannerMonth, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { declareComponentQuantity } from "@/domain/phase2/planner/component-quantity";
import type { PlannerDependencies } from "./apply";
import { applyPlanScenario, readAppliedPlanScenario, type AppliedPlanScenario } from "./apply";
import { composerNeedLabel, composerFromDraftRead, readMonthComposer, resolveComposerDrop } from "./read-model";
import { publishContextRegistry, resolveContextTemplate } from "./context-registry";
import { mutatePlanSemanticState } from "./semantic-mutations";
import { acceptPlanBalanceSuggestion, balanceSuggestionsFromDraftRead } from "./balance-assistant";
import { readPlannerDraft } from "./draft-reader";
import { parseMobilityPricing } from "./mobility-selections";
import { patchContextEditorFields, setContextSlotSelections } from "./context-state";
import { composerAssetIcon, composerPresentation } from "./composer-presentation";

const field = (key: string, label: string, kind: ComposerField["kind"] = "TEXT", required = false): ComposerField => ({ key, label, kind, required });
const choice = (key: string, label: string, choices: readonly (readonly [string, string])[]): ComposerField => ({ ...field(key, label, "CHOICE"), choices: choices.map(([value, label]) => ({ value, label })) });
const fundingField = choice("funding", "Financement déclaré", [["", "À préciser"], ["BANK", "Banque"]]);
const fieldLabels: Record<string, string> = { label: "Nom de l’intention", plannedDate: "Date prévue (facultative)", endDate: "Date de fin (facultative)", budgetDomain: "Enveloppe concernée",
  participantRefs: "Personnes concernées", personVisitedRef: "Personne visitée", placeRef: "Lieu ou destination", destinationRef: "Destination",
  productLabel: "Produit ou objet", merchantLabel: "Commerce ou vendeur", timingNote: "Repère de temps", nightCount: "Nombre de nuits", lodgingKind: "Type d’hébergement" };
const choiceLabels: Record<string, string> = { clothing: "Vêtements", "home-small": "Maison petit", "games-digital": "Jeux et numérique", other: "Autre" };
const familyLabels: Record<string, string> = { FOOD: "Sortir & manger", ACTIVITY: "Activités", VISIT: "Voir quelqu’un", PURCHASE: "Acheter", SOCIAL: "Sortir", TRAVEL: "Partir", BEAUTY: "Prendre soin", HOME: "Maison", OTHER: "Autres envies" };

export function composerUiModel(deps: PlannerDependencies, household: string, model: MonthComposerReadModel): Promise<ComposerUiModel> {
  return snapshotWork("UIModel", () => buildComposerUiModel(deps, household, model));
}
async function buildComposerUiModel(deps: PlannerDependencies, household: string, model: MonthComposerReadModel): Promise<ComposerUiModel> {
  const active = await snapshotWork("UIModel_PlanActive", () => deps.repository.readActivePlan(household, model.semanticState.targetMonth));
  const { preview, ...view } = model;
  const templates = publishContextRegistry().templates;
  const editors = view.library.searchableAssets.flatMap<ComposerEditor>(asset => {
    if (asset.kind === "CONTEXT_ASSET") return [{ assetKey: asset.assetKey, fields: resolveContextTemplate(asset.templateKey!).fields
      .filter(f => f.fieldKey !== "fieldSchemaVersion" && f.kind !== "PLANNED_ASSET_REF").map(f => ({
      key: f.fieldKey, label: fieldLabels[f.fieldKey] ?? f.fieldKey, kind: f.kind as ComposerField["kind"], required: f.required,
      ...(f.choices ? { choices: f.choices.map(value => ({ value, label: choiceLabels[value] ?? value })) } : {}) })) as ComposerField[] }];
    if (asset.kind !== "SLOT_OPTION_ASSET") return [];
    const template = resolveContextTemplate(asset.templateKey!), parts = asset.assetKey.split(":"), slot = template.componentSlots.find(s => s.slotKey === parts[2])!;
    const option = slot.options.find(o => o.optionKey === asset.optionKey)!;
    const costMode = choice("costMode", "Connaissance du prix", [["AUTO", "Montant renseigné / devis existant"], ["UNKNOWN", "Prix à préciser"]]);
    const fields: ComposerField[] = option.kind === "COMPONENT" ? [field("label", "Libellé"), costMode, field("amount", "Prix par unité (€) — vide si inconnu ou devis conservé", "AMOUNT"), { ...field("quantity", "Quantité totale ou par personne selon l’unité", "AMOUNT", true), initial: "1" },
      choice("unitBasis", "Unité du prix", [["", "Non précisée"], ["ITEM", "Par élément"], ["PERSON", "Par personne"], ["SHARED", "Montant commun"]]),
      field("personCount", "Nombre de personnes retenues si prix par personne", "AMOUNT"),
      fundingField, field("fundingAmount", "Montant financé (€), si déclaré", "AMOUNT"),
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
    if (card.capability?.fields?.unitAmount?.status === "EDITABLE")
      fields.push(field("unitAmount", "Prix d’une occurrence, pour ce mois (€)", "AMOUNT"));
    return { targetRef: card.targetRef, fields: fields.filter(f => card.capability?.fields?.[f.key as "amount" | "count" | "unitAmount"]?.status === "EDITABLE") };
  });
  const groups = [...new Set(templates.map(t => t.family))];
  const friendlyCard = (card: ComposerCardView): ComposerCardView => ({ ...card, capability: card.capability ? { ...card.capability,
    naturalPresets: card.capability.naturalPresets.map(p => ({ ...p, label: ({ low: "Repère bas", median: "Repère médian", high: "Repère haut" } as Record<string, string>)[p.label]
      ?? (p.label === "central" ? "Repère médian" : p.label.startsWith("allocation ×") && p.semanticMutation.kind === "SET_STATE" && typeof p.semanticMutation.value.amount === "string"
        ? `Réserver ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(p.semanticMutation.value.amount))}` : p.label) })) } : null });
  const mobilityOptions = view.semanticState.contexts.some(c => resolveContextTemplate(c.templateKey).fields.some(f => f.kind === "PLACE_REF")) && deps.readMobilityOptions
    ? await deps.readMobilityOptions(household) : undefined;
  return { ...view, householdPersons: deps.householdPersons ?? [],
    ...(mobilityOptions ? { mobilityOptions: { vehicle: mobilityOptions.vehicle, vehicleIsUnique: mobilityOptions.vehicleIsUnique, placeKnowledge: mobilityOptions.placeKnowledge, places: mobilityOptions.places.map(p => ({
      placeId: p.placeId, name: p.name, commune: p.commune, nature: p.nature, usage: p.usage, subtype: p.subtype, privatePlace: p.privatePlace,
      relationships: p.relationships,
      ...(mobilityOptions.placeKnowledge ? { currentRelationships: p.currentRelationships, ...(!p.privatePlace ? { visits12Months: p.visits12Months, lastVisitDate: p.lastVisitDate } : {}) } : {}),
      ...(!p.privatePlace && p.address ? { address: p.address } : {}) })) } } : {}),
    mobilitySummaries: mobilitySummaries(preview.compiled.journeys, preview.compiled.journeyPrices),
    nightOutSummaries: nightOutSummaries(model),
    presentation: composerPresentation(model), library: { ...view.library,
    searchableAssets: view.library.searchableAssets.map(asset => ({ ...asset, iconKey: composerAssetIcon(asset, model) })), sections: [
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
    plannerKeys(plannerRecord(values), definition.fields.filter(f => f.fieldKey !== "fieldSchemaVersion" && ["TEXT", "DATE", "CHOICE"].includes(f.kind)).map(f => f.fieldKey), []);
    const context = { contextOccurrenceId: plannerUuid(request.identity), templateKey: definition.templateKey, status: "ACTIVE" as const,
      parentContextOccurrenceId: null,
      fields: { fieldSchemaVersion: asset.templateKey === "short-stay" ? "context-fields@v5"
        : asset.templateKey === "family-visit" ? "context-fields@v4" : "context-fields@v2",
      ...presetCreationFields(definition.templateKey, request.presetKey),
      ...Object.fromEntries(definition.fields.filter(f => values[f.fieldKey]?.trim()).map(f => [f.fieldKey, values[f.fieldKey].trim()])) },
      slotSelections: {}, provenance: "EXPLICIT_USER_DECISION" as const };
    return target.kind === "BOARD_ZONE" ? { kind: "ADD_CONTEXT", context } : { kind: "ATTACH_CONTEXT", context,
      parentContextOccurrenceId: target.contextOccurrenceId!, slotKey: target.slotKey!, selectionId: request.selectionId };
  }
  const card = model.board.contexts.find(c => c.contextOccurrenceId === target.contextOccurrenceId);
  const slot = resolveContextTemplate(card!.templateKey).componentSlots.find(s => s.slotKey === target.slotKey)!;
  const option = slot.options.find(o => o.optionKey === asset.optionKey && o.kind === asset.optionKind)!;
  const current = card!.sockets.find(s => s.slotKey === target.slotKey)!.currentItems;
  const previous = (request.sourceSocket ? model.board.contexts.find(c => c.contextOccurrenceId === request.sourceSocket!.contextOccurrenceId)
    ?.sockets.find(s => s.slotKey === request.sourceSocket!.slotKey)?.currentItems.find(i => i.selectionId === request.sourceSocket!.selectionId) : undefined)
    ?? current.find(i => i.selectionId === request.selectionId);
  const patchSelection = (selection: ComponentSelectionV1): SemanticMutation => ({ kind: "PATCH_CONTEXT", contextOccurrenceId: target.contextOccurrenceId!, slotKey: target.slotKey!,
    items: slot.cardinality === "REPEATING" ? [...current.filter(i => i.selectionId !== selection.selectionId && i.kind !== "UNRESOLVED"), selection] : [selection] });
  // Moving/accepting an existing selection retains the complete server decision, including funding and journey declarations.
  if (request.sourceSocket && previous) return patchSelection({ ...previous, provenance: "EXPLICIT_USER_DECISION" });
  const amount = values.amount?.trim() ? decisionAmount(values.amount) : null;
  const sameOption = previous?.optionKey === option.optionKey;
  const quote = sameOption && previous?.kind === "COMPONENT" ? previous.cost
    : sameOption && previous?.kind === "MOBILITY_INTENT" ? previous.pricing?.fare : undefined;
  const cost = values.costMode === "UNKNOWN" ? { kind: "UNKNOWN" as const } : amount === null
    ? values.amount === undefined && quote ? quote : quote?.kind === "QUOTE" ? quote : { kind: "UNKNOWN" as const }
    : { kind: "MANUAL" as const, unitAmount: amount };
  const previousFunding = sameOption && previous?.kind === "COMPONENT" ? previous.fundingAllocations ?? []
    : sameOption && previous?.kind === "MOBILITY_INTENT" ? previous.pricing?.fundingAllocations ?? [] : [];
  const funding = values.funding === undefined || values.funding === "EXISTING" && previousFunding.length ? previousFunding
    : !values.funding ? [] : values.funding === "BANK" ? [{ source: "BANK" as const, amount: decisionAmount(values.fundingAmount) }]
      : (() => { throw new TypeError("COMPOSER_FUNDING_NOT_ADMITTED"); })();
  if (values.funding === "EXISTING" && (previousFunding.length === 0 || values.fundingAmount && values.fundingAmount !== previousFunding[0]?.amount))
    throw new TypeError("COMPOSER_FUNDING_NOT_ADMITTED");
  if (option.kind === "MOBILITY_INTENT" && values.targetIntentId && (amount !== null || funding.length || values.parkingMode === "YES"))
    throw new TypeError("COMPOSER_SHARED_JOURNEY_OWNER_PRICES");
  const common = { selectionId: request.selectionId, optionKey: option.optionKey, provenance: "EXPLICIT_USER_DECISION" as const };
  const priorComponent = sameOption && previous?.kind === "COMPONENT" ? previous : undefined;
  const { quantityEvidenceVersion: _oldEvidence, quantityPerPerson: _oldPerPerson, pricedParticipantCount: _oldCount,
    needOccurrenceId: _oldNeed, ...preservedComponent } = priorComponent ?? {};
  if (values.unitBasis && !["ITEM", "PERSON", "SHARED"].includes(values.unitBasis)) throw new TypeError("CONTEXT_UNIT_BASIS_INVALID");
  const unitBasis = (values.unitBasis || priorComponent?.unitBasis) as "ITEM" | "PERSON" | "SHARED" | undefined;
  const inputQuantity = values.quantity ?? priorComponent?.quantityPerPerson ?? priorComponent?.quantity ?? "1";
  const perPersonInput = unitBasis === "PERSON" && priorComponent?.quantityPerPerson && values.personCount === undefined
    && values.quantity && new Big(values.quantity).eq(priorComponent.quantity) ? priorComponent.quantityPerPerson : inputQuantity;
  const legacyPerson = unitBasis === "PERSON" && priorComponent?.unitBasis === "PERSON" && !priorComponent.quantityPerPerson
    && !values.personCount && new Big(inputQuantity).eq(priorComponent.quantity);
  const declaredQuantity = legacyPerson ? { quantity: priorComponent.quantity }
    : declareComponentQuantity(unitBasis === "PERSON" ? "PER_PERSON" : "TOTAL_UNITS", perPersonInput,
      unitBasis === "PERSON" ? Number(values.personCount ?? priorComponent?.pricedParticipantCount) : undefined);
  const priorMobility = previous?.kind === "MOBILITY_INTENT" ? previous : undefined;
  const origin = values.origin === undefined ? priorMobility?.origin ?? null
    : values.origin.trim() ? { kind: "TEXT" as const, label: values.origin.trim() }
      : priorMobility?.origin?.kind === "KNOWN" ? priorMobility.origin : null;
  const destination = values.destination === undefined ? priorMobility?.destination ?? null
    : values.destination.trim() ? { kind: "TEXT" as const, label: values.destination.trim() }
      : priorMobility?.destination?.kind === "KNOWN" ? priorMobility.destination : null;
  const returnRequired = values.returnRequired === undefined ? priorMobility?.returnRequired === true : values.returnRequired === "true";
  const plannedTime = values.plannedTime === undefined ? priorMobility?.plannedTime ?? null : values.plannedTime || null;
  const returnTime = values.returnTime === undefined ? priorMobility?.returnTime ?? null : values.returnTime || null;
  const sameJourney = priorMobility?.optionKey === option.optionKey && plannerDigest(origin) === plannerDigest(priorMobility.origin)
    && plannerDigest(destination) === plannerDigest(priorMobility.destination) && returnRequired === priorMobility.returnRequired
    && plannedTime === priorMobility.plannedTime && returnTime === priorMobility.returnTime;
  const targetIntentId = values.targetIntentId === undefined ? sameOption && priorMobility?.journey?.relation === "SHARES_JOURNEY"
    ? priorMobility.journey.targetIntentId : "" : values.targetIntentId;
  const parking = option.mobilityMode === "CAR" ? values.parkingMode === "NO" ? { kind: "MANUAL" as const, unitAmount: "0" }
    : values.parkingAmount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.parkingAmount) }
      : values.parkingMode === undefined ? priorMobility?.pricing?.parking ?? { kind: "UNKNOWN" as const } : { kind: "UNKNOWN" as const } : undefined;
  const selection: ComponentSelectionV1 = option.kind === "COMPONENT" ? { ...preservedComponent, ...common, kind: "COMPONENT", label: values.label?.trim() || priorComponent?.label || option.label,
    ...declaredQuantity, cost, fundingAllocations: funding, ...(values.binding ? { binding: { mode: values.binding as "AUTO" | "CONFIRMED_CONSUMPTION" | "EXTRA_TO_SLOT" } } : {}),
    ...(unitBasis ? { unitBasis } : {}), ...(slot.acceptsNeedOccurrence && values.needOccurrenceId ? { needOccurrenceId: values.needOccurrenceId }
      : values.needOccurrenceId === undefined && priorComponent?.needOccurrenceId ? { needOccurrenceId: priorComponent.needOccurrenceId } : {}) }
    : { ...common, kind: "MOBILITY_INTENT", origin, destination, returnRequired, plannedTime, returnTime,
      ...(!targetIntentId ? { pricing: parseMobilityPricing({ fare: cost, ...(parking ? { parking } : {}), fundingAllocations: funding,
        preference: values.preference === "AVOID_TOLLS" ? "AVOID_TOLLS" : values.preference === undefined ? priorMobility?.pricing?.preference ?? "FASTEST" : "FASTEST" }) } : {}),
      ...(targetIntentId ? { journey: sameJourney && priorMobility?.journey?.relation === "SHARES_JOURNEY" && priorMobility.journey.targetIntentId === targetIntentId
        ? priorMobility.journey : { relation: "SHARES_JOURNEY" as const, certainty: "CERTAIN" as const, targetIntentId,
          externalExpenseId: null, externalCostLineIds: [], choice: null, stopIndex: null, accessLegIndex: null } }
        : sameJourney && priorMobility?.journey?.relation === "OWNS_JOURNEY" ? { journey: priorMobility.journey } : {}),
      ...(option.mobilityMode === "CAR" && sameJourney && priorMobility?.route && !targetIntentId ? { route: priorMobility.route } : {}) };
  return patchSelection(selection);
}

function applyReceipt(committed: AppliedPlanScenario, model?: ComposerUiModel): ComposerApplyReceipt {
  const revision = committed.revision;
  const activeRevisionId = model?.activeRevisionId ?? null, activeRevisionNumber = model?.activeRevisionNumber ?? null;
  return { applyRequestId: revision.applyRequestId, planRevisionId: revision.planRevisionId,
    revisionNumber: revision.revisionNumber, parentRevisionId: revision.parentRevisionId,
    semanticStateDigest: revision.semanticStateDigest, baselineDigest: revision.baselineDigest, previewDigest: revision.previewDigest,
    outcome: committed.replayed ? "REPLAYED" : "APPLIED",
    headStatus: !model ? "UNAVAILABLE" : activeRevisionId === revision.planRevisionId && activeRevisionNumber === revision.revisionNumber
      ? "ACTIVE" : "SUPERSEDED", activeRevisionId, activeRevisionNumber };
}

export async function handleComposerRequest(deps: PlannerDependencies, household: string, request: ComposerRequest): Promise<ComposerResponse> {
  try {
    if (!Number.isSafeInteger(request.sequence) || request.sequence < 0) throw new TypeError("COMPOSER_SEQUENCE_INVALID");
    const month = plannerMonth(request.targetMonth);
    if (request.draft && parsePlanSemanticState(request.draft).targetMonth !== month) throw new TypeError("PLANNER_DRAFT_MONTH_INVALID");
    if (request.kind === "APPLY" || request.kind === "CHECK_APPLY") {
      if (!request.draft) throw new TypeError("COMPOSER_DRAFT_REQUIRED");
      const state = parsePlanSemanticState(request.draft);
      const committed = request.kind === "APPLY"
        ? await applyPlanScenario(deps, household, state, request.command)
        : await readAppliedPlanScenario(deps, household, state, request.command);
      if (!committed) return { ok: false, sequence: request.sequence, code: "COMPOSER_APPLY_UNCONFIRMED",
        message: "Aucune révision n’est encore confirmée pour cette demande. Votre brouillon est conservé ; vérifiez de nouveau ou relancez explicitement la même demande avec son identité inchangée." };
      try {
        const model = await composerUiModel(deps, household, await readMonthComposer(deps, household, month));
        return { ok: true, sequence: request.sequence, applied: true, applyReceipt: applyReceipt(committed, model), model };
      } catch {
        // The immutable revision is committed. A failed read must never be reported as a failed Apply or retried as a write.
        return { ok: false, sequence: request.sequence, applied: true, revisionNumber: committed.revision.revisionNumber,
          applyReceipt: applyReceipt(committed),
          code: "COMPOSER_APPLIED_RELOAD_UNAVAILABLE",
          message: `Révision ${committed.revision.revisionNumber} enregistrée, mais sa relecture est indisponible. Actualisez la prévisualisation avant toute autre action.` };
      }
    }
    // The opt-in historical reader is never passed into Apply or its post-commit reload.
    if (deps.readComposerWorld) deps = { ...deps, readWorld: deps.readComposerWorld };
    const mutationRead = ["MUTATE", "DROP", "CLEAR_SOCKET", "EDIT_GIFT", "EDIT_NIGHT_OUT", "EDIT_RESTAURANT", "EDIT_PRESET_CONTEXT", "EDIT_SHORT_STAY", "EDIT_FAMILY_VISIT", "EDIT_CONTEXT", "PRESERVE"].includes(request.kind);
    const readDeps = mutationRead && process.env.COMPOSER_P14_P2_SINGLE_WORLD !== "0"
      ? composerMutationDependencies(deps, household, month) : deps;
    // Suggestions and Board describe the same admitted state in this request.
    // ACCEPT and APPLY deliberately retain their independent authoritative reads.
    const suggestionsRead = request.kind === "SUGGESTIONS"
      ? await readPlannerDraft(deps, household, month, request.draft) : null;
    const model = suggestionsRead ? composerFromDraftRead(suggestionsRead)
      : await readMonthComposer(readDeps, household, month, request.draft);
    let state = model.semanticState, mutationKind: string | undefined;
    let suggestions;
    if (request.kind === "MUTATE") {
      const mutation = request.mutation;
      // UI controls must use a published capability; the Compiler independently enforces hard constraints.
      if (mutation.kind === "SET_STATE") {
        const card = [...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings].find(c => c.targetRef === mutation.targetRef);
        if (!card?.capability?.actions.length || card.capability.flexibility === "LOCKED") throw new TypeError("COMPOSER_CONTROL_LOCKED");
        validateControlValue(card, mutation.value);
        if (card.kind === "SAVINGS") {
          if (!card.capability.actions.includes("SET_SAVINGS_ALLOCATION")) throw new TypeError("COMPOSER_SAVINGS_CAPABILITY_UNAVAILABLE");
          plannerKeys(plannerRecord(mutation.value), ["amount"], ["amount"]);
          decisionAmount(mutation.value.amount);
        }
      } else if (mutation.kind === "PATCH_CONTEXT" || mutation.kind === "REMOVE_CONTEXT") {
        if (!model.board.contexts.find(c => c.contextOccurrenceId === mutation.contextOccurrenceId)?.capabilityRefs.includes(mutation.kind)) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      } else throw new TypeError("COMPOSER_USE_DROP_CAPABILITY");
      state = mutatePlanSemanticState(state, mutation); mutationKind = mutation.kind;
    } else if (request.kind === "DROP") {
      if (request.sourceSocket) {
        const source = composerPresentation(model).dragSources[`satellite:${request.sourceSocket.contextOccurrenceId}:${request.sourceSocket.slotKey}:${request.sourceSocket.selectionId}`];
        if (!source || source.protected || source.assetKey !== request.assetKey || source.selection?.selectionId !== request.selectionId)
          throw new TypeError("COMPOSER_SOURCE_LOCKED");
      }
      const resolution = resolveComposerDrop(model, request.assetKey, request.target, dropMutation(model, request));
      if (!resolution.semanticMutation) throw new TypeError("COMPOSER_DROP_BLOCKED");
      if (request.sourceSocket && (request.sourceSocket.contextOccurrenceId !== request.target.contextOccurrenceId || request.sourceSocket.slotKey !== request.target.slotKey)) {
        const source = model.board.contexts.find(c => c.contextOccurrenceId === request.sourceSocket!.contextOccurrenceId)!.sockets.find(s => s.slotKey === request.sourceSocket!.slotKey)!;
        state = mutatePlanSemanticState(state, { kind: "PATCH_CONTEXT", contextOccurrenceId: source.contextOccurrenceId, slotKey: source.slotKey,
          items: source.currentItems.filter(i => i.selectionId !== request.sourceSocket!.selectionId) });
      }
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
    } else if (request.kind === "EDIT_GIFT") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.contextOccurrenceId);
      if (card?.templateKey !== "gift" || !card.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_GIFT_TARGET_INVALID");
      const prior = card.sockets.find(socket => socket.slotKey === "item")?.currentItems ?? [];
      if (request.item.kind !== "COMPONENT" || request.item.optionKey !== "gift"
        || prior.some(item => item.kind === "COMPONENT" && item.selectionId !== request.item.selectionId))
        throw new TypeError("COMPOSER_GIFT_ITEM_INVALID");
      state = setContextSlotSelections(patchContextEditorFields(state, card.contextOccurrenceId, request.values),
        card.contextOccurrenceId, "item", [request.item]);
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "EDIT_NIGHT_OUT") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.edit.contextOccurrenceId);
      if (card?.templateKey !== "night-out") throw new TypeError("COMPOSER_NIGHT_OUT_TARGET_INVALID");
      if (!card.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      state = editNightOut(state, request.edit);
      const refs = knownContextReferences(state);
      if (refs.personIds.length || refs.placeIds.length) {
        if (!deps.validateContextReferences) throw new TypeError("CONTEXT_REFERENCE_OWNER_UNAVAILABLE");
        await deps.validateContextReferences(household, refs);
      }
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "EDIT_FAMILY_VISIT" || request.kind === "EDIT_SHORT_STAY") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.edit.contextOccurrenceId);
      if (card?.templateKey !== (request.kind === "EDIT_SHORT_STAY" ? "short-stay" : "family-visit") || !card.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      state = request.kind === "EDIT_SHORT_STAY" ? editShortStay(state, request.edit) : editFamilyVisit(state, request.edit);
      const refs = knownContextReferences(state);
      if (refs.personIds.length || refs.placeIds.length) {
        if (!deps.validateContextReferences) throw new TypeError("CONTEXT_REFERENCE_OWNER_UNAVAILABLE");
        await deps.validateContextReferences(household, refs);
      }
      const vehicleRef = request.edit.transport?.route?.vehicleRef;
      if (vehicleRef && request.edit.transport?.optionKey === "car") {
        const old = model.semanticState.contexts.find(c => c.contextOccurrenceId === card.contextOccurrenceId)?.slotSelections.transport?.items;
        const priorId = Array.isArray(old) ? (old[0] as Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> | undefined)?.route?.vehicleRef?.vehicleId : null;
        const options = await deps.readMobilityOptions?.(household);
        if (vehicleRef.vehicleId !== priorId && vehicleRef.vehicleId !== options?.vehicle?.vehicleId) throw new TypeError("COMPOSER_VEHICLE_NOT_ADMITTED");
      }
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "EDIT_RESTAURANT" || request.kind === "EDIT_PRESET_CONTEXT") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.edit.contextOccurrenceId);
      if (!card || (request.kind === "EDIT_RESTAURANT" ? card.templateKey !== "restaurant" : !["fast-food", "delivery", "activity", "purchase"].includes(card.templateKey))
        || !card.capabilityRefs.includes("PATCH_CONTEXT") || card.readOnly) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      state = request.kind === "EDIT_RESTAURANT" ? editRestaurant(state, request.edit) : editGuidedContext(state, request.edit);
      const vehicleRef = request.edit.slots?.transport?.[0]?.kind === "MOBILITY_INTENT" ? request.edit.slots.transport[0].route?.vehicleRef : null;
      if (vehicleRef) {
        const old = model.semanticState.contexts.find(c => c.contextOccurrenceId === request.edit.contextOccurrenceId)?.slotSelections.transport?.items;
        const priorId = Array.isArray(old) ? (old[0] as Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> | undefined)?.route?.vehicleRef?.vehicleId : null;
        const options = await deps.readMobilityOptions?.(household);
        if (vehicleRef.vehicleId !== priorId && vehicleRef.vehicleId !== options?.vehicle?.vehicleId) throw new TypeError("COMPOSER_VEHICLE_NOT_ADMITTED");
      }
      const refs = knownContextReferences(state);
      if (refs.personIds.length || refs.placeIds.length) {
        if (!deps.validateContextReferences) throw new TypeError("CONTEXT_REFERENCE_OWNER_UNAVAILABLE");
        await deps.validateContextReferences(household, refs);
      }
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "EDIT_CONTEXT") {
      const card = model.board.contexts.find(c => c.contextOccurrenceId === request.contextOccurrenceId);
      if (!card?.capabilityRefs.includes("PATCH_CONTEXT")) throw new TypeError("COMPOSER_CONTEXT_LOCKED");
      const template = resolveContextTemplate(card.templateKey);
      plannerKeys(plannerRecord(request.values), template.fields.filter(f => f.fieldKey !== "fieldSchemaVersion").map(f => f.fieldKey), []);
      state = patchContextEditorFields(state, card.contextOccurrenceId, request.values);
      const refs = knownContextReferences(state);
      if (refs.personIds.length || refs.placeIds.length) {
        if (!deps.validateContextReferences) throw new TypeError("CONTEXT_REFERENCE_OWNER_UNAVAILABLE");
        await deps.validateContextReferences(household, refs);
      }
      mutationKind = "PATCH_CONTEXT";
    } else if (request.kind === "PRESERVE") {
      if (![...model.board.contexts.map(c => c.contextOccurrenceId), ...model.board.baselineControls.map(c => c.targetRef), ...model.board.discretionaryControls.map(c => c.targetRef), ...model.board.savings.map(c => c.targetRef)].includes(request.targetRef)) throw new TypeError("COMPOSER_PREFERENCE_TARGET_UNKNOWN");
      state = parsePlanSemanticState({ ...state, preferences: { ...state.preferences, flexibility: { ...state.preferences.flexibility, [request.targetRef]: request.preserve ? "PRESERVE" : "NORMAL" } } });
    } else if (request.kind === "SUGGESTIONS" && suggestionsRead) suggestions = await balanceSuggestionsFromDraftRead(deps, suggestionsRead);
    else if (request.kind === "ACCEPT") {
      const accepted = await acceptPlanBalanceSuggestion(deps, household, month, state, request.candidateSetDigest, request.candidateId);
      state = accepted.semanticState; suggestions = accepted.suggestions;
    } else if (request.kind !== "READ") throw new TypeError("COMPOSER_REQUEST_INVALID");
    const next = state === model.semanticState ? model : await readMonthComposer(readDeps, household, month, state);
    const before = model.board.cockpit.plan.economicMonthEndRemainder, after = next.board.cockpit.plan.economicMonthEndRemainder;
    // Difference of two real Compiler projections, just as for an assistant candidate.
    const interactionImpact = before === null || after === null ? null : new Big(after).minus(before).toFixed(2);
    return { ok: true, sequence: request.sequence, model: await composerUiModel(deps, household, next), suggestions, mutationKind, interactionImpact };
  } catch (error) {
    const code = error instanceof TypeError ? error.message : "COMPOSER_UNAVAILABLE";
    if (request.kind === "APPLY" && !(error instanceof ControlDecisionAdmissionError) && ![
      "PLANNER_IDEMPOTENCY_CONFLICT", "PLANNER_ACTIVE_REVISION_STALE", "PLANNER_PREVIEW_STALE",
      "PLANNER_APPLY_BLOCKED", "PLANNER_PAST_MONTH_READ_ONLY", "PLANNER_EXPECTED_BASE_INVALID",
      "COMPOSER_DRAFT_REQUIRED", "PLANNER_DRAFT_MONTH_INVALID", "CONTEXT_REFERENCE_OWNER_UNAVAILABLE",
    ].includes(code)) return { ok: false, sequence: request.sequence, code: "COMPOSER_APPLY_UNCONFIRMED",
      message: "L’issue de l’application reste inconnue. Votre brouillon est conservé ; vérifiez la révision par l’identité de la demande avant toute nouvelle écriture." };
    if (request.kind === "CHECK_APPLY" && code === "COMPOSER_UNAVAILABLE")
      return { ok: false, sequence: request.sequence, code: "COMPOSER_APPLY_VERIFICATION_UNAVAILABLE",
        message: "La vérification de l’application est temporairement indisponible. Votre brouillon est conservé ; aucune nouvelle écriture n’a été lancée." };
    return { ok: false, sequence: request.sequence, code,
      message: code === "PLANNER_IDEMPOTENCY_CONFLICT" ? "Cette demande d’application a déjà servi pour un autre contenu. Votre brouillon est conservé ; actualisez la prévisualisation."
        : code === "COMPOSER_SHARED_JOURNEY_OWNER_PRICES" ? "Un trajet partagé reprend le prix et le financement de son trajet propriétaire. Retirez le prix ou financement séparé, ou choisissez un trajet propre."
        : code === "COMPOSER_PERSON_QUANTITY_USE_NIGHT_EDITOR" ? "Modifiez cette quantité par personne dans la configuration complète de la Soirée pour conserver le nombre de personnes retenu."
        : /STALE|CHANGED/u.test(code) ? "Le mois a changé. Rechargez la prévisualisation avant d’appliquer ; votre brouillon est conservé."
        : /LOCKED|BLOCKED/u.test(code) ? "Cette action n’est pas disponible. Vérifiez les contraintes et les informations manquantes."
        : "Cette proposition n’a pas pu être validée. Votre brouillon est conservé ; vérifiez les champs et réessayez." };
  }
}
