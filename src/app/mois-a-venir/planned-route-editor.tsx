"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { addBuilderChildRouteStop, editBuilderDraft, invalidateRouteDistances, removeBuilderChild,
  setBuilderChildPlace, type BuilderState } from "@/domain/phase2/planned-builder";
import type { PlannedRouteStop, PlannedVehicleEstimate, CostItem } from "@/domain/phase2/planned-contract";
import { resolvePlannedContext } from "@/domain/phase2/planned-rules";
import { placesForChildModule, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { deduplicateRouteStops, routeSegments, stopForPlace } from "@/domain/phase2/planned-routes";
import { estimatePlannedRoute } from "./planned-expenses-actions";
import { plannedAsset } from "@/domain/phase2/planned-assets";

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3";
const buttonClass = "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50";
const childLabel = (child: string) => ({ restaurant: "Restaurant", activity: "Activité", bar: "Bar", club: "Club" }[child] ?? child);
export function PlannedRouteEditor({ builder, setBuilder, places, vehicle, targetMonth, persons }: {
  builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; places: readonly PlannedPlaceOption[];
  vehicle: PlannedVehicleEstimate | null; targetMonth: string; persons: readonly { personId: string; displayName: string }[] }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const { draft } = builder;
  const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey,
    modifiers: { purchaseMode: draft.context.purchaseMode, housePartyPlaceMode: draft.context.housePartyPlaceMode,
      visitFormat: draft.context.visitFormat, socialOccasion: draft.context.socialOccasion } });
  const route = draft.context.route;
  const home = places.find((place) => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
  const physicalLabel = (ref: NonNullable<typeof draft.context.place>) => ref.kind === "TEXT"
    ? ref.label : places.find((place) => place.placeId === ref.placeId)?.name ?? "Lieu choisi";
  const changeStops = (stops: readonly PlannedRouteStop[], topologyChanged = false) => {
    setBuilder((current) => editBuilderDraft(current, { ...current.draft,
      context: { ...current.draft.context, route: { mode: "CAR", stops: topologyChanged
        ? invalidateRouteDistances(stops) : deduplicateRouteStops(stops) } },
      costItems: current.draft.costItems.filter((item) => item.assetKey !== "transport:fuel_usage") }));
    setMessage("");
  };
  const estimate = async () => {
    if (!route) return;
    const revision = builder.revision;
    setBusy(true); setMessage("");
    try {
      const result = await estimatePlannedRoute(targetMonth, route.stops);
      setBuilder((current) => {
        if (current.revision !== revision) return current;
        const fuel = result.fuelEstimate;
        const item: CostItem | null = fuel ? { id: crypto.randomUUID(), assetKey: "transport:fuel_usage",
          label: "Usage carburant estimé", quantity: "1", unitAmount: fuel.cost, baselineKey: null,
          modulePath: [resolved.rootModule], priceSource: "CALCULATED", priceSourceLabel: fuel.fuelPriceSource } : null;
        return editBuilderDraft({ ...current, origins: { ...current.origins, ...(item ? { [`cost.${item.id}`]: "AUTO_DERIVED" as const } : {}) } }, { ...current.draft, context: { ...current.draft.context,
          route: { mode: "CAR", stops: result.stops, ...(fuel ? { fuelEstimate: fuel } : {}) } },
          costItems: [...current.draft.costItems.filter((cost) => cost.assetKey !== "transport:fuel_usage"), ...(item ? [item] : [])] });
      });
      setMessage(result.status === "PARTIAL" ? "Trajet partiellement connu : renseignez les kilomètres des segments sans historique, puis recalculez." : "Trajet recalculé dans l’ordre des étapes.");
    } catch { setMessage("Vérifiez les lieux et les kilomètres saisis. L’estimation n’a pas abouti."); }
    finally { setBusy(false); }
  };
  return <div id="builder-route" className="grid gap-3">
    {resolved.children.filter((edge) => edge.localPlacePolicy !== "HIDDEN"
      && draft.costItems.some((item) => item.modulePath?.[1] === edge.childModule)).map((edge) => {
      const child = edge.childModule, ref = draft.context.childLocalPlaceRefs?.[child];
      const candidates = placesForChildModule(places, child);
      return <fieldset key={child} className="rounded-xl border border-slate-200 p-3"><legend className="px-1 font-bold">Lieu du complément · {childLabel(child)}</legend>
        <p className="mb-2 text-xs text-slate-600">Choisissez son lieu si utile. Le lieu principal n’est pas repris automatiquement.</p>
        <label className="grid gap-1 text-sm">Lieu connu<select className={inputClass} value={ref?.kind === "KNOWN" ? ref.placeId : ref?.kind === "TEXT" ? "TEXT" : ""}
          onChange={(event) => setBuilder((current) => setBuilderChildPlace(current, child, event.target.value === "TEXT"
            ? { kind: "TEXT", label: "", provenance: "USER_DECLARED_PROSPECTIVE" }
            : event.target.value ? { kind: "KNOWN", placeId: event.target.value } : undefined))}>
          <option value="">Sans lieu précisé</option>{candidates.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Autre lieu à saisir</option></select></label>
        {ref?.kind === "TEXT" && <label className="mt-2 grid gap-1 text-sm">Nom du lieu<input className={inputClass} value={ref.label}
          onChange={(event) => setBuilder((current) => setBuilderChildPlace(current, child, { ...ref, label: event.target.value }))} /></label>}
        {edge.rootTransportStopAvailability !== "NEVER" && ref && route && <button type="button" className={`${buttonClass} mt-2`}
          disabled={route.stops.some((stop) => stop.childModule === child) || ref.kind === "TEXT" && !ref.label.trim()}
          onClick={() => setBuilder((current) => addBuilderChildRouteStop(current, child, physicalLabel(ref)))}>Ajouter au trajet{route.stops.some((stop) => stop.childModule === child) ? " · déjà ajouté" : ""}</button>}
        <button type="button" className={`${buttonClass} ml-2 mt-2`} onClick={() => setBuilder((current) => removeBuilderChild(current, child))}>Retirer {childLabel(child)}</button>
      </fieldset>;
    })}
    {resolved.transport !== "FORBIDDEN" && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Prévoir notre trajet en voiture</summary>
      <p className="mt-2 text-xs text-slate-600">Chaque étape rejoint la suivante. L’historique respecte le sens du trajet ; un retour se choisit explicitement.</p>
      <fieldset className="mt-2"><legend className="text-sm font-bold">Qui effectue le trajet ?</legend><div className="flex gap-4">{persons.map((person) => <label key={person.personId} className="flex gap-2 text-sm"><input type="checkbox" checked={draft.context.travellingParticipantPersonIds?.includes(person.personId) ?? false}
        onChange={() => setBuilder((current) => { const previous = current.draft.context.travellingParticipantPersonIds ?? [];
          return editBuilderDraft(current, { ...current.draft, context: { ...current.draft.context, travellingParticipantPersonIds:
            previous.includes(person.personId) ? previous.filter((id) => id !== person.personId) : [...previous, person.personId] } }); })} />{person.displayName}</label>)}</div></fieldset>
      <div className="mt-3 flex gap-2">{["transport:toll", "transport:parking"].map((assetKey) => {
        const asset = plannedAsset(assetKey)!;
        return <button key={assetKey} type="button" className={buttonClass} disabled={draft.costItems.length >= 50} onClick={() => setBuilder((current) => editBuilderDraft(current,
          { ...current.draft, costItems: [...current.draft.costItems, { id: crypto.randomUUID(), assetKey,
            label: asset.label, quantity: "1", unitAmount: "", baselineKey: null, modulePath: [resolved.rootModule], priceSource: "MANUAL" }] }))}>Ajouter {asset.label.toLocaleLowerCase("fr")}</button>;
      })}</div>
      {!route && <button type="button" className={`${buttonClass} mt-2`} onClick={() => changeStops([
        home ? { label: home.name, placeId: home.placeId, endpointSource: "DIRECT_PLACE" } : { label: "Départ à préciser", endpointSource: "DIRECT_PLACE" },
        draft.context.place ? stopForPlace(draft.context.place, physicalLabel(draft.context.place), "ROOT_PLACE")
          : { label: "Destination à préciser", endpointSource: "DIRECT_PLACE" }], true)}>Prévoir un trajet voiture</button>}
      {route && <div className="mt-3 grid gap-3">{route.stops.map((stop, index) => <div key={index} className="grid grid-cols-[1fr_10rem_auto] gap-2 rounded-xl bg-slate-50 p-3">
        <div><label className="grid gap-1 text-sm">Étape {index + 1}<select className={inputClass} value={stop.endpointSource === "ROOT_PLACE" ? "ROOT" : stop.endpointSource === "CHILD_LOCAL_PLACE" ? `CHILD:${stop.childModule}` : stop.placeId ?? "TEXT"}
          onChange={(event) => { const value = event.target.value; const ref = value === "ROOT" ? draft.context.place : value.startsWith("CHILD:")
            ? draft.context.childLocalPlaceRefs?.[value.slice(6) as keyof NonNullable<typeof draft.context.childLocalPlaceRefs>] : undefined;
            const known = places.find((place) => place.placeId === value);
            const replacement = ref ? stopForPlace(ref, physicalLabel(ref), value === "ROOT" ? "ROOT_PLACE" : "CHILD_LOCAL_PLACE", value === "ROOT" ? undefined : value.slice(6) as PlannedRouteStop["childModule"])
              : known ? { label: known.name, placeId: known.placeId, endpointSource: "DIRECT_PLACE" as const } : { label: "", endpointSource: "DIRECT_PLACE" as const };
            changeStops(route.stops.map((part, i) => i === index ? replacement : part), true); }}>
          {draft.context.place && <option value="ROOT">Lieu principal · {physicalLabel(draft.context.place)}</option>}
          {resolved.children.filter((edge) => edge.rootTransportStopAvailability !== "NEVER" && draft.context.childLocalPlaceRefs?.[edge.childModule]).map((edge) => <option key={edge.childModule} value={`CHILD:${edge.childModule}`}>{childLabel(edge.childModule)} · {physicalLabel(draft.context.childLocalPlaceRefs![edge.childModule]!)}</option>)}
          {places.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Lieu à saisir</option></select></label>
          {!stop.placeId && stop.endpointSource !== "ROOT_PLACE" && stop.endpointSource !== "CHILD_LOCAL_PLACE" && <label className="mt-1 grid gap-1 text-sm">Nom du lieu<input className={inputClass} value={stop.label} onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, label: event.target.value } : part), true)} /></label>}
        </div>
        {index < route.stops.length - 1 ? <div><label className="grid gap-1 text-sm">Km vers {route.stops[index + 1]!.label}<input className={inputClass} type="number" min="0.001" step="0.001" value={stop.distanceToNextKm ?? ""}
          onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, distanceToNextKm: event.target.value, distanceSource: "MANUAL", evidence: undefined, estimatedFuelLiters: undefined } : part))} /></label>
          <p className="mt-1 text-xs">{stop.distanceSource === "HISTORICAL_ROUTE" ? `Historique dirigé · ${stop.evidence?.observationCount} observations` : stop.distanceToNextKm ? "Kilomètres saisis" : "Historique à rechercher ou km à saisir"}</p>
          {stop.evidence && <details className="text-xs"><summary>Sources</summary><p>{stop.evidence.minimumKm}–{stop.evidence.maximumKm} km · {stop.evidence.firstDate} au {stop.evidence.lastDate} · {stop.evidence.method}</p></details>}</div> : <span className="self-center text-sm">Arrivée</span>}
        <div className="flex items-center gap-1"><button type="button" className={buttonClass} disabled={index === 0} aria-label={`Monter l’étape ${index + 1}`} onClick={() => { const next = [...route.stops]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; changeStops(next, true); }}>↑</button><button type="button" className={buttonClass} disabled={route.stops.length <= 2} aria-label={`Retirer l’étape ${index + 1}`} onClick={() => changeStops(route.stops.filter((_, i) => i !== index), true)}>×</button></div>
      </div>)}
      <div className="flex gap-2"><button type="button" className={buttonClass} disabled={route.stops.length >= 12} onClick={() => changeStops([...route.stops, { label: "", endpointSource: "DIRECT_PLACE" }], true)}>Ajouter une étape</button>
        {home && <button type="button" className={buttonClass} disabled={route.stops.length >= 12 || route.stops.at(-1)?.placeId === home.placeId} onClick={() => changeStops([...route.stops, { label: home.name, placeId: home.placeId, endpointSource: "DIRECT_PLACE" }], true)}>Ajouter le retour à la maison</button>}
        <button type="button" className={buttonClass} disabled={busy || !vehicle} onClick={estimate}>{busy ? "Calcul…" : "Rechercher l’historique et recalculer"}</button>
        <button type="button" className={buttonClass} onClick={() => setBuilder((current) => editBuilderDraft(current, { ...current.draft, context: { ...current.draft.context, route: undefined }, costItems: current.draft.costItems.filter((item) => item.assetKey !== "transport:fuel_usage") }))}>Retirer le trajet</button></div>
      {message && <p role="status" className="text-sm text-amber-900">{message}</p>}
      {route.fuelEstimate && <div className="rounded-xl bg-emerald-50 p-3 text-sm"><strong>Usage carburant estimé · {route.fuelEstimate.cost} €</strong>
        <p>{routeSegments(route.stops).length} segments · {route.fuelEstimate.distanceKm} km · {route.fuelEstimate.liters} L · {route.fuelEstimate.fuelPricePerLiter} €/L</p>
        <p>{route.fuelEstimate.fuelPriceSource}{route.fuelEstimate.fuelPriceObservedAt && ` · observation ${route.fuelEstimate.fuelPriceObservedAt.slice(0, 10)}`}{route.fuelEstimate.fuelPriceQuality && ` · ${route.fuelEstimate.fuelPriceQuality}`}</p>
        <p>Les segments historiques utilisent leur consommation observée. Les segments saisis utilisent {route.fuelEstimate.consumptionL100Km} L/100 km.</p><p>Usage économique estimé ; aucun plein ni paiement n’est créé.</p></div>}
      </div>}
    </details>}
  </div>;
}
