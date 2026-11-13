"use client";

import { guidedContextShape, type GuidedContextEdit } from "@/domain/phase2/planner/guided-context-edit";
import { presetForContext } from "@/domain/phase2/planner/composer-presets";
import type { RestaurantEdit } from "@/domain/phase2/planner/restaurant-edit";
import { assertRestaurantDetailsWritable, restaurantIncludedDetails, restaurantMealTariff, RESTAURANT_INCLUDED_DETAILS_LIMIT,
  type RestaurantIncludedDetail, type RestaurantDetailsDecision } from "@/domain/phase2/planner/restaurant-included-details";
import { PresetIllustration } from "./preset-illustration";
import { activityCostLabel } from "./guided-asset-labels";
import { MobilityFields } from "./mobility-fields";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, X, Users, MapPin, CalendarDays, Receipt, Plus } from "lucide-react";
import type { ComposerAssetView, ComposerContextCardView, DropTarget } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { canonicalPlannerJson } from "@/domain/phase2/planner/json";
import { componentId } from "@/domain/phase2/planner/identity";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";

import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { fresh, fromSelection, buildComponentRow, type Row } from "./night-out-components";
import { WorkshopComponentRow } from "./workshop-component-row";
import { useWorkshopRaw } from "./inline-edit-registry";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import { useActiveWorkshopQuestion } from "./workshop-choices";
import { IntentBudgetImpact } from "./intent-budget-impact";
import { WorkshopNavigation } from "./workshop-navigation";
import { workshopErrorMessage } from "./workshop-error";
import { SuggestionControls } from "./suggestion-controls";
import { ContextPalette, type PaletteQuestion } from "./context-palette";
import { cinemaSuggestions, sameCinemaExtra, type CinemaSuggestion } from "./cinema-suggestions";
import { isRestaurantBeer, restaurantBeer, restaurantSuggestions, type RestaurantSuggestion } from "./restaurant-suggestions";
import { CompactCatalogVisual } from './compact-catalog-visual';
import { CatalogOpenButton } from './catalog-discovery-provider';
import { catalogSocket, normalizeCatalog, purchaseCatalogProduct, type CatalogCommand, type GuidedCatalogChoice } from './catalog-discovery';
import type { ClayCatalogEntry } from '../clay-v22-catalog';
import { guidedAssetLabels } from "./guided-asset-labels";
import { clayV22Artwork } from '../clay-v22-media';
import { PurchaseDelivery } from "./purchase-delivery";
import { ClothingItemEditor } from "./clothing-item-editor";
import { EnablePurchaseBasket, PurchaseBasketEditor } from "./purchase-basket-editor";
import { isPurchaseBasket, type BasketConcept } from "@/domain/phase2/planner/purchase-basket";
import { clothingItem, isClothingPurchase } from "@/domain/phase2/planner/composer-library-index";
import { publishedDrop } from "./interactions";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { money } from "./display";
import styles from "./composer.module.css";

type Component = Extract<ComponentSelectionV1, { kind: "COMPONENT" }>;
type Step = "product" | "participants" | "place" | "date" | "budget" | "binding" | "complete" | "included" | "shipping" | null;
type IncludedBuffer = { id: string; mealSelectionId: string; label: string; amount: string; quantity: string; unitBasis: "" | "ITEM" | "PERSON" | "SHARED" };
const includedDrink = restaurantBeer.label;
const restaurantQuestions = [{ id: "participants", key: "participantRefs", title: "Qui vient au restaurant ?" },
  { id: "place", key: "placeRef", title: "Où allez-vous manger ?" },
  { id: "date", key: "plannedDate", title: "Quand est prévu ce restaurant ?" },
  { id: "budget", key: "meal", title: "Quel budget pour l’addition ?" },
  { id: "binding", key: "binding", title: "Dans quel budget ?" }] as const;
