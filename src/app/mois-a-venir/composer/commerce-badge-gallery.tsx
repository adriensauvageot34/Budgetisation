"use client";

import { useState } from "react";
import { clayBadgeCatalog, type ClayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";
import styles from "./commerce-library.module.css";

const fold = (label: string) => label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");

export function CommerceBadgeGallery({ busy, available, reuseOnly, selectedKey, choose }: {
  busy: boolean; available: boolean; reuseOnly: boolean; selectedKey?: string;
  choose: (asset: ClayBadgeAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const term = fold(query.trim());
  const results = clayBadgeCatalog.filter(asset => {
    if (reuseOnly && asset.type !== "generic") return false;
    if (filter === "generic" && asset.type !== "generic") return false;
    if (filter === "brand" && asset.type !== "merchant") return false;
    if (filter === "review" && !asset.reviewRequired) return false;
    return !term || fold(asset.label).includes(term);
  });
  return <section><h3>Collection Clay</h3>
    <label>Rechercher une illustration
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
    </label>
    <label>Afficher
      <select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="all">Toute la collection</option>
        <option value="generic">Badges génériques</option>
        {!reuseOnly && <option value="brand">Marques et enseignes</option>}
        {!reuseOnly && <option value="review">Candidats et essais</option>}
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
