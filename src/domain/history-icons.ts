import type { LucideIcon } from "lucide-react";
import type { LifeLayer } from "@/domain/budget";
import {
  BadgeEuro,
  Banknote,
  BedDouble,
  Bolt,
  BriefcaseBusiness,
  Bus,
  CakeSlice,
  CalendarDays,
  CarFront,
  Cigarette,
  CircleHelp,
  CircleParking,
  Coffee,
  Cross,
  FerrisWheel,
  Fuel,
  Gift,
  House,
  KeyRound,
  Landmark,
  MapPinned,
  Monitor,
  Music,
  Package,
  PawPrint,
  Pill,
  Plane,
  RefreshCcw,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Stethoscope,
  Ticket,
  Utensils,
  WalletCards,
  Wrench,
} from "lucide-react";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

const familyIcons: Record<string, LucideIcon> = {
  "achats a preciser": CircleHelp,
  "achats personnels": ShoppingBag,
  alimentation: ShoppingBasket,
  animaux: PawPrint,
  assurances: ShieldCheck,
  banque: Landmark,
  cadeaux: Gift,
  "culture & evenements": Ticket,
  especes: Banknote,
  habillement: Shirt,
  "jardin & animaux": Sprout,
  logement: House,
  "loisirs & activites": FerrisWheel,
  "maison & quotidien": Sofa,
  numerique: Monitor,
  "permis de conduire": CarFront,
  remboursements: RefreshCcw,
  restauration: Utensils,
  revenus: BriefcaseBusiness,
  sante: Stethoscope,
  "soins personnels": Scissors,
  "tabac & vape": Cigarette,
  telecom: Smartphone,
  transferts: WalletCards,
  "transport & voiture": CarFront,
  voyages: Plane,
};

const categoryIcons: Record<string, LucideIcon> = {
  "achat de voiture": CarFront,
  "activite de loisirs": FerrisWheel,
  "assurance automobile": ShieldCheck,
  "assurance habitation": ShieldCheck,
  "bar / soiree": Music,
  boulangerie: ShoppingBasket,
  "bricolage / equipement": Wrench,
  "cafe / salon de the": Coffee,
  "cafe au travail": Coffee,
  carburant: Fuel,
  "courses alimentaires": ShoppingBasket,
  eau: House,
  electricite: Bolt,
  "examen du code": BadgeEuro,
  hebergement: BedDouble,
  "jardinerie ou animalerie": PawPrint,
  "lecons / forfait ornikar": CarFront,
  loyer: KeyRound,
  peage: CarFront,
  pharmacie: Pill,
  "pieces / entretien automobile": Wrench,
  "restaurant / bar": Utensils,
  "restaurant / brasserie": Utensils,
  "restaurant self-service": Utensils,
  stationnement: CircleParking,
  train: Bus,
  "transports en commun": Bus,
  "vape / cigarette electronique": Cigarette,
  vetements: Shirt,
  "visite touristique / salins": MapPinned,
  "vtc / taxi": CarFront,
};

const eventIcons: Array<[string, LucideIcon]> = [
  ["voyage", Plane],
  ["vacance", Plane],
  ["weekend", MapPinned],
  ["week-end", MapPinned],
  ["anniversaire", CakeSlice],
  ["soiree", CakeSlice],
  ["festival", Music],
  ["concert", Music],
  ["musique", Music],
  ["cadeau", Gift],
  ["noel", Gift],
  ["reparation", Wrench],
  ["incident", Wrench],
  ["projet", Package],
  ["achat", Package],
];

export function getFamilyIcon(family?: string | null): LucideIcon {
  return familyIcons[normalize(family)] ?? WalletCards;
}

export function getCategoryIcon(
  category?: string | null,
  family?: string | null,
): LucideIcon {
  return categoryIcons[normalize(category)] ?? getFamilyIcon(family);
}

export function getEventIcon(event?: string | null): LucideIcon {
  const normalized = normalize(event);
  return eventIcons.find(([keyword]) => normalized.includes(keyword))?.[1] ??
    CalendarDays;
}

export function getHistoryIcon(
  kind: "family" | "category" | "event",
  value?: string | null,
  family?: string | null,
) {
  if (kind === "event") return getEventIcon(value);
  if (kind === "category") return getCategoryIcon(value, family);
  return getFamilyIcon(value);
}

export function getLifeLayerIcon(layer: LifeLayer): LucideIcon {
  if (layer === "Routine") return House;
  if (layer === "Moment") return Sparkles;
  if (layer === "Ponctuel") return Package;
  if (layer === "Imprévu") return Wrench;
  return CircleHelp;
}

export const historyPresentationIcons = {
  fallback: WalletCards,
  eventFallback: CalendarDays,
  exceptional: Cross,
  highlight: Sparkles,
};
