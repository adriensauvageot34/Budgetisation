import type { PlannedPlaceOption } from "./planned-places";
import { derivePlannedPlaceRoles } from "./planned-place-rules";

export type RestaurantSuggestion = Readonly<{ source: "google_places"; placeId: string; primaryText: string; secondaryText: string | null }>;
export type PhotoAuthor = Readonly<{ displayName: string; uri: string | null }>;
/** Provider content lives only in the current screen, never in a PlannedExpense. */
export type SelectedRestaurantPlace = Readonly<{ provider: "google_places"; placeId: string; displayName: string;
  city?: string;
  formattedAddress: string | null; lat: number | null; lng: number | null; primaryType: string | null; types: readonly string[];
  photoAvailable: boolean; photoAttributions: readonly PhotoAuthor[] }>;
export type RestaurantPhoto = Readonly<{ photoIndex: number; photoUri: string; authors: readonly PhotoAuthor[]; googleMapsUri: string | null }>;
export type ProjectPlaceKind = "RESTAURANT" | "ACTIVITY" | "VENUE" | "DESTINATION" | "RETAIL";
export function projectPlaceTypeCompatible(types: readonly string[], kind: ProjectPlaceKind) {
  if (kind === "RESTAURANT") return isRestaurantType(types);
  if (kind === "DESTINATION") return types.some(t => ["locality", "administrative_area_level_1", "administrative_area_level_2", "natural_feature", "tourist_attraction"].includes(t));
  if (kind === "RETAIL") return types.some(t => t.endsWith("store") || ["shopping_mall", "supermarket", "pharmacy", "car_repair", "beauty_salon"].includes(t));
  if (kind === "ACTIVITY") return types.some(t => ["movie_theater", "bowling_alley", "amusement_park", "aquarium", "museum", "park", "spa", "stadium", "tourist_attraction", "sports_complex", "performing_arts_theater", "event_venue"].includes(t));
  return types.some(t => ["bar", "night_club", "event_venue", "concert_hall", "performing_arts_theater", "stadium"].includes(t));
}
export type UsedRestaurantRef = Readonly<{ googlePlaceId: string; label: string; city: string }>;
export const validGooglePlaceId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{5,255}$/u.test(value);
export const isRestaurantType = (types: readonly string[]) => types.some((type) => type === "restaurant" || type.endsWith("_restaurant")
  || ["cafe", "coffee_shop", "bar_and_grill", "meal_takeaway", "meal_delivery", "food_court", "cafeteria", "diner"].includes(type));
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
export function photoAuthors(value: unknown): PhotoAuthor[] {
  return (Array.isArray(value) ? value : []).flatMap((v) => {
    const author = record(v), name = text(author.displayName), uri = text(author.uri);
    return name ? [{ displayName: name, uri: uri && /^https:\/\//u.test(uri) ? uri : null }] : [];
  });
}
export function normalizeRestaurantSuggestions(raw: unknown, kind: ProjectPlaceKind = "RESTAURANT"): RestaurantSuggestion[] {
  const value = record(raw);
  return (Array.isArray(value.suggestions) ? value.suggestions : []).flatMap((entry) => {
    const p = record(record(entry).placePrediction), format = record(p.structuredFormat);
    const types = Array.isArray(p.types) ? p.types.filter((t): t is string => typeof t === "string") : [];
    const primaryText = text(record(format.mainText).text) ?? text(record(p.text).text);
    return validGooglePlaceId(p.placeId) && primaryText && projectPlaceTypeCompatible(types, kind)
      ? [{ source: "google_places" as const, placeId: p.placeId, primaryText, secondaryText: text(record(format.secondaryText).text) }] : [];
  });
}
export function selectRestaurantCardPhoto(raw: unknown) {
  return restaurantPhotoCandidates(raw)[0];
}
/** Prefer a usable landscape/resolution, without pretending to infer subject or composition. Original index is user intent. */
export function restaurantPhotoCandidates(raw: unknown, placeId?: string) {
  const photos = (Array.isArray(record(raw).photos) ? record(raw).photos : []) as unknown[];
  const score = (p: Record<string, unknown>) => {
    const width = Number(p.widthPx), height = Number(p.heightPx);
    return width > 0 && height > 0 ? Math.min(width * height, 4_000_000) / (1 + Math.abs(Math.log(width / height / (16 / 9))) * 2) : 0;
  };
  return photos.slice(0, 10).map((p, photoIndex): Record<string, unknown> & { photoIndex: number } => ({ ...record(p), photoIndex })).filter(p => typeof p.name === "string"
    && /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/u.test(p.name) && (!placeId || p.name.startsWith(`places/${placeId}/photos/`)))
    .sort((a, b) => score(b) - score(a) || a.photoIndex - b.photoIndex);
}
export function normalizeRestaurantDetails(raw: unknown, kind: ProjectPlaceKind = "RESTAURANT"): SelectedRestaurantPlace {
  const v = record(raw), location = record(v.location), types = Array.isArray(v.types) ? v.types.filter((t): t is string => typeof t === "string") : [];
  if (!validGooglePlaceId(v.id) || !projectPlaceTypeCompatible(types, kind) || !text(record(v.displayName).text)) throw new TypeError("GOOGLE_RESTAURANT_INVALID");
  const photo = selectRestaurantCardPhoto(v);
  return { provider: "google_places", placeId: v.id, displayName: text(record(v.displayName).text)!, formattedAddress: text(v.formattedAddress),
    ...(() => { const city = (Array.isArray(v.addressComponents) ? v.addressComponents : []).map(record).find(c => Array.isArray(c.types) && c.types.includes("locality")); return city && text(city.longText) ? { city: text(city.longText)! } : {}; })(),
    lat: typeof location.latitude === "number" && Math.abs(location.latitude) <= 90 ? location.latitude : null,
    lng: typeof location.longitude === "number" && Math.abs(location.longitude) <= 180 ? location.longitude : null,
    primaryType: text(v.primaryType), types, photoAvailable: !!photo, photoAttributions: photoAuthors(photo?.authorAttributions) };
}
export function knownRestaurantSuggestions(places: readonly PlannedPlaceOption[], city: string, query = "") {
  const normalized = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("fr");
  return places.filter((p) => !p.privatePlace && normalized(p.commune ?? "") === normalized(city)
    && derivePlannedPlaceRoles(p).includes("RESTAURANT") && normalized(p.name).includes(normalized(query)))
    .sort((a, b) => (b.visits12Months ?? 0) - (a.visits12Months ?? 0) || (b.lastVisitDate ?? "").localeCompare(a.lastVisitDate ?? "") || a.name.localeCompare(b.name, "fr"));
}
export const deduplicateRestaurantSuggestions = (google: readonly RestaurantSuggestion[], known: readonly PlannedPlaceOption[], used: readonly UsedRestaurantRef[] = []) =>
  google.filter((p) => !known.some((local) => local.googlePlaceId === p.placeId) && !used.some((local) => local.googlePlaceId === p.placeId));
export function usedRestaurantSuggestions(refs: readonly UsedRestaurantRef[], city: string, query: string) {
  const seen = new Set<string>();
  return refs.filter((ref) => ref.city.toLocaleLowerCase("fr") === city.toLocaleLowerCase("fr")
    && ref.label.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))
    && !seen.has(ref.googlePlaceId) && !!seen.add(ref.googlePlaceId));
}

/** One token per search session; request identity also controls debounce and stale responses. */
export class RestaurantSearchSession {
  private token: string | null = null;
  private last = "";
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly makeToken = () => crypto.randomUUID()) {}
  schedule(query: string, city: string, search: (request: { input: string; city: string; sessionToken: string }, current: () => boolean) => void) {
    this.cancel();
    const input = query.trim(), identity = JSON.stringify([input, city]);
    if (input.length < 2) { this.last = ""; return; }
    if (identity === this.last) return;
    const sequence = this.sequence, sessionToken = this.token ??= this.makeToken();
    this.timer = setTimeout(() => { this.last = identity; this.timer = null;
      search({ input, city, sessionToken }, () => this.sequence === sequence); }, 300);
  }
  sessionToken() { return this.token ??= this.makeToken(); }
  complete() { this.cancel(); this.token = null; this.last = ""; }
  cancel() { this.sequence++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
}
