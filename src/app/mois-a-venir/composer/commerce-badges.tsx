"use client";

import { useState } from "react";
import { ArrowLeftRight, Building2, CreditCard, Croissant, MapPin, Martini, Scissors, ShoppingCart, Sparkles, Store, UserRound, Utensils, Shirt, House, Ticket, ImagePlus } from "lucide-react";
import { nonMerchantLabel } from "@/core/identity/merchant-kind";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import { monthlyCommerceBadges } from "@/domain/phase2/planner/commerce-badge-profiles";
import { commerceBadges, type CommerceContext, type CommerceBadge } from "@/domain/phase2/planner/commerce-badges";
import { BADGE_CATEGORIES, type BadgeCategory } from "@/domain/phase2/commerce-media";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { resolveBadgeMedia, useCommerceLibrary } from "./commerce-library";
import styles from "./composer.module.css";
export { commerceBadges } from "@/domain/phase2/planner/commerce-badges";

const icons = { platform: Store, salon: Scissors, restaurant: Utensils, bar: Martini, place: MapPin, merchant: Building2, seller: Store };
const categoryIcons: Partial<Record<BadgeCategory, typeof Store>> = { GROCERIES: ShoppingCart, BAKERY: Croissant, RESTAURANT: Utensils, BAR: Martini, HAIRDRESSER: Scissors,
  BEAUTY: Sparkles, CLOTHING: Shirt, HOME: House, ACTIVITY: Ticket, SHOP: Store };

function CommerceBadgeView({ badge, expanded = false }: { badge: CommerceBadge; expanded?: boolean }) {
  const library = useCommerceLibrary();
  const { identity, personal, shared, visualKey, category, imageCategory, fallbackCategory, counterpartyKind, policy, awaitingMerchant, genericAsset, businessLabel } = resolveBadgeMedia(badge, library);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const candidates = awaitingMerchant ? [] : commerceBadgeImages({ identityKey: identity?.key, sharedKey: visualKey, category: imageCategory,
    personalSrc: personal?.imageUrl, sharedPersonalSrc: shared?.imageUrl, genericSrc: genericAsset?.src, policy });
  const image = candidates.find(candidate => !failed.includes(candidate.src));
  const categoryIcon = fallbackCategory ? categoryIcons[fallbackCategory] : undefined;
  const Icon = counterpartyKind === "private_person" ? UserRound : counterpartyKind === "personal_transfer_label" ? ArrowLeftRight
    : counterpartyKind === "payment_instrument" ? CreditCard : categoryIcon ?? icons[badge.kind];
  const boundIdentity = identity && !badge.identity;
  const caption = businessLabel ?? (badge.custom ? identity?.label ?? (category ? BADGE_CATEGORIES[category] : badge.text)
    : counterpartyKind ? `${nonMerchantLabel(counterpartyKind)} · ${badge.label}`
    : boundIdentity && identity.label !== badge.label ? `${badge.text} · ${identity.label}` : badge.text);
  const title = businessLabel ?? [caption, policy === "none" ? "Exclu des illustrations" : null, category ? `Catégorie · ${BADGE_CATEGORIES[category]}` : null,
    image && personal?.imageUrl === image.src ? personal.bundledAssetKey ? "Badge Clay choisi" : "Illustration privée" : null].filter(Boolean).join(" · ");
  if (badge.custom && !identity && !category && !genericAsset && library) return <button type="button" className={styles.commerceBadgeAdd}
    aria-label={`Choisir le badge entreprise de ${badge.cardLabel ?? badge.label}`}
    onClick={event => { event.stopPropagation(); library.open(badge); }}>
    <ImagePlus size={14} aria-hidden="true" /> Entreprise
  </button>;
  const editable = !counterpartyKind && policy !== "none" && !awaitingMerchant && library && (identity || badge.anchor);
  const compact = !!genericAsset && !expanded;
  const attrs = { className: styles.commerceBadge, "data-commerce-badge": badge.kind, "data-badge-identity": identity?.key,
    "data-badge-policy": policy, "data-badge-category": category, "data-badge-visual": image?.kind ?? (categoryIcon ? "CATEGORY_ICON" : "NEUTRAL"),
    "data-generic-badge": genericAsset?.key, "data-badge-compact": compact || undefined, title };
  const contents = <>
    {image ? <img key={image.src} src={image.src} alt="" width={24} height={24} loading="lazy" decoding="async"
      onError={() => setFailed(current => current.includes(image.src) ? current : [...current, image.src])} />
      : <Icon size={15} aria-hidden="true" />}
    {!compact && <span>{caption}</span>}
    {policy === "none" && <small>Exclu des illustrations</small>}
    {editable && !genericAsset && <span className={styles.commerceBadgeEdit}><ImagePlus size={12} aria-hidden="true" /><span>Badge</span></span>}
  </>;
  return editable ? <button type="button" {...attrs} aria-label={`Personnaliser le badge ${businessLabel ?? badge.label}`}
    onClick={event => { event.stopPropagation(); library!.open(badge); }}>{contents}</button> : <span {...attrs}>{contents}</span>;
}

export function CommerceBadges({ context, model, expanded = false }: { context: CommerceContext; model: ComposerUiModel; expanded?: boolean }) {
  const badges = commerceBadges(context, model.mobilityOptions?.places);
  return badges.length ? <span className={styles.commerceBadges} aria-label="Identités et lieux">
    {badges.map(badge => <CommerceBadgeView key={badge.kind + (badge.identity?.key ?? badge.anchor?.digest ?? badge.label)} badge={badge} expanded={expanded} />)}
  </span> : null;
}

export function MonthlyCommerceBadge({ card, expanded }: { card: ComposerCardView; expanded: boolean }) {
  return <>{monthlyCommerceBadges(card).map(badge => <CommerceBadgeView key={badge.anchor!.key} badge={badge} expanded={expanded} />)}</>;
}
