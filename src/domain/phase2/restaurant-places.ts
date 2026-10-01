import type { PlannedPlaceOption } from "./planned-places";
import { derivePlannedPlaceRoles } from "./planned-place-rules";

export type RestaurantSuggestion = Readonly<{ source: "google_places"; placeId: string; primaryText: string; secondaryText: string | null }>;
export type PhotoAuthor = Readonly<{ displayName: string; uri: string | null }>;
/** Provider content lives only in the current screen, never in a PlannedExpense. */
export type SelectedRestaurantPlace = Readonly<{ provider: "google_places"; placeId: string; displayName: string;
  formattedAddress: string | null; lat: number | null; lng: number | null; primaryType: string | null; types: readonly string[];
  photoAvailable: boolean; photoAttributions: readonly PhotoAuthor[] }>;
export type RestaurantPhoto = Readonly<{ photoUri: string; authors: readonly PhotoAuthor[] }>;
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
export function normalizeRestaurantSuggestions(raw: unknown): RestaurantSuggestion[] {
  const value = record(raw);
  return (Array.isArray(value.suggestions) ? value.suggestions : []).flatMap((entry) => {
    const p = record(record(entry).placePrediction), format = record(p.structuredFormat);
    const types = Array.isArray(p.types) ? p.types.filter((t): t is string => typeof t === "string") : [];
    const primaryText = text(record(format.mainText).text) ?? text(record(p.text).text);
    return validGooglePlaceId(p.placeId) && primaryText && isRestaurantType(types)
      ? [{ source: "google_places" as const, placeId: p.placeId, primaryText, secondaryText: text(record(format.secondaryText).text) }] : [];
  });
}
export function selectRestaurantCardPhoto(raw: unknown) {
  const value = record(raw);
  return (Array.isArray(value.photos) ? value.photos : []).map(record).find((p) => typeof p.name === "string"
    && /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/u.test(p.name));
}
export function normalizeRestaurantDetails(raw: unknown): SelectedRestaurantPlace {
  const v = record(raw), location = record(v.location), types = Array.isArray(v.types) ? v.types.filter((t): t is string => typeof t === "string") : [];
  if (!validGooglePlaceId(v.id) || !isRestaurantType(types) || !text(record(v.displayName).text)) throw new TypeError("GOOGLE_RESTAURANT_INVALID");
  const photo = selectRestaurantCardPhoto(v);
  return { provider: "google_places", placeId: v.id, displayName: text(record(v.displayName).text)!, formattedAddress: text(v.formattedAddress),
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