const items = (context: PlannedContextState, slot: string) => (context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
const components = (context: PlannedContextState, slot: string) => items(context, slot).filter((item): item is Component => item.kind === "COMPONENT");
const isDetailed = (context: PlannedContextState) => components(context, "extras").length > 0
  || components(context, guidedContextShape(context.templateKey).slot).some(item => item.quantity !== "1" && item.quantity !== "1.00" || item.unitBasis === "PERSON");
const priceCaption = (item?: Component) => !item ? "À préciser" : item.cost.kind === "MANUAL"
  ? `${item.quantity === "1" || item.quantity === "1.00" ? "" : `${item.quantity} × `}${money(item.cost.unitAmount)}`
  : item.cost.kind === "QUOTE" ? "Devis conservé" : "Prix à préciser";

/** Guided presentation shared with three admitted L2 recipes; one existing semantic Draft/scheduler. */
type RestaurantEditorProps = {
  context: PlannedContextState; card: ComposerContextCardView; model: ComposerUiModel; creating: boolean; busy: boolean;
  decide: (operation: ComposerOperation) => boolean; close: () => void;
  dismissedSuggestions?: readonly string[]; updateSuggestionDismissal?: (occurrenceId: string, key: string | null) => void;
  catalogChoice?: GuidedCatalogChoice;
  initialConcept?: BasketConcept;
};
export function RestaurantEditor(props: RestaurantEditorProps) {
  if (isPurchaseBasket(props.context)) return <PurchaseBasketEditor {...props} />;
  return !props.creating && isClothingPurchase(props.context) && clothingItem(props.context)
    ? <ClothingItemEditor {...props} /> : <GuidedRestaurantEditor {...props} />;
}
function GuidedRestaurantEditor({ context, card, model, creating, busy, decide, close, dismissedSuggestions = [], updateSuggestionDismissal, catalogChoice }: RestaurantEditorProps) {
  const baseShape = guidedContextShape(context.templateKey), preset = presetForContext(context);
  const cinema = preset?.presetKey === "cinema";
  const activity = context.templateKey === "activity" && !!preset;
  const activityMainLabel = activityCostLabel(preset?.presetKey);
  const restaurant = context.templateKey === "restaurant";
  const labels = guidedAssetLabels(context.templateKey, preset?.presetKey);
  const confirm = useWorkshopConfirmation(), activeQuestion = useActiveWorkshopQuestion();
  const purchaseEnvelope = context.fields.budgetDomain === "clothing" ? "Vêtements" : context.fields.budgetDomain === "home-small" ? "Petits achats maison" : context.fields.budgetDomain === "games-digital" ? "Jeux/Numérique" : null;
  const purchase = context.templateKey === "purchase";
  const shape = purchase ? { ...baseShape, envelope: purchaseEnvelope, complement: "Frais ou complément distinct" } : baseShape;
  const quickPurchase = context.templateKey === "purchase" && !!preset && !isDetailed(context);
  const mainSlot = shape.slot, heading = typeof context.fields.productLabel === "string" ? context.fields.productLabel : card.label;
  const mainLabel = activity ? activityMainLabel : context.templateKey === "purchase" && typeof context.fields.productLabel === "string" ? context.fields.productLabel : shape.total;
  const operation = (edit: GuidedContextEdit & Pick<RestaurantEdit, "includedDetails" | "includedDetailsAfterMealChange">): ComposerOperation => context.templateKey === "restaurant" ? { kind: "EDIT_RESTAURANT", edit: edit as RestaurantEdit } : { kind: "EDIT_PRESET_CONTEXT", edit };
  const questions: readonly {id: Exclude<Step,null>; key: string; title:string}[] = [
    ...(context.templateKey === "purchase" ? [{id:"product" as const,key:"productLabel",title:"Quel article ou achat préparez-vous ?"}] : []),
    ...restaurantQuestions.filter(q => (q.id !== "participants" || shape.participants) && (q.id !== "binding" || !!shape.envelope)).map(q => ({...q,key:q.key === "meal" ? mainSlot : q.key,title:preset ? ({participants:"Qui est concerné ?",place:"Où prévoyez-vous ce moment ?",date:"Quand ? Vous pouvez décider plus tard.",budget:"Quel budget souhaitez-vous prévoir ?",binding:"Dans quelle enveloppe ?"}[q.id]) : q.title}))];
  const main = components(context, mainSlot)[0], extras = components(context, "extras");
  const contextId = context.contextOccurrenceId;
  const cinemaLocked = (ref: string) => model.semanticState.preferences.anchors.includes(ref)
    || model.semanticState.preferences.flexibility[ref] === "PRESERVE";
  const cinemaSelectionLocked = (slotKey: string, selectionId: string) => cinemaLocked(componentId(contextId, slotKey, selectionId));
  const activityWritable = activity && card.contextOccurrenceId === contextId && card.templateKey === "activity"
    && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT") && !cinemaLocked(contextId);
  const socketTarget = (slotKey: string): DropTarget => ({ kind: "CONTEXT_SOCKET", contextOccurrenceId: contextId, slotKey });
  const activitySlot = (slotKey: string) => activityWritable && card.sockets.find(socket => socket.slotKey === slotKey
    && socket.contextOccurrenceId === contextId && socket.capabilityRefs.includes(
      `activity:${slotKey}:${slotKey === "transport" ? "SELECT_MOBILITY_INTENT" : "SELECT_COMPONENT"}`));
  const activityTicketSocket = activitySlot("main"), activityExtrasSocket = activitySlot("extras");
  const activityTicket = !!activityTicketSocket && activityTicketSocket.cardinality === "REQUIRED_ONE"
    && !!activityTicketSocket.choiceAssetKeys?.includes("option:activity:main:activity") && items(context, mainSlot).length <= 1
    && (main ? main.optionKey === shape.option && !cinemaSelectionLocked("main", main.selectionId)
      : publishedDrop(model, "option:activity:main:activity", socketTarget("main"))?.semanticAction === "PATCH_CONTEXT");
  const activityExtras = !!activityExtrasSocket && activityExtrasSocket.cardinality === "REPEATING"
    && !!activityExtrasSocket.choiceAssetKeys?.includes("option:activity:extras:extra")
    && publishedDrop(model, "option:activity:extras:extra", socketTarget("extras"))?.semanticAction === "PATCH_CONTEXT";
  const included = restaurantIncludedDetails(context);
  const [includedRow, setIncludedRow] = useState<IncludedBuffer | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [summaryPage, setSummaryPage] = useState(0), [extraPage, setExtraPage] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [person, setPerson] = useState<ProspectivePersonRef>();
  const [place, setPlace] = useState<ProspectivePlaceRef | undefined>(context.fields.placeRef as ProspectivePlaceRef | undefined ?? undefined);
  const [date, setDate] = useState(String(context.fields.plannedDate ?? ""));
  const [row, setRow] = useState<Row>(() => main ? fromSelection(main) : { ...fresh(mainLabel),
    unitBasis: activity ? "ITEM" : "SHARED", ...(quickPurchase ? { costMode: "MANUAL" } : {}) });
  const [detail, setDetail] = useState(isDetailed(context));
  const [extraRow, setExtraRow] = useState<Row | null>(null);
  const [extraAdded, setExtraAdded] = useState(false);
  const [equipment, setEquipment] = useState<{ asset: ComposerAssetView; target: DropTarget; focusField?: string } | null>(null);
  const [equipmentValues, setEquipmentValues] = useState<Record<string, string>>({});
  const [allOptions, setAllOptions] = useState(false), [error, setError] = useState("");
  const [restaurantChoices, setRestaurantChoices] = useState(false);
  const [raw, setRaw] = useState(false);
  const includedSignature = canonicalPlannerJson(included), priorIncluded = useRef(includedSignature);
  useEffect(() => {
    if (priorIncluded.current === includedSignature) return;
    priorIncluded.current = includedSignature;
    setIncludedRow(null); setRaw(false);
    setStep(previous => previous === "included" ? "complete" : previous);
  }, [includedSignature]);
  const panel = useRef<HTMLElement>(null);
  const mealSignature = canonicalPlannerJson(main??null), priorMeal = useRef(mealSignature), admittedMode = useRef<{signature:string;detail:boolean}|null>(null);
  const ticketSignature = useRef<string | null>(null);
  const extraEdit = useRef<{ signature: string } | { suggestedLabel: string | null } | null>(null);
  const transportSignature = useRef<string | null>(null);
  const catalogArticleId = useRef<string | null>(null);
  const handledCatalogChoice = useRef<GuidedCatalogChoice | undefined>(undefined);
  const purchaseLineDigest = useRef("");
  purchaseLineDigest.current = mealSignature;
  // A confirmed semantic change (including Undo/Redo) supersedes the input buffer.
  // An ordinary Preview of the same decision must not erase text being entered.
  useEffect(() => {
    if (priorMeal.current === mealSignature || catalogArticleId.current || activity && (step === "budget" || raw)) return;
    priorMeal.current = mealSignature;
    setRow(main ? fromSelection(main) : { ...fresh(mainLabel), unitBasis: activity ? "ITEM" : "SHARED" });
    setDetail(admittedMode.current?.signature===mealSignature?admittedMode.current.detail:isDetailed(context)); setExtraRow(null);
  }, [mealSignature, main, context, mainLabel, activity, step, raw]);
  const refs = Array.isArray(context.fields.participantRefs) ? context.fields.participantRefs as ProspectivePersonRef[] : [];
  const personLabel = (ref: ProspectivePersonRef) => ref.kind === "HOUSEHOLD_PERSON"
    ? model.householdPersons.find(p => p.personId === ref.personId)?.displayName ?? "Personne indisponible" : ref.kind === "TEXT" ? ref.label : ref.contactKey;
  const placeLabel = context.fields.placeRef as ProspectivePlaceRef | null | undefined;
  const binding = main?.binding?.mode;
  const bindingLabel = binding === "CONFIRMED_CONSUMPTION" ? "Inclus dans Restaurants habituels"
    : binding === "EXTRA_TO_SLOT" ? "Une dépense en plus" : binding === "NO_RELATED_SLOT" ? "Sans enveloppe liée" : "Selon l’enveloppe · à confirmer";
  const known = model.cardKnowledge[`template:${context.templateKey}`];
  const suggestion = known?.dimensions.find(d => d.key === "UNIT_PRICE" && d.value !== null && d.suggestionPolicy === "OFFER_PREFILL");
  const resetBuffer = () => {
    catalogArticleId.current = null;
    setRaw(false); setError(""); setExtraRow(null); setIncludedRow(null); setEquipment(null); setPerson(undefined);
    setDate(String(context.fields.plannedDate ?? "")); setPlace(context.fields.placeRef as ProspectivePlaceRef | undefined ?? undefined);
    setRow(main ? fromSelection(main) : { ...fresh(activity ? mainLabel : shape.total), unitBasis: activity ? "ITEM" : "SHARED" });
    setDetail(admittedMode.current?.signature===mealSignature?admittedMode.current.detail:isDetailed(context)); setFormKey(key => key + 1);
  };
  const leaveRaw = useWorkshopRaw(context.contextOccurrenceId, raw, resetBuffer);
  const open = (next: Step) => {
    if (!leaveRaw(() => open(next))) return;
    catalogArticleId.current = null;
    if (activity && next === "budget") ticketSignature.current = mealSignature;
    setStep(next); setRestaurantChoices(false); setError(""); setExtraRow(null); setIncludedRow(null); setExtraAdded(false); setEquipment(null); setFormKey(k => k + 1);
    setDate(String(context.fields.plannedDate ?? "")); setPlace(context.fields.placeRef as ProspectivePlaceRef | undefined ?? undefined);
    setRow(main ? fromSelection(main) : { ...fresh(mainLabel), unitBasis: activity ? "ITEM" : "SHARED" });
    setDetail(purchase || (admittedMode.current?.signature===mealSignature?admittedMode.current.detail:isDetailed(context)));
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>(step === null ? "h2" : "[data-restaurant-focus]")?.focus({ preventScroll: step === null });
      if (step === null && panel.current) panel.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [step, formKey]);
  const send = (operation: ComposerOperation) => {
    setError("");
    if (activity && operation.kind === "EDIT_PRESET_CONTEXT") {
      const invalidSlot = Object.entries(operation.edit.slots ?? {}).some(([key, next]) => {
        if (!activitySlot(key)) return true;
        return items(context, key).some(old => {
          if (!cinemaSelectionLocked(key, old.selectionId)) return false;
          const replacement = next?.find(item => item.selectionId === old.selectionId) ?? null;
          return canonicalPlannerJson(old) !== canonicalPlannerJson(replacement);
        });
      });
      if (!activityWritable || invalidSlot) {
        setError("Ce poste est indisponible pour cette sortie. Votre saisie est conservée."); return false;
      }
    }
    try { if (!decide(operation)) { setError("Ce choix ne peut pas être admis. Votre brouillon est conservé."); return false; } setRaw(false); return true; }
    catch (failure) { setError(workshopErrorMessage(failure)); return false; }
  };
  const advance = (_answeredStep: Step) => { setStep(null); setSummaryPage(0); };
  const fields = (patch: Record<string, PlannerJson>, id: Step) => {
    if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, fields: patch }))) advance(id);
  };
  const saveBudget = (selectedRow = row, replaceConfirmed = false, includedDecision?: RestaurantDetailsDecision): boolean => {
    try {
      if (activity) {
        if (!activityTicket || ticketSignature.current !== mealSignature) {
          setError("Ce poste a changé ou est indisponible. Rouvrez-le depuis le résumé."); return false;
        }
        const item = buildComponentRow(selectedRow, shape.option);
        if (!send(operation({ contextOccurrenceId: contextId, slots: { main: [item] } }))) return false;
        advance("budget"); return true;
      }
      const item = buildComponentRow({ ...selectedRow, edited: true }, shape.option);
      if(catalogArticleId.current===item.selectionId){
        if(!purchaseArticleAvailable()){
          setError("Cet achat a changé. Rouvrez l’article depuis sa carte."); return false;
        }
        if(!send(operation({contextOccurrenceId:contextId,fields:{productLabel:item.label},slots:{item:[item]}})))return false;
        catalogArticleId.current=null;
        advance("budget"); return true;
      }
      if (included && !includedDecision && restaurantMealTariff(context) !== restaurantMealTariff({
        ...context, slotSelections: { ...context.slotSelections, meal: { items: [item] } } })) {
        confirm({ message: "Le montant de l’addition change. Les détails sont-ils toujours compris dans cette addition ?",
          acceptLabel: "Conserver les détails inclus", cancelLabel: "Continuer à modifier",
          accept: () => { saveBudget(selectedRow, replaceConfirmed, "KEEP_CONFIRMED"); },
          save: { label: "Retirer les détails inclus", run: () => saveBudget(selectedRow, replaceConfirmed, "REMOVE_ALL") } });
        return false;
      }
      if (!purchase && !detail && extras.length && !replaceConfirmed) {
        confirm({ message: "Remplacer les postes par ce coût total ? Les compléments seront retirés une seule fois. Undo restaure le détail.",
          acceptLabel: "Remplacer par ce total", accept: () => { saveBudget(selectedRow, true, includedDecision); } }); return false;
      }
      admittedMode.current={signature:canonicalPlannerJson(item),detail};
      if (send(operation({ contextOccurrenceId: context.contextOccurrenceId,
        slots: { [mainSlot]: [item], ...(!purchase && !detail ? { extras: [] } : {}) },
        ...(includedDecision ? { includedDetailsAfterMealChange: includedDecision } : {}) }))) { advance("budget"); return true; }
      return false;
    } catch (failure) { setError(workshopErrorMessage(failure)); return false; }
  };
  const openIncluded = (item?: RestaurantIncludedDetail, label = "") => {
    if (!leaveRaw(() => openIncluded(item, label))) return;
    if (!main) { open("budget"); setError("Précisez d’abord l’addition à laquelle rattacher ce détail."); return; }
    setIncludedRow({ id: item?.detailId ?? crypto.randomUUID(), mealSelectionId: main.selectionId, label: item?.label ?? label,
      amount: item?.amount.kind === "DECLARED_LINE_TOTAL" ? item.amount.value : "", quantity: item?.quantity ?? "", unitBasis: item?.unitBasis ?? "" });
    setStep("included"); setExtraRow(null); setEquipment(null); setError(""); setFormKey(key => key + 1);
  };
  const saveIncluded = () => {
    if (!includedRow) return;
    if (main?.selectionId !== includedRow.mealSelectionId) {
      setError("L’addition a changé. Rouvrez le détail depuis l’addition actuelle."); return;
    }
    const item: RestaurantIncludedDetail = { detailId: includedRow.id, label: includedRow.label.trim(), included: true,
      quantity: includedRow.quantity.trim() ? includedRow.quantity.trim().replace(",", ".") : null, unitBasis: includedRow.unitBasis || null,
      amount: includedRow.amount.trim() ? { kind: "DECLARED_LINE_TOTAL", value: includedRow.amount.trim().replace(",", ".") } : { kind: "UNKNOWN" },
      provenance: "EXPLICIT_USER_DECISION" };
    if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, includedDetails: { version: "restaurant-included-details@v1",
      mealSelectionId: includedRow.mealSelectionId, items: [...(included?.items ?? []).filter(old => old.detailId !== item.detailId), item] } }))) {
      setIncludedRow(null); advance("included");
    }
  };
  const chooseMode = (next: boolean) => {
    if(next===detail)return;
    const prepare=()=>{setDetail(next);setStep("budget");setRaw(true);setRow(previous=>({...previous,label:next?mainLabel:shape.total,quantity:"1",unitBasis:"SHARED",personCount:"",amount:"",costMode:"UNKNOWN",edited:true,fundingMode:"UNDECIDED",fundingAmount:""}));};
    if(!main&&!extras.length){prepare();return;}
    confirm({message:next?"Remplacer le total par les postes ? 45 € + 15 € font 60 €, pas 120 €. Les décisions restent inchangées tant que le nouveau coût n’est pas validé.":"Préparer un coût total à la place du détail ? Les postes seront retirés uniquement après confirmation du nouveau montant.",acceptLabel:next?"Préparer les postes":"Préparer le total",accept:prepare});
  };
  const equip = (asset: ComposerAssetView, target: DropTarget, selection?: ComponentSelectionV1, outsideConfirmed = false, focusField?: string) => {
    const socket = card.sockets.find(candidate => candidate.slotKey === target.slotKey);
    if (target.kind !== "CONTEXT_SOCKET" || target.contextOccurrenceId !== contextId || card.readOnly
      || !card.capabilityRefs.includes("PATCH_CONTEXT") || cinemaLocked(contextId)
      || !socket?.choiceAssetKeys?.includes(asset.assetKey)
      || publishedDrop(model, asset.assetKey, target)?.semanticAction !== "PATCH_CONTEXT") return;
    if (asset.optionKind === "COMPONENT" ? socket.slotKey !== mainSlot && socket.slotKey !== "extras"
      : asset.optionKind !== "MOBILITY_INTENT" || !shape.transport || socket.slotKey !== "transport") return;
    if (selection && (cinemaSelectionLocked(socket.slotKey, selection.selectionId)
      || !socket.currentItems.some(item => item.selectionId === selection.selectionId && item.kind === selection.kind
        && item.optionKey === selection.optionKey))) return;
    if (!leaveRaw(() => equip(asset, target, selection, outsideConfirmed, focusField))) return;
    if (activity && !activitySlot(socket.slotKey)) return;
    setError("");
    if (asset.optionKind === "COMPONENT") {
      if (target.slotKey === mainSlot) { open("budget"); return; }
      const matching = extras.filter(item => item.optionKey === asset.optionKey);
      if (!selection && matching.length > 1) { setAllOptions(false); open("complete"); return; }
      const existing = selection ? matching.find(item => item.selectionId === selection.selectionId) : matching[0];
      if (selection && !existing || existing && cinemaSelectionLocked("extras", existing.selectionId)) return;
      if (!existing && !detail && main && !outsideConfirmed) {
        confirm({ message: "Ce poste est-il réellement en plus du montant déjà prévu ? S’il est inclus, gardez le total ou remplacez-le par le détail.",
          cancelLabel: "Déjà inclus · garder le total", acceptLabel: "Supplément réel", accept: () => equip(asset, target, selection, true) }); return;
      }
      extraEdit.current = activity && existing ? { signature: canonicalPlannerJson(existing) } : null;
      setExtraRow(existing ? fromSelection(existing) : fresh(shape.complement));
    } else {
      if (activity && !activityModes.some(mode => mode.assetKey === asset.assetKey)) return;
      if (activity || restaurant) transportSignature.current = canonicalPlannerJson(currentTransport ?? null);
      setExtraRow(null); setEquipment({ asset, target, focusField });
      const previous = asset.optionKey === currentTransport?.optionKey ? transportValues : {
        origin: transportValues.origin ?? "", destination: transportValues.destination ?? "",
        returnRequired: transportValues.returnRequired ?? "false" };
      setEquipmentValues(Object.fromEntries((model.editors.find(editor => editor.assetKey === asset.assetKey)?.fields ?? [])
        .map(field => [field.key, previous[field.key as keyof typeof previous] ?? field.initial ?? field.choices?.[0]?.value ?? ""])));
      setFormKey(k => k + 1); }
    setAllOptions(false); setStep("complete");
  };
  const currentTransport = items(context, "transport").find(item => item.kind === "MOBILITY_INTENT");
  const completeTitle = activity ? "Compléments et trajet" : labels.extras;
  const transportSocket = activitySlot("transport");
  const activityModes = (transportSocket && transportSocket.cardinality === "OPTIONAL_ONE"
    && (!currentTransport || !cinemaSelectionLocked("transport", currentTransport.selectionId)) ? transportSocket.choiceAssetKeys ?? [] : [])
    .flatMap(key => {
      const asset = model.library.searchableAssets.find(candidate => candidate.assetKey === key);
      return asset?.optionKind === "MOBILITY_INTENT" && publishedDrop(model, key, socketTarget("transport"))?.semanticAction === "PATCH_CONTEXT"
        && model.editors.some(editor => editor.assetKey === key) ? [asset] : [];
    });
  const activityMode = activityModes.find(asset => asset.optionKey === (currentTransport?.optionKey ?? "taxi"));
  const parkingAsset = currentTransport?.optionKey === "car" && !cinemaSelectionLocked("transport", currentTransport.selectionId)
    ? model.library.searchableAssets.find(asset => asset.optionKind === "MOBILITY_INTENT" && asset.optionKey === "car"
      && asset.templateKey === context.templateKey && publishedDrop(model, asset.assetKey, socketTarget("transport"))?.semanticAction === "PATCH_CONTEXT") : undefined;
  const activityComplements = activityExtras || activityModes.length > 0;
  const transportValues: Record<string, string> = currentTransport ? {
    origin: currentTransport.origin?.kind === "TEXT" ? currentTransport.origin.label : "",
    destination: currentTransport.destination?.kind === "TEXT" ? currentTransport.destination.label : "",
    returnRequired: String(!!currentTransport.returnRequired), plannedTime: currentTransport.plannedTime ?? "", returnTime: currentTransport.returnTime ?? "",
    ...{
      amount: currentTransport.pricing?.fare.kind === "MANUAL" ? currentTransport.pricing.fare.unitAmount : "",
      funding: currentTransport.pricing?.fundingAllocations.length ? currentTransport.pricing.fundingAllocations.some(a => a.source !== "BANK") ? "EXISTING" : "BANK" : "",
      fundingAmount: currentTransport.pricing?.fundingAllocations[0]?.amount ?? "", preference: currentTransport.pricing?.preference ?? "FASTEST",
      parkingMode: currentTransport.pricing?.parking.kind === "MANUAL" ? Number(currentTransport.pricing.parking.unitAmount) === 0 ? "NO" : "YES" : currentTransport.pricing?.parking.kind === "QUOTE" ? "EXISTING" : "UNKNOWN",
      parkingAmount: currentTransport.pricing?.parking.kind === "MANUAL" ? currentTransport.pricing.parking.unitAmount : "",
      targetIntentId: currentTransport.journey?.targetIntentId ?? "" } } : {};
  const summaryEntries: { id: Exclude<Step, null>; icon: ReactNode; label: string; caption: string; disabled?: boolean }[] = [
    { id: "budget", icon: cinema?<CompactCatalogVisual src={clayV22Artwork('v22-art:excel:329')!.src} visualConceptId="v22-art:excel:329" iconKey="activity" size={40}/>:<Receipt size={16} />, label: activity ? main?.label ?? mainLabel : detail ? "Postes prévus" : shape.total,
      caption: activity && !main ? activityTicket ? "Facultatif · préparer" : !card.sockets.length?"Sélection à confirmer · catalogue consultable":"Poste indisponible" : `${priceCaption(main)}${!cinema && extras.length ? ` · ${extras.length} complément(s)` : ""}`,
      disabled: activity && !activityTicket },
    ...(activity ? [{ id: "date" as const, icon: <CalendarDays size={16} />, label: cinema ? "Séance" : "Date", caption: String(context.fields.plannedDate ?? "Jour facultatif"), disabled: !activityWritable },
      { id: "complete" as const, icon: <MapPin size={16} />, label: completeTitle, caption: "Choix facultatifs", disabled: !activityComplements }] : []),
    ...(context.templateKey === "purchase" ? [
      { id: "product" as const, icon: <Receipt size={16} />, label: "Article et vendeur", caption: String(context.fields.productLabel ?? "À préciser") },
      ...(!creating ? [{ id: "shipping" as const, icon: <MapPin size={16} />, label: "Vendeur, livraison et frais", caption: String(context.fields.merchantLabel ?? "Vendeur à préciser") }] : []),
    ] : []),
    ...(refs.length ? [{ id: "participants" as const, icon: <Users size={16} />, label: "Participants", caption: refs.map(personLabel).join(", ") }] : []),
    ...(context.templateKey === "restaurant" && !creating ? [{ id: "complete" as const, icon: <Receipt size={16} />,
      label: completeTitle, caption: included ? included.items.length === 1 ? "1 détail compris" : `${included.items.length} détails compris`
        : "Détails compris et suppléments" }] : []),
    ...(placeLabel ? [{ id: "place" as const, icon: <MapPin size={16} />, label: "Lieu", caption: placeLabel.kind === "TEXT" ? placeLabel.label
      : model.mobilityOptions?.places.find(p => p.placeId === placeLabel.placeId)?.name ?? "Lieu lié indisponible" }] : []),
    ...(!activity && context.fields.plannedDate ? [{ id: "date" as const, icon: <CalendarDays size={16} />, label: "Date", caption: String(context.fields.plannedDate) }] : []),
    ...(shape.envelope && binding && binding !== "AUTO" ? [{ id: "binding" as const, icon: <Check size={16} />, label: "Enveloppe", caption: bindingLabel.replaceAll("Restaurants", shape.envelope) }] : []),
    ...(!activity && shape.transport && currentTransport ? [{ id: "complete" as const, icon: <MapPin size={16} />, label: "Transport", caption: currentTransport.optionKey }] : []),
  ];
  const summaryPageSize = 3;
  const addExtra = (label: string = shape.complement, suggestion?: "UNIQUE" | "DISTINCT") => {
    if (activity && !activityExtras) return;
    const add = () => {
      extraEdit.current = suggestion ? { suggestedLabel: suggestion === "UNIQUE" ? label : null } : null;
      setExtraAdded(false); setExtraRow(fresh(label)); setStep("complete");
      if (activity) setFormKey(key => key + 1);
    };
    if (!leaveRaw(() => addExtra(label, suggestion))) return;
    if (!detail && main) confirm({message:"Ce poste est-il inclus dans le coût déjà prévu ? Un supplément réel sera additionné. Pour décrire un montant inclus, utilisez le détail.",cancelLabel:"Inclus · garder le total",acceptLabel:"Supplément réel",accept:add}); else add();
  };
  const editExtra = (item: Component, suggested = false) => {
    if (cinemaSelectionLocked("extras", item.selectionId) || !leaveRaw(() => editExtra(item, suggested))) return;
    if (activity) {
      if (!activityExtrasSocket) return;
    }
    extraEdit.current = activity || suggested ? { signature: canonicalPlannerJson(item) } : null;
    setEquipment(null); setStep("complete"); setFormKey(key => key + 1);
    setExtraRow(fromSelection(item));
  };
  const extraIsCurrent = (rowId: string, label: string) => {
    const expected = extraEdit.current;
    if (!expected) return true;
    const restaurantSocket = restaurant && catalogSocket(model, contextId, "extras", "option:restaurant:extras:extra")?.socket;
    const available = activity ? activityExtras : !!restaurantSocket && restaurantSocket.cardinality === "REPEATING"
      && restaurantSocket.capabilityRefs.includes("restaurant:extras:SELECT_COMPONENT");
    if ("signature" in expected) {
      if (available && !cinemaSelectionLocked("extras", rowId)
        && canonicalPlannerJson(extras.find(item => item.selectionId === rowId) ?? null) === expected.signature) return true;
      setError("Ce complément a changé. Rouvrez-le depuis les choix de cette sortie.");
    } else {
      const proposed = expected.suggestedLabel;
      if (available && (proposed === null || !extras.some(item => sameCinemaExtra(item.label, proposed) || sameCinemaExtra(item.label, label))
        && (!restaurant || !included?.items.some(item => sameCinemaExtra(item.label, proposed) || sameCinemaExtra(item.label, label))))) return true;
      setError("Ce complément est déjà présent ou indisponible. Votre saisie est conservée.");
    }
    return false;
  };
  const tile = (key:string,label:string,choose:()=>void,iconKey="restaurant",hint?:string,selected?:boolean) => ({key,label,choose,iconKey,hint,selected});
  const showOptions = () => { if (leaveRaw(() => setAllOptions(true))) setAllOptions(true); };
  const canSuggestIncludedDrink = () => {
    if (creating || context.templateKey !== "restaurant" || card.templateKey !== "restaurant"
      || card.contextOccurrenceId !== context.contextOccurrenceId || card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT")
      || main?.optionKey !== "restaurant" || items(context, "meal").length !== 1
      || (included?.items.length ?? 0) >= RESTAURANT_INCLUDED_DETAILS_LIMIT) return false;
    if ([...(included?.items ?? []), ...extras].some(item => isRestaurantBeer(item.label))) return false;
    try { assertRestaurantDetailsWritable(model.semanticState, context); return true; }
    catch (error) {
      if (error instanceof TypeError && error.message === "COMPOSER_CONTEXT_LOCKED") return false;
      throw error;
    }
  };
  const transportTarget = socketTarget("transport");
  const modes = shape.transport ? (card.sockets.find(socket=>socket.slotKey==="transport")?.choiceAssetKeys ?? [])
    .filter(key=>publishedDrop(model,key,transportTarget)?.semanticAction==="PATCH_CONTEXT") : [];
  const summaryChoices = [tile("amount",labels.amount,()=>open("budget"),card.templateKey,"Sans date ni participants obligatoires"),
    tile("detail",labels.detail,()=>{if(purchase){open("budget");return;}if (!leaveRaw(() => { open("budget"); if(!detail) chooseMode(true); })) return; open("budget"); if(!detail) chooseMode(true); }),
    tile("extras",labels.extras,()=>open("complete"),"activity"),
    ...(context.templateKey === "restaurant" ? [tile("included", "Déjà compris dans l’addition", () => openIncluded(), "restaurant",
      included ? `${included.items.length} détail(s) conservé(s)` : "Décrire sans augmenter l’addition")] : []),
    ...(context.templateKey==="purchase"?[tile("product","Article / vendeur",()=>open("product"),"purchase")]:[tile("place",context.templateKey==="activity"?"Destination":context.templateKey==="delivery"?"Lieu de livraison":"Lieu / restaurant",()=>open("place"),"family-visit")]),
    ...(context.templateKey === "purchase" && !creating ? [tile("shipping", "Livraison — Examiner pour cet achat",
      () => open("shipping"), "purchase", "Règle métier · aucune dépense ajoutée")] : []),
    ...(shape.participants?[tile("people","Personnes",()=>open("participants"),"family-visit")]:[]),
    ...(shape.envelope?[tile("binding","Enveloppe liée",()=>open("binding"),"purchase")]:[]),tile("date","Date facultative",()=>open("date"),"activity"),
    tile("all-options","Autres postes admissibles",showOptions,"activity"),...modes.flatMap(key=>{const asset=model.library.searchableAssets.find(a=>a.assetKey===key);return asset?[tile(key,asset.label,()=>equip(asset,{kind:"CONTEXT_SOCKET",contextOccurrenceId:context.contextOccurrenceId,slotKey:"transport"}),asset.iconKey)]:[]})];
  const extraNames = labels.examples;
  const backToSummary = tile("summary", "Retour au résumé", () => open(null), "activity");
  const showCinemaSuggestions = cinema && (step === null || step === "complete" && !extraRow && !equipment);
  const cinemaCatalogSuggestions = cinema ? cinemaSuggestions({
    contextOccurrenceId: contextId, writable: activityWritable, ticketAllowed: activityTicket, ticket: main,
    dayChosen: !!context.fields.plannedDate,
    placeChosen: placeLabel?.kind === "TEXT" ? !!placeLabel.label.trim()
      : placeLabel?.kind === "KNOWN" && !!model.mobilityOptions?.places.some(place => place.placeId === placeLabel.placeId),
    extrasAllowed: activityExtras,
    extras: extras.map(({ label, selectionId }) => ({ label, selectionId, locked: cinemaSelectionLocked("extras", selectionId) })),
    transport: activityMode && { label: activityMode.label, iconKey: activityMode.iconKey, selectionId: currentTransport?.selectionId },
    complementsOnly: false, dismissed: dismissedSuggestions,
  }, Infinity) : [];
  const rankedCinema = showCinemaSuggestions
    ? cinemaCatalogSuggestions.filter(suggestion => step !== "complete" || suggestion.category === "extra" || suggestion.category === "transport").slice(0, 4)
    : [];
  const cinemaArtwork: Readonly<Record<string, string>> = { 'billet-cinema': 'v22-art:excel:329', taxi: 'v22-art:excel:499',
    popcorn: 'v22-art:extra:popcorn', boisson: 'v22-art:extra:boisson-generale' };
  const chooseCinemaSuggestion = (suggestion: CinemaSuggestion) => {
    if (suggestion.contextOccurrenceId !== contextId) return;
    if (suggestion.category === "ticket") {
      if (activityTicket && main?.selectionId === suggestion.selectionId) open("budget");
    } else if (suggestion.category === "session") {
      if (activityWritable) open(suggestion.conceptKey === "jour-seance" ? "date" : "place");
    } else if (suggestion.category === "transport") {
      if (activityMode && currentTransport?.selectionId === suggestion.selectionId) equip(activityMode, socketTarget("transport"), currentTransport);
    } else if (suggestion.action === "EDIT") {
      const item = extras.find(item => item.selectionId === suggestion.selectionId);
      if (item) editExtra(item);
    } else if (suggestion.extraLabel) addExtra(suggestion.extraLabel, "UNIQUE");
  };
  const cinemaQuestion: PaletteQuestion | undefined = cinema ? {
    title: showCinemaSuggestions ? "Suggestions pour cette sortie" : `Préparer · ${heading}`,
    nature: showCinemaSuggestions ? "DECISION" : undefined,
    emptyLabel: "Aucune suggestion pour cette sortie. Les choix de la carte restent accessibles.",
    choices: showCinemaSuggestions ? rankedCinema.map(suggestion => {
      return { ...tile(suggestion.key, suggestion.label, () => chooseCinemaSuggestion(suggestion), suggestion.iconKey,
        suggestion.reason, suggestion.action === "EDIT" || undefined),
        visualConceptId: cinemaArtwork[suggestion.conceptKey] };
    }) : step === "date" && activityWritable ? [
      tile("place", "Cinéma — Préciser le lieu", () => open("place"), "family-visit"),
      tile("people", "Participants — Préciser", () => open("participants"), "family-visit"), backToSummary,
    ] : [backToSummary],
  } : undefined;
  const activityChoices = activity && !cinema && step === null ? [
    ...(activityTicket ? [{ ...tile("activity-main", main ? `Modifier · ${main.label}` : `Préparer · ${activityMainLabel}`,
      () => open("budget"), "activity", main ? priceCaption(main) : "Prix et quantité à préciser") }] : []),
    ...(activityWritable && !context.fields.plannedDate ? [{
      ...tile("activity-date", "Préciser la date", () => open("date"), "activity", "Le jour reste facultatif"),
    }] : []),
    ...(activityWritable && !placeLabel ? [{
      ...tile("activity-place", "Préciser le lieu", () => open("place"), "family-visit"),
    }] : []),
    ...(activityModes.length ? [{
      ...tile("activity-transport", currentTransport ? "Modifier le trajet" : "Choisir un mode de transport",
        () => {
          if (currentTransport && activityMode) equip(activityMode, socketTarget("transport"), currentTransport);
          else { open("complete"); showOptions(); }
        }, "activity", "Trajet facultatif"),
    }] : []),
  ].map(choice => ({ ...choice, key: `${contextId}:${choice.key}`, showHint: true }))
    .filter(choice => !dismissedSuggestions.includes(choice.key)) : [];
  const activityQuestion: PaletteQuestion | undefined = activityChoices.length ? {
    title: "Suggestions pour cette activité", nature: "DECISION", choices: activityChoices.slice(0, 4),
  } : undefined;
  const restaurantCandidates = restaurant ? restaurantSuggestions(context, card, model, dismissedSuggestions) : [];
  const rankedRestaurant = step === null && !restaurantChoices ? restaurantCandidates.slice(0, 4) : [];
  const chooseRestaurantSuggestion = (suggestion: RestaurantSuggestion) => {
    if (!restaurantCandidates.some(candidate => candidate.key === suggestion.key)) return;
    switch (suggestion.kind) {
      case "BUDGET": open("budget"); break;
      case "ADD_INCLUDED": openIncluded(undefined, includedDrink); break;
      case "EDIT_INCLUDED": {
        const item = included?.items.find(item => item.detailId === suggestion.selectionId);
        if (item) openIncluded(item);
        break;
      }
      case "ADD_EXTRA": addExtra(shape.complement, "DISTINCT"); break;
      case "EDIT_EXTRA": {
        const item = extras.find(item => item.selectionId === suggestion.selectionId);
        if (item) editExtra(item, true);
        break;
      }
      case "CHOOSE_LINE": setExtraPage(0); open("complete"); break;
      case "PARTICIPANTS": open("participants"); break;
      case "PLACE": open("place"); break;
      case "DATE": open("date"); break;
      case "TRANSPORT": {
        const admission = catalogSocket(model, contextId, "transport", suggestion.assetKey);
        if (admission && currentTransport?.selectionId === suggestion.selectionId) equip(admission.asset, admission.target, currentTransport);
        break;
      }
    }
  };
  const restaurantQuestion: PaletteQuestion | undefined = rankedRestaurant.length ? {
    title: "Suggestions pour ce restaurant", nature: "DECISION",
    choices: rankedRestaurant.map(suggestion => ({
      ...tile(suggestion.key, suggestion.label, () => chooseRestaurantSuggestion(suggestion), suggestion.iconKey, suggestion.hint,
        suggestion.kind === "EDIT_INCLUDED" || suggestion.kind === "EDIT_EXTRA" || undefined),
      visualConceptId: suggestion.visualConceptId,
    })),
  } : undefined;
  const question:PaletteQuestion = activeQuestion ?? cinemaQuestion ?? activityQuestion ?? restaurantQuestion ?? {title: step===null?"Construire · "+heading:step==="complete"?"Ajouter seulement ce qui est prévu":questions.find(q=>q.id===step)?.title??heading,
    choices:step===null?summaryChoices:step==="complete"&&!extraRow&&!equipment?[
      ...(canSuggestIncludedDrink() ? [tile("restaurant:included:beer", `${includedDrink} — Renseigner dans l’addition`,
        () => openIncluded(undefined, includedDrink), "restaurant", "Situation Restaurant du catalogue")] : []),
      ...extras.filter(item => !activity || activityExtras && !cinemaSelectionLocked("extras", item.selectionId))
        .map(item=>tile(item.selectionId,"Modifier "+item.label,()=>activity ? editExtra(item) : setExtraRow(fromSelection(item)),"purchase",priceCaption(item))),
      ...(!activity || activityExtras ? extraNames : []).map(label=>tile("add:"+label,context.templateKey === "restaurant" ? `${label} · en supplément` : label,()=>addExtra(label),"purchase")),
      tile("summary","Terminer",()=>open(null),"activity")]
      : step==="budget"?[...(!purchase?[tile("total","Coût total",()=>chooseMode(false),"restaurant",undefined,!detail),tile("detail","Détailler",()=>chooseMode(true),"restaurant",undefined,detail)]:[]),tile("unknown","Prix inconnu",()=>saveBudget({...row,costMode:"UNKNOWN",edited:true}),"activity"),
        ...(suggestion?[tile("reference","Prix observé "+money(suggestion.value),()=>{setRaw(true);setRow(r=>({...r,amount:suggestion.value!,costMode:"MANUAL",edited:true}));},"restaurant","À confirmer · "+suggestion.sourceAuthority)]:[]),tile("summary","Résumé",()=>open(null),"activity")]
      : step==="binding"?([['CONFIRMED_CONSUMPTION','Compris dans '+shape.envelope],['EXTRA_TO_SLOT','En plus de l’enveloppe']] as const).map(([mode,label])=>tile(mode,label,()=>{if(main&&send(operation({contextOccurrenceId:context.contextOccurrenceId,slots:{[mainSlot]:[{...main,binding:{mode}}]}})))advance("binding");},"purchase"))
      :[tile("summary","Résumé",()=>open(null),"activity"),...summaryChoices.filter(c=>c.key!==step)]};
  function purchaseArticleAvailable() {
    return context.templateKey === "purchase" && !!preset && !main
      && !String(context.fields.productLabel ?? "").trim()
      && !!catalogSocket(model, contextId, "item", "option:purchase:item:item");
  }
  const beginCatalogArticle = (label: string) => {
    if (!purchaseArticleAvailable() || !leaveRaw(() => beginCatalogArticle(label))) return;
    const article = { ...fresh(label), unitBasis: "ITEM" as const };
    catalogArticleId.current = article.id;
    setRow(article); setDetail(true); setStep("budget"); setRaw(true); setError("");
    setExtraRow(null); setEquipment(null); setFormKey(key => key + 1);
  };
  const removePurchaseArticle = () => {
    if (!purchase || !main || !catalogSocket(model,contextId,"item","option:purchase:item:item")
      || cinemaSelectionLocked("item",main.selectionId)) return;
    const ask = () => confirm({message:`Retirer « ${main.label} » ? Le vendeur, les frais et la carte d’achat sont conservés.`,
      acceptLabel:"Retirer cet article",accept:()=>{
        if(purchaseLineDigest.current!==mealSignature){setError("Cet article a changé. Rouvrez-le pour le retirer.");return;}
        if(send(operation({contextOccurrenceId:contextId,fields:{productLabel:""},slots:{item:[]}})))advance("budget");
      }});
    if(leaveRaw(ask))ask();
  };
  useEffect(() => {
    if (!catalogChoice || handledCatalogChoice.current === catalogChoice) return;
    handledCatalogChoice.current = catalogChoice;
    if (catalogChoice.kind === "article") beginCatalogArticle(catalogChoice.label);
    else equip(catalogChoice.asset, catalogChoice.target, catalogChoice.selection);
  });
  const cinemaCommands: CatalogCommand[] = cinemaCatalogSuggestions.flatMap(suggestion => {
    const visualConceptId = cinemaArtwork[suggestion.conceptKey];
    return visualConceptId ? [{ key: suggestion.key, visualConceptId, label: suggestion.category === "ticket"
      ? main ? "Modifier le billet" : "Préparer le billet" : suggestion.label,
      editsExisting: suggestion.action === "EDIT", run: () => chooseCinemaSuggestion(suggestion) }] : [];
  });
  const resolveCatalogCommands = (entry: ClayCatalogEntry): CatalogCommand[] => {
    if (purchaseArticleAvailable() && purchaseCatalogProduct(entry,context.fields.budgetDomain))
      return [{visualConceptId:entry.visualConceptId,label:`Configurer ${entry.label} dans cet achat`,run:()=>beginCatalogArticle(entry.label)}];
    if (context.templateKey !== "restaurant" || !entry.assetKeys.includes("restaurant:beer")) return [];
    const commands: CatalogCommand[] = [];
    const existingIncluded = included?.items.filter(item => isRestaurantBeer(item.label)) ?? [];
    const existingExtras = extras.filter(item => isRestaurantBeer(item.label));
    if (main && catalogSocket(model, contextId, "meal", "option:restaurant:meal:restaurant")
      && !cinemaSelectionLocked("meal", main.selectionId)) {
      if (canSuggestIncludedDrink())
        commands.push({visualConceptId:entry.visualConceptId,label:"Renseigner la bière comprise dans l’addition",run:()=>openIncluded(undefined,includedDrink)});
      existingIncluded.forEach((item,index) => commands.push({key:item.detailId,visualConceptId:entry.visualConceptId,editsExisting:true,
        label:`Modifier la bière comprise · détail ${index+1}`,run:()=>openIncluded(item)}));
    }
    if (catalogSocket(model,contextId,"extras","option:restaurant:extras:extra")) {
      if (!existingExtras.length && !existingIncluded.length)
        commands.push({visualConceptId:entry.visualConceptId,label:"Préparer une bière en supplément",run:()=>addExtra(includedDrink,"UNIQUE")});
      existingExtras.forEach((item,index) => {
        if (!cinemaSelectionLocked("extras",item.selectionId))commands.push({key:item.selectionId,visualConceptId:entry.visualConceptId,
          editsExisting:true,label:`Modifier la bière en supplément · ligne ${index+1}`,run:()=>editExtra(item,true)});
      });
    }
    return commands;
  };
  const panelContent = <aside ref={panel} className={styles.restaurantInspector} role="dialog" aria-modal="false" aria-labelledby="restaurant-heading" data-restaurant-editor data-guided-template={context.templateKey} data-cinema-editor={cinema || undefined}
    data-restaurant-suggestions={!!restaurantQuestion || undefined}
    data-purchase-editor={context.templateKey === "purchase" || undefined}
    onChangeCapture={event => { if (!(event.target instanceof Element) || !event.target.closest("[data-purchase-delivery],[data-workshop-navigation]")) setRaw(true); }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <header>{preset ? <PresetIllustration preset={preset} className={styles.presetInspectorImage} /> : <PlannerIcon iconKey="restaurant" scale="SATELLITE" />}<div><small>Votre mois, à votre façon</small><h2 id="restaurant-heading" tabIndex={-1}>{heading}</h2></div>
      <button type="button" className={styles.iconButton} onClick={close} aria-label={`Fermer ${heading}`}><X size={18} /></button></header>
    <WorkshopNavigation contextId={contextId} />
    <p className={styles.restaurantIntro}>{cinema ? "Le billet, le jour de la séance, les compléments et le trajet se préparent séparément."
      : step === null ? "Choisissez seulement ce que vous voulez prévoir. Les autres précisions restent facultatives." : "Budget = coût économique prévu, pas un plafond. Les choix validés restent conservés."}</p>
    {purchase && <EnablePurchaseBasket context={context} card={card} model={model} busy={busy} decide={decide} />}
    <CatalogOpenButton target={{contextId,moment:cinema?"cinema":context.templateKey==="purchase"?"article":context.templateKey==="restaurant"?"included":undefined,
      commands:cinemaCommands,resolveCommands:resolveCatalogCommands}}>Parcourir le catalogue de {heading}</CatalogOpenButton>
    {restaurant && step === null && restaurantCandidates.length > 0 && <button type="button" aria-pressed={restaurantChoices}
      onClick={() => setRestaurantChoices(value => !value)}>{restaurantChoices ? "Revenir aux suggestions" : "Tous les choix du restaurant"}</button>}
    {step === null ? <><nav aria-label={`Choix de ${heading}`} className={styles.restaurantSummary} data-quick-purchase={quickPurchase || undefined}>
      {summaryEntries.slice(summaryPage * summaryPageSize, (summaryPage + 1) * summaryPageSize).map(entry => <button key={entry.id} type="button" disabled={entry.disabled} onClick={() => open(entry.id)}>
        {entry.icon}<span><small>{entry.label}</small><strong>{entry.caption}</strong></span><ChevronRight size={14} /></button>)}
    </nav>{summaryEntries.length > summaryPageSize && <div className={styles.nightPage}><button type="button" disabled={summaryPage === 0} onClick={() => setSummaryPage(page => page - 1)}>Précédent</button>
      <span>{summaryPage + 1} / {Math.ceil(summaryEntries.length / summaryPageSize)}</span><button type="button" disabled={(summaryPage + 1) * summaryPageSize >= summaryEntries.length} onClick={() => setSummaryPage(page => page + 1)}>Suivant</button></div>}</>
      : <button type="button" className={styles.nightLink} onClick={() => open(null)}>← Retour au résumé</button>}
    {step === null && (restaurant || activity || purchase) && <IntentBudgetImpact model={model} contextId={contextId} />}
    {activity && !cinema && step === null && <SuggestionControls occurrenceId={contextId} choices={activityChoices}
      dismissedSuggestions={dismissedSuggestions} updateSuggestionDismissal={updateSuggestionDismissal} busy={busy} />}
    {step !== null && <div className={styles.restaurantQuestion} key={`${step}:${formKey}`}>
      <h3 data-restaurant-focus tabIndex={-1}>{step === "shipping" ? "Vendeur, livraison et frais" : cinema && step === "budget" ? (row.existing ? "Modifier le poste de cette sortie" : "Préparer un billet facultatif")
        : cinema && step === "date" ? "Préciser le jour de la séance"
          : step === "included" ? "Déjà compris dans l’addition" : quickPurchase && step === "budget" ? "Quel montant souhaitez-vous prévoir ?" : questions.find(q => q.id === step)?.title ?? (step === "complete" ? completeTitle : "Votre intention est dans le brouillon")}</h3>
      {step === "included" && includedRow && <form onSubmit={event => { event.preventDefault(); saveIncluded(); }}>
        <p>Ce détail est compris dans l’addition. Son montant décrit toute la ligne et ne s’ajoute pas au coût prévu.</p>
        <label>Nature du détail<input autoFocus value={includedRow.label} maxLength={1024} onChange={event => { setRaw(true); setIncludedRow({ ...includedRow, label: event.target.value }); }} /></label>
        <label>Montant de la ligne compris (€)<input inputMode="decimal" placeholder="Inconnu" value={includedRow.amount} onChange={event => { setRaw(true); setIncludedRow({ ...includedRow, amount: event.target.value }); }} /></label>
        <label>Quantité descriptive facultative<input inputMode="decimal" placeholder="Inconnue" value={includedRow.quantity} onChange={event => { setRaw(true); setIncludedRow({ ...includedRow, quantity: event.target.value }); }} /></label>
        <label>Unité descriptive<select value={includedRow.unitBasis} onChange={event => { setRaw(true); setIncludedRow({ ...includedRow, unitBasis: event.target.value as IncludedBuffer["unitBasis"] }); }}>
          <option value="">Inconnue</option><option value="ITEM">Élément</option><option value="PERSON">Personne</option><option value="SHARED">Partagé</option>
        </select></label>
        <p>La quantité et les participants ne multiplient pas ce montant. Un champ vide reste inconnu.</p>
        <button type="submit" disabled={busy || !includedRow.label.trim()}>Conserver ce détail inclus</button>
      </form>}
      {step === "shipping" && context.templateKey === "purchase" && !creating && <PurchaseDelivery
        context={context} card={card} model={model} busy={busy} decide={decide} back={() => open(null)} />}
      {step === "product" && <><label>Article ou commande<input defaultValue={String(context.fields.productLabel ?? "")} name="productLabel" /></label><label>Vendeur facultatif<input defaultValue={String(context.fields.merchantLabel ?? "")} name="merchantLabel" /></label>
        <label>Enveloppe liée à cet achat<select name="budgetDomain" defaultValue={String(context.fields.budgetDomain ?? "")}><option value="">À préciser</option>
          {model.editors.find(editor => editor.assetKey === "template:purchase")?.fields.find(field => field.key === "budgetDomain")?.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
        <button type="button" onClick={() => { const product = panel.current?.querySelector<HTMLInputElement>('input[name="productLabel"]')?.value ?? ""; const merchant = panel.current?.querySelector<HTMLInputElement>('input[name="merchantLabel"]')?.value ?? ""; const domain = panel.current?.querySelector<HTMLSelectElement>('select[name="budgetDomain"]')?.value ?? ""; fields({productLabel:product || null,merchantLabel:merchant || null,budgetDomain:domain || null},"product"); }}>Conserver ces précisions</button></>}
      {step === "participants" && <>{shape.participants && refs.length > 0 && <ul className={styles.restaurantParticipants} aria-label="Participants prévus">
        {refs.map((ref, index) => <li key={`${prospectivePersonIdentity(ref)}:${index}`}><span>{personLabel(ref)}</span>
          <button type="button" disabled={busy} aria-label={`Retirer ${personLabel(ref)} des participants`} onClick={() => {
            const remove = () => fields({ participantRefs: refs.filter((_, position) => position !== index) }, "participants");
            if (leaveRaw(remove)) remove();
          }}>Retirer</button></li>)}
      </ul>}<PlannedContactField label="Ajouter une personne" value={person} householdPersons={model.householdPersons} onChange={next => { setRaw(true); setPerson(next); }} />
        <button type="button" disabled={!person || person.kind === "TEXT" && !person.label.trim()} onClick={() => {
          if (person && !refs.some(ref => prospectivePersonIdentity(ref) === prospectivePersonIdentity(person))) fields({ participantRefs: [...refs, person] }, "participants");
        }}>Ajouter aux participants</button><p>Les participants ne multiplient pas le montant prévu.</p></>}
      {step === "place" && <><PlannedPlaceField label={cinema ? "Cinéma (facultatif)" : context.templateKey === "restaurant" ? "Lieu du Restaurant" : "Lieu ou destination (facultatif)"} places={model.mobilityOptions?.places ?? []} value={place} exact onChange={next => { setRaw(true); setPlace(next); }} />
        <button type="button" disabled={!place || place.kind === "TEXT" && !place.label.trim()} onClick={() => fields({ placeRef: place! }, "place")}>Choisir ce lieu</button></>}
      {step === "date" && <><label>Date facultative<input type="date" value={date} min={`${model.semanticState.targetMonth}-01`} max={`${model.semanticState.targetMonth}-31`} onChange={event => setDate(event.target.value)} /></label>
        <button type="button" onClick={() => { if (date && !date.startsWith(`${model.semanticState.targetMonth}-`)) setError("Choisissez une date dans le mois composé."); else fields({ plannedDate: date || null }, "date"); }}>Confirmer la date</button></>}
      {step === "budget" && activity && <>
        <p>Renseignez le tarif et sa quantité, ou déclarez explicitement un coût nul. Les frais et déplacements distincts gardent leur propre montant.</p>
        <button type="button" disabled={busy || !activityTicket} onClick={() => {
          setRaw(true); setRow(previous => ({ ...previous, costMode: "MANUAL", amount: "0", edited: true }));
        }}>Préparer un coût nul pour l’activité</button>
        <WorkshopComponentRow title={activityMainLabel} row={row} participantCount={refs.length}
          onChange={next => { setRaw(true); setRow(next); }} onSave={() => saveBudget()} busy={busy || !activityTicket} />
      </>}
      {step === "budget" && !activity && <>
        {detail ? <WorkshopComponentRow title={context.templateKey==="purchase"?"Article de cet achat":"Élément hors compléments"} row={row} participantCount={refs.length} onChange={next => { setRaw(true); setRow(next); }} onSave={() => saveBudget()} busy={busy} bindingChoices={!!shape.envelope} />
          : <><label>Coût prévu à notre charge (€)<input autoFocus inputMode="decimal" placeholder="Encore inconnu" value={row.costMode==="MANUAL"?row.amount:""} onChange={event=>setRow(r=>({...r,amount:event.target.value,costMode:event.target.value.trim()?"MANUAL":"UNKNOWN",edited:true}))}/></label>
            <details><summary>Financement · facultatif</summary><label>Source<select value={row.fundingMode} onChange={e=>setRow(r=>({...r,fundingMode:e.target.value as Row['fundingMode'],edited:true}))}><option value="UNDECIDED">À préciser</option><option value="BANK">Banque déclarée</option>{row.fundingMode==="EXISTING"&&<option value="EXISTING">Conserver le financement antérieur</option>}</select></label>{row.fundingMode==="BANK"&&<label>Montant Banque (€)<input inputMode="decimal" value={row.fundingAmount} onChange={e=>setRow(r=>({...r,fundingAmount:e.target.value,edited:true}))}/></label>}</details></>}
        <p>{detail ? "Les éléments et les compléments constituent le budget. Aucun total parent ne s’y ajoute." : "Un seul montant à notre charge, quel que soit le nombre de participants."}</p>
        {!detail && <button type="button" className={styles.primary} onClick={() => saveBudget()}>Conserver ce coût</button>}
        {purchase && main && catalogSocket(model,contextId,"item","option:purchase:item:item")
          && !cinemaSelectionLocked("item",main.selectionId) && <button type="button" disabled={busy} onClick={removePurchaseArticle}>Retirer cet article de l’achat</button>}
        {detail && extras.slice(extraPage * 3, extraPage * 3 + 3).map(item => <button key={item.selectionId} type="button" onClick={() => { if (!leaveRaw(() => { setStep("complete"); setExtraRow(fromSelection(item)); })) return; setStep("complete"); setExtraRow(fromSelection(item)); }}>{item.label} · {priceCaption(item)}</button>)}</>}
      {step === "binding" && <p>Le Compiler vérifie l’enveloppe réellement disponible. Sans enveloppe admissible, la relation restera à préciser. Les compléments libres sont des postes distincts.</p>}
      {step === "complete" && !extraRow && !equipment && <>{extraAdded ? <p role="status">Poste ajouté au brouillon.</p> : <p>{context.templateKey === "restaurant"
        ? "Décrivez ce qui est compris dans l’addition ou ajoutez un supplément distinct."
        : "Ajoutez uniquement les compléments qui ne sont pas déjà compris dans le montant."}</p>}
        {context.templateKey === "restaurant" && <section aria-label="Détails compris dans l’addition">
          <h4>Déjà compris dans l’addition</h4>
          {included?.items.map((item, index) => <div key={item.detailId}>
            <span>{item.label} · {item.amount.kind === "UNKNOWN" ? "Montant inconnu" : money(item.amount.value)} · compris dans l’addition</span>
            <button type="button" disabled={busy || card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT")
              || cinemaLocked(contextId) || !!main && cinemaSelectionLocked("meal", main.selectionId)} onClick={() => openIncluded(item)}>
              Modifier le détail {item.label}{included.items.some(other => other !== item && normalizeCatalog(other.label) === normalizeCatalog(item.label)) ? ` · détail ${index + 1}` : ""}
            </button>
            <button type="button" disabled={busy} aria-label={`Retirer le détail inclus ${item.label}`} onClick={() => {
              const remove = () => { const remaining = included.items.filter(old => old.detailId !== item.detailId);
                send(operation({ contextOccurrenceId: context.contextOccurrenceId, includedDetails: remaining.length ? { ...included, items: remaining } : null })); };
              if (leaveRaw(remove)) remove();
            }}>Retirer le détail</button>
          </div>)}
          <button type="button" disabled={busy || !main} onClick={() => openIncluded()}>Ajouter un détail déjà inclus</button>
          <h4>Réellement en plus</h4>
        </section>}
        {extras.slice(extraPage * 3, extraPage * 3 + 3).map((item, index) => <button type="button" key={item.selectionId}
          disabled={activity && (!activityExtrasSocket || cinemaSelectionLocked("extras", item.selectionId))
            || restaurant && (busy || !catalogSocket(model, contextId, "extras", "option:restaurant:extras:extra") || cinemaSelectionLocked("extras", item.selectionId))}
          onClick={() => editExtra(item, restaurant)}>{item.label} · {priceCaption(item)}{restaurant ? " · supplément distinct" : ""}
          {restaurant && extras.some(other => other !== item && normalizeCatalog(other.label) === normalizeCatalog(item.label)) ? ` · supplément ${extraPage * 3 + index + 1}` : ""}
        </button>)}
        {extras.length > 3 && <div className={styles.nightPage}><button type="button" disabled={extraPage === 0} onClick={() => setExtraPage(page => page - 1)}>Précédent</button><span>{extraPage + 1} / {Math.ceil(extras.length / 3)}</span><button type="button" disabled={(extraPage + 1) * 3 >= extras.length} onClick={() => setExtraPage(page => page + 1)}>Suivant</button></div>}
        {activity && activityModes.length > 0 && <button type="button" onClick={showOptions}>Autres postes et modes de trajet</button>}
        {(!activity || activityExtras) && <button type="button" onClick={() => {
          if (activity) { addExtra(); return; }
          const add = () => { extraEdit.current = null; setExtraAdded(false); setExtraRow(fresh(shape.complement)); };
          if (!detail && main) confirm({ message: "Ces frais sont-ils déjà inclus dans votre montant ? Les ajouter en supplément augmente le coût prévu.", cancelLabel: "Inclus · garder le total", acceptLabel: "Réellement en plus", accept: add }); else add();
        }}>{extraAdded ? "Ajouter encore" : context.templateKey === "restaurant" ? "Ajouter un supplément distinct" : "Ajouter un complément"}</button>}
        {extraAdded && <button type="button" onClick={() => open(null)}>Retour au résumé</button>}
        {parkingAsset && <button type="button" disabled={busy} onClick={() => equip(parkingAsset, socketTarget("transport"), currentTransport, false, "parkingMode")}>Préciser le parking du trajet</button>}
        {currentTransport && (!activity || transportSocket && !cinemaSelectionLocked("transport", currentTransport.selectionId)) && <button type="button" onClick={() => send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { transport: [] } }))}>Retirer le trajet</button>}</>}
      {extraRow && <WorkshopComponentRow key={extraRow.id} title={shape.complement} row={extraRow} participantCount={refs.length} onChange={next => { setRaw(true); setExtraRow(next); }} onRemove={() => {
        if (!extraIsCurrent(extraRow.id, extraRow.label)) return;
        if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { extras: extras.filter(item => item.selectionId !== extraRow.id) } }))) {
          setExtraRow(null);
          if (activity) setFormKey(key => key + 1);
        }
      }} onSave={() => { try { const item = buildComponentRow(extraRow, "extra");
          if (!extraIsCurrent(item.selectionId, item.label)) return;
          const nextExtras = restaurant && extraRow.existing ? extras.map(old => old.selectionId === item.selectionId ? item : old)
            : [...extras.filter(old => old.selectionId !== item.selectionId), item];
          if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { extras: nextExtras } }))) {
            setExtraRow(null); setExtraAdded(!extraRow.existing);
            if (activity) setFormKey(key => key + 1);
          }
        } catch (failure) { setError(workshopErrorMessage(failure)); } }} busy={busy} />}
      {equipment && <form onSubmit={event => {
        event.preventDefault(); const values = equipmentValues;
        const transportAvailable = activity ? activityModes.some(mode => mode.assetKey === equipment.asset.assetKey)
          : !!catalogSocket(model, contextId, "transport", equipment.asset.assetKey)
            && (!currentTransport || !cinemaSelectionLocked("transport", currentTransport.selectionId));
        if ((activity || restaurant) && (!transportAvailable
          || transportSignature.current !== canonicalPlannerJson(currentTransport ?? null))) {
          setError("Ce trajet a changé ou est indisponible. Votre saisie est conservée.");
          return;
        }
        try {
          const sameMode = currentTransport?.optionKey === equipment.asset.optionKey;
          const placeValue = (raw: string, old: ProspectivePlaceRef | null | undefined): ProspectivePlaceRef | null => raw.trim()
            ? old?.kind === "TEXT" && old.label === raw.trim() ? old : { kind: "TEXT", label: raw.trim(), provenance: "USER_DECLARED_PROSPECTIVE" } : old ?? null;
          const origin = placeValue(values.origin ?? "", currentTransport?.origin), destination = placeValue(values.destination ?? "", currentTransport?.destination);
          const returnRequired = values.returnRequired === "true";
          const sameRoute = sameMode && JSON.stringify(origin) === JSON.stringify(currentTransport?.origin ?? null)
            && JSON.stringify(destination) === JSON.stringify(currentTransport?.destination ?? null) && returnRequired === !!currentTransport?.returnRequired
            && (values.plannedTime || null) === (currentTransport?.plannedTime ?? null) && (values.returnTime || null) === (currentTransport?.returnTime ?? null);
          const cost = values.costMode === "UNKNOWN" ? { kind: "UNKNOWN" as const }
            : values.amount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.amount.replace(",", ".")) }
              : sameRoute ? currentTransport?.pricing?.fare ?? { kind: "UNKNOWN" as const } : { kind: "UNKNOWN" as const };
          const parking = values.parkingMode === "EXISTING" && sameRoute ? currentTransport?.pricing?.parking ?? { kind: "UNKNOWN" as const }
            : values.parkingMode === "NO" ? { kind: "MANUAL" as const, unitAmount: "0.00" }
            : values.parkingAmount?.trim() ? { kind: "MANUAL" as const, unitAmount: decisionAmount(values.parkingAmount.replace(",", ".")) } : { kind: "UNKNOWN" as const };
          const selection: Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }> = {
            selectionId: currentTransport?.selectionId ?? crypto.randomUUID(), kind: "MOBILITY_INTENT", optionKey: equipment.asset.optionKey!, provenance: "EXPLICIT_USER_DECISION",
            origin, destination, returnRequired, plannedTime: values.plannedTime || null, returnTime: values.returnTime || null,
            ...(values.targetIntentId ? { journey: sameRoute && currentTransport?.journey?.relation === "SHARES_JOURNEY" && currentTransport.journey.targetIntentId === values.targetIntentId
              ? currentTransport.journey : { relation: "SHARES_JOURNEY", certainty: "CERTAIN", targetIntentId: values.targetIntentId, externalExpenseId: null, externalCostLineIds: [], choice: null, stopIndex: null, accessLegIndex: null } }
              : sameRoute && currentTransport?.journey?.relation === "SHARES_JOURNEY" && !currentTransport.journey.targetIntentId
                ? { journey: currentTransport.journey }
              : { pricing: { fare: cost, parking: equipment.asset.optionKey === "car" ? parking : { kind: "UNKNOWN" },
                fundingAllocations: values.funding === "EXISTING" && sameMode ? currentTransport?.pricing?.fundingAllocations ?? []
                  : values.funding === "BANK" ? [{ source: "BANK", amount: decisionAmount(values.fundingAmount.replace(",", ".")) }] : [], preference: values.preference === "AVOID_TOLLS" ? "AVOID_TOLLS" : "FASTEST" } }),
            ...(sameRoute && currentTransport?.journey?.relation === "OWNS_JOURNEY" && !values.targetIntentId ? { journey: currentTransport.journey } : {}),
            ...(sameRoute && equipment.asset.optionKey === "car" && currentTransport?.route && !values.targetIntentId ? { route: currentTransport.route } : {}) };
          if (send(operation({ contextOccurrenceId: context.contextOccurrenceId, slots: { transport: [selection] } }))) setEquipment(null);
        } catch (failure) { setError(workshopErrorMessage(failure)); }
      }}><h4>{equipment.asset.label}</h4><p>Un coût d’usage n’est pas un plein bancaire. Les données absentes restent inconnues.</p>
         <MobilityFields key={`${equipment.asset.assetKey}:${equipment.focusField ?? "route"}:${formKey}`}
           fields={model.editors.find(e => e.assetKey === equipment.asset.assetKey)?.fields ?? []} values={equipmentValues} preserved={transportValues}
           focusField={equipment.focusField} busy={busy} change={(key, value) => { setRaw(true); setEquipmentValues(values => ({ ...values, [key]: value })); }} />
         <button type="submit" disabled={busy}>Valider ce trajet</button></form>}
      {error && <p role="alert" className={styles.formError}>{error}</p>}
    </div>}
    {known && <details className={styles.restaurantDiagnostics}><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={known} /></details>}
    {updateSuggestionDismissal && (showCinemaSuggestions || restaurant && step === null && !restaurantChoices)
      && (rankedCinema.length > 0 || rankedRestaurant.length > 0 || dismissedSuggestions.length > 0) &&
      <SuggestionControls occurrenceId={contextId} choices={[...rankedCinema, ...rankedRestaurant]} busy={busy}
        dismissedSuggestions={dismissedSuggestions} updateSuggestionDismissal={updateSuggestionDismissal} />}
    <footer><button type="button" onClick={close}>Retour au Board</button><span>Les choix validés sont conservés dans le brouillon.</span></footer>
  </aside>;
  return <>{typeof document !== "undefined" && createPortal(panelContent, document.body)}
    {allOptions ? <ContextPalette card={card} model={model} busy={busy} configure choose={equip} close={()=>setAllOptions(false)} />
      : <ContextPalette card={card} model={model} busy={busy} configure choose={equip} close={close} question={question} />}</>;
}
