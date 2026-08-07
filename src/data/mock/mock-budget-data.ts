import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  FlowType,
  Importance,
  ImportBatch,
  MonthKey,
  Operation,
  Person,
  Recurrence,
} from "@/domain/budget";
const monthKeys: MonthKey[] = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
];

export const mockAccounts: Account[] = [
  {
    id: "adrien-courant",
    name: "Compte courant Adrien",
    owner: "Adrien",
    kind: "Compte courant",
    color: "#50766f",
  },
  {
    id: "manon-courant",
    name: "Compte courant Manon",
    owner: "Manon",
    kind: "Compte courant",
    color: "#d47b61",
  },
  {
    id: "compte-joint",
    name: "Compte commun",
    owner: "Foyer",
    kind: "Compte courant",
    color: "#8b78a8",
  },
  {
    id: "carte-repas",
    name: "Carte repas",
    owner: "Foyer",
    kind: "Carte repas",
    color: "#d7a940",
  },
  {
    id: "epargne-voyage",
    name: "Épargne voyage",
    owner: "Foyer",
    kind: "Épargne",
    color: "#5d8fb1",
  },
  {
    id: "especes",
    name: "Espèces",
    owner: "Foyer",
    kind: "Espèces",
    color: "#8d918a",
  },
];

export const mockCategories: CategoryDefinition[] = [
  {
    name: "Logement",
    slug: "logement",
    color: "#51736d",
    subcategories: ["Loyer", "Énergie", "Assurances", "Entretien"],
    includedInConsumption: true,
  },
  {
    name: "Alimentation",
    slug: "alimentation",
    color: "#d39c3f",
    subcategories: ["Courses alimentaires", "Boulangerie", "Café au travail"],
    includedInConsumption: true,
  },
  {
    name: "Restauration",
    slug: "restauration",
    color: "#d26f54",
    subcategories: ["Restaurant", "Livraison", "Bar et sortie"],
    includedInConsumption: true,
  },
  {
    name: "Transport & voiture",
    slug: "transport-voiture",
    color: "#5b8eaa",
    subcategories: ["Carburant", "Transports en commun", "Entretien", "Stationnement"],
    includedInConsumption: true,
  },
  {
    name: "Télécom & numérique",
    slug: "telecom-numerique",
    color: "#7566a5",
    subcategories: ["Internet", "Téléphone", "Logiciels", "Streaming"],
    includedInConsumption: true,
  },
  {
    name: "Loisirs & activités",
    slug: "loisirs-activites",
    color: "#b65f82",
    subcategories: ["Culture", "Sport", "Sorties", "Jeux"],
    includedInConsumption: true,
  },
  {
    name: "Santé & bien-être",
    slug: "sante-bien-etre",
    color: "#61a184",
    subcategories: ["Pharmacie", "Consultation", "Soins personnels"],
    includedInConsumption: true,
  },
  {
    name: "Achats & maison",
    slug: "achats-maison",
    color: "#ad7964",
    subcategories: ["Vêtements", "Maison", "Équipement", "Cadeaux"],
    includedInConsumption: true,
  },
  {
    name: "Tabac & vape",
    slug: "tabac-vape",
    color: "#9a7b5f",
    subcategories: ["Bureau de tabac", "Vape"],
    includedInConsumption: true,
  },
  {
    name: "Voyages",
    slug: "voyages",
    color: "#4f9ca0",
    subcategories: ["Hébergement", "Transport", "Activités"],
    includedInConsumption: true,
  },
  {
    name: "Revenus",
    slug: "revenus",
    color: "#4d9673",
    subcategories: ["Salaire", "Autre entrée", "Cadeau"],
    includedInConsumption: false,
  },
  {
    name: "Transferts internes",
    slug: "transferts-internes",
    color: "#8e98a0",
    subcategories: ["Partage des charges", "Épargne"],
    includedInConsumption: false,
  },
  {
    name: "Remboursements",
    slug: "remboursements",
    color: "#6696a8",
    subcategories: ["Remboursement reçu", "Avoir commerçant"],
    includedInConsumption: false,
  },
  {
    name: "Prêts & avances",
    slug: "prets-avances",
    color: "#9e7da3",
    subcategories: ["Avance familiale", "Remboursement de prêt"],
    includedInConsumption: false,
  },
  {
    name: "Espèces à ventiler",
    slug: "especes-a-ventiler",
    color: "#96958d",
    subcategories: ["Retrait à ventiler"],
    includedInConsumption: false,
  },
];

