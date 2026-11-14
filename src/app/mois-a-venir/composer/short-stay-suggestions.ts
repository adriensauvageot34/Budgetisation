import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { componentId } from "@/domain/phase2/planner/identity";
import { catalogRefLocked, catalogSocket, normalizeCatalog } from "./catalog-discovery";
import { rankCatalogRecommendations, v22Concepts, workbookSource } from "./catalog-relevance";

export const stayExtraTopics = [
  { key: "breakfast", label: "Petit-déjeuner", visualConceptId: v22Concepts.breakfast.id,
    hint: "Vérifier s’il est compris dans le prix", names: ["petit dejeuner", "petit dejeuner d hebergement"] },
  { key: "tax", label: "Taxe de séjour", visualConceptId: v22Concepts.tax.id,
    hint: "Vérifier si elle s’applique et si elle est comprise", names: ["taxe de sejour"] },
] as const;
export type StayExtraTopic = typeof stayExtraTopics[number];
export const matchesStayExtra = (topic: StayExtraTopic, label: string) =>
  topic.names.some(name => name === normalizeCatalog(label));

const items = (context: PlannedContextState, slot: string) =>
  ((context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[]).filter(item => item.kind !== "UNRESOLVED");
const componentLocked = (model: ComposerUiModel, id: string, slot: string, selectionId: string) =>
  catalogRefLocked(model, componentId(id, slot, selectionId));
// Published sockets can supply default binding, funding and transport values.
// Compare targets here. The editor checks the semantic source before saving.
const sameTargets = (published: readonly ComponentSelectionV1[], current: readonly ComponentSelectionV1[]) =>
  published.filter(item => item.kind !== "UNRESOLVED").length === current.length && current.every(item => published.some(candidate =>
    candidate.selectionId === item.selectionId && candidate.kind === item.kind && candidate.optionKey === item.optionKey));

export function shortStayTransportModes(context: PlannedContextState, model: ComposerUiModel) {
  const id = context.contextOccurrenceId;
  const current = items(context, "transport");
  const selected = current[0];
  if (current.length > 1 || selected && (selected.kind !== "MOBILITY_INTENT"
    || selected.journey && selected.journey.relation !== "OWNS_JOURNEY"
    || componentLocked(model, id, "transport", selected.selectionId))) return [];
  const socket = model.board.contexts.find(card => card.contextOccurrenceId === id)?.sockets.find(slot => slot.slotKey === "transport");
  if (socket?.cardinality !== "OPTIONAL_ONE" || !socket.capabilityRefs.includes("short-stay:transport:SELECT_MOBILITY_INTENT")
    || !sameTargets(socket.currentItems, current)) return [];
  return (socket.choiceAssetKeys ?? []).flatMap(assetKey => {
    const route = catalogSocket(model, id, "transport", assetKey);
    return route?.asset.optionKind === "MOBILITY_INTENT" && route.asset.optionKey
      && model.editors.some(editor => editor.assetKey === assetKey && editor.fields.length > 0) ? [route.asset.optionKey] : [];
  });
}

type Target =
  | { kind: "LODGING"; selectionId?: string }
  | { kind: "NIGHTS" | "DEPARTURE" | "RETURN" }
  | { kind: "REVIEW_EXTRA" | "EDIT_EXTRA" | "CHOOSE_EXTRA"; topic: StayExtraTopic; selectionIds: readonly string[] }
  | { kind: "TRANSPORT"; selectionId?: string };
type Candidate = Target & { label: string; hint: string; priority: number; iconKey?: string; visualConceptId?: string; catalogAssetKey?: string };

export function shortStaySuggestions(context: PlannedContextState, model: ComposerUiModel, transportModes: readonly string[]) {
  const id = context.contextOccurrenceId;
  const card = model.board.contexts.find(card => card.contextOccurrenceId === id);
  if (context.templateKey !== "short-stay" || context.status !== "ACTIVE" || card?.templateKey !== "short-stay"
    || card.readOnly || card.externalIntentId !== null || card.parentContextOccurrenceId !== context.parentContextOccurrenceId
    || !card.capabilityRefs.includes("PATCH_CONTEXT") || catalogRefLocked(model, id)) return [];

  const candidates: Candidate[] = [];
  const lodging = items(context, "lodging")[0];
  const lodgingSocket = catalogSocket(model, id, "lodging", "option:short-stay:lodging:lodging")?.socket;
  if (lodgingSocket?.cardinality === "REQUIRED_ONE" && lodgingSocket.capabilityRefs.includes("short-stay:lodging:SELECT_COMPONENT")
    && sameTargets(lodgingSocket.currentItems, items(context, "lodging"))
    && (!lodging || lodging.kind === "COMPONENT" && !componentLocked(model, id, "lodging", lodging.selectionId))) {
    const needsPrice = lodging?.kind === "COMPONENT" && lodging.cost.kind === "UNKNOWN";
    candidates.push({ kind: "LODGING", selectionId: lodging?.selectionId, priority: !lodging || needsPrice ? 0 : 3,
      label: lodging ? "Modifier l’hébergement" : "Préciser l’hébergement",
      hint: lodging?.kind === "COMPONENT" ? lodging.label : "Type et prix à votre choix",
      visualConceptId: "v22-art:extra:hotel-stay-general" });
    if (lodging?.kind === "COMPONENT" && lodging.lodgingPricing?.basis === "PER_NIGHT" && context.fields.nightCount == null)
      candidates.push({ kind: "NIGHTS", label: "Préciser le nombre de nuits", hint: "Le tarif par nuit attend une durée", priority: 1 });
  }

  const extras = items(context, "extras");
  const extraSocket = catalogSocket(model, id, "extras", "option:short-stay:extras:extra")?.socket;
  if (extraSocket?.cardinality === "REPEATING" && extraSocket.capabilityRefs.includes("short-stay:extras:SELECT_COMPONENT")
    && sameTargets(extraSocket.currentItems, extras)) {
    const reviewable = lodging?.kind === "COMPONENT" && ["HOTEL", "HOSTEL", "RENTAL"].includes(String(context.fields.lodgingKind));
    for (const topic of stayExtraTopics) {
      const matches = extras.filter(item => item.kind === "COMPONENT" && matchesStayExtra(topic, item.label));
      const selectionIds = matches.filter(item => !componentLocked(model, id, "extras", item.selectionId)).map(item => item.selectionId).sort();
      if (selectionIds.length > 1) candidates.push({ kind: "CHOOSE_EXTRA", topic, selectionIds,
        label: "Choisir la ligne · " + topic.label, hint: "Plusieurs lignes de ce séjour portent ce nom",
        visualConceptId: topic.visualConceptId, priority: 2 });
      else if (selectionIds.length) candidates.push({ kind: "EDIT_EXTRA", topic, selectionIds,
        label: "Modifier · " + topic.label, hint: "Supplément déjà prévu pour ce séjour", visualConceptId: topic.visualConceptId, priority: 2 });
      else if (!matches.length && reviewable) candidates.push({ kind: "REVIEW_EXTRA", topic, selectionIds,
        label: "Examiner · " + topic.label, hint: topic.hint, visualConceptId: topic.visualConceptId, priority: 5 });
    }
  }

  if (!context.fields.plannedDate || !context.fields.endDate) {
    const departureMissing = !context.fields.plannedDate;
    candidates.push({ kind: departureMissing ? "DEPARTURE" : "RETURN", label: "Préciser la période",
      hint: departureMissing && !context.fields.endDate ? "Départ et retour restent à choisir"
        : departureMissing ? "Le départ reste à choisir" : "Le retour reste à choisir", iconKey: "activity", priority: 1 });
  }
  const transport = items(context, "transport")[0];
  const destination = context.fields.destinationRef as ProspectivePlaceRef | null | undefined;
  const knownDestination = destination?.kind === "KNOWN" && model.mobilityOptions?.places.some(place => place.placeId === destination.placeId);
  if (transport ? transportModes.includes(transport.optionKey) : knownDestination && transportModes.length) {
    candidates.push({ kind: "TRANSPORT", selectionId: transport?.selectionId, priority: 4,
      label: transport ? "Modifier le déplacement" : "Configurer le déplacement",
      hint: transport ? "Trajet de ce séjour · Mobility" : "Destination connue · Mobility", iconKey: "car",
      catalogAssetKey: transport ? "option:short-stay:transport:" + transport.optionKey : undefined });
  }

  return rankCatalogRecommendations(candidates.map(candidate => {
    const target = "selectionIds" in candidate ? [candidate.topic.key, ...candidate.selectionIds]
      : "selectionId" in candidate ? [candidate.selectionId] : [];
    const source = "topic" in candidate ? workbookSource(v22Concepts[candidate.topic.key]) : undefined;
    return { ...candidate, source, iconKey: candidate.iconKey ?? "short-stay",
      key: ["short-stay", id, candidate.kind === "DEPARTURE" || candidate.kind === "RETURN" ? "PERIOD" : candidate.kind, ...target].join(":"),
      tiers: [candidate.priority, Number(candidate.kind === "DEPARTURE" || candidate.kind === "RETURN")] };
  }));
}

export type ShortStaySuggestion = ReturnType<typeof shortStaySuggestions>[number];
