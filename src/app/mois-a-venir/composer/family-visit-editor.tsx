"use client";
import { useRef, useState, type ReactNode } from "react";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerMobilitySummary, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ProspectivePersonRef, ProspectivePlaceRef, PlannedRouteStop } from "@/domain/phase2/planned-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { stopForPlace } from "@/domain/phase2/planned-routes";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { PlannedRouteCoordinatesField } from "../planned-route-coordinates-field";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { MobilityEstimateSummary } from "./mobility-estimate-summary";
import styles from "./composer.module.css";

type Transport = Extract<ComponentSelectionV1, { kind: "MOBILITY_INTENT" }>;
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const text = (value: unknown) => typeof value === "string" ? value : "";
const availableRef = (ref?: ProspectivePlaceRef) => ref && (ref.kind === "KNOWN" || ref.label.trim());
const amount = (raw: string) => decisionAmount(raw.trim().replace(",", "."));
const modeLabels: Record<string, string> = { car: "Voiture", train: "Train / tram", bus: "Bus", taxi: "Taxi / Uber", free: "À pied / gratuit", other: "Autre transport", unknown: "À préciser" };

export function ProspectiveContextEditor({ stay = false, posts, context, targetMonth, householdPersons, options, summary, fresh, knowledge, initialMode, busy, onSave, onCancel }: {
  context: PlannedContextState; householdPersons: ComposerUiModel["householdPersons"]; options?: ComposerUiModel["mobilityOptions"];
  targetMonth: string; stay?: boolean; posts?: ReactNode;
  summary?: ComposerMobilitySummary; fresh: boolean; knowledge?: CardKnowledgeRead; initialMode?: string; busy: boolean;
  onSave: (operation: ComposerOperation) => void; onCancel: () => void;
}) {
  const prior = context.slotSelections.transport?.items;
  const original = Array.isArray(prior) && prior[0]?.kind === "MOBILITY_INTENT" ? prior[0] as Transport : undefined;
  const [label, setLabel] = useState(text(context.fields.label)), [date, setDate] = useState(text(context.fields.plannedDate));
  const [endDate, setEndDate] = useState(text(context.fields.endDate)), [note, setNote] = useState(text(context.fields.timingNote));
  const [visited, setVisited] = useState(context.fields.personVisitedRef as ProspectivePersonRef | undefined);
  const [people, setPeople] = useState((context.fields.participantRefs ?? []) as unknown as ProspectivePersonRef[]);
  const [destination, setDestination] = useState((context.fields[stay ? "destinationRef" : "placeRef"] ?? original?.destination ?? undefined) as ProspectivePlaceRef | undefined);
  const [origin, setOrigin] = useState(original?.origin ?? undefined), [mode, setMode] = useState(initialMode ?? original?.optionKey ?? "");
  const [returnRequired, setReturnRequired] = useState(original?.returnRequired ?? false);
  const [outTime, setOutTime] = useState(original?.plannedTime ?? ""), [returnTime, setReturnTime] = useState(original?.returnTime ?? "");
  const [vehicleId, setVehicleId] = useState(original?.route?.vehicleRef?.vehicleId ?? "");
  const [preference, setPreference] = useState(original?.pricing?.preference ?? "FASTEST");
  const [fareMode, setFareMode] = useState(original?.pricing?.fare.kind ?? "UNKNOWN"), [fare, setFare] = useState(original?.pricing?.fare.kind === "MANUAL" ? original.pricing.fare.unitAmount : "");
  const [parkingMode, setParkingMode] = useState(original?.pricing?.parking.kind ?? "UNKNOWN"), [parking, setParking] = useState(original?.pricing?.parking.kind === "MANUAL" ? original.pricing.parking.unitAmount : "");
  const [tollMode, setTollMode] = useState(original?.route?.toll?.kind ?? "AUTO"), [toll, setToll] = useState(original?.route?.toll?.kind === "MANUAL" ? original.route.toll.unitAmount : "");
  const [fuelPrice, setFuelPrice] = useState(original?.route?.manualFuelPrice ?? "");
  const [funding, setFunding] = useState(original?.pricing?.fundingAllocations[0]?.source ?? ""), [fundingAmount, setFundingAmount] = useState(original?.pricing?.fundingAllocations[0]?.amount ?? "");
  const [ownJourney, setOwnJourney] = useState(!original?.journey || original.journey.relation === "OWNS_JOURNEY");
  const anchor = original?.route?.stops.findIndex(stop => stop.endpointSource === "ROOT_PLACE") ?? -1;
  const [outStops, setOutStops] = useState<readonly PlannedRouteStop[]>(anchor > 0 ? original!.route!.stops.slice(1, anchor) : []);
  const [backStops, setBackStops] = useState<readonly PlannedRouteStop[]>(anchor > 0 && original?.returnRequired ? original.route!.stops.slice(anchor + 1, -1) : []);
  const [error, setError] = useState(""); const scroll = useRef<HTMLDivElement>(null);
  const transportInputs = [origin, destination, mode, returnRequired, outTime, returnTime, vehicleId, preference, fareMode, fare,
    parkingMode, parking, tollMode, toll, fuelPrice, funding, fundingAmount, ownJourney, outStops, backStops];
  const initialInputs = useRef(JSON.stringify(transportInputs));
  const places = options?.places ?? [], vehicle = options?.vehicle;
  const home = places.find(place => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
  const physicalLabel = (ref: ProspectivePlaceRef) => ref.kind === "TEXT" ? ref.label : places.find(p => p.placeId === ref.placeId)?.name ?? "Lieu lié indisponible";
  const setTransportMode = (next: string) => {
    if (next !== mode) { setMode(next); setFareMode("UNKNOWN"); setFare(""); setFunding(""); setFundingAmount(""); setOwnJourney(true); }
  };
  const save = () => {
    try {
      const fields: Record<string, PlannerJson> = {};
      for (const [key, value, baseline] of [["label", label.trim(), text(context.fields.label)], ["plannedDate", date, text(context.fields.plannedDate)],
        ["endDate", endDate, text(context.fields.endDate)], ["timingNote", note.trim(), text(context.fields.timingNote)]] as const)
        if (value !== baseline) fields[key] = value || null;
      for (const [key, value] of [...(stay ? [] : [["personVisitedRef", visited] as const]), ["participantRefs", people], [stay ? "destinationRef" : "placeRef", destination]] as const)
        if (!equal(value, context.fields[key])) fields[key] = (value ?? null) as unknown as PlannerJson;
      if (people.some(p => p.kind === "TEXT" && !p.label.trim()) || visited?.kind === "TEXT" && !visited.label.trim()) throw Error("Précisez le nom des personnes choisies.");
      if (destination?.kind === "TEXT" && !destination.label.trim() || origin?.kind === "TEXT" && !origin.label.trim()) throw Error("Précisez les lieux saisis, ou laissez-les inconnus.");
      if ([date, endDate].some(d => d && (!d.startsWith(`${targetMonth}-`) || !/^\d{4}-\d{2}-\d{2}$/u.test(d)
        || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d))) throw Error("Choisissez une date du mois préparé, ou laissez-la non fixée.");
      if (date && endDate && (endDate < date || endDate === date && outTime && returnTime && returnTime < outTime)) throw Error("Le retour doit être après le départ.");
      const normalizedFuel = fuelPrice.trim().replace(",", ".");
      if (normalizedFuel && !/^[0-9](?:\.[0-9]{1,3})?$/u.test(normalizedFuel)) throw Error("Renseignez un prix carburant positif avec trois décimales au maximum.");
      const pricing = { fare: fareMode === "QUOTE" && original?.pricing?.fare.kind === "QUOTE" ? original.pricing.fare
        : fareMode === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: amount(fare) } : { kind: "UNKNOWN" as const },
        parking: parkingMode === "QUOTE" && original?.pricing?.parking.kind === "QUOTE" ? original.pricing.parking
          : parkingMode === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: amount(parking) } : { kind: "UNKNOWN" as const },
        fundingAllocations: funding === "BANK" ? [{ source: "BANK" as const, amount: amount(fundingAmount) }] : [], preference };
      const route = mode === "car" && ownJourney ? { version: "composer-mobility-route@v1" as const,
        vehicleRef: vehicleId ? { vehicleId, labelAtSelection: vehicleId === vehicle?.vehicleId ? vehicle.label
          : original?.route?.vehicleRef?.labelAtSelection ?? "Véhicule indisponible", provenance: "EXPLICIT_USER_DECISION" as const } : null,
        stops: availableRef(origin) && availableRef(destination) ? [stopForPlace(origin!, physicalLabel(origin!), "DIRECT_PLACE"), ...outStops,
          stopForPlace(destination!, physicalLabel(destination!), "ROOT_PLACE"), ...(returnRequired ? [...backStops, stopForPlace(origin!, physicalLabel(origin!), "DIRECT_PLACE")] : [])] : [],
        ...(normalizedFuel ? { manualFuelPrice: normalizedFuel } : {}),
        ...(tollMode === "AUTO" ? {} : { toll: tollMode === "MANUAL" ? { kind: "MANUAL" as const, unitAmount: amount(toll) }
          : tollMode === "QUOTE" && original?.route?.toll?.kind === "QUOTE" ? original.route.toll : { kind: "UNKNOWN" as const } }) } : undefined;
      let transport: Transport | null = mode ? { ...(original?.optionKey === mode ? original : {}),
        kind: "MOBILITY_INTENT", optionKey: mode, selectionId: original?.selectionId ?? crypto.randomUUID(), provenance: "EXPLICIT_USER_DECISION",
        origin: origin ?? null, destination: destination ?? null, returnRequired, plannedTime: date ? outTime || null : null,
        returnTime: returnRequired && endDate ? returnTime || null : null,
        ...(ownJourney ? { pricing, journey: undefined, route } : { journey: original?.journey, pricing: original?.pricing, route: undefined }) } : null;
      // JSON omits removed choices. An unchanged suggestion or quote retains its exact provenance and identity.
      transport = transport ? JSON.parse(JSON.stringify(transport)) as Transport : null;
      const transportChanged = initialMode !== undefined && initialMode !== original?.optionKey || initialInputs.current !== JSON.stringify(transportInputs)
        || date !== text(context.fields.plannedDate) && !!original?.plannedTime || endDate !== text(context.fields.endDate) && !!original?.returnTime;
      if (!transportChanged && original) transport = original;
      onSave({ kind: stay ? "EDIT_SHORT_STAY" : "EDIT_FAMILY_VISIT", edit: { contextOccurrenceId: context.contextOccurrenceId, fields,
        ...(transportChanged ? { transport } : {}) } });
    } catch (failure) { setError(failure instanceof Error && failure.message === "MONTH_DECISION_AMOUNT_INVALID"
      ? "Précisez un montant positif ou nul avec deux décimales au maximum." : failure instanceof Error ? failure.message : "Vérifiez les champs."); }
  };
  return <div data-short-stay-editor={stay || undefined} data-family-visit-editor={!stay || undefined} className={styles.nightEditor}>
    <CardKnowledgePanel knowledge={knowledge} />
    <p className={styles.helper}>{stay ? "Le séjour regroupe ses postes sans coût supplémentaire. Aucun prix, participant ou date n’est décidé automatiquement. Les séjours intermois sont hors périmètre." : "Une visite est votre intention. Un trajet historique ou un véhicule disponible ne décide ni la visite ni ses participants."}</p>
    <nav className={styles.nightNav} aria-label={stay ? "Sections du séjour" : "Sections de la visite"}>{[["people", "Personnes"], ["place", "Destination"], ["timing", "Dates"], ...(stay ? [["posts", "Hébergement et postes"]] : []), ["route", "Déplacement"]].map(([key, caption]) =>
      <button key={key} type="button" onClick={() => { const section = scroll.current?.querySelector<HTMLElement>(`[data-visit-section="${key}"]`); section?.scrollIntoView({ block: "start" }); section?.focus({ preventScroll: true }); }}>{caption}</button>)}</nav>
    <div ref={scroll} className={styles.nightEditorScroll}>
      <section className={styles.nightSection} data-visit-section="people" tabIndex={-1}><h3>{stay ? "Votre séjour et ses participants" : "Qui allez-vous voir ?"}</h3>
        <label>{stay ? "Nom du séjour" : "Nom de la visite"}<input value={label} maxLength={120} onChange={event => setLabel(event.target.value)} /></label>
        {!stay && <PlannedContactField label="Proche visité" value={visited} householdPersons={householdPersons} onChange={setVisited} />}
        <h4>Personnes concernées</h4>{people.map((ref, index) => <div key={index} className={styles.nightParticipant}>
          <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons} onChange={value => setPeople(people.map((p, i) => i === index ? value ?? { kind: "TEXT", label: "" } : p))} />
          <button type="button" onClick={() => setPeople(people.filter((_, i) => i !== index))}>Retirer cette personne</button></div>)}
        <button type="button" onClick={() => setPeople([...people, { kind: "TEXT", label: "" }])}>Ajouter une personne</button>
      </section>
      <section className={styles.nightSection} data-visit-section="place" tabIndex={-1}><h3>{stay ? "Destination du séjour" : "Où aura lieu la visite ?"}</h3>
        <PlannedPlaceField label={stay ? "Destination du séjour" : "Destination de la visite"} places={places} value={destination} onChange={setDestination} exact />
        {!options && <p role="status">Les lieux admissibles sont en cours de lecture. Une destination libre reste possible.</p>}
      </section>
      <section className={styles.nightSection} data-visit-section="timing" tabIndex={-1}><h3>Quand ?</h3><p>Vous pouvez conserver cette intention sans jour fixé. Le retour reste indépendant du départ.</p>
        <div className={styles.nightComponentGrid}><label>Date de départ (facultative)<input type="date" value={date} onChange={event => { setDate(event.target.value); if (!event.target.value) setOutTime(""); }} /></label>
          <label>Heure de départ<input type="time" disabled={!date} value={outTime} onChange={event => setOutTime(event.target.value)} /></label>
          <label>Date de retour (facultative)<input type="date" value={endDate} onChange={event => { setEndDate(event.target.value); if (!event.target.value) setReturnTime(""); }} /></label>
          <label>Heure de retour<input type="time" disabled={!endDate} value={returnTime} onChange={event => setReturnTime(event.target.value)} /></label>
          <label>Repère de temps<input value={note} maxLength={160} onChange={event => setNote(event.target.value)} placeholder="Par exemple : un dimanche" /></label></div>
      </section>
      {stay && <section className={styles.nightSection} data-visit-section="posts" tabIndex={-1}>{posts}</section>}
      <section className={styles.nightSection} data-visit-section="route" tabIndex={-1}><h3>Déplacement prospectif</h3>
        {original?.journey && original.journey.relation !== "OWNS_JOURNEY" && <><p>Le trajet existant est lié à un autre propriétaire. Ses prix sont conservés.</p>
          <label className={styles.nightCheck}><input type="checkbox" checked={ownJourney} onChange={event => setOwnJourney(event.target.checked)} />Choisir un trajet propre pour cette visite</label></>}
        <label>Mode de transport<select value={mode} onChange={event => setTransportMode(event.target.value)}><option value="">Sans déplacement configuré</option>
          {Object.entries(modeLabels).map(([key, caption]) => <option key={key} value={key}>{caption}</option>)}</select></label>
        {!!mode && ownJourney && <>
          <PlannedPlaceField label="Origine du déplacement" places={places} value={origin} onChange={setOrigin} exact />
          {!origin && home && <button type="button" onClick={() => setOrigin({ kind: "KNOWN", placeId: home.placeId })}>Utiliser comme départ {home.name} · domicile connu</button>}
          <label><input type="checkbox" checked={returnRequired} onChange={event => setReturnRequired(event.target.checked)} />Prévoir l’aller et le retour</label>
          {mode === "car" ? <>
            <label>Véhicule<select value={vehicleId} onChange={event => setVehicleId(event.target.value)}><option value="">À préciser</option>
              {vehicle?.vehicleId && <option value={vehicle.vehicleId}>{vehicle.label} · véhicule admissible</option>}
              {vehicleId && vehicleId !== vehicle?.vehicleId && <option value={vehicleId}>{original?.route?.vehicleRef?.labelAtSelection ?? "Véhicule lié"} · indisponible</option>}</select></label>
            <label>Itinéraire<select value={preference} onChange={event => setPreference(event.target.value as typeof preference)}><option value="FASTEST">Le plus rapide</option><option value="AVOID_TOLLS">Éviter les péages</option></select></label>
            {([["Aller", outStops, setOutStops], ...(returnRequired ? [["Retour", backStops, setBackStops] as const] : [])] as const).map(([caption, stops, setStops]) => <div key={caption}><h4>Arrêts supplémentaires · {caption}</h4>
              {stops.map((stop, index) => <div key={index}><PlannedPlaceField label={`Arrêt ${caption} ${index + 1}`} places={places} value={stop.placeId ? { kind: "KNOWN", placeId: stop.placeId } : { kind: "TEXT", label: stop.label }} exact
                onChange={ref => setStops(stops.map((p, i) => i === index ? ref ? stopForPlace(ref, physicalLabel(ref), "DIRECT_PLACE") : { label: "", endpointSource: "DIRECT_PLACE" } : p))} />
                <PlannedRouteCoordinatesField key={JSON.stringify([stop.label, stop.coordinates])} stop={stop} onApply={(latitude, longitude) => setStops(stops.map((p, i) => i === index ? { ...p, coordinates: { latitude, longitude, source: "USER_DECLARED" } } : p))} />
                <button type="button" onClick={() => setStops(stops.filter((_, i) => i !== index))}>Retirer cet arrêt</button></div>)}
              <button type="button" disabled={outStops.length + backStops.length >= 8} onClick={() => setStops([...stops, { label: "", endpointSource: "DIRECT_PLACE" }])}>Ajouter un arrêt · {caption}</button></div>)}
            <div className={styles.nightComponentGrid}><label>Prix déclaré au litre, si aucune référence disponible<input inputMode="decimal" value={fuelPrice} onChange={event => setFuelPrice(event.target.value)} placeholder="Conserver les références du propriétaire" /></label>
              <label>Péages<select value={tollMode} onChange={event => setTollMode(event.target.value)}><option value="AUTO">Estimation du propriétaire</option><option value="UNKNOWN">Encore inconnus</option><option value="MANUAL">Montant total déclaré par moi</option>{tollMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
              {tollMode === "MANUAL" && <label>Péages totaux (€)<input inputMode="decimal" value={toll} onChange={event => setToll(event.target.value)} /></label>}
              <label>Parking<select value={parkingMode} onChange={event => setParkingMode(event.target.value as typeof parkingMode)}><option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Montant total déclaré, 0 si aucun</option>{parkingMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
              {parkingMode === "MANUAL" && <label>Parking total (€)<input inputMode="decimal" value={parking} onChange={event => setParking(event.target.value)} /></label>}</div>
          </> : mode !== "free" && <><label>Prix du trajet complet {returnRequired ? "aller-retour" : "aller"}<select value={fareMode} onChange={event => setFareMode(event.target.value as typeof fareMode)}><option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Montant total déclaré</option>{fareMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
            {fareMode === "MANUAL" && <label>Billet / course total (€)<input inputMode="decimal" value={fare} onChange={event => setFare(event.target.value)} /></label>}</>}
          {mode !== "free" && <><label>Financement des frais payables<select value={funding} onChange={event => setFunding(event.target.value)}><option value="">À préciser</option><option value="BANK">Banque déclarée</option></select></label>
            {funding === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} /></label>}</>}
        </>}
        {mode === "free" ? <p>Déplacement déclaré gratuit. Aucun coût de trajet ajouté.</p>
          : <MobilityEstimateSummary summary={summary} fresh={fresh && initialInputs.current === JSON.stringify(transportInputs) && (initialMode === undefined || initialMode === original?.optionKey)} />}
        <p className={styles.helper}>La simulation utilise Mobility et Finance V2. Carburant utilisé, péages et billet restent distincts. Une panne fournisseur conserve le brouillon et les autres composants.</p>
      </section>
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Retour au mois</button><button type="button" className={styles.primary} disabled={busy} onClick={save}>{stay ? "Prévisualiser le séjour" : "Prévisualiser la visite"}</button></footer>
  </div>;
}

export const FamilyVisitEditor = ProspectiveContextEditor;
