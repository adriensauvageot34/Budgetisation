import Image from "next/image";

const globalClay = "/analyse-globale/clay";
const composerCompact = "/planned-visuals/builder/clay/v22/compact";
const composerPresets = "/planned-visuals/composer/presets";

const clayIcons = {
  overview: `${globalClay}/overview.webp`,
  expenses: `${globalClay}/expenses.webp`,
  categories: `${globalClay}/categories.webp`,
  events: `${globalClay}/events.webp`,
  profiles: `${globalClay}/profiles.webp`,
  car: `${globalClay}/car.webp`,
  activity: `${composerCompact}/v22-art-extra-activity-intent.webp`,
  groceries: `${composerCompact}/v22-art-extra-groceries-intent.webp`,
  family: `${composerCompact}/v22-art-extra-family-visit.webp`,
  travel: `${composerCompact}/v22-art-extra-travel-intent.webp`,
  home: `${composerPresets}/home-evening.webp`,
  night: `${composerPresets}/techno-night.webp`,
  concert: `${composerPresets}/concert.webp`,
  beach: `${composerPresets}/beach-day.webp`,
  celebration: `${composerCompact}/v22-art-extra-birthday-occasion.webp`,
  restaurant: `${composerCompact}/v22-art-extra-restaurant-intent.webp`,
  photo: `${composerCompact}/v22-art-extra-photo-activity.webp`,
  health: "/planned-visuals/commerce/categories/pharmacy.webp",
} as const;

export type GlobalClayIconName = keyof typeof clayIcons;

export function GlobalClayIcon({ name, size, className }: {
  readonly name: GlobalClayIconName;
  readonly size: number;
  readonly className?: string;
}) {
  return <Image src={clayIcons[name]} alt="" width={size} height={size} className={className}
    style={{ objectFit: "contain" }} draggable={false} unoptimized />;
}
