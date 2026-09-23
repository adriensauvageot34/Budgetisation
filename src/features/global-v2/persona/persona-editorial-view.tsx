"use client";

import Image from "next/image";
import { Camera, CarFront, Headphones, Heart, Monitor, Moon, Scissors, UtensilsCrossed } from "lucide-react";
import type { PersonaDirectModel } from "@/query-api/global-v2/persona-direct-presentation";
import type { EditorialOuting, EditorialPeriod, EditorialProject, EditorialSubscription, PersonaEditorialModel } from "@/query-api/global-v2/persona-editorial";
import styles from "./persona-editorial.module.css";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const exactMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const roundedMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const monthOnly = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });

function dateOf(value: string): Date { return new Date(`${value.slice(0, 10)}T00:00:00Z`); }
function month(value: string): string { return monthYear.format(dateOf(value)); }
function periodLabel(value: EditorialPeriod): string | null { return value === null ? null : `${month(value.first)} → ${month(value.last)}`; }
function amount(value: string, approximate = false): string {
  const number = Number(value);
  if (number === 0) return "0 €";
  return `${approximate ? "≈ " : ""}${(approximate ? roundedMoney : exactMoney).format(number)}`;
}
function monthly(value: string | null): string { return value === null ? "—" : `${amount(value)}/mois`; }
function subscriptionPrice(value: EditorialSubscription): string { return value.typicalPayment === null ? "—" : monthly(value.typicalPayment); }
function monthKeys(first: string, last: string): readonly string[] {
  const start = dateOf(first), end = dateOf(last), keys: string[] = [];
  for (let year = start.getUTCFullYear(), monthIndex = start.getUTCMonth(); year < end.getUTCFullYear() || year === end.getUTCFullYear() && monthIndex <= end.getUTCMonth(); monthIndex++) {
    if (monthIndex === 12) { year++; monthIndex = 0; }
    keys.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
  }
  return keys;
}
function Section({ id, title, children }: { readonly id: string; readonly title: string; readonly children: React.ReactNode }) {
  return <section className={styles.profileSection} aria-labelledby={id}><h3 id={id}>{title}</h3>{children}</section>;
}
function Fact({ value, label }: { readonly value: string; readonly label: string }) {
  return <div className={styles.profileFact}><strong>{value}</strong><span>{label}</span></div>;
}
function ProfileHeader({ model, headingId }: { readonly model: PersonaEditorialModel; readonly headingId: string }) {
  const adrien = model.persons[0], manon = model.persons[1];
  const commute = model.vehicle.workUsageSummary?.estimatedFuelCostPerDay;
  const insurance = model.vehicle.insuranceSummary.currentMonthlyCost;
  return <header className={styles.profileHero}>
    <div className={styles.heroLine}><h2 id={headingId}>Nos profils</h2><nav className={styles.profileTabs} aria-label="Vues des profils"><span aria-current="page">Adrien + Manon</span><button type="button" disabled aria-label="Nous deux, bientôt disponible"><Heart aria-hidden="true" size={15} /> Nous deux <small>à venir</small></button></nav></div>
    <div className={styles.profilePair}>
      <article className={styles.identityCard} data-person="adrien"><span className={styles.portraitFrame}><Image src="/api/persona-portrait/adrien" alt="Portrait d’Adrien" width={116} height={116} sizes="116px" priority unoptimized /></span><div className={styles.identityBody}><h3>Adrien</h3><p className={styles.identityWork}>OBS <span>·</span> Bâtiment Genesis — Montpellier</p><div className={styles.identityFacts}><div><span>Transports en commun</span><strong>{amount(adrien.work.commute.directCost)}</strong><small>pour aller travailler</small></div><div><span>Permis en cours</span><strong>{amount(adrien.personalUniverses.permit.cost, true)}</strong><small>pour le projet</small></div></div></div></article>
      <article className={styles.identityCard} data-person="manon"><span className={styles.portraitFrame}><Image src="/api/persona-portrait/manon" alt="Portrait de Manon" width={116} height={116} sizes="116px" priority unoptimized /></span><div className={styles.identityBody}><h3>Manon</h3><p className={styles.identityWork}>{manon.work.primaryWorkPlaces[0]?.label.replace(/\s+[–—]\s+.*$/u, "") ?? "Promotrans"}</p><div className={styles.identityFacts}><div><span>Peugeot pour travailler</span><strong>{commute === null || commute === undefined ? "—" : amount(commute, true)}</strong><small>par jour de trajet</small></div><div><span>Assurance voiture</span><strong>{insurance === null ? "—" : monthly(insurance)}</strong><small>{model.vehicle.insuranceSummary.currentProvider ?? "assurance actuelle"}</small></div></div></div></article>
    </div>
  </header>;
}
function Permit({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const permit = person.personalUniverses.permit;
  const months = Object.entries(permit.monthlyCost ?? {}).filter(([, cost]) => Number(cost) > 0).sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 3).sort(([a], [b]) => a.localeCompare(b));
  return <article className={styles.permitProfile} data-person="adrien"><div className={styles.moduleTitle}><CarFront aria-hidden="true" size={25} /><h4>Le permis</h4></div><div className={styles.permitLead}><Fact value={amount(permit.cost, true)} label="pour le projet" />{permit.period === null ? null : <span>{periodLabel(permit.period)}</span>}</div><div className={styles.permitMonths}>{months.map(([key, cost]) => <div key={key}><span>{monthOnly.format(dateOf(`${key}-01`))}</span><strong>{amount(cost, true)}</strong></div>)}</div></article>;
}
function Peugeot({ model }: { readonly model: PersonaEditorialModel }) {
  const { vehicle } = model;
  if (vehicle.householdVehicle === null) return null;
  const usage = vehicle.workUsageSummary, insurance = vehicle.insuranceSummary;
  return <article className={styles.peugeotProfile} data-person="manon"><header><div><div className={styles.moduleTitle}><CarFront aria-hidden="true" size={27} /><h4>Notre Peugeot</h4></div><p>Peugeot 207 · véhicule du foyer</p></div>{vehicle.nonFuelCostTotalReady && vehicle.nonFuelCostTotal !== null ? <div className={styles.peugeotTotal}><strong>{amount(vehicle.nonFuelCostTotal, true)}</strong><span>hors carburant</span></div> : null}</header><div className={styles.peugeotColumns}>
    <div><h5>Pour travailler</h5>{usage === null ? null : <><Fact value={`${integer.format(Number(usage.distanceKm))} km`} label="sur la période" /><p>{amount(usage.estimatedFuelCost, true)} de carburant utilisé</p>{usage.estimatedFuelCostPerDay === null ? null : <small>{amount(usage.estimatedFuelCostPerDay, true)} par jour de trajet</small>}</>}</div>
    <div><h5>Assurance</h5>{insurance.currentMonthlyCost === null ? null : <Fact value={monthly(insurance.currentMonthlyCost)} label={insurance.currentProvider ?? "assurance actuelle"} />}<p>{insurance.series.map((item) => item.provider).join(" → ")}</p>{insurance.periodCost === null ? null : <small>{amount(insurance.periodCost, true)} sur la période</small>}</div>
    <div><h5>Entretien</h5><Fact value={amount(vehicle.maintenanceSummary.totalIdentifiedCost, true)} label="réparations & entretien" /></div>
  </div></article>;
}
function WorkMeals({ meal, person }: { readonly meal: PersonaEditorialModel["persons"][number]["work"]["workMeals"]; readonly person: "adrien" | "manon" }) {
  const summary = meal.allPurchaseHabitSummary;
  return <article className={styles.mealProfile} data-person={person}><div className={styles.moduleTitle}><UtensilsCrossed aria-hidden="true" size={23} /><h4>Repas au travail</h4></div>{summary === undefined || summary.purchaseCount === 0 ? <p>Pas encore assez d’achats pour dégager un rythme.</p> : <><div className={styles.mealMetrics}>
    {summary.monthlyPurchaseRate === null ? null : <Fact value={`≈ ${oneDecimal.format(summary.monthlyPurchaseRate)}`} label="achats / mois" />}
    {summary.typicalPurchase === null ? null : <Fact value={amount(summary.typicalPurchase, true)} label="par passage" />}
    {summary.monthlyObservedCost === null ? null : <Fact value={amount(summary.monthlyObservedCost, true)} label="par mois" />}
    {summary.annualObservedCost === null ? null : <Fact value={amount(summary.annualObservedCost, true)} label="sur l’année" />}
  </div><div className={styles.merchantTags}>{summary.merchants.map((merchant) => <span key={merchant}>{merchant}</span>)}</div></>}</article>;
}
function projectCost(project: EditorialProject): string { return amount(project.netCertifiedByRefundLink ? project.netCost : project.grossCost, true); }
function AdrienUniverses({ person, direct }: { readonly person: PersonaEditorialModel["persons"][0]; readonly direct: PersonaDirectModel }) {
  const chatGpt = direct.profiles.find((profile) => profile.personId === person.personId)?.recurring.flatMap((block) => block.items).find((item) => item.title === "ChatGPT")?.facts.find((fact) => fact.label === "Tarif observé par occurrence");
  return <article className={styles.universeProfile} data-person="adrien"><header><h4>Adrien</h4><span>Photo · Code & IA · Musique</span></header><div className={styles.adrienUniverses}>
    <div><Camera aria-hidden="true" size={32} /><h5>Photo</h5><Fact value={projectCost(person.personalUniverses.photo)} label="de matériel pour le projet" /><p>Réflecteurs · Fond studio · Séance photo</p></div>
    <div><Monitor aria-hidden="true" size={30} /><h5>Code & IA</h5><p><strong>ChatGPT Plus</strong><span>{chatGpt?.value ?? "dans ses outils"}</span></p><p><strong>Google AI Pro</strong><span>{subscriptionPrice(person.personalUniverses.googleAiPro)}</span></p></div>
    <div><Headphones aria-hidden="true" size={32} /><h5>Musique</h5><p><strong>Qobuz</strong><span>{subscriptionPrice(person.recurringHabits.qobuz)}</span></p><p><strong>Casque audio</strong><span>{projectCost(person.personalUniverses.musicHeadphones)}</span></p></div>
  </div></article>;
}
function VideoTimeline({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const services = [{ name: "Netflix", value: person.recurringHabits.netflix }, { name: "Max", value: person.recurringHabits.max }];
  return <div className={styles.videoArea}><div className={styles.videoHeading}><h5>Séries & divertissement</h5>{person.recurringHabits.videoObservedCost === undefined ? null : <span>{amount(person.recurringHabits.videoObservedCost, true)} sur la période</span>}</div><div className={styles.videoTimeline}><div className={styles.videoMonths}><span />{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}<span /></div>{services.map(({ name, value }) => <div className={styles.videoRow} key={name}><strong>{name}</strong>{months.map((key) => <i key={key} data-active={value.firstObservedAt !== null && key >= value.firstObservedAt.slice(0, 7) && (value.lifecycle === "Active" || value.lastObservedAt === null || key <= value.lastObservedAt.slice(0, 7))} />)}<span>{subscriptionPrice(value)}</span></div>)}</div></div>;
}
function ManonUniverses({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const suno = person.personalUniverses.sunoFatherSong;
  return <article className={styles.universeProfile} data-person="manon"><header><h4>Manon</h4><span>Séries · Musique</span></header><VideoTimeline person={person} months={months} /><div className={styles.sunoMoment}><span className={styles.sunoWave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span><div><strong>{suno.description}</strong><small>{periodLabel(suno.period)} · {projectCost(suno)} pour ce projet</small></div></div></article>;
}
function Grooming({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const { hairdresser, stylingWax } = person.recurringHabits;
  return <article className={styles.groomingProfile} data-person="adrien"><div className={styles.moduleTitle}><Scissors aria-hidden="true" size={27} /><h4>Barbe & cheveux</h4></div><div className={styles.groomingFacts}>{hairdresser.monthlyVisitEstimate === null || hairdresser.monthlyVisitEstimate === undefined ? null : <Fact value={`≈ ${integer.format(Number(hairdresser.monthlyVisitEstimate))} fois / mois`} label="son rythme" />}{hairdresser.typicalVisitPrice === null || hairdresser.typicalVisitPrice === undefined ? null : <Fact value={amount(hairdresser.typicalVisitPrice, true)} label="à chaque passage" />}{hairdresser.illustrativeAnnualCost === null || hairdresser.illustrativeAnnualCost === undefined ? null : <Fact value={amount(hairdresser.illustrativeAnnualCost, true)} label="sur l’année" />}</div><p>{hairdresser.places.map((place) => place.label.replace(/\s+[–—]\s+.*$/u, "")).join(" · ")}</p><div className={styles.waxLine}><strong>{stylingWax.label}</strong><span>achat régulier</span></div></article>;
}
const beautyNeeds: Readonly<Record<string, { readonly name: string; readonly object: string }>> = {
  maquillage_manon_mascara: { name: "Mascara", object: "mascara" },
  maquillage_manon_sourcils: { name: "Sourcils", object: "pencil" },
  skincare_manon_masque: { name: "Soin", object: "mask" },
};
function cadence(days: number): string { return days >= 25 ? `≈ tous les ${Math.max(1, Math.round(days / 30))} mois` : `≈ tous les ${integer.format(days)} jours`; }
function productName(label: string, kind: string): string {
  if (kind === "maquillage_manon_mascara") return "Benefit BADgal BANG!";
  if (kind === "maquillage_manon_sourcils") return "Sephora · Chocolate Brown";
  return label.replace(/\s+8[,.]5\s*g.*$/iu, "").replace(/\s*[–—-].*$/u, "");
}
function Beauty({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const products = person.personalUniverses.products.filter((item) => beautyNeeds[item.needKey] !== undefined);
  const groups = Object.entries(beautyNeeds).map(([needKey, definition]) => ({ needKey, definition, items: products.filter((item) => item.needKey === needKey) })).filter((group) => group.items.length > 0);
  return <article className={styles.beautyProfile} data-person="manon"><h4>Ses produits fidèles</h4><div className={styles.beautyShelf}>{groups.map(({ needKey, definition, items }) => <div key={needKey}><span className={styles.beautyObject} data-object={definition.object} aria-hidden="true"><i /></span><h5>{definition.name}</h5>{items.map((item) => <p key={item.productKey}><strong>{productName(item.label, needKey)}</strong><span>{integer.format(item.purchaseCount)} achats{item.typicalPrice === null ? "" : ` · ${amount(item.typicalPrice)}`}{item.medianGapDays === null || item.purchaseCount < 3 ? "" : ` · ${cadence(item.medianGapDays)}`}</span></p>)}</div>)}</div></article>;
}
function Tobacco({ person }: { readonly person: PersonaEditorialModel["persons"][0] }) {
  const budget = person.recurringHabits.tobacco;
  if (budget?.approximateMonthlyBudget === null || budget?.approximateMonthlyBudget === undefined) return null;
  return <article className={styles.smallHabit} data-person="adrien"><h4>Tabac</h4><Fact value={`${amount(budget.approximateMonthlyBudget, true)}/mois`} label="budget approximatif" /></article>;
}
function Vape({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  return <article className={styles.smallHabit} data-person="manon"><h4>Vape</h4><div className={styles.vapeSplit}><div><h5>Équipement</h5><p>Cigarette électronique + composants</p>{person.recurringHabits.vape.equipmentCost === null || person.recurringHabits.vape.equipmentCost === undefined ? null : <strong>{amount(person.recurringHabits.vape.equipmentCost, true)}</strong>}</div><div><h5>Consommation</h5><p>Fioles pour cigarette électronique</p></div></div></article>;
}
function Cigarettes({ person }: { readonly person: PersonaEditorialModel["persons"][1] }) {
  const daily = person.recurringHabits.cigarettesPerDay;
  if (daily === null || daily === undefined) return null;
  return <article className={styles.smallHabit} data-person="manon"><h4>Cigarettes</h4><Fact value={`≈ ${integer.format(Number(daily))} / jour`} label="son rythme" /></article>;
}
type TimelineTrack = { readonly key: string; readonly name: string; readonly segments: Readonly<Record<string, readonly boolean[]>> };
function VisitTimeline({ months, tracks }: { readonly months: readonly string[]; readonly tracks: readonly TimelineTrack[] }) {
  return <div className={styles.visitTimeline}><div className={styles.visitMonths}><span />{months.map((key) => <span key={key}>{monthOnly.format(dateOf(`${key}-01`)).slice(0, 3)}</span>)}</div>{tracks.map((track) => <div className={styles.visitRow} key={track.key}><strong>{track.name}</strong>{months.map((key) => <span key={key} aria-label={`${track.name}, ${monthOnly.format(dateOf(`${key}-01`))}`} className={styles.visitDots}>{(track.segments[key] ?? [false, false, false, false]).map((present, index) => <i key={index} data-present={present} />)}</span>)}</div>)}</div>;
}
function Family({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const social = person.socialLife, father = social.fatherHome[0], mother = social.maternalFamilyHome[0];
  if (father === undefined && mother === undefined) return null;
  const tracks = [...(father ? [{ key: father.placeRef, name: "Fontès", segments: father.monthlyPresenceSegments ?? {} }] : []), ...(mother ? [{ key: mother.placeRef, name: "Servian", segments: mother.monthlyPresenceSegments ?? {} }] : [])];
  return <article className={styles.socialTimeline} data-person="manon"><header><h4>Famille</h4><div className={styles.timelineLegend}><span><i data-color="father" /> Fontès — Papa</span><span><i data-color="mother" /> Servian — Maman</span></div></header><VisitTimeline months={months} tracks={tracks} /><div className={styles.socialFacts}>{father === undefined ? null : <Fact value={integer.format(father.visitCount ?? 0)} label="visites à Fontès" />}{mother === undefined ? null : <Fact value={integer.format(mother.visitCount ?? 0)} label="visites à Servian" />}{social.familyVisitsPerQuarter === undefined ? null : <Fact value={`≈ ${oneDecimal.format(social.familyVisitsPerQuarter)}`} label="visites / trimestre" />}{social.fatherRoundTripFuelCost === null || social.fatherRoundTripFuelCost === undefined ? null : <Fact value={amount(social.fatherRoundTripFuelCost, true)} label="aller-retour Fontès" />}{social.motherRoundTripFuelCost === null || social.motherRoundTripFuelCost === undefined ? null : <Fact value={amount(social.motherRoundTripFuelCost, true)} label="aller-retour Servian" />}{social.familyMobility?.support === "SUFFICIENT" ? <Fact value={amount(social.familyMobility.estimatedFuelCost, true)} label="carburant des trajets retracés" /> : null}</div></article>;
}
function Friends({ person, months }: { readonly person: PersonaEditorialModel["persons"][1]; readonly months: readonly string[] }) {
  const friends = (person.socialLife.friendVisits ?? []).slice(0, 4);
  if (friends.length === 0) return null;
  return <article className={styles.socialTimeline} data-person="manon"><header><h4>Amis</h4><span>{friends.map((friend) => friend.label.replace(/^Chez\s+/iu, "")).join(" · ")}</span></header><VisitTimeline months={months} tracks={friends.map((friend) => ({ key: friend.placeRef, name: friend.label.replace(/^Chez\s+/iu, ""), segments: friend.monthlyVisitSegments }))} /><div className={styles.socialFacts}><Fact value={integer.format(friends.reduce((total, friend) => total + friend.visitCount, 0))} label="visites chez ces amis" />{person.socialLife.friendMobility?.support === "SUFFICIENT" ? <><Fact value={`${integer.format(Number(person.socialLife.friendMobility.distanceKm))} km`} label="déplacements amicaux" /><Fact value={amount(person.socialLife.friendMobility.estimatedFuelCost, true)} label="carburant estimé" /></> : null}</div></article>;
}
function outingTitle(value: string): string { return value.replace(/^Soirée à [^:]+:\s*/iu, "").replace(/^Sortie\s*\/\s*soirée\s*[–—-]\s*/iu, "").replace(/^Soirée techno\s*[–—-]\s*/iu, "").replace(/^Sortie(?:\s+au)?\s+/iu, "").replace(/\s*[–—-]\s*\d{1,2}\s+\p{L}+\s+\d{4}$/iu, "").replace(/\s+\d{1,2}\s+\p{L}+\s+\d{4}$/iu, ""); }
function Outings({ name, outings }: { readonly name: "Adrien" | "Manon"; readonly outings: readonly EditorialOuting[] }) {
  return <div className={styles.outingLine} data-person={name.toLowerCase()}><Moon aria-hidden="true" size={20} /><strong>{name}</strong><span>{integer.format(outings.length)} sorties</span><div>{outings.map((outing) => <span key={outing.eventRef}>{outingTitle(outing.title) || outing.place || "Sortie"}</span>)}</div></div>;
}

export function PersonaEditorialView({ model, direct, headingId }: { readonly model: PersonaEditorialModel; readonly direct: PersonaDirectModel; readonly headingId: string }) {
  const months = monthKeys(model.period.first, model.period.certifiedThrough);
  return <div className={styles.root}>
    <ProfileHeader model={model} headingId={headingId} />
    <Section id="persona-work-title" title="Nos journées de travail"><div className={styles.workGrid}><Permit person={model.persons[0]} /><Peugeot model={model} /><WorkMeals person="adrien" meal={model.persons[0].work.workMeals} /><WorkMeals person="manon" meal={model.persons[1].work.workMeals} /></div></Section>
    <Section id="persona-universes-title" title="Nos univers personnels"><div className={styles.universesGrid}><AdrienUniverses person={model.persons[0]} direct={direct} /><ManonUniverses person={model.persons[1]} months={months} /></div></Section>
    <Section id="persona-habits-title" title="Nos habitudes qui reviennent"><div className={styles.habitsGrid}><Grooming person={model.persons[0]} /><Beauty person={model.persons[1]} /><Tobacco person={model.persons[0]} /><Vape person={model.persons[1]} /><Cigarettes person={model.persons[1]} /></div></Section>
    <Section id="persona-social-title" title="Notre vie sociale, chacun de son côté"><div className={styles.socialGrid}><Family person={model.persons[1]} months={months} /><Friends person={model.persons[1]} months={months} /><div className={styles.outingsPair}><Outings name="Adrien" outings={model.persons[0].socialLife.outingsWithoutPartnerParticipation} /><Outings name="Manon" outings={model.persons[1].socialLife.outingsWithoutPartnerParticipation} /></div></div></Section>
  </div>;
}
