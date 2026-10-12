"use client";
import { useState } from "react";
import type { PlannedRouteStop } from "@/domain/phase2/planned-contract";
import { builderInput, builderButton } from "./planned-builder-primitives";

export function PlannedRouteCoordinatesField({ stop, onApply }: { stop: PlannedRouteStop; onApply: (latitude: number, longitude: number) => void }) {
  const [latitude, setLatitude] = useState(stop.coordinates ? String(stop.coordinates.latitude) : "");
  const [longitude, setLongitude] = useState(stop.coordinates ? String(stop.coordinates.longitude) : "");
  return <details className="mt-2 text-xs text-slate-500"><summary>Préciser les coordonnées de ce lieu</summary><div className="mt-2 flex gap-2"><label>Latitude<input type="number" step="any" className={builderInput} value={latitude} onChange={(e) => setLatitude(e.target.value)} /></label><label>Longitude<input type="number" step="any" className={builderInput} value={longitude} onChange={(e) => setLongitude(e.target.value)} /></label><button type="button" className={builderButton} disabled={!latitude || !longitude || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180} onClick={() => onApply(Number(latitude), Number(longitude))}>Utiliser</button></div></details>;
}
