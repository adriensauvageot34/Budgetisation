import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import { barEndpointLabel } from "./bar-place-knowledge";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { money } from "./display";
import styles from "./composer.module.css";

export type CarJourneyPresentation = {
  assetKey: string;
  places: readonly PlannedPlaceOption[];
  summary?: ComposerMobilitySummary;
};
type CarIntent = Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }>;
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fuelPrice = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

export function CarJourneyFace({ journey, intent }: { journey: CarJourneyPresentation; intent: CarIntent }) {
  const { places, summary, assetKey } = journey;
  const knownLabel = (id: string, fallback: string) => {
    const place = places.find(option => option.placeId === id);
    return place ? barEndpointLabel(place) : fallback;
  };
  const label = (ref: ProspectivePlaceRef | null | undefined, fallback: string) =>
    ref?.kind === "TEXT" ? ref.label : ref?.kind === "KNOWN" ? knownLabel(ref.placeId, "Lieu enregistré") : fallback;
  const stops = intent.route?.stops ?? [];
  // A simple return reads A ⇄ B. Keep every stop of a more complex itinerary visible.
  const simpleReturn = intent.returnRequired && (stops.length === 0 || stops.length === 3
    && stops[0]?.placeId === stops[2]?.placeId && stops[0]?.label === stops[2]?.label);
  const route = stops.length >= 2
    ? stops.slice(0, simpleReturn ? -1 : undefined).map(stop => stop.placeId ? knownLabel(stop.placeId, stop.label) : stop.label)
    : [label(intent.origin, "Départ à préciser"), label(intent.destination, "Arrivée à préciser")];
  const estimate = summary?.economicFuel;
  const fuelDetails = [summary?.fuelLiters == null ? null : `${number.format(Number(summary.fuelLiters))} L`,
    summary?.fuelPricePerLiter == null ? null : `${fuelPrice.format(Number(summary.fuelPricePerLiter))} €/L`].filter(Boolean).join(" · ");
  return <>
    <ComposerAssetVisual assetKey={assetKey} iconKey="car" size={42} className={styles.carJourneyArt} />
    <span className={styles.carJourneyCopy}>
      <span className={styles.carJourneyTop}>
        <b>{intent.returnRequired ? "Voiture · Aller-retour" : "Voiture"}</b>
        {estimate != null && <strong>≈ {money(estimate)}</strong>}
      </span>
      <span className={styles.carJourneyPlaces}>{route.join(simpleReturn ? " ⇄ " : " → ")}</span>
      <small title={fuelDetails || undefined}>
        {estimate == null ? "Essence à préciser" : "Essence estimée"}
        {summary?.distanceKm != null && <> · {number.format(Number(summary.distanceKm))} km</>}
      </small>
    </span>
  </>;
}
