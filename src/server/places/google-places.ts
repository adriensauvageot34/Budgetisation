import "server-only";
import { isRestaurantType, normalizeRestaurantDetails, normalizeRestaurantSuggestions, photoAuthors, restaurantPhotoCandidates, validGooglePlaceId } from "@/domain/phase2/restaurant-places";
import { TomTomRouteProvider } from "@/server/phase2/planned-car-providers";
import type { ProjectPlaceKind } from "@/domain/phase2/restaurant-places";

export const AUTOCOMPLETE_MASK = "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types";
export const DETAILS_MASK = "id,displayName,formattedAddress,addressComponents,location,primaryType,types,photos";
const PHOTO_MASK = "id,types,photos";
export class GooglePlacesError extends Error {
  constructor(public readonly status = 503) { super("Recherche de restaurants indisponible. Vous pouvez saisir le restaurant manuellement."); }
}
let rejectedKeyUntil = 0;
type Options = { fetch?: typeof fetch; key?: string; geocode?: (city: string) => Promise<{ latitude: number; longitude: number }> };
export class GoogleRestaurantPlaces {
  constructor(private readonly options: Options = {}) {}
  private async request(path: string, mask?: string, body?: unknown): Promise<unknown> {
    const key = this.options.key ?? process.env.GOOGLE_MAPS_API_KEY;
    if (!key || !this.options.fetch && rejectedKeyUntil > Date.now()) throw new GooglePlacesError();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await (this.options.fetch ?? fetch)(`https://places.googleapis.com/v1/${path}`, {
          method: body === undefined ? "GET" : "POST", cache: "no-store", signal: AbortSignal.timeout(4500),
          headers: { "X-Goog-Api-Key": key, ...(mask ? { "X-Goog-FieldMask": mask } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (response.ok) return await response.json();
        if ([401, 403].includes(response.status) && !this.options.fetch) rejectedKeyUntil = Date.now() + 300_000;
        if (response.status === 404) throw new GooglePlacesError(404);
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) { await new Promise((r) => setTimeout(r, 200)); continue; }
        throw new GooglePlacesError();
      } catch (error) {
        if (error instanceof GooglePlacesError || attempt) throw error instanceof GooglePlacesError ? error : new GooglePlacesError();
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw new GooglePlacesError();
  }
  async autocomplete(input: string, sessionToken: string, city: string, kind: ProjectPlaceKind = "RESTAURANT") {
    const local = city.trim().toLocaleLowerCase("fr") === "montpellier";
    let center = local ? { latitude: 43.6108, longitude: 3.8767 } : undefined;
    if (!local) try { center = await (this.options.geocode ?? ((city) => new TomTomRouteProvider().geocode(`${city}, France`)))(city); } catch { /* Town text still guides search if city geocoding is unavailable. */ }
    const raw = await this.request("places:autocomplete", AUTOCOMPLETE_MASK, {
      input: center ? input : `${input}, ${city}`, sessionToken, languageCode: "fr", regionCode: "fr", includedRegionCodes: ["fr"],
      ...(center ? { locationBias: { circle: { center: { latitude: center.latitude, longitude: center.longitude }, radius: 20000 } } } : {}),
    });
    // Filtering response types includes specialized *_restaurant types without an incomplete primary-type restriction.
    return normalizeRestaurantSuggestions(raw, kind);
  }
  async details(placeId: string, sessionToken?: string, kind: ProjectPlaceKind = "RESTAURANT") {
    if (!validGooglePlaceId(placeId)) throw new TypeError("GOOGLE_PLACE_ID_INVALID");
    const query = new URLSearchParams({ languageCode: "fr", regionCode: "fr", ...(sessionToken ? { sessionToken } : {}) });
    try { return normalizeRestaurantDetails(await this.request(`places/${placeId}?${query}`, DETAILS_MASK), kind); }
    catch (error) { throw error instanceof GooglePlacesError ? error : new GooglePlacesError(422); }
  }
  private async photoCandidates(placeId: string) {
    if (!validGooglePlaceId(placeId)) throw new TypeError("GOOGLE_PLACE_ID_INVALID");
    const raw = await this.request(`places/${placeId}`, PHOTO_MASK) as { types?: string[] };
    return Array.isArray(raw.types) && isRestaurantType(raw.types) ? restaurantPhotoCandidates(raw, placeId) : [];
  }
  private async photoMedia(photo: ReturnType<typeof restaurantPhotoCandidates>[number], width: number, height: number) {
    const query = new URLSearchParams({ maxWidthPx: String(width), maxHeightPx: String(height), skipHttpRedirect: "true" });
    const result = await this.request(`${photo.name}/media?${query}`) as { photoUri?: string };
    let uri: URL;
    try { uri = new URL(result.photoUri!); } catch { return null; }
    if (uri.protocol !== "https:" || !["googleusercontent.com", "ggpht.com"].some((host) => uri.hostname === host || uri.hostname.endsWith(`.${host}`))) return null;
    const source = typeof photo.googleMapsUri === "string" && /^https:\/\/(?:[\w-]+\.)?google\.com\//u.test(photo.googleMapsUri) ? photo.googleMapsUri : null;
    return { photoIndex: photo.photoIndex, photoUri: uri.href, authors: photoAuthors(photo.authorAttributions), googleMapsUri: source };
  }
  async photos(placeId: string, width = 320, height = 200, selectedIndex?: number) {
    const candidates = await this.photoCandidates(placeId), choices = candidates.slice(0, 4);
    const selected = candidates.find(p => p.photoIndex === selectedIndex);
    if (selected && !choices.includes(selected)) choices[choices.length - 1] = selected;
    const results = await Promise.allSettled(choices.map(p => this.photoMedia(p, width, height)));
    return results.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : []);
  }
  async photo(placeId: string, width = 1200, height = 675, selectedIndex?: number) {
    const candidates = await this.photoCandidates(placeId);
    const photo = candidates.find(p => p.photoIndex === selectedIndex) ?? candidates[0];
    return photo ? this.photoMedia(photo, width, height) : null;
  }
}
