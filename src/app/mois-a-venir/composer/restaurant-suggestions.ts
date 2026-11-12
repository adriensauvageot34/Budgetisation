import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { componentId } from "@/domain/phase2/planner/identity";
import { restaurantIncludedDetails, RESTAURANT_INCLUDED_DETAILS_LIMIT } from "@/domain/phase2/planner/restaurant-included-details";
import { catalogRefLocked, catalogSocket, normalizeCatalog, rankDiscoveryCandidates } from "./catalog-discovery";

export const restaurantBeer = { label: "Bière", artwork: "v22-art:excel:2" } as const;
export const isRestaurantBeer = (label: string) => normalizeCatalog(label) === normalizeCatalog(restaurantBeer.label);
const mealAsset = "option:restaurant:meal:restaurant";
const extraAsset = "option:restaurant:extras:extra";
const taxiAsset = "option:restaurant:transport:taxi";

type Target =
  | { kind: "BUDGET" | "ADD_INCLUDED" | "ADD_EXTRA" | "CHOOSE_LINE" | "PARTICIPANTS" | "PLACE" | "DATE" }
  | { kind: "EDIT_INCLUDED" | "EDIT_EXTRA"; selectionId: string }
  | { kind: "TRANSPORT"; assetKey: string; selectionId?: string };
type Candidate = Target & { label: string; hint: string; iconKey: string; visualConceptId?: string; priority: number };

