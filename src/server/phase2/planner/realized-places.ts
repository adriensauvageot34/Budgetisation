import "server-only";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";

export type RealizedPlace = Readonly<{
  key: string;
  label: string;
  town?: string;
  address?: string;
  mapsUrl?: string;
  certainty: "confirmed" | "probable" | "town";
}>;

// Public Maps listings for names that can otherwise resolve to another branch.
const verifiedBranches = [
  { name: "boulangerie ange", label: "Boulangerie Ange – Castelnau-le-Lez",
    address: "2 allée Charles R. Darwin, 34170 Castelnau-le-Lez",
    latitude: 43.6198522, longitude: 3.9153171, googlePlaceId: "ChIJbduvq9ClthIRkDTG96lmZ1A" },
  { name: "marie blachere montpellier sud", label: "Marie Blachère – avenue Étienne-Méhul",
    address: "3056 avenue Étienne-Méhul, 34000 Montpellier",
    latitude: 43.5754751, longitude: 3.8588181 },
  { name: "mcdonald s", label: "McDonald’s Croix d’Argent",
    address: "109 avenue de Toulouse, 34070 Montpellier",
    latitude: 43.5892217, longitude: 3.8560867 },
] as const;

const publicMerchantPlaces = [
  { name: "maison regnier", cityPrefix: "chaud", label: "Maison Régnier",
    address: "9 place du Marché, 15110 Chaudes-Aigues", town: "Chaudes-Aigues" },
  { name: "tabac presse loto roujan", cityPrefix: "roujan", label: "Tabac Presse Loto Roujan",
    address: "3 rue du Jeu-de-Ballon, 34320 Roujan", town: "Roujan" },
  { name: "super u", cityPrefix: "serv", label: "Super U / Station U Servian",
    address: "1 avenue du Mas-Viel, 34290 Servian", town: "Servian" },
  { name: "au bon coin", cityPrefix: "pez", label: "Au Bon Coin",
    address: "34 place du 14-Juillet, 34120 Pézenas" },
  { name: "cercle de la vap", cityPrefix: "montpell", label: "Cercle de la Vap",
    address: "504 avenue du Mas d’Argelliers, 34070 Montpellier" },
  { name: "chicken place", cityPrefix: "montpell", label: "Chicken Place",
    address: "80 place Georges-Frêche, 34000 Montpellier" },
  { name: "delacrem", cityPrefix: "montpell", label: "Delacrem", address: "16 rue Saint-Guilhem, 34000 Montpellier" },
  { name: "le petit nice", cityPrefix: "montpe", label: "Le Petit Nice", address: "1 place Jean-Jaurès, 34000 Montpellier" },
  { name: "boulangerie saint julien", cityPrefix: "ser", label: "Boulangerie Saint-Julien",
    address: "6 rue du Coussat, 34290 Servian" },
  { name: "pharmacie polygone", cityPrefix: "m", label: "Pharmacie du Polygone",
    address: "71 rue des Pertuisanes, 34000 Montpellier" },
  { name: "tabac du mas de verchant", cityPrefix: "castel", label: "Tabac du Mas de Verchant",
    address: "rue du Mas-de-Verchant, 34170 Castelnau-le-Lez" },
  { name: "tabac jacques coeur", cityPrefix: "montp", label: "Tabac Jacques Cœur",
    address: "150 rue Élie-Wiesel, 34000 Montpellier" },
] as const;

export function realizedPlaceKey(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/œ/gu, "oe")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const normalized = realizedPlaceKey;

function coordinates(lat: unknown, lng: unknown) {
  const latitude = typeof lat === "number" || typeof lat === "string" && lat.trim() ? Number(lat) : NaN;
  const longitude = typeof lng === "number" || typeof lng === "string" && lng.trim() ? Number(lng) : NaN;
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0)
    ? { latitude, longitude } : undefined;
}

function mapsSearch(query: string, googlePlaceId?: string) {
  const params = new URLSearchParams({ api: "1", query });
  if (googlePlaceId) params.set("query_place_id", googlePlaceId);
  return `https://www.google.com/maps/search/?${params}`;
}

