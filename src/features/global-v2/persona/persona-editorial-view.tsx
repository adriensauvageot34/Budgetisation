"use client";

import { useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, Camera, CarFront, Headphones, Heart, House, Monitor, Moon, Scissors, UserRound, UtensilsCrossed } from "lucide-react";
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
function MealStory({ name, meal, adrien }: { readonly name: string; readonly meal: PersonaEditorialModel["persons"][number]["work"]["workMeals"]; readonly adrien: boolean }) {
  const habit = meal.merchantHabitSummary;
  return <article className={styles.habitStory} data-story="work-meal" data-person={adrien ? "adrien" : "manon"}><div className={styles.storyTop}><UtensilsCrossed aria-hidden="true" size={22} strokeWidth={1.5} /><span>{adrien ? "Adrien" : "Manon"}</span></div>
    <h5>{name}</h5>
    {habit === undefined || habit.purchaseCount === 0 ? <p>Ses achats à cette adresse ne sont pas encore détaillés.</p> : <><p>Son repère autour du travail · {integer.format(habit.purchaseCount)} achats identifiés sur la période</p><div className={styles.mealFacts}>
      {habit.monthlyPurchaseRate === null ? null : <BigFact value={`≈ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(habit.monthlyPurchaseRate)}/mois`} caption="achats en moyenne" />}
      {habit.typicalPurchase === null ? null : <BigFact value={amount(habit.typicalPurchase, true)} caption="par achat" />}
      {habit.monthlyObservedCost === null ? null : <BigFact value={amount(habit.monthlyObservedCost, true)} caption="d’achats par mois en moyenne" />}
      {habit.annualObservedCost === null ? null : <BigFact value={amount(habit.annualObservedCost, true)} caption="d’achats identifiés sur 12 mois" />}
    </div></>}
  </article>;
}
function WorkEconomicNote({ person, label, value, detail }: { readonly person: "adrien" | "manon"; readonly label: string; readonly value: string; readonly detail: string }) {
  return <div className={styles.workEconomicNote} data-person={person}><span className={styles.storyTop}>{person}</span><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function AdrienPermit({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const permit = person.personalUniverses.permit;
  const months = Object.entries(permit.monthlyCost ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const maximum = Math.max(0, ...months.map(([, cost]) => Number(cost)));
  const notableMonths = [...months].sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 3).sort(([a], [b]) => a.localeCompare(b));
  return <article className={styles.permitStory} data-story="permit" data-person="adrien"><div className={styles.storyTop}><CarFront aria-hidden="true" size={22} strokeWidth={1.5} /><span>Adrien</span></div><h5>Le permis, un projet qui avance</h5><div className={styles.storyLead}><BigFact value={amount(permit.cost, true)} caption="investis autour du projet" />{permit.period === null ? null : <span>{periodLabel(permit.period)}</span>}</div>
      {months.length === 0 ? null : <div className={styles.permitBars} role="img" aria-label={`Dépenses du permis par mois : ${months.map(([key, cost]) => `${month(`${key}-01`)} ${amount(cost)}`).join(", ")}`}>
        {months.map(([key, cost], index) => <div key={key}><span className={styles.permitBarTrack}><i style={{ height: `${maximum === 0 ? 0 : Math.max(7, Number(cost) / maximum * 100)}%` }} /></span><strong>{index % 3 === 0 ? monthOnly.format(dateOf(`${key}-01`)).slice(0, 3) : ""}</strong></div>)}
      </div>}
      {notableMonths.length === 0 ? null : <p className={styles.permitPeaks}>{notableMonths.map(([key, cost]) => `${monthOnly.format(dateOf(`${key}-01`)).slice(0, 4)} ${amount(cost, true)}`).join(" · ")}</p>}
    </article>;
}
function VehicleStory({ model, manonId }: { readonly model: PersonaEditorialModel; readonly manonId: string }) {
  const { vehicle } = model;
  const usage = vehicle.workUsageSummary;
  const insurance = vehicle.insuranceSummary;
  const personalPayer = insurance.payerAuthority === "USER_VALIDATED" && insurance.payerPersonId === manonId;
  if (vehicle.householdVehicle === null) return null;
  return <article className={styles.vehicleStory} data-story="household-vehicle"><header><div><span className={styles.storyTop}>Foyer · une voiture, trois réalités</span><h5>Notre Peugeot, son outil de travail quotidien</h5><p>{shortVehicleLabel(vehicle.householdVehicle.label)} · véhicule du foyer</p></div><CarFront className={styles.vehicleIllustration} aria-hidden="true" size={66} strokeWidth={1.15} /></header>
    <div className={styles.vehicleRoad} aria-hidden="true"><span /><span /><span /></div>
    <div className={styles.vehicleBranches}>
      <section data-person="manon"><p className={styles.kicker}>Manon · pour travailler</p>{usage === null ? null : <><BigFact value={`${integer.format(usage.distinctDayCount)} journées`} caption="de trajets domicile-travail" /><p><strong>{integer.format(Number(usage.distanceKm))} km</strong> · {amount(usage.estimatedFuelCost, true)} de carburant utilisé</p><small>{periodLabel(usage.period)}</small></>}</section>
      <section data-person={personalPayer ? "manon" : "foyer"}><p className={styles.kicker}>Assurance {personalPayer ? "· Manon" : "· foyer"}</p>{insurance.currentMonthlyCost === null ? null : <BigFact value={amount(insurance.currentMonthlyCost)} caption={`par mois · ${insurance.currentProvider ?? "assureur actuel"}`} />}
        <div className={styles.insuranceRail}>{insurance.series.map((series, index) => <div key={`${index}-${series.provider}`}><strong>{series.provider}</strong><small>{periodLabel(series.period)}{series.monthlyCost === null ? null : ` · ${amount(series.monthlyCost)}/mois`}</small></div>)}</div>
      </section>
      <section><p className={styles.kicker}>Entretien · foyer</p><BigFact value={amount(vehicle.maintenanceSummary.totalIdentifiedCost, true)} caption="pour réparations et entretien" /><small>{periodLabel(vehicle.maintenanceSummary.period)}</small></section>
    </div>
    {vehicle.nonFuelCostTotalReady && vehicle.nonFuelCostTotal !== null ? <footer>Hors carburant · assurance + entretien <strong>{amount(vehicle.nonFuelCostTotal, true)}</strong></footer> : null}
  </article>;
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
  return <aside className={styles.interventions} data-person="manon"><BriefcaseBusiness aria-hidden="true" size={26} strokeWidth={1.4} /><div><span className={styles.storyTop}>Manon</span><strong>Son travail la fait aussi bouger · {integer.format(interventions.eventCount)} interventions hors site</strong></div>{tags.length === 0 ? null : <ul>{tags.map(({ label }) => <li key={label}>{label}</li>)}</ul>}</aside>;
}
function ProjectCost({ project, description }: { readonly project: EditorialProject; readonly description: string }) {
  return <div className={styles.projectCost}><BigFact value={amount(project.netCertifiedByRefundLink ? project.netCost : project.grossCost, true)} caption={description} /></div>;
}
function SubscriptionLine({ name, subscription }: { readonly name: string; readonly subscription: EditorialSubscription }) {
  return <div className={styles.subscriptionLine}><div><strong>{name}</strong>{subscription.firstObservedAt === null ? null : <small>{periodLabel({ first: subscription.firstObservedAt, last: subscription.lastObservedAt ?? subscription.firstObservedAt })}</small>}</div><div>{subscription.typicalPayment === null ? null : <strong>{amount(subscription.typicalPayment)}<small>{paymentUnit(subscription)}</small></strong>}<small>{amount(subscription.observedCumulativeCost)} sur la période</small></div></div>;
}
function PhotoStory({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const photo = person.personalUniverses.photo;
  return <article className={styles.photoStory} data-person="adrien"><Camera className={styles.objectIcon} aria-hidden="true" size={96} strokeWidth={1.05} /><div className={styles.storyTop}>Adrien</div><h5>Installer son espace de création</h5><ul className={styles.photoObjects}><li>Réflecteurs</li><li>Fond studio</li><li>Séance photo</li></ul><ProjectCost project={photo} description="de matériel pour son projet" />{photo.period === null ? null : <small>{periodLabel(photo.period)}</small>}</article>;
}
function CodeStory({ person, direct }: { readonly person: PersonaEditorialModel["persons"][0]; readonly direct: PersonaDirectModel }) {
  const googleAiPro = person.personalUniverses.googleAiPro;
  const chatGptFact = direct.profiles.find((profile) => profile.personId === person.personId)?.recurring.flatMap((block) => block.items).find((item) => item.title === "ChatGPT")?.facts.find((fact) => fact.label === "Tarif observé par occurrence");
  return <article className={styles.codeStory} data-person="adrien"><Monitor className={styles.objectIcon} aria-hidden="true" size={68} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien</div><h5>Des outils pour créer et apprendre</h5><div className={styles.toolPills}><span>ChatGPT Plus <small>{chatGptFact?.value ?? "dans ses outils"}</small></span><span>Google AI Pro <small>{googleAiPro.typicalPayment === null ? "dans ses outils" : `${amount(googleAiPro.typicalPayment)}${paymentUnit(googleAiPro)}`}</small></span></div></article>;
}
function MusicStory({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const headset = person.personalUniverses.musicHeadphones;
  return <article className={styles.musicStory} data-person="adrien"><Headphones className={styles.objectIcon} aria-hidden="true" size={76} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien</div><h5>Écouter, s’équiper</h5><SubscriptionLine name="Qobuz" subscription={person.recurringHabits.qobuz} /><div className={styles.musicEquipment}><Headphones aria-hidden="true" size={30} strokeWidth={1.35} /><strong>Casque audio</strong><strong>{amount(headset.netCertifiedByRefundLink ? headset.netCost : headset.grossCost)}</strong></div></article>;
}
function SeriesStory({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const { netflix, max } = person.recurringHabits;
  const subscriptions = [{ name: "Netflix", value: netflix }, { name: "Max", value: max }];
  return <article className={styles.seriesStory} data-person="manon"><div className={styles.storyTop}>Manon</div><h5>Séries & divertissement</h5><div className={styles.seriesTimeline}><div className={styles.seriesMonths} style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}</div>{subscriptions.map(({ name, value }) => <div className={styles.seriesTrack} key={name}><strong>{name}</strong><div role="img" aria-label={`${name} : ${value.firstObservedAt === null ? "période inconnue" : `${month(value.firstObservedAt)} à ${value.lifecycle === "Active" ? "la fin de la période" : value.lastObservedAt === null ? "une fin non précisée" : month(value.lastObservedAt)}`}`}>{months.map((key) => <span key={key} data-active={value.firstObservedAt !== null && key >= value.firstObservedAt.slice(0, 7) && (value.lifecycle === "Active" || value.lastObservedAt === null || key <= value.lastObservedAt.slice(0, 7))} />)}</div><small>{value.typicalPayment === null ? "" : `${amount(value.typicalPayment)}${paymentUnit(value)}`}</small></div>)}</div></article>;
}
function SunoStory({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const suno = person.personalUniverses.sunoFatherSong;
  return <article className={styles.sunoStory} data-person="manon"><div className={styles.storyTop}>Manon</div><div className={styles.sunoWave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><h5>{suno.description}</h5><div className={styles.sunoFacts}>{suno.period === null ? null : <strong>{periodLabel(suno.period)}</strong>}<ProjectCost project={suno} description="autour de cette chanson" /></div></article>;
}

function PresenceRail({ months, tracks }: { readonly months: readonly string[]; readonly tracks: readonly { readonly key: string; readonly label: string; readonly monthlyPresenceDays: Readonly<Record<string, number>>; readonly monthlyPresenceSegments?: Readonly<Record<string, readonly boolean[]>> }[] }) {
  const gridStyle = { gridTemplateColumns: `minmax(0, var(--rail-label-width)) repeat(${months.length}, minmax(0, 1fr))` };
  return <div className={styles.presenceRail}><div className={styles.presenceMonths} style={gridStyle}><span />{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}</div>
    {tracks.map((track) => <div className={styles.presenceTrack} style={gridStyle} key={track.key}><strong>{track.label}</strong>{months.map((key) => {
      const days = track.monthlyPresenceDays[key];
      const segments = track.monthlyPresenceSegments === undefined ? undefined : (track.monthlyPresenceSegments[key] ?? [false, false, false, false]);
      return <span className={styles.presenceCells} key={key} aria-label={`${track.label} : ${days ?? 0} journée${days === 1 ? "" : "s"} en ${monthOnly.format(dateOf(`${key}-01`))}`}>
        {(segments ?? [typeof days === "number" && days > 0]).map((present, index) => <i key={index} data-present={present} title={segments === undefined ? undefined : `${1 + index * 7}–${index === 3 ? "fin" : 7 + index * 7} : ${present ? "présence" : "aucune présence"}`} />)}
      </span>;
    })}</div>)}
  </div>;
}
function AdrienHabits({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const { hairdresser, stylingWax } = person.recurringHabits;
  return <article className={styles.hairdresserStory} data-person="adrien"><Scissors className={styles.objectIcon} aria-hidden="true" size={70} strokeWidth={1.1} /><div className={styles.storyTop}>Adrien</div><h5>Barbe & cheveux</h5>
    {hairdresser.priceBasis === "INDICATIVE_PRICE_NOT_PAYMENT" && hairdresser.monthlyVisitEstimate !== null && hairdresser.monthlyVisitEstimate !== undefined ? <div className={styles.hairRhythm}>
      <BigFact value={`≈ ${integer.format(Number(hairdresser.monthlyVisitEstimate))}`} caption="fois par mois, habituellement" />
      {hairdresser.typicalVisitPrice === null || hairdresser.typicalVisitPrice === undefined ? null : <BigFact value={amount(hairdresser.typicalVisitPrice, true)} caption="prix indicatif par passage" />}
      {hairdresser.illustrativeAnnualCost === null || hairdresser.illustrativeAnnualCost === undefined ? null : <BigFact value={amount(hairdresser.illustrativeAnnualCost, true)} caption="sur un an à ce rythme" />}
    </div> : null}
    <p className={styles.hairPlaces}>{hairdresser.places.map((place) => shortPlaceLabel(place.label).split(/\s+[–—]\s+/u)[0]).join(" · ")}</p>
    <div className={styles.waxStory}><div className={styles.waxJar} aria-hidden="true"><span /></div><div><strong>{stylingWax.label}</strong><small>Rachat régulier{stylingWax.price === null ? "" : ` · ${amount(stylingWax.price)}`}</small></div></div>
  </article>;
}
const beautyNeeds: Readonly<Record<string, { readonly shortLabel: string; readonly object: string }>> = {
  maquillage_manon_mascara: { shortLabel: "Mascara", object: "mascara" },
  maquillage_manon_sourcils: { shortLabel: "Sourcils", object: "pencil" },
  skincare_manon_masque: { shortLabel: "Soin de la peau", object: "mask" },
};
function ManonProducts({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const products = person.personalUniverses.products.filter((product) => beautyNeeds[product.needKey] !== undefined);
  if (products.length === 0) return null;
  const groups = Object.entries(beautyNeeds).map(([needKey, definition]) => ({ needKey, definition, products: products.filter((product) => product.needKey === needKey) })).filter((group) => group.products.length > 0);
  return <article className={styles.productsStory} data-person="manon"><div className={styles.storyTop}>Manon</div><h5>Ses produits fidèles</h5><div className={styles.productShelf}>{groups.map(({ needKey, definition, products: groupProducts }) => {
    return <div className={styles.product} key={needKey}><span className={styles.productObject} data-object={definition.object} aria-hidden="true"><i /></span><div><small>{definition.shortLabel}</small>{groupProducts.map((product) => <div key={product.productKey}><strong>{product.label.replace(/Mascara Intense Black.*$/iu, "").replace(/Sephora Collection Crayon Sourcils/iu, "Crayon sourcils").replace(/\s+8[,.]5\s*g.*$/iu, "")}</strong><span>{integer.format(product.purchaseCount)} {product.purchaseCount === 1 ? "achat" : "achats"}{product.typicalPrice === null ? "" : ` · ${amount(product.typicalPrice)}`}{product.medianGapDays === null || product.purchaseCount < 3 ? "" : ` · ${cadenceLabel(product.medianGapDays)}`}</span></div>)}</div></div>;
  })}</div></article>;
}
function ManonVape({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const vape = person.recurringHabits.vape;
  return <article className={styles.vapeStory} data-person="manon"><div><div className={styles.storyTop}>Manon</div><h5>Vape</h5></div>
    {vape.m2FirstActiveMonth === null ? null : <strong>Depuis {month(`${vape.m2FirstActiveMonth}-01`)}</strong>}
    <p>Équipement, fioles et composants : une habitude dont le détail des achats reste à préciser.</p>
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
  return <article className={styles.outingsStory} data-person={name === "Adrien" ? "adrien" : "manon"}><div className={styles.storyTop}><Moon aria-hidden="true" size={25} strokeWidth={1.5} /><span>{name}</span></div><h5>{integer.format(outings.length)} sorties de son côté</h5><ul>{outings.map((outing) => <li key={outing.eventRef}><span>{outingTitle(outing.title) || outing.place || "Sortie"}</span><time dateTime={outing.date}>{month(outing.date)}</time></li>)}</ul></article>;
}
function ManonFamily({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const { fatherHome, maternalFamilyHome, familyMobilityWithoutPartner } = person.socialLife;
  const father = fatherHome[0];
  const mother = maternalFamilyHome[0];
  if (father === undefined && mother === undefined) return null;
  const tracks = [
    ...(father === undefined ? [] : [{ key: father.placeRef, label: `Papa · ${shortPlaceLabel(father.label)}`, monthlyPresenceDays: father.monthlyPresenceDays, monthlyPresenceSegments: father.monthlyPresenceSegments }]),
    ...(mother === undefined ? [] : [{ key: mother.placeRef, label: `Maman · ${shortPlaceLabel(mother.label)}`, monthlyPresenceDays: mother.monthlyPresenceDays, monthlyPresenceSegments: mother.monthlyPresenceSegments }]),
  ];
  return <article className={styles.familyStory} data-person="manon"><House className={styles.objectIcon} aria-hidden="true" size={78} strokeWidth={1.1} /><div className={styles.storyTop}>Manon</div><h5>Famille</h5><div className={styles.familyComposition}><PresenceRail months={months} tracks={tracks} />
    <div className={styles.familyPeople}>{father === undefined ? null : <div><UserRound aria-hidden="true" size={27} strokeWidth={1.5} /><span>Papa · {shortPlaceLabel(father.label)}</span><BigFact value={integer.format(father.presenceDays)} caption="journées de présence" /></div>}{mother === undefined ? null : <div><UserRound aria-hidden="true" size={27} strokeWidth={1.5} /><span>Maman · {shortPlaceLabel(mother.label)}</span><BigFact value={integer.format(mother.presenceDays)} caption="journées de présence" /></div>}</div></div>
    <MobilityAside summary={familyMobilityWithoutPartner} title="Ses visites familiales" />
  </article>;
}
function ManonFriends({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const { amandine, friendMobilityWithoutPartner } = person.socialLife;
  const friend = amandine[0];
  if (friend === undefined && friendMobilityWithoutPartner === null) return null;
  return <article className={styles.friendsStory} data-person="manon"><div className={styles.storyTop}><UserRound aria-hidden="true" size={25} strokeWidth={1.5} /><span>Manon</span></div><h5>Amis</h5>{friend === undefined ? null : <><p><strong>{friend.label.replace(/^Chez\s+/iu, "")}</strong> · {integer.format(friend.presenceDays)} journées de présence</p><PresenceRail months={months} tracks={[{ key: friend.placeRef, label: "Amandine", monthlyPresenceDays: friend.monthlyPresenceDays, monthlyPresenceSegments: friend.monthlyPresenceSegments }]} /></>}<MobilityAside summary={friendMobilityWithoutPartner} title="Ses visites amicales" /></article>;
}

export function PersonaEditorialView({ model, direct, headingId }: { readonly model: PersonaEditorialModel; readonly direct: PersonaDirectModel; readonly headingId: string }) {
  const [active, setActive] = useState<"adrien" | "manon">("adrien");
  const months = monthKeys(model.period.first, model.period.certifiedThrough);
  return <div className={styles.root}>
    <header className={styles.hero}>
      <div><h2 id={headingId}>Nos profils</h2><small>{fullMonthYear.format(dateOf(model.period.first))} → {fullMonthYear.format(dateOf(model.period.certifiedThrough))}</small></div>
      <div className={styles.heroIdentity}>
        <div className={styles.heroPortraits} aria-label="Portraits d’Adrien et Manon">
          <div data-person="adrien"><span className={styles.portraitFrame}><Image src="/api/persona-portrait/adrien" alt="Portrait d’Adrien" width={84} height={84} sizes="84px" unoptimized /></span><strong>Adrien</strong></div>
          <div data-person="manon"><span className={styles.portraitFrame}><Image src="/api/persona-portrait/manon" alt="Portrait de Manon" width={84} height={84} sizes="84px" unoptimized /></span><strong>Manon</strong></div>
        </div>
        <nav className={styles.heroTabs} aria-label="Choisir le portrait"><span aria-current="page">Adrien + Manon</span><a href="#nous-deux"><Heart aria-hidden="true" size={15} /> Nous deux</a></nav>
      </div>
    </header>
    <nav className={styles.mobileSwitch} aria-label="Personne affichée sur mobile"><button type="button" aria-pressed={active === "adrien"} onClick={() => setActive("adrien")}>Adrien</button><button type="button" aria-pressed={active === "manon"} onClick={() => setActive("manon")}>Manon</button></nav>
    <section className={styles.majorSection} aria-labelledby="persona-work-title"><SectionHeading id="persona-work-title" title="Nos journées de travail" lead="Ce que nos trajets et nos pauses racontent." /><div className={styles.editorialGrid}>
      <div className={styles.span6} data-mobile-active={active === "adrien"}><WorkEconomicNote person="adrien" label="Transports en commun" value={amount(model.persons[0].work.commute.directCost)} detail="de coût direct pour aller travailler" /></div><div className={styles.span6} data-mobile-active={active === "manon"}><WorkEconomicNote person="manon" label="Peugeot pour aller travailler" value={model.vehicle.workUsageSummary?.estimatedFuelCostPerDay === null || model.vehicle.workUsageSummary === null ? "—" : amount(model.vehicle.workUsageSummary.estimatedFuelCostPerDay, true)} detail="de carburant utilisé par journée de trajet" /></div>
      <div className={styles.span4} data-mobile-active={active === "adrien"}><AdrienPermit person={model.persons[0]} /></div><div className={styles.span8} data-mobile-active={active === "manon"}><VehicleStory model={model} manonId={model.persons[1].personId} /></div>
      <div className={styles.span6} data-mobile-active={active === "adrien"}><MealStory name="Ange" meal={model.persons[0].work.workMeals} adrien /></div><div className={styles.span6} data-mobile-active={active === "manon"}><MealStory name="Marie Blachère" meal={model.persons[1].work.workMeals} adrien={false} /></div><div className={styles.span12} data-mobile-active={active === "manon"}><ManonInterventions person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-universes-title"><SectionHeading id="persona-universes-title" title="Nos univers personnels" lead="Projets, sons et histoires qui accompagnent l’année." /><div className={styles.editorialGrid}>
      <div className={styles.span5} data-mobile-active={active === "adrien"}><PhotoStory person={model.persons[0]} /></div><div className={styles.span7} data-mobile-active={active === "manon"}><SeriesStory person={model.persons[1]} months={months} /></div>
      <div className={styles.span4} data-mobile-active={active === "adrien"}><CodeStory person={model.persons[0]} direct={direct} /></div><div className={styles.span4} data-mobile-active={active === "adrien"}><MusicStory person={model.persons[0]} /></div><div className={styles.span4} data-mobile-active={active === "manon"}><SunoStory person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-habits-title"><SectionHeading id="persona-habits-title" title="Nos habitudes qui reviennent" lead="Les gestes et les objets qui ponctuent notre quotidien." /><div className={styles.editorialGrid}>
      <div className={styles.span5} data-mobile-active={active === "adrien"}><AdrienHabits person={model.persons[0]} /></div><div className={styles.span7} data-mobile-active={active === "manon"}><ManonProducts person={model.persons[1]} /></div>
      <div className={styles.span12} data-mobile-active={active === "manon"}><ManonVape person={model.persons[1]} /></div>
    </div></section>
    <section className={styles.majorSection} aria-labelledby="persona-social-title"><SectionHeading id="persona-social-title" title="Notre vie sociale, chacun de son côté" lead="Famille, amis et sorties au fil de l’année." /><div className={styles.editorialGrid}>
      <div className={styles.span12} data-mobile-active={active === "manon"}><ManonFamily person={model.persons[1]} months={months} /></div>
      <div className={styles.span12} data-mobile-active={active === "manon"}><ManonFriends person={model.persons[1]} months={months} /></div><div className={styles.span6} data-mobile-active={active === "adrien"}><OutingsStory name="Adrien" outings={model.persons[0].socialLife.outingsWithoutPartnerParticipation} /></div><div className={styles.span6} data-mobile-active={active === "manon"}><OutingsStory name="Manon" outings={model.persons[1].socialLife.outingsWithoutPartnerParticipation} /></div>
    </div></section>
  </div>;
}