export function restaurantSuggestions(context: PlannedContextState, card: ComposerContextCardView, model: ComposerUiModel,
  dismissed: readonly string[]) {
  const id = context.contextOccurrenceId;
  if (context.templateKey !== "restaurant" || context.status !== "ACTIVE" || card.contextOccurrenceId !== id
    || card.templateKey !== "restaurant" || card.readOnly || !card.capabilityRefs.includes("PATCH_CONTEXT")
    || catalogRefLocked(model, id)) return [];

  const locked = (slot: string, selectionId: string) => catalogRefLocked(model, componentId(id, slot, selectionId));
  const selections = (slot: string) => (context.slotSelections[slot]?.items ?? []) as readonly ComponentSelectionV1[];
  const meal = selections("meal")[0];
  const extras = selections("extras").filter(item => item.kind === "COMPONENT");
  const included = restaurantIncludedDetails(context)?.items ?? [];
  const beersIncluded = included.filter(item => isRestaurantBeer(item.label));
  const beersExtra = extras.filter(item => isRestaurantBeer(item.label));
  const mealSocket = catalogSocket(model, id, "meal", mealAsset)?.socket;
  const extraSocket = catalogSocket(model, id, "extras", extraAsset)?.socket;
  const canEditMeal = !!mealSocket && mealSocket.cardinality === "REQUIRED_ONE"
    && mealSocket.capabilityRefs.includes("restaurant:meal:SELECT_COMPONENT")
    && (!meal || meal.kind === "COMPONENT" && meal.optionKey === "restaurant"
    && !locked("meal", meal.selectionId) && mealSocket.currentItems.some(item => item.selectionId === meal.selectionId));
  const extrasAllowed = !!extraSocket && extraSocket.cardinality === "REPEATING"
    && extraSocket.capabilityRefs.includes("restaurant:extras:SELECT_COMPONENT");
  const canEditExtra = (selection: ComponentSelectionV1) => extrasAllowed
    && extraSocket.currentItems.some(item => item.selectionId === selection.selectionId) && !locked("extras", selection.selectionId);
  const canEditIncluded = canEditMeal && !!meal && selections("meal").length === 1;
  const hasParticipants = Array.isArray(context.fields.participantRefs) && context.fields.participantRefs.length > 0;
  const place = context.fields.placeRef as ProspectivePlaceRef | null | undefined;
  const knownPlace = place?.kind === "KNOWN" && model.mobilityOptions?.places.some(item => item.placeId === place.placeId);
  const hasPlace = knownPlace || place?.kind === "TEXT" && !!place.label.trim();
  const transport = selections("transport").find(item => item.kind === "MOBILITY_INTENT");
  const transportAsset = transport ? `option:restaurant:transport:${transport.optionKey}` : taxiAsset;
  const route = (transport || knownPlace) && catalogSocket(model, id, "transport", transportAsset);
  const canConfigureRoute = route && route.asset.optionKind === "MOBILITY_INTENT" && route.socket.cardinality === "OPTIONAL_ONE"
    && route.socket.capabilityRefs.includes("restaurant:transport:SELECT_MOBILITY_INTENT")
    && model.editors.some(editor => editor.assetKey === transportAsset && editor.fields.length > 0)
    && (!transport || !locked("transport", transport.selectionId)
      && route.socket.currentItems.some(item => item.selectionId === transport.selectionId));
  const editableBeer = beersExtra.find(canEditExtra);
  const beerCount = beersIncluded.length + beersExtra.length;
  const candidates: Candidate[] = [];

  if (canEditMeal && (!meal || meal.kind === "COMPONENT" && meal.cost.kind === "UNKNOWN")) {
    candidates.push({ kind: "BUDGET", label: "Préciser l’addition", hint: "Total du restaurant · configuration",
      iconKey: "restaurant", priority: 0 });
  }
  if (beerCount > 1 && (canEditIncluded && beersIncluded.length || editableBeer)) {
    candidates.push({ kind: "CHOOSE_LINE", label: "Choisir la bière à modifier", hint: "Plusieurs lignes portent ce nom dans ce restaurant",
      iconKey: "restaurant", visualConceptId: restaurantBeer.artwork, priority: 0 });
  } else if (beerCount === 1 && canEditIncluded && beersIncluded.length) {
    candidates.push({ kind: "EDIT_INCLUDED", selectionId: beersIncluded[0].detailId, label: "Modifier la bière comprise",
      hint: "Détail déjà choisi dans l’addition", iconKey: "restaurant", visualConceptId: restaurantBeer.artwork, priority: 0 });
  } else if (beerCount === 1 && editableBeer) {
    candidates.push({ kind: "EDIT_EXTRA", selectionId: editableBeer.selectionId, label: "Modifier la bière en supplément",
      hint: "Supplément déjà choisi pour ce restaurant", iconKey: "restaurant", visualConceptId: restaurantBeer.artwork, priority: 0 });
  } else if (!beerCount && canEditIncluded && included.length < RESTAURANT_INCLUDED_DETAILS_LIMIT) {
    candidates.push({ kind: "ADD_INCLUDED", label: "Renseigner une bière comprise", hint: "Détail de l’addition · catalogue Excel, ligne 2",
      iconKey: "restaurant", visualConceptId: restaurantBeer.artwork, priority: 1 });
  }
  const otherExtra = extras.find(item => !isRestaurantBeer(item.label) && canEditExtra(item));
  if (otherExtra && extras.filter(item => normalizeCatalog(item.label) === normalizeCatalog(otherExtra.label)).length > 1) {
    if (!candidates.some(item => item.kind === "CHOOSE_LINE")) {
      candidates.push({ kind: "CHOOSE_LINE", label: "Choisir le supplément à modifier", hint: "Plusieurs lignes portent ce nom dans ce restaurant",
        iconKey: "purchase", priority: 1 });
    }
  } else if (otherExtra) {
    candidates.push({ kind: "EDIT_EXTRA", selectionId: otherExtra.selectionId, label: `Modifier · ${otherExtra.label}`,
      hint: "Supplément déjà choisi pour ce restaurant", iconKey: "purchase", priority: 1 });
  }
  if (extrasAllowed) {
    candidates.push({ kind: "ADD_EXTRA", label: "Préparer un supplément distinct", hint: "Seulement si le poste est en plus de l’addition · règle Restaurant",
      iconKey: "purchase", priority: meal ? 2 : 5 });
  }
  if (!hasParticipants) candidates.push({ kind: "PARTICIPANTS", label: "Préciser les participants", hint: "Qui vient à ce restaurant ? · configuration",
    iconKey: "family-visit", priority: 3 });
  if (!hasPlace) candidates.push({ kind: "PLACE", label: "Préciser le lieu", hint: "Lieu de ce restaurant · configuration",
    iconKey: "family-visit", priority: 4 });
  if (!context.fields.plannedDate) candidates.push({ kind: "DATE", label: "Choisir une date", hint: "Date de ce restaurant · configuration",
    iconKey: "activity", priority: 5 });
  if (canConfigureRoute) candidates.push({ kind: "TRANSPORT", assetKey: transportAsset, selectionId: transport?.selectionId,
    label: transport ? `Modifier le trajet · ${route.asset.label}` : "Configurer le trajet en taxi",
    hint: transport ? "Trajet déjà choisi pour ce restaurant · Mobility" : "Lieu connu · configuration Mobility",
    iconKey: route.asset.iconKey, visualConceptId: transportAsset === taxiAsset ? "v22-art:excel:499" : undefined, priority: 2 });

  return rankDiscoveryCandidates(candidates.map(candidate => {
    const targetId = "selectionId" in candidate ? candidate.selectionId : undefined;
    const key = ["restaurant", id, candidate.kind, targetId, candidate.kind === "TRANSPORT" ? candidate.assetKey : undefined].join(":");
    return { ...candidate, key, contextOccurrenceId: id, tiers: [candidate.priority] };
  }).filter(candidate => !dismissed.includes(candidate.key)));
}

export type RestaurantSuggestion = ReturnType<typeof restaurantSuggestions>[number];