type OperationSeed = {
  day: number;
  label: string;
  merchant: string;
  amount: number;
  person: Person;
  accountId: string;
  flow: FlowType;
  category: string;
  subcategory: string;
  preciseType: string;
  importance: Importance;
  recurrence: Recurrence;
  status?: AnalyticalStatus;
  note?: string;
  uncertain?: boolean;
};

const monthProfiles: Record<
  MonthKey,
  {
    grocery: number;
    dining: number;
    transport: number;
    leisure: number;
    shopping: number;
    coffee: number;
    incomeBoost?: number;
  }
> = {
  "2026-01": { grocery: 1.04, dining: 0.82, transport: 0.94, leisure: 0.7, shopping: 0.8, coffee: 0.88 },
  "2026-02": { grocery: 0.92, dining: 0.72, transport: 0.88, leisure: 0.75, shopping: 0.62, coffee: 0.82 },
  "2026-03": { grocery: 0.98, dining: 0.91, transport: 1.55, leisure: 0.96, shopping: 0.88, coffee: 0.95 },
  "2026-04": { grocery: 1.08, dining: 1.3, transport: 1.1, leisure: 1.18, shopping: 1.04, coffee: 1.08 },
  "2026-05": { grocery: 0.94, dining: 1.12, transport: 0.9, leisure: 1.45, shopping: 0.92, coffee: 0.9, incomeBoost: 420 },
  "2026-06": { grocery: 1.1, dining: 0.84, transport: 1.02, leisure: 0.82, shopping: 0.76, coffee: 0.96 },
  "2026-07": { grocery: 0.86, dining: 1.42, transport: 1.48, leisure: 1.65, shopping: 1.1, coffee: 0.72 },
  "2026-08": { grocery: 1.02, dining: 0.94, transport: 0.96, leisure: 1.08, shopping: 1.32, coffee: 0.92 },
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function createOperation(
  month: MonthKey,
  seed: OperationSeed,
  index: number,
): Operation {
  const day = String(Math.min(seed.day, 28)).padStart(2, "0");
  return {
    id: `${month}-${String(index + 1).padStart(3, "0")}`,
    date: `${month}-${day}`,
    importMonth: month,
    label: seed.label,
    normalizedMerchant: seed.merchant,
    amount: round(seed.amount),
    person: seed.person,
    accountId: seed.accountId,
    flow: seed.flow,
    category: seed.category,
    subcategory: seed.subcategory,
    preciseType: seed.preciseType,
    importance: seed.importance,
    recurrence: seed.recurrence,
    status: seed.status ?? "Habituel",
    sourceLabel: `LIBELLÉ FICTIF · ${seed.merchant.toUpperCase()} · ${day}/${month.slice(5)}`,
    importId: `IMP-${month.replace("-", "")}`,
    note: seed.note ?? null,
    event: null,
    uncertain: seed.uncertain ?? false,
    fingerprint: `fixture-${month}-${index + 1}`,
    sourceMetadata: { fixture: true },
  };
}

function recurringSeeds(month: MonthKey): OperationSeed[] {
  const boost = monthProfiles[month].incomeBoost ?? 0;
  return [
    {
      day: 1,
      label: "Salaire Adrien",
      merchant: "Atelier Boréal",
      amount: 2870 + boost,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Revenu",
      category: "Revenus",
      subcategory: "Salaire",
      preciseType: boost ? "Salaire et prime ponctuelle" : "Salaire mensuel",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 2,
      label: "Salaire Manon",
      merchant: "Maison Céleste",
      amount: 2410,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Revenu",
      category: "Revenus",
      subcategory: "Salaire",
      preciseType: "Salaire mensuel",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 3,
      label: "Loyer appartement",
      merchant: "Régie du Square",
      amount: -1240,
      person: "Adrien",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Logement",
      subcategory: "Loyer",
      preciseType: "Loyer résidence principale",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 4,
      label: "Électricité du foyer",
      merchant: "Énergie Claire",
      amount: month === "2026-01" || month === "2026-02" ? -112 : -84,
      person: "Manon",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Logement",
      subcategory: "Énergie",
      preciseType: "Électricité",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 5,
      label: "Internet maison",
      merchant: "Fibre Horizon",
      amount: -36.99,
      person: "Adrien",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Internet",
      preciseType: "Abonnement fibre",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 6,
      label: "Forfait mobile Adrien",
      merchant: "Mobile Serein",
      amount: -15.99,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Téléphone",
      preciseType: "Forfait mobile",
      importance: "Contrainte",
      recurrence: "Fixe",
    },
    {
      day: 7,
      label: "Forfait mobile Manon",
      merchant: "Mobile Serein",
      amount: -12.99,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Téléphone",
      preciseType: "Forfait mobile",
      importance: "Contrainte",
      recurrence: "Fixe",
    },
    {
      day: 8,
      label: "Assurance habitation",
      merchant: "Assurance Rivage",
      amount: -21.4,
      person: "Manon",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Logement",
      subcategory: "Assurances",
      preciseType: "Assurance habitation",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 9,
      label: "Abonnement musique",
      merchant: "Onde Audio",
      amount: -11.99,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Streaming",
      preciseType: "Streaming musical",
      importance: "Optionnelle",
      recurrence: "Fixe",
    },
    {
      day: 10,
      label: "Abonnement vidéo",
      merchant: "Studio Minuit",
      amount: -14.99,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Streaming",
      preciseType: "Streaming vidéo",
      importance: "Optionnelle",
      recurrence: "Fixe",
    },
    {
      day: 11,
      label: "Stockage partagé",
      merchant: "Nuage Local",
      amount: -4.99,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Télécom & numérique",
      subcategory: "Logiciels",
      preciseType: "Stockage cloud",
      importance: "Ajustable",
      recurrence: "Fixe",
    },
  ];
}

function variableSeeds(month: MonthKey): OperationSeed[] {
  const p = monthProfiles[month];
  const seeds: OperationSeed[] = [];
  const people: Person[] = ["Adrien", "Manon"];

  [82, 64, 96, 71].forEach((base, index) => {
    seeds.push({
      day: 4 + index * 7,
      label: `Courses de la semaine ${index + 1}`,
      merchant: index % 2 ? "Le Panier Vert" : "Marché des Halles",
      amount: -base * p.grocery,
      person: people[index % 2],
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Alimentation",
      subcategory: "Courses alimentaires",
      preciseType: "Courses du foyer",
      importance: "Indispensable",
      recurrence: "Variable",
    });
  });

  [4.2, 3.6, 4.8, 3.9, 4.4, 5.1, 3.7].forEach((base, index) => {
    seeds.push({
      day: 2 + index * 4,
      label: "Café au travail",
      merchant: index % 2 ? "Café des Quais" : "Comptoir Moka",
      amount: -base * p.coffee,
      person: people[index % 2],
      accountId: index % 3 === 0 ? "carte-repas" : `${people[index % 2].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Alimentation",
      subcategory: "Café au travail",
      preciseType: "Café ou boisson chaude",
      importance: "Optionnelle",
      recurrence: "Variable",
    });
  });

  [6.8, 8.4, 5.9].forEach((base, index) => {
    seeds.push({
      day: 7 + index * 8,
      label: "Passage à la boulangerie",
      merchant: "Boulangerie du Parc",
      amount: -base * p.grocery,
      person: people[(index + 1) % 2],
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Alimentation",
      subcategory: "Boulangerie",
      preciseType: "Pain et viennoiseries",
      importance: "Ajustable",
      recurrence: "Variable",
    });
  });

  [34, 58, 27, 46].forEach((base, index) => {
    seeds.push({
      day: 5 + index * 6,
      label: index === 2 ? "Déjeuner rapide" : "Restaurant à deux",
      merchant: index % 2 ? "Le Petit Comptoir" : "Cantine Sésame",
      amount: -base * p.dining,
      person: people[index % 2],
      accountId: index === 2 ? "carte-repas" : "compte-joint",
      flow: "Dépense",
      category: "Restauration",
      subcategory: index === 2 ? "Livraison" : "Restaurant",
      preciseType: index === 2 ? "Repas rapide" : "Restaurant ou brasserie",
      importance: "Optionnelle",
      recurrence: "Variable",
    });
  });

  [42, 54].forEach((base, index) => {
    seeds.push({
      day: 8 + index * 13,
      label: "Plein de carburant",
      merchant: "Station Nova",
      amount: -base * p.transport,
      person: people[index],
      accountId: `${people[index].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Transport & voiture",
      subcategory: "Carburant",
      preciseType: "Carburant voiture",
      importance: "Indispensable",
      recurrence: "Variable",
    });
  });

  [18.4, 11.6, 9.2, 16.8].forEach((base, index) => {
    seeds.push({
      day: 3 + index * 7,
      label: index === 3 ? "Stationnement centre-ville" : "Transports en commun",
      merchant: index === 3 ? "Parking République" : "Mobilités Métropole",
      amount: -base * p.transport,
      person: people[index % 2],
      accountId: `${people[index % 2].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Transport & voiture",
      subcategory: index === 3 ? "Stationnement" : "Transports en commun",
      preciseType: index === 3 ? "Parking" : "Tickets et abonnement",
      importance: index === 3 ? "Ajustable" : "Indispensable",
      recurrence: "Variable",
    });
  });

  [24, 38, 19].forEach((base, index) => {
    seeds.push({
      day: 6 + index * 9,
      label: ["Cinéma du vendredi", "Activité du week-end", "Livre et magazine"][index],
      merchant: ["Cinéma Horizon", "Atelier Tempo", "Librairie Lumen"][index],
      amount: -base * p.leisure,
      person: people[index % 2],
      accountId: `${people[index % 2].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Loisirs & activités",
      subcategory: ["Culture", "Sport", "Culture"][index],
      preciseType: ["Cinéma", "Activité de loisirs", "Livres et presse"][index],
      importance: index === 1 ? "Ajustable" : "Optionnelle",
      recurrence: "Variable",
    });
  });

  [32, 57, 24].forEach((base, index) => {
    seeds.push({
      day: 9 + index * 8,
      label: ["Petit équipement maison", "Vêtement de saison", "Cadeau d’anniversaire"][index],
      merchant: ["Maison Ocre", "Vestiaire 21", "Papier d’Étoiles"][index],
      amount: -base * p.shopping,
      person: people[(index + 1) % 2],
      accountId: `${people[(index + 1) % 2].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Achats & maison",
      subcategory: ["Maison", "Vêtements", "Cadeaux"][index],
      preciseType: ["Équipement du quotidien", "Vêtements", "Cadeau"][index],
      importance: index === 0 ? "Ajustable" : "Optionnelle",
      recurrence: "Variable",
    });
  });

  [17.5, 23.8].forEach((base, index) => {
    seeds.push({
      day: 12 + index * 11,
      label: index ? "Passage au bureau de tabac" : "Recharge vape",
      merchant: index ? "Le Kiosque Central" : "Vape des Arceaux",
      amount: -base,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Tabac & vape",
      subcategory: index ? "Bureau de tabac" : "Vape",
      preciseType: index ? "Bureau de tabac" : "Recharge vape",
      importance: "Contrainte",
      recurrence: "Variable",
    });
  });

  [14.6, 29].forEach((base, index) => {
    seeds.push({
      day: 13 + index * 10,
      label: index ? "Consultation de suivi" : "Pharmacie",
      merchant: index ? "Cabinet Aster" : "Pharmacie du Jardin",
      amount: -base,
      person: people[index],
      accountId: `${people[index].toLowerCase()}-courant`,
      flow: "Dépense",
      category: "Santé & bien-être",
      subcategory: index ? "Consultation" : "Pharmacie",
      preciseType: index ? "Consultation" : "Produits de pharmacie",
      importance: "Indispensable",
      recurrence: "Variable",
    });
  });

  seeds.push(
    {
      day: 2,
      label: "Participation aux charges communes",
      merchant: "Virement Adrien vers compte commun",
      amount: -980,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Transfert interne",
      category: "Transferts internes",
      subcategory: "Partage des charges",
      preciseType: "Virement interne émis",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
    {
      day: 2,
      label: "Participation aux charges communes",
      merchant: "Virement Manon vers compte commun",
      amount: -920,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Transfert interne",
      category: "Transferts internes",
      subcategory: "Partage des charges",
      preciseType: "Virement interne émis",
      importance: "Indispensable",
      recurrence: "Fixe",
    },
  );

  return seeds;
}

const extras: Partial<Record<MonthKey, OperationSeed[]>> = {
  "2026-01": [
    {
      day: 17,
      label: "Dépôt de garantie — régularisation",
      merchant: "Régie du Square",
      amount: -340,
      person: "Manon",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Logement",
      subcategory: "Entretien",
      preciseType: "Régularisation d’entrée dans le logement",
      importance: "Indispensable",
      recurrence: "Variable",
      status: "Exceptionnel",
      note: "Événement fictif utilisé pour rendre janvier atypique.",
    },
  ],
  "2026-02": [
    {
      day: 24,
      label: "Avoir sur achat maison",
      merchant: "Maison Ocre",
      amount: 42,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Remboursement",
      category: "Remboursements",
      subcategory: "Avoir commerçant",
      preciseType: "Avoir carte bancaire",
      importance: "Ajustable",
      recurrence: "Variable",
    },
  ],
  "2026-03": [
    {
      day: 19,
      label: "Réparation automobile",
      merchant: "Garage des Platanes",
      amount: -486,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Transport & voiture",
      subcategory: "Entretien",
      preciseType: "Réparation automobile",
      importance: "Indispensable",
      recurrence: "Variable",
      status: "Exceptionnel",
    },
  ],
  "2026-04": [
    {
      day: 22,
      label: "Week-end à Annecy",
      merchant: "Auberge des Cimes",
      amount: -238,
      person: "Manon",
      accountId: "epargne-voyage",
      flow: "Dépense",
      category: "Voyages",
      subcategory: "Hébergement",
      preciseType: "Hébergement week-end",
      importance: "Optionnelle",
      recurrence: "Variable",
      status: "Hors budget",
    },
  ],
  "2026-05": [
    {
      day: 16,
      label: "Pass festival printanier",
      merchant: "Scène des Docks",
      amount: -164,
      person: "Adrien",
      accountId: "adrien-courant",
      flow: "Dépense",
      category: "Loisirs & activités",
      subcategory: "Sorties",
      preciseType: "Billet de festival",
      importance: "Optionnelle",
      recurrence: "Variable",
      status: "Exceptionnel",
    },
  ],
  "2026-06": [
    {
      day: 20,
      label: "Soins dentaires",
      merchant: "Centre Dentaire Alba",
      amount: -215,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Dépense",
      category: "Santé & bien-être",
      subcategory: "Consultation",
      preciseType: "Soins dentaires",
      importance: "Indispensable",
      recurrence: "Variable",
      status: "Exceptionnel",
    },
    {
      day: 27,
      label: "Remboursement soins",
      merchant: "Mutuelle Aube",
      amount: 138,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Remboursement",
      category: "Remboursements",
      subcategory: "Remboursement reçu",
      preciseType: "Remboursement santé",
      importance: "Indispensable",
      recurrence: "Variable",
    },
  ],
  "2026-07": [
    {
      day: 14,
      label: "Location vacances",
      merchant: "Maison Azur",
      amount: -620,
      person: "Adrien",
      accountId: "epargne-voyage",
      flow: "Dépense",
      category: "Voyages",
      subcategory: "Hébergement",
      preciseType: "Location de vacances",
      importance: "Optionnelle",
      recurrence: "Variable",
      status: "Hors budget",
    },
    {
      day: 18,
      label: "Train pour les vacances",
      merchant: "Rail Lumière",
      amount: -184,
      person: "Manon",
      accountId: "epargne-voyage",
      flow: "Dépense",
      category: "Voyages",
      subcategory: "Transport",
      preciseType: "Train longue distance",
      importance: "Ajustable",
      recurrence: "Variable",
      status: "Hors budget",
    },
  ],
  "2026-08": [
    {
      day: 18,
      label: "Bureau pour la maison",
      merchant: "Atelier Noyer",
      amount: -289,
      person: "Manon",
      accountId: "compte-joint",
      flow: "Dépense",
      category: "Achats & maison",
      subcategory: "Équipement",
      preciseType: "Mobilier de bureau",
      importance: "Ajustable",
      recurrence: "Variable",
      status: "Exceptionnel",
    },
    {
      day: 21,
      label: "Retrait espèces à classer",
      merchant: "Retrait distributeur fictif",
      amount: -80,
      person: "Adrien",
      accountId: "especes",
      flow: "Flux technique",
      category: "Espèces à ventiler",
      subcategory: "Retrait à ventiler",
      preciseType: "Retrait sans ventilation",
      importance: "Ajustable",
      recurrence: "Variable",
      status: "À ventiler",
      uncertain: true,
      note: "L’usage final de ce retrait fictif reste à préciser.",
    },
    {
      day: 25,
      label: "Avance familiale reçue",
      merchant: "Avance familiale fictive",
      amount: 500,
      person: "Manon",
      accountId: "manon-courant",
      flow: "Prêt et avance",
      category: "Prêts & avances",
      subcategory: "Avance familiale",
      preciseType: "Avance remboursable",
      importance: "Indispensable",
      recurrence: "Variable",
      status: "Hors budget",
      note: "Ce flux n’est ni un revenu ni une dépense de consommation.",
    },
  ],
};

export const mockOperations: Operation[] = monthKeys.flatMap((month) => {
  const seeds = [
    ...recurringSeeds(month),
    ...variableSeeds(month),
    ...(extras[month] ?? []),
  ];
  return seeds.map((seed, index) => createOperation(month, seed, index));
});

export const mockImportBatches: ImportBatch[] = monthKeys
  .map((month, index) => {
    const operations = mockOperations.filter((operation) => operation.importMonth === month);
    const warnings = operations.filter((operation) => operation.uncertain).length + (index % 3 === 0 ? 1 : 0);
    return {
      id: `IMP-${month.replace("-", "")}`,
      importedAt: `2026-${String(Math.min(index + 2, 8)).padStart(2, "0")}-05T18:30:00`,
      month,
      firstMonth: month,
      lastMonth: month,
      status: warnings ? "Importé avec avertissements" : "Terminé",
      rows: operations.length,
      warnings,
      filename: `operations_${month}.xlsx`,
    } satisfies ImportBatch;
  })
  .reverse();
