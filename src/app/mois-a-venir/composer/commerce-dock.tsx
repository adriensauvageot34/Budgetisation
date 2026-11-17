"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings2, Store, X } from "lucide-react";
import { clayBadgeAsset, clayBadgeCatalog, type ClayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";
import { normalizeLibrarySearch } from "@/domain/phase2/planner/composer-library-index";
import { merchantSuggestionActivities } from "@/domain/phase2/planner/merchant-suggestion-activities";
import { badgeCommand, resolveBadgeMedia, useCommerceLibrary } from "./commerce-library";
import styles from "./commerce-library.module.css";

export function CommerceDock({ library }: { library: NonNullable<ReturnType<typeof useCommerceLibrary>> }) {
  const { badge } = library.dock!;
  const resolved = resolveBadgeMedia(badge, library);
  const binding = library.bindings.find(row => row.key === badge.anchor?.key);
  const suggestedKeys = badge.suggestedKeys ?? [];
  const canChooseMerchant = !!badge.anchor && badge.kind !== "platform";
  const [mode, setMode] = useState(canChooseMerchant && !resolved.genericAsset ? "merchant" : "generic");
  const [query, setQuery] = useState("");
  const [allGeneric, setAllGeneric] = useState(!suggestedKeys.length);
  const [chosenAsset, setAsset] = useState<ClayBadgeAsset>();
  const asset = chosenAsset ?? clayBadgeAsset(resolved.genericAsset?.key);
  const [enteredName, setBusinessName] = useState<string>();
  const businessName = enteredName ?? resolved.businessLabel ?? "";
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const rail = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null);
  const terms = normalizeLibrarySearch(query).split(" ").filter(Boolean);
  const activities = merchantSuggestionActivities(badge.merchantSuggestionKeys ?? suggestedKeys);
  const matches = (label: string) => terms.every(term => normalizeLibrarySearch(label).includes(term));
  const merchants = mode === "merchant" ? library.catalog?.filter(merchant =>
    (!suggestedKeys.length || activities.has(merchant.activityKey)) && matches(merchant.label + " " + merchant.activity)) : undefined;
  const genericAssets = mode === "generic" ? clayBadgeCatalog.filter(item => item.type === "generic"
    && (allGeneric || suggestedKeys.includes(item.key)) && matches(item.label)) : [];
  const disabled = saving || !library.available;

  useLayoutEffect(() => {
    root.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width:760px)").matches) root.current?.scrollIntoView({ block: "nearest" });
  }, []);
  useLayoutEffect(() => { if (rail.current) rail.current.scrollLeft = 0; }, [mode, query, allGeneric]);
  const scroll = (step: number) => rail.current?.scrollBy({
    left: step * Math.max(120, (rail.current?.clientWidth ?? 0) - 100),
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  const save = async (command: unknown) => {
    if (disabled) return;
    setSaving(true); setError("");
    try {
      await badgeCommand(command);
      library.refresh();
      library.closeDock(true);
    } catch (failure) {
      library.refresh();
      setError(failure instanceof Error ? failure.message : "Enregistrement non confirmé.");
      setSaving(false);
    }
  };
  const selectMerchant = (key: string) => save({ kind: "CONFIRM", identityKey: key,
    anchor: badge.anchor, expectedBindingVersion: binding?.version ?? 0 });
  const selectGeneric = (key: string | null) => save({ kind: "ANCHOR_GENERIC", anchor: badge.anchor,
    expectedVersion: binding?.version ?? 0, assetKey: key, businessLabel: key ? businessName.trim() : null });
  const switchMode = (next: string) => { setMode(next); setQuery(""); setError(""); };
  return <section ref={root} className={styles.dock} data-commerce-dock aria-label={`Entreprise · ${badge.cardLabel ?? badge.label}`} tabIndex={-1}
    onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing && !saving) {
      event.preventDefault(); event.stopPropagation(); library.closeDock(true);
    } }}
    aria-busy={saving}>
    <header>
      <h3 title={badge.cardLabel ?? badge.label}>{badge.cardLabel ?? badge.label}</h3>
      {canChooseMerchant && <button type="button" aria-pressed={mode === "merchant"} disabled={saving} onClick={() => switchMode("merchant")}>Marchands</button>}
      {badge.anchor && <button type="button" aria-pressed={mode === "generic"} disabled={saving} onClick={() => switchMode("generic")}>Badge générique</button>}
      <input type="search" aria-label={mode === "merchant" ? "Rechercher un marchand" : "Rechercher un badge générique"}
        placeholder="Rechercher" value={query} maxLength={120} disabled={saving} onChange={event => setQuery(event.target.value)} />
      <button type="button" aria-label="Options du badge" title="Options du badge" disabled={saving} onClick={library.openAdvanced}><Settings2 size={16} /></button>
      <button type="button" aria-label="Fermer le choix de l’entreprise" disabled={saving} onClick={() => library.closeDock(true)}><X size={16} /></button>
    </header>
    {mode === "generic" && suggestedKeys.length > 0 && <button className={styles.dockFilter} type="button" aria-pressed={allGeneric} disabled={saving} onClick={() => setAllGeneric(value => !value)}>
      {allGeneric ? "Badges adaptés à la carte" : "Tous les badges génériques"}
    </button>}
    {mode === "merchant" && library.catalogError && !merchants && <p role="status">Marchands indisponibles. <button type="button" onClick={library.loadCatalog}>Réessayer</button></p>}
    {mode === "merchant" && !library.catalogError && !merchants && <p role="status">Chargement des marchands…</p>}
    {mode === "merchant" && merchants?.length === 0 && <p role="status">Aucun marchand correspondant.</p>}
    {mode === "generic" && !genericAssets.length && <p role="status">Aucun badge correspondant.</p>}
    <div className={styles.dockRail}>
      <button type="button" aria-label="Choix précédents" onClick={() => scroll(-1)} hidden={(merchants?.length ?? genericAssets.length) < 2}><ChevronLeft size={16} /></button>
      <div ref={rail} className={styles.dockOptions} data-palette-options aria-label="Choix d’entreprise" tabIndex={0}
        onKeyDown={event => { if (event.target === event.currentTarget && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault(); scroll(event.key === "ArrowRight" ? 1 : -1);
        } }}>
        {merchants?.map(merchant => <button key={merchant.key} type="button" data-suggested-merchant={merchant.key}
          className={styles.dockTile} disabled={disabled} aria-pressed={resolved.identity?.key === merchant.key}
          title={`${merchant.label} · ${merchant.activity}`} onClick={() => void selectMerchant(merchant.key)}>
          {merchant.imageUrl ? <img src={merchant.imageUrl} alt="" width={32} height={32} loading="lazy" decoding="async" /> : <Store size={22} aria-hidden="true" />}
          <span><strong>{merchant.label}</strong>{merchant.purchaseCount > 0 && <small>{merchant.purchaseCount} achat{merchant.purchaseCount > 1 ? "s" : ""}</small>}</span>
        </button>)}
        {genericAssets.map(item => <button key={item.key} type="button" data-clay-asset={item.key} className={styles.dockTile}
          disabled={saving} aria-pressed={asset?.key === item.key} onClick={() => setAsset(item)}>
          <img src={item.src} alt="" width={32} height={32} loading="lazy" decoding="async" /><strong>{item.label}</strong>
        </button>)}
      </div>
      <button type="button" aria-label="Choix suivants" onClick={() => scroll(1)} hidden={(merchants?.length ?? genericAssets.length) < 2}><ChevronRight size={16} /></button>
    </div>
    {mode === "generic" && asset && <form className={styles.dockName} onSubmit={event => { event.preventDefault(); void selectGeneric(asset.key); }}>
      <label>Nom de l’entreprise<input value={businessName} required maxLength={120} disabled={saving} onChange={event => setBusinessName(event.target.value)} /></label>
      <button type="submit" disabled={disabled || !businessName.trim()}>Utiliser le badge</button>
      {resolved.genericAsset && <button type="button" disabled={disabled} onClick={() => void selectGeneric(null)}>Retirer</button>}
    </form>}
    {saving && <p role="status">Enregistrement du badge…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
