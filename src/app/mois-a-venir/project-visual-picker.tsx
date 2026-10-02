"use client";
import { useEffect, useRef, useState } from "react";
import type { RestaurantPhoto } from "@/domain/phase2/restaurant-places";
import { RestaurantPhotoAttribution } from "./restaurant-photo-background";
import { GoogleMapsAttribution } from "./restaurant-place-search";
import styles from "./project-wizard.module.css";

/** Ephemeral provider content, optional and isolated from financial readiness/Save. */
export function ProjectVisualPicker({ placeId, selectedIndex, onChoose }: { placeId: string; selectedIndex?: number; onChoose: (index: number) => void }) {
  const [photos, setPhotos] = useState<readonly RestaurantPhoto[]>([]), [loading, setLoading] = useState(true);
  const choose = useRef(onChoose); choose.current = onChoose;
  useEffect(() => {
    const controller = new AbortController(); setPhotos([]); setLoading(true);
    void fetch("/api/places/photo", { method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId, gallery: true, selectedIndex, maxWidthPx: 320, maxHeightPx: 200 }) })
      .then(async r => r.ok ? (await r.json()).photos as RestaurantPhoto[] : [])
      .then(result => {
        if (controller.signal.aborted) return;
        setPhotos(result); if (selectedIndex === undefined && result[0]) choose.current(result[0].photoIndex);
      }).catch(() => { /* The generic visual and Save remain available. */ })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // A changed preference only updates selection, never re-fetches the four thumbnails.
  }, [placeId]);
  if (!loading && !photos.length) return null;
  const selected = photos.some(p => p.photoIndex === selectedIndex) ? selectedIndex : photos[0]?.photoIndex;
  return <section className={styles.visualPicker} aria-label="Image du projet">
    <div className={styles.visualHeading}><h5>Image du projet</h5>{!loading && <GoogleMapsAttribution />}</div>
    {loading ? <p role="status" className={styles.small}>Chargement des photos du restaurant…</p> : <div className={styles.visualChoices}>
      {photos.map((photo, index) => <figure key={photo.photoIndex}>
        {photos.length > 1 ? <button type="button" aria-label={`Choisir la photo ${index + 1}`} aria-pressed={selected === photo.photoIndex} className={styles.visualChoice}
          onClick={() => choose.current(photo.photoIndex)}><img src={photo.photoUri} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotos(current => current.filter(p => p.photoIndex !== photo.photoIndex))} />
          {selected === photo.photoIndex && <span aria-hidden="true">✓</span>}</button>
          : <div className={styles.visualChoice}><img src={photo.photoUri} alt="Photo du restaurant" loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotos([])} /></div>}
        <figcaption><RestaurantPhotoAttribution photo={photo} showGoogle={false} compact /></figcaption>
      </figure>)}
    </div>}
  </section>;
}
