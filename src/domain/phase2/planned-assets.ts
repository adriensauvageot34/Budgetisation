/** Versioned suggestions for the prospective builder. No historical or database authority. */
export const PLANNED_EXPENSE_SUBTYPES = {
  outing: ["bar", "club_festival", "house_party", "other_outing"],
  food: ["groceries", "restaurant", "fast_food", "work_meal"],
  visit_trip: ["family_visit", "friend_visit", "trip_stay", "other_trip"],
  activity: ["cinema", "bowling", "karting", "mini_golf", "billiards", "escape_game", "canoe_kayak", "pool", "spa", "theme_park", "show", "match", "sport", "fishing", "creative_workshop", "photo_outing", "other_activity"],
  purchase: ["beauty", "clothing", "household", "home_equipment", "gift", "tech", "automotive", "other_purchase"],
  other: [],
} as const;

export type PlannedExpenseFamily = keyof typeof PLANNED_EXPENSE_SUBTYPES;
export type QuantityStrategy = "PER_PERSON" | "SHARED" | "FIXED" | "MANUAL";
export const ASSET_MODULES = ["bar", "club", "house_party", "groceries", "restaurant", "fast_food", "work_meal",
  "transport", "visit_family", "visit_friend", "trip", "activity", "fishing", "beauty", "clothing",
  "household", "home", "gift", "tech", "automotive", "other"] as const;
export type AssetModule = typeof ASSET_MODULES[number];
export type PlannedAsset = Readonly<{ assetKey: string; module: AssetModule; label: string; icon: string;
  quantityStrategy: QuantityStrategy; defaultQuantity?: string; defaultUnitAmount?: string;
  fundingEligibility: "MEAL" | "BANK" }>;

export const PLANNED_FAMILIES: readonly { key: PlannedExpenseFamily; label: string; icon: string; hint: string }[] = [
  { key: "outing", label: "Sortie / soirée", icon: "🎉", hint: "Bar, club, soirée" },
  { key: "food", label: "Alimentation / repas", icon: "🍽️", hint: "Courses et repas" },
  { key: "visit_trip", label: "Déplacement / visite", icon: "🚗", hint: "Famille, amis, séjour" },
  { key: "activity", label: "Activité / événement", icon: "🎟️", hint: "Loisirs et sorties" },
  { key: "purchase", label: "Achat", icon: "🛍️", hint: "Objets et cadeaux" },
  { key: "other", label: "Autre", icon: "➕", hint: "Autre projet du mois" },
];

export const PLANNED_SUBTYPE_LABELS: Record<PlannedExpenseFamily, readonly { key: string; label: string }[]> = {
  outing: [{ key: "bar", label: "Bar" }, { key: "club_festival", label: "Club / techno / festival" }, { key: "house_party", label: "Soirée à la maison" }, { key: "other_outing", label: "Autre sortie" }],
  food: [{ key: "groceries", label: "Courses" }, { key: "restaurant", label: "Restaurant" }, { key: "fast_food", label: "Fast-food / snack" }, { key: "work_meal", label: "Repas au travail" }],
  visit_trip: [{ key: "family_visit", label: "Visite famille" }, { key: "friend_visit", label: "Visite amis" }, { key: "trip_stay", label: "Voyage / séjour" }, { key: "other_trip", label: "Autre déplacement" }],
  activity: PLANNED_EXPENSE_SUBTYPES.activity.map((key) => ({ key, label: ({ cinema: "Cinéma", bowling: "Bowling", karting: "Karting", mini_golf: "Mini-golf", billiards: "Billard", escape_game: "Escape game", canoe_kayak: "Canoë / kayak", pool: "Piscine", spa: "Spa", theme_park: "Parc d’attractions", show: "Spectacle", match: "Match", sport: "Sport", fishing: "Pêche", creative_workshop: "Atelier / activité créative", photo_outing: "Sortie photo", other_activity: "Autre activité" } as Record<string, string>)[key] })),
  purchase: [{ key: "beauty", label: "Beauté / soin" }, { key: "clothing", label: "Vêtements" }, { key: "household", label: "Produits ménagers" }, { key: "home_equipment", label: "Maison / équipement" }, { key: "gift", label: "Cadeau" }, { key: "tech", label: "Tech / matériel" }, { key: "automotive", label: "Automobile" }, { key: "other_purchase", label: "Autre achat" }],
  other: [],
};

