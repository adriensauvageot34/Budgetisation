"use client";
import { transportPresentation, transportTotals, routeVariantLabel, type PlannedCarSnapshot } from "@/domain/phase2/planned-car";
import type { PlannedExpenseDraft } from "@/domain/phase2/planned-contract";
import { builderButton, builderMoney } from "./planned-builder-primitives";

const duration = (seconds: number | null) => seconds === null ? "Durée indisponible" : `${Math.floor(Math.round(seconds / 60) / 60) ? `${Math.floor(Math.round(seconds / 60) / 60)} h ` : ""}${Math.round(seconds / 60) % 60} min`;
const decimal = (value: string, digits = 1) => Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
export function PlannedCarSummary({ draft, variants, onSelect, onRefresh, onConfirmNoToll }: {
  draft: PlannedExpenseDraft; variants: readonly PlannedCarSnapshot[]; onSelect: (snapshot: PlannedCarSnapshot) => void;
  onRefresh: () => void; onConfirmNoToll: () => void;
}) {
  const live = draft.context.route?.liveEstimate;
  if (!live) return null;
  const { manualToll, toll, parking, totals, delta } = transportPresentation(draft, variants);
  return <div className="mt-4 grid gap-3 text-sm">
    <p className="font-semibold">{live.vehicleLabel}</p>
    {variants.length > 1 && <div className="grid grid-cols-2 gap-3" aria-label="Choix d’itinéraire">{variants.map((variant) => {
      const total = transportTotals(variant.fuelEconomicCost, variant.toll.amount);
      return <button key={variant.preference} type="button" aria-pressed={variant.preference === live.preference} onClick={() => onSelect(variant)}
        className={`rounded-xl border p-3 text-left ${variant.preference === live.preference ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
        <strong>{routeVariantLabel(variant)}</strong>
        <p className="mt-1">{duration(variant.route.durationSeconds)} · {decimal(variant.route.distanceKm)} km</p>
        <p>Essence {variant.fuelEconomicCost !== null ? `≈ ${builderMoney(variant.fuelEconomicCost)}` : "indisponible"}</p>
        <p>Péage {variant.toll.amount !== null ? builderMoney(variant.toll.amount) : "indisponible"}</p>
        <p className="mt-2 font-semibold">{total.economic !== null ? `≈ ${builderMoney(total.economic)}` : "Coût incomplet"} <span className="text-xs font-normal">hors parking</span></p>
      </button>;
    })}</div>}
    {delta && <p className="text-xs text-slate-600">Variante : {delta.durationMinutes !== null ? `${delta.durationMinutes >= 0 ? "+" : ""}${delta.durationMinutes} min · ` : ""}
      {decimal(delta.distanceKm)} km de différence{delta.economicCost !== null ? ` · ≈ ${builderMoney(delta.economicCost)} ${delta.cheaper ? "de moins" : "de plus"}` : ""}</p>}
    <strong>{decimal(live.route.distanceKm)} km · {duration(live.route.durationSeconds)}</strong>
    <div><p>Essence utilisée : ≈ {decimal(live.route.liters, 2)} L {live.fuelEconomicCost !== null ? `· ≈ ${builderMoney(live.fuelEconomicCost)}` : "· prix carburant indisponible"}</p>
      <p>Péage : {toll === null ? "non disponible" : Number(toll) === 0 ? `aucun${draft.context.route?.tollFreeConfirmed ? " (confirmé par vous)" : ""}` : `${builderMoney(toll)}${manualToll ? " (saisi par vous)" : ""}`}</p>
      {toll === null && <button type="button" className="mt-1 text-xs underline" onClick={onConfirmNoToll}>Confirmer un trajet sans péage (0 €)</button>}
      {Number(parking) > 0 && <p>Parking : {builderMoney(parking)}</p>}
    </div>
    <p className="text-xs text-slate-600">{totals.economic === null ? "Coût économique encore incomplet." : `Coût économique ≈ ${builderMoney(totals.economic)}.`} {totals.cash === null ? "Paiement bancaire à préciser." : `Paiement bancaire prévu : ${builderMoney(totals.cash)}.`} L’essence utilisée n’est pas un plein payé.</p>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">Détails du calcul</summary><div className="mt-2 grid gap-2">
      <p>Route : {live.route.provider === "TOMTOM" ? "TomTom · itinéraire prospectif" : live.route.provider === "HISTORICAL_ROUTE" ? "Historique exact des segments dirigés" : "Distances manuelles"}.</p>
      <p>Profil : {live.route.consumptionModelRef}</p>
      <p>{live.route.timeBasis === "UNKNOWN_TIME_MEDIAN_08_14_18" ? "Heure inconnue : médiane des estimations à 8 h, 14 h et 18 h. Géométrie du trajet médian en durée." : live.route.timeBasis === "TYPICAL_NO_DATE" ? "Date inconnue : mardi type à 14 h, sans incidents actuels." : live.plannedTime ? `${live.timeKind === "ARRIVAL" ? "Arrivée" : "Départ"} prévu à ${live.plannedTime}.` : "Horaire non renseigné."}</p>
      {live.fuelPrice ? <p>Prix SP95 : {decimal(live.fuelPrice.pricePerLiter, 4)} €/L · {live.fuelPrice.source === "FR_GOV_FUEL_INSTANT_V2" ? `médiane locale officielle · ${live.fuelPrice.sampleCount} stations · rayon ${live.fuelPrice.radiusKm} km` : live.fuelPrice.source === "MANUAL" ? "prix saisi" : "dernière observation compatible (repli)"} · mis à jour le {new Date(live.fuelPrice.observedAt).toLocaleDateString("fr-FR")}{live.fuelPrice.quality !== "FRESH" ? " · prix ancien ou de repli" : ""}.</p> : <p>Prix SP95 indisponible.</p>}
      <p>Péage : {live.toll.provider === "HERE" ? "HERE · géométrie TomTom importée" : "estimation indisponible"}. Tarif voiture standard ; caractéristiques de carte grise à confirmer pour un véhicule différent.</p>
      <p>Calculé le {new Date(live.calculatedAt).toLocaleString("fr-FR")}.</p>
    </div></details>
    <button type="button" className={`${builderButton} w-fit`} onClick={onRefresh}>Recalculer le trajet</button>
  </div>;
}
