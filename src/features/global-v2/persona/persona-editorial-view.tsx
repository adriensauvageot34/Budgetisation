"use client";

import { useState } from "react";
import { BriefcaseBusiness, BusFront, Camera, CarFront, Droplets, Headphones, Heart, House, Monitor, Moon, PenLine, Scissors, Sparkles, UserRound, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { PersonaDirectModel } from "@/query-api/global-v2/persona-direct-presentation";
import type { EditorialMobility, EditorialOuting, EditorialPeriod, EditorialProject, EditorialSubscription, PersonaEditorialModel } from "@/query-api/global-v2/persona-editorial";
import styles from "./persona-editorial.module.css";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const roundedMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });
const monthOnly = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const fullMonthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function dateOf(value: string): Date { return new Date(`${value.slice(0, 10)}T00:00:00Z`); }
function month(value: string): string { return monthYear.format(dateOf(value)); }
function periodLabel(value: EditorialPeriod): string | null {
  return value === null ? null : `${month(value.first)} → ${month(value.last)}`;
}
function amount(value: string, approximate = false): string {
  const number = Number(value);
  if (number === 0) return "0 €";
  return `${approximate ? "≈ " : ""}${(approximate ? roundedMoney : exactMoney).format(number)}`;
}
function cadenceLabel(days: number): string {
  if (days >= 25) {
    const months = Math.max(1, Math.round(days / 30));
    return months === 1 ? "environ tous les mois" : `environ tous les ${integer.format(months)} mois`;
  }
  return `environ tous les ${integer.format(days)} jours`;
}
function shortVehicleLabel(label: string): string {
  return label.split(" — ")[0]!.replace(/\s+\d{4}$/u, "");
}
function shortPlaceLabel(label: string): string {
  return label.replace(/^(?:Chez le père de Manon|Famille de Manon)\s*[-–—·]?\s*/iu, "");
}
function paymentUnit(subscription: EditorialSubscription): string {
  return /mens|month/iu.test(subscription.cadence ?? "") ? "/mois" : "/paiement";
}
function monthKeys(first: string, last: string): readonly string[] {
  const start = dateOf(first);
  const end = dateOf(last);
  const keys: string[] = [];
  for (let year = start.getUTCFullYear(), month = start.getUTCMonth(); year < end.getUTCFullYear() || year === end.getUTCFullYear() && month <= end.getUTCMonth(); month++) {
    if (month === 12) { year++; month = 0; }
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);
  }
  return keys;
}
function SectionHeading({ id, title, lead }: { readonly id: string; readonly title: string; readonly lead: string }) {
  return <header className={styles.sectionHeading}><h3 id={id}>{title}</h3><p>{lead}</p></header>;
}
function BigFact({ value, caption, muted = false }: { readonly value: string; readonly caption: string; readonly muted?: boolean }) {
  return <div className={`${styles.bigFact} ${muted ? styles.mutedFact : ""}`}><strong>{value}</strong><span>{caption}</span></div>;
}
function DateThread({ items }: { readonly items: readonly { readonly key: string; readonly title: string; readonly detail?: string; readonly current?: boolean }[] }) {
  return <ol className={styles.dateThread}>{items.map((item) => <li key={item.key} data-current={item.current === true}><span className={styles.threadDot} /><div><strong>{item.title}</strong>{item.detail === undefined ? null : <small>{item.detail}</small>}</div></li>)}</ol>;
}
function RouteStop({ icon: Icon, label }: { readonly icon: LucideIcon; readonly label: string }) {
  return <span className={styles.routeStop}><span><Icon aria-hidden="true" size={24} strokeWidth={1.5} /></span><strong>{label}</strong></span>;
}
function RouteLine({ icon: Icon, label }: { readonly icon: LucideIcon; readonly label?: string }) {
  return <span className={styles.routeLine}><Icon aria-hidden="true" size={18} strokeWidth={1.6} />{label === undefined ? null : <small>{label}</small>}</span>;
}
function Route({ person }: { readonly person: "adrien" | "manon" }) {
  return <div className={styles.route} role="img" aria-label={person === "adrien" ? "Maison, transports en commun, travail, Ange, travail, transports en commun, maison" : "Maison, trajet en voiture, Promotrans, retour en voiture, maison"}>
    {person === "adrien" ? <><RouteStop icon={House} label="Maison" /><RouteLine icon={BusFront} label="transport" /><RouteStop icon={BriefcaseBusiness} label="Travail" /><RouteLine icon={UtensilsCrossed} /><RouteStop icon={UtensilsCrossed} label="Ange" /><RouteLine icon={BriefcaseBusiness} /><RouteStop icon={BriefcaseBusiness} label="Travail" /><RouteLine icon={BusFront} label="transport" /><RouteStop icon={House} label="Maison" /></>
      : <><RouteStop icon={House} label="Maison" /><RouteLine icon={CarFront} label="voiture" /><RouteStop icon={BriefcaseBusiness} label="Promotrans" /><RouteLine icon={CarFront} label="voiture" /><RouteStop icon={House} label="Maison" /></>}
  </div>;
}
function MealStory({ name, meal, adrien }: { readonly name: string; readonly meal: PersonaEditorialModel["persons"][number]["work"]["workMeals"]; readonly adrien: boolean }) {
  const cost = meal.m2AnnualCost ?? meal.directObservedCost;
  return <article className={styles.habitStory} data-story="work-meal"><div className={styles.storyTop}><UtensilsCrossed aria-hidden="true" size={22} strokeWidth={1.5} /><span>{adrien ? "Son adresse familière" : "À la pause déjeuner"}</span></div>
    <h5>{name}</h5>
    <div className={styles.mealSplit}><div>{meal.anchorPresence === null ? null : <BigFact value={integer.format(meal.anchorPresence.presenceDays)} caption={`journées où ${name} apparaît`} />}{meal.anchorTypicalPurchase === null ? null : <small>{amount(meal.anchorTypicalPurchase)} par achat à cette adresse</small>}</div><div><BigFact value={amount(cost, true)} caption="de repas au travail, toutes adresses" /></div></div>
  </article>;
}
function AdrienWorkIntro({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const { work } = person;
  return <div className={styles.workIntro} data-person="adrien">
    <header className={styles.personHeading}><span>Adrien</span><h4>Une journée entre bureau et maison</h4></header>
    <Route person="adrien" />
    <div className={styles.hybridStory}><div><span className={styles.kicker}>Son rythme</span><h5>Un travail vraiment hybride</h5></div><div className={styles.hybridRows}><div><span>Sur site</span><i /><strong>{integer.format(work.onsiteDays)} jours</strong></div><div><span>À la maison</span><i /><strong>{integer.format(work.remoteDays)} jours</strong></div></div></div>
    <div className={styles.transitStory}><span>Transports en commun</span><strong>{amount(work.commute.directCost)}</strong><small>de coût direct</small></div>
  </div>;
}
function AdrienPermit({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const permit = person.personalUniverses.permit;
  return <article className={styles.permitStory} data-story="permit"><div className={styles.storyTop}><CarFront aria-hidden="true" size={22} strokeWidth={1.5} /><span>Un projet en cours</span></div><h5>Son permis prend de la place</h5><div className={styles.storyLead}><BigFact value={amount(permit.cost, true)} caption="autour du projet permis" />{permit.period === null ? null : <span>{periodLabel(permit.period)}</span>}</div>
      <DateThread items={[...Object.entries(permit.lessonsByMonth).map(([key, count]) => ({ key, sortDate: `${key}-01`, title: monthOnly.format(dateOf(`${key}-01`)), detail: `${integer.format(count)} ${count === 1 ? "leçon" : "leçons"}` })), ...permit.codeDates.map((date) => ({ key: `code-${date}`, sortDate: date, title: monthOnly.format(dateOf(date)), detail: "Passage du code" }))].sort((a, b) => a.sortDate.localeCompare(b.sortDate))} />
    </article>;
}
function VehicleStory({ model, manonId }: { readonly model: PersonaEditorialModel; readonly manonId: string }) {
  const { vehicle } = model;
  const usage = vehicle.workUsageSummary;
  const insurance = vehicle.insuranceSummary;
  const personalPayer = insurance.payerAuthority === "USER_VALIDATED" && insurance.payerPersonId === manonId;
  if (vehicle.householdVehicle === null) return null;
  return <article className={styles.vehicleStory} data-story="household-vehicle"><header><div><span className={styles.storyTop}>Une voiture, trois réalités</span><h5>Notre Peugeot, son outil de travail quotidien</h5><p>{shortVehicleLabel(vehicle.householdVehicle.label)} · véhicule du foyer</p></div><CarFront className={styles.vehicleIllustration} aria-hidden="true" size={66} strokeWidth={1.15} /></header>
    <div className={styles.vehicleRoad} aria-hidden="true"><span /><span /><span /></div>
    <div className={styles.vehicleBranches}>
      <section><p className={styles.kicker}>Pour travailler</p>{usage === null ? null : <><BigFact value={`${integer.format(usage.distinctDayCount)} journées`} caption="de trajets domicile-travail" /><p><strong>{integer.format(Number(usage.distanceKm))} km</strong> · {amount(usage.estimatedFuelCost, true)} de carburant utilisé</p><small>{periodLabel(usage.period)}</small></>}</section>
      <section><p className={styles.kicker}>Assurance</p><h6>{personalPayer ? "Manon la prend en charge" : "Assurance du véhicule"}</h6>{insurance.currentMonthlyCost === null ? null : <BigFact value={amount(insurance.currentMonthlyCost)} caption={`par mois · ${insurance.currentProvider ?? "assureur actuel"}`} />}
        <div className={styles.insuranceRail}>{insurance.series.map((series, index) => <div key={`${index}-${series.provider}`}><strong>{series.provider}</strong><small>{periodLabel(series.period)}{series.monthlyCost === null ? null : ` · ${amount(series.monthlyCost)}/mois`}</small></div>)}</div>
      </section>
      <section><p className={styles.kicker}>Entretien</p><h6>Le foyer entretient la Peugeot</h6><BigFact value={amount(vehicle.maintenanceSummary.totalIdentifiedCost, true)} caption="pour réparations et entretien" /><small>{periodLabel(vehicle.maintenanceSummary.period)}</small></section>
    </div>
    {vehicle.nonFuelCostTotalReady && vehicle.nonFuelCostTotal !== null ? <footer>Assurance + entretien · hors carburant : <strong>{amount(vehicle.nonFuelCostTotal, true)}</strong> pour le véhicule du foyer</footer> : null}
  </article>;
}
function ManonWorkIntro({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const { work } = person;
  return <div className={styles.workIntro} data-person="manon"><header className={styles.personHeading}><span>Manon</span><h4>Promotrans au rythme de la voiture</h4></header>
    <Route person="manon" />
    <div className={styles.workAnchor}><BigFact value={`${integer.format(work.onsiteDays)} jours`} caption="de travail sur site" />{work.primaryWorkPlaces.map((place) => <span key={place.label}>{integer.format(place.presenceDays)} journées à {shortPlaceLabel(place.label)}</span>)}</div>
  </div>;
}
const interventionLabels = [
  { pattern: /p[oô]le emploi/iu, label: "Pôle emploi" },
  { pattern: /Montpellier/iu, label: "Montpellier" },
  { pattern: /Béziers/iu, label: "Béziers" },
  { pattern: /Nîmes/iu, label: "Nîmes" },
  { pattern: /salon/iu, label: "Salons professionnels" },
  { pattern: /Lyon|Saint-Priest/iu, label: "Lyon / Saint-Priest" },
] as const;
function ManonInterventions({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const interventions = person.work.professionalInterventions;
  const tags = interventionLabels.filter(({ pattern }) => interventions.contexts.some((context) => pattern.test(`${context.title} ${context.place ?? ""}`)));
  return <article className={styles.interventions}><BriefcaseBusiness aria-hidden="true" size={30} strokeWidth={1.4} /><div><h5>Son travail la fait aussi bouger</h5><strong>{integer.format(interventions.eventCount)} interventions professionnelles</strong></div>{tags.length === 0 ? null : <ul>{tags.map(({ label }) => <li key={label}>{label}</li>)}</ul>}</article>;
}
function ProjectCost({ project, description }: { readonly project: EditorialProject; readonly description: string }) {
  return <div className={styles.projectCost}><BigFact value={amount(project.netCertifiedByRefundLink ? project.netCost : project.grossCost, true)} caption={description} /></div>;
}
function SubscriptionLine({ name, subscription }: { readonly name: string; readonly subscription: EditorialSubscription }) {
  return <div className={styles.subscriptionLine}><div><strong>{name}</strong>{subscription.firstObservedAt === null ? null : <small>{periodLabel({ first: subscription.firstObservedAt, last: subscription.lastObservedAt ?? subscription.firstObservedAt })}</small>}</div><div>{subscription.typicalPayment === null ? null : <strong>{amount(subscription.typicalPayment)}<small>{paymentUnit(subscription)}</small></strong>}<small>{amount(subscription.observedCumulativeCost)} sur la période</small></div></div>;
}
function PhotoStory({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const photo = person.personalUniverses.photo;
  return <article className={styles.photoStory}><Camera className={styles.objectIcon} aria-hidden="true" size={96} strokeWidth={1.05} /><div className={styles.storyTop}>Adrien · Photo</div><h5>Installer son espace de création</h5><p>Réflecteurs, fond studio, matériel de séance.</p><ProjectCost project={photo} description="de matériel pour son projet" />{photo.period === null ? null : <small>{periodLabel(photo.period)}</small>}</article>;
}
function CodeStory({ person, direct }: { readonly person: PersonaEditorialModel["persons"][0]; readonly direct: PersonaDirectModel }) {
  const googleAiPro = person.personalUniverses.googleAiPro;
  const chatGptFact = direct.profiles.find((profile) => profile.personId === person.personId)?.recurring.flatMap((block) => block.items).find((item) => item.title === "ChatGPT")?.facts.find((fact) => fact.label === "Tarif observé par occurrence");
  return <article className={styles.codeStory}><Monitor className={styles.objectIcon} aria-hidden="true" size={68} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien · Code & IA</div><h5>Des outils pour créer et apprendre</h5><div className={styles.toolPills}><span>ChatGPT Plus <small>{chatGptFact?.value ?? "dans ses outils"}</small></span><span>Google AI Pro <small>{googleAiPro.typicalPayment === null ? "dans ses outils" : `${amount(googleAiPro.typicalPayment)}${paymentUnit(googleAiPro)}`}</small></span></div></article>;
}
function MusicStory({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const headset = person.personalUniverses.musicHeadphones;
  return <article className={styles.musicStory}><Headphones className={styles.objectIcon} aria-hidden="true" size={76} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien · Musique</div><h5>Écouter, s’équiper</h5><SubscriptionLine name="Qobuz" subscription={person.recurringHabits.qobuz} /><div className={styles.musicEquipment}><Headphones aria-hidden="true" size={30} strokeWidth={1.35} /><strong>Casque audio</strong><strong>{amount(headset.netCertifiedByRefundLink ? headset.netCost : headset.grossCost)}</strong></div></article>;
}
function SeriesStory({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const { netflix, max } = person.recurringHabits;
  const subscriptions = [{ name: "Netflix", value: netflix }, { name: "Max", value: max }];
  return <article className={styles.seriesStory}><div className={styles.storyTop}>Manon · Séries & divertissement</div><h5>Deux services, deux moments de l’année</h5><div className={styles.seriesTimeline}><div className={styles.seriesMonths} style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}</div>{subscriptions.map(({ name, value }) => <div className={styles.seriesTrack} key={name}><strong>{name}</strong><div role="img" aria-label={`${name} : ${value.firstObservedAt === null ? "période inconnue" : `${month(value.firstObservedAt)} à ${value.lifecycle === "Active" ? "la fin de la période" : value.lastObservedAt === null ? "une fin non précisée" : month(value.lastObservedAt)}`}`}>{months.map((key) => <span key={key} data-active={value.firstObservedAt !== null && key >= value.firstObservedAt.slice(0, 7) && (value.lifecycle === "Active" || value.lastObservedAt === null || key <= value.lastObservedAt.slice(0, 7))} />)}</div><small>{value.typicalPayment === null ? "" : `${amount(value.typicalPayment)}${paymentUnit(value)}`}</small></div>)}</div></article>;
}
function SunoStory({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const suno = person.personalUniverses.sunoFatherSong;
  return <article className={styles.sunoStory}><div className={styles.storyTop}>Manon · Un souvenir en musique</div><div className={styles.sunoWave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><h5>{suno.description}</h5><div className={styles.sunoFacts}>{suno.period === null ? null : <strong>{periodLabel(suno.period)}</strong>}<ProjectCost project={suno} description="autour de cette chanson" /></div></article>;
}

function PresenceRail({ months, tracks }: { readonly months: readonly string[]; readonly tracks: readonly { readonly key: string; readonly label: string; readonly monthlyPresenceDays: Readonly<Record<string, number>> }[] }) {
  const gridStyle = { gridTemplateColumns: `minmax(0, var(--rail-label-width)) repeat(${months.length}, minmax(0, 1fr))` };
  return <div className={styles.presenceRail}><div className={styles.presenceMonths} style={gridStyle}><span />{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}</div>
    {tracks.map((track) => <div className={styles.presenceTrack} style={gridStyle} key={track.key}><strong>{track.label}</strong>{months.map((key) => {
      const days = track.monthlyPresenceDays[key];
      return <span key={key} aria-label={`${track.label} : ${days ?? 0} journée${days === 1 ? "" : "s"} en ${monthOnly.format(dateOf(`${key}-01`))}`}><i data-present={typeof days === "number" && days > 0} title={typeof days === "number" && days > 0 ? `${days} journée${days === 1 ? "" : "s"}` : undefined} /></span>;
    })}</div>)}
  </div>;
}
function AdrienHabits({ person, months }: { readonly person: PersonaEditorialModel["persons"][0]; readonly months: readonly string[] }) {
  const { hairdresser, stylingWax } = person.recurringHabits;
  return <article className={styles.hairdresserStory}><Scissors className={styles.objectIcon} aria-hidden="true" size={70} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien · Soin</div><h5>Barbe & cheveux</h5>
    <div className={styles.hairPresence}><BigFact value={integer.format(hairdresser.observedPresenceDays)} caption="journées chez le coiffeur" />{hairdresser.typicalPersonalCost === null ? null : <BigFact value={amount(hairdresser.typicalPersonalCost)} caption="par passage" />}</div>
    {hairdresser.places.length === 0 ? null : <PresenceRail months={months} tracks={hairdresser.places.map((place) => ({ key: place.placeRef, label: `${shortPlaceLabel(place.label).split(/\s+[–—]\s+/u)[0]} · ${integer.format(place.presenceDays)}`, monthlyPresenceDays: place.monthlyPresenceDays }))} />}
    <div className={styles.waxStory}><div className={styles.waxJar} aria-hidden="true"><span /></div><div><strong>{stylingWax.label}</strong><small>{stylingWax.price === null ? null : amount(stylingWax.price)}{stylingWax.observedCadenceDays === null ? null : ` · ${cadenceLabel(stylingWax.observedCadenceDays)}`}</small></div></div>
  </article>;
}
const beautyNeeds: Readonly<Record<string, { readonly shortLabel: string; readonly icon: LucideIcon }>> = {
  maquillage_manon_mascara: { shortLabel: "Mascara", icon: PenLine },
  maquillage_manon_sourcils: { shortLabel: "Sourcils", icon: PenLine },
  skincare_manon_masque: { shortLabel: "Soin de la peau", icon: Droplets },
};
function ManonProducts({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const products = person.personalUniverses.products.filter((product) => beautyNeeds[product.needKey] !== undefined);
  if (products.length === 0) return null;
  const groups = Object.entries(beautyNeeds).map(([needKey, definition]) => ({ needKey, definition, products: products.filter((product) => product.needKey === needKey) })).filter((group) => group.products.length > 0);
  return <article className={styles.productsStory}><div className={styles.storyTop}>Manon · Beauté</div><h5>Ses produits fidèles</h5><div className={styles.productShelf}>{groups.map(({ needKey, definition, products: groupProducts }) => {
    const Icon = definition.icon;
    return <div className={styles.product} key={needKey}><span className={styles.productObject}><Icon aria-hidden="true" size={42} strokeWidth={1.2} /></span><div><small>{definition.shortLabel}</small>{groupProducts.map((product) => <div key={product.productKey}><strong>{product.label.replace(/Mascara Intense Black.*$/iu, "").replace(/Sephora Collection Crayon Sourcils/iu, "Crayon sourcils").replace(/\s+8[,.]5\s*g.*$/iu, "")}</strong><span>{integer.format(product.purchaseCount)} {product.purchaseCount === 1 ? "achat" : "achats"}{product.typicalPrice === null ? "" : ` · ${amount(product.typicalPrice)}`}{product.medianGapDays === null || product.purchaseCount < 3 ? "" : ` · ${cadenceLabel(product.medianGapDays)}`}</span></div>)}</div></div>;
  })}</div></article>;
}
function ManonVape({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const vape = person.recurringHabits.vape;
  return <article className={styles.vapeStory}><div><div className={styles.storyTop}>Manon · Une habitude apparue dans l’année</div><h5>Vape</h5>{vape.m2FirstActiveMonth === null ? null : <p>Apparue en {month(`${vape.m2FirstActiveMonth}-01`)}</p>}</div>
    <div className={styles.vapeTimeline}>{vape.directPurchases.map((purchase, index) => <div key={`${purchase.date}-${index}`}><span className={styles.vapeDot} /><strong>{month(purchase.date)}</strong><small>{amount(purchase.amount)}</small></div>)}</div>
    {vape.m2AnnualCost === null || vape.reconciledToM2 !== true ? null : <div className={styles.vapeTotal}><strong>{amount(vape.m2AnnualCost, true)}</strong><span>autour de la vape sur la période</span></div>}
  </article>;
}
function MobilityAside({ summary, title }: { readonly summary: EditorialMobility; readonly title: string }) {
  if (summary === null || summary.support !== "SUFFICIENT") return null;
  return <div className={styles.mobilityAside}><strong>{title}</strong><div className={styles.mobilityFigures}><BigFact value={integer.format(summary.eventCount)} caption="visites" /><BigFact value={`${integer.format(Number(summary.distanceKm))} km`} caption="parcourus" /><BigFact value={amount(summary.estimatedFuelCost, true)} caption="de carburant estimé" /></div></div>;
}
function outingTitle(value: string): string {
  return value
    .replace(/^Soirée à [^:]+:\s*/iu, "")
    .replace(/^Sortie\s*\/\s*soirée\s*[–—-]\s*/iu, "")
    .replace(/^Soirée techno\s*[–—-]\s*/iu, "")
    .replace(/^Sortie(?:\s+au)?\s+/iu, "")
    .replace(/\s*[–—-]\s*\d{1,2}\s+\p{L}+\s+\d{4}$/iu, "")
    .replace(/\s+\d{1,2}\s+\p{L}+\s+\d{4}$/iu, "")
    .replace(/^bar à jeux$/iu, "Bar à jeux");
}
function OutingsStory({ name, outings }: { readonly name: string; readonly outings: readonly EditorialOuting[] }) {
  if (outings.length === 0) return null;
  return <article className={styles.outingsStory}><div className={styles.storyTop}><Moon aria-hidden="true" size={25} strokeWidth={1.5} /><span>{name}</span></div><h5>{integer.format(outings.length)} sorties de son côté</h5><ul>{outings.map((outing) => <li key={outing.eventRef}><span>{outingTitle(outing.title) || outing.place || "Sortie"}</span><time dateTime={outing.date}>{month(outing.date)}</time></li>)}</ul></article>;
}
function ManonFamily({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const { fatherHome, maternalFamilyHome, familyMobilityWithoutPartner } = person.socialLife;
  const father = fatherHome[0];
  const mother = maternalFamilyHome[0];
  if (father === undefined && mother === undefined) return null;
  const tracks = [
    ...(father === undefined ? [] : [{ key: father.placeRef, label: `Papa · ${shortPlaceLabel(father.label)}`, monthlyPresenceDays: father.monthlyPresenceDays }]),
    ...(mother === undefined ? [] : [{ key: mother.placeRef, label: `Maman · ${shortPlaceLabel(mother.label)}`, monthlyPresenceDays: mother.monthlyPresenceDays }]),
  ];
  return <article className={styles.familyStory}><House className={styles.objectIcon} aria-hidden="true" size={78} strokeWidth={1.1} /><div className={styles.storyTop}>Manon · Ses proches</div><h5>Famille</h5><div className={styles.familyComposition}><PresenceRail months={months} tracks={tracks} />
    <div className={styles.familyPeople}>{father === undefined ? null : <div><UserRound aria-hidden="true" size={27} strokeWidth={1.5} /><span>Papa · {shortPlaceLabel(father.label)}</span><BigFact value={integer.format(father.presenceDays)} caption="journées de présence" /></div>}{mother === undefined ? null : <div><UserRound aria-hidden="true" size={27} strokeWidth={1.5} /><span>Maman · {shortPlaceLabel(mother.label)}</span><BigFact value={integer.format(mother.presenceDays)} caption="journées de présence" /></div>}</div></div>
    <MobilityAside summary={familyMobilityWithoutPartner} title="Ses visites familiales" />
  </article>;
}
function ManonFriends({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const { amandine, friendMobilityWithoutPartner } = person.socialLife;
  const friend = amandine[0];
  if (friend === undefined && friendMobilityWithoutPartner === null) return null;
  return <article className={styles.friendsStory}><div className={styles.storyTop}><UserRound aria-hidden="true" size={25} strokeWidth={1.5} /><span>Manon · Ses proches</span></div><h5>Amis</h5>{friend === undefined ? null : <p><strong>{friend.label.replace(/^Chez\s+/iu, "")}</strong> · {integer.format(friend.presenceDays)} journées de présence</p>}<MobilityAside summary={friendMobilityWithoutPartner} title="Voir ses amis de son côté" /></article>;
}

export function PersonaEditorialView({ model, direct, headingId }: { readonly model: PersonaEditorialModel; readonly direct: PersonaDirectModel; readonly headingId: string }) {
  const [active, setActive] = useState<"adrien" | "manon">("adrien");
  const months = monthKeys(model.period.first, model.period.certifiedThrough);
  return <div className={styles.root}><header className={styles.hero}><div><span className={styles.eyebrow}>Portraits personnels</span><h2 id={headingId}>Nos profils</h2><p>Deux quotidiens, deux façons de dépenser.</p><small>D’après vos habitudes d’{fullMonthYear.format(dateOf(model.period.first))} à {fullMonthYear.format(dateOf(model.period.certifiedThrough))}.</small></div><nav className={styles.heroTabs} aria-label="Choisir le portrait"><span aria-current="page">Adrien + Manon</span><a href="#nous-deux"><Heart aria-hidden="true" size={15} /> Nous deux</a></nav></header>
    <nav className={styles.mobileSwitch} aria-label="Personne affichée sur mobile"><button type="button" aria-pressed={active === "adrien"} onClick={() => setActive("adrien")}>Adrien</button><button type="button" aria-pressed={active === "manon"} onClick={() => setActive("manon")}>Manon</button></nav>
    <section className={styles.majorSection} aria-labelledby="persona-work-title"><SectionHeading id="persona-work-title" title="Nos journées de travail" lead="Deux rythmes, deux façons de traverser la semaine." /><div className={styles.editorialGrid}>
      <div className={styles.span6} data-mobile-active={active === "adrien"}><AdrienWorkIntro person={model.persons[0]} /></div><div className={styles.span6} data-mobile-active={active === "manon"}><ManonWorkIntro person={model.persons[1]} /></div>
      <div className={styles.span4} data-mobile-active={active === "adrien"}><AdrienPermit person={model.persons[0]} /></div><div className={styles.span8} data-mobile-active={active === "manon"}><VehicleStory model={model} manonId={model.persons[1].personId} /></div>
      <div className={styles.span4} data-mobile-active={active === "adrien"}><MealStory name="Ange" meal={model.persons[0].work.workMeals} adrien /></div><div className={styles.span4} data-mobile-active={active === "manon"}><MealStory name="Marie Blachère" meal={model.persons[1].work.workMeals} adrien={false} /></div><div className={styles.span4} data-mobile-active={active === "manon"}><ManonInterventions person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-universes-title"><SectionHeading id="persona-universes-title" title="Nos univers personnels" lead="Projets, sons et histoires qui accompagnent l’année." /><div className={styles.editorialGrid}>
      <div className={styles.span5} data-mobile-active={active === "adrien"}><PhotoStory person={model.persons[0]} /></div><div className={styles.span7} data-mobile-active={active === "manon"}><SeriesStory person={model.persons[1]} months={months} /></div>
      <div className={styles.span4} data-mobile-active={active === "adrien"}><CodeStory person={model.persons[0]} direct={direct} /></div><div className={styles.span4} data-mobile-active={active === "adrien"}><MusicStory person={model.persons[0]} /></div><div className={styles.span4} data-mobile-active={active === "manon"}><SunoStory person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-habits-title"><SectionHeading id="persona-habits-title" title="Nos habitudes qui reviennent" lead="Des gestes et des objets qui ponctuent la vie quotidienne." /><div className={styles.editorialGrid}>
      <div className={styles.span5} data-mobile-active={active === "adrien"}><AdrienHabits person={model.persons[0]} months={months} /></div><div className={styles.span7} data-mobile-active={active === "manon"}><ManonProducts person={model.persons[1]} /></div>
      <div className={styles.span12} data-mobile-active={active === "manon"}><ManonVape person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-social-title"><SectionHeading id="persona-social-title" title="Notre vie sociale, chacun de son côté" lead="Famille, amis et sorties au fil de l’année." /><div className={styles.editorialGrid}>
      <div className={styles.span12} data-mobile-active={active === "manon"}><ManonFamily person={model.persons[1]} months={months} /></div>
      <div className={styles.span4} data-mobile-active={active === "manon"}><ManonFriends person={model.persons[1]} /></div><div className={styles.span4} data-mobile-active={active === "adrien"}><OutingsStory name="Adrien" outings={model.persons[0].socialLife.outingsWithoutPartnerParticipation} /></div><div className={styles.span4} data-mobile-active={active === "manon"}><OutingsStory name="Manon" outings={model.persons[1].socialLife.outingsWithoutPartnerParticipation} /></div>
    </div></section>
  </div>;
}
