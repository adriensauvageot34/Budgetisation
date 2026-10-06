import type { ComponentType } from "react";
import type { ClayIconProps } from "./clay-frame";
import { GroceriesIcon } from "./icons/groceries";
import { TobaccoIcon } from "./icons/tobacco";
import { MealIcon } from "./icons/meal";
import { HaircutIcon } from "./icons/haircut";
import { RestaurantIcon } from "./icons/restaurant";
import { NightOutIcon } from "./icons/night-out";
import { ClothingIcon } from "./icons/clothing";
import { ShortStayIcon } from "./icons/short-stay";
import { GiftIcon } from "./icons/gift";
import { FamilyIcon } from "./icons/family";
import { BeautyIcon } from "./icons/beauty";
import { BowlingIcon } from "./icons/bowling";
import { SavingsIcon } from "./icons/savings";
import { TicketIcon } from "./icons/ticket";
import { BeforeIcon } from "./icons/before";
import { CarIcon } from "./icons/car";
import { TramIcon } from "./icons/tram";
import { LodgingIcon } from "./icons/lodging";
import { FuelIcon } from "./icons/fuel";
import { ActivityIcon } from "./icons/activity";
import { HomeIcon } from "./icons/home";
// The registry maps visual keys only. Capabilities remain server-owned.
const icons: Readonly<Record<string, ComponentType<ClayIconProps>>> = {
  "groceries": GroceriesIcon,
  "tobacco": TobaccoIcon,
  "meal": MealIcon,
  "haircut": HaircutIcon,
  "restaurant": RestaurantIcon,
  "night-out": NightOutIcon,
  "clothing": ClothingIcon,
  "short-stay": ShortStayIcon,
  "gift": GiftIcon,
  "family": FamilyIcon,
  "beauty": BeautyIcon,
  "bowling": BowlingIcon,
  "savings": SavingsIcon,
  "ticket": TicketIcon,
  "before": BeforeIcon,
  "car": CarIcon,
  "tram": TramIcon,
  "lodging": LodgingIcon,
  "fuel": FuelIcon,
  "activity": ActivityIcon,
  "home": HomeIcon,
  food: MealIcon, delivery: MealIcon, "fast-food": MealIcon,
};
const sizes = { CARD: 54, SATELLITE: 30, PALETTE: 34 } as const;
export function PlannerIcon({ iconKey, scale = "CARD", className }: { iconKey: string; scale?: keyof typeof sizes; className?: string }) {
  const Icon = icons[iconKey] ?? ActivityIcon;
  return <span data-planner-icon={iconKey} data-icon-scale={scale} className={className} aria-hidden="true"><Icon size={sizes[scale]} /></span>;
}
