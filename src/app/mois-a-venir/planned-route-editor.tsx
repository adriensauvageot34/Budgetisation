"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Car, MapPin } from "lucide-react";
import { addBuilderChildRouteStop, changeBuilderContext, commitBuilderCost, editBuilderDraft, invalidateRouteDistances,
  removeBuilderChild, removeBuilderCost, setBuilderChildPlace, type BuilderState } from "@/domain/phase2/planned-builder";
import type { PlannedRouteStop, PlannedVehicleEstimate } from "@/domain/phase2/planned-contract";
import { applyCarResult, isDerivedCarCost, selectCarVariant, manualTollCost, type PlannedCarResult } from "@/domain/phase2/planned-car";
import { PlannedCarSummary } from "./planned-car-summary";
import { plannedContextModifiers, resolvePlannedContext } from "@/domain/phase2/planned-rules";
import { placesForChildModule, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { ensurePrimaryRouteStop, stopForPlace } from "@/domain/phase2/planned-routes";
import { plausibleTransportModes } from "@/domain/phase2/planned-ux";
import { estimatePlannedRoute } from "./planned-expenses-actions";
import { plannedAsset } from "@/domain/phase2/planned-assets";
import { ChoiceTiles, LocalAssetEditor, OptionalAction, builderButton, builderInput, builderMoney } from "./planned-builder-primitives";

const childLabel = (child: string) => ({ restaurant: "Restaurant", activity: "Activité", bar: "Bar", club: "Club" } as Record<string, string>)[child] ?? "Complément";
const modeLabels: Record<string, string> = { CAR: "Voiture", TRAIN: "Train", BUS: "Bus / transport payant", TAXI: "Uber / taxi", OTHER: "Autre", PLANE: "Avion" };
function ManualCoordinates({ stop, onApply }: { stop: PlannedRouteStop; onApply: (latitude: number, longitude: number) => void }) {
  const [latitude, setLatitude] = useState(stop.coordinates ? String(stop.coordinates.latitude) : "");
  const [longitude, setLongitude] = useState(stop.coordinates ? String(stop.coordinates.longitude) : "");
  return <details className="mt-2 text-xs text-slate-500"><summary>Préciser les coordonnées de ce lieu</summary><div className="mt-2 flex gap-2"><label>Latitude<input type="number" step="any" className={builderInput} value={latitude} onChange={(e) => setLatitude(e.target.value)} /></label><label>Longitude<input type="number" step="any" className={builderInput} value={longitude} onChange={(e) => setLongitude(e.target.value)} /></label><button type="button" className={builderButton} disabled={!latitude || !longitude || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180} onClick={() => onApply(Number(latitude), Number(longitude))}>Utiliser</button></div></details>;
}
export function PlannedRouteEditor({ builder, setBuilder, places, vehicle, targetMonth }: {
  builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>; places: readonly PlannedPlaceOption[];
  vehicle: PlannedVehicleEstimate | null; targetMonth: string; persons: readonly { personId: string; displayName: string }[];
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [actor, setActor] = useState<"US" | "OTHER">(builder.draft.context.transportMode === "CARPOOL" ? "OTHER" : "US");
  const [paid, setPaid] = useState<boolean | null>(builder.draft.context.transportMode ? builder.draft.context.transportMode !== "FREE" : null);
  const [editing, setEditing] = useState(false);
  const [estimate, setEstimate] = useState<PlannedCarResult | null>(null);
  const lastRequested = useRef("");
  const currentRoute = useRef("");
  const draft = builder.draft, route = draft.context.route;
  const resolved = resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey, modifiers: plannedContextModifiers(draft.context) });
  const mode = draft.context.transportMode ?? route?.mode;
  const home = places.find((place) => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
  const physicalLabel = (ref: NonNullable<typeof draft.context.place>) => ref.kind === "TEXT" ? ref.label : places.find((place) => place.placeId === ref.placeId)?.name ?? "Lieu choisi";
  const applyMode = (mode?: typeof draft.context.transportMode) => {
    setBuilder((state) => changeBuilderContext(state, { ...state.draft.context, transportMode: mode }));
    setMessage("");
  };
  const changeStops = (stops: readonly PlannedRouteStop[], topology = true) => {
    // The primary destination is always retained, including when a child stop is removed/reordered.
    const next = ensurePrimaryRouteStop(stops, draft.context.place, draft.context.place ? physicalLabel(draft.context.place) : "", home?.placeId);
    setBuilder((state) => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, transportMode: "CAR",
      route: { ...state.draft.context.route, mode: "CAR", stops: topology ? invalidateRouteDistances(next) : next,
        liveEstimate: undefined, fuelEstimate: undefined, tollFreeConfirmed: undefined } }, costItems: state.draft.costItems.filter((item) => !isDerivedCarCost(item)) }));
    setMessage("");
  };
  const routeSignature = mode === "CAR" && route && resolved.transport !== "FORBIDDEN" ? JSON.stringify([route.stops.map((s) => [s.label, s.placeId, s.endpointSource, s.childModule,
    s.coordinates?.source === "USER_DECLARED" ? s.coordinates : null, s.distanceSource === "MANUAL" ? s.distanceToNextKm : null]), draft.plannedDate, route.plannedTime, route.timeKind, route.manualFuelPrice, route.preference]) : "";
  currentRoute.current = routeSignature;
  const draftRef = useRef(draft); draftRef.current = draft;
  useEffect(() => {
    if (!routeSignature || route?.fuelEstimate || route?.liveEstimate || !vehicle || lastRequested.current === routeSignature) return;
    const timer = window.setTimeout(async () => {
      lastRequested.current = routeSignature; setBusy(true); setMessage(""); setEstimate(null);
      try {
        const result = await estimatePlannedRoute(targetMonth, draftRef.current);
        if (currentRoute.current !== routeSignature) return;
        setEstimate(result);
        setBuilder((state) => {
          const next = applyCarResult(state.draft, result, () => crypto.randomUUID());
          const origins = { ...state.origins };
          for (const item of next.costItems.filter(isDerivedCarCost)) origins[`cost.${item.id}`] = "AUTO_DERIVED";
          return editBuilderDraft({ ...state, origins }, next);
        });
        setMessage(result.messages.join(" "));
        if (result.status === "PARTIAL") setEditing(true);
      } catch { if (currentRoute.current === routeSignature) { setMessage("Le trajet n’a pas pu être calculé. Vérifiez les lieux ou précisez la distance."); setEditing(true); } }
      finally { if (lastRequested.current === routeSignature) setBusy(false); }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [routeSignature, !!route?.fuelEstimate, !!route?.liveEstimate, targetMonth, !!vehicle]);
  const refreshCar = () => { lastRequested.current = ""; setEstimate(null); setBuilder((state) => editBuilderDraft(state, {
    ...state.draft, context: { ...state.draft.context, route: state.draft.context.route ? { ...state.draft.context.route,
      fuelEstimate: undefined, liveEstimate: undefined } : undefined }, costItems: state.draft.costItems.filter((item) => !isDerivedCarCost(item)) })); };
  const startCar = () => {
    if (!draft.context.place) { setEditing(true); return; }
    const departure: PlannedRouteStop = home ? { label: home.name, placeId: home.placeId, endpointSource: "DIRECT_PLACE" } : { label: "Maison", endpointSource: "DIRECT_PLACE" };
    changeStops([departure, stopForPlace(draft.context.place, physicalLabel(draft.context.place), "ROOT_PLACE"), departure]);
  };
  const transportCostKeys = actor === "OTHER" && paid ? ["transport:carpool"] : mode === "CAR" ? [...(!route?.liveEstimate || route.liveEstimate.toll.amount === null || manualTollCost(draft.costItems) ? ["transport:toll"] : []), "transport:parking"]
    : mode && mode !== "FREE" ? [`transport:${({ TRAIN: "train", BUS: "bus", TAXI: "uber", CARPOOL: "carpool", OTHER: "other", PLANE: "flight" } as Record<string, string>)[mode]}`] : [];
  return <div id="builder-route" className="grid gap-3">
    {resolved.children.filter((edge) => edge.localPlacePolicy !== "HIDDEN" && draft.costItems.some((item) => item.modulePath?.[1] === edge.childModule)).map((edge) => {
      const child = edge.childModule, ref = draft.context.childLocalPlaceRefs?.[child];
      return <OptionalAction key={child} label={`Préciser le lieu · ${childLabel(child)}`} active={!!ref}>
        <label className="grid gap-1 text-sm">Où est prévu ce {childLabel(child).toLocaleLowerCase("fr")} ?<select className={builderInput} value={ref?.kind === "KNOWN" ? ref.placeId : ref?.kind === "TEXT" ? "TEXT" : ""}
          onChange={(event) => setBuilder((state) => setBuilderChildPlace(state, child, event.target.value === "TEXT" ? { kind: "TEXT", label: "", provenance: "USER_DECLARED_PROSPECTIVE" } : event.target.value ? { kind: "KNOWN", placeId: event.target.value } : undefined))}>
          <option value="">Sans lieu précisé</option>{placesForChildModule(places, child).map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Autre lieu à saisir</option></select></label>
        {ref?.kind === "TEXT" && <input className={`${builderInput} mt-2`} aria-label={`Lieu du ${childLabel(child)}`} value={ref.label} onChange={(event) => setBuilder((state) => setBuilderChildPlace(state, child, { ...ref, label: event.target.value }))} />}
        {edge.rootTransportStopAvailability !== "NEVER" && ref && route && <button className={`${builderButton} mt-3`} disabled={route.stops.some((stop) => stop.childModule === child) || ref.kind === "TEXT" && !ref.label.trim()} onClick={() => setBuilder((state) => addBuilderChildRouteStop(state, child, physicalLabel(ref)))}>Ajouter cet arrêt au trajet</button>}
        <button className="ml-3 text-xs underline" onClick={() => setBuilder((state) => removeBuilderChild(state, child))}>Retirer ce complément</button>
      </OptionalAction>;
    })}
    {resolved.transport !== "FORBIDDEN" && <OptionalAction label={draft.subtypeKey === "work_meal" ? "Ajouter un déplacement exceptionnel pour chercher le repas" : "Ajouter un trajet"} active={!!mode}>
      <div className="grid gap-4"><ChoiceTiles label="Qui prend en charge le trajet ?" value={actor} choices={[{ key: "US", label: "Nous" }, { key: "OTHER", label: "Quelqu’un d’autre" }]} onChange={(key) => { setActor(key as typeof actor); setPaid(null); applyMode(undefined); }} />
        <ChoiceTiles label={actor === "US" ? "Ce trajet nous coûtera-t-il quelque chose ?" : "Participez-vous aux frais ?"} value={paid === null ? undefined : paid ? "PAID" : "FREE"} choices={actor === "US" ? [{ key: "FREE", label: "Gratuit" }, { key: "PAID", label: "Payant" }] : [{ key: "FREE", label: "Non" }, { key: "PAID", label: "Oui" }]} onChange={(key) => { setPaid(key === "PAID"); applyMode(key === "FREE" ? "FREE" : actor === "OTHER" ? "CARPOOL" : undefined); }} />
        {paid && actor === "US" && <ChoiceTiles label="Comment vous déplacerez-vous ?" value={mode} choices={plausibleTransportModes(draft, places).map((key) => ({ key, label: modeLabels[key]! }))} onChange={(key) => { applyMode(key as typeof mode); if (key === "CAR") startCar(); }} />}
        {paid === false && <p className="text-sm text-slate-500">Aucun coût de trajet prévu.</p>}
        {mode === "CAR" && !route && <div className="grid gap-3"><p className="text-sm">Précisez la destination pour calculer le trajet voiture.</p><label className="grid gap-1 text-sm">Destination<input className={builderInput} value={draft.context.place?.kind === "TEXT" ? draft.context.place.label : ""} onChange={(event) => setBuilder((state) => changeBuilderContext(state, { ...state.draft.context, place: event.target.value ? { kind: "TEXT", label: event.target.value, provenance: "USER_DECLARED_PROSPECTIVE" } : undefined }))} /></label><button className={builderButton} disabled={!draft.context.place || draft.context.place.kind === "TEXT" && !draft.context.place.label.trim()} onClick={startCar}>Utiliser cette destination</button></div>}
        {mode === "CAR" && route && <section className="rounded-xl bg-white p-4"><h4 className="flex items-center gap-2 text-sm font-bold"><Car size={17} />Trajet voiture</h4><ol className="mt-3 grid gap-2 border-l-2 border-indigo-100 pl-4 text-sm">{route.stops.map((stop, index) => <li key={index} className="flex gap-2"><MapPin size={14} className={stop.endpointSource === "ROOT_PLACE" ? "text-indigo-700" : "text-slate-400"} /><span>{stop.label}<span className="text-xs text-slate-400">{stop.endpointSource === "ROOT_PLACE" ? " · destination" : stop.endpointSource === "CHILD_LOCAL_PLACE" ? " · arrêt" : ""}</span></span></li>)}</ol>
          <div aria-live="polite" className="mt-3 text-sm">{busy ? "Calcul du trajet…" : route.liveEstimate ? <PlannedCarSummary draft={draft} variants={estimate?.variants ?? [route.liveEstimate]} onSelect={(snapshot) => {
            if (!estimate) return; setBuilder((state) => editBuilderDraft(state, applyCarResult(state.draft, selectCarVariant(estimate, snapshot), () => crypto.randomUUID())));
          }} onRefresh={refreshCar} onConfirmNoToll={() => setBuilder((state) => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context,
            route: { ...state.draft.context.route!, tollFreeConfirmed: true } } }))} /> : route.fuelEstimate ? <><strong>≈ {route.fuelEstimate.distanceKm} km · ≈ {builderMoney(route.fuelEstimate.cost)}</strong><p className="text-xs text-slate-500">Estimation historique conservée · essence utilisée, pas un plein payé.</p><button type="button" className="mt-2 underline" onClick={refreshCar}>Calculer l’itinéraire actuel</button></> : "Le trajet n’est pas encore calculé."}</div>
          <button className="mt-3 text-sm font-semibold text-indigo-700 underline" onClick={() => setEditing(!editing)}>{editing ? "Replier le trajet" : "Changer l’itinéraire"}</button>
          {editing && <div className="mt-3 grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs">Heure du trajet (facultative)<input type="time" disabled={!draft.plannedDate} className={builderInput} value={route.plannedTime ?? ""} onChange={(event) => { lastRequested.current = ""; setBuilder((state) => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, plannedTime: event.target.value || null, liveEstimate: undefined, fuelEstimate: undefined } }, costItems: state.draft.costItems.filter((i) => !isDerivedCarCost(i)) })); }} /></label><label className="grid gap-1 text-xs">Cet horaire correspond au<select className={builderInput} value={route.timeKind ?? "DEPARTURE"} onChange={(event) => { lastRequested.current = ""; setBuilder((state) => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, timeKind: event.target.value as "DEPARTURE" | "ARRIVAL", liveEstimate: undefined, fuelEstimate: undefined } }, costItems: state.draft.costItems.filter((i) => !isDerivedCarCost(i)) })); }}><option value="DEPARTURE">Départ</option><option value="ARRIVAL">Arrivée</option></select></label></div>}
          {(route.liveEstimate?.fuelEconomicCost === null || route.manualFuelPrice !== undefined) && <label className="mt-3 grid gap-1 text-xs">Prix SP95 au litre (si aucune référence disponible)<input type="number" min="0.001" max="9.999" step="0.001" className={builderInput} value={route.manualFuelPrice ?? ""} onChange={(event) => { lastRequested.current = ""; setBuilder((state) => editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, route: { ...state.draft.context.route!, manualFuelPrice: event.target.value || undefined, liveEstimate: undefined, fuelEstimate: undefined } } })); }} /></label>}
          {editing && <div className="mt-4 grid gap-3">{route.stops.map((stop, index) => <div key={index} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2"><label className="grid gap-1 text-xs">{index === 0 ? "Départ" : stop.endpointSource === "ROOT_PLACE" ? "Destination" : index === route.stops.length - 1 ? "Retour" : "Arrêt"}<select className={builderInput} disabled={stop.endpointSource === "ROOT_PLACE"} value={stop.placeId ?? "TEXT"} onChange={(event) => { const selected = places.find((place) => place.placeId === event.target.value); changeStops(route.stops.map((part, i) => i === index ? selected ? { label: selected.name, placeId: selected.placeId, endpointSource: "DIRECT_PLACE" } : { label: "", endpointSource: "DIRECT_PLACE" } : part)); }}>
            {places.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Lieu saisi · {stop.label}</option></select>{!stop.placeId && stop.endpointSource !== "ROOT_PLACE" && <input className={builderInput} aria-label={`Nom de l’arrêt ${index + 1}`} value={stop.label} onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, label: event.target.value } : part))} />}</label>
            {!places.find((place) => place.placeId === stop.placeId)?.coordinates && <ManualCoordinates stop={stop} onApply={(latitude, longitude) => changeStops(route.stops.map((part, i) => i === index ? { ...part, coordinates: { latitude, longitude, source: "USER_DECLARED" } } : part))} />}
            {index < route.stops.length - 1 && !route.fuelEstimate && !busy && <label className="grid gap-1 text-xs">Distance de repli (km)<input type="number" min="0.001" step="0.001" className={builderInput} value={stop.distanceToNextKm ?? ""} onChange={(event) => changeStops(route.stops.map((part, i) => i === index ? { ...part, distanceToNextKm: event.target.value, distanceSource: "MANUAL", evidence: undefined, estimatedFuelLiters: undefined } : part), false)} /></label>}
            <div className="flex gap-1"><button className={builderButton} disabled={index === 0 || index === route.stops.length - 1} aria-label={`Avancer l’arrêt ${index + 1}`} onClick={() => { const next = [...route.stops]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; changeStops(next); }}>↑</button><button className={builderButton} disabled={route.stops.length <= 2 || stop.endpointSource === "ROOT_PLACE"} aria-label={`Retirer l’arrêt ${index + 1}`} onClick={() => changeStops(route.stops.filter((_, i) => i !== index))}>×</button></div>
          </div>)}<button className={`${builderButton} w-fit`} disabled={route.stops.length >= 12} onClick={() => { const next = [...route.stops]; next.splice(Math.max(1, next.length - 1), 0, { label: "", endpointSource: "DIRECT_PLACE" }); changeStops(next); }}>Ajouter un arrêt</button></div>}
        </section>}
        {transportCostKeys.map((key) => { const asset = plannedAsset(key); if (!asset) return null; const item = draft.costItems.find((part) => part.assetKey === key); return <OptionalAction key={key} label={actor === "OTHER" ? "Préciser notre participation" : asset.label} active={!!item}><LocalAssetEditor item={item} asset={asset} wallets={[]} categoryAmount onConfirm={(item) => setBuilder((state) => commitBuilderCost(state, { ...item, modulePath: [resolved.rootModule], baselineKey: null }))} onRemove={item ? () => setBuilder((state) => removeBuilderCost(state, item.id)) : undefined} /></OptionalAction>; })}
        {message && <p role="status" className="text-sm text-amber-900">{message}</p>}{mode === "CAR" && !vehicle && <p className="text-sm text-amber-800">Il manque une référence de véhicule ou de prix de carburant pour estimer ce trajet.</p>}
        {mode && <button className="w-fit text-xs text-slate-500 underline" onClick={() => { applyMode(undefined); setPaid(null); setMessage("Le trajet précédent reste récupérable avec Annuler."); }}>Retirer le trajet</button>}
      </div>
    </OptionalAction>}
  </div>;
}
