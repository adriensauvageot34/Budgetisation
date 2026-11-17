"use client";

import { useState } from "react";
import { ArrowLeftRight, Building2, Croissant, MapPin, Martini, Scissors, ShoppingCart, Sparkles, Store, UserRound, Utensils, Shirt, House, Ticket, ImagePlus } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { commerceBadges, type CommerceContext, type CommerceBadge } from "@/domain/phase2/planner/commerce-badges";
import { BADGE_CATEGORIES, type BadgeCategory } from "@/domain/phase2/commerce-media";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { resolveBadgeMedia, useCommerceLibrary } from "./commerce-library";
import styles from "./composer.module.css";
export { commerceBadges } from "@/domain/phase2/planner/commerce-badges";

const icons = { platform: Store, salon: Scissors, restaurant: Utensils, bar: Martini, place: MapPin, merchant: Building2, seller: Store };
const categoryIcons: Partial<Record<BadgeCategory, typeof Store>> = { GROCERIES: ShoppingCart, BAKERY: Croissant, RESTAURANT: Utensils, BAR: Martini, HAIRDRESSER: Scissors,
  BEAUTY: Sparkles, CLOTHING: Shirt, HOME: House, ACTIVITY: Ticket, SHOP: Store };

function CommerceBadgeView({ badge }: { badge: CommerceBadge }) {
  const library = useCommerceLibrary();
  const { identity, personal, shared, visualKey, category, imageCategory, fallbackCategory, counterpartyKind, policy, awaitingMerchant } = resolveBadgeMedia(badge, library);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const candidates = awaitingMerchant ? [] : commerceBadgeImages({ identityKey: identity?.key, sharedKey: visualKey, category: imageCategory,
    personalSrc: personal?.imageUrl, sharedPersonalSrc: shared?.imageUrl, policy });
  const image = candidates.find(candidate => !failed.includes(candidate.src));
  const categoryIcon = fallbackCategory ? categoryIcons[fallbackCategory] : undefined;
  const Icon = counterpartyKind === "private_person" ? UserRound : counterpartyKind === "personal_transfer_label" ? ArrowLeftRight
    : categoryIcon ?? icons[badge.kind];
  const boundIdentity = identity && !badge.identity;
  const caption = counterpartyKind ? `${counterpartyKind === "private_person" ? "Contrepartie privée" : "Virement personnel"} · ${badge.label}`
    : boundIdentity && identity.label !== badge.label ? `${badge.text} · ${identity.label}` : badge.text;
  const title = [caption, policy === "none" ? "Exclu des illustrations" : null, category ? `Catégorie · ${BADGE_CATEGORIES[category]}` : null,
    image && personal?.imageUrl === image.src ? "Illustration privée" : null].filter(Boolean).join(" · ");
  return <span className={styles.commerceBadge} data-commerce-badge={badge.kind} data-badge-identity={identity?.key} data-badge-policy={policy}
    data-badge-category={category} data-badge-visual={image?.kind ?? (categoryIcon ? "CATEGORY_ICON" : "NEUTRAL")} title={title}>
    {image ? <img key={image.src} src={image.src} alt="" width={24} height={24} loading="lazy" decoding="async"
      onError={() => setFailed(current => current.includes(image.src) ? current : [...current, image.src])} />
      : <Icon size={15} aria-hidden="true" />}
    <span>{caption}</span>
    {policy === "none" && <small>Exclu des illustrations</small>}
    {!counterpartyKind && policy !== "none" && !awaitingMerchant && library && (identity || badge.anchor) && <button type="button" className={styles.commerceBadgeEdit}
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
