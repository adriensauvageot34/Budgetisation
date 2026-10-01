"use client";
import { useEffect, useRef, useState } from "react";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { deduplicateRestaurantSuggestions, knownRestaurantSuggestions, usedRestaurantSuggestions, RestaurantSearchSession,
  type RestaurantSuggestion, type SelectedRestaurantPlace, type UsedRestaurantRef } from "@/domain/phase2/restaurant-places";
import styles from "./planned-wizard.module.css";

export function GoogleMapsAttribution() {
  return <span className="inline-flex items-center gap-2"><span translate="no" style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 400, fontStyle: "normal", letterSpacing: "normal", color: "#5e5e5e", whiteSpace: "nowrap" }}>Google Maps</span><a href="/mentions-places" target="_blank" rel="noopener noreferrer" aria-label="Conditions et confidentialité de la recherche de lieux" className="text-xs text-slate-500 underline">ⓘ</a></span>;
}
export async function fetchRestaurantPlace(placeId: string, sessionToken?: string, signal?: AbortSignal): Promise<SelectedRestaurantPlace> {
  const response = await fetch("/api/places/details", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, sessionToken }) });
  const result = await response.json();
  if (!response.ok || !result.place) throw new Error(result.message ?? "Restaurant indisponible. Saisissez-le manuellement.");
  return result.place;
}
export function RestaurantPlaceSearch({ city, places, usedRestaurants = [], onKnown, onGoogle, onManual, onLater }: {
  city: string; places: readonly PlannedPlaceOption[]; usedRestaurants?: readonly UsedRestaurantRef[]; onKnown: (place: PlannedPlaceOption) => void;
  onGoogle: (place: SelectedRestaurantPlace, userQuery: string) => void; onManual: (query: string) => void; onLater: () => void;
}) {
  const [query, setQuery] = useState(""), [results, setResults] = useState<readonly RestaurantSuggestion[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false), [selecting, setSelecting] = useState(false);
  const session = useRef<RestaurantSearchSession | null>(null), active = useRef<AbortController | null>(null), mounted = useRef(true);
  if (!session.current) session.current = new RestaurantSearchSession();
  const known = knownRestaurantSuggestions(places, city, query);
  const used = usedRestaurantSuggestions(usedRestaurants, city, query).filter((ref) => !known.some((p) => p.googlePlaceId === ref.googlePlaceId));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; session.current?.cancel(); active.current?.abort(); };
  }, []);
  useEffect(() => {
    active.current?.abort(); setResults([]); setError(""); setLoading(false);
    session.current!.schedule(query, city, async (request, current) => {
      const controller = new AbortController(); active.current = controller; setLoading(true);
      try {
        const response = await fetch("/api/places/autocomplete", { method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: request.input, sessionToken: request.sessionToken, context: { city: request.city, country: "FR" } }) });
        const result = await response.json();
        if (!current() || !mounted.current) return;
        if (!response.ok) throw new Error(result.message);
        setResults(result.suggestions ?? []);
      } catch (caught) { if (current() && mounted.current && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Recherche indisponible. Saisissez le restaurant manuellement."); }
      finally { if (current() && mounted.current) setLoading(false); }
    });
    return () => { session.current?.cancel(); active.current?.abort(); };
  }, [query, city]);
  const select = async (suggestion: RestaurantSuggestion, ownLabel = query.trim(), autocomplete = true) => {
    session.current!.cancel(); active.current?.abort(); setSelecting(true); setError("");
    const controller = new AbortController(); active.current = controller;
    try { const place = await fetchRestaurantPlace(suggestion.placeId, autocomplete ? session.current!.sessionToken() : undefined, controller.signal);
      if (mounted.current) { session.current!.complete(); onGoogle(place, ownLabel); }
    } catch (caught) { if (mounted.current && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Restaurant indisponible. Saisissez-le manuellement."); }
    finally { if (mounted.current) setSelecting(false); }
  };
  return <div className="grid max-w-3xl gap-4">
    <label className={styles.field}>Nom du restaurant · {city}<input autoFocus className={styles.input} value={query} maxLength={120} disabled={selecting}
      placeholder="Commencez à taper son nom…" autoComplete="off" onChange={(e) => setQuery(e.target.value)} /></label>
    {(known.length > 0 || used.length > 0) && <section aria-label="Restaurants déjà connus"><h5 className="mb-2 text-xs font-bold text-slate-500">Déjà connus</h5><ul className="grid grid-cols-2 gap-2">{known.map((p) => <li key={p.placeId}><button type="button" disabled={selecting} className={styles.wallet + " w-full text-left"} onClick={() => { session.current!.complete(); onKnown(p); }}>{p.name}<span className="ml-2 text-xs text-slate-500">{p.commune}</span></button></li>)}{used.map((ref) => <li key={ref.googlePlaceId}><button type="button" disabled={selecting} className={styles.wallet + " w-full text-left"} onClick={() => void select({ placeId: ref.googlePlaceId, primaryText: ref.label, secondaryText: ref.city, source: "google_places" }, ref.label, false)}>{ref.label}<span className="ml-2 text-xs text-slate-500">{ref.city}</span></button></li>)}</ul></section>}
    {(loading || results.length > 0) && <section className="rounded-xl border border-slate-200 p-3" aria-label="Résultats Google Maps"><div className="mb-2 flex items-center justify-between"><h5 className="text-xs font-bold text-slate-500">Restaurants trouvés</h5><GoogleMapsAttribution /></div>
      {loading && <p role="status" className="text-sm text-slate-500">Recherche…</p>}<ul className="grid gap-2">{deduplicateRestaurantSuggestions(results, known, used).map((p) => <li key={p.placeId}><button type="button" disabled={selecting} className={styles.wallet + " w-full text-left"} onClick={() => void select(p)}><strong>{p.primaryText}</strong><span className="mt-1 block text-xs text-slate-500">{p.secondaryText}</span></button></li>)}</ul></section>}
    {selecting && <p role="status" className="text-sm">Récupération du restaurant…</p>}
    {error && <p role="status" className="text-sm text-amber-900">{error}</p>}
    <div className="flex gap-6 text-sm"><button type="button" disabled={selecting} className="underline" onClick={() => onManual(query)}>Je ne trouve pas le restaurant</button><button type="button" disabled={selecting} className="underline" onClick={onLater}>Je choisirai plus tard</button></div>
  </div>;
}
