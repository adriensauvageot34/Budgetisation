import { useState, type ComponentProps } from "react";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { clayAssetArtwork, clayContextArtwork } from "../clay-v22-media";

const catalog = "/planned-visuals/builder/clay/catalog-compact";
const bar = "/planned-visuals/builder/clay/bar-compact";
const catalogImages = new Map([
  ["gift:flowers", `${catalog}/gift-flowers.webp`],
  ["gift:jewelry", `${catalog}/gift-jewelry.webp`],
  ["gift:clothes", `${catalog}/catalog-tshirt.webp`],
  ["gift:chocolate", `${catalog}/gift-chocolate.webp`],
  ["gift:gift_card", `${catalog}/gift-card.webp`],
  ["gift:book", `${catalog}/gift-book.webp`],
  ["gift:game", `${catalog}/gift-game.webp`],
  ["gift:toy", `${catalog}/gift-toy.webp`],
  ["gift:bottle", `${bar}/shared.webp`],
  ["club:merch", `${catalog}/catalog-tshirt.webp`],
  ["club:food", `${bar}/tapas.webp`],
  ["club:shot", `${bar}/shot.webp`],
  ["club:soft", `${bar}/soft.webp`],
  ["club:water", `${bar}/water.webp`],
]);

export function compactCatalogImage(assetKey: string) {
  return clayAssetArtwork(assetKey)?.src ?? catalogImages.get(assetKey);
}
export function historicalCatalogImage(assetKey: string) { return catalogImages.get(assetKey); }

export function CompactCatalogVisual({ src, iconKey, fallbackSrc, visualConceptId, className = "", size }: {
  src: string; iconKey: string; fallbackSrc?: string; visualConceptId?: string; className?: string; size?: number;
}) {
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);
  const current = [src, fallbackSrc].find((value): value is string => !!value && !failedSources.includes(value));
  return <span className={`${styles.compactCatalogVisual} ${className}`} style={size ? {width:size,height:size,flexBasis:size} : undefined}
    data-visual-concept-id={current === src ? visualConceptId : undefined} aria-hidden="true">
    {!current ? <PlannerIcon iconKey={iconKey} scale="PALETTE" />
      : <img src={current} width={size ?? 40} height={size ?? 40} alt="" loading="lazy" decoding="async"
        draggable={false} onError={() => setFailedSources(previous => [...previous, current])} />}
  </span>;
}

/** Exact catalogue key, or an explicitly identified generic context. Presets keep their own images. */
export function ComposerAssetVisual({ assetKey, templateKey, iconKey, className = "", size, identityRef, scale = 'LIBRARY' }: {
  assetKey: string; templateKey?: string; iconKey: string; className?: string; size?: number; identityRef?: string; scale?: ComponentProps<typeof PlannerIcon>['scale'];
}) {
  const artwork = clayAssetArtwork(assetKey) ?? clayContextArtwork(templateKey);
  const historical = catalogImages.get(assetKey);
  return artwork || historical ? <CompactCatalogVisual src={artwork?.src ?? historical!} fallbackSrc={historical}
    visualConceptId={artwork?.visualConceptId} iconKey={iconKey} className={className} size={size} />
    : <PlannerIcon iconKey={iconKey} identityRef={identityRef} scale={scale} className={className} />;
}
