import { useState } from "react";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";

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
  return catalogImages.get(assetKey);
}

export function CompactCatalogVisual({ src, iconKey }: { src: string; iconKey: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  return <span className={styles.compactCatalogVisual} aria-hidden="true">
    {failedSource === src ? <PlannerIcon iconKey={iconKey} scale="PALETTE" />
      : <img src={src} width={40} height={40} alt="" loading="lazy" decoding="async"
        draggable={false} onError={() => setFailedSource(src)} />}
  </span>;
}
