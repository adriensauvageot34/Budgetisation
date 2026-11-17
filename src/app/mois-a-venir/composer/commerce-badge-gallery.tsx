"use client";

import { useState } from "react";
import { clayBadgeCatalog, type ClayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";
import styles from "./commerce-library.module.css";

const fold = (label: string) => label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");

export function CommerceBadgeGallery({ busy, available, reuseOnly, selectedKey, choose, suggestedKeys = [], cardLabel, genericOnly }: {
  busy: boolean; available: boolean; reuseOnly: boolean; selectedKey?: string;
  choose: (asset: ClayBadgeAsset) => void;
  suggestedKeys?: readonly string[]; cardLabel?: string; genericOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(suggestedKeys.length ? "suggested" : "generic");
  const activeFilter = (genericOnly || reuseOnly) && ["all", "brand", "review"].includes(filter) ? "generic" : filter;
  const suggestions = new Set(suggestedKeys);
  const term = fold(query.trim());
  const results = clayBadgeCatalog.filter(asset => {
    if (reuseOnly && asset.type !== "generic") return false;
    if (genericOnly && asset.type !== "generic") return false;
    if (activeFilter === "suggested" && (asset.type !== "generic" || !suggestions.has(asset.key))) return false;
    if (activeFilter === "generic" && asset.type !== "generic") return false;
    if (activeFilter === "brand" && asset.type !== "merchant") return false;
    if (activeFilter === "review" && !asset.reviewRequired) return false;
    return !term || fold(asset.label).includes(term);
  });
  return <section><h3>{suggestedKeys.length && cardLabel ? `Badges pour ${cardLabel}` : "Badges génériques"}</h3>
    <label>Rechercher une illustration
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
    </label>
    <label>Afficher
      <select value={activeFilter} onChange={event => setFilter(event.target.value)}>
        {suggestedKeys.length > 0 && <option value="suggested">Adaptés à cette carte</option>}
        <option value="generic">Tous les badges génériques</option>
        {!genericOnly && !reuseOnly && <option value="all">Toute la collection</option>}
        {!genericOnly && !reuseOnly && <option value="brand">Marques et enseignes</option>}
        {!genericOnly && !reuseOnly && <option value="review">Candidats et essais</option>}
      </select>
    </label>
    <p role="status">{results.length} {results.length === 1 ? "illustration" : "illustrations"}</p>
    <div className={styles.gallery} aria-label="Illustrations Clay">
      {results.map(asset => <button key={asset.key} type="button" className={styles.galleryItem}
        data-clay-asset={asset.key} aria-label={`Choisir ${asset.label}`}
        aria-pressed={selectedKey === asset.key} disabled={busy || !available}
        onClick={() => choose(asset)}>
        <img src={asset.src} alt="" width={48} height={48} loading="lazy" decoding="async" />
        <span>{asset.label}</span>
        {asset.reviewRequired && <small>{asset.type === "trial" ? "Essai" : "Correspondance à confirmer"}</small>}
      </button>)}
    </div>
    {!results.length && <p>Aucune illustration trouvée.</p>}
  </section>;
}
