"use client";

import { useState } from "react";
import { ArrowLeftRight, Building2, MapPin, Martini, Scissors, ShoppingCart, Sparkles, Store, UserRound, Utensils, Shirt, House, Ticket, ImagePlus } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { commerceBadges, type CommerceContext, type CommerceBadge } from "@/domain/phase2/planner/commerce-badges";
import { BADGE_CATEGORIES } from "@/domain/phase2/commerce-media";
import { commerceAssetPath, commerceIllustrations } from "@/ui/media/commerce-illustrations";
import { resolveBadgeMedia, useCommerceLibrary } from "./commerce-library";
import styles from "./composer.module.css";
export { commerceBadges } from "@/domain/phase2/planner/commerce-badges";

const icons = { platform: Store, salon: Scissors, restaurant: Utensils, bar: Martini, place: MapPin, merchant: Building2, seller: Store };
const categoryIcons = { GROCERIES: ShoppingCart, RESTAURANT: Utensils, BAR: Martini, HAIRDRESSER: Scissors,
  BEAUTY: Sparkles, CLOTHING: Shirt, HOME: House, ACTIVITY: Ticket, SHOP: Store };

function CommerceBadgeView({ badge }: { badge: CommerceBadge }) {
  const library = useCommerceLibrary();
  const { identity, personal, shared, visualKey, category, counterpartyKind } = resolveBadgeMedia(badge, library);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const globalSpecific = identity ? commerceAssetPath(commerceIllustrations.identities[identity.key]) : undefined;
  const sharedSpecific = visualKey ? commerceAssetPath(commerceIllustrations.identities[visualKey]) : undefined;
  const generic = category ? commerceAssetPath(commerceIllustrations.categories[category]) : undefined;
  const candidates = [personal?.imageUrl, globalSpecific, shared?.imageUrl, sharedSpecific, generic].filter((url): url is string => !!url);
  const src = candidates.find(url => !failed.includes(url));
  const Icon = counterpartyKind === "private_person" ? UserRound : counterpartyKind === "personal_transfer_label" ? ArrowLeftRight
    : category ? categoryIcons[category] : icons[badge.kind];
  const boundIdentity = identity && !badge.identity;
  const caption = counterpartyKind ? `${counterpartyKind === "private_person" ? "Contrepartie privée" : "Virement personnel"} · ${badge.label}`
    : boundIdentity && identity.label !== badge.label ? `${badge.text} · ${identity.label}` : badge.text;
  const title = [caption, category ? `Catégorie · ${BADGE_CATEGORIES[category]}` : null,
    src && personal?.imageUrl === src ? "Illustration privée" : null].filter(Boolean).join(" · ");
  return <span className={styles.commerceBadge} data-commerce-badge={badge.kind} data-badge-identity={identity?.key}
    data-badge-category={category} data-badge-visual={src ? src === generic ? "CATEGORY" : "IDENTITY" : category ? "CATEGORY_ICON" : "NEUTRAL"} title={title}>
    {src ? <img key={src} src={src} alt="" width={24} height={24} loading="lazy" decoding="async"
      onError={() => setFailed(current => current.includes(src) ? current : [...current, src])} />
      : <Icon size={15} aria-hidden="true" />}
    <span>{caption}</span>
    {!counterpartyKind && library && (identity || badge.anchor) && <button type="button" className={styles.commerceBadgeEdit}
      aria-label={`Personnaliser le badge ${badge.label}`} title={!category && !identity ? "Choisir une catégorie ou ajouter une illustration"
        : personal?.hasImage ? "Modifier l’illustration ou la catégorie" : "Ajouter une illustration"}
      onClick={event => { event.stopPropagation(); library.open(badge); }}><ImagePlus size={12} aria-hidden="true" /></button>}
  </span>;
}

export function CommerceBadges({ context, model }: { context: CommerceContext; model: ComposerUiModel }) {
  const badges = commerceBadges(context, model.mobilityOptions?.places);
  return badges.length ? <span className={styles.commerceBadges} aria-label="Identités et lieux">
    {badges.map(badge => <CommerceBadgeView key={badge.kind + (badge.identity?.key ?? badge.anchor?.digest ?? badge.label)} badge={badge} />)}
  </span> : null;
}
