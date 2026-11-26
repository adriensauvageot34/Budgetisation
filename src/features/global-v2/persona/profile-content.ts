import type { PersonaDirectBlock, PersonaDirectFact, PersonaDirectProfile } from "@/query-api/global-v2/persona-direct-presentation";
import type { EditorialProject, EditorialSubscription, PersonaEditorialModel } from "@/query-api/global-v2/persona-editorial";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

function money(value: string | null | undefined, estimate = false) {
  return value == null ? undefined : `${estimate ? "≈ " : ""}${currency.format(Number(value))}`;
}

function fact(label: string, value: string | number | null | undefined): readonly PersonaDirectFact[] {
  return value == null ? [] : [{ label, value: typeof value === "number" ? quantity.format(value) : value }];
}

function projectFacts(project: EditorialProject): readonly PersonaDirectFact[] {
  return [
    ...fact(project.netCertifiedByRefundLink ? "Coût après remboursement" : "Coût observé", money(project.netCertifiedByRefundLink ? project.netCost : project.grossCost)),
    ...fact("Achats", project.purchaseCount),
  ];
}

function service(title: string, subscription: EditorialSubscription) {
  return {
    title,
    facts: [
      ...fact("Tarif observé", money(subscription.typicalPayment)),
      ...fact("Cadence observée", subscription.cadence),
      ...fact("Paiements observés", subscription.observedPaymentCount || undefined),
    ],
  };
}

export function profileBlocks(profile: PersonaDirectProfile, editorial: PersonaEditorialModel | undefined): readonly PersonaDirectBlock[] {
  const blocks = new Map([...profile.daily, ...profile.recurring, ...profile.phases].map((block) => [block.key, block]));
  if (!editorial) return [...blocks.values()];
  const [adrien, manon] = editorial.persons;
  const owner = profile.personId === adrien.personId ? adrien : profile.personId === manon.personId ? manon : undefined;
  if (!owner) return [...blocks.values()];

  function update(key: string, title: string, facts: readonly PersonaDirectFact[], items: PersonaDirectBlock["items"] = []) {
    const previous = blocks.get(key);
    if (!previous && facts.length === 0 && items.length === 0) return;
    const namedItems = new Map(previous?.items.map((item) => [item.title, item]));
    for (const item of items) {
      const published = namedItems.get(item.title);
      namedItems.set(item.title, published ? { ...published, facts: [...published.facts, ...item.facts] } : item);
    }
    blocks.set(key, { key, title, description: previous?.description, facts: [...facts, ...(previous?.facts ?? [])], items: [...namedItems.values()] });
  }

  const meals = owner.work.workMeals.allPurchaseHabitSummary;
  update("meal", "Repas au travail", [
    ...fact("Prix habituel", money(meals?.typicalPurchase)),
    ...fact("Achats observés", meals?.purchaseCount || undefined),
    ...fact("Adresses habituelles", meals?.merchants.join(" · ") || undefined),
  ]);

  const outings = owner.socialLife.outingsWithoutPartnerParticipation;
  update("outings", "Sorties de son côté", fact("Sorties renseignées", outings.length || undefined),
    outings.map((outing) => ({
      title: outing.title,
      facts: [
        ...fact("Date", shortDate.format(new Date(`${outing.date.slice(0, 10)}T00:00:00Z`))),
        ...fact("Lieu", outing.place),
      ],
    })));

  if (owner === adrien) {
    const { personalUniverses, recurringHabits, work } = adrien;
    update("work-mobility", "Trajets de travail", [
      ...fact("Transport en commun", money(work.commute.directCost)),
      ...fact("Jours sur site", work.onsiteDays),
      ...fact("Jours en télétravail", work.remoteDays),
    ]);
    update("permit", "Permis de conduire", fact("Investis dans le projet", money(personalUniverses.permit.cost)));
    update("creative", "Projets créatifs", fact("Projet photo", money(personalUniverses.photo.netCertifiedByRefundLink ? personalUniverses.photo.netCost : personalUniverses.photo.grossCost)), [
      { title: "Photo", facts: projectFacts(personalUniverses.photo) },
      { title: "Musique", facts: projectFacts(personalUniverses.musicHeadphones) },
    ]);
    update("services", "Services & abonnements", [], [
      service("Google AI Pro", personalUniverses.googleAiPro),
      service("Qobuz", recurringHabits.qobuz),
    ]);
    update("grooming", "Coiffeur & soins", [
      ...fact("Tarif habituel", money(recurringHabits.hairdresser.typicalPersonalCost)),
      ...fact("Budget observé", money(recurringHabits.hairdresser.personalAnnualCost)),
      ...fact("Prix de la cire coiffante", money(recurringHabits.stylingWax.price)),
      ...fact("Salon", recurringHabits.hairdresser.places[0]?.label),
    ]);
    update("tobacco", "Tabac", fact("Budget mensuel estimé", money(recurringHabits.tobacco?.approximateMonthlyBudget, true)));
  } else {
    const { personalUniverses, recurringHabits, socialLife, work } = manon;
    update("work-mobility", "Trajets de travail", [
      ...fact("Jours sur site", work.onsiteDays),
      ...fact("Lieu de travail", work.primaryWorkPlaces[0]?.label),
      ...fact("Interventions professionnelles", work.professionalInterventions.eventCount),
    ]);
    update("services", "Divertissement", [], [service("Netflix", recurringHabits.netflix), service("Max", recurringHabits.max)]);
    update("beauty", "Beauté & soins", [], personalUniverses.products.map((product) => ({
      title: product.label,
      facts: [...fact("Prix habituel", money(product.typicalPrice)), ...fact("Achats observés", product.purchaseCount)],
    })));
    update("vape", "Vape", [
      ...fact("Matériel observé", money(recurringHabits.vape.equipmentCost)),
      ...fact("Achats directs", money(recurringHabits.vape.directObservedCost)),
    ]);
    update("tobacco", "Cigarettes", fact("Cigarettes par jour", recurringHabits.cigarettesPerDay));
    update("social", "Famille & amis", [
      ...fact("Visites en famille", socialLife.familyVisitTotal),
      ...fact("Visites par trimestre", socialLife.familyVisitsPerQuarter),
    ]);
    update("suno", "Chanson pour son père", projectFacts(personalUniverses.sunoFatherSong));
  }

  return [...blocks.values()];
}