const assets: PlannedAsset[] = [];
const add = (module: AssetModule, key: string, label: string, icon: string, quantityStrategy: QuantityStrategy = "MANUAL",
  fundingEligibility: "MEAL" | "BANK" = "BANK", options: Partial<Pick<PlannedAsset, "defaultQuantity" | "defaultUnitAmount">> = {}) => {
  assets.push({ assetKey: `${module}:${key}`, module, label, icon, quantityStrategy, fundingEligibility, ...options });
};
const many = (module: AssetModule, rows: readonly [string, string, string, QuantityStrategy?, ("MEAL" | "BANK")?][]) =>
  rows.forEach(([key, label, icon, strategy, funding]) => add(module, key, label, icon, strategy, funding));

many("bar", [["beer", "Bière", "🍺", "PER_PERSON"], ["wine", "Verre de vin", "🍷", "PER_PERSON"], ["cocktail", "Cocktail", "🍹", "PER_PERSON"], ["shot", "Shot", "🥃", "PER_PERSON"], ["tapas", "Planche / tapas", "🍽️", "SHARED"], ["parking", "Parking", "🚗"], ["entry", "Entrée", "🎫"]]);
many("club", [["ticket", "Ticket / entrée", "🎫", "PER_PERSON"], ["alcohol", "Verre alcool", "🥃", "PER_PERSON"], ["shot", "Shot", "🥃", "PER_PERSON"], ["soft", "Soft", "🥤", "PER_PERSON"], ["water", "Eau", "💧", "PER_PERSON"], ["food", "Nourriture sur place", "🍔", "PER_PERSON", "MEAL"], ["uber_out", "Uber aller", "🚕"], ["uber_back", "Uber retour", "🚕"], ["parking", "Parking", "🚗"], ["cloakroom", "Vestiaire", "🔒"]]);
add("house_party", "vodka", "Vodka", "🍾", "FIXED", "BANK", { defaultQuantity: "1", defaultUnitAmount: "16.00" });
add("house_party", "crazy_tiger", "Crazy Tiger", "🥤", "FIXED", "BANK", { defaultQuantity: "2", defaultUnitAmount: "3.00" });
many("house_party", [["mixer", "Diluant", "🍹"], ["beer", "Bière", "🍺"], ["wine", "Vin", "🍷"], ["rum", "Rhum", "🍾"], ["snack", "Snack", "🍕", "SHARED", "MEAL"], ["chips", "Chips", "🥨", "SHARED", "MEAL"]]);
many("groceries", [["food", "Courses alimentaires", "🛒", "MANUAL", "MEAL"], ["meat", "Viande", "🥩", "MANUAL", "MEAL"], ["fish", "Poisson", "🐟", "MANUAL", "MEAL"], ["produce", "Fruits / légumes", "🥦", "MANUAL", "MEAL"], ["fresh", "Produits frais", "🥛", "MANUAL", "MEAL"], ["pantry", "Féculents / épicerie", "🍝", "MANUAL", "MEAL"], ["drinks", "Boissons", "🧃", "MANUAL", "MEAL"], ["snacks", "Goûters", "🍪", "MANUAL", "MEAL"], ["dessert", "Dessert à apporter", "🍰", "MANUAL", "MEAL"], ["hygiene", "Hygiène / papier", "🧻"], ["special_meal", "Courses pour repas spécial / amis", "🍽️", "MANUAL", "MEAL"]]);
many("restaurant", [["starter", "Entrée", "🥗", "PER_PERSON", "MEAL"], ["main", "Plat", "🍝", "PER_PERSON", "MEAL"], ["dessert", "Dessert", "🍰", "PER_PERSON", "MEAL"], ["wine_glass", "Verre de vin", "🍷"], ["wine_bottle", "Bouteille de vin", "🍾"], ["beer", "Bière", "🍺"], ["cocktail", "Cocktail", "🍹"], ["soft", "Soft", "🥤", "PER_PERSON", "MEAL"], ["coffee", "Café", "☕", "PER_PERSON", "MEAL"], ["water", "Eau", "💧", "SHARED", "MEAL"], ["uber", "Uber", "🚕"], ["parking", "Parking", "🚗"]]);
many("fast_food", [["burger", "Burger", "🍔", "PER_PERSON", "MEAL"], ["thai", "Thaï", "🍜", "PER_PERSON", "MEAL"], ["fries", "Frites", "🍟", "PER_PERSON", "MEAL"], ["drink", "Boisson", "🥤", "PER_PERSON", "MEAL"], ["tacos", "Tacos", "🌯", "PER_PERSON", "MEAL"], ["kebab", "Kebab", "🥙", "PER_PERSON", "MEAL"], ["pizza", "Pizza", "🍕", "SHARED", "MEAL"], ["chicken", "Poulet", "🍗", "PER_PERSON", "MEAL"], ["sandwich", "Sandwich", "🥪", "PER_PERSON", "MEAL"], ["dessert", "Dessert", "🍰", "PER_PERSON", "MEAL"], ["delivery_fee", "Frais de livraison", "🚚"], ["service_fee", "Frais de service", "💸"]]);
many("work_meal", [["bakery", "Boulangerie", "🥖", "FIXED", "MEAL"], ["grand_frais", "Grand Frais", "🛒", "FIXED", "MEAL"], ["mcdo", "McDo", "🍔", "FIXED", "MEAL"]]);
many("transport", [["fuel_usage", "Coût carburant estimé", "⛽"], ["toll", "Péage", "🛣️"], ["parking", "Parking", "🅿️"], ["train", "Train", "🚆", "PER_PERSON"], ["bus", "Bus", "🚌", "PER_PERSON"], ["uber", "Uber / taxi", "🚕"]]);
many("visit_family", [["breakfast", "Petit-déjeuner", "🥐", "PER_PERSON", "MEAL"], ["brought_groceries", "Courses apportées", "🛒", "SHARED", "MEAL"]]);
many("visit_friend", [["brought_drink", "Boisson apportée", "🍾"], ["brought_food", "Nourriture apportée", "🍕", "SHARED", "MEAL"], ["coffee", "Café", "☕", "PER_PERSON", "MEAL"]]);
many("trip", [["flight", "Avion", "✈️", "PER_PERSON"], ["rental_car", "Location voiture", "🚗"], ["rental_scooter", "Location scooter", "🛵"], ["hotel", "Hôtel", "🏨"], ["airbnb", "Airbnb", "🏠"], ["breakfast", "Petit-déjeuner", "☕", "PER_PERSON", "MEAL"], ["visits", "Visites", "🏛️", "PER_PERSON"], ["baggage", "Bagage", "🧳"], ["fees", "Frais divers", "💳"]]);
many("activity", [["entry", "Entrée", "🎫", "PER_PERSON"], ["ticket", "Billet", "🎟️", "PER_PERSON"], ["drink", "Boissons", "🥤", "PER_PERSON", "MEAL"]]);
many("fishing", [["bait", "Appâts", "🪱"]]);
many("beauty", [["mascara", "Mascara", "👁️"], ["eyebrow_pencil", "Crayon à sourcils", "✏️"], ["eyeliner", "Eyeliner", "👁️"], ["lipstick", "Rouge à lèvres", "💄"], ["gloss", "Gloss", "💋"], ["foundation", "Fond de teint", "🧴"], ["face_cream", "Crème visage", "🧴"], ["body_cream", "Crème corps", "🧴"], ["toothpaste", "Dentifrice", "🦷"], ["face_cleanser", "Nettoyant visage", "🧼"], ["makeup_remover", "Démaquillant", "🧴"], ["nail_polish", "Vernis", "💅"], ["shampoo", "Shampoing", "🧴"], ["conditioner", "Après-shampoing", "🧴"], ["shower_gel", "Gel douche", "🧴"], ["cotton_swabs", "Coton-tiges", "👂"], ["razor_blades", "Lames de rasoir", "🪒"], ["hair_wax", "Cire coiffante", "💈"], ["perfume", "Parfum", "🌸"], ["hairdresser", "Coiffeur", "✂️"], ["deodorant", "Déodorant", "🧴"]]);
many("clothing", [["tshirt", "T-shirt", "👕"], ["shirt", "Chemise", "👔"], ["pants", "Pantalon", "👖"], ["shorts", "Short", "🩳"], ["dress", "Robe", "👗"], ["jacket", "Veste", "🧥"], ["coat", "Manteau", "🧥"], ["shoes", "Chaussures", "👟"], ["sandals", "Sandales", "🩴"], ["socks", "Chaussettes", "🧦"], ["underwear", "Sous-vêtements", "🩲"], ["cap", "Casquette", "🧢"], ["bag", "Sac", "👜"], ["glasses", "Lunettes", "🕶️"], ["jewelry", "Bijou", "💍"], ["costume", "Déguisement de soirée", "🥸"], ["delivery_fee", "Frais de livraison", "🚚"], ["service_fee", "Frais de service", "💸"]]);
many("household", [["laundry", "Lessive", "🧴"], ["dish_soap", "Liquide vaisselle", "🍽️"], ["dishwasher", "Pastilles lave-vaisselle", "🫧"], ["sponge", "Éponges", "🧽"], ["floor", "Produit sol", "🧹"], ["toilet", "Produit WC", "🚽"], ["windows", "Produit vitres", "🪟"], ["trash_bags", "Sacs poubelle", "🗑️"], ["toilet_paper", "Papier toilette", "🧻"], ["paper_towels", "Essuie-tout", "🧻"], ["air_freshener", "Désodorisant", "🌬️"]]);
many("home", [["lamp", "Lampe", "💡"], ["furniture", "Meuble", "🛋️"], ["bedding", "Literie", "🛏️"], ["storage", "Rangement", "🧺"], ["decor", "Décoration", "🖼️"], ["plant", "Plante", "🪴"], ["kitchen", "Cuisine", "🍳"], ["dishes", "Vaisselle", "🍽️"], ["diy", "Bricolage", "🔨"], ["electric", "Électricité / multiprise", "🔌"]]);
many("gift", [["flowers", "Fleurs", "💐"], ["jewelry", "Bijou", "💍"], ["clothes", "Vêtement", "👕"], ["chocolate", "Chocolats", "🍫"], ["bottle", "Bouteille", "🍾"], ["ticket", "Billet / spectacle", "🎫"], ["gift_card", "Carte cadeau", "🎁"], ["money", "Argent", "💶"], ["book", "Livre", "📚"], ["game", "Jeu", "🎮"], ["toy", "Jouet", "🧸"], ["personalized", "Cadeau personnalisé", "📸"]]);
many("tech", [["charger", "Chargeur", "🔌"], ["cable", "Câble", "🔌"], ["lighting", "Éclairage", "💡"], ["video_game", "Jeu vidéo", "🎮"]]);
many("automotive", [["tires", "Pneus", "🛞"], ["motor_oil", "Huile moteur", "🧴"], ["coolant", "Liquide de refroidissement", "🌡️"], ["washer_fluid", "Liquide lave-glace", "💧"], ["bulbs", "Ampoules", "💡"], ["battery", "Batterie", "🔋"], ["wash", "Lavage", "🧼"], ["part", "Pièce", "🔧"]]);
many("other", [["administrative", "Administratif", "📄"], ["fee", "Frais", "💸"], ["contribution", "Participation", "🤝"]]);

