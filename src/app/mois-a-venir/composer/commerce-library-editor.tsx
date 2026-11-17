"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Link from "next/link";
import { BADGE_CATEGORIES, type BadgeCategory, type BadgeIdentity, type BadgeLibraryRead, type PersonalBadge } from "@/domain/phase2/commerce-media";
import type { CommerceBadge } from "@/domain/phase2/planner/commerce-badges";
import { badgeCommand, commerceLibraryPath, resolveBadgeMedia } from "./commerce-library";
import type { ClayBadgeAsset } from "@/domain/phase2/commerce-badge-catalog";
import { CommerceBadgeGallery } from "./commerce-badge-gallery";
import styles from "./commerce-library.module.css";

export function CommerceLibraryEditor({ badge, library, refresh, close }: {
  badge: CommerceBadge; library: BadgeLibraryRead & { available: boolean }; refresh: () => void; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resolved = resolveBadgeMedia(badge, library);
  const [identity, setIdentity] = useState(resolved.identity);
  const [media, setMedia] = useState(resolved.personal);
  const [category, setCategory] = useState<BadgeCategory | "">(resolved.category ?? "");
  const binding = badge.anchor ? library.bindings.find(row => row.key === badge.anchor!.key) : undefined;
  const [bindingVersion, setBindingVersion] = useState(binding?.version ?? 0);
  const [query, setQuery] = useState(badge.label), [results, setResults] = useState<readonly BadgeIdentity[]>([]);
  const [candidate, setCandidate] = useState<BadgeIdentity | null>(null);
  const [asset, setAsset] = useState<ClayBadgeAsset | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const initialRead = useRef(library.available);
  useEffect(() => {
    if (initialRead.current || !library.available) return;
    initialRead.current = true;
    const current = resolveBadgeMedia(badge, library);
    setIdentity(current.identity); setMedia(current.personal); setCategory(current.category ?? "");
    setBindingVersion(binding?.version ?? 0);
  }, [library, badge, binding?.version]);
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (invoker?.isConnected) invoker.focus(); };
  }, []);
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await operation(); refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Enregistrement non confirmé."); }
    finally { setBusy(false); }
  };
  const adopt = (next: PersonalBadge) => { setIdentity({ key: next.key, label: next.label, policy: next.policy }); setMedia(next); };
  const ensureIdentity = async () => {
    if (!identity) throw Error("Confirmez l’entreprise avant d’ajouter son illustration.");
    if (media) return media;
    const next = (await badgeCommand({ kind: "CONFIRM", identityKey: identity.key })).media as PersonalBadge;
    adopt(next);
    return next;
  };
  const confirm = (personal: boolean) => void run(async () => {
    if (!badge.anchor || !personal && !candidate) return;
    const next = (await badgeCommand({ kind: "CONFIRM", ...(personal ? { newLabel: query } : { identityKey: candidate!.key }),
      anchor: badge.anchor, expectedBindingVersion: bindingVersion })).media as PersonalBadge;
    adopt(next); setBindingVersion(value => value + 1); setCandidate(null);
    setMessage("Entreprise confirmée pour ce badge dans votre compte.");
  });
  const applyAsset = () => void run(async () => {
    if (!asset) return;
    if (asset.category) {
      if (badge.anchor) {
        const next = await badgeCommand({ kind: "ANCHOR_CATEGORY", anchor: badge.anchor,
          expectedVersion: bindingVersion, category: asset.category });
        setBindingVersion(next.binding.version);
      } else {
        const current = await ensureIdentity();
        const next = (await badgeCommand({ kind: "CATEGORY", identityKey: current.key,
          expectedVersion: current.version, category: asset.category })).media;
        setMedia(next);
      }
      setCategory(asset.category);
    } else {
      let current = media;
      if (!identity) {
        if (!badge.anchor) throw Error("Choisissez d’abord l’entreprise.");
        current = (await badgeCommand({ kind: "CONFIRM", newLabel: badge.custom ? asset.label : query.trim() || badge.label,
          anchor: badge.anchor, expectedBindingVersion: bindingVersion })).media as PersonalBadge;
        adopt(current); setBindingVersion(value => value + 1);
      } else current = await ensureIdentity();
      if (!current) throw Error("L’identité visuelle est indisponible.");
      const next = (await badgeCommand({ kind: "BUNDLED", identityKey: current.key,
        expectedVersion: current.version, assetKey: asset.key })).media as PersonalBadge;
      adopt(next);
    }
    setAsset(null);
    setMessage("Badge Clay enregistré. Il sera retrouvé après rechargement.");
  });
  const panel = <dialog ref={dialog} className={styles.editor} data-commerce-library-editor aria-labelledby="commerce-library-title"
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header><h2 id="commerce-library-title">Illustration du badge</h2>
      <button type="button" disabled={busy} aria-label="Fermer la bibliothèque visuelle" onClick={close}><X size={18} /></button></header>
    <p>{badge.text}</p>
    <p className={styles.notice}>Bibliothèque privée de votre compte. Vos choix visuels sont enregistrés séparément de vos intentions.</p>
    <Link href="/parametres">Référentiel des marchands</Link>
    {!library.available && <p role="status">Bibliothèque privée indisponible. Les illustrations génériques restent disponibles.</p>}
    <CommerceBadgeGallery busy={busy} available={library.available} reuseOnly={identity?.policy === "reuse_only"}
      selectedKey={asset?.key ?? media?.bundledAssetKey} choose={setAsset} />
    {asset && <section>
      <div className={styles.selection}>
        <img src={asset.src} alt="" width={72} height={72} />
        <span>{asset.label}</span>
      </div>
      {asset.reviewRequired && <p>Vérifiez que cette illustration correspond au commerce choisi.</p>}
      <button type="button" disabled={busy || !library.available} onClick={applyAsset}>Utiliser cette illustration</button>
    </section>}
    <section><h3>Entreprise</h3>
      {identity ? <>
        <p data-confirmed-badge-identity>{identity.label} · {identity.key.startsWith("personal:") ? "Fiche visuelle privée" : "Identité sélectionnée"}</p>
        {identity.policy === "reuse_only" && <p>Réutilisation de badges existants uniquement.</p>}
        {badge.anchor && <button type="button" disabled={busy} onClick={() => { setIdentity(undefined); setMedia(undefined); setCandidate(null); }}>Corriger l’entreprise associée</button>}
      </> : <>
        <p>Choisissez l’entreprise concernée ou créez une fiche dans votre bibliothèque visuelle.</p>
        <form onSubmit={event => { event.preventDefault(); void run(async () => {
          setResults((await badgeCommand({ kind: "SEARCH", query })).identities); setCandidate(null);
        }); }}>
          <label>Nom de l’entreprise<input value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setCandidate(null); }} /></label>
          <button disabled={busy || !library.available || query.trim().length < 2}>Rechercher les entreprises</button>
        </form>
        {results.length > 0 && <fieldset><legend>Entreprises trouvées</legend>{results.map(item =>
          <label key={item.key} className={styles.candidate}><input type="radio" name="badge-identity" value={item.key}
            checked={candidate?.key === item.key} onChange={() => setCandidate(item)} />
            <span>{item.label}<small>{item.key.startsWith("personal:") ? "Votre bibliothèque" : "Référentiel marchand"} · {item.key.split(":")[1]}</small></span></label>)}</fieldset>}
        {candidate && <button type="button" disabled={busy || !library.available} onClick={() => confirm(false)}>Confirmer cette entreprise</button>}
        <button type="button" disabled={busy || !library.available || !query.trim() || !badge.anchor} onClick={() => confirm(true)}>Créer une fiche visuelle privée</button>
      </>}
    </section>
    <section><h3>Catégorie</h3>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (!identity || binding?.category != null) {
          if (!badge.anchor) throw Error("Choisissez d’abord l’entreprise.");
          const result = await badgeCommand({ kind: "ANCHOR_CATEGORY", anchor: badge.anchor, expectedVersion: bindingVersion, category: category || null });
          setBindingVersion(result.binding.version);
        } else {
          const current = await ensureIdentity();
          const next = (await badgeCommand({ kind: "CATEGORY", identityKey: identity.key, expectedVersion: current.version, category: category || null })).media;
          setMedia(next);
        }
        setMessage("Catégorie visuelle enregistrée.");
      }); }}>
        <label>Catégorie du badge<select value={category} disabled={busy || !library.available} onChange={event => setCategory(event.target.value as BadgeCategory | "")}>
          <option value="">Sans catégorie manuelle</option>{Object.entries(BADGE_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label><button disabled={busy || !library.available}>Conserver la catégorie</button>
      </form>
    </section>
    {identity?.policy !== "reuse_only" && <section><h3>Illustration</h3>
      {media?.imageUrl && <img src={media.imageUrl} alt={"Illustration personnelle de " + identity?.label} width={80} height={80} />}
      {media?.bundledAssetKey && identity && <button type="button" disabled={busy || !library.available} onClick={() => void run(async () => {
        const next = (await badgeCommand({ kind: "BUNDLED", identityKey: identity.key,
          expectedVersion: media.version, assetKey: null })).media as PersonalBadge;
        setMedia(next); setMessage("Choix Clay retiré.");
      })}>Retirer le choix Clay</button>}
      <p>PNG ou WebP, 5 Mo maximum. La transparence existante est conservée lors de la préparation du WebP.</p>
      <label>Fichier de l’illustration<input type="file" accept="image/png,image/webp" disabled={busy || !identity}
        onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      {!identity && <p>Confirmez l’entreprise pour lui associer une illustration.</p>}
      <button type="button" disabled={busy || !identity || !file || !library.available} onClick={() => void run(async () => {
        const current = await ensureIdentity(), body = new FormData();
        body.set("identityKey", current.key); body.set("expectedVersion", String(current.version)); body.set("file", file!);
        const response = await fetch(commerceLibraryPath, { method: "PUT", body, credentials: "same-origin", cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw Error(result.code === "BADGE_IMAGE_INVALID" ? "Ce fichier doit être un PNG ou WebP valide, fixe, de 4096 pixels maximum par côté."
          : result.code === "BADGE_CONFLICT" ? "La bibliothèque a changé. Rouvrez ce panneau avant de remplacer l’illustration."
            : "L’illustration n’a pas été enregistrée. Réessayez avec un fichier de 5 Mo maximum.");
        setMedia(result.media); setFile(null);
        setMessage("Illustration enregistrée dans votre bibliothèque privée.");
      })}>{media?.hasImage ? "Remplacer l’illustration" : "Ajouter l’illustration"}</button>
    </section>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </dialog>;
  return typeof document === "undefined" ? null : createPortal(panel, document.body);
}
