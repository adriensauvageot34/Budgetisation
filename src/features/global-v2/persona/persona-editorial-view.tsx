"use client";

import { useState } from "react";
import { BriefcaseBusiness, BusFront, Camera, CarFront, Code2, Headphones, Heart, House, Music2, Sparkles, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { PersonaDirectModel } from "@/query-api/global-v2/persona-direct-presentation";
import type { EditorialPeriod, EditorialProject, EditorialSubscription, PersonaEditorialModel } from "@/query-api/global-v2/persona-editorial";
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
  return `${approximate ? "≈ " : ""}${(approximate ? roundedMoney : exactMoney).format(number)}`;
}
function paymentUnit(subscription: EditorialSubscription): string {
  return /mens|month/iu.test(subscription.cadence ?? "") ? "/mois" : "/paiement";
}
function IconLabel({ icon: Icon, children }: { readonly icon: LucideIcon; readonly children: React.ReactNode }) {
  return <span className={styles.iconLabel}><Icon size={18} strokeWidth={1.65} aria-hidden="true" />{children}</span>;
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
function Route({ person }: { readonly person: "adrien" | "manon" }) {
  if (person === "adrien") return <div className={styles.route} aria-label="Maison, transports en commun, travail, Ange, travail, transports en commun, maison">
    <IconLabel icon={House}>Maison</IconLabel><span className={styles.routeLine}><BusFront aria-hidden="true" size={18} /> transport</span><IconLabel icon={BriefcaseBusiness}>Travail</IconLabel><span className={styles.routeLine}><UtensilsCrossed aria-hidden="true" size={18} /> Ange</span><IconLabel icon={BriefcaseBusiness}>Travail</IconLabel><span className={styles.routeLine}><BusFront aria-hidden="true" size={18} /> transport</span><IconLabel icon={House}>Maison</IconLabel>
  </div>;
  return <div className={styles.route} aria-label="Maison, trajet en voiture, Promotrans, puis retour en voiture à la maison">
    <IconLabel icon={House}>Maison</IconLabel><span className={styles.routeLine}><CarFront aria-hidden="true" size={19} /> en voiture</span><IconLabel icon={BriefcaseBusiness}>Promotrans</IconLabel><span className={styles.routeLine}><CarFront aria-hidden="true" size={19} /> retour en voiture</span><IconLabel icon={House}>Maison</IconLabel>
  </div>;
}
function MealStory({ name, meal, adrien }: { readonly name: string; readonly meal: PersonaEditorialModel["persons"][number]["work"]["workMeals"]; readonly adrien: boolean }) {
  const cost = meal.m2AnnualCost ?? meal.directObservedCost;
  return <article className={styles.habitStory} data-story="work-meal"><div className={styles.storyTop}><UtensilsCrossed aria-hidden="true" size={22} strokeWidth={1.5} /><span>Une adresse dans la semaine</span></div>
    <h5>{adrien ? "Déjeuner autour du travail" : "Déjeuner pendant les journées Promotrans"}</h5>
    <p><strong>{name}</strong> revient dans ses journées de travail.</p>
    <div className={styles.inlineFacts}>{meal.anchorPresence === null ? null : <BigFact value={integer.format(meal.anchorPresence.presenceDays)} caption="journées de présence" />}{meal.anchorTypicalPurchase === null ? null : <BigFact value={amount(meal.anchorTypicalPurchase)} caption="par achat identifié" /> }<BigFact value={amount(cost, true)} caption="de repas travail sur la période" /></div>
    <small>Les journées de présence ne sont pas des achats.</small>
  </article>;
}
function AdrienWork({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const { work, personalUniverses } = person;
  const permit = personalUniverses.permit;
  return <div className={styles.personColumn} data-person="adrien">
    <header className={styles.personHeading}><span>01 / Adrien</span><h4>Le quotidien professionnel d’Adrien</h4></header>
    <Route person="adrien" />
    <div className={styles.hybridStory}><p className={styles.kicker}>Son rythme</p><h5>Un travail véritablement hybride.</h5><div className={styles.hybridRows}><div><span>Sur site</span><i /><strong>{integer.format(work.onsiteDays)} jours</strong></div><div><span>À la maison</span><i /><strong>{integer.format(work.remoteDays)} jours</strong></div></div></div>
    <div className={styles.transitStory}><div><IconLabel icon={BusFront}>Transports en commun</IconLabel><p>Le trajet quotidien, sans coût direct attribué.</p></div><BigFact value={amount(work.commute.directCost)} caption="de coût direct" /></div>
    <article className={styles.permitStory} data-story="permit"><div className={styles.storyTop}><CarFront aria-hidden="true" size={22} strokeWidth={1.5} /><span>Un projet en cours</span></div><h5>Son permis prend de la place</h5><div className={styles.storyLead}><BigFact value={amount(permit.cost, true)} caption="autour du projet permis, sans attribution du paiement" />{permit.period === null ? null : <span>{periodLabel(permit.period)}</span>}</div>
      <DateThread items={[...Object.entries(permit.lessonsByMonth).map(([key, count]) => ({ key, sortDate: `${key}-01`, title: monthOnly.format(dateOf(`${key}-01`)), detail: `${integer.format(count)} ${count === 1 ? "leçon" : "leçons"}` })), ...permit.codeDates.map((date) => ({ key: `code-${date}`, sortDate: date, title: monthOnly.format(dateOf(date)), detail: "Passage du code" }))].sort((a, b) => a.sortDate.localeCompare(b.sortDate))} />
    </article>
    <MealStory name={work.workMeals.anchorPresence?.label ?? "Ange"} meal={work.workMeals} adrien />
  </div>;
}
function VehicleStory({ model, manonId }: { readonly model: PersonaEditorialModel; readonly manonId: string }) {
  const { vehicle } = model;
  const usage = vehicle.workUsageSummary;
  const insurance = vehicle.insuranceSummary;
  const personalPayer = insurance.payerAuthority === "USER_VALIDATED" && insurance.payerPersonId === manonId;
  if (vehicle.householdVehicle === null) return null;
  return <article className={styles.vehicleStory} data-story="household-vehicle"><header><span className={styles.storyTop}><CarFront aria-hidden="true" size={24} strokeWidth={1.5} /> Une voiture, plusieurs réalités</span><h5>Notre Peugeot, son outil de travail quotidien</h5><p>{vehicle.householdVehicle.label} · véhicule du foyer</p></header>
    <div className={styles.vehicleRoad}><span /><CarFront aria-hidden="true" size={36} strokeWidth={1.25} /><span /></div>
    <div className={styles.vehicleBranches}>
      <section><p className={styles.kicker}>Pour aller travailler</p>{usage === null ? <p>Trajets non établis pour cette période.</p> : <><BigFact value={`${integer.format(usage.distinctDayCount)} journées`} caption="de trajets professionnels confirmés" /><div className={styles.branchFacts}><strong>{integer.format(Number(usage.distanceKm))} km</strong><strong>{amount(usage.estimatedFuelCost, true)}</strong></div><p>de carburant utilisé, estimé · {periodLabel(usage.period)}</p>{usage.estimatedFuelCostPerDay === null ? null : <small>{amount(usage.estimatedFuelCostPerDay, true)} de carburant utilisé par journée</small>}</>}</section>
      <section><p className={styles.kicker}>L’assurance</p><h6>{personalPayer ? "Manon la prend personnellement en charge" : "Coût d’assurance du véhicule"}</h6>{insurance.currentProvider === null ? null : <p>{insurance.currentProvider} · assureur actuel</p>}{insurance.currentMonthlyCost === null ? null : <BigFact value={amount(insurance.currentMonthlyCost)} caption="par mois actuellement" />}
        <DateThread items={insurance.series.map((series, index) => ({ key: `${index}-${series.provider}`, title: series.provider, detail: `${periodLabel(series.period) ?? "Période non établie"}${series.monthlyCost === null ? "" : ` · ${amount(series.monthlyCost)}/mois`}`, current: series.lifecycle === "Active" }))} />
        {insurance.periodCost === null ? null : <small>{amount(insurance.periodCost, true)} d’assurance sur la période {periodLabel(insurance.period)}</small>}
      </section>
      <section><p className={styles.kicker}>Entretien & imprévus</p><h6>Ce que la Peugeot coûte aussi au foyer</h6><p>Réparations, pièces, entretien et contrôle technique.</p><BigFact value={amount(vehicle.maintenanceSummary.totalIdentifiedCost, true)} caption="identifiés pour le véhicule du foyer" />{vehicle.maintenanceSummary.period === null ? null : <small>{periodLabel(vehicle.maintenanceSummary.period)}</small>}</section>
    </div>
    {vehicle.nonFuelCostTotalReady && vehicle.nonFuelCostTotal !== null ? <footer><span>Assurance et entretien · hors carburant</span><strong>{amount(vehicle.nonFuelCostTotal, true)}</strong><small>Coût du véhicule du foyer, pas une dépense personnelle de Manon.</small></footer> : null}
  </article>;
}
function ManonWork({ person, model }: { readonly person: PersonaEditorialModel["persons"][1]; readonly model: PersonaEditorialModel }) {
  const { work } = person;
  return <div className={styles.personColumn} data-person="manon"><header className={styles.personHeading}><span>02 / Manon</span><h4>Le quotidien professionnel de Manon</h4></header>
    <Route person="manon" />
    <div className={styles.workAnchor}><p className={styles.kicker}>Le point d’ancrage</p><h5>Promotrans structure une grande partie de ses semaines.</h5><BigFact value={`${integer.format(work.onsiteDays)} jours`} caption="de travail sur site" />{work.primaryWorkPlaces.map((place) => <small key={place.label}>{place.label} · {integer.format(place.presenceDays)} journées de présence</small>)}</div>
    <VehicleStory model={model} manonId={person.personId} />
    <MealStory name={work.workMeals.anchorPresence?.label ?? "Marie Blachère"} meal={work.workMeals} adrien={false} />
    <article className={styles.interventions}><div className={styles.storyTop}><BriefcaseBusiness aria-hidden="true" size={22} strokeWidth={1.5} /><span>Hors du bureau</span></div><h5>Son travail la fait aussi bouger</h5><BigFact value={integer.format(work.professionalInterventions.eventCount)} caption="interventions professionnelles" /><ul>{work.professionalInterventions.contexts.slice(0, 5).map((context, index) => <li key={`${context.date}-${index}`}><span>{context.place ?? context.title}</span><small>{month(context.date)}</small></li>)}</ul></article>
  </div>;
}
function ProjectCost({ project, description }: { readonly project: EditorialProject; readonly description: string }) {
  return <div className={styles.projectCost}><BigFact value={amount(project.netCertifiedByRefundLink ? project.netCost : project.grossCost, true)} caption={description} />{project.netCertifiedByRefundLink && Number(project.linkedRefund) > 0 ? <small>{amount(project.grossCost)} avant {amount(project.linkedRefund)} d’avoir lié</small> : null}</div>;
}
function SubscriptionLine({ name, subscription }: { readonly name: string; readonly subscription: EditorialSubscription }) {
  return <div className={styles.subscriptionLine}><div><strong>{name}</strong>{subscription.firstObservedAt === null ? null : <small>{periodLabel({ first: subscription.firstObservedAt, last: subscription.lastObservedAt ?? subscription.firstObservedAt })}</small>}</div><div>{subscription.typicalPayment === null ? null : <strong>{amount(subscription.typicalPayment)}<small>{paymentUnit(subscription)}</small></strong>}<small>{amount(subscription.observedCumulativeCost)} sur la période</small></div></div>;
}
function AdrienUniverses({ person, direct }: { readonly person: PersonaEditorialModel["persons"][0]; readonly direct: PersonaDirectModel }) {
  const { photo, googleAiPro, musicHeadphones } = person.personalUniverses;
  const chatGptFact = direct.profiles.find((profile) => profile.personId === person.personId)?.recurring.flatMap((block) => block.items).find((item) => item.title === "ChatGPT")?.facts.find((fact) => fact.label === "Tarif observé par occurrence");
  return <div className={styles.personColumn} data-person="adrien"><header className={styles.personHeading}><span>01 / Adrien</span><h4>Créer, tester, apprendre</h4></header>
    <div className={styles.creativeIntro}><Camera aria-hidden="true" /><Code2 aria-hidden="true" /><Headphones aria-hidden="true" /><p>Un projet photo, des outils numériques, de la musique : trois façons de nourrir sa curiosité.</p></div>
    <article className={styles.photoStory}><div className={styles.storyTop}><Camera aria-hidden="true" size={23} strokeWidth={1.5} /><span>Photo</span></div><h5>Installer son espace de création</h5><p>Réflecteurs, fond studio, matériel de séance : un projet qui prend forme chez lui.</p><ProjectCost project={photo} description={photo.netCertifiedByRefundLink ? "nets de matériel lié au projet" : "de matériel lié au projet"} />{photo.period === null ? null : <small>{periodLabel(photo.period)}</small>}</article>
    <article className={styles.codeStory}><div className={styles.storyTop}><Code2 aria-hidden="true" size={23} strokeWidth={1.5} /><span>Code & IA</span></div><h5>Les outils qui accompagnent ses projets</h5><div className={styles.toolRows}><div><Sparkles aria-hidden="true" size={18} /><span>ChatGPT Plus</span><strong>{chatGptFact?.value ?? "Usage personnel confirmé"}</strong></div><div><Sparkles aria-hidden="true" size={18} /><span>Google AI Pro</span><strong>{googleAiPro.typicalPayment === null ? "Présent dans ses outils" : amount(googleAiPro.typicalPayment)}</strong></div></div><small>Usage personnel confirmé ne signifie pas paiement personnel.</small></article>
    <article className={styles.musicStory}><div className={styles.storyTop}><Headphones aria-hidden="true" size={23} strokeWidth={1.5} /><span>Musique</span></div><h5>Écouter, s’équiper, créer</h5><SubscriptionLine name="Qobuz" subscription={person.recurringHabits.qobuz} /><div className={styles.musicEquipment}><Headphones aria-hidden="true" size={30} strokeWidth={1.35} /><div><strong>Casque audio</strong><small>Un équipement de cet univers</small></div><strong>{amount(musicHeadphones.netCertifiedByRefundLink ? musicHeadphones.netCost : musicHeadphones.grossCost)}</strong></div></article>
  </div>;
}
function ManonUniverses({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const { netflix, max } = person.recurringHabits;
  const suno = person.personalUniverses.sunoFatherSong;
  return <div className={styles.personColumn} data-person="manon"><header className={styles.personHeading}><span>02 / Manon</span><h4>Ses moments à elle</h4></header>
    <article className={styles.seriesStory}><div className={styles.storyTop}><Sparkles aria-hidden="true" size={23} strokeWidth={1.5} /><span>Habitude</span></div><h5>Séries & divertissement</h5><p>Deux services présents à des moments différents de l’année.</p><DateThread items={[{ key: "netflix", title: "Netflix", detail: `${periodLabel(netflix.firstObservedAt && netflix.lastObservedAt ? { first: netflix.firstObservedAt, last: netflix.lastObservedAt } : null) ?? "Période non établie"}${netflix.typicalPayment === null ? "" : ` · ${amount(netflix.typicalPayment)}${paymentUnit(netflix)}`}` }, { key: "max", title: "Max", detail: `${periodLabel(max.firstObservedAt && max.lastObservedAt ? { first: max.firstObservedAt, last: max.lastObservedAt } : null) ?? "Période non établie"}${max.typicalPayment === null ? "" : ` · ${amount(max.typicalPayment)}${paymentUnit(max)}`}`, current: max.lifecycle === "Active" }]} /></article>
    <article className={styles.sunoStory}><div className={styles.storyTop}><Music2 aria-hidden="true" size={23} strokeWidth={1.5} /><span>Un moment, pas une habitude</span></div><div className={styles.sunoWave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><h5>{suno.description}</h5><p>Un projet familial ponctuel réalisé avec Suno Premium.</p><div className={styles.sunoFacts}>{suno.period === null ? null : <strong>{periodLabel(suno.period)}</strong>}{suno.recurrence.typicalPayment === null ? null : <span>{amount(suno.recurrence.typicalPayment)}{paymentUnit(suno.recurrence)}</span>}</div><ProjectCost project={suno} description="autour de ce projet" /></article>
  </div>;
}

export function PersonaEditorialView({ model, direct, headingId }: { readonly model: PersonaEditorialModel; readonly direct: PersonaDirectModel; readonly headingId: string }) {
  const [active, setActive] = useState<"adrien" | "manon">("adrien");
  return <div className={styles.root}><header className={styles.hero}><span className={styles.eyebrow}>Portraits personnels</span><h2 id={headingId}>Nos profils</h2><p>Deux quotidiens, deux façons de dépenser.</p><small>D’après vos habitudes d’{fullMonthYear.format(dateOf(model.period.first))} à {fullMonthYear.format(dateOf(model.period.certifiedThrough))}.</small><nav className={styles.heroTabs} aria-label="Choisir le portrait"><span aria-current="page">Adrien + Manon</span><a href="#nous-deux"><Heart aria-hidden="true" size={15} /> Nous deux</a></nav></header>
    <nav className={styles.mobileSwitch} aria-label="Personne affichée sur mobile"><button type="button" aria-pressed={active === "adrien"} onClick={() => setActive("adrien")}>Adrien</button><button type="button" aria-pressed={active === "manon"} onClick={() => setActive("manon")}>Manon</button></nav>
    <section className={styles.majorSection} aria-labelledby="persona-work-title"><SectionHeading id="persona-work-title" title="Nos journées de travail" lead="Deux façons très différentes de vivre leurs journées professionnelles." /><div className={styles.columns}><div data-mobile-active={active === "adrien"}><AdrienWork person={model.persons[0]} /></div><div data-mobile-active={active === "manon"}><ManonWork person={model.persons[1]} model={model} /></div></div></section>
    <section className={styles.majorSection} aria-labelledby="persona-universes-title"><SectionHeading id="persona-universes-title" title="Nos univers personnels" lead="Ce qui les passionne, les divertit ou occupe leurs projets." /><div className={styles.columns}><div data-mobile-active={active === "adrien"}><AdrienUniverses person={model.persons[0]} direct={direct} /></div><div data-mobile-active={active === "manon"}><ManonUniverses person={model.persons[1]} /></div></div></section>
  </div>;
}
