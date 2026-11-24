import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import type { CalendarArtwork } from "./calendar-metadata";
import { clayAssetArtwork, clayBuilderArtwork, clayContextArtwork, clayV22Artwork } from "./clay-v22-media";

const categories = "/planned-visuals/commerce/categories";

export function composerCalendarArtwork({ label, art, badge, category }: {
  label: string; art?: RealizedCard["art"]; badge?: RealizedPayment["badge"]; category?: string;
}): CalendarArtwork {
  const ownBadge = badge?.sources.find(src => src.startsWith("/"));
  if (ownBadge) return { src: ownBadge, kind: "badge" };
  const generic = category === "groceries" || /courses alimentaires/iu.test(label) ? "groceries"
    : category === "tobacco-vape" || /tabac|\bvape\b/iu.test(label) ? "tobacco"
    : /mini[- ]golf|\bgolfy\b|golf miniature/iu.test(label) ? "mini-golf"
    : /titres?[- ]restau|carte ticket restaurant/iu.test(label) ? "tickets" : undefined;
  if (generic) return { src: `${categories}/${generic}.webp`, kind: "badge" };
  const kayak = /cano[eëé]|kayak/iu.test(label) ? clayV22Artwork("v22-art:extra:kayak-activity")?.src : undefined;
  const categoryAssets: Readonly<Record<string, string>> = {
    fuel: "transport:fuel_usage", "adrien-work-coffee": "scene:coffee",
    "adrien-work-meals": "scene:work_meal", "manon-work-meals": "scene:work_meal",
  };
  const utility = /r[ée]gie|\beau\b/iu.test(label) && /r[ée]gie|logement/iu.test(label) ? `${categories}/public-services.webp` : undefined;
  const src = kayak ?? utility ?? clayAssetArtwork(category ? categoryAssets[category] : undefined)?.src
    ?? art?.src ?? clayAssetArtwork(art?.assetKey)?.src
    ?? (art?.assetKey ? clayBuilderArtwork(art.assetKey, "compact")?.src : undefined)
    ?? clayContextArtwork(art?.templateKey)?.src ?? clayContextArtwork("activity")!.src;
  return { src, kind: "clay" };
}
