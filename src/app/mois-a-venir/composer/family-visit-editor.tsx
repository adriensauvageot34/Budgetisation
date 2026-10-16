"use client";
import { useRef, useState, type ReactNode } from "react";
import { WorkshopDock } from "./workshop-dock";
import type { ContextPalette } from "./context-palette";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerMobilitySummary, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ProspectivePersonRef, ProspectivePlaceRef, PlannedRouteStop } from "@/domain/phase2/planned-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { decisionAmount } from "@/domain/phase2/month-decision-contract";
import { stopForPlace } from "@/domain/phase2/planned-routes";
import { derivePlannedPlaceRoles } from "@/domain/phase2/planned-place-rules";
import { prospectivePersonLabel } from "@/domain/phase2/planned-product";
import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { ContactPlaceReference } from "./workshop-place-reference";
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

export function ProspectiveContextEditor({ stay = false, posts, context, targetMonth, householdPersons, options, summary, fresh, knowledge, initialMode, busy, dockHost, model, choose, placeDeclines = [], declinePlace = () => {}, onSave, onCancel }: {
  context: PlannedContextState; householdPersons: ComposerUiModel["householdPersons"]; options?: ComposerUiModel["mobilityOptions"];
  targetMonth: string; stay?: boolean; posts?: ReactNode;
  summary?: ComposerMobilitySummary; fresh: boolean; knowledge?: CardKnowledgeRead; initialMode?: string; busy: boolean; dockHost?: HTMLElement | null;
  placeDeclines?: readonly string[]; declinePlace?: (key: string) => void;
  model: ComposerUiModel; choose: Parameters<typeof ContextPalette>[0]["choose"];
  onSave: (operation: ComposerOperation) => boolean; onCancel: () => void;
}) {
  const prior = context.slotSelections.transport?.items;
  const original = Array.isArray(prior) && prior[0]?.kind === "MOBILITY_INTENT" ? prior[0] as Transport : undefined;
  const initialTransport = initialMode !== undefined && initialMode !== original?.optionKey ? undefined : original;
  const [label, setLabel] = useState(text(context.fields.label)), [date, setDate] = useState(text(context.fields.plannedDate));
  const [endDate, setEndDate] = useState(text(context.fields.endDate)), [note, setNote] = useState(text(context.fields.timingNote));
  const [visited, setVisited] = useState(context.fields.personVisitedRef as ProspectivePersonRef | undefined);
  const [people, setPeople] = useState((context.fields.participantRefs ?? []) as unknown as ProspectivePersonRef[]);
  const [destination, setDestination] = useState((context.fields[stay ? "destinationRef" : "placeRef"] ?? original?.destination ?? undefined) as ProspectivePlaceRef | undefined);
  const [origin, setOrigin] = useState(original?.origin ?? undefined), [mode, setMode] = useState(initialMode ?? original?.optionKey ?? "");
  const [returnRequired, setReturnRequired] = useState(original?.returnRequired ?? false);
  const [outTime, setOutTime] = useState(original?.plannedTime ?? ""), [returnTime, setReturnTime] = useState(original?.returnTime ?? "");
  const [vehicleId, setVehicleId] = useState(initialTransport?.route?.vehicleRef?.vehicleId ?? "");
  const [preference, setPreference] = useState(initialTransport?.pricing?.preference ?? "FASTEST");
  const [fareMode, setFareMode] = useState(initialTransport?.pricing?.fare.kind ?? "UNKNOWN"), [fare, setFare] = useState(initialTransport?.pricing?.fare.kind === "MANUAL" ? initialTransport.pricing.fare.unitAmount : "");
  const [parkingMode, setParkingMode] = useState(initialTransport?.pricing?.parking.kind ?? "UNKNOWN"), [parking, setParking] = useState(initialTransport?.pricing?.parking.kind === "MANUAL" ? initialTransport.pricing.parking.unitAmount : "");
  const [tollMode, setTollMode] = useState(initialTransport?.route?.toll?.kind ?? "AUTO"), [toll, setToll] = useState(initialTransport?.route?.toll?.kind === "MANUAL" ? initialTransport.route.toll.unitAmount : "");
  const [fuelPrice, setFuelPrice] = useState(initialTransport?.route?.manualFuelPrice ?? "");
  const [funding, setFunding] = useState(initialTransport?.pricing?.fundingAllocations[0]?.source ?? ""), [fundingAmount, setFundingAmount] = useState(initialTransport?.pricing?.fundingAllocations[0]?.amount ?? "");
  const [ownJourney, setOwnJourney] = useState(!initialTransport?.journey || initialTransport.journey.relation === "OWNS_JOURNEY");
  const anchor = initialTransport?.route?.stops.findIndex(stop => stop.endpointSource === "ROOT_PLACE") ?? -1;
  const [outStops, setOutStops] = useState<readonly PlannedRouteStop[]>(anchor > 0 ? initialTransport!.route!.stops.slice(1, anchor) : []);
  const [backStops, setBackStops] = useState<readonly PlannedRouteStop[]>(anchor > 0 && initialTransport?.returnRequired ? initialTransport.route!.stops.slice(anchor + 1, -1) : []);
  const [error, setError] = useState(""); const scroll = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<"summary" | "people" | "place" | "timing" | "posts" | "route">(initialMode ? "route" : "summary");
  const [peoplePage, setPeoplePage] = useState(-1);
  const [routePage, setRoutePage] = useState<"journey" | "origin" | "stops" | "cost">("journey");
  const [timingPage, setTimingPage] = useState<"out" | "back" | "note">("out");
  const [costPage, setCostPage] = useState("estimate");
  const [stopTab, setStopTab] = useState<"vehicle" | "out" | "back">("vehicle"), [stopPage, setStopPage] = useState(0);
  const transportInputs = [origin, destination, mode, returnRequired, outTime, returnTime, vehicleId, preference, fareMode, fare,
    parkingMode, parking, tollMode, toll, fuelPrice, funding, fundingAmount, ownJourney, outStops, backStops];
  const initialInputs = useRef(JSON.stringify(transportInputs));
  const places = options?.places ?? [], vehicle = options?.vehicle;
  const home = places.find(place => derivePlannedPlaceRoles(place).includes("OWN_HOME"));
  const physicalLabel = (ref: ProspectivePlaceRef) => ref.kind === "TEXT" ? ref.label : places.find(p => p.placeId === ref.placeId)?.name ?? "Lieu lié indisponible";
  const setTransportMode = (next: string) => {
    if (next !== mode) { setMode(next); setCostPage("estimate"); setFareMode("UNKNOWN"); setFare(""); setParkingMode("UNKNOWN"); setParking(""); setTollMode("AUTO"); setToll(""); setFuelPrice(""); setVehicleId(""); setOutStops([]); setBackStops([]); setFunding(""); setFundingAmount(""); setOwnJourney(true); }
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
        parking: mode !== "car" ? { kind: "UNKNOWN" as const } : parkingMode === "QUOTE" && original?.pricing?.parking.kind === "QUOTE" ? original.pricing.parking
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
      if (onSave({ kind: stay ? "EDIT_SHORT_STAY" : "EDIT_FAMILY_VISIT", edit: { contextOccurrenceId: context.contextOccurrenceId, fields,
        ...(transportChanged ? { transport } : {}) } })) { setError(""); setSection("summary"); }
    } catch (failure) { setError(failure instanceof Error && failure.message === "MONTH_DECISION_AMOUNT_INVALID"
      ? "Précisez un montant positif ou nul avec deux décimales au maximum." : failure instanceof Error ? failure.message : "Vérifiez les champs."); }
  };
  return <div data-short-stay-editor={stay || undefined} data-family-visit-editor={!stay || undefined} className={styles.nightEditor}>
    {section !== "summary" && <details><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={knowledge} /></details>}
    {section === "summary" && <p className={styles.helper}>{stay ? "Le séjour regroupe ses postes sans coût supplémentaire. Aucun prix, participant ou date n’est décidé automatiquement. Les séjours intermois sont hors périmètre." : "Une visite est votre intention. Un trajet historique ou un véhicule disponible ne décide ni la visite ni ses participants."}</p>}
    {section === "summary" && <section className={styles.nightSection} data-visit-summary>
      <h3>{label || (stay ? "Votre séjour" : "Votre visite")}</h3>
      <p>{stay ? "Choisissez l’hébergement ou un poste quand vous le souhaitez." : "La visite reste enregistrable même sans date ou trajet."}</p>
      {visited && <p>Proche : {visited.kind === "HOUSEHOLD_PERSON" ? householdPersons.find(person => person.personId === visited.personId)?.displayName ?? "Personne indisponible" : prospectivePersonLabel(visited) ?? "Contact indisponible"}</p>}
      {destination && <p>Destination : {physicalLabel(destination)}</p>}
      {(date || note) && <p>Quand : {date || note}</p>}
      {mode && <p>Déplacement : {modeLabels[mode] ?? mode}</p>}
      <div className={styles.restaurantSummaryActions}><button type="button" className={styles.primary} onClick={() => setSection(stay ? "posts" : "people")}>{stay ? "Composer le séjour" : "Préciser la visite"}</button>
        <button type="button" onClick={() => setSection("route")}>Prévoir le déplacement</button></div>
    </section>}
    <div ref={scroll} className={styles.nightEditorScroll}>
      {section === "people" && <section className={styles.nightSection} data-visit-section="people" tabIndex={-1}><h3>{stay ? "Votre séjour et ses participants" : "Qui allez-vous voir ?"}</h3>
        {peoplePage === -1 && <><label>{stay ? "Nom du séjour" : "Nom de la visite"}<input value={label} maxLength={120} onChange={event => setLabel(event.target.value)} /></label>
        {!stay && <PlannedContactField label="Proche visité" value={visited} householdPersons={householdPersons} onChange={setVisited} />}</>}
        <h4>Voyageurs (indépendants du proche visité)</h4>{people.slice(Math.max(0, peoplePage), peoplePage < 0 ? 0 : peoplePage + 1).map((ref, offset) => { const index = peoplePage + offset; return <div key={index} className={styles.nightParticipant}>
          <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons} onChange={value => setPeople(people.map((p, i) => i === index ? value ?? { kind: "TEXT", label: "" } : p))} />
          <button type="button" onClick={() => { setPeople(people.filter((_, i) => i !== index)); setPeoplePage(-1); }}>Retirer cette personne</button></div>; })}
        {people.length > 0 && <div className={styles.nightPage}><button type="button" disabled={peoplePage < 0} onClick={() => setPeoplePage(page => page - 1)}>Précédent</button><span>{peoplePage < 0 ? "Intention" : `Voyageur ${peoplePage + 1} / ${people.length}`}</span><button type="button" disabled={peoplePage + 1 >= people.length} onClick={() => setPeoplePage(page => page + 1)}>Suivant</button></div>}
        <button type="button" onClick={() => { setPeoplePage(people.length); setPeople([...people, { kind: "TEXT", label: "" }]); }}>Ajouter une personne</button>
      </section>}
      {section === "place" && <section className={styles.nightSection} data-visit-section="place" tabIndex={-1}><h3>{stay ? "Destination du séjour" : "Où aura lieu la visite ?"}</h3>
        {!stay && <ContactPlaceReference declined={placeDeclines} decline={declinePlace} contact={visited} places={places} value={destination} onChoose={setDestination} />}
        <PlannedPlaceField label={stay ? "Destination du séjour" : "Destination de la visite"} places={places} value={destination} onChange={setDestination} exact />
        {!options && <p role="status">Les lieux admissibles sont en cours de lecture. Une destination libre reste possible.</p>}
      </section>}
      {section === "timing" && <section className={styles.nightSection} data-visit-section="timing" tabIndex={-1}><h3>Quand ?</h3>
        <nav className={styles.nightNav} aria-label="Préciser le calendrier">{([["out", "Départ"], ["back", "Retour"], ["note", "Repère souple"]] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={timingPage === key} onClick={() => setTimingPage(key)}>{label}</button>)}</nav>
        <p>Le jour et l’heure peuvent rester inconnus.</p>
        {timingPage === "out" && <><label>Date de départ (facultative)<input type="date" value={date} onChange={event => { setDate(event.target.value); if (!event.target.value) setOutTime(""); }} /></label>
          <label>Heure de départ<input type="time" disabled={!date} value={outTime} onChange={event => setOutTime(event.target.value)} /></label></>}
        {timingPage === "back" && <><label>Date de retour (facultative)<input type="date" value={endDate} onChange={event => { setEndDate(event.target.value); if (!event.target.value) setReturnTime(""); }} /></label>
          <label>Heure de retour<input type="time" disabled={!endDate} value={returnTime} onChange={event => setReturnTime(event.target.value)} /></label></>}
        {timingPage === "note" && <label>Repère de temps<input value={note} maxLength={160} onChange={event => setNote(event.target.value)} placeholder="Par exemple : un dimanche" /></label>}
      </section>}
      {stay && section === "posts" && <section className={styles.nightSection} data-visit-section="posts" tabIndex={-1}>{posts}</section>}
      {section === "route" && <section className={styles.nightSection} data-visit-section="route" tabIndex={-1}><h3>Déplacement prospectif</h3>
        <nav className={styles.nightNav} aria-label="Étapes du déplacement">{([...["journey", "origin", "stops", "cost"]] as (typeof routePage)[]).map(key =>
          <button key={key} type="button" aria-pressed={routePage === key} onClick={() => setRoutePage(key)}>{key === "journey" ? "Trajet" : key === "origin" ? "Départ" : key === "stops" ? "Véhicule / arrêts" : "Coûts"}</button>)}</nav>
        {routePage === "journey" && <>
        {original?.journey && original.journey.relation !== "OWNS_JOURNEY" && <><p>Le trajet existant est lié à un autre propriétaire. Ses prix sont conservés.</p>
          <label className={styles.nightCheck}><input type="checkbox" checked={ownJourney} onChange={event => setOwnJourney(event.target.checked)} />Choisir un trajet propre pour cette visite</label></>}
        <label>Mode de transport<select value={mode} onChange={event => setTransportMode(event.target.value)}><option value="">Sans déplacement configuré</option>
          {Object.entries(modeLabels).map(([key, caption]) => <option key={key} value={key}>{caption}</option>)}</select></label>
        {!!mode && ownJourney && <>
          <PlannedPlaceField label="Origine du déplacement" places={places} value={origin} onChange={setOrigin} exact />
          {!origin && home && <button type="button" onClick={() => setOrigin({ kind: "KNOWN", placeId: home.placeId })}>Utiliser comme départ {home.name} · domicile connu</button>}
          <label><input type="checkbox" checked={returnRequired} onChange={event => setReturnRequired(event.target.checked)} />Prévoir l’aller et le retour</label>
        </>}
        <button type="button" onClick={() => setRoutePage("origin")}>Préciser le départ</button></>}
        {routePage === "origin" && <><PlannedPlaceField label="Origine du déplacement" places={places} value={origin} onChange={setOrigin} exact />
          {!origin && home && <button type="button" onClick={() => setOrigin({ kind: "KNOWN", placeId: home.placeId })}>Utiliser comme départ {home.name} · domicile connu</button>}
          <button type="button" onClick={() => setRoutePage(mode === "car" ? "stops" : "cost")}>Continuer</button></>}
        {routePage === "stops" && (mode === "car" && ownJourney ? <>
            <nav className={styles.nightNav} aria-label="Configurer les étapes">{([["vehicle", "Véhicule"], ["out", "Arrêts aller"], ...(returnRequired ? [["back", "Arrêts retour"]] : [])] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={stopTab === key} onClick={() => { setStopTab(key as typeof stopTab); setStopPage(0); }}>{label}</button>)}</nav>
            {stopTab === "vehicle" && <>
            <label>Véhicule<select value={vehicleId} onChange={event => setVehicleId(event.target.value)}><option value="">À préciser</option>
              {vehicle?.vehicleId && <option value={vehicle.vehicleId}>{vehicle.label} · véhicule admissible</option>}
              {vehicleId && vehicleId !== vehicle?.vehicleId && <option value={vehicleId}>{original?.route?.vehicleRef?.labelAtSelection ?? "Véhicule lié"} · indisponible</option>}</select></label>
            <label>Itinéraire<select value={preference} onChange={event => setPreference(event.target.value as typeof preference)}><option value="FASTEST">Le plus rapide</option><option value="AVOID_TOLLS">Éviter les péages</option></select></label>
            </>}
            {(stopTab === "out" ? [["Aller", outStops, setOutStops] as const] : stopTab === "back" && returnRequired ? [["Retour", backStops, setBackStops] as const] : []).map(([caption, stops, setStops]) => <div key={caption}><h4>Arrêts supplémentaires · {caption}</h4>
              {stops.slice(stopPage, stopPage + 1).map((stop, offset) => { const index = stopPage + offset; return <div key={index}><PlannedPlaceField label={`Arrêt ${caption} ${index + 1}`} places={places} value={stop.placeId ? { kind: "KNOWN", placeId: stop.placeId } : { kind: "TEXT", label: stop.label }} exact
                onChange={ref => setStops(stops.map((p, i) => i === index ? ref ? stopForPlace(ref, physicalLabel(ref), "DIRECT_PLACE") : { label: "", endpointSource: "DIRECT_PLACE" } : p))} />
                <PlannedRouteCoordinatesField key={JSON.stringify([stop.label, stop.coordinates])} stop={stop} onApply={(latitude, longitude) => setStops(stops.map((p, i) => i === index ? { ...p, coordinates: { latitude, longitude, source: "USER_DECLARED" } } : p))} />
                <button type="button" onClick={() => { setStops(stops.filter((_, i) => i !== index)); setStopPage(page => Math.max(0, page - 1)); }}>Retirer cet arrêt</button></div>; })}
              {stops.length > 1 && <div className={styles.nightPage}><button type="button" disabled={!stopPage} onClick={() => setStopPage(page => page - 1)}>Précédent</button><span>{stopPage + 1} / {stops.length}</span><button type="button" disabled={stopPage + 1 >= stops.length} onClick={() => setStopPage(page => page + 1)}>Suivant</button></div>}
              <button type="button" disabled={outStops.length + backStops.length >= 8} onClick={() => { setStopPage(stops.length); setStops([...stops, { label: "", endpointSource: "DIRECT_PLACE" }]); }}>Ajouter un arrêt · {caption}</button></div>)}
            <button type="button" onClick={() => setRoutePage("cost")}>Continuer vers les coûts</button>
          </> : <p>Choisissez d’abord un trajet en voiture pour préciser les arrêts.</p>)}
        {routePage === "cost" && <>
          <nav className={styles.nightNav} aria-label="Frais du trajet">{[...(mode === "car" ? [["fuel", "Carburant"], ["toll", "Péages"], ["parking", "Parking"]] : [["fare", "Billet / course"]]), ["funding", "Financement"], ["estimate", "Estimation"]].map(([key,label]) => <button key={key} type="button" aria-pressed={costPage === key} onClick={() => setCostPage(key)}>{label}</button>)}</nav>
          {!!mode && ownJourney && <>
            {mode === "car" && costPage === "fuel" && <label>Prix déclaré au litre, si aucune référence disponible<input inputMode="decimal" value={fuelPrice} onChange={event => setFuelPrice(event.target.value)} placeholder="Conserver les références du propriétaire" /></label>}
            {mode === "car" && costPage === "toll" && <><label>Péages<select value={tollMode} onChange={event => setTollMode(event.target.value)}><option value="AUTO">Estimation du propriétaire</option><option value="UNKNOWN">Encore inconnus</option><option value="MANUAL">Montant total déclaré par moi</option>{tollMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
              {tollMode === "MANUAL" && <label>Péages totaux (€)<input inputMode="decimal" value={toll} onChange={event => setToll(event.target.value)} /></label>}</>}
            {mode === "car" && costPage === "parking" && <><label>Parking<select value={parkingMode} onChange={event => setParkingMode(event.target.value as typeof parkingMode)}><option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Montant total déclaré, 0 si aucun</option>{parkingMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
              {parkingMode === "MANUAL" && <label>Parking total (€)<input inputMode="decimal" value={parking} onChange={event => setParking(event.target.value)} /></label>}</>}
            {mode !== "car" && mode !== "free" && costPage === "fare" && <><label>Prix du trajet complet {returnRequired ? "aller-retour" : "aller"}<select value={fareMode} onChange={event => setFareMode(event.target.value as typeof fareMode)}><option value="UNKNOWN">Encore inconnu</option><option value="MANUAL">Montant total déclaré</option>{fareMode === "QUOTE" && <option value="QUOTE">Conserver le devis</option>}</select></label>
              {fareMode === "MANUAL" && <label>Billet / course total (€)<input inputMode="decimal" value={fare} onChange={event => setFare(event.target.value)} /></label>}</>}
            {mode !== "free" && costPage === "funding" && <><label>Financement des frais payables<select value={funding} onChange={event => setFunding(event.target.value)}><option value="">À préciser</option><option value="BANK">Banque déclarée</option></select></label>
              {funding === "BANK" && <label>Montant Banque (€)<input inputMode="decimal" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} /></label>}</>}
          </>}
          {costPage === "estimate" && (mode === "free" ? <p>Déplacement déclaré gratuit. Aucun coût de trajet ajouté.</p> : <MobilityEstimateSummary summary={summary} fresh={fresh && initialInputs.current === JSON.stringify(transportInputs) && (initialMode === undefined || initialMode === original?.optionKey)} />)}
          {costPage === "estimate" && <p className={styles.helper}>Mobility et Finance V2 restent propriétaires du coût. Une panne fournisseur conserve le brouillon.</p>}
        </>}
      </section>}
    </div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={section === "summary" ? onCancel : () => setSection("summary")}>{section === "summary" ? "Retour au mois" : "Retour au résumé"}</button><button type="button" className={styles.primary} disabled={busy} onClick={save}>Conserver et prévisualiser</button></footer>
    <WorkshopDock host={dockHost} contextId={context.contextOccurrenceId} model={model} busy={busy} choose={choose} summary={() => setSection("summary")}
      choices={([["summary", "Résumé"], ["people", "Personnes"], ["place", "Destination"], ["timing", "Dates"], ...(stay ? [["posts", "Hébergement et postes"]] : []), ["route", "Déplacement"]] as const).map(([key, label]) =>
        ({ key, label, iconKey: key === "route" ? "car" : "activity", selected: section === key, choose: () => setSection(key as typeof section) }))} />
  </div>;
}

export const FamilyVisitEditor = ProspectiveContextEditor;
