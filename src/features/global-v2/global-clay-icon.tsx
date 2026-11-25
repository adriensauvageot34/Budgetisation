import Image from "next/image";

const composerClay = "/planned-visuals/builder/clay";
const composerPresets = "/planned-visuals/composer/presets";

const clayIcons = {
  overview: "/analyse-globale/clay/overview.webp",
  expenses: "/analyse-globale/clay/expenses.webp",
  categories: "/analyse-globale/clay/categories.webp",
  events: `${composerClay}/intent/activity.webp`,
  profiles: `${composerClay}/social/group.webp`,
  groceries: `${composerClay}/intent/groceries.webp`,
  car: `${composerClay}/transport/car.webp`,
  family: `${composerClay}/social/family.webp`,
  travel: `${composerClay}/intent/travel.webp`,
  home: `${composerPresets}/home-evening.webp`,
  night: `${composerPresets}/techno-night.webp`,
  concert: `${composerPresets}/concert.webp`,
  beach: `${composerPresets}/beach-day.webp`,
  celebration: `${composerClay}/social/birthday.webp`,
  restaurant: `${composerClay}/intent/restaurant.webp`,
  photo: `${composerClay}/activities/photo.webp`,
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
