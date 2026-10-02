import "server-only";
import { NextResponse } from "next/server";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { GooglePlacesError, GoogleRestaurantPlaces } from "./google-places";
import { validGooglePlaceId } from "@/domain/phase2/restaurant-places";
import type { ProjectPlaceKind } from "@/domain/phase2/restaurant-places";

const counters = new Map<string, { at: number; count: number }>();
/** Low-volume per-instance guard, no provider content or search query is cached. */
export function allowPlacesRequest(key: string, maximum: number, now = Date.now()) {
  for (const [id, counter] of counters) if (now - counter.at >= 60_000) counters.delete(id);
  const counter = counters.get(key) ?? { at: now, count: 0 };
  counters.set(key, counter); counter.count++;
  return counter.count <= maximum;
}
const noStore = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: noStore });
export async function restaurantPlacesRequest(request: Request, kind: "autocomplete" | "details" | "photo") {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ message: "Requête non autorisée." }, 403);
  if (!/(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(request.headers.get("cookie") ?? "")) return reply({ message: "Connectez-vous pour rechercher un restaurant." }, 401);
  let identity;
  try { identity = await getAuthenticatedBootstrapClient(); } catch { return reply({ message: "Connectez-vous pour rechercher un restaurant." }, 401); }
  let household;
  try { household = await getCurrentHousehold(identity.supabase); }
  catch { return reply({ message: "Recherche de restaurants indisponible. Vous pouvez saisir le restaurant manuellement." }, 503); }
  if (!household) return reply({ message: "Un foyer est nécessaire." }, 403);
  if (!allowPlacesRequest(`${household.householdId}:${identity.user.id}:${kind}`, kind === "photo" ? 12 : 60) || !allowPlacesRequest("provider", 200))
    return reply({ message: "Trop de recherches. Réessayez dans une minute ou saisissez le restaurant." }, 429);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ message: "Recherche invalide." }, 400);
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError();
    const provider = new GoogleRestaurantPlaces();
    const placeKind = (body.context as { kind?: unknown } | undefined)?.kind ?? "RESTAURANT";
    if (!["RESTAURANT", "ACTIVITY", "VENUE", "DESTINATION", "RETAIL"].includes(String(placeKind))) throw new TypeError();
    const token = body.sessionToken;
    if (token !== undefined && (typeof token !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(token))) throw new TypeError();
    if (kind === "autocomplete") {
      const context = body.context as { city?: unknown } | undefined;
      const city = context?.city ?? "Montpellier";
      if (typeof body.input !== "string" || body.input.trim().length < 2 || body.input.length > 120 || !token || typeof city !== "string" || !city.trim() || city.length > 100) throw new TypeError();
      return reply({ suggestions: await provider.autocomplete(body.input.trim(), String(token), city.trim(), placeKind as ProjectPlaceKind) });
    }
    if (!validGooglePlaceId(body.placeId)) throw new TypeError();
    if (kind === "details") return reply({ place: await provider.details(body.placeId, token as string | undefined, placeKind as ProjectPlaceKind) });
    if (Object.keys(body).some(key => !["placeId", "selectedIndex", "gallery", "maxWidthPx", "maxHeightPx"].includes(key))) throw new TypeError();
    const dimension = (value: unknown, fallback: number) => {
      if (value === undefined) return fallback;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 1600) throw new TypeError();
      return value;
    };
    if (body.selectedIndex !== undefined && (!Number.isInteger(body.selectedIndex) || Number(body.selectedIndex) < 0 || Number(body.selectedIndex) > 9)) throw new TypeError();
    if (body.gallery !== undefined && typeof body.gallery !== "boolean") throw new TypeError();
    const selectedIndex = body.selectedIndex as number | undefined;
    return body.gallery ? reply({ photos: await provider.photos(body.placeId, dimension(body.maxWidthPx, 320), dimension(body.maxHeightPx, 200), selectedIndex) })
      : reply({ photo: await provider.photo(body.placeId, dimension(body.maxWidthPx, 1200), dimension(body.maxHeightPx, 675), selectedIndex) });
  } catch (error) {
    return reply({ message: error instanceof GooglePlacesError ? error.status === 404
      ? "Ce restaurant n’est plus disponible. Choisissez-le à nouveau ou saisissez-le manuellement." : error.message
      : "Recherche invalide." }, error instanceof GooglePlacesError ? error.status : 400);
  }
}