export function realizedPlace(row: CanonicalRecord, certainty: "confirmed" | "probable"): RealizedPlace | undefined {
  const canonicalTown = optionalCanonicalString(row, ["commune"])?.trim();
  const name = optionalCanonicalString(row, ["nom_canonique"])?.trim();
  const subtype = optionalCanonicalString(row, ["sous_type"]) ?? "";
  if (row.private_place !== false || !name || /\bnon (?:identifi[ée]|pr[ée]cis[ée])/iu.test(subtype + " " + name)) {
    return canonicalTown ? realizedTown(canonicalTown) : undefined;
  }

  const coords = coordinates(row.latitude_canonique, row.longitude_canonique);
  const branch = coords && verifiedBranches.find(candidate => candidate.name === normalized(name)
    && Math.hypot(coords.latitude - candidate.latitude, (coords.longitude - candidate.longitude) * Math.cos(coords.latitude * Math.PI / 180)) < .0025);
  const canonicalAddress = optionalCanonicalString(row, ["adresse"])?.trim();
  const clausade = /^domaine (?:de )?la clausade$/u.test(normalized(name)) && (!canonicalTown || normalized(canonicalTown) === "mauguio");
  const town = canonicalTown || (clausade ? "Mauguio" : undefined);
  const address = canonicalAddress || branch?.address || (clausade ? "Route de Mudaison, 34130 Mauguio" : undefined);
  const label = canonicalAddress ? name : branch?.label ?? name;
  const publicAddressQuery = [label, address, canonicalAddress || !address ? town : undefined].filter(Boolean).join(", ");
  const query = address || !coords ? publicAddressQuery : `${coords.latitude},${coords.longitude}`;
  return {
    key: String(row.place_id), label, ...(town ? { town } : {}), ...(address ? { address } : {}),
    certainty, mapsUrl: mapsSearch(query, !canonicalAddress && branch && "googlePlaceId" in branch ? branch.googlePlaceId : undefined),
  };
}

export function realizedTown(town: string): RealizedPlace {
  return { key: `town:${normalized(town)}`, label: town, town, certainty: "town", mapsUrl: mapsSearch(`${town}, France`) };
}

export function merchantPlaceAlias(aliases: readonly CanonicalRecord[], descriptor: string, day: string) {
  const bank = bankText(descriptor);
  const matches = new Map<string, "confirmed" | "probable">();
  for (const alias of aliases) {
    const id = optionalCanonicalString(alias, ["place_id"]);
    const pattern = optionalCanonicalString(alias, ["bank_descriptor_pattern"]);
    const start = optionalCanonicalString(alias, ["valid_from"]);
    const end = optionalCanonicalString(alias, ["valid_to"]);
    if (!id || !pattern || start && day < start || end && day > end) continue;
    const prefix = normalized(pattern);
    if (!prefix || (pattern.endsWith("%") ? !bank.startsWith(prefix) : bank !== prefix)) continue;
    if (matches.get(id) !== "confirmed") matches.set(id, alias.validation_status === "Confirmé" ? "confirmed" : "probable");
  }
  const match = matches.size === 1 ? [...matches][0] : undefined;
  return match && { id: match[0], certainty: match[1] };
}

function bankText(descriptor: string) {
  return normalized(descriptor).replace(/^paiement par carte x\d+ /u, "");
}

export function probableMerchantPlace(name: string, descriptor: string): RealizedPlace | undefined {
  const merchant = normalized(name);
  const bank = bankText(descriptor);
  const locationWords = bank.split(" ").filter(word => /^\p{L}+$/u.test(word));
  const match = publicMerchantPlaces.find(place => place.name === merchant
    && locationWords.slice(0, 5).some(word => place.cityPrefix.length === 1
      ? word === place.cityPrefix : word.startsWith(place.cityPrefix))
    || place.name === "super u" && merchant === place.name && /\bmarche u ser\b/u.test(bank));
  if (!match) return undefined;
  return { key: `public:${normalized(match.label)}`, label: match.label, address: match.address,
    ...("town" in match ? { town: match.town } : {}),
    mapsUrl: mapsSearch(`${match.label}, ${match.address}`), certainty: "probable" };
}

export function distinctRealizedPlaces(places: readonly RealizedPlace[]) {
  const distinct = new Map<string, RealizedPlace>();
  for (const place of places) {
    const previous = distinct.get(place.key);
    if (!previous || place.certainty === "confirmed") distinct.set(place.key, place);
  }
  return [...distinct.values()];
}

export function cashActivityPlace(label: string): RealizedPlace | undefined {
  // This merchant label explicitly names the salon as the cash use's recipient.
  if (normalized(label) !== "retraits d especes associes a dali barber") return undefined;
  const name = "Dali Barber", address = "673 chemin de Moularès, 34000 Montpellier";
  return { key: "public:dali-barber-montpellier", label: name, address,
    mapsUrl: mapsSearch(`${name}, ${address}`), certainty: "confirmed" };
}
