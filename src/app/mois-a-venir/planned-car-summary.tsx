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
  const stops = draft.context.route!.stops, anchor = stops.findIndex((stop) => stop.endpointSource === "ROOT_PLACE");
  const dateLabel = (date: string | null, time: string | null) => date ? `${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}${time ? ` · ${time}` : ""}` : "Date non précisée";
  return <div className="mt-4 grid gap-3 text-sm">
    <p className="font-semibold">{live.vehicleLabel}</p>
    {live.journey && <div className="grid grid-cols-2 gap-3">{(["outbound", "return"] as const).map((direction) => {
      const leg = live.journey![direction], points = direction === "outbound" ? stops.slice(0, anchor + 1) : stops.slice(anchor);
      return <section key={direction} className="rounded-xl bg-slate-50 p-3"><h5 className="text-xs font-bold text-indigo-800">{direction === "outbound" ? "ALLER" : "RETOUR"}</h5>
        <p className="mt-1">{dateLabel(leg.plannedDate, leg.plannedTime)}</p><p className="mt-2 text-xs text-slate-600">{points.map((stop) => stop.label).join(" → ")}</p>
        <p className="mt-2 font-semibold">{decimal(leg.route.distanceKm)} km · {duration(leg.route.durationSeconds)}</p><p>≈ {decimal(leg.route.liters, 2)} L</p>
        <p className="text-xs text-slate-500">Péage : {leg.toll.amount === null ? "non disponible" : Number(leg.toll.amount) === 0 ? "aucun" : builderMoney(leg.toll.amount)}</p>
      </section>;
    })}</div>}
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
    <strong>{decimal(live.route.distanceKm)} km{live.journey ? " au total" : ""} · {duration(live.route.durationSeconds)}</strong>
    <div><p>Essence utilisée : ≈ {decimal(live.route.liters, 2)} L {live.fuelEconomicCost !== null ? `· ≈ ${builderMoney(live.fuelEconomicCost)}` : "· prix carburant indisponible"}</p>
      <p>Péage : {toll === null ? "non disponible" : Number(toll) === 0 ? `aucun${draft.context.route?.tollFreeConfirmed ? " (confirmé par vous)" : ""}` : `${builderMoney(toll)}${manualToll ? " (saisi par vous)" : ""}`}</p>
      {toll === null && <button type="button" className="mt-1 text-xs underline" onClick={onConfirmNoToll}>Confirmer un trajet sans péage (0 €)</button>}
      {Number(parking) > 0 && <p>Parking : {builderMoney(parking)}</p>}
    </div>
    <p className="text-xs text-slate-600">{totals.economic === null ? "Coût économique encore incomplet." : `Coût économique ≈ ${builderMoney(totals.economic)}.`} {totals.cash === null ? "Paiement bancaire à préciser." : `Paiement bancaire prévu : ${builderMoney(totals.cash)}.`} L’essence utilisée n’est pas un plein payé.</p>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">Détails du calcul</summary><div className="mt-2 grid gap-2">
      <p>Route : {live.route.provider === "TOMTOM" ? "TomTom · itinéraire prospectif" : live.route.provider === "HISTORICAL_ROUTE" ? "Historique exact des segments dirigés" : "Distances manuelles"}.</p>
      {live.journey && (["outbound", "return"] as const).map((direction) => { const leg = live.journey![direction]; return <p key={direction}>{direction === "outbound" ? "Aller" : "Retour"} : {leg.route.provider} · {leg.route.timeBasis === "UNKNOWN_TIME_MEDIAN_08_14_18" ? "heure inconnue, médiane 8 h / 14 h / 18 h" : leg.plannedTime ? `départ à ${leg.plannedTime}` : "historique ou distances de repli"} · péage {leg.toll.provider === "HERE" ? "HERE, route TomTom importée" : "indisponible"}.</p>; })}
      <p>Profil : {live.route.consumptionModelRef}</p>
      <p>{live.route.timeBasis === "UNKNOWN_TIME_MEDIAN_08_14_18" ? "Heure inconnue : médiane des estimations à 8 h, 14 h et 18 h. Géométrie du trajet médian en durée." : live.route.timeBasis === "TYPICAL_NO_DATE" ? "Date inconnue : mardi type à 14 h, sans incidents actuels." : live.plannedTime ? `${live.timeKind === "ARRIVAL" ? "Arrivée" : "Départ"} prévu à ${live.plannedTime}.` : "Horaire non renseigné."}</p>
      {live.fuelPrice ? <p>Prix SP95 : {decimal(live.fuelPrice.pricePerLiter, 4)} €/L · {live.fuelPrice.source === "FR_GOV_FUEL_INSTANT_V2" ? `médiane locale officielle · ${live.fuelPrice.sampleCount} stations · rayon ${live.fuelPrice.radiusKm} km` : live.fuelPrice.source === "MANUAL" ? "prix saisi" : "dernière observation compatible (repli)"} · mis à jour le {new Date(live.fuelPrice.observedAt).toLocaleDateString("fr-FR")}{live.fuelPrice.quality !== "FRESH" ? " · prix ancien ou de repli" : ""}.</p> : <p>Prix SP95 indisponible.</p>}
      {live.journey && <p>Prix prospectif de référence actuel, commun aux deux sens ; le prix futur à la date du retour n’est pas connu.</p>}
      <p>Péage : {live.toll.provider === "HERE" ? "HERE · géométrie TomTom importée" : "estimation indisponible"}. Tarif voiture standard ; caractéristiques de carte grise à confirmer pour un véhicule différent.</p>
      <p>Calculé le {new Date(live.calculatedAt).toLocaleString("fr-FR")}.</p>
    </div></details>
    <button type="button" className={`${builderButton} w-fit`} onClick={onRefresh}>Recalculer le trajet</button>
  </div>;
}