export const ASSET_CATALOG: readonly PlannedAsset[] = assets;
export const PLANNED_ASSETS = ASSET_CATALOG;
// An aggregate can be persisted only while none of its replacement details is active in the same module path.
export const ASSET_AGGREGATE_DESCENDANTS: Readonly<Record<string, readonly string[]>> = {
  "groceries:food": ["groceries:meat", "groceries:fish", "groceries:produce", "groceries:fresh",
    "groceries:pantry", "groceries:drinks", "groceries:snacks"],
};
export const plannedAsset = (key: string): PlannedAsset | undefined => assets.find((asset) => asset.assetKey === key);
export const assetsForModule = (module: AssetModule): readonly PlannedAsset[] => assets.filter((asset) => asset.module === module);
export const suggestedAssetQuantity = (asset: PlannedAsset, namedParticipants: number, additionalGuests = 0): string =>
  asset.defaultQuantity ?? (asset.quantityStrategy === "PER_PERSON"
    ? String(Math.max(1, namedParticipants + additionalGuests)) : "1");
export function rootAssetModule(family: PlannedExpenseFamily, subtype: string | null): AssetModule {
  if (family === "outing") return subtype === "club_festival" ? "club" : subtype === "house_party" ? "house_party" : subtype === "bar" ? "bar" : "other";
  if (family === "food") return subtype === "groceries" ? "groceries" : subtype === "restaurant" ? "restaurant" : subtype === "work_meal" ? "work_meal" : "fast_food";
  if (family === "visit_trip") return subtype === "family_visit" ? "visit_family" : subtype === "friend_visit" ? "visit_friend" : subtype === "trip_stay" ? "trip" : "transport";
  if (family === "activity") return "activity";
  if (family === "purchase") return subtype === "home_equipment" ? "home" : subtype === "clothing" ? "clothing" : subtype === "household" ? "household" : subtype === "gift" ? "gift" : subtype === "tech" ? "tech" : subtype === "automotive" ? "automotive" : subtype === "beauty" ? "beauty" : "other";
  return "other";
}
