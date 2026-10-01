"use client";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowLeft, Bike, Bus, Car, Coffee, Footprints, Heart, MapPin, TrainFront, Users, Utensils, Wallet } from "lucide-react";
import { commitBuilderCost, deriveBuilderReadiness, discardSuspended, editBuilderDraft, materializeBuilderDraft, setBuilderRootBaseline, undoBuilderChange, type BuilderState } from "@/domain/phase2/planned-builder";
import { changeRestaurantContext, replaceRestaurantBill, startRestaurantCar, useRestaurantEstimate } from "@/domain/phase2/planned-restaurant-builder";
import { RESTAURANT_OCCASIONS, montpellierRestaurantSuggestions, restaurantNeedsAddress, restaurantPriceRange, type RestaurantWizardStep } from "@/domain/phase2/planned-restaurant";
import { draftSummary, localCostGross } from "@/domain/phase2/planned-ux";
import { isRootCost, plannedParticipantCount, prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import type { PlannedExpenseContext, PlannedRestaurantContext, PlannedVehicleEstimate, PlannedWalletOption, ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedCarResult } from "@/domain/phase2/planned-car";
import { builderMoney } from "./planned-builder-primitives";
import { PlannedRouteEditor } from "./planned-route-editor";
import { RestaurantBillEditor } from "./restaurant-bill-editor";
import { WizardBackdrop, WizardChoice, type WizardScene } from "./planned-wizard-visuals";
import styles from "./planned-wizard.module.css";

type Props = { builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>;
  persons: readonly { personId: string; displayName: string; isCurrentUser?: boolean }[];
  places: readonly PlannedPlaceOption[]; wallets: readonly PlannedWalletOption[]; vehicle: PlannedVehicleEstimate | null;
  targetMonth: string; busy: boolean; onPreview: () => void; repairRequest: { target: string; serial: number } };
const questions: Record<RestaurantWizardStep, string> = {
  partySize: "Avec qui ?", soloPerson: "Pour qui est cette sortie ?", datePrecision: "Avez-vous une date précise ?", dateCalendar: "Choisissez votre date",
  participants: "Qui vient ?", occasion: "Est-ce une occasion spéciale ?", occasionChoice: "Quelle occasion ?", occasionCustom: "Quelle est l’occasion ?",
  locationScope: "Où ?", restaurantAsked: "Voulez-vous renseigner le restaurant ?", restaurantChoice: "Quel restaurant à Montpellier ?",
  restaurantManual: "Votre restaurant", transportCostKind: "Le trajet est-il gratuit ou payant ?", transportMode: "Comment y allez-vous ?",
  sharedDriver: "Qui prend en charge le trajet ?", sharesCosts: "Partagez-vous les frais ?", transportAddress: "À quelle adresse ?",
  transportDetails: "Votre trajet", priceKnowledge: "Connaissez-vous le prix ?", priceTotal: "Quel est le montant de la note ?",
  priceDetailed: "Composez votre note", priceEstimated: "Une première estimation", baseline: "Cette sortie s’ajoute à vos habitudes ?", review: "Votre sortie prend forme",
};
const transportAssets = { TRAIN: "transport:train", BUS: "transport:bus", TAXI: "transport:uber", OTHER: "transport:other", CARPOOL: "transport:carpool" } as const;
const transportLabels: Record<string, string> = { CAR: "Voiture", TRAIN: "Train", TAXI: "Uber / taxi", BUS: "Bus", OTHER: "Autre payant", CARPOOL: "Participation au trajet", FREE: "Trajet gratuit" };
const freeLabels: Record<string, string> = { TRAM: "Tram", WALK: "À pied", BIKE: "Vélo", OTHER: "Autre gratuit" };
function MiniCalendar({ month, value, onPick }: { month: string; value: string | null; onPick: (date: string) => void }) {
  const first = new Date(month + "-01T12:00:00Z"), offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return <div className={styles.calendar}><p className="mb-4 text-center text-sm font-bold capitalize">{label}</p><div className={styles.days}>
    {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <span key={day} className="mb-1 text-center text-xs text-slate-400">{day}</span>)}
    {Array.from({ length: offset }, (_, index) => <span key={"empty-" + index} />)}
    {Array.from({ length: count }, (_, index) => { const date = month + "-" + String(index + 1).padStart(2, "0");
      return <button type="button" key={date} aria-label={new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00Z"))}
        aria-pressed={value === date} className={styles.day} onClick={() => onPick(date)}>{index + 1}</button>;
    })}</div></div>;
}
export function RestaurantWizard({ builder, setBuilder, persons, places, wallets, vehicle, targetMonth, busy, onPreview, repairRequest }: Props) {
  const [navigation, setNavigation] = useState<{ step: RestaurantWizardStep; history: RestaurantWizardStep[] }>(() => ({
    step: builder.draft.context.restaurant?.priceBasis && builder.draft.costItems.some(isRootCost) ? "review" : "partySize", history: [],
  }));
  const { step, history } = navigation, draft = builder.draft, context = draft.context, restaurant = context.restaurant ?? {};
  const [paid, setPaid] = useState(context.transportMode ? context.transportMode !== "FREE" : false);
  const [time, setTime] = useState(restaurant.plannedTime ?? "");
  const [timeBucket, setTimeBucket] = useState(restaurant.timeBucket);
  const [customOccasion, setCustomOccasion] = useState(context.occasionLabel ?? "");
  const [city, setCity] = useState(restaurant.locationScope === "ELSEWHERE" ? restaurant.city ?? "" : "");
  const [restaurantName, setRestaurantName] = useState(restaurant.restaurantName ?? ""), [cuisine, setCuisine] = useState(restaurant.cuisine ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const rootItems = draft.costItems.filter(isRootCost);
  const [totalAmount, setTotalAmount] = useState(builder.quickTotal || (rootItems.length ? draftSummary(rootItems).gross : ""));
  const [transportAmount, setTransportAmount] = useState(draft.costItems.find((item) => item.assetKey?.startsWith("transport:") && item.priceSource !== "CALCULATED")?.unitAmount ?? "");
  const [extraName, setExtraName] = useState("");
  const [linePending, setLinePending] = useState(false);
  const [billReplacement, setBillReplacement] = useState(false);
  const [estimate, setEstimate] = useState<PlannedCarResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const readiness = deriveBuilderReadiness(builder, { places });
  const summary = draftSummary(materializeBuilderDraft(builder).costItems), range = restaurantPriceRange(context);
  const count = plannedParticipantCount(context);
  const go = (next: RestaurantWizardStep) => setNavigation((current) => ({ step: next, history: [...current.history, current.step] }));
  const jump = (next: RestaurantWizardStep) => { setLinePending(false); setNavigation((current) => ({ step: next, history: [...current.history, current.step] })); };
  const back = () => { setLinePending(false); setNavigation((current) => ({ step: current.history.at(-1) ?? "partySize", history: current.history.slice(0, -1) })); };
  const change = (patch: Partial<PlannedExpenseContext>, info?: Partial<PlannedRestaurantContext>) => setBuilder((state) => changeRestaurantContext(state, patch, info));
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    if (!repairRequest.serial) return;
    const target = repairRequest.target.replace("restaurant-", "");
    const next = target in questions ? target as RestaurantWizardStep : /route|addons/.test(target) ? "transportDetails" : /context|title/.test(target) ? "partySize" : "priceDetailed";
    setNavigation((current) => ({ step: next, history: [...current.history, current.step] }));
  }, [repairRequest]);
  const afterDate = context.companionMode === "GROUP" ? "participants" : "occasion";
  const chooseParty = (mode: "SOLO" | "COUPLE" | "GROUP") => {
    const currentPerson = persons.find((person) => person.isCurrentUser)?.personId
      ?? (context.participantPersonIds?.length === 1 ? context.participantPersonIds[0] : persons.length === 1 ? persons[0]?.personId : undefined);
    change({ companionMode: mode, participantPersonIds: mode === "SOLO" ? currentPerson ? [currentPerson] : [] : persons.map((person) => person.personId),
      participantRefs: [], additionalGuestCount: 0, ...(context.transportMode === "CARPOOL" && mode !== "GROUP" ? { transportMode: undefined } : {}) }, { sharedRide: undefined });
    go(mode === "SOLO" && !currentPerson ? "soloPerson" : "datePrecision");
  };
  const chooseDate = (date: string | null) => {
    setBuilder((state) => editBuilderDraft(state, { ...state.draft, plannedDate: date, context: { ...state.draft.context,
      restaurant: { ...state.draft.context.restaurant, plannedTime: date ? time || null : null, timeBucket: date && !time ? timeBucket : undefined } } }));
    go(afterDate);
  };
  const applyManualRestaurant = () => {
    const selectedCity = restaurant.locationScope === "MONTPELLIER" ? "Montpellier" : city.trim();
    change({ place: { kind: "TEXT", label: (restaurantName.trim() + ", " + selectedCity).slice(0, 120), provenance: "USER_DECLARED_PROSPECTIVE" } },
      { city: selectedCity, restaurantName: restaurantName.trim(), cuisine: cuisine.trim() || undefined, address: undefined });
    go("transportCostKind");
  };
  const carHandoff = () => {
    if (restaurantNeedsAddress(context, places)) { go("transportAddress"); return; }
    setBuilder((state) => state.draft.context.route?.mode === "CAR" ? state : startRestaurantCar(state, places));
    go("transportDetails");
  };
  const chooseMode = (key: string) => {
    if (!paid) { change({ transportMode: "FREE" }, { freeTransportMode: key as PlannedRestaurantContext["freeTransportMode"], sharedRide: undefined }); go("priceKnowledge"); return; }
    change({ transportMode: key as PlannedExpenseContext["transportMode"] }, { freeTransportMode: undefined, sharedRide: undefined });
    if (key === "CAR") {
      if (context.companionMode === "GROUP") go("sharedDriver");
      else carHandoff();
    } else go("transportDetails");
  };
  const commitManualTransport = () => {
    const assetKey = transportAssets[context.transportMode as keyof typeof transportAssets];
    if (!assetKey || !localCostGross("1", transportAmount)) return;
    setBuilder((state) => commitBuilderCost(state, { id: state.draft.costItems.find((item) => item.assetKey === assetKey)?.id ?? crypto.randomUUID(), assetKey,
      label: transportLabels[context.transportMode!], quantity: "1", unitAmount: transportAmount, baselineKey: null, modulePath: ["restaurant"], priceSource: "MANUAL" }));
    go("priceKnowledge");
  };
  const choosePrice = (basis: "KNOWN" | "DETAILED" | "ESTIMATED") => {
    if (basis === "DETAILED") {
      const aggregate = builder.costMode === "QUICK_TOTAL" && !!builder.quickTotal || restaurant.priceBasis === "KNOWN" || restaurant.priceBasis === "ESTIMATED" || rootItems.some((item) => item.assetKey?.endsWith("_total"));
      setBillReplacement(aggregate);
      if (!aggregate) change({}, { priceBasis: "DETAILED" });
    }
    go(basis === "KNOWN" ? "priceTotal" : basis === "DETAILED" ? "priceDetailed" : "priceEstimated");
  };
  const togglePerson = (personId: string) => {
    const ids = context.participantPersonIds ?? [];
    change({ participantPersonIds: ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId] });
  };
  const toggleContact = (contactKey: string) => {
    const ref: ProspectivePersonRef = { kind: "CONTACT", contactKey }, refs = context.participantRefs ?? [];
    change({ participantRefs: refs.some((part) => prospectivePersonIdentity(part) === prospectivePersonIdentity(ref)) ? refs.filter((part) => prospectivePersonIdentity(part) !== prospectivePersonIdentity(ref)) : [...refs, ref] });
  };
  const choices = (items: readonly { key: string; label: string; scene: WizardScene; icon?: ReactNode }[], onClick: (key: string) => void, selected?: string) => <div className={styles.choices}>{items.map((item) =>
    <WizardChoice key={item.key} label={item.label} scene={item.scene} icon={item.icon} selected={item.key === selected} onClick={() => onClick(item.key)} />)}</div>;
  const yesNo = (onYes: () => void, onNo: () => void, scene: WizardScene = "restaurant") => choices([{ key: "YES", label: "Oui", scene }, { key: "NO", label: "Non", scene: "room" }], (key) => key === "YES" ? onYes() : onNo());
  let content: ReactNode = null, next: (() => void) | undefined, nextDisabled = false, nextLabel = "Suivant";
  if (step === "partySize") content = choices([{ key: "SOLO", label: "Seul", scene: "solo", icon: <Utensils size={20} /> }, { key: "COUPLE", label: "À deux", scene: "couple", icon: <Heart size={20} /> }, { key: "GROUP", label: "À plusieurs", scene: "group", icon: <Users size={20} /> }], (key) => chooseParty(key as "SOLO" | "COUPLE" | "GROUP"), context.companionMode);
  if (step === "soloPerson") content = choices(persons.map((person) => ({ key: person.personId, label: person.displayName, scene: "solo" })), (personId) => { change({ participantPersonIds: [personId] }); go("datePrecision"); });
  if (step === "datePrecision") content = yesNo(() => go("dateCalendar"), () => chooseDate(null), "date");
  if (step === "dateCalendar") content = <div className="grid grid-cols-[1fr_260px] gap-8"><MiniCalendar month={targetMonth} value={draft.plannedDate} onPick={chooseDate} />
    <div className="pt-8"><label className={styles.field}>Heure de départ · facultative<input className={styles.input} type="time" value={time} onChange={(e) => { setTime(e.target.value); setTimeBucket(undefined); }} /></label><p className="mt-4 mb-2 text-xs font-semibold">Ou un créneau</p><div className="flex flex-wrap gap-2">{([['MORNING', 'Matin'], ['LUNCH', 'Midi'], ['EVENING', 'Soir']] as const).map(([key, label]) => <button type="button" key={key} className={styles.wallet} aria-pressed={timeBucket === key} onClick={() => { setTime(""); setTimeBucket(timeBucket === key ? undefined : key); }}>{label}</button>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Précisez l’heure ou le créneau avant de choisir le jour. Un créneau ne fixe pas une heure de routage.</p></div></div>;
  if (step === "participants") {
    content = <div className="grid gap-5"><div className="flex flex-wrap gap-2">{persons.map((person) => <button type="button" key={person.personId} aria-pressed={context.participantPersonIds?.includes(person.personId)} className={styles.wallet} onClick={() => togglePerson(person.personId)}>{person.displayName}</button>)}</div>
      <div className="grid grid-cols-4 gap-2">{SOCIAL_CONTACTS_V1.map((contact) => <WizardChoice compact key={contact.key} label={contact.label} scene="group" selected={context.participantRefs?.some((ref) => ref.kind === "CONTACT" && ref.contactKey === contact.key)} onClick={() => toggleContact(contact.key)} />)}</div>
      <div className="grid max-w-xl grid-cols-2 gap-5"><label className={styles.field}>Autre personne nommée<div className="flex gap-2"><input className={styles.input} value={extraName} maxLength={120} onChange={(e) => setExtraName(e.target.value)} placeholder="Son prénom" /><button type="button" className={styles.wallet} disabled={!extraName.trim()} onClick={() => { change({ participantRefs: [...context.participantRefs ?? [], { kind: "TEXT", label: extraName.trim() }] }); setExtraName(""); }}>Ajouter</button></div></label>
        <label className={styles.field}>Autres personnes non nommées<input type="number" min="0" max="99" step="1" className={styles.input} value={context.additionalGuestCount ?? 0} onChange={(e) => change({ additionalGuestCount: Math.max(0, Math.min(99, Math.floor(Number(e.target.value)))) })} /></label></div>
      {(context.participantRefs ?? []).filter((ref) => ref.kind === "TEXT").map((ref) => <button type="button" className="w-fit text-xs underline" key={prospectivePersonIdentity(ref)} onClick={() => change({ participantRefs: context.participantRefs?.filter((part) => part !== ref) })}>{ref.kind === "TEXT" ? ref.label : ""} · retirer</button>)}
      <p className="text-sm text-slate-500">{count} personnes prévues</p></div>;
    next = () => go("occasion"); nextDisabled = count < 3 || !context.participantPersonIds?.length || !!extraName.trim();
  }
  if (step === "occasion") content = yesNo(() => go("occasionChoice"), () => { change({ socialOccasion: "NONE", occasionLabel: undefined }); go("locationScope"); }, "occasion");
  if (step === "occasionChoice") content = choices(RESTAURANT_OCCASIONS.map((item) => ({ ...item, scene: item.key === "PARTY" ? "partyOccasion" : item.scene as WizardScene })), (key) => {
    if (key === "OTHER") { go("occasionCustom"); return; }
    const chosen = RESTAURANT_OCCASIONS.find((item) => item.key === key)!;
    change({ socialOccasion: chosen.occasion, occasionLabel: chosen.label }); go("locationScope");
  });
  if (step === "occasionCustom") { content = <label className={styles.field + " max-w-xl"}>L’occasion, en quelques mots<input autoFocus className={styles.input} value={customOccasion} maxLength={120} onChange={(e) => setCustomOccasion(e.target.value)} /></label>; nextDisabled = !customOccasion.trim(); next = () => { change({ socialOccasion: "OTHER_SPECIAL", occasionLabel: customOccasion.trim() }); go("locationScope"); }; }
  if (step === "locationScope") content = choices([{ key: "MONTPELLIER", label: "Montpellier", scene: "montpellier", icon: <MapPin size={20} /> }, { key: "ELSEWHERE", label: "Ailleurs", scene: "elsewhere", icon: <MapPin size={20} /> }], (key) => {
    if (key === "MONTPELLIER") { change({ place: { kind: "TEXT", label: "Montpellier", provenance: "USER_DECLARED_PROSPECTIVE" } }, { locationScope: "MONTPELLIER", city: "Montpellier", restaurantName: undefined, cuisine: undefined, address: undefined }); go("restaurantAsked"); }
    else { change({}, { locationScope: "ELSEWHERE", city: city.trim() || undefined }); go("restaurantManual"); }
  }, restaurant.locationScope);
  if (step === "restaurantAsked") content = yesNo(() => go("restaurantChoice"), () => { change({}, { restaurantName: undefined, cuisine: undefined }); go("transportCostKind"); }, "restaurantExterior");
  if (step === "restaurantChoice") content = <><div className={styles.choices}>{montpellierRestaurantSuggestions(places).map((place) => <WizardChoice key={place.placeId} label={place.name} scene="restaurantExterior" selected={context.place?.kind === "KNOWN" && context.place.placeId === place.placeId} onClick={() => {
    change({ place: { kind: "KNOWN", placeId: place.placeId } }, { restaurantName: place.name, city: "Montpellier", address: undefined }); go("transportCostKind");
  }} />)}<WizardChoice label="Autre restaurant" scene="note" onClick={() => go("restaurantManual")} /></div>{!montpellierRestaurantSuggestions(places).length && <p className="mt-3 text-xs text-slate-500">Aucun restaurant local connu. Vous pouvez renseigner le vôtre.</p>}</>;
  if (step === "restaurantManual") {
    content = <div className="grid max-w-3xl grid-cols-2 gap-5">{restaurant.locationScope === "ELSEWHERE" && <label className={styles.field}>Ville<input autoFocus className={styles.input} value={city} maxLength={100} onChange={(e) => setCity(e.target.value)} /></label>}
      <label className={styles.field}>Nom du restaurant<input autoFocus={restaurant.locationScope === "MONTPELLIER"} className={styles.input} value={restaurantName} maxLength={100} onChange={(e) => setRestaurantName(e.target.value)} /></label>
      <label className={styles.field}>Type de restaurant{restaurant.locationScope === "MONTPELLIER" ? " · facultatif" : ""}<input className={styles.input} value={cuisine} maxLength={60} onChange={(e) => setCuisine(e.target.value)} placeholder="Italien, chinois, grill…" /></label></div>;
    nextDisabled = !restaurantName.trim() || restaurant.locationScope === "ELSEWHERE" && (!city.trim() || !cuisine.trim()); next = applyManualRestaurant;
  }
  if (step === "transportCostKind") content = choices([{ key: "FREE", label: "Gratuit", scene: "tram", icon: <TrainFront size={20} /> }, { key: "PAID", label: "Payant", scene: "car", icon: <Wallet size={20} /> }], (key) => { setPaid(key === "PAID"); go("transportMode"); });
  if (step === "transportMode") content = paid ? choices([{ key: "CAR", label: "Voiture", scene: "car", icon: <Car size={20} /> }, { key: "TRAIN", label: "Train", scene: "train", icon: <TrainFront size={20} /> }, { key: "TAXI", label: "Uber / taxi", scene: "taxi", icon: <Car size={20} /> }, { key: "BUS", label: "Bus", scene: "bus", icon: <Bus size={20} /> }, { key: "OTHER", label: "Autre payant", scene: "transport" }], chooseMode, context.transportMode)
    : choices([{ key: "TRAM", label: "Tram", scene: "tram", icon: <TrainFront size={20} /> }, { key: "WALK", label: "À pied", scene: "walk", icon: <Footprints size={20} /> }, { key: "BIKE", label: "Vélo", scene: "bike", icon: <Bike size={20} /> }, { key: "OTHER", label: "Autre gratuit", scene: "transport" }], chooseMode, restaurant.freeTransportMode);
  if (step === "sharedDriver") content = choices([{ key: "US", label: "Nous", scene: "car" }, { key: "OTHER", label: "Quelqu’un d’autre", scene: "sharing" }], (key) => key === "US" ? carHandoff() : go("sharesCosts"));
  if (step === "sharesCosts") content = yesNo(() => { change({ transportMode: "CARPOOL" }, { sharedRide: "CONTRIBUTION" }); go("transportDetails"); },
    () => { change({ transportMode: "FREE" }, { sharedRide: "NO_CONTRIBUTION", freeTransportMode: "OTHER" }); go("priceKnowledge"); }, "sharing");
  if (step === "transportAddress") {
    content = <div className="max-w-2xl"><label className={styles.field}>Adresse du restaurant<input autoFocus className={styles.input} maxLength={110} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Numéro et rue" /></label><p className="mt-3 text-sm text-slate-500">{restaurant.restaurantName ?? "Restaurant"} · {restaurant.city}</p></div>;
    nextDisabled = !address.trim(); next = () => {
      setBuilder((state) => { const updated = changeRestaurantContext(state, { place: { kind: "TEXT", label: (address.trim() + ", " + restaurant.city).slice(0, 120), provenance: "USER_DECLARED_PROSPECTIVE" } }, { address: address.trim() }); return startRestaurantCar(updated, places); });
      go("transportDetails");
    };
  }
  if (step === "transportDetails") {
    if (context.transportMode === "CAR") {
      content = <PlannedRouteEditor guided builder={builder} setBuilder={setBuilder} places={places} vehicle={vehicle} targetMonth={targetMonth} persons={persons} estimate={estimate} setEstimate={setEstimate} />;
      const routeIssues = readiness.issues.filter((issue) => issue.scope.startsWith("context.route") || ["RESTAURANT_ADDRESS_REQUIRED", "RESTAURANT_ROUTE_REQUIRED"].includes(issue.code));
      nextDisabled = !!routeIssues.length; next = () => go("priceKnowledge");
    } else {
      content = <label className={styles.field + " max-w-sm"}>{context.transportMode === "CARPOOL" ? "Notre contribution (€)" : "Coût du trajet pour le foyer (€)"}<input autoFocus className={styles.input} type="number" min="0.01" step="0.01" value={transportAmount} onChange={(e) => setTransportAmount(e.target.value)} /></label>;
      nextDisabled = !localCostGross("1", transportAmount); next = commitManualTransport;
    }
  }
  if (step === "priceKnowledge") content = choices([{ key: "KNOWN", label: "Oui, je connais le prix", scene: "bill", icon: <Wallet size={20} /> }, { key: "DETAILED", label: "Je veux détailler la note", scene: "menu", icon: <Utensils size={20} /> }, { key: "ESTIMATED", label: "Non, pas encore", scene: "note", icon: <Coffee size={20} /> }], (key) => choosePrice(key as "KNOWN" | "DETAILED" | "ESTIMATED"), restaurant.priceBasis);
  if (step === "priceTotal") {
    content = <div className="max-w-sm"><label className={styles.field}>Montant global (€)<input autoFocus className={styles.input + " text-2xl"} type="number" min="0.01" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} /></label></div>;
    nextDisabled = !localCostGross("1", totalAmount); next = () => {
      setBuilder((state) => replaceRestaurantBill(state, [{ id: state.draft.costItems.find(isRootCost)?.id ?? crypto.randomUUID(), assetKey: null, label: "Note restaurant", quantity: "1", unitAmount: totalAmount, baselineKey: state.quickBaseline ?? null, modulePath: ["restaurant"], priceSource: "MANUAL" }], "KNOWN")); go("baseline");
    };
  }
  if (step === "priceDetailed") {
    content = billReplacement ? <div className={styles.summaryCard}><p className="text-lg font-bold">Passer du total aux éléments de la note</p><p className="mt-3 text-sm text-slate-500">Le total précédent sera remplacé par les éléments que vous validez. Vous pourrez annuler ce changement.</p>
      <div className="mt-5 flex gap-3"><button type="button" className={styles.next} onClick={() => { setBuilder((state) => replaceRestaurantBill(state, [], "DETAILED")); setBillReplacement(false); }}>Commencer le détail</button><button type="button" className={styles.wallet} onClick={() => go("priceTotal")}>Garder le total</button></div></div>
      : <RestaurantBillEditor builder={builder} setBuilder={setBuilder} wallets={wallets} onPending={setLinePending} />;
    nextDisabled = billReplacement || !rootItems.length || linePending; next = () => go("baseline");
  }
  if (step === "priceEstimated") {
    content = <div className={styles.summary}><div className={styles.summaryCard}><p className="text-sm text-slate-500">15 à 40 € par personne · {range.participants} personne{range.participants > 1 ? "s" : ""}</p>
      <p className={styles.total}>{builderMoney(range.minimum)} – {builderMoney(range.maximum)}</p><p className="text-sm text-slate-600">Pour la projection, l’hypothèse centrale sera {builderMoney(range.central)}. Ce n’est pas une note connue.</p></div>
      <div className="relative overflow-hidden rounded-2xl"><WizardBackdrop scene="restaurant" /></div></div>;
    nextLabel = "Utiliser cette estimation"; nextDisabled = !range.participants; next = () => { setBuilder((state) => useRestaurantEstimate(state, () => crypto.randomUUID())); go("baseline"); };
  }
  if (step === "baseline") content = choices([{ key: "EXTRA", label: "Oui, en plus", scene: "celebration" }, { key: "USUAL", label: "Non, elle est déjà prévue", scene: "restaurant" }], (key) => { setBuilder((state) => setBuilderRootBaseline(state, key === "USUAL" ? "household-restaurants" : null)); go("review"); }, builder.quickBaseline === undefined ? undefined : builder.quickBaseline === null ? "EXTRA" : "USUAL");
  if (step === "review") {
    content = <div className={styles.summary}><section className={styles.summaryCard}><div className={styles.summaryRow}><span>{context.companionMode === "SOLO" ? "Seul" : context.companionMode === "COUPLE" ? "À deux" : count + " personnes"}</span><button type="button" onClick={() => jump("partySize")}>Modifier</button></div>
      <div className={styles.summaryRow}><span>{draft.plannedDate ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(draft.plannedDate + "T12:00Z")) + (restaurant.plannedTime ? " · " + restaurant.plannedTime : restaurant.timeBucket ? " · " + ({ MORNING: "Matin", LUNCH: "Midi", EVENING: "Soir" }[restaurant.timeBucket]) : "") : "Ce mois-ci, sans date précise"}</span><button type="button" onClick={() => jump("datePrecision")}>Modifier</button></div>
      <div className={styles.summaryRow}><span>{restaurant.restaurantName ? restaurant.restaurantName + " · " : ""}{restaurant.city}</span><button type="button" onClick={() => jump("locationScope")}>Modifier</button></div>
      <div className={styles.summaryRow}><span>{context.transportMode === "FREE" ? restaurant.sharedRide ? "Trajet offert, sans contribution" : freeLabels[restaurant.freeTransportMode!] : transportLabels[context.transportMode!]}</span><button type="button" onClick={() => jump("transportCostKind")}>Modifier</button></div>
      <div className={styles.summaryRow}><span>{context.occasionLabel ?? "Sans occasion particulière"}</span><button type="button" onClick={() => jump("occasion")}>Modifier</button></div></section>
      <section className={styles.summaryCard}><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Coût prévu de la sortie</p><p className={styles.total}>{builderMoney(summary.gross)}</p>
        {restaurant.priceBasis === "ESTIMATED" && <p className="mb-3 text-xs text-slate-500">Note estimée : {builderMoney(range.minimum)} à {builderMoney(range.maximum)} · hypothèse centrale retenue.</p>}
        <p className="text-sm text-slate-600">Banque {builderMoney(summary.bank)}{summary.swile !== "0.00" ? " · Swile " + builderMoney(summary.swile) : ""}{summary.edenred !== "0.00" ? " · Edenred " + builderMoney(summary.edenred) : ""}</p>
        {summary.fuel !== "0.00" && <p className="mt-2 text-xs text-slate-500">Essence utilisée : {builderMoney(summary.fuel)}, sans paiement de plein prévu.</p>}
        <div className="mt-5 flex gap-4"><button type="button" className="text-sm underline" onClick={() => jump("priceKnowledge")}>Modifier la note</button><button type="button" className="text-sm underline" onClick={() => jump("baseline")}>Habitudes</button></div></section></div>;
    nextLabel = "Voir l’effet sur notre mois"; nextDisabled = !readiness.previewReady || busy; next = onPreview;
  }
  const blockers = step === "review" ? readiness.issues.filter((issue) => issue.severity === "BLOCK_PREVIEW") : [];
  return <div className={styles.stage}><WizardBackdrop scene={step.startsWith("price") || step === "review" ? "restaurant" : step.startsWith("transport") || step === "sharedDriver" ? "road" : "room"} className={styles.ambient} />
    <div className={styles.stageContent}><div key={step} className={styles.motion + " flex min-h-0 flex-1 flex-col"} id={"restaurant-" + step}>
      <p className={styles.eyebrow}>{step.startsWith("price") || step === "baseline" ? "La note" : step.startsWith("transport") || step === "sharedDriver" || step === "sharesCosts" ? "Le trajet" : step === "review" ? "Votre projet" : "La sortie"}</p>
      <h4 ref={heading} tabIndex={-1} className={styles.question}>{questions[step]}</h4><div className={styles.stepBody}>{content}
        {blockers.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{blockers.map((issue) => <button type="button" key={issue.code + issue.scope} className="text-left text-xs text-amber-900 underline" onClick={() => jump(issue.repairTarget.startsWith("restaurant-") ? issue.repairTarget.slice(11) as RestaurantWizardStep : issue.code === "BASELINE_ANSWER_REQUIRED" ? "baseline" : issue.scope.startsWith("context.route") ? "transportDetails" : "priceDetailed")}>{issue.message}</button>)}</div>}
      </div></div></div>
    {builder.suspended.length > 0 && <div className="relative flex shrink-0 items-center justify-between gap-3 bg-amber-50 px-8 py-3 text-xs text-amber-900"><p>Des précisions précédentes sont conservées pour annuler ce changement.</p><div className="flex gap-4"><button type="button" className="font-bold underline" onClick={() => setBuilder(undoBuilderChange)}>Annuler</button><button type="button" className="font-bold underline" onClick={() => setBuilder(discardSuspended)}>Valider ce changement</button></div></div>}
    <footer className={styles.footer}><div className="flex items-center gap-6">{history.length > 0 ? <button type="button" className={styles.back} onClick={back}><ArrowLeft size={15} />Retour</button> : <span className="text-xs text-slate-400">Une sortie, à votre rythme</span>}
      {builder.undo && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setBuilder(undoBuilderChange)}>Annuler la dernière modification</button>}</div>
      <div className="flex items-center gap-5"><span className="text-xs text-slate-500">{step === "priceDetailed" && !billReplacement ? rootItems.length + " éléments · " + builderMoney(draftSummary(rootItems).gross) : restaurant.city ?? ""}</span>
        {next && <button type="button" className={styles.next} disabled={nextDisabled || busy} onClick={next}>{busy && step === "review" ? "Calcul en cours…" : nextLabel}</button>}</div></footer>
  </div>;
}
