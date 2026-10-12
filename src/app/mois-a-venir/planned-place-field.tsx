"use client";
import { useState } from "react";
import type { PlannedExpenseContext } from "@/domain/phase2/planned-contract";
import { habitualPlaceSuggestions, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { ChoiceTiles, builderInput } from "./planned-builder-primitives";

export function PlannedPlaceField({ places, value, onChange, brandFirst = false, seller, onSeller, exact = false, label = "Lieu" }: {
  places: readonly PlannedPlaceOption[]; value: PlannedExpenseContext["place"]; onChange: (ref?: PlannedExpenseContext["place"]) => void;
  brandFirst?: boolean; seller?: string; onSeller?: (label?: string) => void; exact?: boolean;
  label?: string;
}) {
  const [manual, setManual] = useState(value?.kind === "TEXT"), [all, setAll] = useState(false), [precise, setPrecise] = useState(exact || !!value);
  const suggestions = habitualPlaceSuggestions(places);
  const known = value?.kind === "KNOWN" ? places.find((part) => part.placeId === value.placeId) : undefined;
  const brands = [...new Set(suggestions.map((part) => part.brandLabel || part.name))];
  const candidates = (all ? places : suggestions).filter((place) => !brandFirst || !seller || (place.brandLabel || place.name) === seller);
  return <div className="grid gap-3">{brandFirst && <><ChoiceTiles label="Quelle enseigne ?" choices={brands.map((label) => ({ key: label, label }))} value={seller} onChange={(label) => { onSeller?.(label); onChange(undefined); }} />
      <label className="grid max-w-md gap-1 text-sm">Autre enseigne<input className={builderInput} value={seller ?? ""} onChange={(event) => { onSeller?.(event.target.value || undefined); onChange(undefined); }} /></label></>}
    {brandFirst && !precise && !exact ? <button type="button" className="text-left text-sm font-semibold text-indigo-700" onClick={() => setPrecise(true)}>+ Préciser l’établissement</button> : <>
      {known && <p className="text-sm font-semibold">{known.name} · {known.commune}<button type="button" className="ml-3 text-indigo-700 underline" onClick={() => { onChange(undefined); setAll(true); }}>Changer</button></p>}
      <label className="grid max-w-xl gap-1 text-sm">{brandFirst ? "Établissement" : label}<select className={builderInput} value={value?.kind === "KNOWN" ? value.placeId : manual ? "TEXT" : ""} onChange={(event) => { setManual(event.target.value === "TEXT"); onChange(event.target.value === "TEXT" ? { kind: "TEXT", label: "", provenance: "USER_DECLARED_PROSPECTIVE" } : event.target.value ? { kind: "KNOWN", placeId: event.target.value } : undefined); }}>
        {value?.kind === "KNOWN" && !known && <option value={value.placeId}>Lieu lié indisponible</option>}
        <option value="">Sans lieu précisé</option>{[...candidates, ...known && !candidates.includes(known) ? [known] : []].map((place, index) => <option key={place.placeId} value={place.placeId}>{place.name}{place.commune ? ` · ${place.commune}` : ""}{!all && index === 0 && suggestions.length ? " · Habituel" : ""}</option>)}<option value="TEXT">Autre lieu à saisir</option></select></label>
      {!all && <button type="button" className="text-left text-xs text-indigo-700 underline" onClick={() => setAll(true)}>Voir tous les lieux compatibles, y compris les lieux rares</button>}
      {value?.kind === "TEXT" && <label className="grid max-w-xl gap-1 text-sm">{label === "Lieu" ? "Nom du lieu ou destination" : `Adresse ou nom · ${label}`}<input className={builderInput} value={value.label} onChange={(event) => onChange({ kind: "TEXT", label: event.target.value, provenance: "USER_DECLARED_PROSPECTIVE" })} /></label>}
      {!candidates.length && <p className="text-xs text-slate-500">Aucun lieu habituel compatible observé. Vous pouvez choisir un lieu rare ou saisir votre destination.</p>}
    </>}</div>;
}

