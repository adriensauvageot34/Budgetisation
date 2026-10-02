"use client";
import { useEffect, useRef, useState } from "react";
import type { RestaurantPhoto } from "@/domain/phase2/restaurant-places";
import { WizardBackdrop } from "./planned-wizard-visuals";
import { GoogleMapsAttribution } from "./restaurant-place-search";

export function RestaurantPhotoAttribution({ photo }: { photo: RestaurantPhoto }) {
  return <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-700"><GoogleMapsAttribution />
    {photo.authors.map((a, index) => a.uri ? <a key={index} href={a.uri} target="_blank" rel="noopener noreferrer" className="underline">{a.displayName}</a> : <span key={index}>{a.displayName}</span>)}
    {photo.googleMapsUri && <a href={photo.googleMapsUri} target="_blank" rel="noopener noreferrer" className="underline">Voir la photo sur Google Maps</a>}</span>;
}

/** Thumbnail credits live here with the larger photo, without persisting any provider content. */
export function RestaurantPhotoDetails({ photo, placeId, onClose }: { photo: RestaurantPhoto; placeId?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [largePhoto, setLargePhoto] = useState(photo);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    setLargePhoto(photo); if (!placeId) return;
    const controller = new AbortController();
    void fetch("/api/places/photo", { method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, selectedIndex: photo.photoIndex, maxWidthPx: 960, maxHeightPx: 540 }) })
      .then(async r => r.ok ? (await r.json()).photo as RestaurantPhoto | null : null)
      .then(result => { if (result && !controller.signal.aborted) setLargePhoto(result); }).catch(() => { /* Existing photo and credits remain available. */ });
    return () => controller.abort();
  }, [photo, placeId]);
  return <dialog ref={dialog} aria-label="Photo du restaurant" onClose={onClose} className="fixed inset-0 m-auto max-h-[90vh] w-[min(960px,calc(100vw-48px))] overflow-auto rounded-2xl bg-white p-4 shadow-xl backdrop:bg-black/60">
    <div className="mb-3 flex items-center justify-between gap-4"><h4 className="font-semibold">Photo du restaurant</h4><button type="button" onClick={onClose} className="px-2 py-1 text-sm underline">Fermer</button></div>
    <figure><img src={largePhoto.photoUri} alt="Photo du restaurant agrandie" referrerPolicy="no-referrer" className="max-h-[65vh] w-full object-contain" onError={() => setLargePhoto(photo)} />
      <figcaption className="mt-3"><RestaurantPhotoAttribution photo={largePhoto} /></figcaption></figure>
  </dialog>;
}
export function RestaurantPhotoBackground({ placeId, selectedIndex, className = "" }: { placeId?: string; selectedIndex?: number; className?: string }) {
  const frame = useRef<HTMLElement>(null), [photo, setPhoto] = useState<RestaurantPhoto | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    setPhoto(null); setEnlarged(false); if (!placeId || !frame.current) return;
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
  return <><figure ref={frame} data-project-hero className={`relative aspect-video overflow-hidden bg-slate-100 ${className}`}>
    <WizardBackdrop scene="restaurant" />
    {/* A transient provider URI, deliberately not Next Image or a rehosted/cacheable asset. */}
    {photo && <button type="button" aria-label="Agrandir la photo du restaurant" onClick={() => setEnlarged(true)} className="absolute inset-0 h-full w-full focus-visible:outline-2 focus-visible:outline-white"><img src={photo.photoUri} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover object-center" onError={() => setPhoto(null)} /></button>}
    {photo && <figcaption className="pointer-events-none absolute right-2 top-2 cursor-default rounded bg-white/75 px-1 py-0.5 leading-none"><GoogleMapsAttribution showPolicyLink={false} /></figcaption>}
  </figure>{photo && enlarged && <RestaurantPhotoDetails photo={photo} onClose={() => setEnlarged(false)} />}</>;
}
