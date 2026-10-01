"use client";
import { useEffect, useRef, useState } from "react";
import type { RestaurantPhoto } from "@/domain/phase2/restaurant-places";
import { WizardBackdrop } from "./planned-wizard-visuals";
import { GoogleMapsAttribution } from "./restaurant-place-search";

export function RestaurantPhotoBackground({ placeId }: { placeId?: string }) {
  const frame = useRef<HTMLElement>(null), [photo, setPhoto] = useState<RestaurantPhoto | null>(null);
  useEffect(() => {
    setPhoto(null); if (!placeId || !frame.current) return;
    const controller = new AbortController(); let started = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || started) return;
      started = true; observer.disconnect();
      void fetch("/api/places/photo", { method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, maxWidthPx: 1200, maxHeightPx: 500 }) })
        .then(async (r) => r.ok ? (await r.json()).photo as RestaurantPhoto | null : null)
        .then((result) => { if (!controller.signal.aborted) setPhoto(result); }).catch(() => { /* Generic image is already visible. */ });
    });
    observer.observe(frame.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [placeId]);
  return <figure ref={frame} className="relative -mx-4 h-24 overflow-hidden rounded-t-xl bg-slate-100">
    <WizardBackdrop scene="restaurant" />
    {/* A transient provider URI, deliberately not Next Image or a rehosted/cacheable asset. */}
    {photo && <img src={photo.photoUri} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover grayscale" onError={() => setPhoto(null)} />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
    {photo && <figcaption className="absolute bottom-1 right-2 flex max-w-full flex-wrap items-center gap-x-2 rounded bg-white/95 px-2 py-1 text-xs text-slate-700"><span>Photo Google du restaurant</span><GoogleMapsAttribution />{photo.authors.map((a, index) => a.uri ? <a key={index} href={a.uri} target="_blank" rel="noopener noreferrer" className="underline">{a.displayName}</a> : <span key={index}>{a.displayName}</span>)}</figcaption>}
  </figure>;
}
