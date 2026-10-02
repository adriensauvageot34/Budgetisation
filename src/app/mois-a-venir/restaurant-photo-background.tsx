"use client";
import { useEffect, useRef, useState } from "react";
import type { RestaurantPhoto } from "@/domain/phase2/restaurant-places";
import { WizardBackdrop } from "./planned-wizard-visuals";
import { GoogleMapsAttribution } from "./restaurant-place-search";

export function RestaurantPhotoAttribution({ photo, showGoogle = true, compact = false }: { photo: RestaurantPhoto; showGoogle?: boolean; compact?: boolean }) {
  return <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-700">{showGoogle && <GoogleMapsAttribution />}
    {photo.authors.map((a, index) => a.uri ? <a key={index} href={a.uri} target="_blank" rel="noopener noreferrer" className="underline">{a.displayName}</a> : <span key={index}>{a.displayName}</span>)}
    {photo.googleMapsUri && <a href={photo.googleMapsUri} target="_blank" rel="noopener noreferrer" aria-label="Voir la photo" title="Voir la photo" className="underline">{compact ? "↗" : "Voir la photo"}</a>}</span>;
}
export function RestaurantPhotoBackground({ placeId, selectedIndex, className = "" }: { placeId?: string; selectedIndex?: number; className?: string }) {
  const frame = useRef<HTMLElement>(null), [photo, setPhoto] = useState<RestaurantPhoto | null>(null);
  useEffect(() => {
    setPhoto(null); if (!placeId || !frame.current) return;
    const controller = new AbortController(); let started = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || started) return;
      started = true; observer.disconnect();
      void fetch("/api/places/photo", { method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, selectedIndex, maxWidthPx: 960, maxHeightPx: 540 }) })
        .then(async (r) => r.ok ? (await r.json()).photo as RestaurantPhoto | null : null)
        .then((result) => { if (!controller.signal.aborted) setPhoto(result); }).catch(() => { /* Generic image is already visible. */ });
    });
    observer.observe(frame.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [placeId, selectedIndex]);
  return <figure ref={frame} data-project-hero className={`relative aspect-video overflow-hidden bg-slate-100 ${className}`}>
    <WizardBackdrop scene="restaurant" />
    {/* A transient provider URI, deliberately not Next Image or a rehosted/cacheable asset. */}
    {photo && <img src={photo.photoUri} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover object-center" onError={() => setPhoto(null)} />}
    {photo && <figcaption className="absolute left-2 right-2 top-2 w-fit max-w-[calc(100%-16px)] rounded bg-white/95 px-2 py-1"><RestaurantPhotoAttribution photo={photo} /></figcaption>}
  </figure>;
}
