"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { commerceBadges, type CommerceBadge } from "@/domain/phase2/planner/commerce-badges";
import { monthlyCommerceBadges } from "@/domain/phase2/planner/commerce-badge-profiles";
import type { BadgeLibraryRead } from "@/domain/phase2/commerce-media";
import { isNonMerchantKind } from "@/core/identity/merchant-kind";

const LibraryEditor = lazy(() => import("./commerce-library-editor").then(module => ({ default: module.CommerceLibraryEditor })));
const empty: BadgeLibraryRead = { media: [], bindings: [] };
export const commerceLibraryPath = "/api/composer/badge-library";

export async function badgeCommand(command: unknown) {
  const response = await fetch(commerceLibraryPath, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code === "BADGE_CONFLICT"
    ? "La bibliothèque a changé. Fermez ce panneau et rouvrez-le pour relire sa version."
    : result.code === "BADGE_POLICY_DENIED" ? "La politique visuelle de ce marchand ne permet pas cette action."
    : response.status === 401 ? "Reconnectez-vous pour accéder à votre bibliothèque privée."
      : "La bibliothèque privée est indisponible. Les badges génériques restent utilisables.");
  return result;
}

type LibraryState = BadgeLibraryRead & { available: boolean; open: (badge: CommerceBadge) => void };
const LibraryContext = createContext<LibraryState | null>(null);
export const useCommerceLibrary = () => useContext(LibraryContext);

export function resolveBadgeMedia(badge: CommerceBadge, library: BadgeLibraryRead | null) {
  const binding = badge.anchor ? library?.bindings.find(row => row.key === badge.anchor!.key && row.digest === badge.anchor!.digest) : undefined;
  const merchant = library?.merchants?.find(row => row.key === (badge.identity?.key ?? binding?.identityKey));
  if (isNonMerchantKind(merchant?.kind)) return { counterpartyKind: merchant.kind };
  if (merchant?.policy === "none") {
    return { policy: merchant.policy,
      identity: { key: merchant.key, label: merchant.displayName ?? badge.identity?.label ?? badge.label, policy: merchant.policy } };
  }
  // Explicit visual choice for this card; Canonical merchant identities stay unchanged.
  if (binding?.genericAsset) return { genericAsset: binding.genericAsset, businessLabel: binding.businessLabel, policy: merchant?.policy };
  const bound = binding?.identityKey ? library?.media.find(row => row.key === binding.identityKey) : undefined;
  const baseIdentity = badge.identity ?? (bound ? { key: bound.key, label: bound.label } : undefined);
  const identity = baseIdentity && merchant ? {
    ...baseIdentity, label: merchant.displayName ?? baseIdentity.label, policy: merchant.policy,
  } : baseIdentity;
  const personal = identity ? library?.media.find(row => row.key === identity.key) : undefined;
  const shared = merchant?.visualKey ? library?.media.find(row => row.key === merchant.visualKey) : undefined;
  const manualCategory = binding?.category ?? personal?.category ?? undefined;
  const merchantCategory = manualCategory ?? merchant?.genericCategory;
  return { identity, personal, shared, visualKey: merchant?.visualKey, policy: merchant?.policy,
    awaitingMerchant: identity?.key.startsWith("merchant:") && !merchant,
    category: merchantCategory ?? badge.category,
    imageCategory: merchantCategory ?? (identity?.key.startsWith("merchant:") ? undefined : badge.category),
    fallbackCategory: manualCategory ?? badge.category };
}

/** One bounded batch per set of displayed subjects, independent of the financial transports. */
export function CommerceLibraryProvider({ model, children }: { model: ComposerUiModel; children: ReactNode }) {
  const subjects = [...model.board.contexts.flatMap(context => commerceBadges(context, model.mobilityOptions?.places)),
    ...model.board.baselineControls.flatMap(monthlyCommerceBadges), ...model.board.discretionaryControls.flatMap(monthlyCommerceBadges)];
  const signature = JSON.stringify({
    keys: [...new Set(subjects.flatMap(subject => subject.identity ? [subject.identity.key] : []))].sort(),
    anchors: [...new Map(subjects.flatMap(subject => subject.anchor ? [[subject.anchor.key, subject.anchor] as const] : [])).values()]
      .sort((left, right) => left.key.localeCompare(right.key)),
  });
  const [library, setLibrary] = useState<BadgeLibraryRead>(empty);
  const [available, setAvailable] = useState(false), [generation, setGeneration] = useState(0);
  const [selected, setSelected] = useState<CommerceBadge | null>(null);
  useEffect(() => {
    const request = JSON.parse(signature) as { keys: string[]; anchors: NonNullable<CommerceBadge["anchor"]>[] };
    let cancelled = false;
    setLibrary(empty); setAvailable(false);
    const read = async () => {
      const merged: { media: BadgeLibraryRead["media"][number][]; bindings: BadgeLibraryRead["bindings"][number][];
        merchants: NonNullable<BadgeLibraryRead["merchants"]>[number][] } = { media: [], bindings: [], merchants: [] };
      const batches = Math.max(1, Math.ceil(Math.max(request.keys.length, request.anchors.length) / 100));
      for (let index = 0; index < batches; index++) {
        if (cancelled) return;
        const result = await badgeCommand({ kind: "READ", keys: request.keys.slice(index * 100, index * 100 + 100),
          anchors: request.anchors.slice(index * 100, index * 100 + 100) }) as BadgeLibraryRead;
        merged.media.push(...result.media); merged.bindings.push(...result.bindings); merged.merchants.push(...(result.merchants ?? []));
      }
      if (!cancelled) {
        setLibrary({ media: [...new Map(merged.media.map(item => [item.key, item])).values()],
          bindings: merged.bindings, merchants: [...new Map(merged.merchants.map(item => [item.key, item])).values()] });
        setAvailable(true);
      }
    };
    void read().catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [signature, generation]);
  const open = useCallback((badge: CommerceBadge) => setSelected(badge), []);
  const value = useMemo(() => ({ ...library, available, open }), [library, available, open]);
  return <LibraryContext.Provider value={value}>{children}
    {selected && <Suspense fallback={<p role="status">Ouverture de la bibliothèque…</p>}>
      <LibraryEditor badge={selected} library={value} refresh={() => setGeneration(current => current + 1)} close={() => setSelected(null)} />
    </Suspense>}
  </LibraryContext.Provider>;
}
